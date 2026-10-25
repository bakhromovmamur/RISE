import type { State, Habit, Version, Occurrence, HabitDraft, Timer } from "../model";
import type { Goal, GoalMilestone, PersonalReward, Priority } from "../developmentModel";
import type { PrayerDay, PrayerEntry, PrayerState, FajrPlan, WorkBreak } from "../prayerModel";
import type { LifeState, LocalGroup, FamilyTask, SharedList, SquadUpdate, PrayerPause } from "../lifeModel";
import type { CalculationSettings } from "../prayerCalculation";
import * as v from "./validation";

type Fields<T> = { [K in keyof T]-?: v.Check };
const title = v.string(160), text = v.string(5000), days = v.array(v.number(0, 6, true), 7);
const habitType = v.oneOf("count", "duration", "check"), icon = v.oneOf("book", "walk", "learn", "reflect", "focus", "leaf");
const targets = { full: v.number(0), tiny: v.nullable(v.number(0)) };
const habitFields = { name: title, icon, area: title, reason: text, type: habitType, unit: title };
const version = v.shape({ effective: v.date, ...targets, days, cue: text, reminder: v.emptyOr(v.clock) } satisfies Fields<Version>);
const habit = v.shape({ ...habitFields, id: v.id, created: v.date, archivedAt: v.optional(v.date), versions: v.array(version) } satisfies Fields<Habit>);
const occurrence = v.shape({ habitId: v.id, name: title, icon, type: habitType, unit: title, ...targets, cue: text, check: v.optional(v.oneOf("full", "tiny")) } satisfies Fields<Occurrence>);
const draft = v.shape({ ...habitFields, id: v.optional(v.id), ...targets, days, cue: text, reminder: v.emptyOr(v.clock) } satisfies Fields<HabitDraft>);
const timer = v.shape({ habitId: v.id, duration: v.number(0), elapsed: v.number(0), startedAt: v.nullable(v.number(0)), date: v.date } satisfies Fields<Timer>);
const prayerId = v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha");
const prayers = (check: v.Check) => v.shape({ fajr: check, dhuhr: check, asr: check, maghrib: check, isha: check });
const entry = v.shape({ begins: v.clock, target: v.clock, ends: v.clock, beginsAt: v.optional(v.instant), targetAt: v.optional(v.instant), endsAt: v.optional(v.instant), check: v.optional(v.oneOf("on_time", "later", "missed")), performedAt: v.optional(v.clock), recordedAt: v.optional(v.instant) } satisfies Fields<PrayerEntry>);
const prayerDay = v.shape({ source: text, sample: v.bool, timezone: v.zone, calculationKey: v.optional(text), sunrise: v.optional(v.clock), entries: prayers(entry) } satisfies Fields<PrayerDay>);
const fajr = v.shape({ bedtime: v.clock, wakeLead: v.number(0), backupMinutes: v.number(0), message: text, placement: v.oneOf("away", "bedside"), enabled: v.bool, backupEnabled: v.optional(v.bool) } satisfies Fields<FajrPlan>);
const work = v.shape({ date: v.date, prayer: prayerId, stage: v.oneOf("save", "away", "returned"), note: text, wrapUntil: v.nullable(v.number(0)), wrapUsed: v.bool } satisfies Fields<WorkBreak>);
export const prayerState = v.shape({ version: v.oneOf(1), started: v.date, demoMinute: v.number(0, 1440), days: v.dictionary(prayerDay, v.date), preferences: v.shape({ place: v.oneOf("home", "mosque"), leadMinutes: v.number(0), style: v.oneOf("gentle", "firm"), reminders: v.bool }), fajr, prepared: v.dictionary(fajr, v.date), work: v.nullable(work) } satisfies Fields<PrayerState>);
const milestone = v.shape({ id: v.id, title, completedOn: v.optional(v.date) } satisfies Fields<GoalMilestone>);
const goal = v.shape({ id: v.id, title, reason: text, targetDate: v.emptyOr(v.date), habitIds: v.array(v.id), milestones: v.array(milestone), status: v.oneOf("active", "paused", "completed", "archived"), createdOn: v.date, completedOn: v.optional(v.date), archivedOn: v.optional(v.date) } satisfies Fields<Goal>);
const reward = v.shape({ id: v.id, name: title, condition: v.union(v.shape({ kind: v.oneOf("goal"), goalId: v.id }), v.shape({ kind: v.oneOf("weekly"), week: v.date, target: v.number(1) })), createdOn: v.date, earnedOn: v.optional(v.date), enjoyedOn: v.optional(v.date), correctedOn: v.optional(v.date), archivedOn: v.optional(v.date), previousAttemptId: v.optional(v.id) } satisfies Fields<PersonalReward>);
const priority: v.Check = v.union(
  v.shape({ kind: v.oneOf("habit"), habitId: v.id } satisfies Fields<Extract<Priority, { kind: "habit" }>>),
  v.shape({ kind: v.oneOf("milestone"), goalId: v.id, milestoneId: v.id } satisfies Fields<Extract<Priority, { kind: "milestone" }>>),
  v.shape({ kind: v.oneOf("task"), taskId: v.id, date: v.date, groupId:v.optional(v.id) } satisfies Fields<Extract<Priority, { kind: "task" }>>),
);
const calculation = v.shape({ latitude: v.number(-90, 90), longitude: v.number(-180, 180), timezone: v.zone, label: title, method: v.oneOf("Karachi", "MuslimWorldLeague", "NorthAmerica", "Egyptian", "UmmAlQura", "MoonsightingCommittee", "Singapore", "Tehran"), madhab: v.oneOf("Hanafi", "Shafi"), highLatitude: v.oneOf("MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle") } satisfies Fields<CalculationSettings>);
const pauseKey: v.Check = (value, path) => {
  v.string(20, /^\d{4}-\d{2}-\d{2}:[0-4]$/)(value, path);
  v.date(String(value).slice(0, 10), path);
};
const pause = v.shape({ id: v.id, from: pauseKey, through: v.optional(pauseKey) } satisfies Fields<PrayerPause>);
const group = v.shape({ id: v.id, name: title, kind: v.oneOf("family", "squad"), members: v.array(v.shape({ id: v.id, name: v.string(80), role: v.oneOf("owner", "member") })), archived: v.optional(v.bool), left: v.optional(v.bool), muted: v.bool, quietStart: v.clock, quietEnd: v.clock, invitations: v.array(v.shape({ id: v.id, code: title, expires: v.union(v.date, v.instant), revoked: v.optional(v.bool), accepted: v.optional(v.bool) })) } satisfies Fields<LocalGroup>);
const task = v.shape({ id: v.id, groupId: v.id, title, notes: text, assignee: v.emptyOr(v.id), date: v.date, time: v.emptyOr(v.clock), weekdays: days, archived: v.optional(v.bool), completions: v.dictionary(v.shape({ by: v.id, at: v.instant }), v.date) } satisfies Fields<FamilyTask>);
const list = v.shape({ id: v.id, groupId: v.id, name: title, archived: v.optional(v.bool), items: v.array(v.shape({ id: v.id, text: title, quantity: title, checked: v.bool })) } satisfies Fields<SharedList>);
const update = v.shape({ id: v.id, groupId: v.id, memberId: v.id, week: v.date, note: v.string(3000), habits: v.optional(v.number(0)), milestones: v.optional(v.array(title)), prayers: v.optional(v.number(0)), reactions: v.dictionary(title) } satisfies Fields<SquadUpdate>);
const life = v.shape({ language: v.oneOf("en", "ru", "uz"), calculation: v.optional(calculation), deviceTimezone: v.optional(v.shape({ observed: v.zone, reviewed: v.optional(v.zone) })), delivery: v.optional(v.shape({ enabled: v.bool, sound: v.bool, acknowledgedFajr: v.array(v.date) })), setup: v.shape({ configured: v.bool, city: title, source: v.oneOf("local", "calculated"), offsets: prayers(v.number(0, 120)) }), reminderRules: prayers(v.shape({ preparation: v.bool, due: v.bool })), readiness: v.oneOf("ready", "permission", "coverage", "waiting"), backupEnabled: v.bool, alarm: v.nullable(v.shape({ date: v.date, stage: v.oneOf("ringing", "stopped", "awake"), backup: v.bool })), pauses: v.array(pause), groups: v.array(group), tasks: v.array(task), lists: v.array(list), updates: v.array(update), drafts: v.dictionary(() => { /* Incomplete forms are safe JSON, not completed domain entities. */ }) } satisfies Fields<LifeState>);
export const stateShape = v.shape({
  schema: v.oneOf(4), mode: v.oneOf("demo", "fresh"), demoDate: v.date, timezone: v.zone, name: v.string(80), onboarded: v.bool,
  habits: v.array(habit), days: v.dictionary(v.array(occurrence), v.date), claimed: v.array(v.number(0)), equipped: v.nullable(v.number(0)), plus: v.bool,
  prefs: v.shape({ appearance: v.oneOf("system", "light", "dark"), reminders: v.bool, quietStart: v.clock, quietEnd: v.clock, sound: v.bool, haptics: v.bool, reduceMotion: v.bool, golden: v.bool }),
  reflections: v.dictionary(v.shape({ manageable: text, smaller: text }), v.date), timer: v.nullable(timer), draft: v.nullable(draft),
  prayers: prayerState, goals: v.array(goal), personalRewards: v.array(reward), dailyPriorities: v.dictionary(v.array(priority, 3), v.date), selectedRewardId: v.nullable(v.id), life,
} satisfies Fields<State>);

