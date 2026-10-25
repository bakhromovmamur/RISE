import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../src/review/fixtures.ts";
import { applyDomainCommand } from "../src/domain/commands.ts";
import { parseCommand, CommandValidationError, type DomainCommand } from "../src/contracts/commands.ts";
import { createMemoryRepository } from "../src/data/repository.ts";
import { emptyDraft, xpTotal, type State } from "../src/model.ts";
import { createBackup, previewRestore } from "../src/data/backup.ts";
import { PersonalReferenceError } from "../src/domain/personalCommands.ts";
import { parseStoredState, validateState } from "../src/data/storedState.ts";

const clock = { date: "2026-10-19", now: Date.parse("2026-10-19T18:59:50Z"), timezone: "Asia/Tashkent" };
const habit = { ...emptyDraft(), name: "A durable minute", type: "duration" as const, unit: "minutes", full: 1, tiny: 0.5 };
const run = (state: State, command: DomainCommand, context = clock) => applyDomainCommand(state, command, context);

test("creation, edits and captured action dates keep IDs and historical targets stable", () => {
  const initial = makeFixture(), past = structuredClone(initial.days), xp = xpTotal(initial);
  let s = run(initial, { kind: "habit.save", draft: habit, newId: "stable-habit" });
  assert.equal(s.habits.at(-1)?.created, clock.date);
  assert.deepEqual(s.days["2026-10-18"], past["2026-10-18"]);
  s = run(s, { kind: "habit.save", draft: { ...habit, id: "stable-habit", full: 10, days: [2] }, newId: "unused" });
  assert.equal(s.days[clock.date].find(o => o.habitId === "stable-habit")?.full, 1);
  const nextClock = { ...clock, date: "2026-10-20", now: clock.now + 86400000 };
  s = run(s, { kind: "calendar.refresh" }, nextClock);
  assert.equal(s.days[nextClock.date].find(o => o.habitId === "stable-habit")?.full, 10);
  assert.equal(xpTotal(s), xp);
  assert.deepEqual(initial.days, past);
  assert.throws(() => run(s, { kind: "habit.save", draft: { ...habit, id: "missing" }, newId: "new" }), PersonalReferenceError);
});

test("timer pause/resume uses captured instants, explicit finish is atomic and replayable", async () => {
  let s = run(makeFixture(), { kind: "habit.save", draft: habit, newId: "focus" });
  const xp = xpTotal(s);
  s = run(s, { kind: "timer.start", habitId: "focus" });
  s = run(s, { kind: "timer.pause", habitId: "focus" }, { ...clock, now: clock.now + 10000 });
  assert.equal(s.timer?.elapsed, 10); assert.equal(s.timer?.startedAt, null);
  s = run(s, { kind: "timer.resume", habitId: "focus" }, { ...clock, now: clock.now + 50000 });
  assert.throws(() => run(s, { kind: "timer.complete", habitId: "focus", date: clock.date }), PersonalReferenceError);
  assert.throws(() => run(s, { kind: "timer.complete", habitId: "focus", date: "2026-10-20" }, { ...clock, date: "2026-10-20", now: clock.now + 100000 }), PersonalReferenceError);
  const repo = createMemoryRepository(s), operation = { protocolVersion: 1, operationId: "finish-once", baseRevision: 0, command: { kind: "timer.complete", habitId: "focus", date: clock.date }, context: { ...clock, now: clock.now + 100000 } };
  assert.equal((await repo.apply(operation)).ok, true);
  const replay = await repo.apply(operation);
  assert.equal(replay.ok && replay.replayed, true);
  const saved = await repo.read(); assert.equal(saved.revision, 1); assert.equal(saved.state.timer, null);
  assert.equal(xpTotal(saved.state), xp + 20);
  assert.equal(xpTotal(run(s, { kind: "timer.end", habitId: "focus" })), xp);
});

test("goals, fixed-week rewards, reflection and collection commands never add habit XP", () => {
  let s = parseStoredState(JSON.stringify(makeFixture())); const xp = xpTotal(s);
  s = run(s, { kind: "goal.save", newId: "goal", draft: { title: "Read", reason: "Private", targetDate: "", habitIds: ["read"], milestones: [{ id: "m", title: "Decide" }] } });
  validateState(s); // A command result must be directly storable, including absent optional dates.
  s = run(s, { kind: "reward.save", newId: "reward", draft: { name: "Tea", condition: { kind: "goal", goalId: "goal" } } });
  s = run(s, { kind: "goal.milestone", goalId: "goal", milestoneId: "m", completed: true });
  assert.equal(s.personalRewards.at(-1)?.earnedOn, clock.date);
  s = run(s, { kind: "reward.enjoy", rewardId: "reward" });
  s = run(s, { kind: "goal.milestone", goalId: "goal", milestoneId: "m", completed: false });
  assert.equal(s.personalRewards.at(-1)?.correctedOn, clock.date);
  s = run(s, { kind: "reward.save", newId: "weekly", draft: { name: "A walk", condition: { kind: "weekly", week: "2026-10-12", target: 999 } } });
  s = run(s, { kind: "reward.retry", rewardId: "weekly", newId: "retry" });
  s = run(s, { kind: "reward.retry", rewardId: "weekly", newId: "ignored-duplicate" });
  assert.equal(s.personalRewards.filter(r => r.previousAttemptId === "weekly").length, 1);
  assert.deepEqual(s.personalRewards.find(r => r.id === "retry")?.condition, { kind: "weekly", week: "2026-10-19", target: 999 });
  s = run(s, { kind: "reflection.save", date: clock.date, reflection: { manageable: "私のメモ", smaller: "Bir qadam" } });
  s = run(s, { kind: "collection.claim", xp: 100 });
  s = run(s, { kind: "collection.claim", xp: 100 });
  assert.equal(s.claimed.filter(n => n === 100).length, 1);
  assert.equal(xpTotal(s), xp);
});

