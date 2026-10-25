import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createEmptyState } from "../src/data/initialState";
import { validateState } from "../src/data/storedState";
import { projectBackup } from "../src/data/backupProjection";
import { applyDomainCommand } from "../src/domain/commands";
import { manualPrayerWindow, wallTimeInstant } from "../src/domain/zonedTime";
import { calculatePrayerDay, dateInZone, defaultCalculation, LOCATIONS, METHODS, refreshCalculatedPrayers, timeInZone, useCalculatedPrayers, zoneAt, type CalculationSettings } from "../src/prayerCalculation";
import { PRAYERS, getCurrentPrayerDay, getPrayerDay, nextPrayer, prayerDateAdd, prayerMoment, prayerPhase, prayerProminence, prayerStreak, recordPrayer, samplePrayerDay, saveTimetable, validateTimetable, type PrayerId } from "../src/prayerModel";
import { buildPrayerSchedule } from "../src/prayerSchedule";
import { xpTotal } from "../src/model";

const offsets = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
const date = "2026-10-21", now = Date.parse(`${date}T00:00:00+05:00`);
const clock = { date, now, timezone: "Asia/Tashkent" };
const live = () => useCalculatedPrayers(createEmptyState(), defaultCalculation(), offsets, now);
type Reference = { name: string; settings: CalculationSettings; varianceMinutes: number; times: ({ date: string; sunrise: string } & Record<PrayerId, string>)[] };
const references: { cases: Reference[] } = JSON.parse(readFileSync(new URL("./fixtures/prayer-references.json", import.meta.url), "utf8"));
for (const reference of references.cases) {
  test(`published Adhan reference: ${reference.name} (${reference.times.length} dates)`, () => {
    for (const row of reference.times) {
      const day = calculatePrayerDay(row.date, reference.settings, offsets);
      for (const key of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const) {
        const actual = key === "sunrise" ? Date.parse(day.entries.fajr.endsAt!) : Date.parse(day.entries[key].beginsAt!);
        const expected = wallTimeInstant(row.date, row[key], reference.settings.timezone);
        assert.notEqual(expected, null);
        assert.ok(Math.abs(actual - expected!) <= reference.varianceMinutes * 60000, `${reference.name} ${row.date} ${key}: ${timeInZone(actual, day.timezone)} versus ${row[key]}`);
      }
    }
  });
}

test("all offered methods, Asr conventions and high-latitude rules preserve starts and bound planned offsets", () => {
  const farNorth = { label: "Oslo", latitude: 59.9139, longitude: 10.7522, timezone: "Europe/Oslo" };
  for (const method of METHODS) for (const madhab of ["Hanafi", "Shafi"] as const) for (const highLatitude of ["MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle"] as const) {
    const settings = { ...defaultCalculation(), ...farNorth, method, madhab, highLatitude };
    const day = calculatePrayerDay("2026-05-15", settings, offsets);
    const planned = calculatePrayerDay("2026-05-15", settings, { fajr: 120, dhuhr: 120, asr: 120, maghrib: 120, isha: 120 });
    const tomorrow = calculatePrayerDay("2026-05-16", settings, offsets);
    assert.equal(day.entries.isha.endsAt, tomorrow.entries.fajr.beginsAt);
    for (const { id } of PRAYERS) {
      assert.equal(day.entries[id].beginsAt, planned.entries[id].beginsAt);
      assert.equal(day.entries[id].endsAt, planned.entries[id].endsAt);
      assert.ok(Date.parse(planned.entries[id].targetAt!) >= Date.parse(planned.entries[id].beginsAt!));
      assert.ok(Date.parse(planned.entries[id].targetAt!) <= Date.parse(planned.entries[id].endsAt!) - 60000);
    }
  }
});

