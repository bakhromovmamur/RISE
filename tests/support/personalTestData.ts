import { randomUUID } from "node:crypto";
import { addDays, emptyDraft, localDate, weekStart } from "../../src/model.ts";
import { PRAYERS, type PrayerDay } from "../../src/prayerModel.ts";
import type { PersonalClient } from "./personal.ts";

/** Synthetic authored account records only: no guest fixture, coordinates or browser storage. */
export async function personalTotals(client: PersonalClient) {
  const date = localDate("UTC"), tomorrow = addDays(date, 1), habits = Array.from({ length: 6 }, () => randomUUID());
  const draft = { ...emptyDraft(), name: "Synthetic habit 0", full: 5, tiny: 1, days: [0,1,2,3,4,5,6] };
  for (const [index, id] of habits.entries()) await client.command({ kind: "habit.save", newId: id, draft: { ...draft, name: `Synthetic habit ${index}` } });
  await client.command({ kind: "calendar.refresh" });
  await client.command({ kind: "onboarding.skip" });
  const goal = randomUUID(), milestone = randomUUID(), remaining = randomUUID(), reward = randomUUID(), weekly = randomUUID();
  await client.command({ kind: "goal.save", newId: goal, draft: { title: "Synthetic goal", reason: "Private reason", targetDate: "", habitIds: habits.slice(0,2), milestones: [{ id: milestone, title: "First step" }, { id: remaining, title: "Second step" }] } });
  await client.command({ kind: "priorities.set", date, priorities: [{ kind: "habit", habitId: habits[0] }, { kind: "milestone", goalId: goal, milestoneId: milestone }] });
  await client.command({ kind: "reward.save", newId: reward, draft: { name: "Goal reward", condition: { kind: "goal", goalId: goal } } });
  await client.command({ kind: "reward.save", newId: weekly, draft: { name: "Weekly reward", condition: { kind: "weekly", week: weekStart(date), target: 6 } } });
  for (const id of habits) await client.command({ kind: "habit.check", habitId: id, date, check: "full" });
  await client.command({ kind: "habit.save", newId: randomUUID(), draft: { ...draft, id: habits[0], name: "New future habit name", full: 10 } });
  await client.command({ kind: "goal.milestone", goalId: goal, milestoneId: milestone, completed: true });
  await client.command({ kind: "goal.milestone", goalId: goal, milestoneId: remaining, completed: true });
  await client.command({ kind: "reward.enjoy", rewardId: reward });
  await client.command({ kind: "reward.enjoy", rewardId: weekly });
  await client.command({ kind: "reward.select", rewardId: weekly });
  await client.command({ kind: "collection.claim", xp: 100 });
  await client.command({ kind: "goal.save", newId: randomUUID(), draft: { id: goal, title: "Synthetic goal", reason: "Private reason", targetDate: "", habitIds: habits.slice(0,2), milestones: [{ id: remaining, title: "Second step" }] } });
  await client.command({ kind: "priorities.set", date, priorities: [{ kind: "milestone", goalId: goal, milestoneId: milestone }, { kind: "habit", habitId: habits[0] }] });
  const windows = [["00:00","00:10","02:00"],["02:00","02:10","04:00"],["04:00","04:10","06:00"],["06:00","06:10","08:00"],["08:00","08:10","10:00"]];
  const entries = Object.fromEntries(PRAYERS.map(({ id }, index) => [id, { begins: windows[index][0], target: windows[index][1], ends: windows[index][2] }]));
  // API validation verifies every prayer; this local synthetic fixture uses the same complete IDs.
  const day: PrayerDay = { source: "Synthetic checked manual timetable", sample: false, timezone: "UTC", entries: entries as PrayerDay["entries"] };
  await client.command({ kind: "prayer.timetable", date, day, preferences: { place: "home", leadMinutes: 10, style: "gentle", reminders: false } });
  await client.command({ kind: "prayer.record", date, prayer: "fajr", check: "on_time" });
  await client.command({ kind: "prayer.pause", pauseId: randomUUID(), date, prayer: "dhuhr" });
  await client.command({ kind: "prayer.resume", date, prayer: "asr", includeCurrent: true });
  const plan = { bedtime: "22:00", wakeLead: 10, backupMinutes: 10, message: "Synthetic wake plan", placement: "away", enabled: true };
  await client.command({ kind: "fajr.plan", date, plan, backupEnabled: true });
  await client.command({ kind: "fajr.plan", date: tomorrow, plan, backupEnabled: false });
  await client.command({ kind: "fajr.acknowledge", date });
  await client.command({ kind: "work.begin", date, prayer: "fajr" });
  await client.command({ kind: "work.note", date, prayer: "fajr", note: "First private synthetic note" });
  await client.command({ kind: "work.stage", date, prayer: "fajr", stage: "returned" });
  await client.command({ kind: "work.begin", date, prayer: "dhuhr" });
  await client.command({ kind: "work.note", date, prayer: "dhuhr", note: "Second private synthetic note" });
  await client.command({ kind: "reflection.save", date, reflection: { manageable: "Private synthetic reflection", smaller: "Small step" } });
  return { date, tomorrow, habits, goal, milestone, reward };
}
