import type { BrowserContext } from "@playwright/test";
import { test, expect, stored, type Page } from "../support/browser";
import { xpTotal } from "../../src/model";

async function version(page: Page, value: string, extra: { broken?: boolean; incompatible?: boolean; lateActivation?: boolean } = {}) {
  const response = await page.request.post("/__pwa_test__/version", { data: { version: value, ...extra } });
  expect(response.ok()).toBe(true);
}
// Firefox's offline emulation currently rejects navigation before consulting its worker.
// Disconnect the isolated HTTP server instead: the actual worker must serve every cold-start file.
async function disconnect(page: Page, context: BrowserContext, browserName: string) {
  if (browserName === "firefox") await page.request.post("/__pwa_test__/network?offline=true");
  else await context.setOffline(true);
}
async function reconnect(page: Page, context: BrowserContext, browserName: string) {
  if (browserName === "firefox") await page.request.post("/__pwa_test__/network?offline=false");
  else await context.setOffline(false);
}
async function ready(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return !!registration?.active && !!navigator.serviceWorker.controller;
  })).toBe(true);
  await settings(page);
  await expect(page.locator('[data-offline-ready="true"]')).toBeVisible();
  await page.keyboard.press("Escape");
}
async function settings(page: Page) {
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await page.getByRole("dialog").locator("summary").filter({ hasText: "Install & offline" }).click();
}
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose other habits first", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create my plan", exact: true }).click();
  await stored(page); await ready(page);
}
async function waitUpdate(page: Page) {
  await settings(page);
  await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Update RISE", exact: true })).toBeVisible();
}
async function apply(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Update RISE", exact: true }).click();
}
const release = (page: Page) => page.locator('meta[name="rise-release"]').getAttribute("content");
test.beforeEach(async ({ page }) => {
  await version(page, "A");
  await page.clock.install({ time: new Date("2026-10-21T03:00:00Z") });
});

test("an approved update reloads after activation exceeds the reply deadline without losing saved records", async ({ page }) => {
  await onboard(page);
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  const before = await stored(page), previous = await release(page);
  expect(xpTotal(before)).toBe(10);
  await version(page, "B", { lateActivation: true });
  await waitUpdate(page); await apply(page);
  await expect.poll(() => release(page), { timeout: 20000 }).toBe(previous!.replace(/-A$/, "-B"));
  expect(await stored(page)).toEqual(before);
  await page.reload(); expect(await stored(page)).toEqual(before);
});

test("successive explicit updates and rollback retain the saved journey", async ({ page }) => {
  await onboard(page);
  const before = await stored(page), initial = await release(page);
  for (const value of ["B", "C", "D", "A"]) {
    await version(page, value); await waitUpdate(page); await apply(page);
    await expect.poll(() => release(page), { timeout: 20000 }).toBe(initial!.replace(/-A$/, `-${value}`));
    expect(await stored(page)).toEqual(before);
  }
});

test("approved replacement pauses background private reads and retains saved records", async ({ page }) => {
  await onboard(page);
  const before = await stored(page), initial = await release(page);
  let reads = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/v1/session") reads++; });
  // Exercise WorkspaceSession's real account client through its resume event.
  // The timer belongs only to this isolated document and ends on reload/close.
  await page.evaluate(() => { setInterval(() => window.dispatchEvent(new Event("focus")), 20); });
  await page.clock.runFor(200);
  await expect.poll(() => reads).toBeGreaterThan(0);
  await version(page, "B", { lateActivation: true }); await waitUpdate(page); await apply(page);
  await expect(page.locator(".pwa-notice")).toContainText("Saving and updating RISE");
  // The worker's real twelve-second delay keeps the approved handoff observable.
  await page.clock.runFor(200);
  const heldReads = reads;
  await page.clock.runFor(1000);
  expect(reads).toBe(heldReads);
  await expect.poll(() => release(page), { timeout: 20000 }).toBe(initial!.replace(/-A$/, "-B"));
  expect(await stored(page)).toEqual(before);
  const resumedReads = reads;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => reads).toBeGreaterThan(resumedReads);
});