test("DST spring/fall transitions and Lord Howe's half-hour change keep solar instants continuous", () => {
  const cases = [
    ["London", 51.5074, -0.1278, "Europe/London", "2026-03-28", 60],
    ["London", 51.5074, -0.1278, "Europe/London", "2026-10-24", -60],
    ["New York", 40.7128, -74.006, "America/New_York", "2026-03-07", 60],
    ["New York", 40.7128, -74.006, "America/New_York", "2026-10-31", -60],
    ["Sydney", -33.8688, 151.2093, "Australia/Sydney", "2026-10-03", 60],
    ["Sydney", -33.8688, 151.2093, "Australia/Sydney", "2026-04-04", -60],
    ["Lord Howe", -31.55, 159.08, "Australia/Lord_Howe", "2026-04-04", -30],
  ] as const;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  for (const [label, latitude, longitude, timezone, beforeDate, shift] of cases) {
    const settings = { ...defaultCalculation(), label, latitude, longitude, timezone };
    const before = calculatePrayerDay(beforeDate, settings, offsets).entries.dhuhr;
    const after = calculatePrayerDay(prayerDateAdd(beforeDate, 1), settings, offsets).entries.dhuhr;
    assert.ok(Math.abs(Date.parse(after.beginsAt!) - Date.parse(before.beginsAt!) - 86400000) < 180000, label);
    assert.ok(Math.abs(minutes(after.begins) - minutes(before.begins) - shift) < 3, label);
  }
});

test("fractional zones, date-line locations and launch countries use the selected civil date", () => {
  const cases = [
    ["Kathmandu", 27.7172, 85.324, "Asia/Kathmandu", "05:45"],
    ["Chatham", -43.95, -176.55, "Pacific/Chatham", "13:45"],
    ["Kiritimati", 1.8721, -157.4278, "Pacific/Kiritimati", "14:00"],
    ["Tashkent", 41.2995, 69.2401, "Asia/Tashkent", "05:00"],
    ["Samarkand", 39.6542, 66.9597, "Asia/Samarkand", "05:00"],
    ["Almaty", 43.238949, 76.889709, "Asia/Almaty", "05:00"],
    ["Astana", 51.1694, 71.4491, "Asia/Almaty", "05:00"],
  ] as const;
  for (const [label, latitude, longitude, timezone, midnightUTCClock] of cases) {
    const day = calculatePrayerDay(date, { ...defaultCalculation(), label, latitude, longitude, timezone }, offsets);
    assert.equal(dateInZone(Date.parse(day.entries.dhuhr.beginsAt!), timezone), date);
    assert.equal(timeInZone(Date.parse(`${date}T00:00:00Z`), timezone), midnightUTCClock);
    assert.equal(day.sample, false);
    assert.equal(zoneAt(latitude, longitude), timezone === "Asia/Kathmandu" ? "Asia/Kathmandu" : timezone);
  }
  assert.equal(timeInZone(Date.parse("2024-02-29T12:00:00Z"), "Asia/Almaty"), "18:00");
  assert.equal(timeInZone(Date.parse("2024-03-01T12:00:00Z"), "Asia/Almaty"), "17:00");
});

test("calculations and dated manual resolution are independent of five host time zones", () => {
  const script = `import {calculatePrayerDay,defaultCalculation} from './src/prayerCalculation.ts'; import {wallTimeInstant} from './src/domain/zonedTime.ts'; console.log(JSON.stringify([calculatePrayerDay('2026-03-08', {...defaultCalculation(),latitude:40.7128,longitude:-74.006,timezone:'America/New_York'},${JSON.stringify(offsets)}),wallTimeInstant('2026-10-21','00:30','Asia/Kathmandu')]));`;
  const results = ["UTC", "Pacific/Honolulu", "Asia/Tokyo", "Pacific/Apia", "Asia/Kathmandu"].map(TZ => execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: process.cwd(), env: { ...process.env, TZ }, encoding: "utf8" }));
  assert.ok(results.every(result => result === results[0]));
});

