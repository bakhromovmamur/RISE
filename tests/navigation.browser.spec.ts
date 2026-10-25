import { reloadSaved } from "./support/browser";
import { replaceStored } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import type { State } from "../src/model";

async function scene(page: Page) {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption("daily-life");
  await page.getByRole("button", { name: "Load selected fixture" }).click();
  await stored(page); // Full navigation must follow the durable save acknowledgment.
  await page.goto("/");
}
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Main navigation" }).getByRole("tab", { name, exact: true });

test("four tabs use one heading hierarchy, keyboard navigation and independent reading positions", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  for (const name of ["Today", "Journey", "Progress", "You"]) {
    await tab(page, name).click();
    const panel = page.getByRole("tabpanel", { name, exact: true });
    await expect(panel).toBeVisible();
    expect(await panel.locator(".tab-heading h1").evaluate((el) => getComputedStyle(el).fontSize)).toBe("28px");
    await expect(page.getByRole("tablist", { name: "Main navigation" }).locator('[aria-selected="true"]')).toHaveCount(1);
  }
  await tab(page, "You").focus();
  await page.keyboard.press("Home");
  await expect(tab(page, "Today")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Journey")).toBeFocused();
  await page.keyboard.press("End");
  await expect(tab(page, "You")).toBeFocused();
  await page.keyboard.press("Home");
  const routine = page.locator(".today-disclosure > summary").filter({ hasText: "My routine" });
  await routine.click();
  const panel = page.locator("#panel-today");
  await panel.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
  const position = await panel.evaluate((el) => el.scrollTop);
  expect(position).toBeGreaterThan(100);
  await tab(page, "You").click();
  await tab(page, "Today").click();
  expect(await panel.evaluate((el) => el.scrollTop)).toBe(position);
  await expect(routine.locator("..")).toHaveAttribute("open", "");
  expect(await stored(page)).toEqual(before);
});

test("cross-tab shortcuts reset scroll, announce the destination and retain the inspected week", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await tab(page, "Journey").click();
  await page.locator(".journey-disclosure > summary").filter({ hasText: "Explore Pip’s trail" }).click();
  await page.locator("#panel-journey").evaluate((el) => el.scrollTo({ top: 550, behavior: "instant" }));
  await tab(page, "Progress").click();
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await page.locator(".progress-rewards-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your journey", exact: true })).toBeFocused();
  expect(await page.locator("#panel-journey").evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator(".journey-disclosure").filter({ hasText: "Explore Pip’s trail" })).toHaveAttribute("open", "");
  await tab(page, "Progress").click();
  await expect(page.locator(".shared-week")).toContainText("Oct 12–Oct 18");
  await page.getByRole("tab", { name: "Goals", exact: true }).click();
  await page.locator("#panel-progress").evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
  await tab(page, "Today").click();
  await page.locator(".today-disclosure > summary").filter({ hasText: "Your goals" }).click();
  await page.getByRole("button", { name: "All goals in Progress", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your progress", exact: true })).toBeFocused();
  expect(await page.locator("#panel-progress").evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator(".shared-week")).toContainText("Oct 12–Oct 18");
  await expect(page.getByRole("tab", { name: "Goals", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await stored(page)).toEqual(before);
});

test("Today has one timetable entry and reward details hand off cleanly to Journey", async ({ page }) => {
  await scene(page);
  const before = await stored(page);
  await expect(page.getByRole("button", { name: "Times", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Prayer times: Tashkent · local demo", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "City", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^A slow coffee at my favorite café/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "All rewards in Journey", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your journey", exact: true })).toBeFocused();
  expect(await page.locator("#panel-journey").evaluate((el) => el.scrollTop)).toBe(0);
  const after = await stored(page);
  expect(after.days).toEqual(before.days);
  expect(after.prayers).toEqual(before.prayers);
  expect(after.personalRewards).toEqual(before.personalRewards);
  expect(after.goals).toEqual(before.goals);
  for (const language of ["en", "uz"] as const) {
    const t = (en: string, uz: string) => language === "en" ? en : uz;
    for (const mode of ["local", "calculated", "unconfigured"] as const) {
      const state = structuredClone(before);
      state.life.language = language;
      state.life.setup.configured = mode !== "unconfigured";
      state.life.setup.source = mode === "calculated" ? "calculated" : "local";
      await replaceStored(page, state);
      await reloadSaved(page);
      const label = mode === "unconfigured"
        ? t("Prayer setup", "Namoz sozlamalari")
        : `${t("Tashkent", "Toshkent")} · ${mode === "local" ? t("local demo", "jadval namunasi") : t("calculated demo", "hisob namunasi")}`;
      const name = mode === "unconfigured" ? label : `${t("Prayer times", "Namoz vaqtlari")}: ${label}`;
      const entry = page.getByRole("button", { name, exact: true });
      await expect(entry).toHaveText(label);
      await entry.click();
      await expect(page.getByRole("dialog").getByRole("combobox", { name: t("City", "Shahar"), exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("enlarged English and Uzbek navigation has separate readable targets above the content boundary", async ({ page }) => {
  await scene(page);
  for (const language of ["en", "uz"] as const) {
    const state = await stored(page);
    state.life.language = language;
    await replaceStored(page, state);
    await page.goto("/?text=large");
    const nav = page.getByRole("tablist", { name: language === "en" ? "Main navigation" : "Asosiy navigatsiya" });
    for (const width of [375, 393, 430]) {
      await page.setViewportSize({ width, height: 852 });
      const bounds = await nav.boundingBox();
      for (const item of await nav.getByRole("tab").all()) {
        const box = await item.boundingBox();
        const label = await item.locator("span").last().boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(label!.x).toBeGreaterThanOrEqual(box!.x);
        expect(label!.x + label!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
      }
      const content = await page.locator(".tab-panels").boundingBox();
      expect(content!.y + content!.height).toBeLessThanOrEqual(bounds!.y);
    }
    await nav.getByRole("tab").last().focus();
    await page.keyboard.press("Home");
    await expect(nav.getByRole("tab").first()).toBeFocused();
    await expect(nav.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  }
});
