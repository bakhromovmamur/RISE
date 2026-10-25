import { createEmptyState } from "../data/initialState";
import { validateState } from "../data/storedState";
import { object } from "../data/validation";
import { makePrayerState, PRAYERS } from "../prayerModel";
import type { State } from "../model";

export type Row = Record<string, unknown>;
export interface Table { name: string; keys: string[]; columns: string[]; order?: string[] }
const table = (name: string, keys: string[], columns: string[], order?: string[]): Table => ({ name, keys, columns: [...keys, ...columns], order });
/** Fixed SQL identifiers only. Relations carry owner-consistent keys, never an uploaded State blob. */
export const personalTables: Table[] = [
  table("profiles", [], ["name", "language", "timezone", "started_on", "onboarded"]),
  table("account_preferences", [], ["selected_reward_id", "equipped_xp", "data"]),
  table("habits", ["id"], ["position", "data"], ["position", "id"]),
  table("habit_versions", ["habit_id", "effective"], ["data"]),
  table("habit_days", ["date"], []),
  table("habit_occurrences", ["date", "habit_id"], ["position", "check_kind", "data"], ["date", "position", "habit_id"]),
  table("goals", ["id"], ["position", "data"], ["position", "id"]),
  table("goal_milestones", ["goal_id", "id"], ["position", "retired", "data"], ["goal_id", "position", "id"]),
  table("goal_habits", ["goal_id", "habit_id"], ["position"], ["goal_id", "position", "habit_id"]),
  table("personal_rewards", ["id"], ["position", "condition_kind", "goal_id", "week", "target", "previous_attempt_id", "data"], ["position", "id"]),
  table("priority_days", ["date"], []),
  table("daily_priorities", ["date", "slot"], ["kind", "habit_id", "goal_id", "milestone_id", "group_id", "task_id", "task_date"]),
  table("cosmetic_claims", ["xp"], []),
  table("prayer_settings", [], ["data"]),
  table("prayer_reminders", ["prayer"], ["data"]),
  table("prayer_days", ["date"], ["data"]),
  table("prayer_windows", ["date", "prayer"], ["data"]),
  table("prayer_records", ["date", "prayer"], ["check_kind", "data"]),
  table("prayer_pauses", ["id"], ["position", "from_key", "through_key"], ["position", "id"]),
  table("fajr_plans", ["date"], ["data"]),
  table("fajr_acknowledgments", ["date"], []),
  table("reflections", ["date"], ["data"]),
  table("saved_work_breaks", ["date", "prayer"], ["active", "data"]),
];
export type Records = Record<string, Row[]>;
/** Pre-GROUP-02 cache/export/import rows remain valid without rewriting the
 * original file or pending operation. Partial extensions never receive defaults. */
export function priorityRecord(row:Row):Row {
 return (row.kind==='habit'||row.kind==='milestone')&&['group_id','task_id','task_date'].every(k=>!Object.hasOwn(row,k))?{...row,group_id:null,task_id:null,task_date:null}:row;
}
const str = (row: Row, key: string) => { const value = row[key]; if (typeof value !== "string") throw new Error("invalid_personal_record"); return value; };
const data = (row: Row) => object(row.data, "personal-record");
function single(records: Records, name: string) { if (records[name].length !== 1) throw new Error("incomplete_personal_records"); return records[name][0]; }
/** Group once while retaining the database/cache row order within each parent. */
function byParent(rows: Row[], key: string): Map<unknown, Row[]> {
  const groups = new Map<unknown, Row[]>();
  for (const row of rows) {
    const parent = row[key], group = groups.get(parent);
    if (group) group.push(row); else groups.set(parent, [row]);
  }
  return groups;
}

