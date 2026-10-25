import { test, expect, stored, type Page } from "./support/browser";
import { balancedFixture } from "../src/demo";
import { addLifeDemo } from "../src/lifeModel";
import { makeFixture } from "../src/review/fixtures";
import { addDays } from "../src/model";
import type {} from "../src/review/storageHarness";

const synthetic = JSON.stringify(addLifeDemo(balancedFixture(), "prayer-pause"), null, 2);
async function harness(page: Page) { await page.goto("/?storage-test=1"); await expect(page.getByText("Storage test harness ready.")).toBeVisible(); }

test("no-op personal edits create no receipt and preserve Unicode and unknown safe history", async ({ page }) => {
  await harness(page);
  const state = { ...makeFixture(), extension: { "10": "ten", "2": "two", note: "Привет · Salom · 🌱", values: [null, true, 3] } };
  const raw = JSON.stringify(state), name = "Synthetic · Привет · 🌱";
  const result = await page.evaluate(async ({ raw, name }) => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, session = await api.startDeviceSession(), db = await api.openDeviceStore();
    try {
      session.dispatch({ kind: "profile.name", name: session.getSnapshot().state.name });
      if (!await session.whenSaved()) throw new Error("noop_failed");
      const noChange = await db.read();
      session.dispatch({ kind: "profile.name", name });
      if (!await session.whenSaved()) throw new Error("edit_failed");
      const changed = await db.read();
      session.dispatch({ kind: "profile.name", name });
      if (!await session.whenSaved()) throw new Error("repeated_edit_failed");
      const final = await db.read(), original = await db.original();
      return { noChangeRevision: noChange.revision, noChangeReceipts: noChange.receipts.length,
        changedRevision: changed.revision, finalRevision: final.revision, receipts: final.receipts.length,
        saved: JSON.stringify(final.state), original, status: session.getSnapshot().status };
    } finally { session.close(); db.close(); }
  }, { raw, name });
  expect(result).toEqual({ noChangeRevision: 0, noChangeReceipts: 0, changedRevision: 1, finalRevision: 1,
    receipts: 1, saved: JSON.stringify({ ...state, name }), original: raw, status: "saved" });
  const reopened = await page.evaluate(async raw => {
    const db = await window.riseStorageTest.openDeviceStore();
    try { return JSON.stringify((await db.verify(raw)).state); } finally { db.close(); }
  }, raw);
  expect(reopened).toBe(result.saved);
});

test("adapter and repository results cannot mutate saved records or each other's snapshots", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    await db.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    const read = await db.read(), before = JSON.stringify(read);
    let retained: typeof read.state | undefined;
    const returned = await db.transaction(current => {
      retained = current.state;
      return current;
    });
    retained!.habits[0].name = "Changed retained callback";
    const callbackIsolated = JSON.stringify(returned) === before;
    returned.state.days = {};
    read.state.habits.length = 0;
    const adapterIsolated = JSON.stringify(await db.read()) === before;
    const repo = api.createLocalRepository(db);
    const operation = { protocolVersion: 1, operationId: "isolated-copy", baseRevision: 0,
      command: { kind: "habit.check", habitId: "read", date: "2026-10-19", check: "tiny" } };
    const first = await repo.apply(operation);
    if (!first.ok) throw new Error("isolation_command_failed");
    const committed = JSON.stringify(first.snapshot), other = await repo.read();
    first.snapshot.state.days = {};
    first.snapshot.state.habits.length = 0;
    first.snapshot.revision = 999;
    const replay = await repo.apply(operation);
    if (!replay.ok || !replay.replayed) throw new Error("isolation_replay_failed");
    const replayIsolated = JSON.stringify(replay.snapshot) === committed;
    replay.snapshot.state.prayers.days = {};
    const readIsolated = JSON.stringify(await repo.read()) === committed;
    const otherIsolated = JSON.stringify(other) === committed;
    const original = await db.original(); db.close();
    const reopened = await api.openDeviceStore();
    try {
      const final = await reopened.verify(raw);
      return { callbackIsolated, adapterIsolated, replayIsolated, readIsolated, otherIsolated, original,
        reopenedIsolated: JSON.stringify({ revision: final.revision, state: final.state }) === committed };
    } finally { reopened.close(); }
  }, synthetic);
  expect(result).toEqual({ callbackIsolated: true, adapterIsolated: true, replayIsolated: true,
    readIsolated: true, otherIsolated: true, reopenedIsolated: true, original: synthetic });
});

