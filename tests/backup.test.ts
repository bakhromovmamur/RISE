import { test } from "node:test";
import assert from "node:assert/strict";
import { balancedFixture } from "../src/demo.ts";
import { addLifeDemo } from "../src/lifeModel.ts";
import { createEmptyState } from "../src/data/initialState.ts";
import { migrateLegacy } from "../src/data/migration.ts";
import { createBackup, previewRestore, contentHash, validateRestore, type BackupEnvelope, type BackupSnapshot } from "../src/data/backup.ts";
import { projectBackup } from "../src/data/backupProjection.ts";
import { addDays, xpTotal } from "../src/model.ts";
import { rewardEligibility } from "../src/developmentModel.ts";
import { MAX_BYTES } from "../src/data/validation.ts";

const fixture = () => {
  const state = addLifeDemo(balancedFixture(), "prayer-pause");
  state.reflections["2026-10-12"] = { manageable: "<img src=x onerror=alert(1)> Private note", smaller: "Мой маленький шаг · kichik qadam" };
  state.life.drafts["fajr-plan"] = { ...state.prayers.fajr, message: "A private unfinished plan", backupEnabled: false };
  state.life.delivery = { enabled: true, sound: false, acknowledgedFajr: ["2026-10-19"] };
  return state;
};
const snapshot = (state = fixture()): BackupSnapshot => ({ state, archives: [], revision: 7 });

test("versioned private backup round-trips personal XP, dates, corrections, pauses, rewards and understood drafts", async () => {
  const current = snapshot(), original = structuredClone(current), raw = await createBackup(current), envelope: BackupEnvelope = JSON.parse(raw);
  assert.equal(envelope.format, "rise.private-backup"); assert.equal(envelope.version, 1); assert.equal(envelope.schemaVersion, 4);
  const preview = await previewRestore(raw, current);
  await validateRestore(preview);
  const restored = preview.content.personal;
  for (const key of ["habits", "days", "reflections", "goals", "personalRewards", "dailyPriorities", "prayers", "claimed", "equipped", "draft", "timer"] as const) assert.deepEqual(restored[key], JSON.parse(JSON.stringify(current.state[key])));
  assert.deepEqual(restored.life.pauses, current.state.life.pauses); assert.deepEqual(restored.life.drafts, current.state.life.drafts);
  assert.deepEqual(restored.life.delivery, { ...current.state.life.delivery, enabled: false });
  assert.deepEqual(restored.personalRewards.map(r => rewardEligibility(restored, r)), current.state.personalRewards.map(r => rewardEligibility(current.state, r)));
  assert.equal(xpTotal(restored), xpTotal(current.state)); assert.equal(preview.changes.conflicting, 0); assert.equal(preview.changes.removed, 0);
  assert.deepEqual(current, original); assert.equal(preview.summary.cloudEligible, false);
  const second = await createBackup({ state: restored, archives: preview.content.localArchives, revision: 8 });
  assert.deepEqual((await previewRestore(second, current)).content, preview.content);
});

for (const schema of [1, 2, 3, 4]) test(`legacy schema ${schema} gets the same validated preview without invented activity`, async () => {
  const source = JSON.parse(JSON.stringify(fixture())); source.schema = schema;
  if (schema < 2) delete source.prayers;
  if (schema < 3) for (const key of ["goals", "personalRewards", "dailyPriorities", "selectedRewardId"]) delete source[key];
  if (schema < 4) delete source.life;
  const raw = JSON.stringify(source), expected = projectBackup(migrateLegacy(raw)), before = snapshot();
  const preview = await previewRestore(raw, before);
  assert.equal(preview.source, "legacy"); assert.deepEqual(preview.content, expected);
  assert.equal(xpTotal(preview.content.personal), xpTotal(before.state));
  if (schema === 1) assert.deepEqual(preview.content.personal.prayers.days, {});
  assert.equal(JSON.stringify(source), raw);
});

test("allowlist removes nested credentials, endpoints and invitation secrets, keeps local location and permitted snapshots", async () => {
  const state = fixture();
  Reflect.set(state, "session", { token: "SECRET-TOKEN" }); Reflect.set(state.habits[0], "credentials", "SECRET-HABIT");
  Reflect.set(state.life, "pushSubscription", { endpoint: "https://SECRET-ENDPOINT.invalid" });
  Reflect.set(state.prayers.days[state.demoDate].entries.fajr, "accessToken", "SECRET-PRAYER");
  Reflect.set(state.life.drafts["fajr-plan"] as object, "session", "SECRET-DRAFT");
  state.life.drafts.unknown = { password: "SECRET-UNKNOWN" };
  state.life.groups[0].invitations.push({ id: "invite", code: "SECRET-INVITE", expires: "2026-10-29" });
  state.life.groups.push({ ...structuredClone(state.life.groups[0]), id: "left-group", name: "SECRET-LEFT", left: true });
  state.life.groups.push({ ...structuredClone(state.life.groups[0]), id: "removed-group", name: "SECRET-REMOVED", members: [] });
  state.life.tasks.push({ ...structuredClone(state.life.tasks[0]), id: "left-task", groupId: "left-group", notes: "SECRET-LEFT-TASK" });
  const before = JSON.stringify(state), raw = await createBackup(snapshot(state)), preview = await previewRestore(raw, snapshot());
  assert.doesNotMatch(raw, /SECRET-/); assert.equal(JSON.stringify(state), before);
  assert.deepEqual(preview.content.personal.life.groups, []); assert.deepEqual(preview.content.personal.life.tasks, []);
  assert.equal(preview.content.localArchives[0].groups.length, 2);
  assert.deepEqual(preview.content.localArchives[0].groups[0].invitations, []);
  assert.deepEqual(preview.content.localArchives[0].updates, state.life.updates);
  assert.deepEqual(preview.content.personal.life.calculation, state.life.calculation);
});

