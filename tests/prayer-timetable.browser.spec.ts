import { test, expect, stored, reloadSaved, type Page } from "./support/browser";
import { createEmptyState } from "../src/data/initialState";
import { defaultCalculation, LOCATIONS, useCalculatedPrayers } from "../src/prayerCalculation";
import { prayerDateAdd, samplePrayerDay, saveTimetable, type PrayerDay } from "../src/prayerModel";
import { xpTotal, type State } from "../src/model";
import { createTranslator } from "../src/i18n";

const date = "2026-10-21", now = Date.parse(`${date}T12:00:00+05:00`);
const offsets = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
const dialog = (page: Page) => page.getByRole("dialog").last();
function profile(at = now) {
  const s = createEmptyState(); s.onboarded = true; s.prayers.started = "2026-01-01";
  return useCalculatedPrayers(s, defaultCalculation(), offsets, at);
}
async function seed(page: Page, s: State, at = now) {
  await page.clock.install({ time: at });
  await page.addInitScript(raw => {
    if (localStorage.getItem("rise.local.v1") === null) localStorage.setItem("rise.local.v1", raw);
  }, JSON.stringify(s));
  await page.goto("/"); await stored(page);
}
async function setup(page: Page) {
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /Prayer preferences/ }).click();
  await dialog(page).getByRole("button", { name: /^Prayer times/ }).click();
  await expect(dialog(page).getByRole("heading", { name: "Prayer times for your day." })).toBeVisible();
}
async function manual(page: Page) {
  await setup(page);
  await dialog(page).getByRole("button", { name: "Enter a timetable manually", exact: true }).click();
}
async function fillTimes(page: Page, day: PrayerDay) {
  for (const [id, name] of [["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const) {
    await dialog(page).getByLabel(`${name} begins`, { exact: true }).fill(day.entries[id].begins);
    await dialog(page).getByLabel(`${name} planned time`, { exact: true }).fill(day.entries[id].target);
    await dialog(page).getByLabel(`${name} ends`, { exact: true }).fill(day.entries[id].ends);
  }
}

test("manual UI edits replace calculated timestamps and remain unchanged after a method/location save", async ({ page }) => {
  const s = profile(); s.prayers.days[date].entries.fajr.check = "on_time";
  await seed(page, s); await manual(page);
  await dialog(page).getByLabel("Timetable source", { exact: true }).fill("Synthetic mosque");
  await dialog(page).getByLabel("Asr planned time", { exact: true }).fill("16:00");
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: /^Saved for/ })).toBeVisible();
  const saved = await stored(page), manualDay = saved.prayers.days[date];
  expect(manualDay.calculationKey).toBeUndefined();
  expect(manualDay.entries.asr.targetAt).toBe("2026-10-21T11:00:00.000Z");
  expect(manualDay.entries.fajr).toEqual(s.prayers.days[date].entries.fajr);
  await reloadSaved(page); await setup(page);
  await dialog(page).getByLabel("City", { exact: true }).selectOption("London");
  await dialog(page).getByLabel("Calculation method").selectOption("MuslimWorldLeague");
  await dialog(page).getByLabel("Asr convention").selectOption("Shafi");
  await dialog(page).getByRole("button", { name: "Use these prayer times", exact: true }).click();
  const changed = await stored(page);
  expect(changed.prayers.days[date]).toEqual(manualDay);
  expect(changed.timezone).toBe("Europe/London");
  expect(xpTotal(changed)).toBe(xpTotal(s));
  expect(await page.evaluate(() => localStorage.getItem("rise.local.v1"))).toBe(JSON.stringify(s));
});

