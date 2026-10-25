import { makeFixture } from "../src/review/fixtures.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { xpTotal } from "../src/model.ts";
import { startPause, resumePrayers } from "../src/lifeModel.ts";
import { calculatePrayerDay, dateInZone, defaultCalculation, refreshCalculatedPrayers, useCalculatedPrayers, zoneAt, LOCATIONS } from "../src/prayerCalculation.ts";
import { acknowledgeFajr, alertSignature, buildPrayerSchedule, reconcileDeviceAlerts, wallTimeInstant, type PendingAlert, type SchedulePort } from "../src/prayerSchedule.ts";

const date = "2026-10-21", now = Date.parse(`${date}T00:00:00+05:00`);
const offsets = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
function live() {
  const s = useCalculatedPrayers(makeFixture("fresh"), defaultCalculation(), offsets, now);
  s.life.delivery = { enabled: true, sound: true, acknowledgedFajr: [] };
  s.life.backupEnabled = true;
  return s;
}
test("offline calculations produce ordered real instants, sunrise end and daily variation", () => {
  const s = live(), day = s.prayers.days[date];
  assert.equal(Object.keys(s.prayers.days).length, 30);
  assert.equal(day.sample, false);
  assert.equal(day.entries.fajr.ends, day.sunrise);
  const sequence = Object.values(day.entries).map(entry => Date.parse(entry.beginsAt!));
  assert.ok(sequence.every((at, i) => !i || at > sequence[i - 1]));
  assert.notEqual(day.entries.fajr.begins, s.prayers.days["2026-10-24"].entries.fajr.begins);
  assert.ok(Date.parse(day.entries.isha.endsAt!) > Date.parse(`${date}T23:59:00+05:00`));
  assert.strictEqual(refreshCalculatedPrayers(s, now), s);
});
test("Hanafi changes Asr without changing Fajr and manual offsets never move prayer boundaries", () => {
  const base = defaultCalculation();
  const hanafi = calculatePrayerDay(date, base, offsets), shafi = calculatePrayerDay(date, { ...base, madhab: "Shafi" }, { ...offsets, asr: 15 });
  assert.ok(Date.parse(hanafi.entries.asr.beginsAt!) > Date.parse(shafi.entries.asr.beginsAt!));
  assert.equal(hanafi.entries.fajr.beginsAt, shafi.entries.fajr.beginsAt);
  assert.equal(Date.parse(shafi.entries.asr.targetAt!) - Date.parse(shafi.entries.asr.beginsAt!), 15 * 60000);
});
test("DST changes are reflected in civil times without a one-hour shift in the actual sun", () => {
  const london = { ...defaultCalculation(), ...LOCATIONS.find(item => item.label === "London")! };
  const before = calculatePrayerDay("2026-10-24", london, offsets), after = calculatePrayerDay("2026-10-25", london, offsets);
  assert.ok(Math.abs(Date.parse(after.entries.dhuhr.beginsAt!) - Date.parse(before.entries.dhuhr.beginsAt!) - 86400000) < 180000);
  assert.equal(Number(before.entries.dhuhr.begins.slice(0, 2)) - Number(after.entries.dhuhr.begins.slice(0, 2)), 1);
  assert.equal(dateInZone(Date.parse("2026-12-31T20:00Z"), "Asia/Tashkent"), "2027-01-01");
  assert.equal(zoneAt(41.2995, 69.2401), "Asia/Tashkent");
});
test("results do not depend on the phone's time zone", () => {
  const script = `import {calculatePrayerDay,defaultCalculation} from './src/prayerCalculation.ts'; console.log(JSON.stringify(calculatePrayerDay('${date}',defaultCalculation(),${JSON.stringify(offsets)})));`;
  const run = (TZ: string) => execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: process.cwd(), env: { ...process.env, TZ }, encoding: "utf8" });
  assert.equal(run("Pacific/Honolulu"), run("Asia/Tokyo"));
});
test("invalid input and polar-day failures do not fabricate prayer times", () => {
  assert.throws(() => calculatePrayerDay(date, { ...defaultCalculation(), latitude: NaN }, offsets));
  assert.throws(() => calculatePrayerDay(date, { ...defaultCalculation(), timezone: "Not/AZone" }, offsets));
  assert.throws(() => calculatePrayerDay("2026-02-30", defaultCalculation(), offsets));
  assert.throws(() => calculatePrayerDay("2026-06-21", { ...defaultCalculation(), latitude: 78.2232, longitude: 15.6469, timezone: "Arctic/Longyearbyen" }, offsets), /unavailable/);
});
test("location changes preserve checked snapshots and explicitly entered real timetables", () => {
  const s = live(); s.prayers.days[date].entries.fajr.check = "on_time";
  const logged = { ...s.prayers.days[date].entries.fajr };
  const manual = structuredClone(s.prayers.days["2026-10-22"]); delete manual.calculationKey; manual.source = "Local mosque";
  s.prayers.days["2026-10-22"] = manual;
  const updated = useCalculatedPrayers(s, { ...defaultCalculation(), madhab: "Shafi" }, offsets, now);
  assert.deepEqual(updated.prayers.days[date].entries.fajr, logged);
  assert.deepEqual(updated.prayers.days["2026-10-22"], manual);
  assert.equal(xpTotal(updated), xpTotal(s));
});
test("demo dates, sample days and disabled delivery cannot schedule real notifications", () => {
  const s = live();
  assert.ok(buildPrayerSchedule(s, now).length > 0);
  assert.deepEqual(buildPrayerSchedule({ ...s, mode: "demo" }, now), []);
  s.life.delivery!.enabled = false; assert.deepEqual(buildPrayerSchedule(s, now), []);
  s.life.delivery!.enabled = true;
  for (const day of Object.values(s.prayers.days)) day.sample = true;
  assert.deepEqual(buildPrayerSchedule(s, now), []);
});
test("private pauses cancel wake-ups and reminders; resuming restores future alerts", () => {
  const paused = startPause(live(), date, "fajr");
  assert.deepEqual(buildPrayerSchedule(paused, now), []);
  const resumed = resumePrayers(paused, date, "asr", true);
  const day = buildPrayerSchedule(resumed, now).filter(event => event.date === date);
  assert.ok(day.length); assert.ok(day.every(event => ["asr", "maghrib", "isha"].includes(event.prayer)));
});
test("acknowledgment cancels only that day's wake alerts, never records a prayer or XP", () => {
  const s = live(), next = acknowledgeFajr(s, date);
  assert.equal(next.prayers, s.prayers); assert.equal(xpTotal(next), xpTotal(s));
  const events = buildPrayerSchedule(next, now);
  assert.ok(!events.some(event => event.date === date && ["wake", "backup"].includes(event.kind)));
  assert.ok(events.some(event => event.date === date && event.kind === "due" && event.prayer === "fajr"));
  assert.ok(events.some(event => event.date === "2026-10-22" && event.kind === "wake"));
});
test("notification and wake switches are independent, and Android backup is spaced by ten minutes", () => {
  const s = live(); s.prayers.preferences.reminders = false;
  const events = buildPrayerSchedule(s, now, 10).filter(event => event.date === date);
  assert.deepEqual(events.map(event => event.kind), ["wake", "backup"]);
  assert.equal(events[1].at - events[0].at, 600000);
  s.prayers.fajr.enabled = false; assert.deepEqual(buildPrayerSchedule(s, now), []);
});
test("recorded prayers have no alerts, obsolete events are skipped, and IDs are stable and unique", () => {
  const s = live(); s.prayers.days[date].entries.fajr.check = "later";
  const events = buildPrayerSchedule(s, now);
  assert.ok(!events.some(event => event.date === date && event.prayer === "fajr"));
  assert.equal(new Set(events.map(e => e.id)).size, events.length);
  assert.deepEqual(events, buildPrayerSchedule(s, now));
  assert.ok(buildPrayerSchedule(s, events[0].at).every(event => event.at > events[0].at));
});
test("manual local time handles midnight, DST gaps and invalid clocks", () => {
  assert.equal(wallTimeInstant(date, "00:30", "Asia/Tashkent"), Date.parse("2026-10-20T19:30:00Z"));
  assert.equal(wallTimeInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(wallTimeInstant(date, "12:99", "Asia/Tashkent"), null);
});
test("a location change never queues leftover dates calculated for the former location", () => {
  const s = live();
  s.prayers.days[date].calculationKey = "old-location";
  assert.ok(!buildPrayerSchedule(s, now).some(event => event.date === date));
  assert.ok(buildPrayerSchedule(s, now).some(event => event.date === "2026-10-22"));
});
test("OS reconciliation verifies the queue, cancels changed alerts and preserves other features", async () => {
  const events = buildPrayerSchedule(live(), now), variant = "test";
  let pending: PendingAlert[] = [{ id: 7 }];
  const port: SchedulePort = {
    pending: async () => pending,
    cancel: async ids => { pending = pending.filter(n => !ids.includes(n.id)); },
    schedule: async additions => { pending.push(...additions.map(event => ({ id: event.id, extra: { rise: true, signature: alertSignature(event, variant) } }))); },
  };
  assert.equal((await reconcileDeviceAlerts(port, events, variant)).length, 60);
  assert.equal(pending.length, 61);
  await reconcileDeviceAlerts(port, events.slice(2, 10), variant); assert.equal(pending.length, 9);
  await reconcileDeviceAlerts(port, [], variant); assert.deepEqual(pending, [{ id: 7 }]);
  await assert.rejects(reconcileDeviceAlerts({ ...port, schedule: async () => {} }, events, variant), /did not confirm/);
  pending = Array.from({ length: 63 }, (_, i) => ({ id: i }));
  assert.equal((await reconcileDeviceAlerts(port, events, variant)).length, 1);
  assert.equal(pending.length, 64);
});
