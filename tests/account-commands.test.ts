import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseAccountOperation } from "../src/contracts/accountCommands.ts";
import { emptyDraft } from "../src/model.ts";
import { PRAYERS } from "../src/prayerModel.ts";

const operation = (command: object) => ({ protocolVersion: 1, operationId: randomUUID(), baseRevision: 0, command });
test("account intents validate their complete envelope and preserve stable UUIDs without touching the input", () => {
  const value = operation({ kind: "habit.save", newId: randomUUID(), draft: { ...emptyDraft(), name: "Synthetic habit" } }), before = structuredClone(value);
  assert.deepEqual(parseAccountOperation(value), value); assert.deepEqual(value, before);
  assert.notEqual(parseAccountOperation(value).command, value.command);
  for (const bad of [{ ...value, ownerId: randomUUID() }, { ...value, context: { date: "2026-10-21", timezone: "UTC", now: 0 } }, { ...value, baseRevision: 0.5 }, { ...value, operationId: "local-legacy-id" }, { ...value, command: { ...value.command, newId: "local-legacy-id" } }]) assert.throws(() => parseAccountOperation(bad));
});
test("account boundary rejects device-only, coordinate, draft and shared uploads", () => {
  for (const command of [
    { kind: "draft.save", key: "note", value: "Private local draft" },
    { kind: "delivery.preferences", changes: { enabled: true } },
    { kind: "timer.start", habitId: randomUUID() },
    { kind: "calendar.refresh", deviceTimezone: "Asia/Tashkent" },
    { kind: "priorities.set", date: "2026-10-21", priorities: [{ kind: "task", taskId: randomUUID(), date: "2026-10-21" }] },
    { kind: "prayer.calculated-setup", settings: { latitude: 41.3, longitude: 69.2, timezone: "Asia/Tashkent", label: "Synthetic", method: "Karachi", madhab: "Hanafi", highLatitude: "MiddleOfTheNight" }, offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
  ]) assert.throws(() => parseAccountOperation(operation(command)));
});
test("a manual timetable cannot import sample provenance, calculation keys or manufactured prayer reports", () => {
  const entries = Object.fromEntries(PRAYERS.map(({ id }, i) => [id, { begins: `${String(i * 2).padStart(2, "0")}:00`, target: `${String(i * 2).padStart(2, "0")}:15`, ends: `${String(i * 2 + 1).padStart(2, "0")}:00` }]));
  const day = { source: "Synthetic manual timetable", sample: false, timezone: "UTC", entries };
  const command = { kind: "prayer.timetable", date: "2026-10-21", day, preferences: { place: "home", leadMinutes: 10, style: "gentle", reminders: false } };
  assert.deepEqual(parseAccountOperation(operation(command)).command, command);
  for (const forged of [
    { ...day, sample: true }, { ...day, calculationKey: "device-location-key" },
    ...[{ check: "on_time" }, { performedAt: "00:15" }, { recordedAt: "2026-10-21T00:15:00Z" }].map(report => ({ ...day, entries: { ...entries, fajr: { ...entries.fajr, ...report } } })),
  ]) assert.throws(() => parseAccountOperation(operation({ ...command, day: forged })));
});
test("malformed or oversized account payloads cannot invoke accessors or smuggle credentials", () => {
  let accessed = false;
  const getter = Object.defineProperty({}, "kind", { enumerable: true, get() { accessed = true; return "profile.name"; } });
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const command of [getter, cycle, { kind: "profile.name", name: "a".repeat(70000) }, { kind: "profile.name", name: "Synthetic", accessToken: "synthetic" }, JSON.parse('{"kind":"profile.name","name":"Synthetic","__proto__":{"owner":"forged"}}')]) assert.throws(() => parseAccountOperation(operation(command)));
  assert.equal(accessed, false);
});