test("manifest, icons, manual guidance and exactly one root worker", async ({ page }) => {
  await onboard(page); await settings(page);
  await expect(page.getByRole("dialog")).toContainText("Share → Add to Home Screen");
  await expect(page.getByRole("dialog")).toContainText("does not enable background prayer notifications");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
  for (const icon of manifest.icons) {
    const image = await page.request.get(icon.src); expect(image.ok()).toBe(true); expect(image.headers()["content-type"]).toBe("image/png");
  }
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, script: r.active?.scriptURL })))).toEqual([{ scope: "http://127.0.0.1:4181/", script: "http://127.0.0.1:4181/notifications-sw.js" }]);
});

test("warm and cold offline starts preserve records and can export a backup", async ({ page, context, browserName }) => {
  await onboard(page); await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  const original = await stored(page); expect(xpTotal(original)).toBe(10);
  await context.setOffline(true);
  await expect(page.locator(".pwa-notice")).toContainText("You’re offline");
  await context.setOffline(false);
  await disconnect(page, context, browserName);
  const response = await page.reload(); expect(response?.fromServiceWorker()).toBe(true);
  if (browserName !== "firefox") await expect(page.locator(".pwa-notice")).toContainText("You’re offline");
  expect(await stored(page)).toEqual(original);
  await page.close(); const cold = await context.newPage();
  const coldResponse = await cold.goto("/"); expect(coldResponse?.fromServiceWorker()).toBe(true);
  expect(await stored(cold)).toEqual(original);
  await cold.getByRole("tab", { name: "You", exact: true }).click();
  await cold.getByRole("button", { name: /^Settings Appearance/ }).click();
  await cold.getByRole("dialog").locator("summary").filter({ hasText: "Your data" }).click();
  const download = cold.waitForEvent("download"); await cold.getByRole("button", { name: /Export local data/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await reconnect(cold, context, browserName); await expect(cold.locator(".pwa-notice")).toHaveCount(0);
});

test("an unopened deferred group screen remains available on a cold offline start", async ({page,context,browserName})=>{
  await onboard(page);
  const before=await stored(page);
  await disconnect(page,context,browserName);
  try{
    await page.close();const cold=await context.newPage();
    const response=await cold.goto('/');expect(response?.fromServiceWorker()).toBe(true);
    await cold.getByRole('tab',{name:'You',exact:true}).click();
    await cold.getByRole('button',{name:/^Family Tasks/}).click();
    await expect(cold.getByRole('dialog').getByRole('button',{name:'Choose your account',exact:true})).toBeVisible();
    expect(await stored(cold)).toEqual(before);
    await reconnect(cold,context,browserName);
  }finally{
    if(browserName==='firefox')await context.request.post('/__pwa_test__/network?offline=false');
    else await context.setOffline(false);
  }
});

test("private/auth/logout responses and mutations never enter public caches", async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await (await caches.open("unrelated-private-test")).put("/sentinel", new Response("untouched"));
    await fetch("/api/profile"); await fetch("/auth/session"); await fetch("/logout", { method: "POST" });
    await fetch("/api/command", { method: "POST", body: "synthetic" });
  });
  const keys = await page.evaluate(async () => (await Promise.all((await caches.keys()).filter(k => k.startsWith("rise-public-")).map(async key => (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat());
  expect(keys.length).toBeGreaterThan(10);
  expect(keys.some(key => /api|auth|logout/.test(key))).toBe(false);
  expect(await page.evaluate(async () => (await (await caches.open("unrelated-private-test")).match("/sentinel"))?.text())).toBe("untouched");
  await context.setOffline(true);
  expect(await page.evaluate(async () => { try { await fetch("/api/profile"); return "network"; } catch { return "unavailable"; } })).toBe("unavailable");
});

test("an open form in another tab blocks activation, then both saved tabs update together", async ({ page, context }) => {
  await onboard(page);
  const other = await context.newPage(); await other.goto("/other-tab"); await stored(other);
  const openGoal = async () => {
    await other.getByRole("tab", { name: "Progress", exact: true }).click();
    await other.getByRole("tab", { name: "Goals", exact: true }).click();
    await other.getByRole("button", { name: "New goal", exact: true }).click();
  };
  await openGoal();
  await other.getByRole("dialog").getByLabel("Goal name", { exact: true }).fill("Unfinished personal goal");
  await other.getByRole("dialog").getByLabel("Milestone 1", { exact: true }).fill("Keep this private draft");
  const original = await stored(other); expect(original.goals).toEqual([]);
  await version(page, "B"); await waitUpdate(page); await apply(page);
  await expect(page.locator(".pwa-notice")).toContainText("Close open forms");
  expect(await release(page)).toMatch(/-A$/); expect(await release(other)).toMatch(/-A$/);
  await expect(other.getByRole("dialog")).toBeVisible(); expect(await stored(other)).toEqual(original);
  await other.keyboard.press("Escape");
  await page.locator(".pwa-notice").getByRole("button", { name: "Update RISE", exact: true }).click();
  await expect.poll(() => release(page)).toMatch(/-B$/); await expect.poll(() => release(other)).toMatch(/-B$/);
  expect(await stored(page)).toEqual(original); expect(await stored(other)).toEqual(original);
  await openGoal();
  await expect(other.getByRole("dialog").getByLabel("Goal name", { exact: true })).toHaveValue("Unfinished personal goal");
  await expect(other.getByRole("dialog").getByLabel("Milestone 1", { exact: true })).toHaveValue("Keep this private draft");
});

test("a failed asset installation retains the previous offline shell and data", async ({ page, context, browserName }) => {
  await onboard(page); const original = await stored(page);
  await version(page, "B", { broken: true });
  await settings(page); await page.getByRole("button", { name: "Check for updates", exact: true }).click();
  await expect.poll(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration("/"))?.installing)).toBe(true);
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration("/"))?.waiting)).toBe(false);
  await page.keyboard.press("Escape"); await disconnect(page, context, browserName); await page.reload();
  expect(await release(page)).toMatch(/-A$/); expect(await stored(page)).toEqual(original);
  expect(await page.evaluate(() => caches.keys())).not.toContain(expect.stringMatching(/-B$/));
});