test("preview reports overlapping records, actual conflicts, additions and removals without modifying either profile", async () => {
  const current = snapshot(), source = structuredClone(current.state); source.name = "Incoming name";
  source.habits[0].name = "Changed title";
  delete source.reflections["2026-10-12"];
  source.reflections["2026-10-13"] = { manageable: "new", smaller: "new" };
  const before = structuredClone(current), raw = JSON.stringify(source), preview = await previewRestore(raw, current);
  assert.equal(preview.changes.conflicting, 2); assert.equal(preview.changes.added, 1); assert.equal(preview.changes.removed, 1);
  assert.ok(preview.changes.matching > 10); assert.ok(preview.dates.first); assert.ok(preview.dates.last);
  assert.deepEqual(current, before); assert.equal(JSON.stringify(source), raw);
});

test("malformed, future, forged, oversized, duplicate and hostile files cannot become staged restores", async () => {
  const current = snapshot(), raw = await createBackup(current), valid = JSON.stringify(current.state);
  const invalid = ["{", "[]", raw.slice(0, -1), " ".repeat(MAX_BYTES + 1), '{"__proto__":{"polluted":true}}', valid.replace('"schema":4', '"schema":999'), valid.replace('"timezone":"Asia/Tashkent"', '"timezone":"Unknown/Zone"')];
  const forged = JSON.parse(raw); forged.data.personal.name = "Altered without checksum"; invalid.push(JSON.stringify(forged));
  const future = JSON.parse(raw); future.version = 2; invalid.push(JSON.stringify(future));
  const duplicate = fixture(); duplicate.habits.push(duplicate.habits[0]); invalid.push(JSON.stringify(duplicate));
  const dangling = fixture(); dangling.days[dangling.demoDate][0].habitId = "absent"; invalid.push(JSON.stringify(dangling));
  const invalidDate = fixture(); invalidDate.prayers.days[invalidDate.demoDate].entries.fajr.recordedAt = "2026-02-30T04:00:00Z"; invalid.push(JSON.stringify(invalidDate));
  const invalidDraft = fixture(); invalidDraft.life.drafts["fajr-plan"] = { message: { title: "not text" } }; invalid.push(JSON.stringify(invalidDraft));
  const nested = JSON.parse(valid); let leaf = nested; for (let i = 0; i < 22; i++) { leaf.deep = {}; leaf = leaf.deep; } invalid.push(JSON.stringify(nested));
  const many = JSON.parse(valid); many.extra = Array.from({ length: 250001 }, () => ({})); invalid.push(JSON.stringify(many));
  const nonfinite = valid.replace('"schema":4', '"schema":1e999'); invalid.push(nonfinite);
  const before = structuredClone(current);
  for (let i = 0; i < invalid.length; i++) await assert.rejects(previewRestore(invalid[i], current), `invalid fixture ${i}`);
  // A valid checksum cannot turn malformed records or unsafe projection into a valid file.
  for (const change of [
    (file: BackupEnvelope) => { file.data.personal.schema = 99 as 4; },
    (file: BackupEnvelope) => { file.counts.habits++; },
    (file: BackupEnvelope) => { file.data.personal.life.delivery!.enabled = true; },
    (file: BackupEnvelope) => { Reflect.set(file.data.personal, "sessionToken", "cannot restore"); },
  ]) {
    const file: BackupEnvelope = JSON.parse(raw); change(file);
    const { checksum: _, ...payload } = file; file.checksum.value = await contentHash(payload);
    await assert.rejects(previewRestore(JSON.stringify(file), current));
  }
  const staged = await previewRestore(raw, current); staged.content.personal.name = "Changed after preview";
  await assert.rejects(validateRestore(staged)); assert.deepEqual(current, before);
  const reordered = JSON.stringify(JSON.parse(raw), null, 2); assert.deepEqual((await previewRestore(reordered, current)).content, projectBackup(current.state));
});

test("two years of 100 habits round-trip through the versioned format, with every date and XP preserved", async () => {
  const state = createEmptyState(); state.timezone = "Asia/Tashkent";
  const template = fixture().habits[0]; state.habits = Array.from({ length: 100 }, (_, i) => ({ ...template, id: `habit-${i}` }));
  for (let i = 0; i < 731; i++) {
    const date = addDays("2024-10-19", i);
    state.days[date] = state.habits.map(h => ({ habitId: h.id, name: h.name, icon: h.icon, type: h.type, unit: h.unit, full: 10, tiny: 1, cue: "After breakfast", check: i % 2 ? "full" : "tiny" }));
    state.reflections[date] = { manageable: "A private note", smaller: "A smaller next step" };
  }
  const current = snapshot(state), raw = await createBackup(current);
  assert.ok(Buffer.byteLength(raw) < MAX_BYTES);
  const restored = await previewRestore(raw, current);
  assert.equal(restored.counts.habitChecks, 73100); assert.equal(restored.xp, xpTotal(state));
  assert.deepEqual(restored.content.personal.days, state.days); assert.deepEqual(restored.content.personal.reflections, state.reflections);
  assert.equal(restored.changes.conflicting, 0); assert.equal(restored.changes.removed, 0);
});
