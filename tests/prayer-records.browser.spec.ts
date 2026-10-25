import { test, expect, stored, reloadSaved, type Page } from "./support/browser";
import { createEmptyState } from "../src/data/initialState";
import { xpTotal, type State } from "../src/model";
import { samplePrayerDay, saveTimetable, prayerTotals } from "../src/prayerModel";
import { buildPrayerSchedule, type PrayerAlert } from "../src/prayerSchedule";
import { createTranslator, type Language } from "../src/i18n";

const date = "2026-10-21", next = "2026-10-22";
const at = (day: string, time: string) => Date.parse(`${day}T${time}:00+05:00`);
const dialog = (page: Page) => page.getByRole("dialog").last();
function profile() {
  let s = createEmptyState(); s.onboarded = true; s.name = "Synthetic"; s.timezone = "Asia/Tashkent";
  s.prayers.started = date; s.prefs.reduceMotion = true;
  for (const d of [date, next, "2026-10-23"]) s = saveTimetable(s, d, { ...samplePrayerDay(s.timezone), sample: false, source: "Synthetic timetable" });
  return s;
}
async function seed(page: Page, state: State, now: number) {
  await page.clock.install({ time: now }); await page.clock.setFixedTime(now);
  await page.addInitScript(raw => { if (localStorage.getItem("rise.local.v1") === null) localStorage.setItem("rise.local.v1", raw); }, JSON.stringify(state));
  await page.goto("/"); await stored(page);
}
async function closeSheets(page: Page) { while (await page.getByRole("dialog").count()) await page.keyboard.press("Escape"); }
async function preferences(page: Page, language: Language = "en") {
  const t = createTranslator(language);
  await closeSheets(page); await page.locator("#tab-you").click();
  await page.getByRole("button", { name: new RegExp(`^${t("Prayer preferences", "Namoz sozlamalari")}`) }).click();
}
async function plan(page: Page, language: Language = "en") {
  await preferences(page, language);
  await dialog(page).getByRole("button", { name: new RegExp(`^${createTranslator(language)("Prepare for Fajr", "Bomdodga tayyorlanish")}`) }).click();
}
async function incoming(page: Page, alert: PrayerAlert) {
  await page.evaluate(alert => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "rise-alert", alert } })), alert);
  await expect(page.getByRole("dialog", { name: "Fajr wake-up", exact: true })).toBeVisible();
}