test("manual date and quarter-hour timezone own their overnight instants without repeating to adjacent dates", async ({ page }) => {
  await seed(page, profile()); await manual(page);
  await dialog(page).getByLabel("Date", { exact: true }).fill("2026-10-22");
  await dialog(page).getByLabel("Timetable source", { exact: true }).fill("Travel timetable");
  await dialog(page).getByLabel("Time zone", { exact: true }).fill("Asia/Kathmandu");
  const day = samplePrayerDay("Asia/Kathmandu");
  day.entries.isha.target = "00:15"; day.entries.isha.ends = "05:00";
  await fillTimes(page, day);
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  const saved = await stored(page);
  expect(saved.prayers.days["2026-10-22"].entries.fajr.beginsAt).toBe("2026-10-21T23:35:00.000Z");
  expect(saved.prayers.days["2026-10-22"].entries.isha.targetAt).toBe("2026-10-22T18:30:00.000Z");
  expect(saved.prayers.days["2026-10-22"].timezone).toBe("Asia/Kathmandu");
  expect(saved.prayers.days["2026-10-21"].source).not.toBe("Travel timetable");
  expect(saved.prayers.days["2026-10-23"].source).not.toBe("Travel timetable");
  expect(saved.timezone).toBe("Asia/Tashkent");
  await reloadSaved(page); expect((await stored(page)).prayers.days["2026-10-22"]).toEqual(saved.prayers.days["2026-10-22"]);
});

test("a manual DST-gap date reports an error and retains saved state until the time is corrected", async ({ page }) => {
  await seed(page, profile()); await manual(page);
  await dialog(page).getByLabel("Date", { exact: true }).fill("2026-03-08");
  await dialog(page).getByLabel("Timetable source", { exact: true }).fill("Spring timetable");
  await dialog(page).getByLabel("Time zone", { exact: true }).fill("America/New_York");
  const day = samplePrayerDay("America/New_York");
  day.entries.fajr.begins = day.entries.fajr.target = "02:30";
  await fillTimes(page, day);
  const before = await stored(page);
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("These times do not exist");
  expect(await stored(page)).toEqual(before);
  await dialog(page).getByLabel("Fajr begins", { exact: true }).fill("03:30");
  await dialog(page).getByLabel("Fajr planned time", { exact: true }).fill("03:30");
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  expect((await stored(page)).prayers.days["2026-03-08"].entries.fajr.beginsAt).toBe("2026-03-08T07:30:00.000Z");
});

