import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyState } from "../src/data/initialState.ts";
import { validateState, parseStoredState } from "../src/data/storedState.ts";
import { createBackup, previewRestore } from "../src/data/backup.ts";
import { applyDomainCommand } from "../src/domain/commands.ts";
import { isPrayerExcluded, startPause, resumePrayers, alarmTimes } from "../src/lifeModel.ts";
import { pausePoint, prayerMoment, prayerPhase, prayerStreak, prayerTotals, preparationDate, recordPrayer, samplePrayerDay, saveTimetable, weeklyPrayers } from "../src/prayerModel.ts";
import { buildPrayerSchedule } from "../src/prayerSchedule.ts";
import { xpTotal } from "../src/model.ts";

const date = "2026-10-21", next = "2026-10-22";
const at = (clock: string) => Date.parse(`${date}T${clock}:00+05:00`);
function profile() {
  let s = createEmptyState();
  s.onboarded = true; s.timezone = "Asia/Tashkent"; s.prayers.started = date;
  for (const d of [date, next]) s = saveTimetable(s, d, { ...samplePrayerDay(s.timezone), sample: false, source: "Synthetic timetable" });
  s.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  return s;
}
const context = (now: number, timezone = "Asia/Tashkent") => ({ date: prayerMoment({ ...profile(), timezone }, new Date(now)).date, now, timezone });

test("clock changes leave unconfirmed prayers unrecorded and saved history explicitly correctable", () => {
  const original = profile(), xp = xpTotal(original);
  for (const clock of ["03:00", "05:30", "12:00", "23:59", "01:00"]) {
    const state = applyDomainCommand(original, { kind: "calendar.refresh" }, context(at(clock)));
    assert.deepEqual(state.prayers.days, original.prayers.days);
    assert.deepEqual(prayerTotals(state), prayerTotals(original)); assert.equal(xpTotal(state), xp);
  }
  const recorded = applyDomainCommand(original, { kind: "prayer.record", date, prayer: "fajr", check: "missed" }, context(at("12:00")));
  const corrected = applyDomainCommand(recorded, { kind: "prayer.record", date, prayer: "fajr", check: "on_time" }, context(at("03:00")));
  assert.equal(corrected.prayers.days[date].entries.fajr.check, "on_time");
  assert.equal(corrected.prayers.days[date].entries.fajr.performedAt, undefined);
  const undone = applyDomainCommand(corrected, { kind: "prayer.record", date, prayer: "fajr", check: null }, context(at("03:00")));
  assert.equal(undone.prayers.days[date].entries.fajr.check, undefined);
  assert.equal(undone.prayers.days[date].entries.fajr.recordedAt, undefined);
  assert.equal(xpTotal(undone), xp); assert.deepEqual(original.prayers.days, undone.prayers.days);
  assert.strictEqual(recordPrayer(original, date, "fajr", "on_time", prayerMoment(original, new Date(at("03:00")))), original);
});

test("a saved record remains visible in its week after the device clock goes to yesterday", () => {
  const s = profile(); s.prayers.days[next].entries.fajr.check = "on_time";
  const week = weeklyPrayers(s, date, prayerMoment(s, new Date(at("00:00"))));
  assert.equal(week.on_time, 1); assert.equal(prayerTotals(s).onTime, 1);
});

test("independent streaks use saved UTC windows across travel and repeated DST clocks", () => {
  let s = profile(); s.timezone = "UTC";
  s = saveTimetable(s, date, { ...samplePrayerDay("America/New_York"), sample: false, source: "Synthetic travel" });
  const beforeEnd = prayerMoment(s, new Date(`${date}T09:30:00Z`));
  assert.equal(prayerPhase(s, date, "fajr", beforeEnd), "open");
  assert.equal(prayerStreak(s, "fajr", beforeEnd).pending, false);
  assert.equal(prayerStreak(s, "fajr", prayerMoment(s, new Date(`${date}T10:40:00Z`))).pending, true);
  const folded = "2026-11-01";
  s.prayers.started = folded;
  const day = { ...samplePrayerDay("America/New_York"), sample: false, source: "Synthetic DST" };
  day.entries.fajr = { begins: "00:30", target: "01:00", ends: "01:30" };
  s = saveTimetable(s, folded, day);
  assert.equal(prayerPhase(s, folded, "fajr", prayerMoment(s, new Date(`${folded}T06:15:00Z`))), "unconfirmed");
  assert.equal(prayerStreak(s, "fajr", prayerMoment(s, new Date(`${folded}T06:15:00Z`))).pending, true);
});

