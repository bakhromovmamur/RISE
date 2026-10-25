import { test, expect, stored, reloadSaved, type Page } from "./support/browser";
import { balancedFixture, localizeFixture } from "../src/demo";
import { addLifeDemo } from "../src/lifeModel";
import { addDays, xpTotal, type State } from "../src/model";
import { backupText } from "../src/data/backupMessages";
import { createTranslator } from "../src/i18n";
import type { BackupEnvelope } from "../src/data/backup";
import type {} from "../src/review/storageHarness";

const fixture = () => addLifeDemo(balancedFixture(), "prayer-pause");
async function harness(page: Page) { await page.goto("/?storage-test=1"); await expect(page.getByText("Storage test harness ready.")).toBeVisible(); }
async function seed(page: Page, state: State) {
  await page.addInitScript(raw => { if (location.origin === "http://127.0.0.1:4180" && !localStorage.getItem("rise.local.v1")) localStorage.setItem("rise.local.v1", raw); }, JSON.stringify(state));
  await page.goto("/"); await stored(page);
}
async function settings(page: Page) {
  await page.locator("#tab-you").click(); await page.locator(".you-destinations button").last().click();
  const t = createTranslator((await stored(page)).life.language);
  await page.locator(".settings-content > .settings-disclosure > summary").filter({ hasText: t("Your data") }).click();
}
async function openBackup(page: Page, language: State["life"]["language"] = "en") {
  await settings(page); await page.getByRole("button", { name: backupText(language)("title"), exact: true }).click();
}
const upload = (page: Page, raw: string, language: State["life"]["language"] = "en") => page.getByLabel(backupText(language)("choose"), { exact: true }).setInputFiles({ name: "private-backup.json", mimeType: "application/json", buffer: Buffer.from(raw) });

test("real restore atomically retains the previous profile, survives reopening and retries once; rollback returns the exact device snapshot", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    const initial = await db.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    const snapshot = { state: initial.state, archives: [], revision: 0 };
    const changed = structuredClone(initial.state); changed.name = "Imported person";
    const preview = await api.previewRestore(JSON.stringify(changed), snapshot);
    const restored = await db.restore(preview, "restore-one"), retried = await db.restore(preview, "restore-one");
    const point = await db.restorePoint(), original = await db.original(); db.close();
    const reopened = await api.openDeviceStore(), durable = await reopened.verify(raw);
    const invalidRetry = await api.previewRestore(JSON.stringify({ ...changed, name: "Changed retry" }), snapshot);
    let reused = false; try { await reopened.restore(invalidRetry, "restore-one"); } catch { reused = true; }
    const previousFile = await api.createBackup({ state: point!.previous.state, archives: point!.previous.archives ?? [], revision: point!.previous.revision });
    const rollback = await api.previewRestore(previousFile, { state: durable.state, archives: durable.archives ?? [], revision: durable.revision });
    const rolledBack = await reopened.restore({ ...rollback, source: "recovery" }, "rollback-one", point!.id), nextPoint = await reopened.restorePoint();
    reopened.close(); return { initial, restored, retried, point, original, durable, reused, rolledBack, nextPoint };
  }, JSON.stringify({ ...fixture(), unknownSafeData: "Keep this exact local recovery field" }));
  expect(result.restored.revision).toBe(1); expect(result.retried).toEqual(result.restored); expect(result.durable).toEqual(result.restored);
  expect(result.restored.format).toBe(2); expect(result.rolledBack.format).toBe(2);
  expect(result.point?.previous).toEqual(result.initial); expect(result.original).toContain("Keep this exact local recovery field");
  expect(result.restored.state.life.groups).toEqual([]); expect(result.restored.archives?.[0].groups).toHaveLength(2);
  expect(result.reused).toBe(true); expect(result.rolledBack.state).toEqual(result.initial.state);
  expect(result.rolledBack.revision).toBe(2); expect(result.nextPoint?.previous).toEqual(result.restored);
  expect(xpTotal(result.restored.state)).toBe(xpTotal(result.initial.state));
});

