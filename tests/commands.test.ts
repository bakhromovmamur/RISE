import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../src/review/fixtures.ts";
import { balancedFixture } from "../src/demo.ts";
import { checkIn, correctHabitRecord, xpTotal } from "../src/model.ts";
import { CommandValidationError, parseCommand, type DomainCommand } from "../src/contracts/commands.ts";
import { applyDomainCommand, CommandReferenceError } from "../src/domain/commands.ts";
import { createLocalRepository, createMemoryRepository, type RepositoryRecord } from "../src/data/repository.ts";

const check: DomainCommand = { kind: "habit.check", habitId: "read", date: "2026-10-19", check: "tiny" };
const operation = (id: string, baseRevision = 0, command = check) => ({ protocolVersion: 1, operationId: id, baseRevision, command });

test("validated check, upgrade and history correction retain existing XP and reward semantics", () => {
  const original = makeFixture(), before = structuredClone(original);
  const tiny = applyDomainCommand(original, check);
  assert.deepEqual(tiny, checkIn(original, "read", "tiny"));
  const full = applyDomainCommand(tiny, { ...check, check: "full" });
  assert.equal(xpTotal(full) - xpTotal(original), 20);
  assert.equal(xpTotal(applyDomainCommand(full, check)), xpTotal(full));
  const correction = { ...check, kind: "habit.correct", date: "2026-10-12", check: null };
  assert.deepEqual(applyDomainCommand(full, correction), correctHabitRecord(full, correction.date, "read", null));
  assert.deepEqual(original, before);
});

test("check-in materializes the new day before looking up its occurrence", () => {
  const s = makeFixture(); s.demoDate = "2026-10-20";
  const next = applyDomainCommand(s, { ...check, date: s.demoDate });
  assert.equal(next.days[s.demoDate].find(o => o.habitId === "read")?.check, "tiny");
  assert.equal(xpTotal(next) - xpTotal(s), 10);
});

test("check validation preserves captured empty days and explicit Undo of an archived occurrence", () => {
  const empty = makeFixture(); empty.days[check.date] = [];
  assert.throws(() => applyDomainCommand(empty, check), CommandReferenceError);
  assert.deepEqual(empty.days[check.date], []);
  const archived = makeFixture(), habit = archived.habits.find(h => h.id === check.habitId)!;
  habit.archivedAt = check.date;
  archived.days[check.date].find(row => row.habitId === habit.id)!.check = "full";
  const original = structuredClone(archived), beforeXp = xpTotal(archived);
  for (const kind of ["habit.check", "habit.correct"] as const) {
    const undone = applyDomainCommand(archived, { ...check, kind, check: null });
    assert.equal(undone.days[check.date].some(row => row.habitId === habit.id), false);
    assert.equal(xpTotal(undone), beforeXp - 20);
    assert.deepEqual(archived, original);
  }
  const noTiny = makeFixture(); noTiny.days[check.date].find(row => row.habitId === check.habitId)!.tiny = null;
  const before = structuredClone(noTiny);
  assert.throws(() => applyDomainCommand(noTiny, check), CommandReferenceError);
  assert.deepEqual(noTiny, before);
});

test("malformed commands never reach a storage adapter or invoke an accessor", async () => {
  let calls = 0, accessed = false;
  const repo = createLocalRepository({
    async read() { calls++; throw new Error("must not read"); },
    async transaction() { calls++; throw new Error("must not write"); },
  });
  const getter = Object.defineProperty({}, "kind", { get() { accessed = true; return "habit.check"; }, enumerable: true });
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  const invalid = [
    null, [], { ...check, check: "earned" }, { ...check, date: "2026-02-30" },
    { ...check, ownerId: "someone-else" }, { ...check, habitId: "__proto__" },
    { kind: "future.command" }, { ...check, date: "2026-1-1" },
    { ...check, habitId: "x".repeat(70000) }, getter, cycle,
    JSON.parse('{"kind":"fajr.acknowledge","date":"2026-10-19","__proto__":{"polluted":true}}'),
    Object.assign(Object.create({ kind: "habit.check" }), check),
    { kind: "priorities.set", date: "2026-10-19", priorities: Array(4).fill({ kind: "habit", habitId: "read" }) },
    { kind: "priorities.set", date: "2026-10-19", priorities: [{ kind: "habit", habitId: "read" }, { kind: "habit", habitId: "read" }] },
  ];
  for (const command of invalid) {
    assert.throws(() => parseCommand(command), CommandValidationError);
    assert.deepEqual(await repo.apply({ ...operation("bad"), command }), { ok: false, code: "invalid-command" });
  }
  for (const bad of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(await repo.apply(operation("bad-revision", bad)), { ok: false, code: "invalid-command" });
  }
  assert.equal(calls, 0); assert.equal(accessed, false);
});

test("a retried operation has one effect and a reused ID with changed content is rejected", async () => {
  const initial = makeFixture(), repo = createMemoryRepository(initial);
  const first = await repo.apply(operation("check-once"));
  assert.equal(first.ok, true);
  const replay = await repo.apply(operation("check-once"));
  assert.equal(replay.ok && replay.replayed, true);
  assert.equal(replay.ok && replay.operationRevision, 1);
  assert.equal((await repo.read()).revision, 1);
  assert.equal(xpTotal((await repo.read()).state), xpTotal(initial) + 10);
  assert.deepEqual(await repo.apply(operation("check-once", 0, { ...check, check: null })), { ok: false, code: "operation-reused" });
  const view = await repo.read(); view.state.habits.length = 0;
  assert.equal((await repo.read()).state.habits.length, initial.habits.length);
});