test("draft and settings commands retain unrelated private records and backup-compatible drafts", async () => {
  const original = makeFixture(); let s = structuredClone(original);
  s = run(s, { kind: "draft.save", key: "reflection:2026-10-19", value: { manageable: "Unfinished", smaller: "" } });
  s = run(s, { kind: "profile.name", name: "O‘z ismim" });
  s = run(s, { kind: "language.set", language: "ru" });
  s = run(s, { kind: "preferences.set", changes: { appearance: "dark", sound: false } });
  assert.deepEqual(s.days, original.days); assert.deepEqual(s.prayers, original.prayers);
  const backup = await createBackup({ state: s, archives: [], revision: 1 });
  const preview = await previewRestore(backup, { state: original, archives: [], revision: 0 });
  assert.deepEqual(preview.content.personal.life.drafts["reflection:2026-10-19"], s.life.drafts["reflection:2026-10-19"]);
  s = run(s, { kind: "reflection.save", date: clock.date, reflection: { manageable: "Finished", smaller: "" } });
  assert.equal(s.life.drafts["reflection:2026-10-19"], undefined);
});

test("malformed personal commands fail before adapter access or state mutation", async () => {
  const invalid = [
    { kind: "preferences.set", changes: { admin: true } },
    { kind: "draft.save", key: "__proto__", value: {} },
    { kind: "goal.save", newId: "x", draft: { title: "X" } },
    { kind: "habit.save", newId: "x", draft: { ...habit, days: [9] } },
    { kind: "reflection.save", date: "2026-02-30", reflection: { manageable: "", smaller: "" } },
    { kind: "onboarding.finish", name: "Test", reminders: false, habits: Array(4).fill({ newId: "x", draft: habit }) },
    { kind: "collection.claim", xp: 99 }, { kind: "timer.complete", habitId: "focus", date: clock.date, xp: 20 },
  ];
  for (const command of invalid) assert.throws(() => parseCommand(command), CommandValidationError);
  const repo = createMemoryRepository(makeFixture()), before = await repo.read();
  const denied = await repo.apply({ protocolVersion: 1, operationId: "locked", baseRevision: 0, command: { kind: "collection.claim", xp: 1200 }, context: clock });
  assert.deepEqual(denied, { ok: false, code: "missing-record" }); assert.deepEqual(await repo.read(), before);
});

test("unavailable historical priorities remain selected until explicitly removed", () => {
  let s = parseStoredState(JSON.stringify(makeFixture()));
  const unavailable = { kind: "milestone" as const, goalId: "old-goal", milestoneId: "removed-step" };
  s.dailyPriorities[clock.date] = [unavailable, { kind: "habit", habitId: "read" }];
  const original = structuredClone(s);
  s = run(s, { kind: "priorities.set", date: clock.date, priorities: [...s.dailyPriorities[clock.date]].reverse() });
  assert.deepEqual(s.dailyPriorities[clock.date], [...original.dailyPriorities[clock.date]].reverse());
  assert.deepEqual(s.days, original.days);
  assert.deepEqual(original.dailyPriorities[clock.date][0], unavailable);
  s = run(s, { kind: "priority.pin", date: clock.date, priority: unavailable, selected: false });
  assert.deepEqual(s.dailyPriorities[clock.date], [{ kind: "habit", habitId: "read" }]);
  assert.throws(() => run(s, { kind: "priorities.set", date: clock.date, priorities: [unavailable] }));
});

test("a reminder preview can keep a return note before a timetable is configured", () => {
  let s = parseStoredState(JSON.stringify(makeFixture())); s.prayers.days = {};
  const xp = xpTotal(s);
  s = run(s, { kind: "work.begin", date: clock.date, prayer: "asr" });
  s = run(s, { kind: "work.note", date: clock.date, prayer: "asr", note: "Finish this sentence" });
  s = run(s, { kind: "work.wrap", date: clock.date, prayer: "asr" });
  assert.equal(s.prayers.work?.wrapUntil, clock.now + 60000);
  s = run(s, { kind: "work.stage", date: clock.date, prayer: "asr", stage: "away" });
  assert.equal(s.prayers.work?.note, "Finish this sentence");
  assert.deepEqual(s.prayers.days, {}); assert.equal(xpTotal(s), xp); validateState(s);
});