test("quota, abort and failed readback at every restore write preserve both the profile and prior recovery point", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    const initial = await db.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    const first = await api.previewRestore(JSON.stringify({ ...initial.state, name: "First import" }), { state: initial.state, archives: [], revision: 0 });
    await db.restore(first, "first");
    const before = await db.read(), point = await db.restorePoint();
    const next = await api.previewRestore(JSON.stringify({ ...initial.state, name: "Second import" }), { state: before.state, archives: before.archives ?? [], revision: before.revision });
    const results = [];
    for (const fault of ["recovery", "profile", "outbox", "abort", "readback"]) {
      const put = IDBObjectStore.prototype.put, add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === fault) throw new DOMException("Injected quota", "QuotaExceededError");
        if (this.name === "profile" && fault === "abort") { this.transaction.abort(); return put.apply(this, args); }
        if (this.name === "profile" && fault === "readback") { const row = structuredClone(args[0]); row.state.name = "Injected write damage"; return put.call(this, row, args[1]); }
        return put.apply(this, args);
      };
      IDBObjectStore.prototype.add = function(...args) { if (this.name === fault) throw new DOMException("Injected quota", "QuotaExceededError"); return add.apply(this, args); };
      let failed = false; try { await db.restore(next, `fault-${fault}`); } catch { failed = true; }
      finally { IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.add = add; }
      results.push({ fault, failed, after: await db.read(), point: await db.restorePoint() });
    }
    const retry = await db.restore(next, "fault-outbox"); db.close(); return { before, point, results, retry };
  }, JSON.stringify(fixture()));
  for (const r of result.results) { expect(r.failed, r.fault).toBe(true); expect(r.after, r.fault).toEqual(result.before); expect(r.point, r.fault).toEqual(result.point); }
  expect(result.retry.state.name).toBe("Second import"); expect(result.retry.revision).toBe(result.before.revision + 1);
});

test("two tabs cannot commit a stale preview, and clearing removes archives and recovery without stale resurrection", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, first = await api.openDeviceStore(), second = await api.openDeviceStore();
    const initial = await first.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    const preview = await api.previewRestore(raw, { state: initial.state, archives: [], revision: 0 });
    const writes = await Promise.allSettled([first.restore(preview, "tab-a"), second.restore(preview, "tab-b")]);
    const after = await first.read(), point = await first.restorePoint();
    let stale = false; try { await second.commit({ state: initial.state, baseRevision: 0, operationId: "stale-edit" }); } catch { stale = true; }
    const rollbackFile = await api.createBackup({ state: point!.previous.state, archives: [], revision: 0 });
    const oldRollback = await api.previewRestore(rollbackFile, { state: after.state, archives: after.archives ?? [], revision: after.revision });
    const cleared = await first.clear(after.revision, api.createEmptyState());
    let resurrection = false; try { await second.restore(oldRollback, "late-rollback", point!.id); } catch { resurrection = true; }
    const recovery = await first.restorePoint(), original = await first.original(), final = await second.read();
    first.close(); second.close(); return { fulfilled: writes.filter(r => r.status === "fulfilled").length, stale, resurrection, recovery, original, cleared, final };
  }, JSON.stringify(fixture()));
  expect(result.fulfilled).toBe(1); expect(result.stale).toBe(true); expect(result.resurrection).toBe(true);
  expect(result.recovery).toBeNull(); expect(result.original).toBeNull(); expect(result.final).toEqual(result.cleared);
  expect(result.final.state.habits).toEqual([]); expect(result.final.archives).toEqual([]);
});

