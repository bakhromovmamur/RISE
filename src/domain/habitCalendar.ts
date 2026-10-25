import type { Habit, Occurrence, State, Version } from "../model";
import { addDays, today, weekday } from "./calendar";

export const versionAt = (h: Habit, date: string): Version =>
  [...h.versions].reverse().find((v) => v.effective <= date) || h.versions[0];
export const scheduled = (h: Habit, date: string) =>
  h.created <= date &&
  (!h.archivedAt || date < h.archivedAt) &&
  versionAt(h, date).days.includes(weekday(date));
export const occurrence = (h: Habit, date: string): Occurrence => {
  const v = versionAt(h, date);
  return {
    habitId: h.id,
    name: h.name,
    icon: h.icon,
    type: h.type,
    unit: h.unit,
    full: v.full,
    tiny: v.tiny,
    cue: v.cue,
  };
};
export function ensureDays(input: State, until = today(input)): State {
  const s = structuredClone(input);
  const starts = s.habits.map((h) => h.created).sort();
  if (!starts.length) return s;
  // Historical snapshots are immutable once captured; only unmaterialized dates use current versions.
  for (
    let d = starts[0], i = 0;
    d <= until && i < 20000;
    d = addDays(d, 1), i++
  )
    if (!s.days[d])
      s.days[d] = s.habits
        .filter((h) => scheduled(h, d))
        .map((h) => occurrence(h, d));
  return s;
}
export const countDay = (rows: Occurrence[]) => ({
  scheduled: rows.length,
  checked: rows.filter((o) => o.check).length,
  full: rows.filter((o) => o.check === "full").length,
  tiny: rows.filter((o) => o.check === "tiny").length,
});
export function weekStats(s: State, start: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const rows =
      s.days[date] ??
      (date > today(s)
        ? s.habits
            .filter((h) => scheduled(h, date))
            .map((h) => occurrence(h, date))
        : []);
    return { date, rows, ...countDay(rows) };
  });
  const full = days.reduce((a, d) => a + d.full, 0),
    tiny = days.reduce((a, d) => a + d.tiny, 0),
    total = days.reduce((a, d) => a + d.scheduled, 0);
  return {
    days,
    full,
    tiny,
    checked: full + tiny,
    total,
    rate: total ? ((full + tiny) / total) * 100 : null,
  };
}
