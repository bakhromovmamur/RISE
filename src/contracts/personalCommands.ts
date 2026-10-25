import type { HabitDraft, State } from "../model";
import type { GoalDraft, RewardDraft, Priority } from "../developmentModel";
import type { PrayerId } from "../prayerModel";
import * as v from "../data/validation";

export interface CommandContext { date: string; now: number; timezone: string }
export type PersonalCommand =
  | { kind: "habit.save"; draft: HabitDraft; newId: string }
  | { kind: "habit.draft"; draft: HabitDraft | null }
  | { kind: "timer.start" | "timer.pause" | "timer.resume" | "timer.end"; habitId: string }
  | { kind: "timer.complete"; habitId: string; date: string }
  | { kind: "priorities.ensure"; date: string }
  | { kind: "priority.pin"; date: string; priority: Priority; selected: boolean }
  | { kind: "goal.save"; draft: GoalDraft; newId: string }
  | { kind: "reward.save"; draft: RewardDraft; newId: string }
  | { kind: "reward.retry"; rewardId: string; newId: string }
  | { kind: "reward.select"; rewardId: string }
  | { kind: "reward.archive"; rewardId: string; archived: boolean }
  | { kind: "collection.claim"; xp: number }
  | { kind: "collection.equip"; xp: number | null }
  | { kind: "profile.name"; name: string }
  | { kind: "preferences.set"; changes: Partial<State["prefs"]> }
  | { kind: "language.set"; language: State["life"]["language"] }
  | { kind: "reflection.save"; date: string; reflection: State["reflections"][string] }
  | { kind: "draft.save"; key: string; value: unknown }
  | { kind: "draft.clear"; key: string }
  | { kind: "onboarding.finish"; name: string; reminders: boolean; habits: { draft: HabitDraft; newId: string }[] }
  | { kind: "onboarding.skip" }
  | { kind: "calendar.refresh"; deviceTimezone?: string }
  | { kind: "work.begin"; date: string; prayer: PrayerId }
  | { kind: "work.note"; date: string; prayer: PrayerId; note: string }
  | { kind: "work.stage"; date: string; prayer: PrayerId; stage: "save" | "away" | "returned" }
  | { kind: "work.wrap"; date: string; prayer: PrayerId };

