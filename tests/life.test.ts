import { makeFixture } from "../src/review/fixtures.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { balancedFixture } from "../src/demo.ts";
import { xpTotal } from "../src/model.ts";
import { migrateState, setPriorities, weeklyHabits } from "../src/developmentModel.ts";
import {
  activePause, addLifeDemo, alarmTimes, applyPrayerSetup, availableTasks,
  completeTask, createGroup, isPrayerExcluded, resumePrayers, startPause,
} from "../src/lifeModel.ts";
import { nextPrayer, prayerPhase, prayerStreak, prayerTotals, recordPrayer, weeklyPrayers } from "../src/prayerModel.ts";

const date = "2026-10-19";
test("schema 3 migrates without changing any saved record or inventing people, pauses or activity", () => {
  const legacy = JSON.parse(JSON.stringify(balancedFixture()));
  legacy.schema = 3;
  delete legacy.life;
  const next = migrateState(legacy);
  assert.equal(next.schema, 4);
  for (const key of Object.keys(legacy).filter((k) => k !== "schema"))
    assert.deepEqual((next as any)[key], legacy[key], key);
  for (const key of ["groups", "tasks", "lists", "updates", "pauses"] as const) assert.deepEqual(next.life[key], []);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(next))), next);
});
test("private pause holds streaks without manufacturing prayer records, habit XP or misses", () => {
  let s = addLifeDemo(balancedFixture());
  const before = { totals: prayerTotals(s), streak: prayerStreak(s, "asr").current, xp: xpTotal(s) };
  s = startPause(s, date, "asr");
  s.prayers.demoMinute = 23 * 60;
  assert.equal(prayerPhase(s, date, "asr"), "paused");
  assert.equal(prayerStreak(s, "asr").current, before.streak);
  assert.deepEqual(prayerTotals(s), before.totals);
  assert.equal(xpTotal(s), before.xp);
  assert.equal(weeklyPrayers(s, date).paused, 3);
  assert.equal(weeklyPrayers(s, date).upcoming, 30);
  assert.strictEqual(recordPrayer(s, date, "asr", "on_time"), s);
  assert.equal(startPause(s, date, "asr").life.pauses.length, 1);
});
test("pause retains recorded prayers and resume has explicit current-window semantics", () => {
  let s = startPause(addLifeDemo(balancedFixture()), date, "fajr");
  assert.equal(isPrayerExcluded(s, date, "fajr"), false);
  assert.equal(prayerPhase(s, date, "fajr"), "on_time");
  s = resumePrayers(s, date, "maghrib", true);
  assert.equal(activePause(s), undefined);
  assert.equal(isPrayerExcluded(s, date, "asr"), true);
  assert.equal(isPrayerExcluded(s, date, "maghrib"), false);
  const inclusive = resumePrayers(startPause(addLifeDemo(balancedFixture()), date, "asr"), date, "maghrib", false);
  assert.equal(isPrayerExcluded(inclusive, date, "maghrib"), true);
  assert.equal(isPrayerExcluded(inclusive, date, "isha"), false);
});
test("a pause cannot hide an earlier unresolved streak gap or show an overnight Isha reminder", () => {
  let s = addLifeDemo(balancedFixture());
  delete s.prayers.days["2026-10-18"].entries.fajr.check;
  s = startPause(s, "2026-10-18", "asr");
  assert.equal(prayerStreak(s, "all").pending, true);
  s.prayers.days["2026-10-18"].entries.isha = { begins: "19:05", target: "19:05", ends: "05:20" };
  assert.equal(nextPrayer(s, { date, minute: 60 }), null);
});
test("family tasks repeat by date, count once, undo, and never enter habit counts or XP", () => {
  let s = addLifeDemo(balancedFixture());
  const xp = xpTotal(s), habits = weeklyHabits(s, date);
  const priority = { kind: "task" as const, taskId: "tea", date };
  s = setPriorities(s, date, [priority, priority]);
  assert.deepEqual(s.dailyPriorities[date], [priority]);
  s = completeTask(completeTask(s, "tea", date, true), "tea", date, true);
  assert.equal(Object.keys(s.life.tasks.find((t) => t.id === "tea")!.completions).length, 1);
  assert.deepEqual(s.dailyPriorities[date], [priority]);
  assert.equal(xpTotal(s), xp);
  assert.deepEqual(weeklyHabits(s, date), habits);
  s = completeTask(s, "tea", "2026-10-20", true);
  s = completeTask(s, "tea", date, false);
  assert.equal(s.life.tasks.find((t) => t.id === "tea")!.completions[date], undefined);
  assert.ok(s.life.tasks.find((t) => t.id === "tea")!.completions["2026-10-20"]);
  assert.ok(!availableTasks(s, "2026-10-20").some((t) => t.id === "weekend"));
  s.life.groups[0].archived = true;
  assert.deepEqual(availableTasks(s, date), []);
  assert.strictEqual(completeTask(s, "tea", date, true), s);
});
test("sample setup preserves recorded snapshots and has explicit future coverage and wake times", () => {
  let s = addLifeDemo(balancedFixture());
  const fajr = structuredClone(s.prayers.days[date].entries.fajr);
  s = applyPrayerSetup(s, { ...s.life.setup, city: "Samarkand", source: "calculated", offsets: { ...s.life.setup.offsets, asr: 15 } });
  assert.deepEqual(s.prayers.days[date].entries.fajr, fajr);
  assert.equal(s.prayers.days[date].entries.asr.begins, "15:55");
  assert.equal(s.prayers.days[date].entries.asr.target, "16:10");
  assert.ok(s.prayers.days["2026-10-26"].sample);
  assert.match(s.prayers.days[date].source, /illustrative/);
  assert.ok(alarmTimes(s, "2026-10-20")?.wake);
  assert.equal(alarmTimes(makeFixture("fresh"), "2026-10-20"), null);
});
test("personal empty setup contains no fictional group records; a created group starts with only its owner", () => {
  const s = createGroup(makeFixture("fresh"), "family", "Our home");
  assert.equal(s.life.groups.length, 1);
  assert.equal(s.life.groups[0].members.length, 1);
  assert.equal(s.life.groups[0].members[0].id, "self");
  assert.deepEqual(s.life.tasks, []);
  assert.deepEqual(s.life.updates, []);
});
