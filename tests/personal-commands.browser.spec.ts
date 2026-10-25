import { test, expect, stored, type Page } from "./support/browser";
import { makeFixture } from "../src/review/fixtures";
import { emptyDraft, xpTotal } from "../src/model";
import type {} from "../src/review/storageHarness";

const synthetic = JSON.stringify(makeFixture());
async function harness(page: Page) {
  await page.goto("/?storage-test=1");
  await expect(page.getByText("Storage test harness ready.")).toBeVisible();
}

test("queued personal commands recover from outbox failure without losing IDs, order or original data", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async ({ raw, draft }) => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, session = await api.startDeviceSession(), db = await api.openDeviceStore();
    const before = await db.read(), add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) {
      if (this.name === "outbox") throw new DOMException("Injected quota failure", "QuotaExceededError");
      return add.apply(this, args);
    };
    session.dispatch({ kind: "habit.save", draft, newId: "queued-habit" });
    session.dispatch({ kind: "habit.check", habitId: "queued-habit", date: "2026-10-19", check: "tiny" });
    const acknowledged = await session.whenSaved(), view = session.getSnapshot(), failed = await db.read(), pending = session.pendingExport();
    IDBObjectStore.prototype.add = add;
    await session.retry(); const saved = await db.read(), original = await db.original();
    const repo = api.createLocalRepository(db), receipt = saved.receipts[0];
    const replay = await repo.apply(receipt.operation), afterReplay = await db.read();
    session.close(); db.close(); return { before, acknowledged, view, failed, pending, saved, original, replay, afterReplay };
  }, { raw: synthetic, draft: { ...emptyDraft(), name: "Synthetic habit", tiny: 1 } });
  expect(result.acknowledged).toBe(false); expect(result.view.status).toBe("attention");
  expect(result.failed).toEqual(result.before);
  expect(JSON.parse(result.pending).habits.at(-1).id).toBe("queued-habit");
  expect(result.saved.state.habits.filter(h => h.id === "queued-habit")).toHaveLength(1);
  expect(result.saved.state.days["2026-10-19"].find(o => o.habitId === "queued-habit")?.check).toBe("tiny");
  expect(result.saved.receipts.map(r => r.operation.command.kind)).toEqual(["habit.save", "habit.check"]);
  expect(result.saved.receipts.map(r => r.operation.baseRevision)).toEqual([0, 1]);
  expect(result.saved.receipts.every(r => r.operation.context?.date === "2026-10-19")).toBe(true);
  expect(result.original).toBe(synthetic); expect(result.replay).toMatchObject({ ok: true, replayed: true });
  expect(result.afterReplay).toEqual(result.saved);
});

test("an uncertain real commit replays once and a changed operation ID payload is rejected", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    await db.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    let loseAcknowledgment = true;
    const repo = api.createLocalRepository({
      read: () => db.read(),
      async transaction(change) {
        const committed = await db.transaction(change);
        if (loseAcknowledgment) { loseAcknowledgment = false; throw new Error("Injected lost completion response"); }
        return committed;
      },
    });
    const operation = { protocolVersion: 1, operationId: "uncertain-once", baseRevision: 0,
      command: { kind: "reflection.save", date: "2026-10-19", reflection: { manageable: "Private synthetic note", smaller: "" } },
      context: { date: "2026-10-19", timezone: "Asia/Tashkent", now: Date.parse("2026-10-19T12:00:00Z") } };
    const first = await repo.apply(operation), replay = await repo.apply(operation);
    const reused = await repo.apply({ ...operation, command: { ...operation.command, reflection: { manageable: "Altered", smaller: "" } } });
    const saved = await db.read(); db.close(); return { first, replay, reused, saved };
  }, synthetic);
  expect(result.first).toEqual({ ok: false, code: "storage-failed" });
  expect(result.replay).toMatchObject({ ok: true, replayed: true, operationRevision: 1 });
  expect(result.reused).toEqual({ ok: false, code: "operation-reused" });
  expect(result.saved.revision).toBe(1); expect(result.saved.receipts).toHaveLength(1);
  expect(result.saved.state.reflections["2026-10-19"].manageable).toBe("Private synthetic note");
});

test("concurrent command sessions preserve the losing note until explicit reload", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, a = await api.startDeviceSession(), b = await api.startDeviceSession();
    a.dispatch({ kind: "profile.name", name: "First tab" });
    b.dispatch({ kind: "profile.name", name: "Second tab" });
    const saves = await Promise.all([a.whenSaved(), b.whenSaved()]);
    const loser = saves[0] ? b : a, pending = loser.pendingExport(), failed = loser.getSnapshot();
    await loser.retry(); const stillFailed = loser.getSnapshot();
    await loser.reloadSaved(); const reloaded = loser.getSnapshot();
    const db = await api.openDeviceStore(), saved = await db.read(); db.close(); a.close(); b.close();
    return { saves, pending, failed, stillFailed, reloaded, saved };
  }, synthetic);
  expect(result.saves.filter(Boolean)).toHaveLength(1);
  expect(result.failed.error).toBe("conflict"); expect(result.stillFailed.error).toBe("conflict");
  expect(JSON.parse(result.pending).name).not.toBe(result.saved.state.name);
  expect(result.reloaded.state).toEqual(result.saved.state); expect(result.reloaded.status).toBe("saved");
  expect(result.saved.receipts).toHaveLength(1);
});