test("worker validation is cancelable, size-bounded and preserves the two-year profile through actual durable restore", async ({ page }) => {
  test.setTimeout(90000); await harness(page);
  const state = fixture(); state.days = {}; state.goals = []; state.dailyPriorities = {}; state.personalRewards = []; state.selectedRewardId = null;
  state.habits = Array.from({ length: 100 }, (_, i) => ({ ...state.habits[0], id: `habit-${i}` }));
  for (let i = 0; i < 731; i++) { const date = addDays("2024-10-19", i); state.days[date] = state.habits.map(h => ({ habitId: h.id, name: h.name, icon: h.icon, type: h.type, unit: h.unit, full: 10, tiny: 1, cue: "After breakfast", check: i % 2 ? "full" : "tiny" })); }
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, empty = api.createEmptyState(), db = await api.openDeviceStore();
    await db.initialize(null, await api.prepareProfile(null, empty));
    const snapshot = { state: empty, archives: [], revision: 0 }, file = new Blob([raw]);
    const controller = new AbortController(); let canceled = false;
    try { await api.runBackupJob({ kind: "preview", file, snapshot }, controller.signal, phase => { if (phase === "validating") controller.abort(); }); } catch (error) { canceled = error instanceof DOMException && error.name === "AbortError"; }
    const untouched = await db.read();
    let oversized = false; try { await api.runBackupJob({ kind: "preview", file: new Blob([new Uint8Array(50 * 1024 * 1024 + 1)]), snapshot }, new AbortController().signal); } catch { oversized = true; }
    const malformedBytes = new TextEncoder().encode(JSON.stringify(empty));
    const nameAt = new TextEncoder().encode(JSON.stringify(empty).slice(0, JSON.stringify(empty).indexOf("Friend"))).length;
    malformedBytes[nameAt] = 255;
    let encodingRejected = false; try { await api.runBackupJob({ kind: "preview", file: new Blob([malformedBytes]), snapshot }, new AbortController().signal); } catch { encodingRejected = true; }
    let ticks = 0; const timer = setInterval(() => { ticks++; }, 20);
    const preview = await api.runBackupJob({ kind: "preview", file, snapshot }, new AbortController().signal); clearInterval(timer);
    if (typeof preview === "string") throw new Error("unexpected result");
    const restored = await db.restore(preview, "large-profile"); db.close();
    const reopened = await api.openDeviceStore(), after = await reopened.read(); reopened.close();
    return { canceled, oversized, encodingRejected, untouched: untouched.revision, ticks, counts: preview.counts, xp: preview.xp, restored: restored.revision, afterCount: Object.values(after.state.days).flat().length, matches: JSON.stringify(after.state.days) === JSON.stringify(preview.content.personal.days) };
  }, JSON.stringify(state));
  expect(result.canceled).toBe(true); expect(result.oversized).toBe(true); expect(result.untouched).toBe(0); expect(result.ticks).toBeGreaterThan(2);
  expect(result.encodingRejected).toBe(true);
  expect(result.counts.habitChecks).toBe(73100); expect(result.afterCount).toBe(73100); expect(result.matches).toBe(true); expect(result.xp).toBe(xpTotal(state));
});

test("settings export, preview, cancel, confirmed restore, read-only archives and exact rollback work without touching source data", async ({ page }, testInfo) => {
  await seed(page, fixture()); await settings(page);
  const before = await stored(page), original = await page.evaluate(() => localStorage.getItem("rise.local.v1"));
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: /^Export local data/ }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const envelope: BackupEnvelope = JSON.parse(Buffer.concat(chunks).toString()); expect(envelope.format).toBe("rise.private-backup");
  expect(envelope.data.personal.days).toEqual(before.days); expect(envelope.data.localArchives[0].groups).toHaveLength(2);
  await page.getByRole("button", { name: "Restore a backup", exact: true }).click();
  const incoming = structuredClone(before); incoming.name = "Restored profile";
  incoming.life.updates[0].note = "<script>window.unwantedExecution = true</script>";
  await upload(page, JSON.stringify(incoming));
  const confirm = page.getByRole("button", { name: "Replace with this backup", exact: true });
  await expect(confirm).toBeDisabled(); await expect(page.getByRole("heading", { name: "Review before replacing" })).toBeFocused();
  if (testInfo.project.name === "chromium") await page.locator(".app-shell").screenshot({ path: testInfo.outputPath("restore-en-light-393-100.png") });
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(page.getByLabel("Choose a JSON backup")).toBeFocused();
  expect(await stored(page)).toEqual(before);
  await upload(page, JSON.stringify(incoming)); await page.getByRole("checkbox", { name: /I understand/ }).check(); await confirm.click();
  await expect(page.getByText("Backup restored on this device.")).toBeVisible();
  const restored = await stored(page); expect(restored.name).toBe("Restored profile"); expect(restored.days).toEqual(before.days); expect(xpTotal(restored)).toBe(xpTotal(before));
  expect(restored.life.groups).toEqual([]); expect(restored.life.tasks).toEqual([]);
  await page.locator(".backup-archives > summary").click();
  await page.locator(".backup-archives details > summary").filter({ hasText: "Small steps together" }).click();
  await expect(page.getByText(incoming.life.updates[0].note, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "unwantedExecution"))).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("rise.local.v1"))).toBe(original);
  await reloadSaved(page); await openBackup(page);
  await page.getByRole("button", { name: "Preview previous profile" }).click();
  await expect(page.getByText(/This returns the exact profile/)).toBeVisible();
  await page.getByRole("checkbox", { name: /I understand/ }).check(); await confirm.click();
  await expect(page.getByText("Backup restored on this device.")).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test("invalid import and quota failure keep the UI usable and leave saved data unchanged; retry succeeds", async ({ page }) => {
  await seed(page, fixture()); const before = await stored(page); await openBackup(page);
  await upload(page, '{"format":"unknown","version":99}');
  await expect(page.getByRole("alert")).toContainText("could not be validated"); expect(await stored(page)).toEqual(before);
  await upload(page, JSON.stringify({ ...before, name: "Retry succeeds" })); await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === "recovery") { IDBObjectStore.prototype.put = put; throw new DOMException("Injected quota", "QuotaExceededError"); } return put.apply(this, args); };
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByRole("alert")).toContainText("Restore did not complete"); expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByText("Backup restored on this device.")).toBeVisible();
  expect((await stored(page)).name).toBe("Retry succeeds");
});

