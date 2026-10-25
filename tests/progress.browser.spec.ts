import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import type { State } from "../src/model";

async function scene(page: Page, name = "daily-life") {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await page.getByRole("button", { name: "Load selected fixture" }).click();
  await stored(page); // Full navigation must follow the durable save acknowledgment.
  await page.goto("/");
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
}
const summary = (page: Page, name: string) => page.locator(".progress-disclosure > summary").filter({ has: page.getByText(name, { exact: true }) });

test("three summaries and a Journey link fit the overview; disclosures do not change records", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await expect(page.locator(".progress-disclosure")).toHaveCount(3);
  await expect(page.locator(".progress-disclosure[open]")).toHaveCount(0);
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    const reward = await page.locator(".progress-rewards-link").boundingBox();
    const nav = await page.getByRole("tablist", { name: "Main navigation" }).boundingBox();
    expect(reward!.y + reward!.height).toBeLessThan(nav!.y);
  }
  await page.setViewportSize({ width: 703, height: 753 });
  const reward = await page.locator(".progress-rewards-link").boundingBox();
  const nav = await page.getByRole("tablist", { name: "Main navigation" }).boundingBox();
  expect(reward!.y + reward!.height).toBeLessThanOrEqual(nav!.y);
  await summary(page, "Habits").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".progress-breakdown").filter({ hasText: "Full check-ins" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".progress-breakdown").filter({ hasText: "Full check-ins" })).toBeHidden();
  expect((await stored(page)).days).toEqual(before.days);
  expect((await stored(page)).prayers).toEqual(before.prayers);
  expect((await stored(page)).goals).toEqual(before.goals);
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Salah", exact: true })).toBeFocused();
  await expect(page.locator(".prayer-calendar")).toBeVisible();
});

test("weekly breakdowns, goal movement and current rewards keep their own time periods", async ({ page }) => {
  await scene(page);
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expect(summary(page, "Habits")).toContainText("14 of 16");
  await summary(page, "Goals").click();
  await expect(page.locator(".progress-disclosure[open] .goal-row").first()).toContainText("milestones overall");
  await expect(page.locator(".progress-disclosure[open] .goal-row").first()).toContainText("selected week");
  await page.getByRole("button", { name: "All goals", exact: true }).click();
  await expect(page.locator(".shared-week")).toContainText("Oct 12–Oct 18");
  await expect(page.locator("#progress-goals")).toContainText("completed in the selected week");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator("#progress-overview .reward-cue")).toHaveCount(0);
  await expect(page.locator(".progress-rewards-link")).toContainText("Available now");
  await page.locator(".progress-rewards-link").click();
  await expect(page.getByRole("heading", { name: "Your journey", exact: true })).toBeFocused();
  await expect(page.locator(".personal-spotlight")).toContainText("Oct 19–Oct 25");
  await page.locator(".personal-spotlight").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "A slow coffee at my favorite café" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await expect(page.locator(".shared-week")).toContainText("Oct 12–Oct 18");
  await page.getByRole("tab", { name: "Habits", exact: true }).click();
  await page.locator(".progress-detail-disclosure > summary").filter({ hasText: "Individual habits" }).click();
  await expect(page.locator(".progress-detail-disclosure[open]")).toContainText("Read a little");
  await page.locator(".progress-detail-disclosure > summary").filter({ hasText: "Streaks & lifetime XP" }).click();
  await expect(page.locator("#progress-habits")).toContainText("240 lifetime habit XP");
  await page.getByRole("tab", { name: "Salah", exact: true }).click();
  await page.locator(".progress-detail-disclosure > summary").click();
  await expect(page.locator(".prayer-all-five")).toBeVisible();
});

test("pause, earned reward and empty setup remain understandable and actionable", async ({ page }) => {
  await scene(page, "prayer-pause");
  await expect(summary(page, "Salah")).toContainText("Tracking paused now");
  await summary(page, "Salah").click();
  await expect(page.locator(".progress-disclosure[open]")).toContainText("hold your streak without adding");
  await scene(page, "earned-reward");
  await expect(page.locator(".progress-rewards-link")).toContainText("1 personal reward earned");
  await page.locator(".progress-rewards-link").click();
  await page.locator(".personal-spotlight").click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Mark as enjoyed", exact: true })).toBeVisible();
  await scene(page, "empty");
  await expect(summary(page, "Salah")).toContainText("Set up your prayer times");
  for (const [area, action] of [
    ["Salah", "Set up prayer times"],
    ["Habits", "Add a habit"],
    ["Goals", "Create a goal"],
  ]) {
    await summary(page, area).click();
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Each setup opens a real form, not a progress placeholder.
    if (area === "Salah") await expect(page.getByRole("dialog").getByRole("combobox").first()).toBeVisible();
    else await expect(page.getByRole("dialog").getByRole("textbox").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await summary(page, area).click();
  }
  expect((await stored(page)).goals).toEqual([]);
});

test("enlarged text reflows overview and opened details without horizontal overflow", async ({ page }) => {
  await scene(page, "busy");
  await page.goto("/?text=large");
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await summary(page, "Goals").click();
    expect(await page.locator(".app-shell").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await summary(page, "Goals").click();
  }
  await page.getByRole("tab", { name: "Habits", exact: true }).click();
  await page.locator(".progress-detail-disclosure > summary").filter({ hasText: "Individual habits" }).click();
  expect(await page.locator(".app-shell").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
