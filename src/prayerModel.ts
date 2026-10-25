import { PRAYERS, type PrayerId } from "./domain/prayerIds";
export { PRAYERS, type PrayerId } from "./domain/prayerIds";
import type { State } from "./model";
import { isPrayerExcluded } from "./domain/prayerPause";
import { manualPrayerWindow, timeInZone, validCivilDate } from "./domain/zonedTime";

export type PrayerCheck = "on_time" | "later" | "missed";
export type PrayerPhase = PrayerCheck | "upcoming" | "open" | "unconfirmed" | "paused";
export interface PrayerEntry {
  begins: string;
  target: string;
  ends: string;
  beginsAt?: string;
  targetAt?: string;
  endsAt?: string;
  check?: PrayerCheck;
  performedAt?: string;
  recordedAt?: string;
}
export interface PrayerDay {
  source: string;
  sample: boolean;
  timezone: string;
  calculationKey?: string;
  sunrise?: string;
  entries: Record<PrayerId, PrayerEntry>;
}
export interface FajrPlan {
  bedtime: string;
  wakeLead: number;
  backupMinutes: number;
  message: string;
  placement: "away" | "bedside";
  enabled: boolean;
  backupEnabled?: boolean; // Older plans use the device's existing backup preference.
}
export interface WorkBreak {
  date: string;
  prayer: PrayerId;
  stage: "save" | "away" | "returned";
  note: string;
  wrapUntil: number | null;
  wrapUsed: boolean;
}
export interface PrayerState {
  version: 1;
  started: string;
  demoMinute: number;
  days: Record<string, PrayerDay>;
  preferences: {
    place: "home" | "mosque";
    leadMinutes: number;
    style: "gentle" | "firm";
    reminders: boolean;
  };
  fajr: FajrPlan;
  prepared: Record<string, FajrPlan>;
  work: WorkBreak | null;
}
export interface PrayerMoment { date: string; minute: number; instant?: number }
export const prayerName = (id: PrayerId) => PRAYERS.find((p) => p.id === id)!.name;
export const minuteOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const clockText = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};
export function prayerDateAdd(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dateDifference = (a: string, b: string) =>
  Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);

