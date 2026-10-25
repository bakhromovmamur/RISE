import { makeFixture } from "../src/review/fixtures.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, archiveHabit, checkIn, correctHabitRecord, emptyDraft, ensureDays, saveHabit, today, weekStart, xpTotal, type State,
} from "../src/model.ts";
import {
  changeGoalStatus, completeMilestone, enjoyReward, ensurePriorities, goalProgress, migrateState,
  priorityOptions, retryReward, rewardEligibility, saveGoal, savePersonalReward, setPriorities,
  spotlightReward, weekGoalMovement, weeklyHabits,
} from "../src/developmentModel.ts";
import { balancedFixture } from "../src/demo.ts";
import { beginWorkBreak, prayerProminence, recordPrayer, weeklyPrayers } from "../src/prayerModel.ts";

const date = "2026-10-19";
test("schema 2 migrates losslessly with empty new collections; migration is idempotent", () => {
  const original = beginWorkBreak(makeFixture(), "asr", date);
  original.prayers.work!.note = "Continue at the settings form";
  original.reflections["2026-10-12"] = { manageable: "Reading", smaller: "Walking" };
  original.plus = true;
  const legacy = JSON.parse(JSON.stringify(original));
  legacy.schema = 2;
  delete legacy.goals; delete legacy.personalRewards; delete legacy.dailyPriorities; delete legacy.selectedRewardId;
  const migrated = migrateState(legacy);
  assert.equal(migrated.schema, 4);
  for (const key of Object.keys(legacy).filter((k) => k !== "schema")) assert.deepEqual(migrated[key as keyof State], legacy[key], key);
  assert.deepEqual(migrated.goals, []);
  assert.deepEqual(migrated.personalRewards, []);
  assert.deepEqual(migrated.dailyPriorities, {});
  assert.deepEqual(migrateState(migrated), migrated);
});
test("schema 1 personal migration preserves records without inventing goals or prayer achievements", () => {
  const legacy = JSON.parse(JSON.stringify(makeFixture("fresh")));
  legacy.schema = 1; delete legacy.prayers; delete legacy.goals; delete legacy.personalRewards; delete legacy.dailyPriorities;
  legacy.reflections["2026-10-12"] = { manageable: "An old reflection", smaller: "" };
  const next = migrateState(legacy);
  assert.deepEqual(next.days, legacy.days);
  assert.deepEqual(next.reflections, legacy.reflections);
  assert.equal(next.goals.length, 0);
  assert.equal(next.personalRewards.length, 0);
  assert.deepEqual(next.prayers.days, {});
});
test("unlimited habits include twelve active habits without changing legacy entitlement", () => {
  let s = makeFixture();
  for (let i = 0; i < 10; i++) s = saveHabit(s, { ...emptyDraft(), name: `Habit ${i}` });
  assert.equal(s.habits.length, 13);
  assert.equal(s.plus, false);
  assert.equal(s.days[date].length, 13);
});
test("daily priorities are references, ordered, deduplicated, capped at three and stable after completion", () => {
  let s = ensurePriorities(makeFixture());
  assert.deepEqual(s.dailyPriorities[date].map((p) => p.kind === "habit" && p.habitId), ["read", "walk", "english"]);
  const xp = xpTotal(s);
  s = setPriorities(s, date, [s.dailyPriorities[date][2], s.dailyPriorities[date][0], s.dailyPriorities[date][0]]);
  assert.equal(xpTotal(s), xp);
  assert.equal(s.dailyPriorities[date].length, 2);
  const selected = structuredClone(s.dailyPriorities[date]);
  s = checkIn(checkIn(s, "english", "full"), "read", "tiny");
  s = ensurePriorities(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(s.dailyPriorities[date], selected);
  s = ensurePriorities(ensureDays({ ...s, demoDate: addDays(date, 1) }));
  assert.deepEqual(s.dailyPriorities[date], selected);
  assert.ok(s.dailyPriorities[addDays(date, 1)].length > 0);
});
test("suggestion fills spare slots with the next milestone of active goals only", () => {
  let s = balancedFixture();
  s.days[date] = [];
  s.dailyPriorities = {};
  s.goals[1].status = "paused";
  const options = priorityOptions(s, date);
  assert.deepEqual(options, [{ kind: "milestone", goalId: "book", milestoneId: "book-3" }]);
  s = ensurePriorities(s);
  assert.deepEqual(s.dailyPriorities[date], options);
  s = setPriorities(s, date, []);
  assert.equal(ensurePriorities(s).dailyPriorities[date].length, 0);
});
test("habit check-ins support goals without completing milestones or counting twice", () => {
  const original = balancedFixture();
  const s = checkIn(checkIn(checkIn(original, "read", "tiny"), "read", "tiny"), "read", "full");
  assert.equal(xpTotal(s) - xpTotal(original), 20);
  assert.deepEqual(s.goals, original.goals);
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 2);
});
test("goal milestone completion, undo, pause and archive retain progress and never award XP", () => {
  let s = balancedFixture();
  const xp = xpTotal(s);
  s = changeGoalStatus(s, "book", "paused");
  assert.equal(s.goals[0].status, "paused");
  s = changeGoalStatus(s, "book", "active");
  for (const id of ["book-3", "book-4", "book-5"]) s = completeMilestone(s, "book", id, true);
  assert.equal(s.goals[0].status, "completed");
  assert.deepEqual(goalProgress(s.goals[0]), { done: 5, total: 5, percent: 100 });
  assert.equal(s.personalRewards[1].earnedOn, date);
  assert.equal(xpTotal(s), xp);
  s = completeMilestone(s, "book", "book-5", true);
  assert.equal(s.goals[0].completedOn, date);
  s = changeGoalStatus(s, "book", "archived");
  assert.equal(s.personalRewards[1].earnedOn, date);
  s = completeMilestone(s, "book", "book-5", false);
  assert.equal(s.goals[0].status, "archived");
  assert.equal(s.goals[0].completedOn, undefined);
  assert.equal(s.personalRewards[1].earnedOn, undefined);
  assert.equal(s.goals[0].milestones.length, 5);
});
test("goal edits reorder milestones, retain completion dates, and preserve linked archived habits", () => {
  let s = balancedFixture();
  const original = s.goals[0];
  s = archiveHabit(s, "read");
  s = saveGoal(s, { ...original, milestones: [...original.milestones].reverse(), title: "Read and reflect" });
  assert.equal(s.goals[0].milestones.at(-1)?.completedOn, "2026-10-12");
  assert.deepEqual(s.goals[0].habitIds, ["read"]);
  assert.equal(goalProgress(s.goals[0]).done, 2);
  assert.throws(() => saveGoal(s, { ...original, milestones: [] }), /at least one/);
});
test("weekly rates only use actions scheduled through today, while history stays fixed", () => {
  const s = balancedFixture(), week = weeklyHabits(s, date);
  assert.equal(week.total, 4);
  assert.equal(week.checked, 1);
  assert.equal(week.rate, 25);
  assert.ok(week.upcoming > 0);
  const prior = weeklyHabits(makeFixture(), "2026-10-12");
  assert.equal(prior.rate, 87.5);
  assert.equal(prior.total, 16);
  assert.equal(prior.upcoming, 0);
});
test("weekly goal movement uses the selected week separately from current progress", () => {
  const s = balancedFixture();
  assert.equal(weekGoalMovement(s, date)[0].completed, 1);
  assert.equal(weekGoalMovement(s, "2026-10-12")[0].completed, 1);
  assert.equal(goalProgress(s.goals[0]).done, 2);
});
test("weekly reward counts full and tiny once, excludes prayers, and survives archived habits", () => {
  let s = balancedFixture();
  s = savePersonalReward(s, { id: "coffee", name: "Coffee", condition: { kind: "weekly", week: date, target: 2 } });
  const originalCount = rewardEligibility(s, s.personalRewards[0]).count;
  s = recordPrayer(s, date, "dhuhr", "on_time");
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, originalCount);
  s = checkIn(checkIn(checkIn(s, "read", "tiny"), "read", "full"), "read", "full");
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 2);
  assert.equal(s.personalRewards[0].earnedOn, date);
  s = archiveHabit(s, "read");
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 2);
  s.days[date].push(structuredClone(s.days[date].find((o) => o.habitId === "read")!));
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 2);
});
test("weekly earned reward survives later missed days and calendar boundaries", () => {
  let s = balancedFixture("earned-reward");
  const original = structuredClone(s.personalRewards[0]);
  s = ensureDays({ ...s, demoDate: "2026-10-27" });
  s = checkIn(s, "read", "tiny");
  assert.equal(s.personalRewards[0].earnedOn, original.earnedOn);
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 3);
  assert.equal(weekStart("2026-10-25"), "2026-10-19");
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  assert.equal(s.timezone, "Asia/Tashkent");
});
test("explicit past corrections revoke an un-enjoyed reward and recompute XP without rewriting snapshots", () => {
  let s = balancedFixture("earned-reward");
  s = ensureDays({ ...s, demoDate: "2026-10-26" });
  const before = xpTotal(s), target = s.days[date].find((o) => o.habitId === "read")!.full;
  s = correctHabitRecord(s, date, "read", null);
  assert.equal(s.personalRewards[0].earnedOn, undefined);
  assert.equal(xpTotal(s), before - 10);
  assert.equal(s.days[date].find((o) => o.habitId === "read")!.full, target);
  assert.equal(rewardEligibility(s, s.personalRewards[0]).count, 2);
  const future = correctHabitRecord(s, "2026-11-01", "read", "full");
  assert.deepEqual(future, s);
});
test("enjoyed reward remains in history with a correction note; enjoying never adds XP", () => {
  let s = balancedFixture("earned-reward");
  const xp = xpTotal(s);
  s = enjoyReward(enjoyReward(s, "coffee"), "coffee");
  assert.equal(xpTotal(s), xp);
  const enjoyed = s.personalRewards[0].enjoyedOn;
  s = checkIn(s, "read", null);
  assert.equal(s.personalRewards[0].enjoyedOn, enjoyed);
  assert.equal(s.personalRewards[0].correctedOn, date);
  s = savePersonalReward(s, { id: "coffee", name: "My coffee", condition: { kind: "weekly", week: "2026-10-26", target: 100 } });
  assert.deepEqual(s.personalRewards[0].condition, { kind: "weekly", week: date, target: 3 });
});
test("try next week creates one separate attempt, retaining original period and records", () => {
  let s = ensureDays({ ...balancedFixture(), demoDate: "2026-10-26" });
  const original = structuredClone(s.personalRewards[0]);
  s = retryReward(retryReward(s, "coffee"), "coffee");
  assert.equal(s.personalRewards.length, 3);
  assert.deepEqual(s.personalRewards[0], original);
  const next = s.personalRewards[2];
  assert.deepEqual(next.condition, { kind: "weekly", week: "2026-10-26", target: 5 });
  assert.equal(next.previousAttemptId, "coffee");
  assert.equal(s.selectedRewardId, next.id);
  assert.equal(retryReward(balancedFixture(), "coffee").personalRewards.length, 2);
});
test("earned rewards are spotlighted before the selected reward; archived/enjoyed rewards recede", () => {
  let s = balancedFixture("earned-reward");
  s.selectedRewardId = "next-book";
  assert.equal(spotlightReward(s)?.id, "coffee");
  s = enjoyReward(s, "coffee");
  assert.equal(spotlightReward(s)?.id, "next-book");
  s.personalRewards[1].archivedOn = date;
  assert.equal(spotlightReward(s), undefined);
});
test("prayer prominence follows planned target, with recording open before preparation starts", () => {
  const s = makeFixture();
  s.prayers.days[date].entries.asr.target = "16:15";
  s.prayers.preferences.leadMinutes = 10;
  const early = prayerProminence(s, { date, minute: 15 * 60 + 50 });
  assert.equal(early.level, "compact");
  assert.equal(early.canRecord, true);
  assert.equal(prayerProminence(s, { date, minute: 16 * 60 + 5 }).level, "prepare");
  assert.equal(prayerProminence(s, { date, minute: 16 * 60 + 15 }).level, "due");
  const expired = prayerProminence(s, { date, minute: 18 * 60 });
  assert.notEqual(expired.next?.id, "asr");
  assert.equal(s.prayers.days[date].entries.asr.check, undefined);
});
test("weekly prayers separate unresolved, recordable and upcoming from reported misses", () => {
  const s = makeFixture(), counts = weeklyPrayers(s, date, { date, minute: 16 * 60 });
  assert.equal(counts.on_time, 2);
  assert.equal(counts.missed, 0);
  assert.equal(counts.open, 1);
  assert.equal(counts.upcoming, 32);
  assert.equal(weeklyPrayers(s, date, { date, minute: 18 * 60 }).unconfirmed, 1);
});
test("required scenes are labelled demo data; empty mode has no invented records", () => {
  const empty = balancedFixture("empty");
  assert.equal(empty.mode, "fresh");
  assert.equal(empty.goals.length, 0);
  assert.equal(empty.personalRewards.length, 0);
  assert.deepEqual(empty.days, {});
  assert.ok(balancedFixture("busy").habits.length >= 12);
  const complete = balancedFixture("completed-priority");
  assert.equal(complete.dailyPriorities[date].length, 3);
  assert.equal(complete.days[date].filter((o) => o.check).length, 3);
  assert.equal(complete.days[date].find((o) => o.habitId === "english")?.check, undefined);
  assert.equal(balancedFixture("earned-reward").personalRewards[0].earnedOn, date);
  assert.equal(prayerProminence(balancedFixture("prayer-due")).level, "due");
});