test("an unsupported saved draft can be exported as an exact recovery archive when a portable backup cannot be created", async ({ page }) => {
  const state = fixture(); state.life.drafts["fajr-plan"] = { incompleteUnknownShape: "Keep this private data" };
  await seed(page, state); const before = await stored(page); await settings(page);
  await page.getByRole("button", { name: /^Export local data/ }).click();
  await expect(page.getByRole("alert")).toContainText("A backup could not be prepared");
  await expect(page.getByText(/The recovery archive is unfiltered/)).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download device recovery archive" }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const archive = JSON.parse(Buffer.concat(chunks).toString()); expect(archive.profile[0].state).toEqual(before); expect(await stored(page)).toEqual(before);
});

test("a recovery-read error after commit reports a successful restore and allows raw recovery", async ({ page }) => {
  await seed(page, fixture()); const before = await stored(page); await openBackup(page);
  await upload(page, JSON.stringify({ ...before, name: "Committed import" })); await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function(...args) { if (this.name === "recovery" && args[0] === "pre-import") { IDBObjectStore.prototype.get = get; throw new DOMException("Injected read error", "UnknownError"); } return get.apply(this, args); };
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByText("Backup restored on this device.")).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("Restore did not complete");
  await expect(page.getByRole("button", { name: "Download device recovery archive" })).toBeVisible();
  expect((await stored(page)).name).toBe("Committed import");
});

test("a preview becomes stale when another tab saves, and the UI preserves the newer profile", async ({ page, context }) => {
  await seed(page, fixture()); const before = await stored(page); await openBackup(page);
  await upload(page, JSON.stringify({ ...before, name: "Incoming backup" }));
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  const other = await context.newPage(); await other.goto("/"); await settings(other);
  await other.getByRole("textbox", { name: "Your name", exact: true }).fill("Newer edit in another tab");
  const newer = await stored(other);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByRole("alert")).toContainText("changed after this preview");
  expect(await stored(page)).toEqual(newer); expect(await stored(other)).toEqual(newer);
  await other.close();
});

for (const language of ["en", "ru", "uz"] as const) test(`restore preview and error reflow in ${language}, both appearances at 200% text`, async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const state = localizeFixture(fixture(), language), t = backupText(language);
  await seed(page, state); await page.goto("/?text=large"); await openBackup(page, language);
  await upload(page, JSON.stringify(state), language);
  await expect(page.getByRole("heading", { name: t("preview") })).toBeFocused();
  for (const appearance of ["light", "dark"]) for (const width of [320, 375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    // Theme-only inspection of an isolated synthetic profile; no real user origin is opened.
    await page.locator(".app-shell").evaluate((el, theme) => el.setAttribute("data-theme", theme), appearance);
    const body = page.locator(".backup-screen"), sheet = page.getByRole("dialog");
    const measurements = await body.evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, overflowing: [...el.querySelectorAll("*")].filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map(child => child.tagName + "." + child.className) }));
    expect(measurements.fits, JSON.stringify(measurements.overflowing)).toBe(true);
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole("checkbox", { name: t("confirm") }).scrollIntoViewIfNeeded();
    const button = page.getByRole("button", { name: t("restore") });
    await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (testInfo.project.name === "chromium") await page.locator(".app-shell").screenshot({ path: testInfo.outputPath(`restore-${language}-${appearance}-${width}-200.png`) });
  }
  await page.getByRole("button", { name: t("cancel"), exact: true }).click();
  await upload(page, "malformed", language); await expect(page.getByRole("alert")).toHaveText(t("failed"));
  expect(await page.locator(".backup-screen").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
