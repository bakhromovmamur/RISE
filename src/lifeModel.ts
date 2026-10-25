import { activePause, isPrayerExcluded, prayerKey, startPause } from "./domain/prayerPause";
export { prayerKey, activePause, isPrayerExcluded, startPause, resumePrayers } from "./domain/prayerPause";
import type { State } from "./model";
import { addDays, today, weekday, weekStart } from "./domain/calendar";
import { PRAYERS, clockText, minuteOf, prayerWindowInstants, saveTimetable, type PrayerDay, type PrayerId } from "./prayerModel";
import { timeInZone } from "./domain/zonedTime";

import type { Language } from "./i18n";
import type { CalculationSettings } from "./prayerCalculation";
export type { Language } from "./i18n";
export type Readiness = "ready" | "permission" | "coverage" | "waiting";
export interface PrayerPause { id: string; from: string; through?: string }
export interface DemoMember { id: string; name: string; role: "owner" | "member" }
export interface LocalGroup {
  id: string; name: string; kind: "family" | "squad"; members: DemoMember[];
  archived?: boolean; left?: boolean; muted: boolean; quietStart: string; quietEnd: string;
  invitations: { id: string; code: string; expires: string; revoked?: boolean; accepted?: boolean }[];
}
export interface FamilyTask {
  id: string; groupId: string; title: string; notes: string; assignee: string;
  date: string; time: string; weekdays: number[]; archived?: boolean;
  completions: Record<string, { by: string; at: string }>;
}
export interface SharedList {
  id: string; groupId: string; name: string; archived?: boolean;
  items: { id: string; text: string; quantity: string; checked: boolean }[];
}
export interface SquadUpdate {
  id: string; groupId: string; memberId: string; week: string; note: string;
  habits?: number; milestones?: string[]; prayers?: number;
  reactions: Record<string, string>;
}
export interface LifeState {
  language: Language;
  calculation?: CalculationSettings;
  deviceTimezone?: { observed: string; reviewed?: string };
  delivery?: { enabled: boolean; sound: boolean; acknowledgedFajr: string[] };
  setup: { configured: boolean; city: string; source: "local" | "calculated"; offsets: Record<PrayerId, number> };
  reminderRules: Record<PrayerId, { preparation: boolean; due: boolean }>;
  readiness: Readiness;
  backupEnabled: boolean;
  alarm: { date: string; stage: "ringing" | "stopped" | "awake"; backup: boolean } | null;
  pauses: PrayerPause[];
  groups: LocalGroup[];
  tasks: FamilyTask[];
  lists: SharedList[];
  updates: SquadUpdate[];
  drafts: Record<string, unknown>;
}