test("transaction acknowledgment matches durable data even if its callback keeps and mutates a working copy", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, store = await api.openDeviceStore();
    await store.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    try {
      const before = await store.read();
      const returned = await store.transaction(current => {
        const next = { ...current, revision: current.revision + 1, state: { ...current.state, name: "Committed name" } };
        // Runs after put has serialized its value but before the transaction's
        // completion event. An acknowledgment must describe the stored value.
        queueMicrotask(() => { next.state.name = "Changed retained callback"; });
        return next;
      });
      const durable = await store.read();
      const acknowledged = JSON.stringify(returned), saved = JSON.stringify(durable);
      returned.state.days = {}; durable.state.habits.length = 0;
      const reopened = await store.read();
      return { acknowledged, saved, reopened: JSON.stringify(reopened), previousName: before.state.name,
        name: reopened.state.name, revision: reopened.revision, original: await store.original() };
    } finally { store.close(); }
  }, synthetic);
  expect(result.acknowledged).toBe(result.saved);
  expect(result.reopened).toBe(result.saved);
  expect(result.name).toBe("Committed name");
  expect(result.previousName).not.toBe(result.name);
  expect(result.revision).toBe(1);
  expect(result.original).toBe(synthetic);
});

test("IndexedDB migration, exact source recovery, reload and idempotent commands preserve invariants", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore();
    const prepared = await api.prepareProfile(raw, api.createEmptyState());
    const initial = await db.initialize(raw, prepared), again = await db.initialize(raw, prepared);
    const repo = api.createLocalRepository(db);
    const op = { protocolVersion: 1, operationId: "durable-check", baseRevision: 0, command: { kind: "habit.check", habitId: "read", date: "2026-10-19", check: "tiny" } };
    const first = await repo.apply(op), retry = await repo.apply(op);
    const original = await db.original(), saved = await db.read(); db.close();
    const reopened = await api.openDeviceStore(), after = await reopened.verify(raw); reopened.close();
    return { initial, again, first, retry, original, saved, after };
  }, synthetic);
  expect(result.initial.state).toEqual(JSON.parse(synthetic));
  expect(result.again).toEqual(result.initial); expect(result.original).toBe(synthetic);
  expect(result.first.ok).toBe(true); expect(result.retry).toMatchObject({ ok: true, replayed: true, operationRevision: 1 });
  expect(result.saved).toEqual(result.after); expect(result.saved.revision).toBe(1);
  expect(result.saved.state.life.pauses).toEqual(result.initial.state.life.pauses);
  expect(result.saved.state.prayers).toEqual(result.initial.state.prayers);
});

test("a quota exception while installing migration rolls back the profile and retains the legacy source", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, db = await api.openDeviceStore(), prepared = await api.prepareProfile(raw, api.createEmptyState());
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) { if (this.name === "recovery") throw new DOMException("Injected quota exhaustion", "QuotaExceededError"); return originalAdd.apply(this, args); };
    let failed = false;
    try { await db.initialize(raw, prepared); } catch { failed = true; } finally { IDBObjectStore.prototype.add = originalAdd; }
    const partial = await db.existing(), legacy = localStorage.getItem("rise.local.v1");
    const retried = await db.initialize(raw, prepared); db.close(); return { failed, partial, legacy, retried };
  }, synthetic);
  expect(result.failed).toBe(true); expect(result.partial).toBeNull(); expect(result.legacy).toBe(synthetic);
  expect(result.retried.state).toEqual(JSON.parse(synthetic)); expect(result.retried.migration.status).toBe("verified");
});

