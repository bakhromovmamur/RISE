import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReviewOrigin } from "../src/review/origin.ts";
import { createEmptyState } from "../src/data/initialState.ts";
import { today, xpTotal } from "../src/model.ts";

test("review fixtures refuse personal, production, LAN and unspecified origins", () => {
  for (const host of ["localhost", "127.0.0.1"]) {
    for (const port of [4174, 4180, 4182]) assert.doesNotThrow(() => assertReviewOrigin(`http://${host}:${port}`));
  }
  for (const url of ["http://localhost:4173", "http://127.0.0.1:4181", "http://localhost:5173", "https://habit.saraftech.com", "http://192.168.1.2:4174", "https://localhost:4174", "http://localhost.evil.example:4174"]) {
    assert.throws(() => assertReviewOrigin(url));
  }
});

test("empty personal profiles use the real date and never inherit records or shared objects", () => {
  const first = createEmptyState(), second = createEmptyState();
  assert.equal(first.mode, "fresh"); assert.equal(first.prayers.started, today(first));
  assert.equal(xpTotal(first), 0); assert.deepEqual(first.prayers.days, {});
  first.life.groups.push({ id: "local", name: "Private", kind: "family", members: [], muted: false, quietStart: "22:00", quietEnd: "08:00", invitations: [] });
  assert.deepEqual(second.life.groups, []);
  assert.equal(second.onboarded, false);
});