test("startup, resume and rollover extend 30 dates without pruning history or changing manual/checked snapshots", () => {
  const s = live(), original = structuredClone(s);
  assert.equal(Object.keys(s.prayers.days).length, 30);
  assert.ok(s.prayers.days[prayerDateAdd(date, 29)]);
  assert.equal(s.prayers.days[prayerDateAdd(date, 30)], undefined);
  assert.strictEqual(refreshCalculatedPrayers(s, now), s);
  s.prayers.days[date].entries.fajr.check = "on_time";
  const checked = structuredClone(s.prayers.days[date].entries.fajr);
  const manualDate = prayerDateAdd(date, 1);
  const withManual = saveTimetable(s, manualDate, { ...samplePrayerDay(s.timezone), sample: false, source: "Trusted mosque" });
  const manual = structuredClone(withManual.prayers.days[manualDate]);
  const moved = useCalculatedPrayers(withManual, { ...defaultCalculation(), ...LOCATIONS.find(l => l.label === "New York")!, method: "NorthAmerica", madhab: "Shafi" }, offsets, now);
  assert.deepEqual(moved.prayers.days[date].entries.fajr, checked);
  assert.deepEqual(moved.prayers.days[manualDate], manual);
  const later = refreshCalculatedPrayers(moved, now + 35 * 86400000);
  assert.deepEqual(later.prayers.days[manualDate], manual);
  assert.deepEqual(later.prayers.days[date].entries.fajr, checked);
  assert.ok(later.prayers.days[prayerDateAdd(dateInZone(now + 35 * 86400000, moved.timezone), 29)]);
  assert.equal(xpTotal(later), xpTotal(s));
  assert.deepEqual(original.prayers.days[date].entries.fajr.check, undefined);
  validateState(later);
});

test("manual edits replace stale calculated timestamps and stay manual through settings changes", () => {
  const s = live(); s.prayers.days[date].entries.fajr.check = "on_time";
  const checked = structuredClone(s.prayers.days[date].entries.fajr);
  const draft = structuredClone(s.prayers.days[date]);
  draft.source = "  Local mosque  "; draft.entries.asr.target = "16:00";
  const saved = applyDomainCommand(s, { kind: "prayer.timetable", date, day: draft, preferences: s.prayers.preferences }, clock);
  const day = saved.prayers.days[date];
  assert.equal(day.calculationKey, undefined);
  assert.equal(day.source, "Local mosque");
  assert.deepEqual(day.entries.fajr, checked);
  assert.equal(day.entries.asr.targetAt, "2026-10-21T11:00:00.000Z");
  assert.notEqual(day.entries.asr.targetAt, draft.entries.asr.targetAt);
  const changed = useCalculatedPrayers(saved, { ...defaultCalculation(), madhab: "Shafi" }, { ...offsets, asr: 15 }, now);
  assert.deepEqual(changed.prayers.days[date], day);
  assert.deepEqual(s.prayers.days[date].entries.fajr, checked);
  validateState(changed);
});

test("manual dates do not repeat, change profile timezone or manufacture caller-supplied prayer records", () => {
  const s = createEmptyState(), day = { ...samplePrayerDay("Asia/Kathmandu"), sample: false, source: "Travel mosque" };
  day.entries.fajr.check = "on_time"; day.entries.fajr.recordedAt = new Date(now).toISOString();
  const saved = saveTimetable(s, date, day);
  assert.equal(saved.timezone, s.timezone);
  assert.deepEqual(Object.keys(saved.prayers.days), [date]);
  assert.equal(saved.prayers.days[date].entries.fajr.check, undefined);
  assert.equal(saved.prayers.days[date].entries.fajr.recordedAt, undefined);
  assert.equal(saved.prayers.days[date].entries.fajr.beginsAt, "2026-10-20T23:35:00.000Z");
  assert.equal(xpTotal(saved), 0);
});