test("startup and resume after the rolling horizon preserve prior checked/manual dates", async ({ page }) => {
  let s = profile(); s.prayers.days[date].entries.fajr.check = "later";
  s = saveTimetable(s, "2026-10-22", { ...samplePrayerDay(s.timezone), source: "Synthetic manual date", sample: false });
  await seed(page, s);
  const before = await stored(page);
  await page.clock.setSystemTime(new Date("2026-12-01T00:00:00+05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(async () => !!(await stored(page)).prayers.days["2026-12-30"]).toBe(true);
  const resumed = await stored(page);
  expect(resumed.prayers.days["2026-10-22"]).toEqual(before.prayers.days["2026-10-22"]);
  expect(resumed.prayers.days[date].entries.fajr).toEqual(before.prayers.days[date].entries.fajr);
  expect(resumed.prayers.days["2026-12-31"]).toBeUndefined();
  await reloadSaved(page);
  expect((await stored(page)).prayers.days).toEqual(resumed.prayers.days);
});

test("detected device travel prompts review across reload and only explicit location saving changes settings", async ({ page }) => {
  await page.addInitScript(() => {
    const native = Intl.DateTimeFormat;
    const decorate = (formatter: Intl.DateTimeFormat, explicitZone: unknown) => {
      if (!explicitZone) {
        const resolved = formatter.resolvedOptions.bind(formatter);
        Object.defineProperty(formatter, "resolvedOptions", { value: () => ({ ...resolved(), timeZone: localStorage.getItem("test.device-zone") ?? "Asia/Tashkent" }) });
      }
      return formatter;
    };
    Intl.DateTimeFormat = new Proxy(native, {
      construct: (target, args) => decorate(Reflect.construct(target, args), args[1]?.timeZone),
      apply: (target, receiver, args) => decorate(Reflect.apply(target, receiver, args), args[1]?.timeZone),
    });
  });
  await seed(page, profile());
  const before = await stored(page);
  await page.evaluate(() => { localStorage.setItem("test.device-zone", "Europe/London"); window.dispatchEvent(new Event("focus")); });
  const review = page.getByRole("button", { name: /^Review your prayer location/ });
  await expect(review).toBeVisible();
  expect((await stored(page)).prayers.days).toEqual(before.prayers.days);
  expect((await stored(page)).timezone).toBe("Asia/Tashkent");
  await reloadSaved(page); await expect(review).toBeVisible();
  await page.getByRole("button", { name: "Keep my current prayer location", exact: true }).click();
  await expect(review).toHaveCount(0);
  await reloadSaved(page); await expect(review).toHaveCount(0);
  await page.evaluate(() => { localStorage.setItem("test.device-zone", "America/New_York"); window.dispatchEvent(new Event("focus")); });
  await expect(review).toBeVisible(); await review.click();
  await expect(dialog(page).getByRole("heading", { name: "Prayer times for your day." })).toBeVisible();
  expect((await stored(page)).timezone).toBe("Asia/Tashkent");
  await dialog(page).getByLabel("City", { exact: true }).selectOption("New York");
  await dialog(page).getByRole("button", { name: "Use these prayer times", exact: true }).click();
  const moved = await stored(page);
  expect(moved.timezone).toBe("America/New_York");
  expect(moved.life.deviceTimezone).toEqual({ observed: "America/New_York", reviewed: "America/New_York" });
  expect(moved.prayers.days[date].timezone).toBe("America/New_York");
});

test("polar resume exposes manual recovery and never offers fabricated calculated times", async ({ page }) => {
  const polar = { ...defaultCalculation(), label: "Longyearbyen", latitude: 78.2232, longitude: 15.6469, timezone: "Arctic/Longyearbyen" };
  const s = useCalculatedPrayers(profile(), polar, offsets, Date.parse("2026-04-01T12:00Z"));
  await seed(page, s, Date.parse("2026-06-21T12:00Z"));
  await expect(page.getByRole("heading", { name: "Prayer times unavailable", exact: true })).toBeVisible();
  expect((await stored(page)).prayers.days["2026-06-21"]).toBeUndefined();
  await page.getByRole("button", { name: "Enter a timetable manually", exact: true }).click();
  await dialog(page).getByLabel("Timetable source", { exact: true }).fill("Trusted polar timetable");
  await fillTimes(page, samplePrayerDay(polar.timezone));
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  const recovered = await stored(page);
  expect(recovered.prayers.days["2026-06-21"].sample).toBe(false);
  expect(recovered.prayers.days["2026-06-21"].calculationKey).toBeUndefined();
  expect(recovered.prayers.days["2026-06-22"]).toBeUndefined();
});

test("denied geolocation retains saved coordinates and allows city/manual recovery", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code: 1, message: "Synthetic denial", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) } });
  });
  await seed(page, profile()); await setup(page);
  const before = await stored(page);
  await dialog(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("Location is unavailable");
  expect((await stored(page)).life.calculation).toEqual(before.life.calculation);
  await dialog(page).getByLabel("City", { exact: true }).selectOption("London");
  await expect(dialog(page).getByRole("button", { name: "Use these prayer times", exact: true })).toBeEnabled();
  await dialog(page).getByRole("button", { name: "Enter a timetable manually", exact: true }).click();
  await expect(dialog(page).getByLabel("Time zone", { exact: true })).toHaveValue("Asia/Tashkent");
  expect((await stored(page)).prayers.days).toEqual(before.prayers.days);
});

