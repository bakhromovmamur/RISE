import { validatePersonalDraft } from "../contracts/personalCommands";
import type { State, Version } from "../model";
import type { LifeState } from "../lifeModel";
import { parseStoredState, validateState } from "./storedState";
import * as v from "./validation";

/** These are readable local snapshots, never active membership or synchronization input. */
export type LocalArchive = Pick<LifeState, "groups" | "tasks" | "lists" | "updates">;
export interface BackupContent { personal: State; localArchives: LocalArchive[] }
const pick = <T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> =>
  Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as Pick<T, K>;
const map = <T, R>(value: Record<string, T>, fn: (row: T) => R): Record<string, R> => Object.fromEntries(Object.entries(value).map(([key, row]) => [key, fn(row)]));
const fajr = (row: State["prayers"]["fajr"]) => pick(row, ["bedtime", "wakeLead", "backupMinutes", "message", "placement", "enabled", "backupEnabled"]);
const offsets = (row: LifeState["setup"]["offsets"]) => pick(row, ["fajr", "dhuhr", "asr", "maghrib", "isha"]);
const prayerKeys = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
const setup = (row: LifeState["setup"]) => ({ ...pick(row, ["configured", "city", "source"]), offsets: offsets(row.offsets) });
const habitDraft = (row: NonNullable<State["draft"]>) => pick(row, ["id", "name", "icon", "area", "reason", "type", "unit", "full", "tiny", "days", "cue", "reminder"]);
function version(row: Version): Version {
  // Older fixtures stored the authored draft alongside a version. These known
  // historical fields are private data too, although today's Version omits them.
  const extra = v.object(row, "habit version"), fields = {
    id: v.optional(v.id), name: v.optional(v.string(160)), icon: v.optional(v.oneOf("book", "walk", "learn", "reflect", "focus", "leaf")),
    area: v.optional(v.string(160)), reason: v.optional(v.string(5000)), type: v.optional(v.oneOf("count", "duration", "check")), unit: v.optional(v.string(160)),
  };
  v.shape(fields)(extra, "habit version");
  return { ...pick(row, ["effective", "full", "tiny", "days", "cue", "reminder"]), ...pick(extra, Object.keys(fields)) };
}

