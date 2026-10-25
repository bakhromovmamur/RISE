import { addDays, today } from "./domain/calendar";
import { ensureDays, occurrence, scheduled, versionAt } from "./domain/habitCalendar";
export { addDays, weekday, localDate, today, formatDate, weekStart } from "./domain/calendar";
export { versionAt, scheduled, occurrence, ensureDays, countDay, weekStats } from "./domain/habitCalendar";
import type { PrayerState } from "./prayerModel";
import { reconcilePersonalRewards, type Goal, type PersonalReward, type Priority } from "./developmentModel";
import type { LifeState } from "./lifeModel";
export type Check = "full" | "tiny";
export type HabitType = "count" | "duration" | "check";
export type IconName = "book" | "walk" | "learn" | "reflect" | "focus" | "leaf";
export type Appearance = "system" | "light" | "dark";
export interface Version {
  effective: string;
  full: number;
  tiny: number | null;
  days: number[];
  cue: string;
  reminder: string;
}
export interface Habit {
  id: string;
  name: string;
  icon: IconName;
  area: string;
  reason: string;
  type: HabitType;
  unit: string;
  created: string;
  archivedAt?: string;
  versions: Version[];
}
export interface Occurrence {
  habitId: string;
  name: string;
  icon: IconName;
  type: HabitType;
  unit: string;
  full: number;
  tiny: number | null;
  cue: string;
  check?: Check;
}
export interface Timer {
  habitId: string;
  duration: number;
  elapsed: number;
  startedAt: number | null;
  date: string;
}
export interface HabitDraft {
  id?: string;
  name: string;
  icon: IconName;
  area: string;
  reason: string;
  type: HabitType;
  unit: string;
  full: number;
  tiny: number | null;
  days: number[];
  cue: string;
  reminder: string;
}
export interface State {
  schema: 4;
  mode: "demo" | "fresh";
  demoDate: string;
  timezone: string;
  name: string;
  onboarded: boolean;
  habits: Habit[];
  days: Record<string, Occurrence[]>;
  claimed: number[];
  equipped: number | null;
  plus: boolean;
  prefs: {
    appearance: Appearance;
    reminders: boolean;
    quietStart: string;
    quietEnd: string;
    sound: boolean;
    haptics: boolean;
    reduceMotion: boolean;
    golden: boolean;
  };
  reflections: Record<string, { manageable: string; smaller: string }>;
  timer: Timer | null;
  draft: HabitDraft | null;
  prayers: PrayerState;
  goals: Goal[];
  personalRewards: PersonalReward[];
  dailyPriorities: Record<string, Priority[]>;
  selectedRewardId: string | null;
  life: LifeState;
}
export const STORAGE_KEY = "rise.local.v1";
export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const milestones = [
  {
    xp: 100,
    name: "First Steps",
    reward: "First Steps badge",
    description: "A little reminder that you began.",
    icon: "footprints",
  },
  {
    xp: 250,
    name: "Finding Rhythm",
    reward: "Linen scarf for Pip",
    description: "A soft little layer for the path ahead.",
    icon: "scarf",
  },
  {
    xp: 500,
    name: "Growing Stronger",
    reward: "A trail-side seedling",
    description: "A new plant takes root on your Momentum Trail.",
    icon: "plant",
  },
  {
    xp: 800,
    name: "Steady Progress",
    reward: "Golden-hour background",
    description: "A little warm light for Pip’s corner of the world.",
    icon: "sun",
  },
  {
    xp: 1200,
    name: "New Horizons",
    reward: "Horizon explorer pin",
    description: "A golden keepsake for every small step along the way.",
    icon: "flag",
  },
];
export const xpTotal = (s: State) =>
  Object.values(s.days)
    .flat()
    .reduce(
      (n, o) => n + (o.check === "full" ? 20 : o.check === "tiny" ? 10 : 0),
      0,
    );
