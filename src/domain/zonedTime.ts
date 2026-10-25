/** Civil dates and clocks are always resolved in the selected IANA zone. */
// A formatter can resolve every instant in its explicit zone, including DST.
// Reusing it avoids repeated locale setup during historical prayer rendering;
// no dates, offsets, prayer windows, or private state are cached.
const formatters = new Map<string, { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();
function formats(timezone: string) {
  const cached = formatters.get(timezone);
  if (cached) return cached;
  const next = {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
  if (formatters.size >= 32) formatters.delete(formatters.keys().next().value!);
  formatters.set(timezone, next);
  return next;
}
export function validCivilDate(date: string) {
  const at = Date.parse(`${date}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === date;
}
export function dateInZone(instant: Date | number, timezone: string) {
  const parts = formats(timezone).date.formatToParts(instant);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function timeInZone(instant: Date | number, timezone: string) {
  return formats(timezone).time.format(instant);
}
export const canonicalZone = (timezone: string) => new Intl.DateTimeFormat("en", { timeZone: timezone }).resolvedOptions().timeZone;

/** Gaps/skipped dates have no instant. Repeated clocks use their first occurrence. */
export function wallTimeInstant(date: string, time: string, zone: string): number | null {
  if (!validCivilDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const desired = Date.parse(`${date}T${time}:00Z`);
  try {
    const local = (at: number) => Date.parse(`${dateInZone(at, zone)}T${timeInZone(at, zone)}:00Z`);
    const candidates = [-86400000, 0, 86400000].map(shift => {
      const at = desired + shift;
      return desired - (local(at) - at);
    }).filter(at => local(at) === desired);
    return candidates.length ? Math.min(...candidates) : null;
  } catch { return null; }
}

export function manualPrayerWindow(date: string, entry: { begins: string; target: string; ends: string }, zone: string) {
  if (!validCivilDate(date)) return null;
  const tomorrow = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const start = wallTimeInstant(date, entry.begins, zone);
  const target = wallTimeInstant(entry.target < entry.begins ? tomorrow : date, entry.target, zone);
  const end = wallTimeInstant(entry.ends <= entry.begins ? tomorrow : date, entry.ends, zone);
  return start === null || target === null || end === null || end <= start || target < start || target >= end ? null : { start, target, end };
}
