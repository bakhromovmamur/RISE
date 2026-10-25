import { reloadSaved } from "./support/browser";
import { replaceStored } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { xpTotal, type State } from "../src/model";
import { prayerStreak, PRAYERS } from "../src/prayerModel";

const date = "2026-10-20", previous = "2026-10-19";
const dialog = (page: Page) => page.getByRole("dialog");
const checkpoint = (page: Page, time: string) => page.getByRole("combobox", { name: "Day checkpoint", exact: true }).selectOption(time);
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Main navigation" }).getByRole("tab", { name, exact: true }).click();
async function start(page: Page) {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption("difficult-day");
  await page.getByRole("button", { name: "Load selected fixture", exact: true }).click();
}
async function record(page: Page, name: string, time: string) {
  await checkpoint(page, time);
  await page.locator("#panel-today").getByRole("button", { name: new RegExp(`^${name}, Ready to record`) }).click();
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  await page.keyboard.press("Escape");
}

test("a difficult day preserves achievements, supports a smaller plan and starts tomorrow without a backlog", async ({ page }) => {
  await start(page);
  const initial = await stored(page);
  expect(xpTotal(initial)).toBe(280);
  expect(initial.days[date].every((row) => !row.check)).toBe(true);
  expect(PRAYERS.every(({ id }) => !initial.prayers.days[date].entries[id].check)).toBe(true);
  expect(initial.personalRewards.find((r) => r.id === "coffee")?.earnedOn).toBe(previous);
  await page.getByRole("button", { name: "1 pending record · No assumption made", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Missed", exact: true }).click();
  await expect(dialog(page)).toContainText("Keep going from here.");
  await expect(dialog(page)).toContainText("Your earlier prayers, habit XP and earned rewards stay.");
  expect(prayerStreak(await stored(page), "fajr").current).toBe(0);
  expect(prayerStreak(await stored(page), "dhuhr")).toEqual(prayerStreak(initial, "dhuhr"));
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your day, Mamur.", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Make today lighter", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Remove Practice English from priorities", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Remove Build my little project from priorities", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Save priorities", exact: true }).click();
  expect((await stored(page)).dailyPriorities[date]).toEqual([{ kind: "habit", habitId: "read" }]);
  expect((await stored(page)).days[date]).toEqual(initial.days[date]);
  await record(page, "Dhuhr", "12:20");

  await checkpoint(page, "15:45");
  await page.getByRole("button", { name: "Save & step away", exact: true }).click();
  const note = "Return to the button test. The rest can wait.";
  await dialog(page).getByRole("textbox", { name: "When I come back, I’ll…", exact: true }).fill(note);
  await dialog(page).getByRole("button", { name: "I need 60 seconds to save", exact: true }).click();
  await checkpoint(page, "18:00");
  await expect(dialog(page)).toContainText("Asr’s window ended at 17:45.");
  await expect(dialog(page).getByRole("textbox", { name: "When I come back, I’ll…", exact: true })).toHaveValue(note);
  await expect(dialog(page).getByRole("button", { name: "Save & step away", exact: true })).toHaveCount(0);
  await expect(dialog(page).getByText(/seconds to wrap up/)).toHaveCount(0);
  expect((await stored(page)).prayers.days[date].entries.asr.check).toBeUndefined();
  await dialog(page).getByRole("button", { name: "Record Asr", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Prayed later", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toContainText("Asr is recorded as prayed later.");
  await expect(dialog(page)).not.toContainText("You can record your prayer from Today");
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  await record(page, "Maghrib", "18:00");
  await record(page, "Isha", "19:05");

  await page.getByRole("button", { name: "Log 1 page +10 · Tiny Read a little", exact: true }).click();
  await expect(page.locator(".priority-complete")).toContainText("Your priorities are done");
  await page.locator(".today-disclosure > summary").filter({ hasText: "My routine" }).click();
  await expect(page.getByRole("button", { name: "View Practice English", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View Build my little project", exact: true })).toBeVisible();
  const recovered = await stored(page);
  expect(xpTotal(recovered)).toBe(290);
  expect(recovered.days[date].filter((o) => o.check)).toHaveLength(1);
  expect(recovered.goals).toEqual(initial.goals);
  expect(recovered.days[previous]).toEqual(initial.days[previous]);
  expect(recovered.prayers.days[previous]).toEqual(initial.prayers.days[previous]);
  expect(recovered.claimed).toEqual(initial.claimed);
  expect(recovered.equipped).toBe(250);

  await tab(page, "Progress");
  await expect(page.locator("#panel-progress")).toContainText("8 prayers on time");
  await expect(page.locator("#panel-progress")).toContainText("4 of 7 checked in");
  await page.getByRole("button", { name: /^Rewards in Journey / }).click();
  await page.getByRole("button", { name: /^A slow coffee at my favorite café / }).click();
  await expect(dialog(page)).toContainText("Earned");
  await dialog(page).getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  await page.keyboard.press("Escape");
  await checkpoint(page, "22:00");
  await tab(page, "Today");
  await page.getByRole("button", { name: /^Prepare for Fajr / }).click();
  await expect(dialog(page)).toContainText("Fajr plan for Wednesday, Oct 21.");
  await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  const bedtime = await stored(page);
  await reloadSaved(page);
  expect(await stored(page)).toEqual(bedtime);

  await page.getByRole("button", { name: "Advance one local day", exact: true }).click();
  await record(page, "Fajr", "05:35");
  const next = await stored(page), rows = next.days["2026-10-21"];
  expect(next.days[date]).toEqual(bedtime.days[date]);
  expect(rows).toHaveLength(4);
  expect(new Set(rows.map((o) => o.habitId)).size).toBe(rows.length);
  expect(rows.every((o) => !o.check)).toBe(true);
  expect(xpTotal(next)).toBe(290);
  expect(next.goals).toEqual(initial.goals);
  expect(next.claimed).toEqual(initial.claimed);
  expect(next.personalRewards.find((r) => r.id === "coffee")?.enjoyedOn).toBe(date);
  expect(prayerStreak(next, "fajr").current).toBe(1);
  expect(prayerStreak(next, "fajr").longest).toBe(prayerStreak(initial, "fajr").longest);
});

test("expired breaks keep drafts, allow an unlogged return and reflect later record corrections", async ({ page }) => {
  await start(page);
  await checkpoint(page, "15:45");
  await page.getByRole("button", { name: "Save & step away", exact: true }).click();
  await dialog(page).getByRole("textbox", { name: "When I come back, I’ll…", exact: true }).fill("An unfinished note survives the distraction.");
  await checkpoint(page, "18:00");
  await reloadSaved(page);
  await page.getByRole("button", { name: /^Asr · record or return/ }).click();
  await expect(dialog(page).getByRole("textbox", { name: "When I come back, I’ll…", exact: true })).toHaveValue("An unfinished note survives the distraction.");
  await dialog(page).getByRole("button", { name: "Back to Today", exact: true }).click();
  const unlogged = await stored(page);
  expect(unlogged.prayers.days[date].entries.asr.check).toBeUndefined();
  expect(unlogged.prayers.work?.stage).toBe("returned");
  expect(xpTotal(unlogged)).toBe(280);
  await page.getByRole("button", { name: /^Asr, Not recorded/ }).click();
  await dialog(page).getByRole("button", { name: "Missed", exact: true }).click();
  await expect(dialog(page)).toContainText("Keep going from here.");
  await dialog(page).getByRole("button", { name: "Undo this record", exact: true }).click();
  await expect(dialog(page)).not.toContainText("Keep going from here.");
  await dialog(page).getByRole("button", { name: "Prayed on time", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Your return note / }).click();
  await expect(dialog(page)).toContainText("Asr is recorded on time.");
  expect(xpTotal(await stored(page))).toBe(280);
});

test("a zero-check-in day keeps earned rewards and offers a readable tiny restart", async ({ page }) => {
  await start(page);
  const before = await stored(page);
  await checkpoint(page, "22:00");
  await expect(page.locator("#panel-today")).toContainText("You can leave the rest for today.");
  await page.getByRole("button", { name: "Advance one local day", exact: true }).click();
  await checkpoint(page, "08:00");
  await expect(page.getByRole("button", { name: "Log 1 page +10 · Tiny Read a little", exact: true })).toBeVisible();
  const after = await stored(page);
  expect(xpTotal(after)).toBe(280);
  expect(after.personalRewards).toEqual(before.personalRewards);
  expect(after.claimed).toEqual(before.claimed);
  expect(after.days[date]).toEqual(before.days[date]);
  after.life.language = "uz";
  await replaceStored(page, after);
  await page.goto("/?review=1&text=large");
  await expect(page.getByRole("button", { name: "Bugungi rejani yengillashtirish", exact: true })).toBeVisible();
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await page.locator("#panel-today").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
});