test("settings UI writes commands and keeps the exact legacy source", async ({ page }) => {
  await page.addInitScript(raw => localStorage.setItem("rise.local.v1", raw), synthetic);
  await page.goto("/"); await stored(page);
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Command name");
  const saved = await stored(page);
  expect(saved.name).toBe("Command name"); expect(xpTotal(saved)).toBe(xpTotal(JSON.parse(synthetic)));
  const result = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("rise-device"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const entries = await new Promise<{ kind: string; command?: { command: { kind: string } } }[]>((resolve, reject) => { const r = db.transaction("outbox", "readonly").objectStore("outbox").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return { entries, legacy: localStorage.getItem("rise.local.v1") };
  });
  expect(result.legacy).toBe(synthetic);
  expect(result.entries.every(e => e.kind === "domain-command")).toBe(true);
  expect(result.entries.some(e => e.command?.command.kind === "profile.name")).toBe(true);
});

test("an unfinished goal survives navigation and reload without completing or creating a goal", async ({ page }) => {
  await page.addInitScript(raw => localStorage.setItem("rise.local.v1", raw), synthetic);
  const openForm = async () => {
    await page.getByRole("tab", { name: "Progress", exact: true }).click();
    await page.getByRole("tab", { name: "Goals", exact: true }).click();
    await page.getByRole("button", { name: "New goal", exact: true }).click();
  };
  await page.goto("/"); await openForm();
  await page.getByRole("dialog").getByLabel("Goal name", { exact: true }).fill("A saved draft");
  await page.getByRole("dialog").getByLabel("Milestone 1", { exact: true }).fill("Keep this step");
  const drafting = await stored(page);
  expect(drafting.goals.some(g => g.title === "A saved draft")).toBe(false);
  await page.reload(); await openForm();
  await expect(page.getByRole("dialog").getByLabel("Goal name", { exact: true })).toHaveValue("A saved draft");
  await expect(page.getByRole("dialog").getByLabel("Milestone 1", { exact: true })).toHaveValue("Keep this step");
  await page.getByRole("dialog").getByRole("button", { name: "Save goal", exact: true }).click();
  const saved = await stored(page);
  expect(saved.goals.filter(g => g.title === "A saved draft")).toHaveLength(1);
  expect(saved.life.drafts["goal:new"]).toBeUndefined();
  expect(xpTotal(saved)).toBe(xpTotal(drafting));
});

test("a paused timer reopens, resumes and completes with one durable check-in", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async ({ raw, draft }) => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, realNow = Date.now;
    let now = Date.parse("2026-10-19T12:00:00Z"); Date.now = () => now;
    try {
      const first = await api.startDeviceSession();
      first.dispatch({ kind: "habit.save", newId: "timer-habit", draft });
      first.dispatch({ kind: "timer.start", habitId: "timer-habit" });
      now += 20000; first.dispatch({ kind: "timer.pause", habitId: "timer-habit" });
      await first.whenSaved(); const paused = await first.snapshot(); first.close();
      now += 1200000;
      const second = await api.startDeviceSession(), recovered = second.getSnapshot().state.timer;
      second.dispatch({ kind: "timer.resume", habitId: "timer-habit" });
      now += 40000;
      second.dispatch({ kind: "timer.complete", habitId: "timer-habit", date: "2026-10-19" });
      await second.whenSaved(); const finished = await second.snapshot(); second.close();
      const db = await api.openDeviceStore(), record = await db.read(); db.close();
      return { paused, recovered, finished, receiptKinds: record.receipts.map(r => r.operation.command.kind) };
    } finally { Date.now = realNow; }
  }, { raw: synthetic, draft: { ...emptyDraft(), type: "duration" as const, full: 1, name: "Synthetic focus", unit: "minutes" } });
  expect(result.recovered).toEqual(result.paused.state.timer);
  expect(result.recovered?.elapsed).toBe(20); expect(result.recovered?.startedAt).toBeNull();
  expect(result.finished.state.timer).toBeNull();
  expect(xpTotal(result.finished.state) - xpTotal(result.paused.state)).toBe(20);
  expect(result.receiptKinds).toEqual(["habit.save", "timer.start", "timer.pause", "timer.resume", "timer.complete"]);
});

test("Fajr save confirmation waits for a blocked real transaction to commit", async ({ page }) => {
  await page.addInitScript(raw => localStorage.setItem("rise.local.v1", raw), synthetic);
  await page.goto("/"); await stored(page);
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: /^Prayer preferences / }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Prepare for Fajr / }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "A message from your evening self", exact: true }).fill("Wait for the committed plan");
  const before = await stored(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("rise-device"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction("profile", "readwrite"), store = tx.objectStore("profile");
    let holding = true;
    const read = () => { const request = store.get("current"); request.onsuccess = () => { if (holding) read(); }; };
    read(); // A real readwrite lock keeps the command queued before its durable transaction.
    tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
    (window as Window & { releaseRiseSave?: () => void }).releaseRiseSave = () => { holding = false; };
  });
  await page.getByRole("dialog").getByRole("button", { name: "Save my Fajr plan", exact: true }).click();
  await expect(page.locator('[data-storage-status="saving"]')).toBeVisible();
  await expect(page.getByRole("dialog").locator(".life-success")).toHaveCount(0);
  await page.evaluate(() => {
    const control = window as Window & { releaseRiseSave?: () => void };
    control.releaseRiseSave?.(); delete control.releaseRiseSave;
  });
  await expect(page.getByRole("dialog").locator(".life-success")).toContainText("Plan saved on this device.");
  const after = await stored(page);
  expect(Object.values(after.prayers.prepared).some(plan => plan.message === "Wait for the committed plan")).toBe(true);
  expect(xpTotal(after)).toBe(xpTotal(before));
});