test("manual gaps, skipped dates, invalid dates/zones and overnight DST gaps fail without a partial alert plan", () => {
  const s = live(); s.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  const day = { ...samplePrayerDay("America/New_York"), sample: false, source: "Trusted timetable" };
  day.entries.fajr.begins = day.entries.fajr.target = "02:30";
  assert.ok(validateTimetable(day, "2026-03-08"));
  assert.strictEqual(saveTimetable(s, "2026-03-08", day), s);
  assert.throws(() => applyDomainCommand(s, { kind: "prayer.timetable", date: "2026-03-08", day, preferences: s.prayers.preferences }, clock));
  s.prayers.days["2026-03-08"] = day; // Safe synthetic legacy data: gap was previously accepted.
  assert.ok(!buildPrayerSchedule(s, Date.parse("2026-03-08T00:00:00Z")).some(e => e.date === "2026-03-08"));
  day.entries.fajr.begins = day.entries.fajr.target = "05:20";
  day.entries.isha.target = "02:30"; day.entries.isha.ends = "04:00";
  assert.ok(validateTimetable(day, "2026-03-07"));
  assert.equal(wallTimeInstant("2011-12-30", "12:00", "Pacific/Apia"), null);
  for (const invalid of ["2026-02-30", "2026-13-01", "not-a-date"]) assert.equal(wallTimeInstant(invalid, "12:00", "UTC"), null);
  assert.equal(wallTimeInstant(date, "12:00", "Not/AZone"), null);
});

test("repeated manual clocks choose the first instant and overnight windows retain their original date", () => {
  assert.equal(wallTimeInstant("2026-11-01", "01:30", "America/New_York"), Date.parse("2026-11-01T05:30:00Z"));
  assert.equal(wallTimeInstant("2026-04-05", "01:45", "Australia/Lord_Howe"), Date.parse("2026-04-04T14:45:00Z"));
  assert.equal(wallTimeInstant("2026-10-04", "02:15", "Australia/Lord_Howe"), null);
  const window = manualPrayerWindow("2026-10-31", { begins: "19:00", target: "00:15", ends: "05:00" }, "America/New_York");
  assert.deepEqual(window, { start: Date.parse("2026-10-31T23:00:00Z"), target: Date.parse("2026-11-01T04:15:00Z"), end: Date.parse("2026-11-01T10:00:00Z") });
});

test("unavailable solar events never produce sample substitutes or schedule an unavailable date", () => {
  const polar = { ...defaultCalculation(), label: "Longyearbyen", latitude: 78.2232, longitude: 15.6469, timezone: "Arctic/Longyearbyen" };
  for (const day of ["2026-06-21", "2026-12-21"]) assert.throws(() => calculatePrayerDay(day, polar, offsets), /unavailable/);
  for (const values of [{ latitude: NaN }, { longitude: 181 }, { latitude: -91 }, { timezone: "Invalid/Zone" }]) assert.throws(() => calculatePrayerDay(date, { ...defaultCalculation(), ...values }, offsets));
  const s = live(), unchanged = structuredClone(s);
  assert.throws(() => useCalculatedPrayers(s, polar, offsets, Date.parse("2026-06-21T12:00Z")), /unavailable/);
  assert.deepEqual(s, unchanged);
  const winter = useCalculatedPrayers(s, polar, offsets, Date.parse("2026-04-01T12:00Z"));
  winter.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  const resumed = refreshCalculatedPrayers(winter, Date.parse("2026-06-21T12:00Z"));
  assert.equal(resumed.prayers.days["2026-06-21"], undefined);
  assert.ok(!buildPrayerSchedule(resumed, Date.parse("2026-06-21T00:00Z")).some(e => e.date === "2026-06-21"));
  assert.ok(Object.values(resumed.prayers.days).every(d => !d.sample));
});

