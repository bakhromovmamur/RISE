import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { MessageChannel } from "node:worker_threads";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
type WorkerEvent = {
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
  request: Request;
  data?: unknown;
  source?: { url: string };
  ports: { postMessage(value: unknown): void }[];
  notification: { close(): void; data: unknown; tag?: string };
};
async function worker(options: { corrupt?: boolean; missing?: boolean; windowUrl?: string } = {}) {
  const source = await readFile("public/notifications-sw.js", "utf8");
  const files = new Map([["/index.html", "public-shell"], ["/assets/app-12345678.js", "public-app"]]);
  const build = { release: "new", contract: "db1-repository2-domain4", assets: [...files].map(([url, body]) => ({ url, sha256: hash(body) })) };
  const stores = new Map<string, Map<string, Response>>([["rise-public-v1-old", new Map([["/index.html", new Response("old-shell")]])], ["account-test", new Map([["/api/profile", new Response("private-sentinel")]])]]);
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const sent: unknown[] = [];
  let skip = 0, claimed = 0, opened = 0, closed = 0;
  const normalize = (input: string | Request) => new URL(typeof input === "string" ? input : input.url, "https://rise.test").pathname;
  runInNewContext(source.replace("/* RISE_BUILD */ null", JSON.stringify(build)), {
    self: { location: { origin: "https://rise.test" }, addEventListener(type: string, handler: (event: WorkerEvent) => void) { listeners.set(type, handler); },
      skipWaiting: async () => { skip++; }, clients: { claim: async () => { claimed++; }, matchAll: async () => options.windowUrl ? [{ id: "unresponsive", url: options.windowUrl, postMessage() {} }] : [], openWindow: async () => { opened++; } } },
    crypto: webcrypto, MessageChannel, URL, Request, Response, Uint8Array, Map, Set, Date, Promise, AbortController, setTimeout, clearTimeout,
    caches: {
      keys: async () => [...stores.keys()], delete: async (key: string) => stores.delete(key),
      open: async (key: string) => {
        if (!stores.has(key)) stores.set(key, new Map());
        const cache = stores.get(key)!;
        return { put: async (key: string, response: Response) => { cache.set(normalize(key), response.clone()); }, match: async (key: string) => cache.get(normalize(key))?.clone() };
      },
    },
    fetch: async (input: string | Request) => {
      const path = normalize(input);
      if (options.missing && path.endsWith(".js")) return new Response("unavailable", { status: 503 });
      return new Response(options.corrupt && path.endsWith(".js") ? "wrong-version" : files.get(path) ?? "network-private", { status: 200 });
    },
  });
  async function fire(type: string, extra: Partial<WorkerEvent> = {}) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)!({ request: new Request("https://rise.test/"), ports: [{ postMessage: value => sent.push(value) }], notification: { close() { closed++; }, data: {} },
      waitUntil: promise => { waits.push(promise); }, respondWith: promise => { response = promise; }, ...extra });
    await Promise.all(waits); return response ? await response : undefined;
  }
  return { fire, stores, sent, counts: () => ({ skip, claimed, opened, closed }) };
}

test("worker installation is complete and never forces an existing tab to reload", async () => {
  const app = await worker(); await app.fire("install");
  assert.equal(app.stores.get("rise-public-v1-new")?.size, 2);
  assert.equal(app.counts().skip, 0); assert.ok(app.stores.has("rise-public-v1-old"));
});
for (const failure of ["corrupt", "missing"] as const) test(`${failure} public asset rolls back only the new shell`, async () => {
  const app = await worker({ [failure]: true });
  await assert.rejects(app.fire("install"));
  assert.equal(app.stores.has("rise-public-v1-new"), false);
  assert.equal(await app.stores.get("rise-public-v1-old")!.get("/index.html")!.text(), "old-shell");
  assert.equal(await app.stores.get("account-test")!.get("/api/profile")!.text(), "private-sentinel");
});
test("private requests, mutations, cross-origin and query responses bypass the worker", async () => {
  const app = await worker(); await app.fire("install");
  for (const request of [new Request("https://rise.test/api/profile"), new Request("https://rise.test/auth/session"), new Request("https://rise.test/logout", { method: "POST" }), new Request("https://other.test/assets/app-12345678.js"), new Request("https://rise.test/assets/app-12345678.js?private=1")]) {
    assert.equal(await app.fire("fetch", { request }), undefined);
  }
  assert.equal(app.stores.get("rise-public-v1-new")?.size, 2);
});
test("activation cannot delete unrelated private caches", async () => {
  const app = await worker(); await app.fire("install"); await app.fire("activate");
  assert.equal(app.counts().claimed, 1); assert.ok(app.stores.has("account-test")); assert.ok(app.stores.has("rise-public-v1-old"));
});
test("worker status is explicit and restricted to same-origin application windows", async () => {
  const app = await worker(); await app.fire("install");
  await app.fire("message", { source: { url: "https://other.test/" }, data: { type: "RISE_STATUS" } });
  assert.equal(app.sent.length, 0);
  await app.fire("message", { source: { url: "https://rise.test/" }, data: { type: "RISE_STATUS" } });
  assert.deepEqual(JSON.parse(JSON.stringify(app.sent[0])), { release: "new", contract: "db1-repository2-domain4", offlineReady: true });
});
test("notification routing drops malformed, expired and future alerts without changing records", async () => {
  const app = await worker();
  const alert = { id: 1, key: "test", date: "2026-10-21", prayer: "fajr", kind: "wake", at: Date.now() - 1000, expiresAt: Date.now() + 60000 };
  for (const value of [null, { ...alert, kind: "script" }, { ...alert, expiresAt: 1 }, { ...alert, at: Date.now() + 10000 }]) {
    await app.fire("notificationclick", { notification: { close() {}, data: { alert: value } } });
  }
  assert.equal(app.counts().opened, 0);
  await app.fire("notificationclick", { notification: { close() {}, data: { alert } } });
  assert.equal(app.counts().opened, 1); assert.equal(app.stores.get("account-test")?.size, 1);
});


test("an unresponsive same-origin window beyond the start URL blocks forced activation", { timeout: 10000 }, async () => {
  const app = await worker({ windowUrl: "https://rise.test/other-tab" }); await app.fire("install");
  await app.fire("message", { source: { url: "https://rise.test/" }, data: { type: "RISE_APPLY_UPDATE", token: "test-token" } });
  assert.equal(app.counts().skip, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(app.sent[0])), { ok: false });
});
test("a RISE test notification still opens the fixed application without a prayer action", async () => {
  const app = await worker();
  await app.fire("notificationclick", { notification: { close() {}, tag: "rise-test", data: undefined } });
  assert.equal(app.counts().opened, 1);
  assert.equal(app.stores.get("account-test")?.size, 1);
});