export function makeLifeState(): LifeState {
  return {
    language: "en",
    setup: { configured: false, city: "Tashkent", source: "local", offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } },
    reminderRules: Object.fromEntries(PRAYERS.map(({ id }) => [id, { preparation: id !== "fajr", due: true }])) as LifeState["reminderRules"],
    readiness: "permission", backupEnabled: false, alarm: null, pauses: [],
    groups: [], tasks: [], lists: [], updates: [], drafts: {},
  };
}
// Deliberately authored fixtures, not downloaded or calculated prayer times.
export const CITIES = ["Tashkent", "Samarkand", "Bukhara"] as const;
export function illustrativeDay(city: string, source: "local" | "calculated", offsets: LifeState["setup"]["offsets"]): PrayerDay {
  const shift = city === "Samarkand" ? 8 : city === "Bukhara" ? 17 : 0;
  const starts = [320, 740, 945, 1065, 1145].map((n) => n + shift + (source === "calculated" ? 2 : 0));
  const ends = [400 + shift, starts[2], starts[3], starts[4], starts[0] + 1440];
  return {
    sample: true, timezone: "Asia/Tashkent",
    source: `${city} · ${source === "local" ? "local timetable" : "calculation"} preview · illustrative`,
    entries: Object.fromEntries(PRAYERS.map(({ id }, i) => [id, {
      begins: clockText(starts[i]), target: clockText(Math.min(starts[i] + Math.max(0, offsets[id]), ends[i] - 1)), ends: clockText(ends[i]),
    }])) as PrayerDay["entries"],
  };
}
export function applyPrayerSetup(input: State, setup: LifeState["setup"], date = today(input)) {
  let s = { ...input, life: { ...input.life, setup: { ...setup, configured: true } } };
  for (let i = 0; i < 8; i++) s = saveTimetable(s, addDays(date, i), illustrativeDay(setup.city, setup.source, setup.offsets));
  return s;
}
export function alarmTimes(s: State, date: string, plan = s.prayers.prepared[date] ?? s.prayers.fajr, minimumBackupMinutes = 0) {
  const day = s.prayers.days[date];
  if (!day) return null;
  if (s.mode !== "demo") {
    const window = prayerWindowInstants(s, date, "fajr");
    if (!window) return null;
    const wake = window.start - plan.wakeLead * 60000;
    return { begins: day.entries.fajr.begins, wake: timeInZone(wake, day.timezone), backup: timeInZone(wake + Math.max(minimumBackupMinutes, plan.backupMinutes || 3) * 60000, day.timezone) };
  }
  const wake = minuteOf(day.entries.fajr.begins) - plan.wakeLead;
  return { begins: day.entries.fajr.begins, wake: clockText(wake), backup: clockText(wake + (plan.backupMinutes || 3)) };
}
export const availableGroups = (s: State) => s.life.groups.filter((g) => !g.archived && !g.left);
export const taskOccurs = (task: FamilyTask, date: string) => !task.archived && (task.weekdays.length ? date >= task.date && task.weekdays.includes(weekday(date)) : date === task.date);
export function availableTasks(s: State, date: string) {
  const ids = new Set(availableGroups(s).filter((g) => g.kind === "family").map((g) => g.id));
  return s.life.tasks.filter((task) => ids.has(task.groupId) && taskOccurs(task, date));
}
export function completeTask(input: State, id: string, date: string, done: boolean): State {
  const s = structuredClone(input), task = s.life.tasks.find((t) => t.id === id);
  if (!task || !taskOccurs(task, date) || !availableGroups(s).some((g) => g.id === task.groupId)) return input;
  if (done) task.completions[date] ??= { by: "self", at: new Date().toISOString() };
  else delete task.completions[date];
  return s;
}
export function createGroup(s: State, kind: LocalGroup["kind"], name: string): State {
  if (!name.trim()) return s;
  return { ...s, life: { ...s.life, groups: [...s.life.groups, {
    id: crypto.randomUUID(), name: name.trim(), kind, members: [{ id: "self", name: s.name, role: "owner" }],
    muted: false, quietStart: "22:00", quietEnd: "08:00", invitations: [],
  }] } };
}
export function addLifeDemo(input: State, scene = "daily-life"): State {
  let s = structuredClone(input);
  s.life = makeLifeState();
  s.life.setup.configured = true;
  s.life.readiness = "ready";
  s.life.backupEnabled = true;
  const date = today(s);
  // Only new future dates are installed; the balanced day's recorded history stays exact.
  for (let i = 1; i < 8; i++) s.prayers.days[addDays(date, i)] = illustrativeDay("Tashkent", "local", s.life.setup.offsets);
  s.life.groups = [
    { id: "family", kind: "family", name: "Our family", members: [{ id: "self", name: s.name, role: "owner" }, { id: "amina", name: "Amina", role: "member" }, { id: "aziz", name: "Aziz", role: "member" }], muted: false, quietStart: "22:00", quietEnd: "08:00", invitations: [] },
    { id: "squad", kind: "squad", name: "Small steps together", members: [{ id: "self", name: s.name, role: "owner" }, { id: "aziz", name: "Aziz", role: "member" }, { id: "sara", name: "Sara", role: "member" }], muted: false, quietStart: "22:00", quietEnd: "08:00", invitations: [] },
  ];
  s.life.tasks = [
    { id: "weekend", groupId: "family", title: "Choose our weekend outing", notes: "Somewhere outdoors, with time for a slow lunch.", assignee: "self", date, time: "19:30", weekdays: [], completions: {} },
    { id: "groceries", groupId: "family", title: "Pick up groceries", notes: "The shared list is ready.", assignee: "amina", date, time: "18:00", weekdays: [], completions: {} },
    { id: "tea", groupId: "family", title: "Make time for tea together", notes: "Phones away for a little while.", assignee: "", date, time: "20:30", weekdays: [0, 1, 2, 3, 4, 5, 6], completions: {} },
  ];
  s.life.lists = [{ id: "shopping", groupId: "family", name: "For the week", items: [
    { id: "apples", text: "Apples", quantity: "1 kg", checked: false },
    { id: "bread", text: "Fresh bread", quantity: "2", checked: false },
    { id: "tea", text: "Green tea", quantity: "1 pack", checked: true },
    { id: "yogurt", text: "Yogurt", quantity: "", checked: false },
  ] }];
  s.life.updates = [
    { id: "aziz-update", groupId: "squad", memberId: "aziz", week: weekStart(date), note: "A short walk after lunch made it easier to start again. Keeping that one.", habits: 4, reactions: { sara: "encourage" } },
    { id: "sara-update", groupId: "squad", memberId: "sara", week: weekStart(date), note: "Finished the first screen of my little project. One step at a time.", milestones: ["Build the first working screen"], reactions: {} },
  ];
  if (scene === "prayer-pause") s = startPause(s, date, "asr");
  if (scene === "needs-attention") s.life.readiness = "waiting";
  if (scene === "fajr-morning") {
    s.prayers.demoMinute = 310;
    for (const { id } of PRAYERS) {
      const p = s.prayers.days[date].entries[id];
      delete p.check; delete p.performedAt; delete p.recordedAt;
    }
    s.life.alarm = { date, stage: "ringing", backup: false };
  }
  return s;
}