test("interruption after candidate commit resumes readback once, and altered candidates cannot complete", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore(), prepared = await api.prepareProfile(raw, api.createEmptyState());
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === "profile") throw new DOMException("Injected interruption", "AbortError"); return put.apply(this, args); };
    let interrupted = false;
    try { await db.initialize(raw, prepared); } catch { interrupted = true; } finally { IDBObjectStore.prototype.put = put; }
    const pending = await db.read(); db.close();
    const reopened = await api.openDeviceStore(), verified = await reopened.verify(raw); reopened.close();
    const connection = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("rise-device", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = connection.transaction("profile", "readwrite"); pending.state.name = "Tampered candidate";
      tx.objectStore("profile").put(pending, "current"); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    }); connection.close();
    const damaged = await api.openDeviceStore(); let rejected = false;
    try { await damaged.verify(raw); } catch { rejected = true; }
    const preserved = await damaged.original(); damaged.close(); return { interrupted, pendingStatus: pending.migration.status, verified, rejected, preserved };
  }, synthetic);
  expect(result.interrupted).toBe(true); expect(result.pendingStatus).toBe("pending");
  expect(result.verified.migration.status).toBe("verified"); expect(result.verified.state).toEqual(JSON.parse(synthetic));
  expect(result.rejected).toBe(true); expect(result.preserved).toBe(synthetic);
});

test("outbox failure rolls back an optimistic save; retry is atomic and does not duplicate the operation", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const api = window.riseStorageTest, db = await api.openDeviceStore(); await db.initialize(raw, await api.prepareProfile(raw, api.createEmptyState()));
    const before = await db.read(), state = structuredClone(before.state); state.reflections["2026-10-19"] = { manageable: "An unsaved note", smaller: "Still here" };
    const operation = { operationId: "one-write", baseRevision: 0, state };
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) { if (this.name === "outbox") throw new DOMException("Injected quota exhaustion", "QuotaExceededError"); return add.apply(this, args); };
    let failed = false;
    try { await db.commit(operation); } catch { failed = true; } finally { IDBObjectStore.prototype.add = add; }
    const rolledBack = await db.read(), success = await db.commit(operation), replay = await db.commit(operation);
    let reused = false; try { await db.commit({ ...operation, state: { ...state, name: "Changed" } }); } catch { reused = true; }
    db.close(); return { failed, before, rolledBack, success, replay, reused };
  }, synthetic);
  expect(result.failed).toBe(true); expect(result.rolledBack).toEqual(result.before);
  expect(result.success.revision).toBe(1); expect(result.replay).toEqual(result.success); expect(result.reused).toBe(true);
});

test("two tabs cannot overwrite the same revision, and explicit clear prevents stale resurrection", async ({ page, context }) => {
  await harness(page); const other = await context.newPage(); await harness(other);
  await page.evaluate(async raw => { const a = window.riseStorageTest, db = await a.openDeviceStore(); await db.initialize(raw, await a.prepareProfile(raw, a.createEmptyState())); db.close(); }, synthetic);
  const commit = (tab: Page, name: string) => tab.evaluate(async name => {
    const a = window.riseStorageTest, db = await a.openDeviceStore(), source = await db.read();
    try { const saved = await db.commit({ operationId: name, baseRevision: 0, state: { ...source.state, name } }); return { ok: true, name: saved.state.name }; }
    catch { return { ok: false, name }; } finally { db.close(); }
  }, name);
  const results = await Promise.all([commit(page, "Tab A"), commit(other, "Tab B")]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  const result = await page.evaluate(async () => {
    const a = window.riseStorageTest, db = await a.openDeviceStore(), before = await db.read();
    const cleared = await db.clear(before.revision, a.createEmptyState());
    let stale = false; try { await db.commit({ operationId: "stale", baseRevision: before.revision, state: before.state }); } catch { stale = true; }
    const after = await db.read(), original = await db.original(); db.close(); return { cleared, stale, after, original };
  });
  expect(result.stale).toBe(true); expect(result.after.state.habits).toEqual([]); expect(result.after.revision).toBe(2); expect(result.original).toBeNull();
});

test("sessions receive other tabs' saves and focus fallback works without BroadcastChannel", async ({ page, context }) => {
  await harness(page); const other = await context.newPage(); await harness(other);
  await page.evaluate(async raw => { localStorage.setItem("rise.local.v1", raw); const a = window.riseStorageTest, session = await a.startDeviceSession(); Object.assign(window, { session }); }, synthetic);
  await other.evaluate(async () => {
    const session = await window.riseStorageTest.startDeviceSession(); session.setState(s => ({ ...s, name: "Shared device save" }));
    await new Promise<void>(resolve => { const stop = session.subscribe(() => { if (session.getSnapshot().status === "saved") { stop(); resolve(); } }); }); session.close();
  });
  const read = () => page.evaluate(() => Reflect.get(window, "session").getSnapshot().state.name);
  await expect.poll(read).toBe("Shared device save");
  await page.evaluate(async () => { Reflect.get(window, "session").close(); Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true }); Object.assign(window, { session: await window.riseStorageTest.startDeviceSession() }); });
  await other.evaluate(async () => { const a = window.riseStorageTest, db = await a.openDeviceStore(), saved = await db.read(); await db.commit({ operationId: "fallback", baseRevision: saved.revision, state: { ...saved.state, name: "Focus refresh" } }); db.close(); });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(read).toBe("Focus refresh");
});

