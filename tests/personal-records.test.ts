import { test } from "node:test";
import assert from "node:assert/strict";
import { hydrate, project } from "../src/contracts/personalRecords.ts";
import { xpTotal } from "../src/model.ts";
import { capacityProfile } from "./support/capacity.ts";

test("two years of account occurrences reconstruct without losing snapshots, XP or original rows", () => {
  const state = capacityProfile("2026-10-24"), records = project(state, state.habits[0].created);
  const original = JSON.stringify(records), restored = hydrate(records);
  assert.equal(Object.values(restored.days).flat().length, 73000);
  assert.equal(xpTotal(restored), xpTotal(state));
  assert.deepEqual(restored.days, state.days);
  assert.deepEqual(project(restored, state.habits[0].created), records);
  assert.equal(JSON.stringify(records), original);
});

test("interleaved account rows retain each parent's ordered history, priorities and explicit prayer reports", () => {
  const state = capacityProfile("2026-10-24", 3, 4), dates = Object.keys(state.days);
  for (const habit of state.habits) habit.versions.push({ ...habit.versions[0], effective: dates[2], full: 30 });
  state.goals = [0, 1].map(i => ({ id: `goal-${i}`, title: `Goal ${i}`, reason: "", targetDate: "",
    habitIds: [state.habits[i].id, state.habits[i + 1].id], status: "active", createdOn: dates[0],
    milestones: [{ id: `step-${i}-a`, title: "First" }, { id: `step-${i}-b`, title: "Second" }],
  }));
  for (const [i, date] of dates.entries()) {
    state.dailyPriorities[date] = [{ kind: "habit", habitId: state.habits[i % 3].id },
      { kind: "milestone", goalId: "goal-0", milestoneId: "step-0-a" }];
    state.prayers.days[date] = { source: "Synthetic manual history", sample: false, timezone: "UTC", entries: {
      fajr: { begins: "04:00", target: "04:15", ends: "06:00", ...(i % 2 ? { check: "later", performedAt: "07:00" } : {}) },
      dhuhr: { begins: "12:00", target: "12:15", ends: "15:00" },
      asr: { begins: "15:00", target: "15:15", ends: "18:00" },
      maghrib: { begins: "18:00", target: "18:15", ends: "20:00" },
      isha: { begins: "20:00", target: "20:15", ends: "23:59" },
    } };
  }
  const records = project(state, dates[0]);
  for (const name of ["habit_occurrences", "goal_habits", "goal_milestones"]) records[name].sort((a, b) => Number(a.position) - Number(b.position));
  records.habit_versions.sort((a, b) => String(a.effective).localeCompare(String(b.effective)));
  records.daily_priorities.sort((a, b) => Number(a.slot) - Number(b.slot));
  records.prayer_windows.reverse(); records.prayer_records.reverse();
  records.goal_milestones.push({ goal_id: "goal-0", id: "retired-step", position: 2, retired: true, data: { title: "Old step" } });
  const before = structuredClone(records), restored = hydrate(records);
  assert.deepEqual(restored.habits, state.habits);
  assert.deepEqual(restored.days, state.days);
  assert.deepEqual(restored.goals, state.goals);
  assert.deepEqual(restored.dailyPriorities, state.dailyPriorities);
  assert.deepEqual(restored.prayers.days, state.prayers.days);
  assert.deepEqual(records, before);
  const missing = structuredClone(records); missing.prayer_windows.pop();
  assert.throws(() => hydrate(missing), /missing_prayer_window/);
  const malformed = structuredClone(records); malformed.habit_versions[0].data = { full: "not a number" };
  assert.throws(() => hydrate(malformed));
  assert.deepEqual(records, before);
});


test("account projection keeps explicit false, zero and empty text without admitting private or inherited fields", () => {
  const date = "2026-10-24", state = capacityProfile(date, 2, 2);
  Object.assign(state.prayers.fajr, { enabled: false, backupMinutes: 0, message: "", backupEnabled: undefined, privateDraft: "device-only synthetic draft" });
  Object.assign(state.prayers.preferences, { latitude: 41.3, longitude: 69.2, calculationKey: "device-only calculation" });
  Object.defineProperty(state.habits[0], "archivedAt", { value: undefined, enumerable: true });
  Object.setPrototypeOf(state.habits[1], { archivedAt: date });
  const before = JSON.stringify(state), records = project(state, state.habits[0].created);
  const settings = records.prayer_settings[0].data;
  assert.ok(settings && typeof settings === "object" && "fajr" in settings && "preferences" in settings);
  const fajr = settings.fajr, preferences = settings.preferences;
  assert.ok(fajr && typeof fajr === "object" && "enabled" in fajr && "backupMinutes" in fajr && "message" in fajr);
  assert.equal(fajr.enabled, false); assert.equal(fajr.backupMinutes, 0); assert.equal(fajr.message, "");
  assert.equal(Object.hasOwn(fajr, "backupEnabled"), false); assert.equal(Object.hasOwn(fajr, "privateDraft"), false);
  assert.ok(preferences && typeof preferences === "object");
  for (const field of ["latitude", "longitude", "calculationKey"]) assert.equal(Object.hasOwn(preferences, field), false);
  for (const habit of records.habits) {
    assert.ok(habit.data && typeof habit.data === "object"); assert.equal(Object.hasOwn(habit.data, "archivedAt"), false);
  }
  assert.equal(JSON.stringify(state), before);
});