test("private pause across midnight holds independent streaks, retains records and earlier gaps", () => {
  let s = profile(); s.prayers.days[date].entries.dhuhr.check = "on_time";
  assert.deepEqual(pausePoint(s, prayerMoment(s, new Date(at("13:00")))), { date, prayer: "dhuhr" });
  const history = structuredClone(s.prayers.days), xp = xpTotal(s);
  s = startPause(s, date, "asr", "synthetic-pause");
  s = resumePrayers(s, next, "dhuhr", true);
  const moment = prayerMoment(s, new Date(`${next}T13:00:00+05:00`));
  for (const [d, id] of [[date, "asr"], [date, "maghrib"], [date, "isha"], [next, "fajr"]] as const) assert.equal(isPrayerExcluded(s, d, id), true);
  assert.equal(isPrayerExcluded(s, next, "dhuhr"), false);
  assert.equal(prayerStreak(s, "fajr", moment).pending, true);
  assert.equal(prayerStreak(s, "asr", moment).current, 0);
  assert.equal(prayerStreak(s, "dhuhr", moment).confirmed, 1);
  assert.deepEqual(s.prayers.days, history); assert.equal(xpTotal(s), xp);
  assert.ok(!buildPrayerSchedule(s, at("00:00")).some(e => (e.date === date && ["asr", "maghrib", "isha"].includes(e.prayer)) || (e.date === next && e.prayer === "fajr")));
  const restored = parseStoredState(JSON.stringify(s)); validateState(restored); assert.deepEqual(restored.life.pauses, s.life.pauses);
});

test("resume cannot erase a pause by selecting a point before it started", () => {
  const s = startPause(profile(), next, "asr", "synthetic-pause");
  assert.strictEqual(resumePrayers(s, date, "isha"), s);
  assert.throws(() => applyDomainCommand(s, { kind: "prayer.resume", date, prayer: "isha", includeCurrent: true }, context(Date.parse(`${next}T19:00:00+05:00`))));
  for (const invalid of ["2026-10-20", "2026-10-23"]) assert.throws(() => applyDomainCommand(profile(), { kind: "prayer.pause", date: invalid, prayer: "fajr", pauseId: "invalid-pause" }, context(at("12:00"))));
  const included = resumePrayers(s, next, "asr", true);
  assert.equal(included.life.pauses.length, 0);
  const excluded = resumePrayers(s, next, "asr", false);
  assert.equal(isPrayerExcluded(excluded, next, "asr"), true);
});

test("Undo during a pause excludes only the selected prayer and never restores its reminders", () => {
  let s = profile(); s.prayers.days[date].entries.asr.check = "on_time";
  s = startPause(s, date, "asr", "synthetic-pause");
  const corrected = recordPrayer(s, date, "asr", "later", prayerMoment(s, new Date(at("20:00"))));
  assert.equal(corrected.prayers.days[date].entries.asr.check, "later");
  const undone = recordPrayer(corrected, date, "asr", null, prayerMoment(s, new Date(at("20:00"))));
  assert.equal(prayerPhase(undone, date, "asr", prayerMoment(s, new Date(at("20:00")))), "paused");
  assert.ok(!buildPrayerSchedule(undone, at("00:00")).some(e => e.prayer === "asr"));
});

