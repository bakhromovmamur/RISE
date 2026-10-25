import { makeFixture } from "../src/review/fixtures.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { xpTotal, type State } from "../src/model.ts";
import {
  beginWorkBreak, ensurePrayerDays, getPrayerDay, makePrayerState, migratePrayers,
  nextPrayer, prayerMoment, prayerPhase, prayerScene, prayerStreak, prayerTotals,
  preparationDate, recordPrayer, samplePrayerDay, saveTimetable, startWrapUp,
  validateTimetable, wrapRemaining,
} from "../src/prayerModel.ts";

const date = "2026-10-19";
test("sample prayer history has independent prayer streaks and does not change habit XP", () => {
  const s = makeFixture();
  assert.deepEqual(prayerTotals(s), { onTime: 33, later: 3, missed: 1, completeDays: 3 });
  assert.equal(prayerStreak(s, "fajr").current, 3);
  assert.equal(prayerStreak(s, "dhuhr").current, 8);
  assert.equal(prayerStreak(s, "asr").current, 3);
  assert.equal(prayerStreak(s, "all").current, 2);
  assert.equal(xpTotal(s), 240);
  assert.ok(Object.values(s.prayers.days).every((d) => d.sample));
});
test("on-time records are idempotent, undoable and never award habit XP", () => {
  const original = makeFixture();
  const s = recordPrayer(original, date, "asr", "on_time");
  assert.equal(prayerTotals(s).onTime, 34);
  assert.equal(prayerStreak(s, "asr").current, 4);
  assert.equal(xpTotal(s), 240);
  assert.strictEqual(recordPrayer(s, date, "asr", "on_time"), s);
  const undone = recordPrayer(s, date, "asr", null);
  assert.equal(prayerTotals(undone).onTime, 33);
  assert.equal(undone.prayers.days[date].entries.asr.performedAt, undefined);
  assert.deepEqual(original.days, s.days);
});
test("future records are blocked; later and missed are blocked until the window ends", () => {
  const s = makeFixture();
  assert.strictEqual(recordPrayer(s, date, "maghrib", "on_time"), s);
  assert.strictEqual(recordPrayer(s, date, "asr", "missed"), s);
  assert.strictEqual(recordPrayer(s, date, "asr", "later"), s);
  assert.equal(prayerPhase(s, date, "asr"), "open");
});
test("a late check-in can truthfully report an earlier on-time prayer", () => {
  const s = makeFixture(), evening = { date, minute: 19 * 60 };
  const logged = recordPrayer(s, date, "asr", "on_time", evening);
  assert.equal(logged.prayers.days[date].entries.asr.check, "on_time");
  assert.equal(logged.prayers.days[date].entries.asr.performedAt, undefined);
  assert.ok(logged.prayers.days[date].entries.asr.recordedAt);
  const missed = recordPrayer(s, date, "asr", "missed", evening);
  assert.equal(prayerStreak(missed, "asr", evening).current, 0);
  assert.equal(prayerStreak(missed, "dhuhr", evening).current, 8);
  assert.equal(prayerStreak(missed, "all", evening).current, 0);
  assert.equal(prayerTotals(missed).onTime, 33);
});
test("unknown records leave a pending streak without silently bridging or marking missed", () => {
  const s = prayerScene(makeFixture(), "gap");
  assert.equal(prayerPhase(s, "2026-10-18", "fajr"), "unconfirmed");
  assert.equal(prayerStreak(s, "fajr").current, null);
  assert.equal(prayerStreak(s, "fajr").confirmed, 1);
  assert.equal(prayerStreak(s, "dhuhr").current, 8);
  assert.equal(prayerTotals(s).missed, 1);
  const resolved = recordPrayer(s, "2026-10-18", "fajr", "on_time");
  assert.equal(prayerStreak(resolved, "fajr").current, 3);
});
test("an overnight Isha window belongs to the previous day and remains recordable", () => {
  const s = makeFixture();
  s.prayers.days["2026-10-18"].entries.isha = { begins: "19:00", target: "19:10", ends: "01:00" };
  const now = { date, minute: 30 };
  assert.equal(prayerPhase(s, "2026-10-18", "isha", now), "open");
  assert.equal(nextPrayer(s, now)?.date, "2026-10-18");
  const updated = recordPrayer(s, "2026-10-18", "isha", "on_time", now);
  assert.equal(updated.prayers.days["2026-10-18"].entries.isha.check, "on_time");
  assert.equal(prayerPhase(s, "2026-10-18", "isha", { date, minute: 60 }), "unconfirmed");
});
test("personal mode has no fabricated history or automatic repetition of yesterday's times", () => {
  let s = makeFixture("fresh");
  assert.equal(Object.keys(s.prayers.days).length, 0);
  assert.deepEqual(prayerScene(s, "fresh"), s);
  assert.strictEqual(ensurePrayerDays(s), s);
  assert.equal(getPrayerDay(s, "2026-10-21"), undefined);
  const day = { ...samplePrayerDay(s.timezone), sample: false, source: "My trusted timetable" };
  s = saveTimetable(s, "2026-10-20", day);
  assert.equal(s.prayers.days["2026-10-20"].sample, false);
  assert.equal(getPrayerDay(s, "2026-10-21"), undefined);
});
test("v1 migration preserves habits and only seeds prayer history in demo mode", () => {
  for (const mode of ["demo", "fresh"] as const) {
    const s = makeFixture(mode);
    const legacy = structuredClone(s) as Partial<State>;
    delete legacy.prayers;
    (legacy as { schema: number }).schema = 1;
    const updated = migratePrayers(legacy as State);
    assert.equal(updated.schema, 4);
    assert.deepEqual(updated.days, s.days);
    assert.deepEqual(updated.habits, s.habits);
    assert.equal(xpTotal(updated), xpTotal(s));
    if (mode === "fresh") assert.equal(prayerTotals(updated).onTime, 0);
  }
});
test("timetables validate source, sequence, overlap and targets within windows", () => {
  const day = samplePrayerDay("Asia/Tashkent");
  assert.equal(validateTimetable(day), "");
  for (const change of [
    (d: typeof day) => { d.source = ""; },
    (d: typeof day) => { d.entries.fajr.begins = "25:00"; },
    (d: typeof day) => { d.entries.fajr.target = "04:00"; },
    (d: typeof day) => { d.entries.dhuhr.ends = "17:00"; },
    (d: typeof day) => { d.entries.asr.begins = "12:00"; },
    (d: typeof day) => { d.entries.fajr.ends = "04:00"; },
  ]) {
    const d = structuredClone(day); change(d); assert.ok(validateTimetable(d));
  }
  day.entries.isha = { begins: "19:00", target: "00:10", ends: "01:00" };
  day.entries.maghrib.ends = "19:00";
  assert.equal(validateTimetable(day), "");
});
test("timetable corrections preserve recorded prayer snapshots", () => {
  const s = makeFixture();
  const day = samplePrayerDay(s.timezone);
  day.entries.fajr.begins = "05:25"; day.entries.fajr.target = "05:30";
  day.entries.asr.target = "16:00";
  const next = saveTimetable(s, date, day);
  assert.equal(next.prayers.days[date].entries.fajr.begins, "05:20");
  assert.equal(next.prayers.days[date].entries.asr.target, "16:00");
});
test("wrap-up minute works once, measures real time, and survives navigation and reload", () => {
  let s = beginWorkBreak(makeFixture(), "asr", date);
  s.prayers.work!.note = "Run the login tests.";
  s = startWrapUp(s, 100000);
  assert.equal(wrapRemaining(s.prayers.work!, 125000), 35);
  assert.strictEqual(startWrapUp(s, 130000), s);
  const restored = migratePrayers(JSON.parse(JSON.stringify(s)));
  assert.equal(wrapRemaining(restored.prayers.work!, 160000), 0);
  assert.equal(restored.prayers.work!.note, "Run the login tests.");
  assert.equal(beginWorkBreak(restored, "asr", date).prayers.work!.wrapUsed, true);
  restored.prayers.work!.stage = "returned";
  const reopened = beginWorkBreak(restored, "asr", date);
  assert.equal(reopened.prayers.work!.stage, "save");
  assert.equal(reopened.prayers.work!.wrapUsed, true);
  assert.strictEqual(startWrapUp(reopened, 200000), reopened);
  assert.equal(wrapRemaining(s.prayers.work!, 99999), 60);
  assert.equal(prayerTotals(restored).onTime, 33);
});
test("Fajr preparation attaches to the next morning without adding prayer records", () => {
  const s = makeFixture();
  assert.equal(preparationDate(s), "2026-10-20");
  s.prayers.demoMinute = 5 * 60;
  assert.equal(preparationDate(s), date);
  s.prayers.prepared[date] = { ...s.prayers.fajr };
  assert.equal(prayerTotals(s).onTime, 33);
});
test("personal prayer clock uses its timezone and demo time remains frozen", () => {
  const s = makeFixture("fresh");
  s.timezone = "Asia/Tashkent";
  s.prayers = makePrayerState("fresh", date, s.timezone);
  assert.deepEqual(prayerMoment(s, new Date("2026-10-19T20:30:00Z")), { date: "2026-10-20", minute: 90, instant: Date.parse("2026-10-19T20:30:00Z") });
  assert.deepEqual(prayerMoment(makeFixture(), new Date("2030-01-01T00:00:00Z")), { date, minute: 945 });
});
