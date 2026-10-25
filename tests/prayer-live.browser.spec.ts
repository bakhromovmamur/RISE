import { reloadSaved } from "./support/browser";
import { stored, replaceStored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import type { State } from "../src/model";
import { createTranslator } from "../src/i18n";
import { timeInZone } from "../src/prayerCalculation";
const ru = createTranslator("ru");

const dialog = (p: Page) => p.getByRole("dialog").last();
async function setup(page: Page) {
  await page.goto("/?review=1");
  await page.getByRole("combobox", { name: "Demo fixture" }).selectOption("daily-life");
  await page.getByRole("button", { name: "Load selected fixture" }).click();
  await stored(page); // Full navigation must follow the durable save acknowledgment.
  await page.goto("/");
  await page.getByRole("button", { name: "Prayer times: Tashkent · local demo", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Set up real prayer times", exact: true }).click();
}
async function notifications(page: Page, answer: "granted" | "denied") {
  await page.addInitScript(answer => {
    let permission = localStorage.getItem("test.permission") ?? "default";
    Object.defineProperty(window, "Notification", { configurable: true, value: class {
      static get permission() { return permission; }
      static async requestPermission() { localStorage.setItem("test.permissionRequests", String(Number(localStorage.getItem("test.permissionRequests") ?? 0) + 1)); permission = answer; localStorage.setItem("test.permission", answer); return permission; }
    } });
    Object.defineProperty(navigator.serviceWorker, "register", { configurable: true, value: async () => ({ active: {}, showNotification: async (title: string, options: unknown) => {
      const messages = JSON.parse(localStorage.getItem("test.notifications") ?? "[]"); messages.push({ title, options }); localStorage.setItem("test.notifications", JSON.stringify(messages));
    } }) });
  }, answer);
}
test("real setup validates location, uses live dates, preserves records and does not opt in silently", async ({ page }) => {
  await notifications(page, "granted"); await setup(page);
  const before = await stored(page);
  await dialog(page).getByLabel("City", { exact: true }).selectOption("custom");
  await dialog(page).getByLabel("Location name").fill("Home");
  await dialog(page).getByLabel("Latitude", { exact: true }).fill("999");
  await dialog(page).getByLabel("Longitude", { exact: true }).fill("69.24");
  await expect(dialog(page).getByRole("button", { name: "Use these prayer times" })).toBeDisabled();
  expect((await stored(page)).mode).toBe("demo");
  await dialog(page).getByLabel("City", { exact: true }).selectOption("London");
  await dialog(page).getByLabel("Asr convention").selectOption("Shafi");
  await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
  await expect(dialog(page)).toContainText("Choose how to stay reminded.");
  const after = await stored(page);
  expect(after.mode).toBe("fresh"); expect(after.timezone).toBe("Europe/London");
  expect(after.days).toEqual(before.days); expect(after.life.delivery?.enabled ?? false).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("test.permissionRequests"))).toBeNull();
  await reloadSaved(page); expect((await stored(page)).life.calculation?.madhab).toBe("Shafi");
});
test("browser permissions and test notification reflect actual delivery capability", async ({ page }) => {
  await notifications(page, "granted"); await setup(page);
  await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
  await dialog(page).getByRole("button", { name: "Enable notifications", exact: true }).click();
  await expect(dialog(page)).toContainText("Reminders while RISE is open");
  await expect(dialog(page)).toContainText("A browser cannot reliably wake you");
  await expect(dialog(page).getByText("OS-scheduled alerts").locator("..")).toContainText("0");
  const before = await stored(page);
  await dialog(page).getByRole("button", { name: "Send a test notification" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("test.notifications") ?? "[]").length)).toBe(1);
  expect((await stored(page)).prayers.days).toEqual(before.prayers.days);
  await dialog(page).getByRole("button", { name: "Turn off prayer alerts" }).click();
  await expect.poll(async () => (await stored(page)).life.delivery?.enabled).toBe(false);
});
test("denied notifications never appear as scheduled or enabled", async ({ page }) => {
  await notifications(page, "denied"); await setup(page);
  await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
  await dialog(page).getByRole("button", { name: "Enable notifications", exact: true }).click();
  await expect(dialog(page)).toContainText("Notifications are blocked");
  await expect(dialog(page).getByRole("button", { name: "Enable notifications", exact: true })).toHaveCount(0);
  await expect(dialog(page).getByRole("button", { name: "Refresh status", exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Send a test notification" })).toBeDisabled();
  expect((await stored(page)).life.delivery?.enabled ?? false).toBe(false);
});
test("live Fajr plan stays separate from preview acknowledgment and prayer records", async ({ page }) => {
  await notifications(page, "granted"); await setup(page);
  await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
  await dialog(page).getByRole("button", { name: "Open my Fajr plan", exact: true }).click();
  const before = await stored(page);
  await dialog(page).getByRole("switch", { name: "Fajr wake-up alerts", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  expect((await stored(page)).prayers.fajr.enabled).toBe(false);
  await dialog(page).getByRole("button", { name: "Save & preview wake-up", exact: true }).click();
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  expect((await stored(page)).life.delivery?.acknowledgedFajr ?? []).toEqual([]);
  expect((await stored(page)).prayers.days).toEqual(before.prayers.days);
});
test("an executing browser delivers a Fajr alert once, and acknowledgment cancels its backup", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T00:00:00Z") });
  await notifications(page, "granted"); await setup(page);
  await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
  await dialog(page).getByRole("button", { name: "Enable notifications", exact: true }).click();
  await expect.poll(async () => (await stored(page)).life.delivery?.enabled).toBe(true);
  const alertState = await stored(page);
  const entry = alertState.prayers.days["2026-10-21"].entries.fajr;
  const now = await page.evaluate(() => Date.now());
  delete entry.check;
  entry.beginsAt = entry.targetAt = new Date(now + 12000).toISOString();
  entry.endsAt = new Date(now + 3600000).toISOString();
  entry.begins = entry.target = timeInZone(now + 12000, alertState.timezone);
  entry.ends = timeInZone(now + 3600000, alertState.timezone);
  alertState.prayers.preferences.reminders = false;
  alertState.prayers.fajr.wakeLead = 0; alertState.prayers.fajr.enabled = true; alertState.prayers.prepared = {};
  alertState.life.backupEnabled = true; alertState.life.delivery!.sound = false;
  await replaceStored(page, alertState);
  await reloadSaved(page);
  // React and the permission adapter must be ready before advancing virtual time.
  await page.getByRole("button", { name: "Check alerts", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Reminders while RISE is open" })).toBeVisible();
  await page.clock.runFor(15000);
  await expect(page.getByRole("dialog", { name: "Fajr wake-up", exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: "A new beginning." })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("test.notifications") ?? "[]").length)).toBe(1);
  await dialog(page).getByRole("button", { name: "I’m up", exact: true }).click();
  expect((await stored(page)).life.delivery?.acknowledgedFajr).toContain("2026-10-21");
  expect((await stored(page)).prayers.days["2026-10-21"].entries.fajr.check).toBeUndefined();
  await page.clock.runFor(240000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("test.notifications") ?? "[]").length)).toBe(1);
});

// One batched capture round. Disposable test contexts never alter the user's browser profile.
for (const width of [375, 393, 430, 1440]) {
  test(`prayer setup and delivery render at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 852 });
    await setup(page);
    const name = width === 1440 ? "desktop" : width === 393 ? "mobile" : `user-${width}`;
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
    await expect(dialog(page).getByRole("heading", { name: "Prayer times for your day." })).toBeVisible();
    if (width === 393) {
      await dialog(page).getByRole("button", { name: "Use these prayer times" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("mobile-times.png"), fullPage: true, animations: "disabled" });
    }
    expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await dialog(page).getByRole("button", { name: "Use these prayer times" }).click();
    await expect(dialog(page)).toContainText("Choose how to stay reminded.");
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await page.screenshot({ path: info.outputPath(`${name}-delivery.png`), fullPage: true, animations: "disabled" });
    expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width === 393) {
      await dialog(page).getByRole("button", { name: "Send a test notification" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("mobile-delivery-controls.png"), fullPage: true, animations: "disabled" });
    }
  });
}
test("Russian large text and Uzbek controls remain usable", async ({ page }, info) => {
  await setup(page);
  const ruState = await stored(page); ruState.life.language = "ru"; await replaceStored(page, ruState);
  await page.goto("/?text=large");
  await page.getByRole("tab", { name: ru("You"), exact: true }).click();
  await page.getByRole("button", { name: new RegExp(ru("Prayer preferences")) }).click();
  await dialog(page).getByRole("button", { name: new RegExp(ru("Prayer times")) }).click();
  await dialog(page).getByRole("button", { name: "Настроить реальное время молитв" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Время молитв на ваш день." })).toBeVisible();
  expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("russian-large.png"), fullPage: true, animations: "disabled" });
  await dialog(page).getByRole("button", { name: "Использовать это время" }).click();
  await expect(dialog(page)).toContainText("Настройте напоминания.");
  const uzState = await stored(page); uzState.life.language = "uz"; await replaceStored(page, uzState);
  await page.goto("/");
  await page.getByRole("tab", { name: "Siz", exact: true }).click();
  await page.getByRole("button", { name: /Namoz sozlamalari/ }).click();
  await dialog(page).getByRole("button", { name: /Namoz vaqtlari/ }).click();
  await expect(dialog(page).getByRole("heading", { name: "Kuningiz uchun namoz vaqtlari." })).toBeVisible();
});
