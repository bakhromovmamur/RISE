import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { makeFixture } from "../src/review/fixtures";
import { test, expect, type Page } from "./support/browser";
import { xpTotal, type State } from "../src/model";

async function scene(page: Page, name = "daily-life") {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption(name);
  await page.getByRole("button", { name: "Load selected fixture" }).click();
  await stored(page); // Full navigation must follow the durable save acknowledgment.
  await page.goto("/");
  await page.getByRole("tab", { name: "Journey", exact: true }).click();
}
const summary = (page: Page, name: string) => page.locator("#panel-journey .journey-disclosure > summary").filter({ hasText: name });
async function closeSheet(page: Page) {
  await page.keyboard.press("Escape");
  if (await page.getByRole("button", { name: "Dismiss message" }).count()) await page.getByRole("button", { name: "Dismiss message" }).click();
}

test("Journey shows one unlock and one personal reward, while keyboard disclosures preserve records", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await expect(page.locator(".pip-unlock")).toContainText("Linen scarf for Pip");
  await expect(page.locator(".pip-unlock")).toContainText("10 XP to go");
  await expect(page.locator(".pip-unlock")).toContainText("240 / 250 lifetime habit XP");
  await expect(page.locator(".personal-spotlight")).toContainText("1/5 check-ins · Oct 19–Oct 25");
  await expect(page.locator("#panel-journey .trail")).toBeHidden();
  await expect(page.locator("#panel-journey .reward-row").first()).toBeHidden();
  for (const viewport of [{ width: 375, height: 852 }, { width: 393, height: 852 }, { width: 430, height: 852 }, { width: 703, height: 753 }]) {
    await page.setViewportSize(viewport);
    const reward = await page.locator(".personal-spotlight").boundingBox();
    const nav = await page.getByRole("tablist", { name: "Main navigation" }).boundingBox();
    expect(reward!.y + reward!.height).toBeLessThanOrEqual(nav!.y);
  }
  await summary(page, "Explore Pip’s trail").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#panel-journey .trail")).toBeVisible();
  await expect(page.locator("#panel-journey .trail-node")).toHaveCount(5);
  await page.keyboard.press("Enter");
  await summary(page, "All rewards & history").click();
  await expect(page.locator("#panel-journey .reward-row")).toHaveCount(2);
  const after = await stored(page);
  expect(after.claimed).toEqual(before.claimed);
  expect(after.personalRewards).toEqual(before.personalRewards);
  expect(xpTotal(after)).toBe(xpTotal(before));
});

