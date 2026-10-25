import { test } from "node:test";
import assert from "node:assert/strict";
import { dateInZone, timeInZone, wallTimeInstant } from "../src/domain/zonedTime.ts";
import { balancedFixture } from "../src/demo.ts";
import { addLifeDemo } from "../src/lifeModel.ts";
import { prayerMoment, prayerStreak } from "../src/prayerModel.ts";

test("fresh manual-history streaks reuse timezone formatters without changing history or results", () => {
  const state = addLifeDemo(balancedFixture()); state.mode = "fresh";
  const before = structuredClone(state), moment = prayerMoment(state, new Date("2026-10-25T17:35:00Z"));
  const Original = Intl.DateTimeFormat;
  let constructions = 0;
  Intl.DateTimeFormat = new Proxy(Original, { construct(target, args) {
    constructions++; return Reflect.construct(target, args);
  } });
  try {
    const ids = ["fajr", "dhuhr", "asr", "maghrib", "isha", "all"] as const;
    const first = ids.map(id => prayerStreak(state, id, moment));
    const second = ids.map(id => prayerStreak(state, id, moment));
    assert.deepEqual(second, first);
    assert.deepEqual(state, before);
    assert.ok(constructions < 20, `manual history constructed ${constructions} timezone formatters`);
  } finally { Intl.DateTimeFormat = Original; }
});

test("formatter reuse follows each instant and zone across DST, date lines, and cache eviction", () => {
  const zones = ["America/New_York", "Australia/Lord_Howe", "Pacific/Apia", "Asia/Almaty", "Asia/Kathmandu", "Pacific/Chatham", "Pacific/Kiritimati", "UTC"];
  const instants = ["2026-03-08T06:59:00Z", "2026-03-08T07:01:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2024-02-29T12:00:00Z", "2024-03-01T12:00:00Z", "2011-12-30T12:00:00Z"];
  const verify = (zone: string, value: string) => {
    const instant = new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {timeZone:zone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(instant);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    assert.equal(dateInZone(instant, zone), `${part("year")}-${part("month")}-${part("day")}`);
    assert.equal(timeInZone(instant, zone), new Intl.DateTimeFormat("en-GB", {timeZone:zone, hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(instant));
  };
  for (const zone of zones) for (const instant of instants) verify(zone, instant);
  for (const zone of Intl.supportedValuesOf("timeZone").slice(0, 40)) verify(zone, instants[0]);
  for (const zone of zones) for (const instant of instants) verify(zone, instant);
  assert.equal(wallTimeInstant("2026-11-01", "01:30", "America/New_York"), Date.parse("2026-11-01T05:30:00Z"));
  assert.equal(wallTimeInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(wallTimeInstant("2011-12-30", "12:00", "Pacific/Apia"), null);
});

test("formatter reuse preserves invalid zone and instant failures without poisoning valid calls", () => {
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const format of [dateInZone, timeInZone]) {
      assert.throws(() => format(0, "Not/AZone"), RangeError);
      assert.throws(() => format(NaN, "UTC"), RangeError);
      assert.throws(() => format(new Date(NaN), "UTC"), RangeError);
    }
    assert.equal(dateInZone(0, "UTC"), "1970-01-01");
    assert.equal(timeInZone(0, "UTC"), "00:00");
    assert.equal(wallTimeInstant("2026-10-25", "12:00", "Not/AZone"), null);
  }
});