/** A transient domain model, rebuilt from independent relational records. Never stored or accepted as a request. */
export function hydrate(records: Records): State {
  const profile = single(records, "profiles"), preferences = single(records, "account_preferences");
  const zone = str(profile, "timezone"), started = str(profile, "started_on"), settings = data(single(records, "prayer_settings"));
  const occurrences = byParent(records.habit_occurrences, "date"), versions = byParent(records.habit_versions, "habit_id");
  const windows = byParent(records.prayer_windows, "date"), reports = byParent(records.prayer_records, "date");
  const goalHabits = byParent(records.goal_habits, "goal_id"), milestones = byParent(records.goal_milestones, "goal_id");
  const priorities = byParent(records.daily_priorities, "date");
  const days = Object.fromEntries(records.habit_days.map(day => [str(day, "date"), (occurrences.get(day.date) ?? []).map(o => ({ ...data(o), habitId: o.habit_id, ...(o.check_kind === null ? {} : { check: o.check_kind }) }))]));
  const prayerDays = Object.fromEntries(records.prayer_days.map(day => [str(day, "date"), { ...data(day), entries: Object.fromEntries(PRAYERS.map(({ id }) => {
    const window = windows.get(day.date)?.find(w => w.prayer === id);
    if (!window) throw new Error("missing_prayer_window");
    const report = reports.get(day.date)?.find(r => r.prayer === id);
    return [id, { ...data(window), ...(report ? { ...data(report), check: report.check_kind } : {}) }];
  })) }]));
  const work = records.saved_work_breaks.find(row => row.active === true);
  const base = createEmptyState();
  const candidate: unknown = {
    ...base, name: profile.name, timezone: zone, demoDate: started, onboarded: profile.onboarded,
    prefs: data(preferences), equipped: preferences.equipped_xp, selectedRewardId: preferences.selected_reward_id,
    habits: records.habits.map(h => ({ ...data(h), id: h.id, versions: (versions.get(h.id) ?? []).map(v => ({ ...data(v), effective: v.effective })) })),
    days, claimed: records.cosmetic_claims.map(row => row.xp),
    goals: records.goals.map(g => ({ ...data(g), id: g.id,
      habitIds: (goalHabits.get(g.id) ?? []).map(h => h.habit_id),
      milestones: (milestones.get(g.id) ?? []).filter(m => m.retired === false).map(m => ({ ...data(m), id: m.id })),
    })),
    personalRewards: records.personal_rewards.map(r => ({ ...data(r), id: r.id,
      condition: r.condition_kind === "goal" ? { kind: "goal", goalId: r.goal_id } : { kind: "weekly", week: r.week, target: Number(r.target) },
      ...(r.previous_attempt_id === null ? {} : { previousAttemptId: r.previous_attempt_id }),
    })),
    dailyPriorities: Object.fromEntries(records.priority_days.map(day => [str(day, "date"), (priorities.get(day.date) ?? []).map(p => p.kind === "habit" ? { kind: "habit", habitId: p.habit_id } : p.kind === "task" ? {kind:"task",groupId:p.group_id,taskId:p.task_id,date:p.task_date} : { kind: "milestone", goalId: p.goal_id, milestoneId: p.milestone_id })])),
    reflections: Object.fromEntries(records.reflections.map(r => [str(r, "date"), data(r)])),
    prayers: { ...makePrayerState("fresh", typeof settings.started==="string"?settings.started:started, zone), preferences: settings.preferences, fajr: settings.fajr, days: prayerDays,
      prepared: Object.fromEntries(records.fajr_plans.map(p => [str(p, "date"), data(p)])),
      work: work ? { ...data(work), date: work.date, prayer: work.prayer, wrapUntil: null } : null,
    },
    life: { ...base.life, language: profile.language, backupEnabled: settings.backupEnabled,
      reminderRules: Object.fromEntries(records.prayer_reminders.map(r => [str(r, "prayer"), data(r)])),
      delivery: { enabled: false, sound: false, acknowledgedFajr: records.fajr_acknowledgments.map(r => r.date) },
      pauses: records.prayer_pauses.map(p => ({ id: p.id, from: p.from_key, ...(p.through_key === null ? {} : { through: p.through_key }) })),
    },
  };
  validateState(candidate); return candidate;
}

