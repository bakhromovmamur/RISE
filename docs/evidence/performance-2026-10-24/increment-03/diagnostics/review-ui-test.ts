import { test, expect } from "../support/browser";
import { capacityProfile } from "../support/capacity";
import { localDate, xpTotal } from "../../src/model";
import { parseStoredState } from "../../src/data/storedState";
import type {} from "../../src/review/storageHarness";

test("dense Today check-in measures visible feedback and durable status without reviewer controls", async ({ page, browser }, info) => {
  const date = localDate("UTC"), state = capacityProfile(date);
  state.dailyPriorities[date] = [{ kind: "habit", habitId: state.habits[0].id }];
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
  await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    try { await db.initialize(null, await api.prepareProfile(null, JSON.parse(raw))); }
    finally { db.close(); }
  }, JSON.stringify(state));
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeVisible();
  await expect(page.locator(".reviewer")).toHaveCount(0);
  await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  const card = page.locator(".priority-list article").filter({ has: page.getByRole("button", { name: "View Synthetic habit 0", exact: true }) });
  const check = card.getByRole("button", { name: /Log 20 pages/ });
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
  // Reopen through the real adapter; JSON text keeps the test protocol outside
  // the measured click path and avoids serializing 73,000 remote descriptors.
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
  const raw = await page.evaluate(async () => {
    const db = await window.riseStorageTest.openDeviceStore();
    try { return JSON.stringify((await db.verify(null)).state); } finally { db.close(); }
  });
  const saved = parseStoredState(raw);
  expect(saved.days[date][0].check).toBe("full");
  expect(xpTotal(saved) - xpTotal(state)).toBe(20);
  for (const day of Object.keys(state.days).filter(day => day !== date)) expect(saved.days[day]).toEqual(state.days[day]);
  await info.attach("feedback-capacity-measurements", { contentType: "application/json", body: JSON.stringify({
    scope: "Single desktop Today UI sample. DOM observer and frame opportunity are not physical paint, INP or p95 acceptance.",
    browser: browser.version(), date, viewport: { width: 393, height: 852 }, habits: 100, days: 730,
    measurements, invariants: "Real full check adds 20 XP; all earlier history survives reopening; reviewer controls absent.",
  }, null, 2) });
});