export const exact = (fields: Record<string, v.Check>): v.Check => (value, path) => {
  const row = v.object(value, path);
  if (Object.keys(row).some(key => !Object.hasOwn(fields, key))) throw new v.StoredDataError(path);
  v.shape(fields)(row, path);
};
const title = v.string(160), text = v.string(5000);
const id: v.Check = (value, path) => {
  v.id(value, path);
  if (["__proto__", "prototype", "constructor"].includes(String(value))) throw new v.StoredDataError(path);
};
export const habitDraftFields = {
  id: v.optional(id), name: title, icon: v.oneOf("book", "walk", "learn", "reflect", "focus", "leaf"),
  area: title, reason: text, type: v.oneOf("count", "duration", "check"), unit: title,
  full: v.number(0), tiny: v.nullable(v.number(0)), days: v.array(v.number(0, 6, true), 7), cue: text, reminder: v.emptyOr(v.clock),
};
export const goalDraftFields = { id: v.optional(id), title, reason: text, targetDate: v.emptyOr(v.date), habitIds: v.array(id, 1000), milestones: v.array(exact({ id, title, completedOn: v.optional(v.date) }), 1000) };
export const rewardDraftFields = { id: v.optional(id), name: title, condition: v.union(exact({ kind: v.oneOf("goal"), goalId: v.emptyOr(id) }), exact({ kind: v.oneOf("weekly"), week: v.emptyOr(v.date), target: v.number(0) })) };
const habitDraft = exact(habitDraftFields);
const prayer = v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha");
const priority = v.union(exact({ kind: v.oneOf("habit"), habitId: id }), exact({ kind: v.oneOf("milestone"), goalId: id, milestoneId: id }), exact({ kind: v.oneOf("task"), taskId: id, date: v.date, groupId:v.optional(id) }));
const prefs = { appearance: v.oneOf("system", "light", "dark"), reminders: v.bool, quietStart: v.clock, quietEnd: v.clock, sound: v.bool, haptics: v.bool, reduceMotion: v.bool, golden: v.bool };
const fields: { [K in PersonalCommand["kind"]]: Record<string, v.Check> } = {
  "habit.save": { draft: habitDraft, newId: id }, "habit.draft": { draft: v.nullable(habitDraft) },
  "timer.start": { habitId: id }, "timer.pause": { habitId: id }, "timer.resume": { habitId: id }, "timer.end": { habitId: id }, "timer.complete": { habitId: id, date: v.date },
  "priorities.ensure": { date: v.date }, "priority.pin": { date: v.date, priority, selected: v.bool },
  "goal.save": { draft: exact(goalDraftFields), newId: id }, "reward.save": { draft: exact(rewardDraftFields), newId: id },
  "reward.retry": { rewardId: id, newId: id }, "reward.select": { rewardId: id }, "reward.archive": { rewardId: id, archived: v.bool },
  "collection.claim": { xp: v.oneOf(100, 250, 500, 800, 1200) }, "collection.equip": { xp: v.nullable(v.oneOf(250)) },
  "profile.name": { name: v.string(80) }, "language.set": { language: v.oneOf("en", "uz", "ru") },
  "preferences.set": { changes: exact(Object.fromEntries(Object.entries(prefs).map(([key, check]) => [key, v.optional(check)]))) },
  "reflection.save": { date: v.date, reflection: exact({ manageable: text, smaller: text }) },
  "draft.save": { key: id, value: v.validateJson }, "draft.clear": { key: id },
  "onboarding.finish": { name: v.string(80), reminders: v.bool, habits: v.array(exact({ draft: habitDraft, newId: id }), 3) },
  "onboarding.skip": {}, "calendar.refresh": { deviceTimezone: v.optional(v.zone) },
  "work.begin": { date: v.date, prayer }, "work.note": { date: v.date, prayer, note: text },
  "work.stage": { date: v.date, prayer, stage: v.oneOf("save", "away", "returned") }, "work.wrap": { date: v.date, prayer },
};
/** Validate understood personal drafts while allowing incomplete form values. Unknown legacy drafts stay local. */
export function validatePersonalDraft(key: string, value: unknown): boolean {
  let schema: v.Check | undefined;
  if (key.startsWith("habit:")) schema = habitDraft;
  else if (key.startsWith("goal:")) schema = exact(goalDraftFields);
  else if (key.startsWith("reward:")) schema = exact(rewardDraftFields);
  else if (key.startsWith("reflection:")) schema = exact({ manageable: text, smaller: text });
  else if (key.startsWith("priorities:")) schema = v.array(priority, 3);
  else if (key === "onboarding") schema = exact({ step: v.number(0, 10, true), areas: v.array(title, 3), selected: v.array(v.number(0, 4, true), 3), habits: v.array(habitDraft, 5), reminders: v.bool, name: v.string(80) });
  else if (key === "fajr-plan") schema = exact({ date: v.optional(v.date), bedtime: v.string(160), wakeLead: v.number(0), backupMinutes: v.number(0), message: text, placement: v.oneOf("away", "bedside"), enabled: v.bool, backupEnabled: v.bool });
  if (!schema) return false;
  schema(value, key); return true;
}
export function parsePersonalCommand(value: unknown): PersonalCommand {
  const row = v.object(value, "command");
  if (typeof row.kind !== "string" || !Object.hasOwn(fields, row.kind)) throw new v.StoredDataError("kind");
  const kind = row.kind as PersonalCommand["kind"];
  exact({ kind: v.oneOf(kind), ...fields[kind] })(row, kind);
  if (kind === "draft.save") validatePersonalDraft(String(row.key), row.value);
  return structuredClone(row) as PersonalCommand; // Discriminant and every payload field checked above.
}
export function parseContext(value: unknown): CommandContext {
  exact({ date: v.date, now: v.number(0, 8640000000000000, true), timezone: v.zone })(value, "context");
  return structuredClone(value) as CommandContext;
}
