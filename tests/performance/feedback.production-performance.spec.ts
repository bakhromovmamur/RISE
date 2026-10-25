import { test, expect } from "../support/browser";
import { capacityProfile } from "../support/capacity";
import { localDate, xpTotal } from "../../src/model";
import { parseStoredState } from "../../src/data/storedState";

test("dense Today check-in measures visible feedback and durable status without reviewer controls", async ({ page, browser }, info) => {
  const date = localDate("UTC"), state = capacityProfile(date);
  state.dailyPriorities[date] = [{ kind: "habit", habitId: state.habits[0].id }];
  await page.goto("/");
  await expect(page.locator('meta[name="rise-build"]')).toHaveAttribute("content", "production");
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  await page.evaluate(async raw => {
    if (location.origin !== "http://127.0.0.1:4181") throw new Error("Synthetic performance data requires the production-test origin");
    // Seed the disposable test context after normal initialization, keeping the
    // existing migration/recovery envelope. Reload runs production validation.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rise-device", 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("profile", "readwrite"), profiles = tx.objectStore("profile"), request = profiles.get("current");
        request.onsuccess = () => profiles.put({ ...request.result, state: JSON.parse(raw), revision: request.result.revision + 1 }, "current");
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    }
    finally { db.close(); }
  }, JSON.stringify(state));
  await page.reload();
  await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeVisible();
  await expect(page.locator(".reviewer")).toHaveCount(0);
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  const card = page.locator(".priority-list article").filter({ has: page.getByRole("button", { name: "View Synthetic habit 0", exact: true }) });
  const check = card.getByRole("button", { name: /^(Log 20 pages|Full · 20 pages · Log Synthetic habit 0)/ });
  await expect(check).toBeVisible();
  await page.evaluate(() => {
    document.addEventListener("click", () => {
      performance.mark("rise-capacity-input");
      let feedback = false;
      const observer = new MutationObserver(() => {
        if (!feedback && document.querySelector(".priority-list article.completed")) {
          feedback = true;
          performance.mark("rise-capacity-dom");
          requestAnimationFrame(() => requestAnimationFrame(() => performance.mark("rise-capacity-frame")));
        }
        if (feedback && document.querySelector('[data-storage-status="saved"]')) {
          performance.mark("rise-capacity-saved"); observer.disconnect();
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    }, { capture: true, once: true });
  });
  await check.click();
  await expect(card).toHaveClass(/completed/);
  await expect(card).toContainText("Full target completed");
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  await page.waitForFunction(() => performance.getEntriesByName("rise-capacity-frame").length === 1);
  const measurements = await page.evaluate(() => {
    const input = performance.getEntriesByName("rise-capacity-input")[0].startTime;
    return { domFeedbackMs: performance.getEntriesByName("rise-capacity-dom")[0].startTime - input,
      frameOpportunityMs: performance.getEntriesByName("rise-capacity-frame")[0].startTime - input,
      savedStatusMs: performance.getEntriesByName("rise-capacity-saved")[0].startTime - input };
  });
  // Reload through production validation, then read the real committed record.
  // JSON text keeps 73,000 remote descriptors outside the test protocol.
  await page.reload();
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  await expect(card).toHaveClass(/completed/);
  const raw = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rise-device", 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction("profile", "readonly").objectStore("profile").get("current");
        request.onsuccess = () => resolve(JSON.stringify(request.result.state)); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  const saved = parseStoredState(raw);
  expect(saved.days[date][0].check).toBe("full");
  expect(xpTotal(saved) - xpTotal(state)).toBe(20);
  for (const day of Object.keys(state.days).filter(day => day !== date)) expect(saved.days[day]).toEqual(state.days[day]);
  await info.attach("feedback-capacity-measurements", { contentType: "application/json", body: JSON.stringify({
    scope: "Single desktop production Today UI sample. DOM observer and frame opportunity are not physical paint, INP or p95 acceptance.",
    browser: browser.version(), date, viewport: { width: 393, height: 852 }, habits: 100, days: 730,
    measurements, invariants: "Real full check adds 20 XP; all earlier history survives reopening; reviewer controls absent.",
  }, null, 2) });
});
