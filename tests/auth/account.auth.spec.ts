import { test, expect, stored, type Page } from "../support/browser.ts";
import { localCode, syntheticEmail } from "../support/auth.ts";
import { makeFixture } from "../../src/review/fixtures.ts";
import { createTranslator, type Language } from "../../src/i18n.ts";
import { accountText } from "../../src/auth/text.ts";
import { xpTotal } from "../../src/model.ts";

async function seed(page: Page, language: Language = "en", appearance: "light" | "dark" = "light") {
  const state = makeFixture(); state.name = "Synthetic guest"; state.life.language = language; state.prefs.appearance = appearance;
  state.life.drafts["goal:new"] = { title: "Keep my unfinished goal", reason: "Private guest reason", targetDate: "", habitIds: [], milestones: [{ id: "draft-step", title: "Keep this step" }] };
  const raw = JSON.stringify(state);
  await page.addInitScript(raw => { if (!localStorage.getItem("rise.local.v1")) localStorage.setItem("rise.local.v1", raw); }, raw);
  await page.goto("/"); await stored(page); return raw;
}
async function settings(page: Page, language: Language = "en") {
  const t = createTranslator(language);
  await page.getByRole("tab", { name: t("You", "Siz"), exact: true }).click();
  await page.getByRole("button", { name: `${t("Settings", "Sozlamalar")} ${t("Appearance, language, habits & data", "Ko‘rinish, til, odatlar va ma’lumotlar")}`, exact: true }).click();
}
async function openAccount(page: Page, language: Language = "en") {
  const t = createTranslator(language), text = accountText(language); await settings(page, language);
  await page.locator("summary").filter({ hasText: t("Your data", "Ma’lumotlaringiz") }).click();
  await page.getByRole("button", { name: new RegExp(`^${text("account")} `) }).click();
  await expect(page.getByLabel(text("email"), { exact: true })).toBeVisible();
}
async function login(page: Page, remember = false) {
  const email = syntheticEmail(), text = accountText("en");
  await page.getByLabel(text("email"), { exact: true }).fill(email);
  if (remember) await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: text("send"), exact: true }).click();
  const mail = await localCode(email);
  try {
    await page.getByLabel(text("code"), { exact: true }).fill(mail.code);
    await page.getByRole("button", { name: text("verify"), exact: true }).click();
    await expect(page.getByText(text("signedIn"), { exact: true })).toBeVisible();
  } finally {
    // Do not leave a valid code in an error-context artifact if an assertion fails.
    const input = page.getByLabel(text("code"), { exact: true });
    if (await input.count()) await input.fill("").catch(() => {});
  }
  return email;
}
test("real email-code sign-in, rejected code, inbox return and account switching preserve guest records and drafts", async ({ page, context }) => {
  const original = await seed(page), before = await stored(page), text = accountText("en");
  await openAccount(page);
  const email = syntheticEmail(); await page.getByLabel(text("email"), { exact: true }).fill(email);
  await page.getByRole("button", { name: text("send"), exact: true }).click();
  const mail = await localCode(email), wrong = String((Number(mail.code) + 1) % 1000000).padStart(6, "0");
  await page.getByLabel(text("code"), { exact: true }).fill(wrong);
  await page.getByRole("button", { name: text("verify"), exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(text("invalid_code"));
  // Returning from an inbox revalidates identity without discarding the bound challenge.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel(text("code"), { exact: true })).toBeVisible();
  try {
    await page.getByLabel(text("code"), { exact: true }).fill(mail.code);
    await page.getByRole("button", { name: text("verify"), exact: true }).click();
    await expect(page.getByText(text("signedIn"), { exact: true })).toBeVisible();
  } finally { const input = page.getByLabel(text("code"), { exact: true }); if (await input.count()) await input.fill("").catch(() => {}); }
  const cookies = await context.cookies(), session = cookies.find(cookie => cookie.name === "rise_test_session");
  expect(session?.httpOnly).toBe(true); expect(session?.sameSite).toBe("Lax"); expect(session?.expires).toBe(-1);
  expect(await stored(page)).toEqual(before);
  await page.reload(); await openAccount(page); await expect(page.getByText(text("signedIn"), { exact: true })).toBeVisible();
  await page.getByRole("button", { name: text("signOut"), exact: true }).click();
  await expect(page.getByRole("button", { name: text("send"), exact: true })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "rise_test_session")).toBe(false);
  const second = await login(page, true); expect(second === email).toBe(false);
  expect((await context.cookies()).find(cookie => cookie.name === "rise_test_session")!.expires > Date.now() / 1000).toBe(true);
  await expect(page.getByText(text("persistent"), { exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before); expect(xpTotal(await stored(page))).toBe(xpTotal(before));
  const privateStorage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(privateStorage.includes(email) || privateStorage.includes(second) || /access_token|refresh_token|csrfToken|rise_test_session/.test(privateStorage)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("rise.local.v1"))).toBe(original);
  expect(await page.evaluate(() => document.cookie.includes("rise_test_"))).toBe(false);
  expect(await page.evaluate(async () => { for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) if (new URL(request.url).pathname.startsWith("/api/")) return true; return false; })).toBe(false);
});
test("another tab observes sign-out and clears account identity without clearing guest work", async ({ page, context }) => {
  await seed(page); await openAccount(page); await login(page); const before = await stored(page), text = accountText("en");
  const other = await context.newPage(); await other.goto("/"); await openAccount(other);
  await expect(other.getByText(text("signedIn"), { exact: true })).toBeVisible();
  await page.bringToFront(); await page.getByRole("button", { name: text("signOut"), exact: true }).click();
  await expect(page.getByRole("button", { name: text("send"), exact: true })).toBeVisible();
  await other.bringToFront(); await expect(other.getByRole("button", { name: text("send"), exact: true })).toBeVisible();
  await expect(other.getByLabel(text("email"), { exact: true })).toHaveValue("");
  expect(await stored(other)).toEqual(before); await other.close();
});
test("a disconnected account operation never claims sign-out and guest work stays available", async ({ page }) => {
  await seed(page); await openAccount(page); await login(page); const before = await stored(page), text = accountText("en");
  // A real server disconnect also covers requests owned by WebKit's service worker.
  await page.request.post("/__infra_test__/network?offline=true");
  try {
    // No offline event is required for a failed network operation to produce honest feedback.
    await page.getByRole("button", { name: text("signOut"), exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(text("logoutFailed"));
    expect(await stored(page)).toEqual(before);
  } finally {
    await page.request.post("/__infra_test__/network?offline=false");
  }
  await page.getByRole("button", { name: text("continue"), exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  expect(await stored(page)).toEqual(before);
});
test("pending guest changes survive sign-in and sign-out in another tab and save on retry", async ({ page, context }) => {
  const original = await seed(page), before = await stored(page), other = await context.newPage();
  await other.goto("/"); await openAccount(other);
  await page.bringToFront(); await settings(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === "profile") throw new DOMException("Synthetic storage failure", "QuotaExceededError"); return put.apply(this, args); };
    window.addEventListener("auth-test-restore-storage", () => { IDBObjectStore.prototype.put = put; }, { once: true });
  });
  try {
    await page.getByLabel("Your name", { exact: true }).fill("Pending guest name");
    await expect(page.getByRole("heading", { name: "Your saved data needs attention" })).toBeVisible();
    await other.bringToFront(); await login(other);
    await other.getByRole("button", { name: accountText("en")("signOut"), exact: true }).click();
    await expect(other.getByRole("button", { name: accountText("en")("send"), exact: true })).toBeVisible();
    await page.bringToFront(); await expect(page.getByRole("button", { name: "Export unsaved changes", exact: true })).toBeVisible();
  } finally { await page.evaluate(() => window.dispatchEvent(new Event("auth-test-restore-storage"))); }
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const saved = await stored(page); expect(saved.name).toBe("Pending guest name");
  expect({ ...saved, name: before.name }).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem("rise.local.v1"))).toBe(original); await other.close();
});
for (const language of ["en", "uz", "ru"] as const) test(`account forms reflow in ${language}, both appearances, mobile widths and 200% text`, async ({ page }, testInfo) => {
  await seed(page, language); await openAccount(page, language);
  const text = accountText(language);
  for (const appearance of ["light", "dark"] as const) for (const width of [375, 393, 430, 320]) for (const scale of [100, 200]) {
    await page.setViewportSize({ width, height: 852 });
    await page.evaluate(({ appearance, scale }) => { document.querySelector(".app-shell")?.setAttribute("data-theme", appearance); document.documentElement.style.fontSize = `${scale}%`; }, { appearance, scale });
    await page.getByLabel(text("email"), { exact: true }).fill("synthetic@example.invalid");
    await expect(page.getByRole("button", { name: text("send"), exact: true })).toBeEnabled();
    const overflow = await page.getByRole("dialog").evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
    await expect(page.getByRole("button", { name: createTranslator(language)("Close", "Yopish"), exact: true })).toBeInViewport();
    if (testInfo.project.name === "chromium" && ((width === 393 && scale === 100) || width === 320 && scale === 200)) {
      // No code has been requested; these captures contain no credentials or account identity.
      await page.getByRole("dialog").screenshot({ path: testInfo.outputPath(`account-${language}-${appearance}-${width}-${scale}.png`) });
    }
  }
  // Exercise the real challenge form too, without reading/filling or capturing a usable code.
  await page.getByLabel(text("email"), { exact: true }).fill(syntheticEmail());
  await page.getByRole("button", { name: text("send"), exact: true }).click();
  await expect(page.getByLabel(text("code"), { exact: true })).toBeFocused();
  expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth > element.clientWidth + 1)).toBe(false);
  await page.getByRole("button", { name: text("verify"), exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: text("verify"), exact: true })).toBeInViewport();
  if (testInfo.project.name === "chromium") await page.getByRole("dialog").screenshot({ path: testInfo.outputPath(`code-${language}-dark-320-200.png`) });
});