export function prayerMoment(s: Pick<State, "mode" | "demoDate" | "timezone" | "prayers">, now = new Date()): PrayerMoment {
  if (s.mode === "demo") return { date: s.demoDate, minute: s.prayers.demoMinute };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: get("year") + "-" + get("month") + "-" + get("day"),
    minute: Number(get("hour")) * 60 + Number(get("minute")),
    instant: +now,
  };
}
export function samplePrayerDay(timezone: string): PrayerDay {
  const begins = ["05:20", "12:20", "15:45", "17:45", "19:05"];
  const ends = ["06:40", "15:45", "17:45", "19:05", "23:30"];
  return {
    source: "Illustrative timetable", sample: true, timezone,
    entries: Object.fromEntries(PRAYERS.map((p, i) => [
      p.id, { begins: begins[i], target: begins[i], ends: ends[i] },
    ])) as PrayerDay["entries"],
  };
}
export function makePrayerState(mode: State["mode"], date: string, timezone: string, seed = true): PrayerState {
  const p: PrayerState = {
    version: 1, started: mode === "demo" && seed ? "2026-10-12" : date,
    demoMinute: 15 * 60 + 45, days: {},
    preferences: { place: "home", leadMinutes: 10, style: "firm", reminders: true },
    fajr: { bedtime: "22:30", wakeLead: 10, backupMinutes: 3,
      message: "Feet on the floor. Make space for Fajr.", placement: "away", enabled: true },
    prepared: {}, work: null,
  };
  if (mode !== "demo") return p;
  for (let d = p.started; d <= date; d = prayerDateAdd(d, 1)) {
    const day = samplePrayerDay(timezone);
    if (seed && d < "2026-10-19") {
      for (const { id } of PRAYERS) {
        day.entries[id].check = "on_time";
        day.entries[id].performedAt = day.entries[id].target;
      }
      if (d === "2026-10-13" || d === "2026-10-16") day.entries.fajr.check = "later";
      if (d === "2026-10-14") day.entries.isha.check = "later";
      if (d === "2026-10-15") day.entries.asr.check = "missed";
      for (const { id } of PRAYERS)
        if (day.entries[id].check !== "on_time") delete day.entries[id].performedAt;
    }
    p.days[d] = day;
  }
  if (seed && p.days["2026-10-19"]) {
    p.days["2026-10-19"].entries.fajr.check = "on_time";
    p.days["2026-10-19"].entries.dhuhr.check = "on_time";
  }
  return p;
}
// A v1 habit-only export is upgraded once, without touching its habits or logs.
export function migratePrayers(s: State, seedDemoHistory = true): State {
  const legacy = s as State & { prayers?: PrayerState };
  if (legacy.prayers) return ensurePrayerDays({ ...s, schema: 4 });
  const date = s.mode === "demo" ? s.demoDate :
    new Intl.DateTimeFormat("en-CA", { timeZone: s.timezone }).format(new Date());
  return ensurePrayerDays({ ...s, schema: 4, prayers: makePrayerState(s.mode, date, s.timezone, seedDemoHistory) });
}
export function ensurePrayerDays(s: State, date = s.demoDate): State {
  if (s.mode !== "demo") return s;
  const missing: string[] = [];
  for (let d = s.prayers.started; d <= date; d = prayerDateAdd(d, 1))
    if (!s.prayers.days[d]) missing.push(d);
  if (!missing.length) return s;
  const days = { ...s.prayers.days };
  for (const d of missing) days[d] = samplePrayerDay(s.timezone);
  return { ...s, prayers: { ...s.prayers, days } };
}
export function getPrayerDay(s: State, date: string): PrayerDay | undefined {
  return s.prayers.days[date] ?? (s.mode === "demo" ? samplePrayerDay(s.timezone) : undefined);
}
/** Clock-only legacy edits and changed timezone rules are indistinguishable. */
export function prayerDayOrigin(day: PrayerDay): "manual" | "calculated" | "review" {
  if (!day.calculationKey) return "manual";
  try {
    const key: unknown = JSON.parse(day.calculationKey);
    if (!Array.isArray(key)) return "calculated";
    const settings: unknown = key[0];
    if (!settings || typeof settings !== "object" || !("label" in settings) || !("method" in settings) || !("madhab" in settings)) return "calculated";
    if (day.source !== `${settings.label} · ${settings.method} · ${settings.madhab}`) return "manual";
    const changed = PRAYERS.some(({ id }) => {
      const entry = day.entries[id];
      return !entry.check && (["begins", "target", "ends"] as const).some(field => {
        const at = entry[`${field}At`];
        return !at || timeInZone(Date.parse(at), day.timezone) !== entry[field];
      });
    });
    return changed ? "review" : "calculated";
  } catch { return "calculated"; }
}
export const isManualPrayerDay = (day: PrayerDay) => prayerDayOrigin(day) === "manual";
/** Retain saved history, but never present an obsolete location as today's plan. */
export function getCurrentPrayerDay(s: State, date: string): PrayerDay | undefined {
  const day = getPrayerDay(s, date);
  if (day && prayerDayOrigin(day) === "review") return undefined;
  return day?.calculationKey && s.life.calculation && day.calculationKey !== JSON.stringify([s.life.calculation, s.life.setup.offsets]) && !isManualPrayerDay(day) ? undefined : day;
}
export const endMinute = (p: PrayerEntry) => {
  const end = minuteOf(p.ends);
  return end <= minuteOf(p.begins) ? end + 1440 : end;
};
export function elapsedMinute(date: string, moment: PrayerMoment) {
  return dateDifference(moment.date, date) * 1440 + moment.minute;
}
/** One window comparison for views and commands, including saved travel dates. */
export function prayerWindowInstants(s: State, date: string, id: PrayerId) {
  const day = getPrayerDay(s, date), entry = day?.entries[id];
  if (!day || !entry) return null;
  if (!entry.check && prayerDayOrigin(day) === "review") return null;
  const authored = !entry.check && !!day.calculationKey && isManualPrayerDay(day);
  const manual = !authored && entry.beginsAt && entry.targetAt && entry.endsAt ? null : manualPrayerWindow(date, entry, day.timezone);
  const start = !authored && entry.beginsAt ? Date.parse(entry.beginsAt) : manual?.start;
  const target = !authored && entry.targetAt ? Date.parse(entry.targetAt) : manual?.target;
  const end = !authored && entry.endsAt ? Date.parse(entry.endsAt) : manual?.end;
  if (start === undefined || target === undefined || end === undefined || ![start, target, end].every(Number.isFinite) || end <= start || target < start || target >= end) return null;
  return { start, target, end };
}
export function prayerWindowState(s: State, date: string, id: PrayerId, moment = prayerMoment(s)) {
  const day = getPrayerDay(s, date), entry = day?.entries[id];
  if (!day || !entry || (!entry.check && prayerDayOrigin(day) === "review")) return null;
  if (s.mode !== "demo" && moment.instant !== undefined) {
    const window = prayerWindowInstants(s, date, id);
    if (!window) return null;
    return { started: moment.instant >= window.start, ended: moment.instant >= window.end, targetInMinutes: (window.target - moment.instant) / 60000, performedAt: timeInZone(moment.instant, day.timezone) };
  }
  const elapsed = elapsedMinute(date, moment), start = minuteOf(entry.begins);
  const target = minuteOf(entry.target) < start ? minuteOf(entry.target) + 1440 : minuteOf(entry.target);
  return { started: elapsed >= start, ended: elapsed >= endMinute(entry), targetInMinutes: target - elapsed, performedAt: clockText(moment.minute) };
}
export function prayerPhase(s: State, date: string, id: PrayerId, moment = prayerMoment(s)): PrayerPhase {
  const entry = getPrayerDay(s, date)?.entries[id];
  if (!entry) return isPrayerExcluded(s, date, id) ? "paused" : date < moment.date ? "unconfirmed" : "upcoming";
  if (entry.check) return entry.check;
  if (isPrayerExcluded(s, date, id)) return "paused";
  const window = prayerWindowState(s, date, id, moment);
  if (!window) return date <= moment.date ? "unconfirmed" : "upcoming";
  if (!window.started) return "upcoming";
  return window.ended ? "unconfirmed" : "open";
}
export const phaseLabel: Record<PrayerPhase, string> = {
  on_time: "On time", later: "Prayed later", missed: "Missed",
  upcoming: "Upcoming", open: "Ready to record", unconfirmed: "Not recorded", paused: "Paused · private",
};
export function nextPrayer(s: State, moment = prayerMoment(s)) {
  // An overnight Isha window belongs to its original date.
  const yesterday = prayerDateAdd(moment.date, -1);
  const last = getCurrentPrayerDay(s, yesterday)?.entries.isha;
  if (last && !last.check && prayerPhase(s, yesterday, "isha", moment) === "open")
    return { id: "isha" as PrayerId, date: yesterday, entry: last, phase: "open" as PrayerPhase };
  const day = getCurrentPrayerDay(s, moment.date);
  if (!day) return null;
  const found = PRAYERS.find(({ id }) => prayerPhase(s, moment.date, id, moment) === "open") ??
    PRAYERS.find(({ id }) => prayerPhase(s, moment.date, id, moment) === "upcoming");
  return found ? { id: found.id, date: moment.date, entry: day.entries[found.id],
    phase: prayerPhase(s, moment.date, found.id, moment) } : null;
}
export function prayerProminence(s: State, moment = prayerMoment(s)) {
  const next = nextPrayer(s, moment);
  if (!next) return { next, level: "compact" as const, canRecord: false };
  const window = prayerWindowState(s, next.date, next.id, moment);
  const level = window && window.targetInMinutes <= 0 && !window.ended
    ? "due" : window && window.targetInMinutes > 0 && window.targetInMinutes <= s.prayers.preferences.leadMinutes ? "prepare" : "compact";
  return { next, level, canRecord: next.phase === "open" };
}
export function weeklyPrayers(s: State, start: string, moment = prayerMoment(s)) {
  const counts = { on_time: 0, later: 0, missed: 0, unconfirmed: 0, open: 0, upcoming: 0, noTimes: 0, paused: 0 };
  for (let i = 0; i < 7; i++) {
    const date = prayerDateAdd(start, i);
    if (date < s.prayers.started) continue;
    if (!getPrayerDay(s, date)) { counts.noTimes++; continue; }
    for (const { id } of PRAYERS) {
      const phase = date > moment.date && !s.prayers.days[date]?.entries[id].check && !prayerWindowState(s, date, id, moment)?.started ? "upcoming" : prayerPhase(s, date, id, moment);
      counts[phase]++;
    }
  }
  return counts;
}
export function recordPrayer(s: State, date: string, id: PrayerId, check: PrayerCheck | null, moment = prayerMoment(s), now = Date.now()): State {
  const day = getPrayerDay(s, date);
  if (!day || date < s.prayers.started || isPrayerExcluded(s, date, id)) return s;
  const entry = day.entries[id], window = prayerWindowState(s, date, id, moment);
  // Existing reports remain explicitly correctable after a clock/location change.
  // Creating a new report still requires the dated prayer window to have begun.
  if (!entry.check && (!window?.started || ((check === "missed" || check === "later") && !window.ended))) return s;
  if (entry.check === (check ?? undefined)) return s;
  const updated = { ...entry };
  delete updated.check;
  delete updated.performedAt;
  delete updated.recordedAt;
  if (check) {
    updated.check = check;
    updated.recordedAt = new Date(now).toISOString();
    if (check === "on_time" && window?.started && !window.ended)
      updated.performedAt = window.performedAt;
  }
  return { ...s, prayers: { ...s.prayers, days: { ...s.prayers.days,
    [date]: { ...day, entries: { ...day.entries, [id]: updated } },
  } } };
}

