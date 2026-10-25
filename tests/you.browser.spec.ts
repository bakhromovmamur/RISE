import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { xpTotal, type State } from "../src/model";

const dialog = (p: Page) => p.getByRole("dialog");
const disclosure = (p: Page, name: string) => dialog(p).locator(".settings-disclosure > summary").filter({ hasText: name });
async function scene(p: Page, name = "daily-life") {
  await p.goto("/?review=1");
  await p.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await p.getByRole("button", { name: "Load selected fixture" }).click();
  await stored(p); // Full navigation must follow the durable save acknowledgment.
  await p.goto("/");
  await p.getByRole("tab", { name: "You", exact: true }).click();
}

test("You keeps four destinations visible, opens the right group view and restores keyboard focus without changing records", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  const entries = page.locator(".you-destinations button");
  await expect(entries).toHaveCount(4);
  for (const viewport of [{ width: 375, height: 852 }, { width: 393, height: 852 }, { width: 430, height: 852 }, { width: 703, height: 753 }]) {
    await page.setViewportSize(viewport);
    const bottom = await entries.last().boundingBox(), nav = await page.getByRole("tablist").boundingBox();
    expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(nav!.y);
  }
  await expect(page.locator("#panel-you")).not.toContainText("lifetime XP");
  const family = page.getByRole("button", { name: "Family Tasks & shared lists", exact: true });
  await family.focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Family", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog(page).getByRole("button", { name: /Our family Tasks/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(family).toBeFocused();
  await page.getByRole("button", { name: /^Squads Weekly/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Squads", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog(page).getByRole("button", { name: /Small steps together A weekly/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Share my week", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".you-profile").click();
  await expect(dialog(page).getByRole("heading", { name: "Pip’s collection", exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test("prayer hub keeps setup drafts, Fajr, readiness and pause/resume reachable", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await expect(dialog(page)).toContainText("Timetables & alarms are previews");
  await dialog(page).getByRole("button", { name: /^Prayer times / }).click();
  await dialog(page).getByLabel("City", { exact: true }).selectOption("Samarkand");
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: /^Prayer reminders / }).click();
  await dialog(page).getByLabel("Preparation lead time").selectOption("15");
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: /^Prepare for Fajr / }).click();
  await dialog(page).getByLabel("Begin winding down at").fill("22:15");
  await dialog(page).getByRole("button", { name: "Check alarm readiness", exact: true }).click();
  await expect(dialog(page)).toContainText("Device simulation · no alarm is scheduled");
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByLabel("Begin winding down at")).toHaveValue("22:15");
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: /^Period mode / }).click();
  await dialog(page).getByLabel("Pause from").selectOption("asr");
  await dialog(page).getByRole("button", { name: "Pause prayer tracking", exact: true }).click();
  await expect(dialog(page)).toContainText("Tracking paused · manage or resume");
  await page.keyboard.press("Escape");
  await expect(page.locator("#panel-you")).toContainText("Tracking paused · private");
  await reloadSaved(page);
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /^Prayer times / }).click();
  await expect(dialog(page).getByLabel("City", { exact: true })).toHaveValue("Samarkand");
  await page.keyboard.press("Escape");
  await dialog(page).getByRole("button", { name: /^Period mode / }).click();
  await dialog(page).getByLabel("Resume from").selectOption("asr");
  await dialog(page).getByRole("button", { name: "Resume prayer tracking", exact: true }).click();
  await expect(dialog(page)).not.toContainText("Tracking paused · manage or resume");
  const after = await stored(page);
  expect(after.days).toEqual(before.days);
  expect(after.personalRewards).toEqual(before.personalRewards);
  expect(xpTotal(after)).toBe(xpTotal(before));
});

test("settings disclose appearance, habit reminders and data while saving preferences and supporting export", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Dark", exact: true })).toBeHidden();
  await expect(dialog(page).getByRole("switch", { name: "Save reminder preference", exact: true })).toBeHidden();
  await expect(dialog(page).getByRole("button", { name: /^Clear local data/ })).toBeHidden();
  await dialog(page).getByLabel("Your name", { exact: true }).fill("Mamur with a very long surname");
  await disclosure(page, "Appearance & comfort").focus();
  await page.keyboard.press("Enter");
  await dialog(page).getByRole("button", { name: "Dark", exact: true }).click();
  await dialog(page).getByRole("switch", { name: "Reduce motion", exact: true }).click();
  await disclosure(page, "Habit reminders").click();
  await dialog(page).getByLabel("Quiet hours start", { exact: true }).fill("21:30");
  await dialog(page).getByRole("button", { name: /^Preview a reminder/ }).click();
  await expect(dialog(page)).toContainText("No device notification has been scheduled");
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByLabel("Quiet hours start", { exact: true })).toHaveValue("21:30");
  await disclosure(page, "Your data").click();
  const download = page.waitForEvent("download");
  await dialog(page).getByRole("button", { name: /^Export local data/ }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString()), exported: State = backup.data.personal;
  expect(backup.format).toBe("rise.private-backup");
  expect(exported.personalRewards).toEqual(before.personalRewards);
  expect(exported.life.groups).toEqual([]);
  expect(backup.data.localArchives[0].groups).toEqual(before.life.groups);
  await reloadSaved(page);
  const after = await stored(page);
  expect(after.prefs).toMatchObject({ appearance: "dark", reduceMotion: true, quietStart: "21:30" });
  expect(after.name).toBe("Mamur with a very long surname");
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await dialog(page).getByRole("button", { name: /^Your habits / }).click();
  await expect(dialog(page).getByRole("heading", { name: "Manage habits", exact: true })).toBeVisible();
});

test("empty setup, Uzbek navigation and enlarged text keep destinations available without invented activity", async ({ page }) => {
  await scene(page, "empty");
  await page.getByRole("button", { name: /^Squads Weekly/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Create a private squad", exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Squads", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Family Tasks/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Create a family space", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await dialog(page).getByRole("button", { name: /^Prayer times Choose/ }).click();
  await expect(dialog(page).getByLabel("City", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await dialog(page).getByLabel("Your name", { exact: true }).fill("A very long name for this space");
  await dialog(page).getByRole("button", { name: "Language English", exact: true }).click();
  await dialog(page).getByRole("button", { name: /O‘zbekcha/ }).click();
  await stored(page);
  await page.goto("/?text=large");
  await page.getByRole("tab", { name: "Siz", exact: true }).click();
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await page.locator("#panel-you").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole("button", { name: /^Oila Vazifalar/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Guruhlar Haftalik/ })).toBeVisible();
  }
  await page.getByRole("button", { name: /^Sozlamalar Ko‘rinish/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Til O‘zbekcha", exact: true })).toBeVisible();
  await disclosure(page, "Ko‘rinish va qulaylik").click();
  await expect(dialog(page).getByRole("button", { name: "Tungi", exact: true })).toBeVisible();
  expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const after = await stored(page);
  expect(after.life.groups).toEqual([]);
  expect(after.personalRewards).toEqual([]);
  expect(xpTotal(after)).toBe(0);
});