export function streaks(s: State) {
  const now = today(s);
  let run = 0,
    longest = 0;
  for (const d of Object.keys(s.days)
    .sort()
    .filter((d) => d <= now)) {
    const rows = s.days[d];
    if (!rows.length) continue;
    if (rows.some((o) => o.check)) {
      run++;
      longest = Math.max(longest, run);
    } else if (d !== now) run = 0;
  }
  return { current: run, longest };
}
export function reconcileRewards(s: State) {
  const xp = xpTotal(s);
  s.claimed = s.claimed.filter((n) => n <= xp);
  if (xp < 800) s.prefs.golden = false;
  if (s.equipped && (!s.claimed.includes(s.equipped) || s.equipped > xp))
    s.equipped = null;
  return s;
}
export function checkIn(
  input: State,
  id: string,
  kind: Check | null,
  date = today(input),
  actionDate = today(input),
): State {
  const s = ensureDays(input, actionDate);
  if (date !== actionDate) return s;
  const o = s.days[date]?.find((o) => o.habitId === id);
  if (!o) return s;
  if (kind === "tiny" && o.tiny === null) return s;
  if (kind === null) {
    delete o.check;
    if (s.habits.find((h) => h.id === id)?.archivedAt === date)
      s.days[date] = s.days[date].filter((row) => row.habitId !== id);
  } else if (o.check !== "full") o.check = kind;
  return reconcilePersonalRewards(reconcileRewards(s), actionDate);
}
/** Explicit history correction; regular check-in still only operates on today. */
export function correctHabitRecord(input: State, date: string, id: string, kind: Check | null, actionDate = today(input)): State {
  const s = structuredClone(input);
  if (date > actionDate) return s;
  const row = s.days[date]?.find((o) => o.habitId === id);
  if (!row || (kind === "tiny" && row.tiny === null)) return s;
  if (kind === null) {
    delete row.check;
    if (date === actionDate && s.habits.find((h) => h.id === id)?.archivedAt === date)
      s.days[date] = s.days[date].filter((o) => o.habitId !== id);
  }
  else row.check = kind;
  return reconcilePersonalRewards(reconcileRewards(s), actionDate);
}
export function validateDraft(d: HabitDraft) {
  if (!d.name.trim()) return "Give your habit a name.";
  if (!Number.isFinite(d.full) || d.full <= 0)
    return "Your full target must be greater than zero.";
  if (d.tiny !== null && (!Number.isFinite(d.tiny) || d.tiny <= 0))
    return "Your tiny target must be greater than zero.";
  if (d.tiny !== null && d.tiny > d.full)
    return "Keep your tiny target at or below the full target.";
  if (!d.days.length) return "Choose at least one planned day.";
  return "";
}
export function saveHabit(input: State, draft: HabitDraft, newId: string = crypto.randomUUID(), date = today(input)): State {
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  const s = ensureDays(input, date);
  const h = s.habits.find((h) => h.id === draft.id);
  const v: Version = {
    effective: h ? addDays(date, 1) : date,
    full: draft.full,
    tiny: draft.tiny,
    days: [...draft.days],
    cue: draft.cue,
    reminder: draft.reminder,
  };
  if (h) {
    h.name = draft.name.trim();
    h.icon = draft.icon;
    h.reason = draft.reason;
    h.area = draft.area;
    h.versions = h.versions.filter((v) => v.effective !== addDays(date, 1));
    h.versions.push(v);
  } else {
    const item: Habit = {
      id: newId,
      name: draft.name.trim(),
      icon: draft.icon,
      area: draft.area,
      reason: draft.reason,
      type: draft.type,
      unit: draft.unit,
      created: date,
      versions: [v],
    };
    s.habits.push(item);
    s.days[date] ??= [];
    if (scheduled(item, date)) s.days[date].push(occurrence(item, date));
  }
  s.draft = null;
  return s;
}
export function archiveHabit(input: State, id: string, date = today(input)) {
  const s = ensureDays(input, date),
    h = s.habits.find((h) => h.id === id);
  if (!h) return s;
  h.archivedAt = date;
  s.days[date] = (s.days[date] ?? []).filter(
    (o) => o.habitId !== id || o.check,
  );
  for (const d of Object.keys(s.days)) if (d > date) delete s.days[d];
  if (s.timer?.habitId === id) s.timer = null;
  return s;
}
export function draftOf(h: Habit, date: string): HabitDraft {
  const v = versionAt(h, addDays(date, 1));
  return {
    id: h.id,
    name: h.name,
    icon: h.icon,
    area: h.area,
    reason: h.reason,
    type: h.type,
    unit: h.unit,
    full: v.full, tiny: v.tiny, days: [...v.days], cue: v.cue, reminder: v.reminder,
  };
}
export const emptyDraft = (): HabitDraft => ({
  name: "",
  icon: "leaf",
  area: "Personal",
  reason: "",
  type: "count",
  unit: "times",
  full: 1,
  tiny: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  cue: "",
  reminder: "",
});
export const suggestions: HabitDraft[] = [
  {
    ...emptyDraft(),
    name: "Read a little",
    icon: "book",
    area: "Reading",
    type: "count",
    unit: "pages",
    full: 10,
    tiny: 1,
    cue: "After breakfast",
    reason: "Make room for a different perspective.",
  },
  {
    ...emptyDraft(),
    name: "Take a walk",
    icon: "walk",
    area: "Movement",
    type: "duration",
    unit: "minutes",
    full: 20,
    tiny: 2,
    days: [1, 3, 5, 0],
    cue: "After lunch",
    reason: "A little fresh air in my day.",
  },
  {
    ...emptyDraft(),
    name: "Practice English",
    icon: "learn",
    area: "Learning",
    type: "duration",
    unit: "minutes",
    full: 5,
    tiny: 1,
    days: [1, 2, 3, 4, 5],
    cue: "With my afternoon tea",
    reason: "Keep my curiosity moving.",
  },
  {
    ...emptyDraft(),
    name: "A moment to reflect",
    icon: "reflect",
    area: "Reflection",
    type: "count",
    unit: "sentences",
    full: 3,
    tiny: 1,
    cue: "Before bed",
  },
  {
    ...emptyDraft(),
    name: "Make space to focus",
    icon: "focus",
    area: "Focus",
    type: "duration",
    unit: "minutes",
    full: 15,
    tiny: 2,
    cue: "After I close my inbox",
  },
];
export function timerElapsed(timer: Timer, now = Date.now()) {
  return Math.min(
    timer.duration,
    timer.elapsed +
      (timer.startedAt === null
        ? 0
        : Math.max(0, (now - timer.startedAt) / 1000)),
  );
}
export function isReturn(s: State) {
  const last = Object.keys(s.days)
    .filter((d) => d < today(s) && s.days[d].length)
    .sort()
    .at(-1);
  return !!last && !s.days[last].some((o) => o.check) && xpTotal(s) > 0;
}
export const targetLabel = (
  o: Pick<Occurrence, "type" | "full" | "unit">,
  tiny?: number | null,
) =>
  o.type === "check"
    ? tiny != null
      ? "A tiny version"
      : "One check-in"
    : `${tiny ?? o.full} ${tiny === 1 || (tiny == null && o.full === 1) ? o.unit.replace(/s$/, "") : o.unit}`;
