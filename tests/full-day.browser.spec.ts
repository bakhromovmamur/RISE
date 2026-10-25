import { reloadSaved } from "./support/browser";
import { replaceStored } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { xpTotal, type State } from "../src/model";
import { PRAYERS } from "../src/prayerModel";

const date = "2026-10-19";
const dialog = (page: Page) => page.getByRole("dialog");
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Main navigation" }).getByRole("tab", { name, exact: true }).click();
const checkpoint = (page: Page, time: string) => page.getByRole("combobox", { name: "Day checkpoint", exact: true }).selectOption(time);
async function start(page: Page) {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption("full-day");
  await page.getByRole("button", { name: "Load selected fixture", exact: true }).click();
}
async function recordPrayer(page: Page, name: string, time: string) {
  await checkpoint(page, time);
  await page.locator("#panel-today").getByRole("button", { name: new RegExp(`^${name}, Ready to record`) }).click();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  await page.keyboard.press("Escape");
}

test("one full day joins five prayers, habits, family lists, goal achievement, rewards and the next Fajr plan", async ({ page }) => {
  await start(page);
  const initial = await stored(page);
  expect(initial.days[date].every((row) => !row.check)).toBe(true);
  expect(PRAYERS.every(({ id }) => !initial.prayers.days[date].entries[id].check)).toBe(true);
  expect(xpTotal(initial)).toBe(230);
  await dialog(page).getByRole("button", { name: "Stop this alarm", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Preview backup alarm", exact: true }).click();
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  await expect(dialog(page)).toContainText("No prayer recorded.");
  expect((await stored(page)).prayers.days).toEqual(initial.prayers.days);
  await checkpoint(page, "05:35");
  await dialog(page).getByRole("button", { name: "Record Fajr", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toContainText("Fajr recorded on time.");
  await expect(dialog(page)).not.toContainText("No prayer recorded.");
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your day, Mamur.", exact: true })).toBeFocused();

  await checkpoint(page, "08:00");
  await page.getByRole("button", { name: "Log 10 pages +20", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Claim & dress Pip", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Lovely, let’s keep going", exact: true }).click();
  await page.getByRole("button", { name: "View Take a walk", exact: true }).click();
  await dialog(page).getByRole("button", { name: /tiny/i }).click();
  await page.keyboard.press("Escape");
  await recordPrayer(page, "Dhuhr", "12:20");

  // A reminder opened from You must return to Today, retaining its work note.
  await checkpoint(page, "15:35");
  await tab(page, "You");
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /^Prayer reminders / }).click();
  await dialog(page).getByRole("button", { name: "Preview save-and-stop", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Save & step away", exact: true }).click();
  await dialog(page).getByLabel("When I come back, I’ll…", { exact: true }).fill("Connect the save button, then test the empty state.");
  await dialog(page).getByRole("button", { name: "Save & step away", exact: true }).click();
  await checkpoint(page, "15:45");
  await dialog(page).getByRole("button", { name: "I prayed Asr on time", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your day, Mamur.", exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Log 20 minutes +20", exact: true }).click();
  await expect(page.locator(".priority-complete")).toContainText("Your priorities are done");
  const actionsDone = await stored(page);
  expect(xpTotal(actionsDone)).toBe(280);
  expect(actionsDone.personalRewards.find((r) => r.id === "coffee")?.earnedOn).toBe(date);
  expect(actionsDone.goals.flatMap((g) => g.milestones).filter((m) => m.completedOn === date)).toHaveLength(0);
  await recordPrayer(page, "Maghrib", "17:45");
  await recordPrayer(page, "Isha", "19:05");

  await checkpoint(page, "20:30");
  await page.locator(".family-today > summary").click();
  await page.locator(".family-today").getByRole("button", { name: /^Choose our weekend outing / }).click();
  await dialog(page).getByRole("button", { name: /^Family shared lists / }).click();
  await expect(dialog(page).getByRole("button", { name: "Lists", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog(page).getByRole("button", { name: /^For the week / }).click();
  await dialog(page).getByRole("checkbox", { name: "Check Apples", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByRole("heading", { name: "Choose our weekend outing", exact: true })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Mark as done", exact: true }).click();
  await page.keyboard.press("Escape");
  await tab(page, "Progress");
  await expect(page.locator("#panel-progress")).toContainText("5 prayers on time");
  await expect(page.locator("#panel-progress")).toContainText("3 of 4 checked in");
  await expect(page.locator("#panel-progress")).toContainText("1 personal reward earned");
  await page.getByRole("tab", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: /^Launch a small vibecoded project / }).click();
  await dialog(page).getByRole("button", { name: "Complete Build the first working screen", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator("#panel-progress")).toContainText("1 milestone completed");
  await page.getByRole("button", { name: /^Rewards in Journey / }).click();
  await page.locator("#panel-journey").getByRole("button", { name: /^A slow coffee at my favorite café / }).click();
  await dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  await page.keyboard.press("Escape");
  expect(xpTotal(await stored(page))).toBe(280);

  await checkpoint(page, "22:00");
  await tab(page, "You");
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /^Prepare for Fajr / }).click();
  await expect(dialog(page)).toContainText("Fajr plan for Tuesday, Oct 20.");
  await dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true }).fill("Feet on the floor. I have made room for this.");
  await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  await expect(dialog(page).getByRole("status")).toHaveText("Plan saved on this device.");
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your day, Mamur.", exact: true })).toBeFocused();
  await expect(page.locator("#panel-today")).toContainText("Fajr plan saved");
  const final = await stored(page);
  expect(PRAYERS.every(({ id }) => final.prayers.days[date].entries[id].check === "on_time")).toBe(true);
  expect(final.dailyPriorities[date]).toEqual(initial.dailyPriorities[date]);
  expect(final.life.tasks.find((t) => t.id === "weekend")!.completions[date]).toBeTruthy();
  expect(final.life.lists[0].items.find((i) => i.id === "apples")!.checked).toBe(true);
  expect(final.personalRewards.find((r) => r.id === "coffee")!.enjoyedOn).toBe(date);
  expect(final.prayers.prepared["2026-10-20"].message).toBe("Feet on the floor. I have made room for this.");
  expect(PRAYERS.every(({ id }) => !final.prayers.days["2026-10-20"].entries[id].check)).toBe(true);
  await reloadSaved(page);
  expect(await stored(page)).toEqual(final);
});

test("Fajr acknowledgment follows explicit corrections and never records a prayer by itself", async ({ page }) => {
  await start(page);
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  await dialog(page).getByRole("button", { name: "View Fajr time", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Prayed on time", exact: true })).toBeDisabled();
  await checkpoint(page, "05:35");
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toContainText("Fajr recorded on time.");
  await dialog(page).getByRole("button", { name: "View Fajr record", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Undo this record", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toContainText("No prayer recorded.");
  await expect(dialog(page)).toContainText("Record Fajr when you’re finished.");
  await checkpoint(page, "08:00");
  await dialog(page).getByRole("button", { name: "Record Fajr", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Prayed later", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toContainText("Fajr recorded as prayed later.");
  expect(xpTotal(await stored(page))).toBe(230);
});

test("Fajr plans keep their displayed date, preserve drafts and distinguish saving from alarm delivery", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Escape");
  await tab(page, "You");
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /^Prepare for Fajr / }).click();
  await expect(dialog(page)).toContainText("Fajr plan for Monday, Oct 19.");
  await dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true }).fill("A date-specific morning message.");
  await checkpoint(page, "05:35");
  await expect(dialog(page)).toContainText("Fajr plan for Monday, Oct 19.");
  await dialog(page).getByRole("button", { name: "Check alarm readiness", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByRole("textbox", { name: "A message from your evening self", exact: true })).toHaveValue("A date-specific morning message.");
  await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  await expect(dialog(page).getByRole("status")).toContainText("Plan saved on this device.");
  expect((await stored(page)).prayers.prepared[date].message).toBe("A date-specific morning message.");
  expect((await stored(page)).prayers.prepared["2026-10-20"]).toBeUndefined();
  await dialog(page).getByLabel("Wake before Fajr", { exact: true }).selectOption("15");
  await expect(dialog(page).getByRole("status")).toHaveCount(0);
  const state = await stored(page);
  expect(state.life.drafts["fajr-plan"]).toMatchObject({ date });
  state.life.language = "uz";
  await replaceStored(page, state);
  await page.goto("/?review=1&text=large");
  await page.getByRole("tab", { name: "Siz", exact: true }).click();
  await page.getByRole("button", { name: /^Namoz sozlamalari / }).click();
  await dialog(page).getByRole("button", { name: /^Bomdodga tayyorlanish / }).click();
  await expect(dialog(page)).toContainText("19.10.2026 uchun bomdod rejasi.");
  await expect(dialog(page).getByRole("combobox", { name: "Bomdoddan oldin uyg‘onish", exact: true })).toHaveValue("15");
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await dialog(page).locator(".fajr-preview-times strong").evaluateAll((times) => times.every((time) => {
      const range = document.createRange(); range.selectNodeContents(time);
      return range.getClientRects().length === 1;
    }))).toBe(true);
    expect(await dialog(page).locator(".sheet-header h2").evaluate((heading) => {
      const title = heading.getBoundingClientRect(), header = heading.closest(".sheet-header")!.getBoundingClientRect();
      return title.top >= header.top && title.bottom <= header.bottom;
    })).toBe(true);
  }
});
