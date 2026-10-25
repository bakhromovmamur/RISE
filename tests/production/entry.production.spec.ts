import { stored } from "../support/browser";
import { test, expect, type Page } from "../support/browser";
import { addDays, STORAGE_KEY, xpTotal, type State } from "../../src/model";
import { makeFixture } from "../../src/review/fixtures";
import { addLifeDemo } from "../../src/lifeModel";
import { balancedFixture } from "../../src/demo";

async function seed(page: Page, raw: string) {
  await page.addInitScript(({ key, raw }) => {
    if (location.origin === "http://127.0.0.1:4181" && localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, { key: STORAGE_KEY, raw });
}

test("new production entry is empty, real-time and cannot enable reviewer tools through a URL", async ({ page }) => {
  await page.goto("/?review=1&design=1&text=large&fixture=daily-life&storage-test=1&v=real-prayer-times");
  await expect(page.locator('meta[name="rise-build"]')).toHaveAttribute("content", "production");
  await expect(page.getByRole("button", { name: "Choose other habits first", exact: true })).toBeVisible();
  await expect(page.locator(".reviewer")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Demo fixture" })).toHaveCount(0);
  expect(await page.evaluate(() => window.riseStorageTest)).toBeUndefined();
  expect(await page.locator("html").evaluate(el => el.style.fontSize)).toBe("");
  const s = await stored(page);
  expect(s.mode).toBe("fresh"); expect(s.onboarded).toBe(false); expect(xpTotal(s)).toBe(0);
  expect(s.habits).toEqual([]); expect(s.days).toEqual({}); expect(s.claimed).toEqual([]);
  expect(s.goals).toEqual([]); expect(s.personalRewards).toEqual([]);
  expect(s.prayers.days).toEqual({}); expect(s.prayers.prepared).toEqual({});
  for (const key of ["groups", "tasks", "lists", "updates", "pauses"] as const) expect(s.life[key]).toEqual([]);
  const realDate = await page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date()));
  expect(s.prayers.started).toBe(realDate); expect(s.timezone).toBe("Asia/Tashkent");
  await page.reload(); expect(await stored(page)).toEqual(s);
});

test("real onboarding, tiny/full/Undo and reload preserve only the user's chosen activity", async ({ page }) => {
  // Keep this scenario in daytime; the late-day recovery flow has another valid action label.
  await page.clock.install({ time: new Date("2026-10-21T03:00:00Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "Choose other habits first", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const draft = await stored(page);
  expect(draft.onboarded).toBe(false); expect(draft.habits).toHaveLength(0);
  expect(draft.life.drafts.onboarding).toBeDefined();
  await page.reload();
  await page.getByRole("button", { name: "Create my plan", exact: true }).click();
  const initial = await stored(page), date = initial.prayers.started;
  expect(initial.mode).toBe("fresh"); expect(initial.habits).toHaveLength(1); expect(xpTotal(initial)).toBe(0);
  expect(initial.life.drafts.onboarding).toBeUndefined();
  expect(initial.days[addDays(date, -1)]).toBeUndefined();
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  await expect.poll(async () => xpTotal(await stored(page))).toBe(10);
  await page.reload(); expect(xpTotal(await stored(page))).toBe(10);
  await page.getByRole("button", { name: "View Read a little", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Upgrade to full target/ }).click();
  await expect.poll(async () => xpTotal(await stored(page))).toBe(20);
  await page.getByRole("dialog").getByRole("button", { name: /Undo check-in/ }).click();
  await expect.poll(async () => xpTotal(await stored(page))).toBe(0);
  await page.keyboard.press("Escape"); await page.reload();
  const final = await stored(page);
  expect(final.habits).toEqual(initial.habits); expect(final.prayers.days).toEqual({});
  expect(final.life.groups).toEqual([]); expect(xpTotal(final)).toBe(0);
});

for (const schema of [1, 2, 3, 4]) {
  test(`schema ${schema} existing profiles retain their authored content and activity`, async ({ page }) => {
    const original = addLifeDemo(balancedFixture());
    original.name = "Existing person";
    original.reflections["2026-10-12"] = { manageable: "My own note", smaller: "A smaller next step" };
    const legacy = JSON.parse(JSON.stringify(original)); legacy.schema = schema;
    if (schema === 1) delete legacy.prayers;
    if (schema < 3) { delete legacy.goals; delete legacy.personalRewards; delete legacy.dailyPriorities; delete legacy.selectedRewardId; }
    if (schema < 4) delete legacy.life;
    await seed(page, JSON.stringify(legacy));
    await page.goto("/?review=1&design=1&fixture=empty");
    await expect(page.locator("#panel-today")).toBeVisible();
    const current = await stored(page);
    expect(current.schema).toBe(4); expect(current.name).toBe(original.name);
    expect(current.habits).toEqual(original.habits); expect(current.days).toEqual(original.days);
    expect(current.reflections).toEqual(original.reflections); expect(xpTotal(current)).toBe(xpTotal(original));
    if (schema > 1) expect(current.prayers.days).toEqual(original.prayers.days);
    else expect(Object.values(current.prayers.days).flatMap(day => Object.values(day.entries)).filter(p => p.check)).toEqual([]);
    if (schema < 4) expect(current.life.groups).toEqual([]); else expect(current.life.groups).toEqual(original.life.groups);
    await page.reload();
    expect((await stored(page)).days).toEqual(current.days);
    await expect(page.locator(".reviewer")).toHaveCount(0);
  });
}

test("malformed or unsupported legacy data remains byte-for-byte recoverable", async ({ page }) => {
  const raw = '{"schema":4,"privateNote":"preserve this exact source",';
  await seed(page, raw); await page.goto("/");
  await expect(page.getByRole("button", { name: "Download recovery copy", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download recovery copy", exact: true }).click();
  const stream = await (await download).createReadStream(); let recovered = ""; for await (const chunk of stream!) recovered += chunk.toString();
  expect(recovered).toBe(raw);
  await expect(page.getByRole("button", { name: "Choose other habits first", exact: true })).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
  const future = JSON.stringify({ ...makeFixture(), schema: 99 });
  await page.evaluate(({ key, future }) => localStorage.setItem(key, future), { key: STORAGE_KEY, future });
  await page.reload();
  await expect(page.getByRole("button", { name: "Download recovery copy", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(future);
});

test("migration summary is dated, explains mixed provenance and exports the exact original", async ({ page }) => {
  const original = addLifeDemo(balancedFixture()); original.mode = "fresh";
  const raw = JSON.stringify(original, null, 3); await seed(page, raw); await page.goto("/"); await stored(page);
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await page.getByRole("dialog").locator("summary").filter({ hasText: "Your data" }).click();
  await expect(page.getByRole("dialog")).toContainText("Saved on this device");
  await page.getByRole("dialog").locator("summary").filter({ hasText: "Existing data preserved" }).click();
  await expect(page.getByRole("dialog")).toContainText("sample or mixed history");
  await expect(page.getByRole("dialog")).toContainText(/Migrated: \d{4}-\d{2}-\d{2}/);
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download recovery copy", exact: true }).click();
  const stream = await (await pending).createReadStream(); let recovered = ""; for await (const chunk of stream!) recovered += chunk.toString();
  expect(recovered).toBe(raw);
});
