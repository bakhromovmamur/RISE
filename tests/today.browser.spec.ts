import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { type State, xpTotal } from "../src/model";

async function scene(page: Page, name = "daily-life") {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await page.getByRole("button", { name: "Load selected fixture" }).click();
}

test("disclosures use keyboard, expose routine and family actions, and preserve completion across reload", async ({ page }) => {
  await scene(page);
  const original = await stored(page);
  const routine = page.locator(".today-disclosure > summary").filter({ hasText: "My routine" });
  await routine.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#panel-today .routine-list")).toBeVisible();
  await page.locator("#panel-today .routine-list").getByRole("button", { name: /Log tiny Practice English/ }).click();
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await expect(page.locator(".today-disclosure > summary").filter({ hasText: "My routine" })).toContainText("1 done");
  await page.locator(".family-today > summary").click();
  await page.getByRole("checkbox", { name: "Complete Choose our weekend outing", exact: true }).click();
  const after = await stored(page);
  expect(xpTotal(after)).toBe(xpTotal(original) + 10);
  expect(after.dailyPriorities).toEqual(original.dailyPriorities);
  await reloadSaved(page);
  expect((await stored(page)).life.tasks).toEqual(after.life.tasks);
  expect((await stored(page)).days).toEqual(after.days);
  await page.locator(".today-disclosure > summary").filter({ hasText: "Your goals" }).click();
  await expect(page.getByRole("button", { name: /^Finish my current book 2\/5/ })).toBeVisible();
  await page.getByRole("button", { name: "All goals in Progress", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Goals", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("completed priorities stay compact; full, tiny, upgrade and Undo remain reachable", async ({ page }) => {
  await scene(page);
  const priorities = (await stored(page)).dailyPriorities["2026-10-19"];
  await page.getByRole("button", { name: "Log full Build my little project: 20 minutes", exact: true }).click();
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await expect(page.locator(".priority-complete")).toBeVisible();
  await expect(page.locator("#panel-today .priority-list .habit-card")).toHaveCount(0);
  await expect(page.locator("#panel-today .priority-list .today-habit")).toHaveCount(3);
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toEqual(priorities);
  await page.getByRole("button", { name: "View Read a little", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Finish my current book/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Upgrade to full target/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Undo check-in", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Log 10 pages/ })).toBeVisible();
  expect((await stored(page)).dailyPriorities["2026-10-19"]).toEqual(priorities);
});

test("busy routines stay disclosed and large text has no horizontal overflow", async ({ page }) => {
  await scene(page, "busy");
  await expect(page.locator("#panel-today .priority-list > article")).toHaveCount(3);
  await expect(page.locator("#panel-today .routine-list")).toBeHidden();
  await page.goto("/?text=large");
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await expect(page.getByRole("heading", { name: "Your day, Mamur." })).toBeVisible();
    expect(await page.locator(".app-shell").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.locator(".today-disclosure > summary").filter({ hasText: "My routine" }).click();
  await expect(page.locator("#panel-today .routine-list .habit-card")).toHaveCount(9);
});

test("a milestone ahead of a habit keeps its title readable and the habit actionable", async ({ page }) => {
  await scene(page);
  await page.getByRole("button", { name: "Edit priorities", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove Build my little project from priorities", exact: true }).click();
  await dialog.getByRole("checkbox", { name: /Build the first working screen/ }).check();
  for (let i = 0; i < 2; i++) await dialog.getByRole("button", { name: "Move Build the first working screen up", exact: true }).click();
  await dialog.getByRole("button", { name: "Save priorities", exact: true }).click();
  const milestone = page.locator("#panel-today .priority-list > article").first();
  await expect(milestone).toContainText("Build the first working screen");
  const summary = await milestone.locator(".milestone-summary").boundingBox();
  const control = await milestone.getByRole("button", { name: "Complete milestone", exact: true }).boundingBox();
  expect(summary!.width).toBeGreaterThan(control!.width * 2);
  await expect(page.getByRole("button", { name: /Log 10 pages/ })).toBeVisible();
  const before = await stored(page);
  await milestone.getByRole("button", { name: "Complete milestone", exact: true }).click();
  await expect(milestone).toContainText("Completed");
  expect(xpTotal(await stored(page))).toBe(xpTotal(before));
  expect((await stored(page)).dailyPriorities).toEqual(before.dailyPriorities);
});
