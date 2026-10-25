import { test } from "node:test";
import assert from "node:assert/strict";
import { makeFixture } from "../src/review/fixtures.ts";
import { balancedFixture } from "../src/demo.ts";
import { addLifeDemo } from "../src/lifeModel.ts";
import { createEmptyState } from "../src/data/initialState.ts";
import { migrateLegacy, prepareProfile } from "../src/data/migration.ts";
import { parseStoredState, validateState } from "../src/data/storedState.ts";
import { addDays, xpTotal } from "../src/model.ts";
import { rewardEligibility } from "../src/developmentModel.ts";

for (const schema of [1, 2, 3, 4]) test(`durable migration schema ${schema} preserves authored data, XP, snapshots and unknown safe fields`, async () => {
  const original = addLifeDemo(balancedFixture(), "prayer-pause");
  original.life.drafts = { unfinished: { title: "A personal draft", values: ["", null] } };
  original.reflections["2026-10-12"] = { manageable: "My private reflection", smaller: "My small step" };
  const source = JSON.parse(JSON.stringify(original)); source.schema = schema; source.extraSafeField = { preserved: "exactly" };
  if (schema < 2) delete source.prayers;
  if (schema < 3) for (const key of ["goals", "personalRewards", "dailyPriorities", "selectedRewardId"]) delete source[key];
  if (schema < 4) delete source.life;
  const raw = JSON.stringify(source, null, 3);
  const migrated = migrateLegacy(raw);
  assert.equal(xpTotal(migrated), xpTotal(original));
  for (const key of Object.keys(source)) if (key !== "schema") assert.deepEqual(Reflect.get(migrated, key), source[key]);
  assert.deepEqual(migrateLegacy(JSON.stringify(migrated)), migrated);
  if (schema >= 3) assert.deepEqual(migrated.personalRewards.map(r => rewardEligibility(migrated, r)), original.personalRewards.map(r => rewardEligibility(original, r)));
  if (schema === 1) assert.deepEqual(migrated.prayers.days, {});
  const prepared = await prepareProfile(raw, createEmptyState());
  assert.equal(prepared.summary.cloudEligible, false);
  assert.equal(prepared.summary.provenance, "demo-or-mixed");
});

test("fresh mode cannot hide known fixture or sample provenance", async () => {
  const mixed = addLifeDemo(balancedFixture()); mixed.mode = "fresh";
  assert.equal((await prepareProfile(JSON.stringify(mixed), createEmptyState())).summary.provenance, "demo-or-mixed");
  const personal = createEmptyState(); personal.name = "A new person";
  assert.equal((await prepareProfile(JSON.stringify(personal), personal)).summary.provenance, "unverified-legacy");
  assert.equal((await prepareProfile(null, personal)).summary.provenance, "new");
});

test("malformed, unsupported, hostile, duplicate and partial data are rejected without mutating their source", () => {
  const raw = JSON.stringify(makeFixture());
  const mutations = [
    (s: Record<string, unknown>) => { s.schema = 99; },
    (s: Record<string, unknown>) => { s.timezone = "Nowhere/Invalid"; },
    (s: Record<string, unknown>) => { s.demoDate = "2026-02-30"; },
    (s: Record<string, unknown>) => { s.prayers = {}; },
    (s: Record<string, unknown>) => { delete s.life; },
    (s: Record<string, unknown>) => { s.name = "x".repeat(81); },
  ];
  for (const mutate of mutations) { const value = JSON.parse(raw); mutate(value); const invalid = JSON.stringify(value); assert.throws(() => migrateLegacy(invalid)); assert.equal(JSON.stringify(value), invalid); }
  const duplicate = makeFixture(); duplicate.habits.push(duplicate.habits[0]); assert.throws(() => parseStoredState(JSON.stringify(duplicate)));
  const dangling = makeFixture(); dangling.days[dangling.demoDate][0].habitId = "absent"; assert.throws(() => parseStoredState(JSON.stringify(dangling)));
  assert.throws(() => migrateLegacy('{"schema":4,"__proto__":{"polluted":true}}'));
  assert.throws(() => migrateLegacy(raw.slice(0, -1)));
  assert.throws(() => parseStoredState(" ".repeat(50 * 1024 * 1024 + 1)));
  let accessed = false; const getter = Object.defineProperty({}, "name", { get() { accessed = true; return "never"; }, enumerable: true });
  assert.throws(() => validateState(getter)); assert.equal(accessed, false);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle; assert.throws(() => validateState(cycle));
});

test("a two-year, 100-habit profile round-trips without truncating historical snapshots or private notes", () => {
  const s = makeFixture(); s.days = {}; s.habits = Array.from({ length: 100 }, (_, i) => ({ ...s.habits[0], id: `habit-${i}` }));
  for (let i = 0; i < 731; i++) {
    const date = addDays("2024-10-19", i);
    s.days[date] = s.habits.map(h => ({ habitId: h.id, name: h.name, icon: h.icon, type: h.type, unit: h.unit, full: 10, tiny: 1, cue: "After breakfast", check: i % 2 ? "full" : "tiny" }));
    s.reflections[date] = { manageable: "A private note", smaller: "A smaller next step" };
  }
  const raw = JSON.stringify(s), restored = parseStoredState(raw);
  assert.deepEqual(restored, JSON.parse(raw)); assert.equal(xpTotal(restored), xpTotal(s));
  assert.equal(Object.values(restored.days).flat().length, 73100);
});