function unique(ids: string[], path: string) { if (new Set(ids).size !== ids.length) throw new v.StoredDataError(path); }
export function validateState(value: unknown): asserts value is State {
  v.validateJson(value);
  validateProfile(value);
}
/** Stored envelopes include the profile in their complete JSON safety walk.
 * Validate the same profile fields/references without walking that subtree twice.
 * This boundary always checks the entire unknown envelope, including extensions.
 */
export function validateStateEnvelope(value: unknown): asserts value is { state: State } {
  v.validateJson(value);
  const envelope = v.object(value, "state envelope");
  validateProfile(envelope.state);
}
/** JSON safety was already checked by validateState or the bounded JSON parser. */
function validateProfile(value: unknown): asserts value is State {
  stateShape(value, "profile");
  // All fields above have been checked before using the domain's typed representation.
  const s = value as State;
  for (const rows of [s.habits, s.goals, s.personalRewards, s.life.groups, s.life.tasks, s.life.lists, s.life.updates, s.life.pauses]) unique(rows.map(r => r.id), "duplicate ID");
  const habits = new Set(s.habits.map(h => h.id)), groups = new Set(s.life.groups.map(g => g.id));
  const requireRef = (exists: boolean) => { if (!exists) throw new v.StoredDataError("record reference"); };
  for (const h of s.habits) {
    if (!h.versions.length) throw new v.StoredDataError("habit versions");
    unique(h.versions.map(x => x.effective), "habit version dates");
    if (h.versions.some((x, i) => i > 0 && x.effective < h.versions[i - 1].effective)) throw new v.StoredDataError("habit version order");
  }
  for (const rows of Object.values(s.days)) { unique(rows.map(o => o.habitId), "duplicate occurrence"); rows.forEach(o => requireRef(habits.has(o.habitId))); }
  if (s.timer) requireRef(habits.has(s.timer.habitId));
  s.goals.forEach(g => { unique(g.milestones.map(m => m.id), "milestone ID"); g.habitIds.forEach(id => requireRef(habits.has(id))); });
  s.life.groups.forEach(g => unique(g.members.map(m => m.id), "member ID"));
  s.life.lists.forEach(l => unique(l.items.map(i => i.id), "list item ID"));
  [...s.life.tasks, ...s.life.lists, ...s.life.updates].forEach(r => requireRef(groups.has(r.groupId)));
  for (const rows of Object.values(s.dailyPriorities)) unique(rows.map(p => p.kind === "habit" ? `habit:${p.habitId}` : p.kind === "task" ? p.groupId ? `shared-task:${p.groupId}:${p.taskId}:${p.date}` : `task:${p.taskId}:${p.date}` : `milestone:${p.goalId}:${p.milestoneId}`), "priority ID");
  // Historical priority/reward references may outlive edited milestones. Preserve them.
}
export function parseStoredState(raw: string): State {
  const value = v.parseJson(raw); validateProfile(value); return value;
}