function pick(value: object, keys: readonly string[]): Row {
  const row: Row = {};
  for (const key of keys) {
    if (Object.hasOwn(value, key) && Reflect.get(value, key) !== undefined) row[key] = Reflect.get(value, key);
  }
  return row;
}
const fajrFields = ["bedtime", "wakeLead", "backupMinutes", "message", "placement", "enabled", "backupEnabled"];
export function project(state: State, started: string): Records {
  const records: Records = Object.fromEntries(personalTables.map(t => [t.name, []]));
  records.profiles = [{ name: state.name, language: state.life.language, timezone: state.timezone, started_on: started, onboarded: state.onboarded }];
  records.account_preferences = [{ selected_reward_id: state.selectedRewardId, equipped_xp: state.equipped, data: pick(state.prefs, ["appearance", "reminders", "quietStart", "quietEnd", "sound", "haptics", "reduceMotion", "golden"]) }];
  state.habits.forEach((h, position) => {
    records.habits.push({ id: h.id, position, data: pick(h, ["name", "icon", "area", "reason", "type", "unit", "created", "archivedAt"]) });
    h.versions.forEach(v => records.habit_versions.push({ habit_id: h.id, effective: v.effective, data: pick(v, ["full", "tiny", "days", "cue", "reminder"]) }));
  });
  for (const [date, rows] of Object.entries(state.days)) {
    records.habit_days.push({ date });
    rows.forEach((o, position) => records.habit_occurrences.push({ date, habit_id: o.habitId, position, check_kind: o.check ?? null, data: pick(o, ["name", "icon", "type", "unit", "full", "tiny", "cue"]) }));
  }
  state.goals.forEach((g, position) => {
    records.goals.push({ id: g.id, position, data: pick(g, ["title", "reason", "targetDate", "status", "createdOn", "completedOn", "archivedOn"]) });
    g.milestones.forEach((m, position) => records.goal_milestones.push({ goal_id: g.id, id: m.id, position, retired: false, data: pick(m, ["title", "completedOn"]) }));
    g.habitIds.forEach((habit_id, position) => records.goal_habits.push({ goal_id: g.id, habit_id, position }));
  });
  state.personalRewards.forEach((r, position) => records.personal_rewards.push({ id: r.id, position, condition_kind: r.condition.kind,
    goal_id: r.condition.kind === "goal" ? r.condition.goalId : null, week: r.condition.kind === "weekly" ? r.condition.week : null,
    target: r.condition.kind === "weekly" ? r.condition.target : null, previous_attempt_id: r.previousAttemptId ?? null,
    data: pick(r, ["name", "createdOn", "earnedOn", "enjoyedOn", "correctedOn", "archivedOn"]),
  }));
  for (const [date, priorities] of Object.entries(state.dailyPriorities)) {
    records.priority_days.push({ date });
    priorities.forEach((p, slot) => { if (p.kind === "task"&&!p.groupId) throw new Error("local_priority_in_personal_store"); records.daily_priorities.push({ date, slot, kind: p.kind,
      habit_id: p.kind === "habit" ? p.habitId : null, goal_id: p.kind === "milestone" ? p.goalId : null, milestone_id: p.kind === "milestone" ? p.milestoneId : null,
      group_id:p.kind==='task'?p.groupId:null,task_id:p.kind==='task'?p.taskId:null,task_date:p.kind==='task'?p.date:null,
    }); });
  }
  records.cosmetic_claims = state.claimed.map(xp => ({ xp }));
  records.prayer_settings = [{ data: { preferences: pick(state.prayers.preferences, ["place", "leadMinutes", "style", "reminders"]), fajr: pick(state.prayers.fajr, fajrFields), backupEnabled: state.life.backupEnabled, started:state.prayers.started } }];
  records.prayer_reminders = PRAYERS.map(({ id }) => ({ prayer: id, data: pick(state.life.reminderRules[id], ["preparation", "due"]) }));
  for (const [date, day] of Object.entries(state.prayers.days)) {
    if (day.sample || day.calculationKey !== undefined) throw new Error("device_timetable_in_personal_store");
    records.prayer_days.push({ date, data: pick(day, ["source", "sample", "timezone", "sunrise"]) });
    for (const { id } of PRAYERS) {
      const entry = day.entries[id];
      records.prayer_windows.push({ date, prayer: id, data: pick(entry, ["begins", "target", "ends", "beginsAt", "targetAt", "endsAt"]) });
      if (entry.check) records.prayer_records.push({ date, prayer: id, check_kind: entry.check, data: pick(entry, ["performedAt", "recordedAt"]) });
    }
  }
  records.prayer_pauses = state.life.pauses.map((p, position) => ({ id: p.id, position, from_key: p.from, through_key: p.through ?? null }));
  records.fajr_plans = Object.entries(state.prayers.prepared).map(([date, plan]) => ({ date, data: pick(plan, fajrFields) }));
  records.fajr_acknowledgments = (state.life.delivery?.acknowledgedFajr ?? []).map(date => ({ date }));
  records.reflections = Object.entries(state.reflections).map(([date, reflection]) => ({ date, data: pick(reflection, ["manageable", "smaller"]) }));
  if (state.prayers.work) records.saved_work_breaks = [{ date: state.prayers.work.date, prayer: state.prayers.work.prayer, active: true, data: pick(state.prayers.work, ["stage", "note", "wrapUsed"]) }];
  return records;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(Reflect.get(value, key))}`).join(",")}}`;
  const text = JSON.stringify(value); if (text === undefined) throw new Error("non_json_personal_record"); return text;
}