test("failed UI saves expose unsaved export and retry, with the previous durable profile unchanged", async ({ page }, testInfo) => {
  await page.addInitScript(raw => localStorage.setItem("rise.local.v1", raw), synthetic);
  await page.goto("/"); const before = await stored(page);
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add; Object.assign(window, { originalAdd: add });
    IDBObjectStore.prototype.add = function(...args) { if (this.name === "outbox") throw new DOMException("Injected quota exhaustion", "QuotaExceededError"); return add.apply(this, args); };
  });
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  await expect(page.getByRole("heading", { name: "Your saved data needs attention" })).toBeVisible();
  const durable = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("rise-device", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise(resolve => { const r = db.transaction("profile").objectStore("profile").get("current"); r.onsuccess = () => resolve(r.result.state); }); } finally { db.close(); }
  });
  expect(durable).toEqual(before);
  for (const width of [320, 375, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await page.locator("html").evaluate(el => { el.style.fontSize = "200%"; });
    expect(await page.locator(".storage-recovery").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`storage-recovery-${width}-200.png`) });
  }
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export unsaved changes", exact: true }).click();
  const stream = await (await download).createReadStream(); let text = ""; for await (const chunk of stream!) text += chunk.toString();
  expect(JSON.parse(text).days[before.demoDate].find((o: { habitId: string }) => o.habitId === "read").check).toBe("tiny");
  await page.evaluate(() => { IDBObjectStore.prototype.add = Reflect.get(window, "originalAdd"); });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const after = await stored(page); expect(after.days[before.demoDate].find(o => o.habitId === "read")?.check).toBe("tiny");
  expect(after.prayers).toEqual(before.prayers);
});

test("legacy changes and unsupported database versions fail closed with recoverable originals", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    const a = window.riseStorageTest, db = await a.openDeviceStore(); await db.initialize(raw, await a.prepareProfile(raw, a.createEmptyState()));
    let drift = false; try { await db.verify(raw + " "); } catch { drift = true; }
    const original = await db.original(), prior = await db.read(); db.close();
    await new Promise<void>((resolve, reject) => { const r = indexedDB.open("rise-device", 2); r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); });
    let future = false; try { await a.openDeviceStore(); } catch { future = true; }
    return { drift, future, original, prior };
  }, synthetic);
  expect(result.drift).toBe(true); expect(result.future).toBe(true); expect(result.original).toBe(synthetic); expect(result.prior.state).toEqual(JSON.parse(synthetic));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your saved data needs attention" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose other habits/ })).toHaveCount(0);
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Export device recovery archive", exact: true }).click();
  const stream = await (await pending).createReadStream(); let raw = ""; for await (const chunk of stream!) raw += chunk.toString();
  expect(JSON.parse(raw).profile[0].state).toEqual(JSON.parse(synthetic));
});