test("repository snapshots cannot mutate stored history, replay results or another caller's snapshot", async () => {
  const initial = makeFixture(), expected = structuredClone(initial), repo = createMemoryRepository(initial);
  initial.habits[0].name = "Changed source";
  const view = await repo.read();
  assert.deepEqual(view.state, expected);
  const first = await repo.apply(operation("isolated-result"));
  assert.ok(first.ok);
  const committed = structuredClone(first.snapshot);
  first.snapshot.state.days[check.date][0].name = "Changed returned history";
  first.snapshot.state.habits.length = 0;
  first.snapshot.revision = 999;
  view.state.prayers.days = {};
  assert.deepEqual(await repo.read(), committed);
  const replay = await repo.apply(operation("isolated-result"));
  assert.ok(replay.ok && replay.replayed);
  assert.deepEqual(replay.snapshot, committed);
  replay.snapshot.state.days = {};
  const current = await repo.read();
  assert.deepEqual(current, committed);
  assert.notEqual(current.state, committed.state);
  const next = await repo.apply(operation("isolated-next", 1, { ...check, check: "full" }));
  assert.ok(next.ok);
  assert.deepEqual(current, committed);
});

test("concurrent check and Undo preserve a revision conflict and let the caller retry explicitly", async () => {
  const repo = createMemoryRepository(makeFixture());
  const [checked, undone] = await Promise.all([
    repo.apply(operation("check-first")),
    repo.apply(operation("undo-second", 0, { ...check, check: null })),
  ]);
  assert.equal(checked.ok, true);
  assert.deepEqual(undone, { ok: false, code: "conflict" });
  assert.equal((await repo.read()).state.days[check.date][0].check, "tiny");
  assert.equal((await repo.apply(operation("undo-second", 1, { ...check, check: null }))).ok, true);
  assert.equal((await repo.read()).state.days[check.date][0].check, undefined);
  const replay = await repo.apply(operation("check-first"));
  assert.equal(replay.ok && replay.snapshot.revision, 2);
  assert.equal((await repo.read()).state.days[check.date][0].check, undefined);
});

test("unavailable records and failed commits leave durable state and receipts unchanged", async () => {
  const initial = makeFixture();
  let record: RepositoryRecord = { state: initial, revision: 0, receipts: [] };
  const repo = createLocalRepository({
    async read() { return structuredClone(record); },
    async transaction(update) { update(structuredClone(record)); throw new DOMException("Storage full", "QuotaExceededError"); },
  });
  assert.deepEqual(await repo.apply(operation("missing", 0, { ...check, habitId: "missing" })), { ok: false, code: "missing-record" });
  assert.deepEqual(await repo.apply(operation("quota")), { ok: false, code: "storage-failed" });
  assert.deepEqual(await repo.read(), { state: initial, revision: 0 });
  assert.deepEqual(record.receipts, []);
  assert.throws(() => applyDomainCommand(initial, { ...check, date: "2026-10-18" }), CommandReferenceError);
});

test("goal, priority, prayer, pause and Fajr commands retain their separate effects", () => {
  let s = balancedFixture();
  const xp = xpTotal(s), day = structuredClone(s.days), date = s.demoDate;
  const goal = s.goals[0], milestone = goal.milestones.find(m => !m.completedOn)!;
  s = applyDomainCommand(s, { kind: "goal.milestone", goalId: goal.id, milestoneId: milestone.id, completed: true });
  assert.equal(s.goals[0].milestones.find(m => m.id === milestone.id)?.completedOn, date);
  s = applyDomainCommand(s, { kind: "goal.status", goalId: goal.id, status: "archived" });
  assert.equal(s.goals[0].status, "archived");
  s = applyDomainCommand(s, { kind: "priorities.set", date, priorities: [{ kind: "habit", habitId: "read" }] });
  assert.deepEqual(s.dailyPriorities[date], [{ kind: "habit", habitId: "read" }]);
  s.prayers.demoMinute = 15 * 60 + 45;
  s = applyDomainCommand(s, { kind: "prayer.record", date, prayer: "asr", check: "on_time" });
  assert.equal(s.prayers.days[date].entries.asr.check, "on_time");
  s = applyDomainCommand(s, { kind: "prayer.pause", pauseId: "pause-once", date, prayer: "maghrib" });
  const paused = applyDomainCommand(s, { kind: "prayer.record", date, prayer: "maghrib", check: "on_time" });
  assert.deepEqual(paused, s);
  s = applyDomainCommand(s, { kind: "prayer.resume", date, prayer: "isha", includeCurrent: true });
  assert.equal(s.life.pauses[0].through, `${date}:3`);
  const prayers = structuredClone(s.prayers.days);
  s = applyDomainCommand(s, { kind: "fajr.acknowledge", date });
  assert.deepEqual(s.prayers.days, prayers);
  assert.equal(xpTotal(s), xp); assert.deepEqual(s.days, day);
});