test("incompatible storage contracts remain waiting and cannot force a reload", async ({ page }) => {
  await onboard(page); const original = await stored(page);
  await version(page, "B", { incompatible: true }); await waitUpdate(page); await apply(page);
  await expect(page.locator(".pwa-notice")).toContainText("Older tabs may need to be closed");
  expect(await release(page)).toMatch(/-A$/); expect(await stored(page)).toEqual(original);
});

test("a tab blocked during storage startup prevents activation until verified readback finishes", async ({ page, context }) => {
  await onboard(page); const original = await stored(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("rise-device", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction("profile", "readwrite"); let keep = true;
    const next = () => { const request = tx.objectStore("profile").get("current"); request.onsuccess = () => { if (keep) next(); }; };
    next(); tx.oncomplete = () => db.close();
    Object.assign(window, { releasePwaLock: () => { keep = false; } });
  });
  const other = await context.newPage(); await other.goto("/", { waitUntil: "domcontentloaded" });
  await expect(other.locator('[data-storage-status="saved"]')).toHaveCount(0);
  await version(page, "B"); await waitUpdate(page); await apply(page);
  await expect(page.locator(".pwa-notice")).toContainText("Close open forms");
  expect(await release(page)).toMatch(/-A$/); expect(await release(other)).toMatch(/-A$/);
  await page.evaluate(() => Reflect.get(window, "releasePwaLock")());
  expect(await stored(other)).toEqual(original);
  await page.locator(".pwa-notice").getByRole("button", { name: "Update RISE", exact: true }).click();
  await expect.poll(() => release(page)).toMatch(/-B$/); await expect.poll(() => release(other)).toMatch(/-B$/);
  expect(await stored(other)).toEqual(original);
});