test("device timezone observation and explicit review survive replay without changing prayer settings/history", () => {
  const s = live(), originalDays = structuredClone(s.prayers.days);
  const observed = applyDomainCommand(s, { kind: "calendar.refresh", deviceTimezone: "Asia/Tashkent" }, clock);
  assert.deepEqual(observed.life.deviceTimezone, { observed: "Asia/Tashkent", reviewed: "Asia/Tashkent" });
  const travelled = applyDomainCommand(observed, { kind: "calendar.refresh", deviceTimezone: "Europe/London" }, clock);
  assert.equal(travelled.timezone, "Asia/Tashkent");
  assert.deepEqual(travelled.life.calculation, s.life.calculation);
  assert.deepEqual(travelled.prayers.days, originalDays);
  assert.notEqual(travelled.life.deviceTimezone!.observed, travelled.life.deviceTimezone!.reviewed);
  const reviewed = applyDomainCommand(travelled, { kind: "prayer.location-reviewed", timezone: "Europe/London" }, clock);
  assert.deepEqual(reviewed.prayers.days, originalDays);
  assert.deepEqual(reviewed.life.deviceTimezone, { observed: "Europe/London", reviewed: "Europe/London" });
  assert.deepEqual(applyDomainCommand(reviewed, { kind: "prayer.location-reviewed", timezone: "Europe/London" }, clock), reviewed);
  assert.throws(() => applyDomainCommand(reviewed, { kind: "prayer.location-reviewed", timezone: "Asia/Tokyo" }, clock));
  validateState(reviewed);
  assert.equal(projectBackup(reviewed).personal.life.deviceTimezone, undefined);
});

test("an obsolete calculated day remains saved as history while today's view and alerts require the current settings", () => {
  const s = live(), prior = structuredClone(s.prayers.days[date]);
  s.prayers.days[date].calculationKey = "former-location";
  s.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  assert.equal(getCurrentPrayerDay(s, date), undefined);
  assert.equal(nextPrayer(s, { date, minute: 0 }), null);
  assert.equal(getPrayerDay(s, date)?.entries.fajr.beginsAt, prior.entries.fajr.beginsAt);
  assert.ok(!buildPrayerSchedule(s, now).some(e => e.date === date));
  assert.ok(buildPrayerSchedule(s, now).some(e => e.date === prayerDateAdd(date, 1)));
});

test("a preserved manual travel date uses its instants for status, recording and preparation", () => {
  const s = createEmptyState(); s.timezone = "Europe/London"; s.prayers.started = date;
  const day = { ...samplePrayerDay("Asia/Tashkent"), source: "Trusted travel timetable", sample: false };
  day.entries.fajr = { begins: "06:00", target: "06:10", ends: "06:30" };
  const saved = saveTimetable(s, date, day);
  const at = Date.parse("2026-10-21T01:15:00Z"), moment = prayerMoment(saved, new Date(at));
  assert.equal(moment.minute, 135); // 02:15 in London, 06:15 at the saved mosque.
  assert.equal(prayerPhase(saved, date, "fajr", moment), "open");
  assert.equal(prayerProminence(saved, moment).level, "due");
  assert.strictEqual(recordPrayer(saved, date, "fajr", "missed", moment, at), saved);
  const recorded = recordPrayer(saved, date, "fajr", "on_time", moment, at);
  assert.equal(recorded.prayers.days[date].entries.fajr.performedAt, "06:15");
  assert.equal(recorded.prayers.days[date].entries.fajr.recordedAt, "2026-10-21T01:15:00.000Z");
  assert.equal(xpTotal(recorded), xpTotal(saved));
  assert.equal(prayerPhase(saved, date, "fajr", prayerMoment(saved, new Date("2026-10-21T01:35Z"))), "unconfirmed");
});

test("DST's second repeated hour does not make an already-open manual prayer upcoming again", () => {
  const s = createEmptyState(); s.timezone = "America/New_York"; s.prayers.started = "2026-11-01";
  const day = { ...samplePrayerDay(s.timezone), sample: false, source: "DST timetable" };
  day.entries.fajr = { begins: "01:30", target: "01:45", ends: "02:30" };
  const saved = saveTimetable(s, "2026-11-01", day);
  const moment = prayerMoment(saved, new Date("2026-11-01T06:15Z"));
  assert.equal(moment.minute, 75);
  assert.equal(prayerPhase(saved, "2026-11-01", "fajr", moment), "open");
  assert.equal(prayerProminence(saved, moment).level, "due");
});

