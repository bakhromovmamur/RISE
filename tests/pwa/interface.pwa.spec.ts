import { test, expect, stored } from "../support/browser";
import { createEmptyState } from "../../src/data/initialState";
import { ensurePriorities } from "../../src/developmentModel";
import { pwaText } from "../../src/pwa/messages";

for (const language of ["en", "ru", "uz"] as const) test(`${language} install and offline controls reflow in both themes and large text`, async ({ page, context }, info) => {
  await page.request.post("/__pwa_test__/version", { data: { version: "A" } });
  const state = createEmptyState(); state.onboarded = true; state.life.language = language;
  state.name = "Authored name · Шахсий";
  await page.addInitScript(state => { if (location.origin === "http://127.0.0.1:4181" && !localStorage.getItem("rise.local.v1")) localStorage.setItem("rise.local.v1", JSON.stringify(state)); }, state);
  await page.goto("/");
  await expect.poll(async () => (await stored(page)).life.deviceTimezone?.observed).toBe("Asia/Tashkent");
  // Observe the expected durable startup command before freezing the full state.
  await expect.poll(async () => (await stored(page)).dailyPriorities).toEqual(ensurePriorities(state).dailyPriorities);
  const original = await stored(page), text = pwaText(language);
  await page.locator("#tab-you").click();
  await page.locator("#panel-you .you-destinations .group-row").last().click();
  await page.locator("summary").filter({ hasText: text.title }).click();
  await expect(page.locator('[data-offline-ready="true"]')).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 375, 393, 430, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 852 });
      await page.locator("html").evaluate(element => { element.style.fontSize = "200%"; });
      await expect(page.locator(".pwa-settings")).toBeVisible();
      expect(await page.locator(".pwa-settings").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.getByRole("button", { name: text.check, exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: text.check, exact: true })).toBeInViewport();
      if (width === 393 || width === 1440) await page.screenshot({ path: info.outputPath(`${language}-${theme}-${width}-settings-200.png`) });
    }
  }
  await page.request.post("/__pwa_test__/version", { data: { version: "B" } });
  await page.getByRole("button", { name: text.check, exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: text.update, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 852 });
  await expect(page.locator(".pwa-notice")).toContainText(text.waiting);
  expect(await page.locator(".pwa-notice").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await context.setOffline(true);
  await expect(page.locator(".pwa-notice")).toContainText(text.offline);
  expect(await page.locator(".pwa-notice").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${language}-dark-offline-200.png`) });
  expect(await stored(page)).toEqual(original);
  await page.locator("#panel-you .you-destinations .group-row").last().click();
  await page.locator("summary").filter({ hasText: text.title }).click();
  await page.getByRole("button", { name: text.check, exact: true }).click();
  await expect(page.locator(".pwa-settings").getByRole("alert")).toHaveText(text.reconnect);
  await page.locator(".pwa-settings").getByRole("alert").scrollIntoViewIfNeeded();
  expect(await page.locator(".pwa-settings").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${language}-offline-check-error-200.png`) });
});
