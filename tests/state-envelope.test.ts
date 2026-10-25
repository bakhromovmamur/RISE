import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyState } from "../src/data/initialState.ts";
import { validateStateEnvelope } from "../src/data/storedState.ts";
import { StoredDataError } from "../src/data/validation.ts";
import { capacityProfile } from "./support/capacity.ts";

test("stored profile envelopes retain complete state and unknown safe fields without mutation", () => {
  const state = capacityProfile("2026-10-25", 3, 4);
  const envelope = { state, revision: 7, extension: { note: "Привет · Oʻzbek · 🌱", values: [null, false, 0] } };
  const original = structuredClone(envelope);
  validateStateEnvelope(envelope);
  assert.deepEqual(envelope, original);
  assert.throws(() => validateStateEnvelope(null), StoredDataError);
  assert.throws(() => validateStateEnvelope([]), StoredDataError);
  assert.throws(() => validateStateEnvelope({ state: {} }), StoredDataError);
});

test("envelope validation rejects hidden accessors and unsafe keys in metadata and state without invoking getters", () => {
  let calls = 0;
  const stateAccessor = Object.defineProperty({}, "state", { enumerable: true, get() { calls++; return createEmptyState(); } });
  assert.throws(() => validateStateEnvelope(stateAccessor), StoredDataError);
  for (const enumerable of [true, false]) for (const target of ["envelope", "state", "array"] as const) {
    const envelope = { state: createEmptyState(), extension: [] };
    const value = target === "envelope" ? envelope : target === "state" ? envelope.state : envelope.extension;
    Object.defineProperty(value, "hidden", { enumerable, get() { calls++; return "unsafe"; } });
    assert.throws(() => validateStateEnvelope(envelope), StoredDataError);
  }
  for (const key of ["__proto__", "prototype", "constructor"]) for (const target of ["envelope", "state"] as const) {
    const envelope = { state: createEmptyState() };
    Object.defineProperty(target === "envelope" ? envelope : envelope.state, key, { enumerable: false, value: null });
    assert.throws(() => validateStateEnvelope(envelope), StoredDataError);
  }
  const hiddenNumber = { state: createEmptyState() };
  Object.defineProperty(hiddenNumber, "extension", { value: Infinity });
  assert.throws(() => validateStateEnvelope(hiddenNumber), StoredDataError);
  assert.equal(calls, 0);
});

test("envelope validation retains profile schema, uniqueness and live-reference checks", () => {
  const initial = capacityProfile("2026-10-25", 2, 2);
  for (const mutate of [
    (s: typeof initial) => { s.habits[0].versions.length = 0; },
    (s: typeof initial) => { s.days["2026-10-25"][0].habitId = "missing"; },
    (s: typeof initial) => { s.days["2026-10-25"].push({ ...s.days["2026-10-25"][0] }); },
    (s: typeof initial) => { s.habits[0].versions.push({ ...s.habits[0].versions[0] }); },
    (s: typeof initial) => { s.name = "x".repeat(81); },
  ]) {
    const state = structuredClone(initial); mutate(state);
    assert.throws(() => validateStateEnvelope({ state }), StoredDataError);
  }
  const retained = structuredClone(initial);
  retained.dailyPriorities["2026-10-25"] = [{ kind: "milestone", goalId: "retired", milestoneId: "old" }];
  validateStateEnvelope({ state: retained });
  assert.deepEqual(retained.days, initial.days);
});

test("whole-envelope depth and object budgets cannot be bypassed through metadata or the state member", () => {
  let nested: unknown = null;
  for (let i = 0; i < 19; i++) nested = { child: nested };
  validateStateEnvelope({ state: createEmptyState(), extension: nested });
  assert.throws(() => validateStateEnvelope({ state: createEmptyState(), extension: { child: nested } }), StoredDataError);
  const state = createEmptyState();
  const count = (value: unknown): number => !value || typeof value !== "object" ? 0
    : (Array.isArray(value) ? 0 : 1) + Object.values(value).reduce<number>((sum, child) => sum + count(child), 0);
  const envelope = { state, extension: [] as object[] };
  envelope.extension = Array.from({ length: 250000 - count(envelope) }, () => ({}));
  validateStateEnvelope(envelope);
  envelope.extension.push({});
  assert.throws(() => validateStateEnvelope(envelope), StoredDataError);
});
