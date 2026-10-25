import { readFile } from "node:fs/promises";
import { test, expect, stored, type Page } from "./support/browser";
import { balancedFixture, localizeFixture } from "../src/demo";
import { addLifeDemo } from "../src/lifeModel";
import { createTranslator, type Language } from "../src/i18n";

async function seed(page: Page, language: Language, reduceMotion = true) {
  const state = localizeFixture(addLifeDemo(balancedFixture(), "daily-life"), language);
  state.prefs.reduceMotion = reduceMotion;
  const original = JSON.stringify(state);
  await page.addInitScript(value => {
    if (!localStorage.getItem("rise.local.v1")) localStorage.setItem("rise.local.v1", value);
  }, original);
  await page.goto("/");
  await stored(page);
  return original;
}
async function settings(page: Page) {
  await page.locator("#tab-you").click();
  await page.locator(".you-destinations button").nth(3).click();
}

for (const language of ["en", "ru", "uz"] as const) {
  const t = createTranslator(language);
  test(`${language}: collapsed settings sections stay out of the keyboard order`, async ({ page }) => {
    await seed(page, language);
    await settings(page);
    const dialog = page.getByRole("dialog");
    const order = [
      dialog.getByRole("button", { name: t("Close"), exact: true }),
      dialog.getByLabel(t("Your name"), { exact: true }),
      dialog.getByRole("button", { name: new RegExp("^" + t("Language")) }),
      dialog.getByRole("button", { name: new RegExp("^" + t("Your habits")) }),
      ...await dialog.locator(":scope > .sheet-content > .settings-content > .settings-disclosure > summary").all(),
    ];
    expect(order).toHaveLength(8); // Includes the collapsed Help & policies disclosure.
    for (const control of [...order, order[0]]) {
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
      expect(await control.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
    await page.keyboard.press("Shift+Tab");
    await expect(order.at(-1)!).toBeFocused();
  });

  test(`${language}: priority edit has a usable tap area and restores keyboard focus`, async ({ page }) => {
    await seed(page, language);
    const edit = page.getByRole("button", { name: t("Edit priorities"), exact: true });
    const box = (await edit.boundingBox())!;
    expect.soft(box.width).toBeGreaterThanOrEqual(44);
    expect.soft(box.height).toBeGreaterThanOrEqual(44);
    await edit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(i < 8 ? "Tab" : "Shift+Tab");
      expect(await page.getByRole("dialog").evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(edit).toBeFocused();
    expect(await edit.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    // This point is inside the added English hit area, away from fractional edges.
    await edit.click({ position: { x: 8, y: box.height / 2 } });
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test(`${language}: enlarged habit form preserves usable days, drafts and nested focus`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 852 });
    await seed(page, language);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await settings(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: new RegExp("^" + t("Your habits")) }).click();
    await dialog.getByRole("button", { name: t("Add a habit"), exact: true }).click();
    for (const select of await dialog.locator(".form-grid select").all()) {
      expect(await select.evaluate(el => {
        const select = el as HTMLSelectElement, style = getComputedStyle(select);
        const canvas = document.createElement("canvas"), context = canvas.getContext("2d")!;
        context.font = style.font;
        return context.measureText(select.selectedOptions[0].label).width +
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 16 <= select.clientWidth;
      })).toBe(true);
    }
    await expect(dialog.getByRole("button", { name: t("Close"), exact: true })).toBeInViewport({ ratio: 1 });
    const days = dialog.locator(".weekday-selector > button");
    await days.first().scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: info.outputPath(`habit-days-${language}.png`), animations: "disabled" });
    for (const day of await days.all()) {
      const box = (await day.boundingBox())!;
      // Firefox can return 43.999969 for a rendered 44 CSS-pixel track.
      expect.soft(box.width).toBeGreaterThanOrEqual(43.99);
      expect.soft(box.height).toBeGreaterThanOrEqual(43.99);
    }
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await days.first().focus();
    await page.keyboard.press("Space");
    await expect(days.first()).toHaveAttribute("aria-pressed", "false");
    expect((await stored(page)).draft?.days).not.toContain(1);
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("button", { name: t("Add a habit"), exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: t("Add a habit"), exact: true }).click();
    await expect(dialog.locator(".weekday-selector > button").first()).toHaveAttribute("aria-pressed", "false");
    // A reduced layout viewport exercises reflow, not a physical keyboard claim.
    await page.setViewportSize({ width: 320, height: 420 });
    const name = dialog.getByLabel(t("Habit name"), { exact: true });
    await name.fill("Synthetic keyboard draft");
    await expect(name).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: t("Close"), exact: true })).toBeInViewport({ ratio: 1 });
    expect((await stored(page)).draft?.name).toBe("Synthetic keyboard draft");
    await page.setViewportSize({ width: 320, height: 852 });
    await expect(name).toHaveValue("Synthetic keyboard draft");
  });

  test(`${language}: disclosed recovery download is usable and preserves the exact original`, async ({ page }, info) => {
    const original = await seed(page, language);
    await settings(page);
    const dialog = page.getByRole("dialog");
    const data = dialog.locator(".settings-content > .settings-disclosure").filter({ has: page.getByText(t("Your data"), { exact: true }) });
    await data.locator(":scope > summary").click();
    await data.locator(".settings-disclosure > summary").click();
    const download = dialog.getByRole("button", { name: t("Download recovery copy"), exact: true });
    await download.scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: info.outputPath(`recovery-download-${language}.png`), animations: "disabled" });
    const box = (await download.boundingBox())!;
    expect.soft(box.width).toBeGreaterThanOrEqual(44);
    expect.soft(box.height).toBeGreaterThanOrEqual(44);
    const before = await stored(page), pending = page.waitForEvent("download");
    await download.focus();
    await page.keyboard.press("Enter");
    const result = await pending, path = info.outputPath("synthetic-recovery.json");
    await result.saveAs(path);
    expect(await readFile(path, "utf8")).toBe(original);
    expect(await stored(page)).toEqual(before);
  });
}

test("system and saved reduced-motion choices preserve working sheet navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, "en", false);
  await settings(page);
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await settings(page);
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).not.toBe("none");
  await dialog.locator(".settings-disclosure > summary").first().click();
  const toggle = dialog.getByRole("switch", { name: "Reduce motion", exact: true });
  await toggle.scrollIntoViewIfNeeded();
  const bounds = (await toggle.boundingBox())!;
  // The existing pseudo-element extends the switch's actual hit area to 44 px.
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y - 6);
  expect((await stored(page)).prefs.reduceMotion).toBe(true);
  await page.keyboard.press("Escape");
  await settings(page);
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".you-destinations button").nth(3)).toBeFocused();
});