test("a failed durable command keeps unsaved export available and blocks updates until retry succeeds", async ({ page, context }) => {
  await onboard(page); const original = await stored(page);
  const other = await context.newPage(); await other.clock.install({ time: new Date("2026-10-21T03:00:00Z") }); await other.goto("/"); await stored(other);
  await version(page, "B"); await waitUpdate(page);
  await other.evaluate(() => {
    const add = IDBObjectStore.prototype.add; Object.assign(window, { pwaOriginalAdd: add });
    IDBObjectStore.prototype.add = function(...args) { if (this.name === "outbox") throw new DOMException("Synthetic quota failure", "QuotaExceededError"); return add.apply(this, args); };
  });
  await other.getByRole("button", { name: /Log tiny Read a little/ }).click();
  await expect(other.getByRole("heading", { name: "Your saved data needs attention" })).toBeVisible();
  await apply(page); await expect(page.locator(".pwa-notice")).toContainText("Close open forms");
  expect(await release(page)).toMatch(/-A$/); expect(await stored(page)).toEqual(original);
  const pending = other.waitForEvent("download"); await other.getByRole("button", { name: "Export unsaved changes", exact: true }).click();
  const stream = await (await pending).createReadStream(); let raw = ""; for await (const chunk of stream!) raw += chunk.toString();
  expect(xpTotal(JSON.parse(raw))).toBe(10);
  await other.evaluate(() => { IDBObjectStore.prototype.add = Reflect.get(window, "pwaOriginalAdd"); });
  await other.getByRole("button", { name: "Retry", exact: true }).click(); expect(xpTotal(await stored(other))).toBe(10);
  await page.locator(".pwa-notice").getByRole("button", { name: "Update RISE", exact: true }).click();
  await expect.poll(() => release(page)).toMatch(/-B$/); expect(xpTotal(await stored(page))).toBe(10);
});

test("clearing local data while an update waits cannot resurrect records from the public shell", async ({ page, context, browserName }) => {
  await onboard(page); await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click(); expect(xpTotal(await stored(page))).toBe(10);
  await version(page, "B"); await waitUpdate(page); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await page.getByRole("dialog").locator("summary").filter({ hasText: "Your data" }).click();
  await page.getByRole("button", { name: /^Clear local data Start again/ }).click();
  await page.getByRole("button", { name: "Clear local data", exact: true }).click();
  const fresh = await stored(page); expect(xpTotal(fresh)).toBe(0); expect(fresh.habits).toEqual([]); expect(fresh.onboarded).toBe(false);
  await disconnect(page, context, browserName); await page.reload();
  expect(await stored(page)).toMatchObject({ ...fresh });
  await expect(page.getByRole("button", { name: "Choose other habits first", exact: true })).toBeVisible();
});

for (const outcome of ["accepted", "dismissed"] as const) test(`install prompt ${outcome} is one-use and does not itself claim installation`, async ({ page }) => {
  await onboard(page); await settings(page);
  await page.evaluate(outcome => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(window, { pwaPromptCalls: 0 });
    Object.assign(event, { prompt: async () => { Reflect.set(window, "pwaPromptCalls", Reflect.get(window, "pwaPromptCalls") + 1); }, userChoice: Promise.resolve({ outcome }) });
    window.dispatchEvent(event);
  }, outcome);
  await page.getByRole("button", { name: "Install RISE", exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, "pwaPromptCalls"))).toBe(1);
  await expect(page.getByRole("button", { name: "Install RISE", exact: true })).toHaveCount(0);
  await expect(page.locator(".pwa-settings")).not.toContainText("RISE is installed in this browser.");
  if (outcome === "accepted") {
    // A synthetic event checks UI state transitions only; it does not certify a platform install.
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.locator(".pwa-settings")).toContainText("RISE is installed in this browser.");
  }
});
