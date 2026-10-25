import { test, expect, stored, reloadSaved, type Page } from "../support/browser";
import { createEmptyState } from "../../src/data/initialState";
import { defaultCalculation, useCalculatedPrayers } from "../../src/prayerCalculation";
import { samplePrayerDay } from "../../src/prayerModel";
import { xpTotal } from "../../src/model";

const now = Date.parse("2026-10-21T12:00:00+05:00"), date = "2026-10-21";
const dialog = (page: Page) => page.getByRole("dialog").last();
async function setup(page: Page) {
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /Prayer preferences/ }).click();
  await dialog(page).getByRole("button", { name: /^Prayer times/ }).click();
}

test("production first-use salah onboarding saves only the authored manual date and recovers it after reload", async ({ page }) => {
  await page.clock.install({ time: now }); await page.goto("/");
  await page.getByRole("button", { name: "Start with salah", exact: true }).click();
  const day = samplePrayerDay("Asia/Tashkent");
  await dialog(page).getByLabel("Timetable source", { exact: true }).fill("Synthetic trusted timetable");
  for (const [id, name] of [["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const) {
    for (const [key, suffix] of [["begins", "begins"], ["target", "planned time"], ["ends", "ends"]] as const)
      await dialog(page).getByLabel(`${name} ${suffix}`, { exact: true }).fill(day.entries[id][key]);
  }
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: /^Saved for/ })).toBeVisible();
  const saved = await stored(page);
  expect(saved.onboarded).toBe(true); expect(saved.mode).toBe("fresh");
  expect(Object.keys(saved.prayers.days)).toEqual([date]);
  expect(saved.prayers.days[date].sample).toBe(false);
  expect(saved.prayers.days[date].entries.fajr.beginsAt).toBe("2026-10-21T00:20:00.000Z");
  expect(saved.habits).toEqual([]); expect(xpTotal(saved)).toBe(0);
  expect(saved.life.delivery?.enabled ?? false).toBe(false);
  await reloadSaved(page); expect((await stored(page)).prayers.days).toEqual(saved.prayers.days);
  await expect(page.locator(".reviewer")).toHaveCount(0);
});

test("production calculates offline and reloads 30 actual dates with a selected method and quarter-hour zone", async ({ page, context }) => {
  await page.clock.install({ time: now }); await page.goto("/");
  await page.getByRole("button", { name: "Start with salah", exact: true }).click();
  await page.keyboard.press("Escape"); await setup(page);
  await context.setOffline(true);
  await dialog(page).getByLabel("City", { exact: true }).selectOption("custom");
  await dialog(page).getByLabel("Location name", { exact: true }).fill("Kathmandu");
  await dialog(page).getByLabel("Latitude", { exact: true }).fill("27.7172");
  await dialog(page).getByLabel("Longitude", { exact: true }).fill("85.324");
  await dialog(page).getByLabel("Time zone", { exact: true }).fill("Asia/Kathmandu");
  await dialog(page).getByLabel("Calculation method").selectOption("MuslimWorldLeague");
  await dialog(page).getByLabel("Asr convention").selectOption("Shafi");
  await dialog(page).getByText("Advanced calculation", { exact: true }).click();
  await dialog(page).getByLabel("High-latitude rule").selectOption("TwilightAngle");
  await dialog(page).getByRole("button", { name: "Use these prayer times", exact: true }).click();
  const saved = await stored(page);
  expect(saved.timezone).toBe("Asia/Kathmandu");
  expect(Object.keys(saved.prayers.days)).toHaveLength(30);
  expect(saved.life.calculation?.method).toBe("MuslimWorldLeague");
  expect(saved.life.calculation?.madhab).toBe("Shafi");
  expect(saved.life.calculation?.highLatitude).toBe("TwilightAngle");
  expect(Object.values(saved.prayers.days).every(d => !d.sample)).toBe(true);
  expect(saved.life.delivery?.enabled ?? false).toBe(false);
  await context.setOffline(false); await reloadSaved(page);
  expect((await stored(page)).prayers.days).toEqual(saved.prayers.days);
});

test("production startup detects travel in a saved profile while retaining its selected place and prayer history", async ({ page }) => {
  const base = createEmptyState(); base.onboarded = true;
  const s = useCalculatedPrayers(base, defaultCalculation(), { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, now);
  s.prayers.days[date].entries.fajr.check = "on_time";
  s.life.deviceTimezone = { observed: "Europe/London", reviewed: "Europe/London" };
  await page.clock.install({ time: now });
  await page.addInitScript(raw => { if (localStorage.getItem("rise.local.v1") === null) localStorage.setItem("rise.local.v1", raw); }, JSON.stringify(s));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Review your prayer location/ })).toBeVisible();
  const current = await stored(page);
  expect(current.timezone).toBe("Asia/Tashkent");
  expect(current.prayers.days).toEqual(s.prayers.days);
  await page.getByRole("button", { name: "Keep my current prayer location", exact: true }).click();
  await reloadSaved(page);
  await expect(page.getByRole("button", { name: /^Review your prayer location/ })).toHaveCount(0);
  expect((await stored(page)).prayers.days).toEqual(s.prayers.days);
});

test("first calculation in an earlier civil date remains recordable after selecting New York", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T01:00:00Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "Start with salah", exact: true }).click();
  await page.keyboard.press("Escape"); await setup(page);
  await dialog(page).getByLabel("City", { exact: true }).selectOption("New York");
  await dialog(page).getByRole("button", { name: "Use these prayer times", exact: true }).click();
  const configured = await stored(page);
  expect(configured.prayers.started).toBe("2026-10-20");
  expect(configured.timezone).toBe("America/New_York");
  while (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: /^Isha, Ready to record/ }).click();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  const recorded = await stored(page);
  expect(recorded.prayers.days["2026-10-20"].entries.isha.check).toBe("on_time");
  expect(recorded.prayers.days["2026-10-20"].entries.isha.performedAt).toBe("21:00");
  expect(xpTotal(recorded)).toBe(0);
});
