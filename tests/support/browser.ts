import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { State } from "../../src/model";

export type { Page } from "@playwright/test";
export { expect };

export async function reloadSaved(page: Page) {
  // IndexedDB acknowledges durability asynchronously; reload only after the app reports it.
  await stored(page);
  await page.reload();
}

export async function stored(page: Page): Promise<State> {
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("rise-device", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<State>((resolve, reject) => {
        const r = db.transaction("profile").objectStore("profile").get("current"); r.onsuccess = () => resolve(r.result.state); r.onerror = () => reject(r.error);
      });
    } finally { db.close(); }
  });
}
/** Synthetic test editing only. Keeps the immutable legacy source unchanged. */
export async function replaceStored(page: Page, state: State) {
  if (!isolatedOrigins.has(new URL(page.url()).origin)) throw new Error("Test state requires an isolated origin");
  await stored(page);
  await page.evaluate(async state => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("rise-device", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("profile", "readwrite"), store = tx.objectStore("profile"), r = store.get("current");
        r.onsuccess = () => store.put({ ...r.result, state, revision: r.result.revision + 1 }, "current");
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, state);
}

const isolatedOrigins = new Set([
  "http://127.0.0.1:4180",
  "http://127.0.0.1:4181",
  "http://127.0.0.1:4182",
  "http://127.0.0.1:4191",
]);

export const test = base.extend<{ authDiagnostics: void }, { isolatedAuthQuota: void }>({
  authDiagnostics: [async ({ context, baseURL }, use, info) => {
    const events: { path: string; status: number; code?: string }[] = [], pending: Promise<void>[] = [];
    const paths = new Set(["/api/v1/session", "/api/v1/auth/code", "/api/v1/auth/verify"]);
    const codes = new Set(["invalid_code", "csrf_rejected", "rate_limited", "unavailable", "sign_in_required", "sign_out_first", "invalid_input"]);
    if (baseURL === "http://127.0.0.1:4191") context.on("response", response => {
      const url = new URL(response.url());
      if (url.origin !== baseURL || !paths.has(url.pathname)) return;
      if (events.length === 30) events.shift();
      const event: typeof events[number] = { path: url.pathname, status: response.status() }; events.push(event);
      if (!response.ok()) pending.push(response.json().then((value: unknown) => {
        const code = value && typeof value === "object" && "error" in value && value.error && typeof value.error === "object" && "code" in value.error ? value.error.code : null;
        event.code = typeof code === "string" && codes.has(code) ? code : "other";
      }).catch(() => { event.code = "unreadable"; }));
    });
    await use();
    if (info.status !== info.expectedStatus && events.length) {
      await Promise.all(pending);
      await info.attach("auth-outcomes", { body: JSON.stringify(events), contentType: "application/json" });
    }
  }, { auto: true }],
  isolatedAuthQuota: [async ({ browserName }, use, worker) => {
    if (worker.project.use.baseURL === "http://127.0.0.1:4191") {
      // Real browser engines share a loopback address. Isolate only their test
      // quota per sequential worker; production limits and user data stay intact.
      if (worker.config.workers !== 1) throw new Error(`${browserName} backend tests require one isolated worker`);
      const { default: prepare } = await import("../auth/setup.ts");
      await prepare();
    }
    await use();
  }, { scope: "worker", auto: true }],
  context: async ({ context, baseURL }, use) => {
    if (!baseURL || !isolatedOrigins.has(baseURL)) {
      throw new Error("Synthetic RISE tests require an isolated loopback origin on port 4180, 4181, 4182 or backend-test port 4191.");
    }
    const blocked: string[] = [];
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== baseURL) {
        blocked.push(url.origin);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    await use(context);
    expect(blocked, "Synthetic tests must not contact personal, production or external origins").toEqual([]);
  },
});
