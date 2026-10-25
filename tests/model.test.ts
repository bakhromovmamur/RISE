import { makeFixture } from "../src/review/fixtures.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  archiveHabit,
  checkIn,
  draftOf,
  emptyDraft,
  ensureDays,
  saveHabit,
  streaks,
  timerElapsed,
  today,
  validateDraft,
  weekStats,
  xpTotal,
} from "../src/model.ts";
test("exact supplied fixture: 240 XP, 16 scheduled, 14 check-ins, 10 full, 4 tiny, 87.5%, streak seven", () => {
  const s = makeFixture();
  assert.equal(xpTotal(s), 240);
  assert.deepEqual(streaks(s), { current: 7, longest: 7 });
  const w = weekStats(s, "2026-10-12");
  assert.equal(w.total, 16);
  assert.equal(w.checked, 14);
  assert.equal(w.full, 10);
  assert.equal(w.tiny, 4);
  assert.equal(w.rate, 87.5);
  assert.equal(s.days[today(s)].length, 3);
  assert.ok(s.days[today(s)].every((o) => !o.check));
});
test("tiny, repeat, upgrade, repeat, undo all use one source of truth", () => {
  let s = checkIn(makeFixture(), "read", "tiny");
  assert.equal(xpTotal(s), 250);
  assert.equal(streaks(s).current, 8);
  s = checkIn(s, "read", "tiny");
  assert.equal(xpTotal(s), 250);
  s.claimed.push(250);
  s.equipped = 250;
  s = checkIn(s, "read", "full");
  assert.equal(xpTotal(s), 260);
  s = checkIn(s, "read", "full");
  assert.equal(xpTotal(s), 260);
  s = checkIn(s, "read", "tiny");
  assert.equal(xpTotal(s), 260);
  s = checkIn(s, "read", null);
  assert.equal(xpTotal(s), 240);
  assert.equal(streaks(s).current, 7);
  assert.equal(s.equipped, null);
  assert.ok(!s.claimed.includes(250));
});
test("a missed planned date preserves XP and longest streak", () => {
  const s = makeFixture("return");
  assert.equal(xpTotal(s), 240);
  assert.deepEqual(streaks(s), { current: 0, longest: 7 });
  assert.equal(s.claimed[0], 100);
});
test("unscheduled rest day preserves but never increments streak", () => {
  const s = makeFixture("rest");
  assert.equal(s.days[today(s)].length, 0);
  assert.deepEqual(streaks(s), { current: 7, longest: 7 });
  assert.equal(xpTotal(checkIn(s, "read", "full")), 240);
});
test("target and schedule edits begin next date while historical denominators and targets remain", () => {
  let s = makeFixture();
  const draft = draftOf(s.habits[0], today(s));
  draft.full = 4;
  draft.tiny = 1;
  draft.days = [2];
  draft.name = "My pages";
  s = saveHabit(s, draft);
  assert.equal(s.habits[0].name, "My pages");
  assert.equal(s.days["2026-10-19"][0].full, 10);
  assert.equal(s.days["2026-10-12"][0].full, 10);
  assert.equal(weekStats(s, "2026-10-12").total, 16);
  s = ensureDays({ ...s, demoDate: "2026-10-20" });
  assert.equal(s.days["2026-10-20"].find((o) => o.habitId === "read")?.full, 4);
  s = ensureDays({ ...s, demoDate: "2026-10-21" });
  assert.ok(!s.days["2026-10-21"].some((o) => o.habitId === "read"));
});
test("archive removes today’s unlogged action, frees slot, and preserves historical denominators", () => {
  let s = archiveHabit(makeFixture(), "walk");
  assert.equal(s.days["2026-10-19"].length, 2);
  assert.equal(weekStats(s, "2026-10-12").total, 16);
  assert.equal(xpTotal(s), 240);
  s = saveHabit(s, { ...emptyDraft(), name: "Stretch" });
  assert.equal(s.habits.filter((h) => !h.archivedAt).length, 3);
});
test("archiving a logged habit retains today’s check-in, denominator, and XP", () => {
  let s = checkIn(makeFixture(), "walk", "full");
  s = archiveHabit(s, "walk");
  assert.equal(s.days["2026-10-19"].length, 3);
  assert.equal(xpTotal(s), 260);
  s = ensureDays({ ...s, demoDate: "2026-10-21" });
  assert.ok(!s.days["2026-10-21"].some((o) => o.habitId === "walk"));
});
test("new habits are unlimited and appear only on their selected schedule", () => {
  let s = makeFixture();
  s = saveHabit(s, { ...emptyDraft(), name: "Stretch", days: [2] });
  assert.equal(s.habits.length, 4);
  assert.equal(s.plus, false);
  assert.equal(s.days["2026-10-19"].length, 3);
  s = ensureDays({ ...s, demoDate: "2026-10-20" });
  assert.ok(s.days["2026-10-20"].some((o) => o.name === "Stretch"));
});
test("a fourth habit saves the draft without requiring an entitlement", () => {
  let s = makeFixture();
  s.draft = { ...emptyDraft(), name: "Stretch" };
  s = saveHabit(s, s.draft);
  assert.equal(s.habits.filter((h) => !h.archivedAt).length, 4);
  assert.equal(s.draft, null);
});
test("reject empty names, invalid targets, oversized tiny targets, and empty schedules", () => {
  const base = { ...emptyDraft(), name: "Read" };
  for (const draft of [
    { ...base, name: " " },
    { ...base, full: 0 },
    { ...base, full: NaN },
    { ...base, tiny: 0 },
    { ...base, tiny: 2 },
    { ...base, days: [] },
  ])
    assert.ok(validateDraft(draft));
});
test("frozen demo date and timer clock are independent; timer survives serialization", () => {
  const s = makeFixture();
  s.timer = {
    habitId: "walk",
    duration: 1200,
    elapsed: 20,
    startedAt: 100000,
    date: today(s),
  };
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(today(restored), "2026-10-19");
  assert.equal(timerElapsed(restored.timer, 130000), 50);
  assert.equal(timerElapsed({ ...s.timer, startedAt: null }, 9999999), 20);
  assert.equal(timerElapsed(s.timer, 9999999), 1200);
  assert.equal(xpTotal(restored), 240);
});
test("refresh and materialization never overwrite check-ins", () => {
  let s = checkIn(makeFixture(), "english", "full");
  s = ensureDays(JSON.parse(JSON.stringify(s)));
  assert.equal(xpTotal(s), 260);
  assert.equal(
    s.days["2026-10-19"].find((o) => o.habitId === "english")?.check,
    "full",
  );
});
test("today unfinished does not break streak and late planned misses do", () => {
  let s = makeFixture();
  assert.equal(streaks(s).current, 7);
  s = ensureDays({ ...s, demoDate: addDays(today(s), 1) });
  assert.equal(streaks(s).current, 0);
});

test("Undo after archiving removes today's newly unlogged action without rewriting old plans", () => {
  let s = checkIn(makeFixture(), "walk", "full");
  s = archiveHabit(s, "walk");
  s = checkIn(s, "walk", null);
  assert.equal(xpTotal(s), 240);
  assert.equal(s.days["2026-10-19"].length, 2);
  assert.equal(weekStats(s, "2026-10-12").total, 16);
});
