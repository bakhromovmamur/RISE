import { Capacitor } from "@capacitor/core";
import type { JourneySession } from "../data/journeySession";
import { PWA_CONTRACT, WORKER_URL } from "./protocol";
import { registerAppWorker } from "./registration";
import { holdPrivateRequests, releasePrivateRequests } from "./requestHold";

type InstallPrompt = Event & { prompt(): Promise<unknown>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type PwaView = {
  enabled: boolean; online: boolean; installed: boolean; canInstall: boolean; offlineReady: boolean;
  waiting: boolean; updating: boolean; checking: boolean; persistent: boolean;
  error: "" | "offline" | "update" | "blocked" | "install" | "storage";
};
const disabled: PwaView = { enabled: false, online: true, installed: false, canInstall: false, offlineReady: false, waiting: false, updating: false, checking: false, persistent: false, error: "" };
let view = disabled;
let session: JourneySession | null = null;
let registration: ServiceWorkerRegistration | null = null;
let installPrompt: InstallPrompt | null = null;
let lease: { token: string; timer: ReturnType<typeof setTimeout> } | null = null;
const listeners = new Set<() => void>();
const release = () => document.querySelector<HTMLMetaElement>('meta[name="rise-release"]')?.content ?? "unknown";
function emit(change: Partial<PwaView>) { view = { ...view, ...change }; listeners.forEach(listener => listener()); }
export const pwaSnapshot = () => view;
export const subscribePwa = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function attachPwaSession(value: JourneySession) { session = value; }
function unlock(token: string) {
  if (lease?.token !== token) return;
  clearTimeout(lease.timer); releasePrivateRequests(token); session?.releaseUpdate(token); lease = null; emit({ updating: false });
}
function request(worker: ServiceWorker, data: object, timeout = 10000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Worker did not respond")); }, timeout);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    try { worker.postMessage(data, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); reject(error); }
  });
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
async function refresh() {
  if (lease) return;
  emit({ waiting: !!registration?.waiting });
  const active = registration?.active;
  if (!active) return;
  try {
    const status = record(await request(active, { type: "RISE_STATUS" }));
    if (lease) return;
    emit({ offlineReady: status.offlineReady === true && status.contract === PWA_CONTRACT });
    void request(active, { type: "RISE_PRUNE" }).catch(() => { /* Cache cleanup is optional; private data is never involved. */ });
  } catch { emit({ offlineReady: false }); }
}
export function startPwa() {
  if (view.enabled || !import.meta.env.PROD || import.meta.env.MODE === "review" || Capacitor.isNativePlatform() || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  emit({ enabled: true, online: navigator.onLine, installed: matchMedia("(display-mode: standalone)").matches || Reflect.get(navigator, "standalone") === true });
  window.addEventListener("online", () => { emit({ online: true }); void checkForUpdate(); });
  window.addEventListener("offline", () => emit({ online: false }));
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event as InstallPrompt; emit({ canInstall: true }); });
  window.addEventListener("appinstalled", () => { installPrompt = null; emit({ installed: true, canInstall: false }); });
  navigator.serviceWorker.addEventListener("message", async event => {
    const source = event.source;
    if (!(source instanceof ServiceWorker) || new URL(source.scriptURL).origin !== location.origin || new URL(source.scriptURL).pathname !== WORKER_URL) return;
    const data = record(event.data), port = event.ports[0];
    if (data.type === "RISE_CLIENT_STATUS") { port?.postMessage({ release: release(), contract: PWA_CONTRACT }); return; }
    if (data.type === "RISE_RELEASE_UPDATE" && typeof data.token === "string") { unlock(data.token); return; }
    if (data.type !== "RISE_PREPARE_UPDATE" || !port || typeof data.token !== "string" || !/^[\w-]{1,80}$/.test(data.token)) return;
    const token = data.token;
    const allowed = data.contract === PWA_CONTRACT && session && session.getSnapshot().state.onboarded
      && !document.querySelector('[role="dialog"]') && (!lease || lease.token === token);
    if (!allowed || !session) { port.postMessage({ ok: false, token }); return; }
    lease = { token, timer: setTimeout(() => { unlock(token); emit({ error: "blocked" }); }, 30000) };
    emit({ updating: true });
    const saved = await session.holdForUpdate(token);
    // Finish required durability first (including session-only sync), then prevent
    // background API traffic from restarting the retiring Chromium worker.
    const ok = saved && lease?.token === token && await holdPrivateRequests(token);
    if (!ok || document.querySelector('[role="dialog"]') || lease?.token !== token) {
      unlock(token); port.postMessage({ ok: false, token }); return;
    }
    port.postMessage({ ok: true, token, contract: PWA_CONTRACT });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (lease) location.reload(); else void refresh();
  });
  void registerAppWorker().then(connectRegistration).catch(() => emit({ error: navigator.onLine ? "update" : "offline" }));
  void navigator.storage?.persisted?.().then(persistent => emit({ persistent })).catch(() => {});
}
const watched = new WeakSet<ServiceWorkerRegistration>();
function connectRegistration(value: ServiceWorkerRegistration) {
  registration = value;
  if (watched.has(value)) return;
  watched.add(value);
  const watch = () => {
    const worker = value.installing;
    worker?.addEventListener("statechange", () => {
      if (["installed", "activated", "redundant"].includes(worker.state)) {
        if (worker.state === "redundant") emit({ error: "update" });
        setTimeout(() => { void refresh(); }, 0);
      }
    });
  };
  value.addEventListener("updatefound", watch); watch(); void refresh();
}
export async function checkForUpdate() {
  if (view.checking || view.updating) return;
  if (!navigator.onLine) { emit({ error: "offline" }); return; }
  emit({ checking: true, error: "" });
  try { connectRegistration(registration ?? await registerAppWorker()); await registration!.update(); await refresh(); }
  catch { emit({ error: "update" }); }
  finally { emit({ checking: false }); }
}
export async function applyUpdate() {
  const worker = registration?.waiting;
  if (!worker || view.updating) return;
  emit({ error: "" });
  try {
    const result = record(await request(worker, { type: "RISE_APPLY_UPDATE", token: crypto.randomUUID() }));
    if (result.ok !== true) emit({ error: "blocked", updating: false });
  } catch {
    // A reply timeout does not cancel activation. Keep an approved hold so a
    // later controller change reloads; its existing timer still bounds the hold.
    if (!lease) emit({ error: "update", updating: false });
  }
}
export async function installApp() {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null; emit({ canInstall: false, error: "" });
  try { await prompt.prompt(); await prompt.userChoice; }
  catch { emit({ error: "install" }); }
}
export async function protectStorage() {
  try { const persistent = await navigator.storage?.persist?.() ?? false; emit({ persistent, error: persistent ? "" : "storage" }); }
  catch { emit({ error: "storage" }); }
}
