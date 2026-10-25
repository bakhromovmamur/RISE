import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDomainCommand } from "../src/domain/commands.ts";
import { PersonalReferenceError } from "../src/domain/personalCommands.ts";
import { makeFixture } from "../src/review/fixtures.ts";
import { emptyDraft, xpTotal, type State } from "../src/model.ts";
import type { DomainCommand } from "../src/contracts/commands.ts";

const context = { date: "2026-10-19", now: Date.parse("2026-10-19T12:00:00Z"), timezone: "Asia/Tashkent" };
const habit = { ...emptyDraft(), name: "Saved habit", full: 1, tiny: null };
const commands: DomainCommand[] = [
  { kind: "habit.save", newId: "created-habit", draft: habit },
  { kind: "habit.save", newId: "unused", draft: { ...habit, id: "read", full: 10 } },
  { kind: "goal.save", newId: "created-goal", draft: { title: "Saved goal", reason: "", targetDate: "", habitIds: ["read"], milestones: [{ id: "step", title: "First" }] } },
  { kind: "reward.save", newId: "created-reward", draft: { name: "Saved reward", condition: { kind: "weekly", week: "2026-10-19", target: 3 } } },
  { kind: "reward.retry", rewardId: "old-week", newId: "retry-week" },
  { kind: "timer.complete", habitId: "read", date: context.date },
];
function fixture() {
  const state = Object.assign(makeFixture(), { extension: { note: "Unknown safe data · 🌱" } });
  state.life.drafts["unrelated"] = { note: "Retain this draft" };
  state.life.drafts["habit:new"] = { name: "Pending habit" };
  state.personalRewards.push({ id: "old-week", name: "Old week", condition: { kind: "weekly", week: "2026-10-12", target: 999 }, createdOn: "2026-10-12" });
  state.timer = { habitId: "read", date: context.date, duration: 60, elapsed: 60, startedAt: null };
  return state;
}
function freeze(value: unknown) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.values(value).forEach(freeze); Object.freeze(value);
}

test("delegated personal edits own their result and cannot mutate input, another result or retained history", () => {
  for (const command of commands) {
    const initial = fixture(), before = structuredClone(initial); freeze(initial);
    const first = applyDomainCommand(initial, command, context), second = applyDomainCommand(initial, command, context);
    assert.deepEqual(initial, before); assert.deepEqual(first, second);
    assert.notEqual(Reflect.get(first, "extension"), initial.extension);
    assert.deepEqual(Reflect.get(first, "extension"), initial.extension);
    assert.deepEqual(first.life.drafts["unrelated"], initial.life.drafts["unrelated"]);
    assert.deepEqual(first.days["2026-10-18"], initial.days["2026-10-18"]);
    first.days["2026-10-18"][0].name = "Changed returned history";
    first.habits[0].name = "Changed returned habit";
    first.life.drafts["unrelated"] = { note: "Changed returned draft" };
    assert.deepEqual(initial, before);
    assert.notEqual(second.days["2026-10-18"][0].name, first.days["2026-10-18"][0].name);
    assert.notEqual(second.habits[0].name, first.habits[0].name);
    assert.deepEqual(second.life.drafts["unrelated"], before.life.drafts["unrelated"]);
  }
});

test("timer completion materializes missing days once and retains empty snapshots and rejection behavior", () => {
  const initial = fixture(), command = commands[5];
  delete initial.days[context.date]; const before = structuredClone(initial), beforeXp = xpTotal(initial);
  const completed = applyDomainCommand(initial, command, context);
  assert.equal(completed.timer, null);
  assert.equal(completed.days[context.date].find(row => row.habitId === "read")?.check, "full");
  assert.equal(xpTotal(completed), beforeXp + 20);
  assert.deepEqual(initial, before);
  for (const mutate of [
    (s: State) => { s.days[context.date] = []; },
    (s: State) => { s.timer = null; },
    (s: State) => { s.timer!.elapsed = 59; },
    (s: State) => { s.timer!.date = "2026-10-18"; },
  ]) {
    const state = fixture(); mutate(state); const untouched = structuredClone(state); freeze(state);
    assert.throws(() => applyDomainCommand(state, command, context), PersonalReferenceError);
    assert.deepEqual(state, untouched);
  }
});

test("delegated no-op and invalid edits retain independent recovery data without clearing drafts", () => {
  const state = fixture(); state.personalRewards.at(-1)!.earnedOn = context.date;
  const noOp = applyDomainCommand(state, commands[4], context);
  assert.deepEqual(noOp, state); noOp.life.drafts = {};
  assert.ok(state.life.drafts["unrelated"]);
  const before = structuredClone(state); freeze(state);
  for (const command of [
    { kind: "habit.save", newId: "created-habit", draft: { ...habit, id: "missing" } },
    { kind: "goal.save", newId: "created-goal", draft: { title: "Saved goal", reason: "", targetDate: "", habitIds: ["missing"], milestones: [{ id: "step", title: "First" }] } },
    { kind: "reward.save", newId: "created-reward", draft: { id: "missing", name: "Saved reward", condition: { kind: "weekly", week: context.date, target: 3 } } },
    { kind: "reward.retry", rewardId: "missing", newId: "retry-week" },
  ]) {
    assert.throws(() => applyDomainCommand(state, command, context), PersonalReferenceError);
    assert.deepEqual(state, before);
  }
});