// Only current, understood form fields may leave the device. Unknown draft payloads
// could contain future credentials; incomplete text is allowed, executable structure is not.
function projectDraft(key: string, value: unknown): unknown {
  const text = v.string(5000), short = v.string(160), flags = { habits: v.bool, milestones: v.bool, prayers: v.bool };
  let fields: Record<string, v.Check>;
  if (key !== "fajr-plan" && validatePersonalDraft(key, value)) return value;
  if (key.startsWith("list-name:")) { short(value, key); return value; }
  if (key === "prayer-setup") fields = { configured: v.bool, city: short, source: v.oneOf("local", "calculated"), offsets: v.dictionary(v.number(0, 120), v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha")) };
  else if (key === "live-prayer-setup") fields = { latitude: short, longitude: short, timezone: short, label: short, method: short, madhab: short, highLatitude: short, offsets: v.dictionary(v.number(0, 120), v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha")) };
  else if (key === "prayer-pause") fields = { date: short, prayer: v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha"), includeCurrent: v.bool };
  else if (key === "fajr-plan") fields = { date: v.optional(v.date), bedtime: short, wakeLead: v.number(0), backupMinutes: v.number(0), message: text, placement: v.oneOf("away", "bedside"), enabled: v.bool, backupEnabled: v.bool };
  else if (/^group-create:(family|squad)$/.test(key)) fields = { name: short, kind: v.oneOf("family", "squad") };
  else if (key.startsWith("task:")) fields = { title: short, notes: text, assignee: short, date: short, time: short, weekdays: v.array(v.number(0, 6, true), 7) };
  else if (key.startsWith("new-list:")) fields = { name: short };
  else if (key.startsWith("list-item:")) fields = { id: short, text: short, quantity: short };
  else if (key.startsWith("squad:")) fields = { note: v.string(3000), ...flags };
  else return undefined;
  v.shape(fields)(value, key);
  const row = v.object(value, key), result = pick(row, Object.keys(fields));
  if (result.offsets) {
    const row = v.object(result.offsets, key);
    prayerKeys.forEach(id => v.number(0, 120)(row[id], key));
    result.offsets = pick(row, prayerKeys);
  }
  return result;
}

function projectArchive(source: LocalArchive): LocalArchive {
  // Current app groups are explicitly local simulations. A left/removed member
  // cannot export that group's records. Future server groups need server authorization.
  const groups = source.groups.filter(g => !g.left && g.members.some(m => m.id === "self"));
  const ids = new Set(groups.map(g => g.id));
  return {
    groups: groups.map(g => ({ ...pick(g, ["id", "name", "kind", "archived", "left", "muted", "quietStart", "quietEnd"]), members: g.members.map(m => pick(m, ["id", "name", "role"])), invitations: [] })),
    tasks: source.tasks.filter(t => ids.has(t.groupId)).map(t => ({ ...pick(t, ["id", "groupId", "title", "notes", "assignee", "date", "time", "weekdays", "archived"]), completions: map(t.completions, c => pick(c, ["by", "at"])) })),
    lists: source.lists.filter(l => ids.has(l.groupId)).map(l => ({ ...pick(l, ["id", "groupId", "name", "archived"]), items: l.items.map(i => pick(i, ["id", "text", "quantity", "checked"])) })),
    updates: source.updates.filter(u => ids.has(u.groupId)).map(u => ({ ...pick(u, ["id", "groupId", "memberId", "week", "note", "habits", "milestones", "prayers"]), reactions: { ...u.reactions } })),
  };
}

/** An explicit field projection, not a blacklist or generic whole-profile export. */
export function projectBackup(input: State, archives: LocalArchive[] = []): BackupContent {
  const s = parseStoredState(JSON.stringify(input));
  const personal: State = {
    ...pick(s, ["schema", "mode", "demoDate", "timezone", "name", "onboarded", "claimed", "equipped", "plus", "selectedRewardId"]),
    prefs: pick(s.prefs, ["appearance", "reminders", "quietStart", "quietEnd", "sound", "haptics", "reduceMotion", "golden"]),
    habits: s.habits.map(h => ({ ...pick(h, ["id", "name", "icon", "area", "reason", "type", "unit", "created", "archivedAt"]), versions: h.versions.map(version) })),
    days: map(s.days, rows => rows.map(r => pick(r, ["habitId", "name", "icon", "type", "unit", "full", "tiny", "cue", "check"]))),
    reflections: map(s.reflections, r => pick(r, ["manageable", "smaller"])),
    timer: s.timer ? pick(s.timer, ["habitId", "duration", "elapsed", "startedAt", "date"]) : null,
    draft: s.draft ? habitDraft(s.draft) : null,
    prayers: {
      ...pick(s.prayers, ["version", "started", "demoMinute"]),
      preferences: pick(s.prayers.preferences, ["place", "leadMinutes", "style", "reminders"]),
      fajr: fajr(s.prayers.fajr), prepared: map(s.prayers.prepared, fajr),
      work: s.prayers.work ? pick(s.prayers.work, ["date", "prayer", "stage", "note", "wrapUntil", "wrapUsed"]) : null,
      days: map(s.prayers.days, d => ({ ...pick(d, ["source", "sample", "timezone", "calculationKey", "sunrise"]), entries: Object.fromEntries(prayerKeys.map(key => [key, pick(d.entries[key], ["begins", "target", "ends", "beginsAt", "targetAt", "endsAt", "check", "performedAt", "recordedAt"])])) as typeof d.entries })),
    },
    goals: s.goals.map(g => ({ ...pick(g, ["id", "title", "reason", "targetDate", "habitIds", "status", "createdOn", "completedOn", "archivedOn"]), milestones: g.milestones.map(m => pick(m, ["id", "title", "completedOn"])) })),
    personalRewards: s.personalRewards.map(r => ({ ...pick(r, ["id", "name", "createdOn", "earnedOn", "enjoyedOn", "correctedOn", "archivedOn", "previousAttemptId"]), condition: r.condition.kind === "goal" ? pick(r.condition, ["kind", "goalId"]) : pick(r.condition, ["kind", "week", "target"]) })),
    dailyPriorities: map(s.dailyPriorities, rows => rows.map(p => p.kind === "habit" ? pick(p, ["kind", "habitId"]) : p.kind === "task" ? pick(p, ["kind", "taskId", "date", "groupId"]) : pick(p, ["kind", "goalId", "milestoneId"]))),
    life: {
      language: s.life.language, setup: setup(s.life.setup),
      ...(s.life.calculation ? { calculation: pick(s.life.calculation, ["latitude", "longitude", "timezone", "label", "method", "madhab", "highLatitude"]) } : {}),
      ...(s.life.delivery ? { delivery: { enabled: false, sound: s.life.delivery.sound, acknowledgedFajr: [...s.life.delivery.acknowledgedFajr] } } : {}),
      reminderRules: Object.fromEntries(prayerKeys.map(key => [key, pick(s.life.reminderRules[key], ["preparation", "due"])])) as LifeState["reminderRules"],
      readiness: "waiting", backupEnabled: s.life.backupEnabled, alarm: null,
      pauses: s.life.pauses.map(p => pick(p, ["id", "from", "through"])),
      groups: [], tasks: [], lists: [], updates: [],
      drafts: Object.fromEntries(Object.entries(s.life.drafts).flatMap(([key, row]) => { const projected = projectDraft(key, row); return projected === undefined ? [] : [[key, projected]]; })),
    },
  };
  const localArchives = [...archives.map(projectArchive), projectArchive(s.life)].filter(a => a.groups.length);
  validateState(personal);
  validateArchives(localArchives, personal);
  return { personal, localArchives };
}

export function validateArchives(value: unknown, personal: State): asserts value is LocalArchive[] {
  v.array((row, path) => {
    const a = v.object(row, path);
    // Reuse the complete entity/reference checks without adding archive entities to live state.
    validateState({ ...personal, life: { ...personal.life, groups: a.groups, tasks: a.tasks, lists: a.lists, updates: a.updates } });
  })(value, "local archives");
}