test("a manual date retained after travel opens and records against its original timezone", async ({ page }) => {
  const at = Date.parse("2026-10-21T01:15Z");
  const london = { ...defaultCalculation(), ...LOCATIONS.find(l => l.label === "London")! };
  const day = { ...samplePrayerDay("Asia/Tashkent"), sample: false, source: "Saved travel mosque" };
  day.entries.fajr = { begins: "06:00", target: "06:10", ends: "06:30" };
  const s = saveTimetable(useCalculatedPrayers(profile(), london, offsets, at), date, day);
  await seed(page, s, at);
  await page.clock.setFixedTime(at);
  await expect(page.getByRole("button", { name: /Saved travel mosque · Asia\/Tashkent/ })).toBeVisible();
  await page.getByRole("button", { name: /^Fajr, Ready to record, planned 06:10/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Prayed on time", exact: true })).toBeEnabled();
  await expect(dialog(page).getByRole("button", { name: "Prayed later", exact: true })).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  const saved = await stored(page);
  expect(saved.prayers.days[date].entries.fajr.check).toBe("on_time");
  expect(saved.prayers.days[date].entries.fajr.performedAt).toBe("06:15");
  expect(saved.prayers.days[date].entries.fajr.recordedAt).toBe("2026-10-21T01:15:00.000Z");
  expect(saved.timezone).toBe("Europe/London");
  expect(xpTotal(saved)).toBe(xpTotal(s));
});

test("ambiguous legacy clock-only changes preserve history and ask for explicit manual review", async ({ page }) => {
  const s = profile(); s.prayers.days[date].entries.fajr.check = "on_time";
  s.prayers.days[date].entries.asr.target = "16:00";
  const before = structuredClone(s.prayers.days[date]);
  await seed(page, s);
  await expect(page.getByRole("heading", { name: "Review saved prayer times", exact: true })).toBeVisible();
  expect((await stored(page)).prayers.days[date]).toEqual(before);
  await page.getByRole("button", { name: "Enter a timetable manually", exact: true }).click();
  await expect(dialog(page).getByLabel("Asr planned time", { exact: true })).toHaveValue("16:00");
  await dialog(page).getByRole("button", { name: "Save times & preferences", exact: true }).click();
  const saved = await stored(page);
  expect(saved.prayers.days[date].calculationKey).toBeUndefined();
  expect(saved.prayers.days[date].entries.asr.targetAt).toBe("2026-10-21T11:00:00.000Z");
  expect(saved.prayers.days[date].entries.fajr).toEqual(before.entries.fajr);
  await reloadSaved(page);
  await expect(page.getByRole("heading", { name: "Review saved prayer times", exact: true })).toHaveCount(0);
});

for (const variant of [
  { width: 320, language: "ru", appearance: "dark", scale: 200 },
  { width: 375, language: "en", appearance: "light", scale: 100 },
  { width: 393, language: "ru", appearance: "light", scale: 200 },
  { width: 430, language: "uz", appearance: "dark", scale: 200 },
  { width: 1440, language: "en", appearance: "dark", scale: 100 },
  { width: 393, language: "uz", appearance: "light", scale: 100 },
] as const) {
  test(`travel review and manual controls reflow: ${variant.width}px ${variant.language} ${variant.appearance} ${variant.scale}%`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: variant.width, height: variant.width === 1440 ? 1000 : 852 });
    const s = profile(), t = createTranslator(variant.language);
    s.life.language = variant.language; s.prefs.appearance = variant.appearance;
    s.life.deviceTimezone = { observed: "Europe/London", reviewed: "Europe/London" };
    await seed(page, s);
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, variant.scale);
    const title = variant.language === "ru" ? "Проверьте место молитв" : variant.language === "uz" ? "Namoz joylashuvini tekshiring" : "Review your prayer location";
    const review = page.getByRole("button", { name: new RegExp(`^${title}`) });
    await review.scrollIntoViewIfNeeded(); await expect(review).toBeVisible();
    expect(await review.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("travel-review.png"), animations: "disabled" });
    await review.focus(); await page.keyboard.press("Enter");
    await dialog(page).getByRole("button", { name: t("Enter a timetable manually", "Jadvalni qo‘lda kiritish"), exact: true }).click();
    await expect(dialog(page).getByLabel(t("Time zone", "Vaqt mintaqasi"), { exact: true })).toHaveValue("Asia/Tashkent");
    expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await dialog(page).getByRole("heading", { level: 1 }).evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
    })).toBe(true);
    expect(await dialog(page).locator(".sheet-header").evaluate(el => {
      const heading = el.querySelector("h2")!, range = document.createRange(); range.selectNodeContents(heading);
      const text = range.getBoundingClientRect(), box = el.getBoundingClientRect();
      return text.top >= box.top && text.bottom <= box.bottom;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("manual-timetable.png"), animations: "disabled" });
  });
}