type StreakPoint = true | false | null | "not-due";
function streakFrom(points: StreakPoint[]) {
  let longest = 0, run = 0;
  for (const p of points) {
    if (p === true) longest = Math.max(longest, ++run);
    else if (p !== "not-due") run = 0;
  }
  let confirmed = 0, pending = false;
  for (const p of [...points].reverse()) {
    if (p === "not-due") continue;
    if (p === null) { pending = true; break; }
    if (p === false) break;
    confirmed++;
  }
  return { current: pending ? null : confirmed, confirmed, pending, longest };
}
export function prayerStreak(s: State, id: PrayerId | "all", moment = prayerMoment(s)) {
  const points: StreakPoint[] = [];
  for (let date = s.prayers.started; date <= moment.date; date = prayerDateAdd(date, 1)) {
    const day = getPrayerDay(s, date);
    const ids = id === "all" ? PRAYERS.map((p) => p.id) : [id];
    const checks = ids.map((prayerId): StreakPoint => {
      const e = day?.entries[prayerId];
      if (e?.check === "on_time") return true;
      if (e?.check) return false;
      if (isPrayerExcluded(s, date, prayerId)) return "not-due";
      const window = e && prayerWindowState(s, date, prayerId, moment);
      if (window && !window.ended) return "not-due";
      return date === moment.date && !e ? "not-due" : null;
    });
    points.push(checks.every((c) => c === true) ? true :
      checks.some((c) => c === false) ? false :
      checks.some((c) => c === null) ? null :
      checks.some((c) => c === "not-due") ? "not-due" : null);
  }
  return streakFrom(points);
}
export function prayerTotals(s: State) {
  let onTime = 0, later = 0, missed = 0, completeDays = 0;
  for (const day of Object.values(s.prayers.days)) {
    const entries = Object.values(day.entries);
    onTime += entries.filter((p) => p.check === "on_time").length;
    later += entries.filter((p) => p.check === "later").length;
    missed += entries.filter((p) => p.check === "missed").length;
    if (entries.every((p) => p.check === "on_time")) completeDays++;
  }
  return { onTime, later, missed, completeDays };
}
export function preparationDate(s: State, now = prayerMoment(s)) {
  const window = prayerWindowState(s, now.date, "fajr", now);
  return window && !window.started
    ? now.date : prayerDateAdd(now.date, 1);
}
/** Pause starts from the current window, including an already reported prayer. */
export function pausePoint(s: State, now = prayerMoment(s)): { date: string; prayer: PrayerId } {
  const date = prayerDateAdd(now.date, -1), overnight = prayerWindowState(s, date, "isha", now);
  if (date >= s.prayers.started && overnight?.started && !overnight.ended) return { date, prayer: "isha" };
  const prayer = PRAYERS.find(({ id }) => {
    const window = prayerWindowState(s, now.date, id, now);
    return window && !window.ended;
  })?.id ?? "fajr";
  return { date: now.date, prayer };
}
export function beginWorkBreak(s: State, id: PrayerId, date: string): State {
  const old = s.prayers.work;
  if (old && old.date === date && old.prayer === id) {
    if (old.stage !== "returned") return s;
    return { ...s, prayers: { ...s.prayers, work: { ...old, stage: "save" } } };
  }
  return { ...s, prayers: { ...s.prayers, work: {
    date, prayer: id, stage: "save", note: old?.note ?? "", wrapUntil: null, wrapUsed: false,
  } } };
}
export function startWrapUp(s: State, now = Date.now()): State {
  const work = s.prayers.work;
  if (!work || work.stage !== "save" || work.wrapUsed) return s;
  return { ...s, prayers: { ...s.prayers, work: { ...work, wrapUntil: now + 60000, wrapUsed: true } } };
}
export const wrapRemaining = (work: WorkBreak, now = Date.now()) =>
  work.wrapUntil === null ? null : Math.min(60, Math.max(0, Math.ceil((work.wrapUntil - now) / 1000)));

