import type { SetStateAction } from "react";
import { STORAGE_KEY, localDate, type State } from "../model";
import { createEmptyState } from "./initialState";
import { DeviceStorageError, openDeviceStore, type DeviceRecord, type DeviceStore, type PendingWrite } from "./indexedDb";
import type { PreparedProfile } from "./migration";
import { parseStoredState } from "./storedState";
import { parseOperation, type DomainCommand, type LocalOperation } from "../contracts/commands";
import { applyDomainCommand } from "../domain/commands";
import { createLocalRepository } from "./repository";
import type { BackupSnapshot, RestorePreview } from "./backup";

function prepareInWorker(raw: string | null, initial: State): Promise<PreparedProfile> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./migration.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ ok: true; result: PreparedProfile } | { ok: false }>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result); else reject(new DeviceStorageError("invalid-data"));
    };
    worker.onerror = () => { worker.terminate(); reject(new DeviceStorageError("unavailable")); };
    worker.postMessage({ raw, initial: JSON.stringify(initial) });
  });
}
export async function startDeviceSession(initial = createEmptyState): Promise<DeviceSession> {
  const raw = localStorage.getItem(STORAGE_KEY), store = await openDeviceStore();
  try {
    const existing = await store.existing();
    const saved = existing ? await store.verify(raw) : await store.initialize(raw, await prepareInWorker(raw, initial()));
    if (localStorage.getItem(STORAGE_KEY) !== raw) throw new DeviceStorageError("legacy-changed");
    return new DeviceSession(store, saved);
  } catch (error) { store.close(); throw error; }
}
export interface SessionView {
  state: State;
  status: "saved" | "saving" | "attention";
  error: "conflict" | "save" | "legacy-changed" | "invalid-edit" | null;
}
/** Serializes stable personal operations and the remaining shared/review compatibility saves. */
export class DeviceSession {
  private view: SessionView;
  private queue: (PendingWrite | LocalOperation)[] = [];
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private clearing = false;
  private updateToken: string | null = null;
  private rejectedJson: string | null = null;
  private channel: BroadcastChannel | null = null;
  constructor(private readonly store: DeviceStore, private saved: DeviceRecord) {
    this.view = { state: saved.state, status: "saved", error: null };
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("rise-device-revision");
      this.channel.onmessage = () => { void this.refresh(); };
    }
    window.addEventListener("focus", this.onFocus);
    document.addEventListener("visibilitychange", this.onFocus);
    window.addEventListener("storage", this.onLegacyChange);
    window.addEventListener("beforeunload", this.onUnload);
  }
  get summary() { return this.saved.migration.summary; }
  get archives() { return this.saved.archives ?? []; }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private emit(view: SessionView) { this.view = view; this.listeners.forEach(listener => listener()); }
  private onFocus = () => { if (!document.hidden) void this.refresh(); };
  private onLegacyChange = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) void this.refresh(); };
  private onUnload = (event: BeforeUnloadEvent) => { if (this.queue.length || this.view.error) { event.preventDefault(); event.returnValue = ""; } };
  private fail(error: unknown) {
    this.emit({ ...this.view, status: "attention", error: error instanceof DeviceStorageError && (error.code === "conflict" || error.code === "legacy-changed") ? error.code : "save" });
  }
  setState = (action: SetStateAction<State>) => {
    if (this.view.error || this.clearing || this.updateToken) return; // Keep pending edits available for export; never overwrite them with a reset.
    try {
      const next = typeof action === "function" ? action(structuredClone(this.view.state)) : action;
      const json = JSON.stringify(next);
      if (json === JSON.stringify(this.view.state)) return;
      this.rejectedJson = json;
      const state = parseStoredState(json);
      this.rejectedJson = null;
      const write: PendingWrite = { operationId: crypto.randomUUID(), baseRevision: this.queue.at(-1) ? this.queue.at(-1)!.baseRevision + 1 : this.saved.revision, state };
      this.queue.push(write);
      this.emit({ state, status: "saving", error: null });
      void this.flush();
    } catch { this.rejectedJson ??= JSON.stringify(this.view.state); this.emit({ ...this.view, status: "attention", error: "invalid-edit" }); }
  };
  dispatch = (command: DomainCommand): State | null => {
    if (this.view.error || this.clearing || this.updateToken) return null;
    try {
      const now = Date.now(), current = this.view.state;
      const operation = parseOperation({ protocolVersion: 1, operationId: crypto.randomUUID(),
        baseRevision: this.queue.at(-1) ? this.queue.at(-1)!.baseRevision + 1 : this.saved.revision,
        context: { date: current.mode === "demo" ? current.demoDate : localDate(current.timezone, new Date(now)), now, timezone: current.timezone }, command });
      const next = applyDomainCommand(this.view.state, operation.command, operation.context);
      const json = JSON.stringify(next), state = parseStoredState(json);
      // Parsing validates without normalizing; reuse the same serialized result.
      if (json === JSON.stringify(this.view.state)) return this.view.state;
      this.queue.push(operation);
      this.emit({ state, status: "saving", error: null });
      void this.flush();
      return state;
    } catch {
      this.rejectedJson = JSON.stringify(this.view.state); // Never invoke accessors on a rejected command while exporting.
      this.emit({ ...this.view, status: "attention", error: "invalid-edit" });
      return null;
    }
  };
  async whenSaved(): Promise<boolean> {
    await this.flush();
    return !this.queue.length && !this.view.error;
  }
  /** Freeze new edits while an already-verified update waits for the durable queue. No schema changes. */
  async holdForUpdate(token: string): Promise<boolean> {
    if (this.clearing || this.view.error || (this.updateToken && this.updateToken !== token)) return false;
    this.updateToken = token;
    if (await this.whenSaved()) return true;
    this.releaseUpdate(token);
    return false;
  }
  releaseUpdate(token: string) { if (this.updateToken === token) this.updateToken = null; }
  private flush(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      while (this.queue.length && !this.view.error) {
        try {
          // Old clients are not permitted to fork the preserved localStorage source unnoticed.
          if (localStorage.getItem(STORAGE_KEY) !== await this.store.original()) throw new DeviceStorageError("legacy-changed");
          const pending = this.queue[0];
          if ("command" in pending) {
            const result = await createLocalRepository(this.store).apply(pending);
            if (!result.ok) throw new DeviceStorageError(result.code === "conflict" ? "conflict" : result.code === "operation-reused" ? "operation-reused" : "unavailable");
            this.saved = { ...this.saved, ...result.snapshot };
          } else this.saved = await this.store.commit(pending);
          this.queue.shift(); this.channel?.postMessage({ revision: this.saved.revision });
        } catch (error) { this.fail(error); }
      }
      if (!this.view.error) this.emit({ state: this.saved.state, status: "saved", error: null });
    })().finally(() => {
      this.running = null;
      if (this.queue.length && !this.view.error) void this.flush();
    });
    return this.running;
  }
  retry = async () => {
    if (this.rejectedJson !== null) return; // Invalid edits require export/reload, never a false saved acknowledgment.
    await this.running;
    this.emit({ ...this.view, error: null, status: "saving" }); await this.flush(); if (!this.queue.length) await this.refresh();
  };
  async refresh() {
    if (this.queue.length || this.view.error || this.running || this.clearing) return;
    try {
      const fresh = await this.store.verify(localStorage.getItem(STORAGE_KEY));
      if (this.queue.length || this.view.error || this.running || this.clearing) return;
      if (fresh.revision > this.saved.revision) {
        this.saved = fresh; this.emit({ state: fresh.state, status: "saved", error: null });
      }
    } catch (error) { this.fail(error); }
  }
  original = () => this.store.original();
  pendingExport = () => this.rejectedJson ?? JSON.stringify(this.view.state);
  async snapshot(): Promise<BackupSnapshot> {
    await this.flush();
    if (this.queue.length || this.view.error || this.clearing) throw new DeviceStorageError("unavailable");
    const record = await this.store.verify(localStorage.getItem(STORAGE_KEY));
    return { state: record.state, archives: record.archives ?? [], revision: record.revision };
  }
  restorePoint = () => this.store.restorePoint();
  async restore(preview: RestorePreview, operationId: string, recoveryId?: string) {
    if (this.clearing || this.updateToken) throw new DeviceStorageError("unavailable");
    this.clearing = true;
    try {
      await this.flush();
      if (this.queue.length || this.view.error) throw new DeviceStorageError("unavailable");
      if (localStorage.getItem(STORAGE_KEY) !== await this.store.original()) throw new DeviceStorageError("legacy-changed");
      this.saved = await this.store.restore(preview, operationId, recoveryId);
      this.emit({ state: this.saved.state, status: "saved", error: null });
      this.channel?.postMessage({ revision: this.saved.revision });
    } finally { this.clearing = false; }
  }
  async reloadSaved() {
    if (this.updateToken) return;
    await this.running;
    try {
      const fresh = await this.store.verify(localStorage.getItem(STORAGE_KEY));
      this.queue = []; this.rejectedJson = null; this.saved = fresh; this.emit({ state: fresh.state, status: "saved", error: null });
    } catch (error) { this.fail(error); }
  }
  clear = async (state: State): Promise<boolean> => {
    if (this.clearing || this.updateToken) return false;
    this.clearing = true;
    await this.flush();
    if (this.view.error || this.queue.length) { this.clearing = false; return false; }
    try {
      this.saved = await this.store.clear(this.saved.revision, state);
      this.emit({ state: this.saved.state, status: "saved", error: null });
      this.channel?.postMessage({ revision: this.saved.revision }); return true;
    } catch (error) { this.fail(error); return false; }
    finally { this.clearing = false; }
  };
  close() {
    this.channel?.close(); this.store.close();
    window.removeEventListener("focus", this.onFocus); document.removeEventListener("visibilitychange", this.onFocus);
    window.removeEventListener("storage", this.onLegacyChange); window.removeEventListener("beforeunload", this.onUnload);
  }
}