test("a two-year profile survives actual IndexedDB migration and readback without truncation", async ({ page }) => {
  test.setTimeout(60000);
  const state = makeFixture(); state.days = {};
  state.habits = Array.from({ length: 100 }, (_, i) => ({ ...state.habits[0], id: `habit-${i}`, created: "2024-10-19", versions: [{ ...state.habits[0].versions[0], effective: "2024-10-19" }] }));
  for (let i = 0; i < 731; i++) state.days[addDays("2024-10-19", i)] = state.habits.map(h => ({ habitId: h.id, name: h.name, icon: h.icon, type: h.type, unit: h.unit, full: 10, tiny: 1, cue: "After breakfast", check: i % 2 ? "full" : "tiny" }));
  await harness(page);
  const result = await page.evaluate(async raw => {
    const a = window.riseStorageTest, db = await a.openDeviceStore(), prepared = await a.prepareProfile(raw, a.createEmptyState());
    await db.initialize(raw, prepared); db.close();
    const reopened = await a.openDeviceStore(), read = await reopened.verify(raw), original = await reopened.original(); reopened.close();
    return { exact: JSON.stringify(read.state) === JSON.stringify(prepared.state), source: original === raw, count: Object.values(read.state.days).flat().length };
  }, JSON.stringify(state));
  expect(result).toEqual({ exact: true, source: true, count: 73100 });
});

test("a damaged envelope and profile block startup while preserving both exact recovery sources", async ({ page }) => {
  await harness(page);
  const damaged = await page.evaluate(async raw => {
    localStorage.setItem("rise.local.v1", raw);
    const api = window.riseStorageTest, store = await api.openDeviceStore();
    await store.initialize(raw, await api.prepareProfile(raw, api.createEmptyState())); store.close();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rise-device", 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const tx = db.transaction("profile", "readwrite"), profiles = tx.objectStore("profile"), request = profiles.get("current");
        let damaged = "";
        request.onsuccess = () => {
          const value: unknown = request.result;
          if (!value || typeof value !== "object" || !("format" in value) || !("state" in value)
            || !value.state || typeof value.state !== "object" || !("schema" in value.state)) { tx.abort(); return; }
          value.format = 99; value.state.schema = 99;
          damaged = JSON.stringify(value); profiles.put(value, "current");
        };
        tx.oncomplete = () => resolve(damaged); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, synthetic);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your saved data needs attention" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose other habits/ })).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export device recovery archive", exact: true }).click();
  const stream = await (await pending).createReadStream(); let raw = "";
  for await (const chunk of stream!) raw += chunk.toString();
  const recovery = JSON.parse(raw);
  expect(recovery.profile[0]).toEqual(JSON.parse(damaged));
  expect(recovery.recovery).toContain(synthetic);
  expect(await page.evaluate(() => localStorage.getItem("rise.local.v1"))).toBe(synthetic);
});

test("invalid edits remain exportable while the saved profile stays unchanged", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    localStorage.setItem("rise.local.v1", raw);
    const a = window.riseStorageTest, session = await a.startDeviceSession(), before = session.getSnapshot().state;
    session.setState(s => ({ ...s, name: "x".repeat(81) }));
    const failed = session.getSnapshot(), pending = JSON.parse(session.pendingExport());
    const db = await a.openDeviceStore(), durable = (await db.read()).state; db.close();
    await session.reloadSaved(); const recovered = session.getSnapshot(); session.close();
    return { before, failed, pending, durable, recovered };
  }, synthetic);
  expect(result.failed.error).toBe("invalid-edit"); expect(result.pending.name).toHaveLength(81);
  expect(result.durable).toEqual(result.before); expect(result.recovered.status).toBe("saved"); expect(result.recovered.state).toEqual(result.before);
});

test("a legacy change during worker migration preserves both sources and blocks editing", async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async raw => {
    localStorage.setItem("rise.local.v1", raw);
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
      localStorage.setItem("rise.local.v1", raw + " "); return post.call(this, message, Array.isArray(options) ? { transfer: options } : options);
    };
    let blocked = false;
    try { const session = await window.riseStorageTest.startDeviceSession(); session.close(); }
    catch { blocked = true; }
    finally { Worker.prototype.postMessage = post; }
    const db = await window.riseStorageTest.openDeviceStore(); const original = await db.original(); db.close();
    return { blocked, original, legacy: localStorage.getItem("rise.local.v1") };
  }, synthetic);
  expect(result.blocked).toBe(true); expect(result.original).toBe(synthetic); expect(result.legacy).toBe(synthetic + " ");
});