export function validateTimetable(day: PrayerDay, date?: string) {
  if (!day.source.trim()) return "Add the name of the timetable you follow.";
  if (date !== undefined && !validCivilDate(date)) return "Choose a valid date.";
  let previous = -1;
  for (const { id, name } of PRAYERS) {
    const p = day.entries[id];
    if (![p.begins, p.target, p.ends].every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
      return "Enter all three times for " + name + ".";
    const start = minuteOf(p.begins), target = minuteOf(p.target);
    const end = endMinute(p);
    if (start <= previous) return "Prayer start times must follow the order shown.";
    if (id !== "isha" && minuteOf(p.ends) <= start) return "Check the end time for " + name + ".";
    const planned = target < start && id === "isha" ? target + 1440 : target;
    if (planned < start || planned >= end) return name + "’s planned time must be inside its entered window.";
    previous = start;
  }
  for (let i = 0; i < 4; i++) {
    if (endMinute(day.entries[PRAYERS[i].id]) > minuteOf(day.entries[PRAYERS[i + 1].id].begins))
      return "Check the overlapping windows for " + PRAYERS[i].name + " and " + PRAYERS[i + 1].name + ".";
  }
  if (date !== undefined && PRAYERS.some(({ id }) => !manualPrayerWindow(date, day.entries[id], day.timezone)))
    return "These times do not exist on this date in the selected time zone. Check the date, time zone and timetable.";
  return "";
}
export function saveTimetable(s: State, date: string, day: PrayerDay): State {
  if (!validCivilDate(date) || validateTimetable(day, day.sample ? undefined : date)) return s;
  const prior = s.prayers.days[date];
  const entries = Object.fromEntries(PRAYERS.map(({ id }) => {
    const { begins, target, ends } = day.entries[id];
    const window = day.sample ? null : manualPrayerWindow(date, day.entries[id], day.timezone);
    return [id, { begins, target, ends, ...(window ? { beginsAt: new Date(window.start).toISOString(), targetAt: new Date(window.target).toISOString(), endsAt: new Date(window.end).toISOString() } : {}) }];
  })) as PrayerDay["entries"];
  // Corrections to a timetable never rewrite an already reported prayer.
  for (const { id } of PRAYERS) if (prior?.entries[id].check) entries[id] = { ...prior.entries[id] };
  // A manual save owns only this date. Stale calculation keys/instants and
  // caller-supplied prayer records must not survive as authored timetable data.
  const manual: PrayerDay = { source: day.source.trim(), sample: day.sample, timezone: day.timezone, sunrise: day.entries.fajr.ends, entries };
  return { ...s, prayers: { ...s.prayers, days: { ...s.prayers.days, [date]: manual } } };
}
export function prayerScene(s: State, scene: string): State {
  if (s.mode !== "demo") return s;
  s = structuredClone(s);
  const day = s.prayers.days[s.demoDate] ?? samplePrayerDay(s.timezone);
  s.prayers.days[s.demoDate] = day;
  if (scene === "prepare") {
    s.prayers.demoMinute = 15 * 60 + 35;
  } else if (scene === "morning") {
    s.prayers.demoMinute = 325;
    PRAYERS.forEach(({ id }) => {
      delete day.entries[id].check;
      delete day.entries[id].performedAt;
      delete day.entries[id].recordedAt;
    });
    s.prayers.prepared[s.demoDate] = { ...s.prayers.fajr };
  } else if (scene === "evening" || scene === "prayer-complete") {
    s.prayers.demoMinute = scene === "evening" ? 21 * 60 : 19 * 60 + 30;
    PRAYERS.forEach(({ id }) => { day.entries[id].check = "on_time"; });
  } else if (scene === "gap") {
    const previous = s.prayers.days[prayerDateAdd(s.demoDate, -1)];
    if (previous) delete previous.entries.fajr.check;
  }
  return s;
}