test("earned Pip unlock precedes the next threshold; claiming and dressing persist without XP", async ({ page }) => {
  await scene(page, "earned-reward");
  const before = await stored(page);
  await expect(page.locator(".pip-unlock")).toContainText("Linen scarf for Pip");
  await expect(page.locator(".pip-unlock")).toContainText("Ready to claim");
  await page.getByRole("button", { name: "Open your unlock", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Claim & dress Pip", exact: true }).click();
  await closeSheet(page);
  await expect(page.locator(".pip-unlock")).toContainText("A trail-side seedling");
  expect(xpTotal(await stored(page))).toBe(xpTotal(before));
  expect((await stored(page)).claimed).toContain(250);
  expect((await stored(page)).equipped).toBe(250);
  await reloadSaved(page);
  await page.getByRole("tab", { name: "Journey", exact: true }).click();
  await expect(page.locator(".pip-unlock").getByRole("img", { name: /linen scarf-wearing/ })).toBeVisible();
  await page.getByRole("button", { name: /Pip’s collection Dress Pip/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Just Pip/ }).click();
  expect((await stored(page)).equipped).toBeNull();
  expect(xpTotal(await stored(page))).toBe(xpTotal(before));
});

test("earned personal reward stays first, enjoyment moves it to history, and selection names its goal", async ({ page }) => {
  await scene(page, "earned-reward");
  const before = await stored(page);
  await expect(page.locator(".personal-spotlight")).toContainText("Earned · ready to enjoy");
  await page.locator(".personal-spotlight").click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark as enjoyed", exact: true }).click();
  await closeSheet(page);
  await expect(page.locator(".personal-spotlight")).toContainText("Choose my next book");
  await expect(page.locator(".personal-spotlight")).toContainText("Complete “Finish my current book”");
  await summary(page, "All rewards & history").click();
  await page.locator("#panel-journey .done-group > summary").click();
  await expect(page.locator("#panel-journey .done-group")).toContainText("Enjoyed · Oct 19");
  await page.locator(".personal-spotlight").click();
  await page.getByRole("dialog").getByRole("button", { name: "Feature on Today & Journey", exact: true }).click();
  const id = (await stored(page)).personalRewards.find((r) => r.name === "Choose my next book")!.id;
  expect((await stored(page)).selectedRewardId).toBe(id);
  expect(xpTotal(await stored(page))).toBe(xpTotal(before));
  await closeSheet(page);
  await reloadSaved(page);
  await page.getByRole("tab", { name: "Journey", exact: true }).click();
  await expect(page.locator(".personal-spotlight")).toContainText("Choose my next book");
});

test("empty setup has real creation, and enlarged-text trail uses readable rows", async ({ page }) => {
  await scene(page, "empty");
  await expect(page.locator(".pip-unlock")).toContainText("0 / 100 lifetime habit XP");
  await page.getByRole("button", { name: "Choose a personal reward", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Reward name", { exact: true })).toBeVisible();
  await closeSheet(page);
  await scene(page);
  await page.getByRole("button", { name: "Add personal reward", exact: true }).click();
  const longName = "An afternoon walking together, choosing a new book and sharing a relaxed family picnic by the river";
  await page.getByRole("dialog").getByLabel("Reward name", { exact: true }).fill(longName);
  await page.getByRole("dialog").getByRole("button", { name: "Save reward", exact: true }).click();
  await summary(page, "All rewards & history").click();
  await page.locator("#panel-journey .reward-row").filter({ hasText: longName }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Feature on Today & Journey", exact: true }).click();
  await closeSheet(page);
  await stored(page);
  await page.goto("/?text=large");
  await page.getByRole("tab", { name: "Journey", exact: true }).click();
  await expect(page.locator(".personal-spotlight")).toContainText(longName);
  await summary(page, "Explore Pip’s trail").click();
  for (const width of [375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await page.locator(".app-shell").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const stops = await page.locator("#panel-journey .trail-stop").evaluateAll((els) => els.map((el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
    // Firefox DOMRect arithmetic differs by ~0.00005 CSS px at a shared edge.
    // Allow only that numerical noise; any visible overlap must still fail.
    for (let i = 1; i < stops.length; i++) expect(stops[i].top - stops[i - 1].bottom).toBeGreaterThanOrEqual(-0.001);
  }
});

test("a completed collection has no invented next threshold and all keepsakes remain accessible", async ({ page }) => {
  const complete = makeFixture();
  const base = complete.days["2026-10-19"][0];
  complete.days["2026-10-19"] = Array.from({ length: 65 }, (_, i) => ({ ...base, habitId: `earned-${i}`, check: "full" as const }));
  complete.habits.push(...complete.days["2026-10-19"].map(o => ({ ...complete.habits[0], id: o.habitId, archivedAt: "2026-10-20" })));
  complete.claimed = [100, 250, 500, 800, 1200];
  complete.equipped = 250;
  await page.addInitScript((value) => localStorage.setItem("rise.local.v1", JSON.stringify(value)), complete);
  await page.goto("/");
  await page.getByRole("tab", { name: "Journey", exact: true }).click();
  await expect(page.locator(".pip-unlock")).toContainText("Pip’s collection is complete");
  await expect(page.locator(".pip-unlock")).not.toContainText("XP to go");
  await page.getByRole("button", { name: "Open Pip’s collection", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Your keepsakes", exact: true })).toBeVisible();
});