test("recognizable legacy manual edits retain their exact snapshots and use authored clocks after travel", () => {
  const s = live(), legacy = s.prayers.days[date];
  legacy.source = "Existing mosque timetable";
  legacy.entries.asr.target = "16:00"; // Pre-PRAY-01 editor retained the old key/targetAt.
  const snapshot = structuredClone(legacy);
  const moved = useCalculatedPrayers(s, { ...defaultCalculation(), ...LOCATIONS.find(l => l.label === "London")! }, offsets, now);
  assert.deepEqual(moved.prayers.days[date], snapshot);
  moved.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  const due = buildPrayerSchedule(moved, now).find(e => e.date === date && e.prayer === "asr" && e.kind === "due");
  assert.equal(due?.at, Date.parse("2026-10-21T11:00:00Z"));
  assert.deepEqual(s.prayers.days[date], snapshot);
  const clockOnly = live(); clockOnly.prayers.days[date].entries.asr.target = "16:00";
  const unchanged = structuredClone(clockOnly.prayers.days[date]);
  assert.deepEqual(useCalculatedPrayers(clockOnly, { ...defaultCalculation(), madhab: "Shafi" }, offsets, now).prayers.days[date], unchanged);
  // Without an authored source, a clock-only edit could also be timezone-data drift.
  assert.equal(getCurrentPrayerDay(clockOnly, date), undefined);
  clockOnly.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  assert.ok(!buildPrayerSchedule(clockOnly, now).some(e => e.date === date));
  const tomorrow = prayerDateAdd(date, 1), later = { date: tomorrow, minute: 1200 };
  clockOnly.prayers.started = date; clockOnly.prayers.days[tomorrow].entries.asr.check = "on_time";
  assert.equal(prayerPhase(clockOnly, date, "asr", later), "unconfirmed");
  assert.equal(prayerStreak(clockOnly, "asr", later).pending, true);
  const reviewed = saveTimetable(clockOnly, date, unchanged);
  assert.ok(getCurrentPrayerDay(reviewed, date));
  assert.equal(buildPrayerSchedule(reviewed, now).find(e => e.date === date && e.prayer === "asr" && e.kind === "due")?.at, Date.parse("2026-10-21T11:00Z"));
});

test("first setup west of the device date keeps the selected current prayer date recordable", () => {
  const at = Date.parse("2026-10-21T01:00Z"), initial = createEmptyState();
  initial.timezone = "Asia/Tashkent"; initial.prayers.started = "2026-10-21";
  const settings = { ...defaultCalculation(), ...LOCATIONS.find(l => l.label === "New York")! };
  const s = useCalculatedPrayers(initial, settings, offsets, at);
  assert.equal(prayerMoment(s, new Date(at)).date, "2026-10-20");
  assert.equal(s.prayers.started, "2026-10-20");
  const recorded = recordPrayer(s, "2026-10-20", "isha", "on_time", prayerMoment(s, new Date(at)), at);
  assert.equal(recorded.prayers.days["2026-10-20"].entries.isha.check, "on_time");
  assert.equal(xpTotal(recorded), 0);
  assert.equal(initial.prayers.started, "2026-10-21");
});

test("Undo keeps an original checked UTC window when a manual date's timezone was edited", () => {
  const s = live(); s.prayers.days[date].entries.fajr.check = "on_time";
  const original = structuredClone(s.prayers.days[date].entries.fajr);
  const draft = { ...structuredClone(s.prayers.days[date]), timezone: "Europe/London", source: "Edited manual date" };
  const saved = saveTimetable(s, date, draft), at = Date.parse("2026-10-21T01:00Z");
  const corrected = recordPrayer(saved, date, "fajr", null, prayerMoment(saved, new Date(at)), at);
  assert.equal(corrected.prayers.days[date].entries.fajr.check, undefined);
  assert.equal(corrected.prayers.days[date].entries.fajr.beginsAt, original.beginsAt);
  assert.equal(prayerPhase(corrected, date, "fajr", prayerMoment(corrected, new Date(at))), "open");
  corrected.life.delivery = { enabled: true, sound: false, acknowledgedFajr: [] };
  const due = buildPrayerSchedule(corrected, now).find(e => e.date === date && e.prayer === "fajr" && e.kind === "due");
  assert.equal(due?.at, Date.parse(original.targetAt!));
});