test("saved future-dated history stays correctable after a backward clock change", async ({ page }) => {
  const s = profile(); s.prayers.days[next].entries.fajr.check = "missed";
  await seed(page, s, at(date, "03:00"));
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page.getByRole("tab", { name: "Salah", exact: true }).click();
  const cell = page.getByRole("button", { name: `Fajr, ${createTranslator("en").shortDate(next)}, Missed`, exact: true });
  await expect(cell).toBeEnabled(); await cell.click();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  expect((await stored(page)).prayers.days[next].entries.fajr.check).toBe("on_time");
  await dialog(page).getByRole("button", { name: "Undo this record", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Prayed on time", exact: true })).toBeDisabled();
  const saved = await stored(page); expect(saved.prayers.days).toEqual(profile().prayers.days); expect(xpTotal(saved)).toBe(0);
  await reloadSaved(page); expect((await stored(page)).prayers.days).toEqual(saved.prayers.days);
});

test("pause defaults to the original overnight Isha date and resumes without hiding earlier gaps", async ({ page }) => {
  let s = profile(); const day = structuredClone(s.prayers.days[date]); day.entries.isha.ends = "01:00";
  s = saveTimetable(s, date, day); const before = structuredClone(s.prayers.days);
  await seed(page, s, at(next, "00:30")); await preferences(page);
  await dialog(page).getByRole("button", { name: /^Period mode/ }).click();
  await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveValue(date);
  await expect(dialog(page).getByLabel("Pause from", { exact: true })).toHaveValue("isha");
  await dialog(page).getByRole("button", { name: "Pause prayer tracking", exact: true }).click();
  expect((await stored(page)).life.pauses[0].from).toBe(`${date}:4`);
  await closeSheets(page); await reloadSaved(page); await preferences(page);
  await dialog(page).getByRole("button", { name: /^Period mode/ }).click();
  await expect(dialog(page).getByRole("option", { name: "Asr", exact: true })).toHaveAttribute("disabled", "");
  await dialog(page).getByLabel("Date", { exact: true }).fill(next);
  await dialog(page).getByLabel("Resume from", { exact: true }).selectOption("dhuhr");
  await dialog(page).getByRole("button", { name: "Resume prayer tracking", exact: true }).click();
  const saved = await stored(page);
  expect(saved.life.pauses[0].through).toBe(`${next}:0`); expect(saved.prayers.days).toEqual(before); expect(xpTotal(saved)).toBe(0);
  await closeSheets(page); await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page.getByRole("tab", { name: "Salah", exact: true }).click();
  await expect(page.locator(".prayer-calendar-row").first()).toContainText("Streak pending");
});

test("unfinished Fajr draft retains its original date across midnight and reload", async ({ page }) => {
  const s = profile(); await seed(page, s, at(date, "23:55")); await plan(page);
  await dialog(page).getByLabel("A message from your evening self").fill("Synthetic note for Thursday only");
  const draft = (await stored(page)).life.drafts["fajr-plan"] as { date: string };
  expect(draft.date).toBe(next);
  await page.clock.setFixedTime(at("2026-10-23", "00:30")); await reloadSaved(page); await plan(page);
  await expect(dialog(page)).toContainText("Thursday, Oct 22");
  await expect(dialog(page).getByLabel("A message from your evening self")).toHaveValue("Synthetic note for Thursday only");
  await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  const saved = await stored(page);
  expect(saved.prayers.prepared[next].message).toBe("Synthetic note for Thursday only");
  expect(saved.prayers.prepared["2026-10-23"]).toBeUndefined(); expect(saved.prayers.days).toEqual(s.prayers.days);
  expect(saved.life.drafts["fajr-plan"]).toBeUndefined(); expect(xpTotal(saved)).toBe(0);
});

test("preview stop, backup and acknowledgment leave a different dated live alarm untouched", async ({ page }) => {
  const s = profile(); s.life.alarm = { date, stage: "stopped", backup: true };
  s.life.backupEnabled = true; s.life.delivery = { enabled: false, sound: false, acknowledgedFajr: [date] };
  await seed(page, s, at(date, "20:00")); await plan(page);
  await dialog(page).getByRole("button", { name: "Save & preview wake-up", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Stop this alarm", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Alarm stopped." })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Preview backup alarm", exact: true }).click();
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  const saved = await stored(page);
  expect(saved.life.alarm).toEqual(s.life.alarm); expect(saved.life.delivery).toEqual(s.life.delivery);
  expect(saved.prayers.days).toEqual(s.prayers.days); expect(xpTotal(saved)).toBe(0);
  await closeSheets(page); await reloadSaved(page); expect((await stored(page)).life.alarm).toEqual(s.life.alarm);
});

test("preview of today's stopped live alert cannot acknowledge it; actual acknowledgment cancels only its dated wake alerts", async ({ page }) => {
  const s = profile(); s.life.backupEnabled = true; s.prayers.preferences.reminders = false;
  s.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  const events = buildPrayerSchedule(s, at(date, "05:00")), wake = events.find(e => e.date === date && e.kind === "wake")!, backup = events.find(e => e.date === date && e.kind === "backup")!;
  await seed(page, s, wake.at + 1000); await incoming(page, wake);
  await dialog(page).getByRole("button", { name: "Stop this alarm", exact: true }).click();
  const stopped = await stored(page); expect(stopped.life.delivery?.acknowledgedFajr).toEqual([]);
  expect(buildPrayerSchedule(stopped, wake.at + 1000).some(e => e.key === backup.key)).toBe(true);
  await plan(page); await dialog(page).getByRole("button", { name: "Save & preview wake-up", exact: true }).click();
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  expect((await stored(page)).life.alarm?.stage).toBe("stopped");
  expect((await stored(page)).life.delivery?.acknowledgedFajr).toEqual([]);
  await closeSheets(page); await page.clock.setFixedTime(backup.at + 1000); await incoming(page, backup);
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  const acknowledged = await stored(page);
  expect(acknowledged.life.delivery?.acknowledgedFajr).toEqual([date]);
  const pending = buildPrayerSchedule(acknowledged, wake.at - 1);
  expect(pending.some(e => e.date === date && ["wake", "backup"].includes(e.kind))).toBe(false);
  expect(pending.some(e => e.date === next && e.kind === "wake")).toBe(true);
  expect(acknowledged.prayers.days).toEqual(s.prayers.days); expect(xpTotal(acknowledged)).toBe(0);
});

test("overnight break expires in the open form without losing its note or reusing its wrap-up minute", async ({ page }) => {
  let s = profile(); const day = structuredClone(s.prayers.days[date]); day.entries.isha.ends = "01:00";
  s = saveTimetable(s, date, day);
  s.prayers.work = { date, prayer: "isha", stage: "save", note: "Saved synthetic next step", wrapUntil: at(next, "00:31"), wrapUsed: true };
  await seed(page, s, at(next, "00:30"));
  await page.getByRole("button", { name: /Continue your prayer break/ }).click();
  await dialog(page).getByLabel("When I come back, I’ll…", { exact: true }).fill("Keep this synthetic note across midnight");
  await expect(dialog(page).getByRole("button", { name: "I need 60 seconds to save", exact: true })).toHaveCount(0);
  await page.clock.setFixedTime(at(next, "01:01")); await page.clock.runFor(16000);
  await expect(dialog(page)).toContainText("Isha’s window ended at 01:00.");
  await expect(dialog(page).getByLabel("When I come back, I’ll…", { exact: true })).toHaveValue("Keep this synthetic note across midnight");
  expect((await stored(page)).prayers.days).toEqual(s.prayers.days);
  await reloadSaved(page);
  await page.getByRole("button", { name: /Isha · record or return/ }).click();
  await expect(dialog(page).getByLabel("When I come back, I’ll…", { exact: true })).toHaveValue("Keep this synthetic note across midnight");
  await dialog(page).getByRole("button", { name: "Record Isha", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Prayed later", exact: true }).click();
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your day, Synthetic.", exact: true })).toBeFocused();
  const saved = await stored(page);
  expect(saved.prayers.work).toMatchObject({ date, stage: "returned", note: "Keep this synthetic note across midnight", wrapUsed: true });
  expect(saved.prayers.days[date].entries.isha.check).toBe("later"); expect(prayerTotals(saved).later).toBe(1); expect(xpTotal(saved)).toBe(0);
});

for (const [language, appearance, width, scale] of [
  ["en", "light", 375, 100], ["en", "dark", 1440, 100], ["ru", "light", 393, 100],
  ["ru", "dark", 320, 200], ["uz", "light", 430, 200], ["uz", "dark", 375, 100],
] as const) test(`prayer records and dated planning layout ${language}-${appearance}-${width}-${scale}`, async ({ page }, testInfo) => {
  const s = profile(); s.life.language = language; s.prefs.appearance = appearance;
  await page.setViewportSize({ width, height: 852 }); await seed(page, s, at(date, "20:00"));
  if (scale === 200) await page.evaluate(() => document.documentElement.style.fontSize = "32px");
  const t = createTranslator(language);
  const capture = async (name: string) => {
    await expect(dialog(page)).toBeVisible();
    if (await page.locator(".toast.visible").isVisible()) await page.locator(".toast.visible button").click();
    expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const headerFits = await dialog(page).locator(".sheet-header").evaluate(header => {
      const box = header.getBoundingClientRect();
      return [...header.children].every(child => {
        const r = child.getBoundingClientRect();
        return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      });
    });
    expect(headerFits, `${name}: title and controls stay inside the header`).toBe(true);
    await page.locator(".app-shell").screenshot({ path: testInfo.outputPath(`${name}.png`) });
  };
  await plan(page, language); await capture("dated-fajr");
  await dialog(page).getByRole("button", { name: t("Save & preview wake-up", "Saqlash va uyg‘onish namunasini ko‘rish"), exact: true }).click();
  await dialog(page).getByRole("button", { name: t("I’m up", "Uyg‘ondim"), exact: true }).click();
  await capture("preview-acknowledged");
  await preferences(page, language);
  await dialog(page).getByRole("button", { name: new RegExp(`^${t("Period mode", "Hayz davri rejimi")}`) }).click();
  await capture("private-pause");
  expect((await stored(page)).prayers.days).toEqual(s.prayers.days); expect(xpTotal(await stored(page))).toBe(0);
});