test("dated Fajr enable and backup choices survive later plan edits and backup round trip", async () => {
  let s = profile(); const plan = { ...s.prayers.fajr, wakeLead: 10, backupMinutes: 3, enabled: true };
  s = applyDomainCommand(s, { kind: "fajr.plan", date, plan, backupEnabled: true }, context(at("00:00")));
  s = applyDomainCommand(s, { kind: "fajr.plan", date: next, plan: { ...plan, enabled: false, wakeLead: 30 }, backupEnabled: false }, context(at("00:00")));
  const events = buildPrayerSchedule(s, at("00:00"));
  assert.equal(events.filter(e => e.date === date && ["wake", "backup"].includes(e.kind)).length, 2);
  assert.equal(events.filter(e => e.date === next && ["wake", "backup"].includes(e.kind)).length, 0);
  assert.equal(s.prayers.prepared[date].backupEnabled, true);
  assert.equal(s.prayers.prepared[next].backupEnabled, false);
  const snapshot = { state: s, archives: [], revision: 1 };
  const backup = await createBackup(snapshot); const restored = await previewRestore(backup, snapshot);
  assert.deepEqual(restored.content.personal.prayers.prepared, s.prayers.prepared);
  assert.deepEqual(s.prayers.days, profile().prayers.days); assert.equal(xpTotal(s), 0);
});

test("Fajr preview commands cannot overwrite a live acknowledgment", () => {
  let s = profile(); const before = structuredClone(s.prayers.days);
  s = applyDomainCommand(s, { kind: "fajr.acknowledge", date }, context(at("05:00")));
  s = applyDomainCommand(s, { kind: "fajr.alarm", alarm: { date, stage: "ringing", backup: true } }, context(at("05:01")));
  assert.equal(s.life.alarm?.stage, "awake");
  assert.deepEqual(s.life.delivery?.acknowledgedFajr, [date]);
  assert.ok(!buildPrayerSchedule(s, at("00:00")).some(e => e.date === date && ["wake", "backup"].includes(e.kind)));
  assert.equal(buildPrayerSchedule(s, at("00:00")).some(e => e.date === next && e.kind === "wake"), true);
  assert.deepEqual(s.prayers.days, before); assert.equal(xpTotal(s), 0);
});

test("dated Fajr draft survives reload and portable backup with its original date", async () => {
  const s = profile(), draft = { ...s.prayers.fajr, date, backupEnabled: true, message: "My synthetic evening note" };
  const saved = applyDomainCommand(s, { kind: "draft.save", key: "fajr-plan", value: draft }, context(at("23:59")));
  const snapshot = { state: saved, archives: [], revision: 1 };
  const backup = await createBackup(snapshot); const restored = await previewRestore(backup, snapshot);
  assert.deepEqual(restored.content.personal.life.drafts["fajr-plan"], draft);
});

test("Fajr planning and wake clocks use absolute subtraction across a repeated hour", () => {
  let s = profile(); s.timezone = "America/New_York"; const folded = "2026-11-01";
  const day = { ...samplePrayerDay(s.timezone), sample: false, source: "Synthetic DST" };
  day.entries.fajr = { begins: "02:10", target: "02:10", ends: "03:30" };
  s = saveTimetable(s, folded, day); s.prayers.fajr.wakeLead = 90;
  assert.equal(alarmTimes(s, folded)?.wake, "01:40");
  assert.equal(preparationDate(s, prayerMoment(s, new Date(`${folded}T06:50:00Z`))), folded);
  // A stored second occurrence remains authoritative after travel / a clock correction.
  s.prayers.days[folded].entries.fajr = { ...day.entries.fajr, begins: "01:30", target: "01:30", beginsAt: `${folded}T06:30:00.000Z`, targetAt: `${folded}T06:30:00.000Z`, endsAt: `${folded}T08:30:00.000Z` };
  assert.equal(preparationDate(s, prayerMoment(s, new Date(`${folded}T05:45:00Z`))), folded);
});

test("a rejected prayer record cannot finish a work break or lose the return note", () => {
  let s = profile(); s = applyDomainCommand(s, { kind: "work.begin", date, prayer: "asr" }, context(at("12:00")));
  s = applyDomainCommand(s, { kind: "work.note", date, prayer: "asr", note: "Run the synthetic tests" }, context(at("12:00")));
  s = applyDomainCommand(s, { kind: "prayer.record", date, prayer: "asr", check: "on_time", returnToWork: "always" }, context(at("12:00")));
  assert.equal(s.prayers.work?.stage, "save"); assert.equal(s.prayers.work?.note, "Run the synthetic tests");
  assert.equal(s.prayers.days[date].entries.asr.check, undefined); assert.equal(xpTotal(s), 0);
});
