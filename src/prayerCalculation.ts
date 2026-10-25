import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from "adhan";
import tzLookup from "tz-lookup";
import type { State } from "./model";
import { PRAYERS, prayerDayOrigin, prayerDateAdd, type PrayerDay, type PrayerId } from "./prayerModel";
import { dateInZone, timeInZone, validCivilDate } from "./domain/zonedTime";
export { dateInZone, timeInZone } from "./domain/zonedTime";

export const METHODS = ["Karachi", "MuslimWorldLeague", "NorthAmerica", "Egyptian", "UmmAlQura", "MoonsightingCommittee", "Singapore", "Tehran"] as const;
export type CalculationSettings = {
  latitude: number; longitude: number; timezone: string; label: string;
  method: typeof METHODS[number]; madhab: "Hanafi" | "Shafi";
  highLatitude: "MiddleOfTheNight" | "SeventhOfTheNight" | "TwilightAngle";
};
export const LOCATIONS = [
  { label: "Tashkent", latitude: 41.2995, longitude: 69.2401, timezone: "Asia/Tashkent" },
  { label: "Samarkand", latitude: 39.6542, longitude: 66.9597, timezone: "Asia/Samarkand" },
  { label: "Bukhara", latitude: 39.7681, longitude: 64.4556, timezone: "Asia/Samarkand" },
  { label: "London", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { label: "New York", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
  { label: "Istanbul", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" },
  { label: "Dubai", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
  { label: "Makkah", latitude: 21.4225, longitude: 39.8262, timezone: "Asia/Riyadh" },
  { label: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869, timezone: "Asia/Kuala_Lumpur" },
  { label: "Sydney", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" },
];
export const defaultCalculation = (): CalculationSettings => ({ ...LOCATIONS[0], method: "Karachi", madhab: "Hanafi", highLatitude: "MiddleOfTheNight" });
export function zoneAt(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error("Enter valid latitude and longitude.");
  return tzLookup(latitude, longitude);
}
export function validateCalculation(settings: CalculationSettings) {
  if (!settings || !Number.isFinite(settings.latitude) || !Number.isFinite(settings.longitude) || Math.abs(settings.latitude) > 90 || Math.abs(settings.longitude) > 180)
    return "Enter valid latitude and longitude.";
  if (!settings.label.trim()) return "Give this location a name.";
  if (!METHODS.includes(settings.method) || !["Hanafi", "Shafi"].includes(settings.madhab) || !["MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle"].includes(settings.highLatitude))
    return "Choose a calculation method and Asr convention.";
  try { dateInZone(Date.now(), settings.timezone); } catch { return "Enter a valid time zone, such as Asia/Tashkent."; }
  return "";
}

/** Adhan receives civil date components; returned instants are absolute UTC dates.
 * Formatting only happens at the edge, using the location's IANA zone (including DST).
 */
export function calculatePrayerDay(date: string, settings: CalculationSettings, offsets: Record<PrayerId, number>): PrayerDay {
  const error = validateCalculation(settings);
  if (error) throw new Error(error);
  if (!validCivilDate(date)) throw new Error("Choose a valid date.");
  const params = CalculationMethod[settings.method]();
  params.madhab = Madhab[settings.madhab];
  params.highLatitudeRule = HighLatitudeRule[settings.highLatitude];
  const coordinates = new Coordinates(settings.latitude, settings.longitude);
  const timesFor = (day: string) => {
    const calculate = (solarDate: string) => {
      const [year, month, dayOfMonth] = solarDate.split("-").map(Number);
      return new PrayerTimes(coordinates, new Date(year, month - 1, dayOfMonth, 12), params);
    };
    let result = calculate(day);
    // Across the date line, the solar UTC date can differ from the civil date.
    // Recalculate the adjacent solar date; never shift or invent solar instants.
    if (Number.isFinite(+result.dhuhr)) {
      const actual = dateInZone(result.dhuhr, settings.timezone);
      if (actual !== day) result = calculate(prayerDateAdd(day, actual > day ? -1 : 1));
    }
    return result;
  };
  const times = timesFor(date), tomorrow = timesFor(prayerDateAdd(date, 1));
  const sequence = [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha, tomorrow.fajr];
  if (sequence.some((time, i) => !Number.isFinite(+time) || (i > 0 && +time <= +sequence[i - 1])) || dateInZone(times.dhuhr, settings.timezone) !== date)
    throw new Error("Prayer times are unavailable for this date and location. Use a trusted manual timetable.");
  const ends = { fajr: times.sunrise, dhuhr: times.asr, asr: times.maghrib, maghrib: times.isha, isha: tomorrow.fajr };
  const entries = Object.fromEntries(PRAYERS.map(({ id }) => {
    const offset = offsets[id];
    if (!Number.isFinite(offset) || offset < 0 || offset > 120) throw new Error("Planned offsets must be between 0 and 120 minutes.");
    const start = times[id], end = ends[id];
    const target = new Date(Math.min(+start + offset * 60000, +end - 60000));
    return [id, { begins: timeInZone(start, settings.timezone), target: timeInZone(target, settings.timezone), ends: timeInZone(end, settings.timezone), beginsAt: start.toISOString(), targetAt: target.toISOString(), endsAt: end.toISOString() }];
  })) as PrayerDay["entries"];
  return { sample: false, source: `${settings.label} · ${settings.method} · ${settings.madhab}`, timezone: settings.timezone,
    calculationKey: JSON.stringify([settings, offsets]), sunrise: timeInZone(times.sunrise, settings.timezone), entries };
}

/** Refresh only calculated/unconfigured dates; never replace manual dates or logged entries. */
export function refreshCalculatedPrayers(input: State, now = Date.now(), replaceSamples = false): State {
  const settings = input.life?.calculation;
  if (input.mode === "demo" || !settings || validateCalculation(settings)) return input;
  const start = dateInZone(now, settings.timezone);
  const signature = JSON.stringify([settings, input.life.setup.offsets]);
  let days = input.prayers.days, changed = false;
  for (let i = 0; i < 30; i++) {
    const date = prayerDateAdd(start, i), prior = days[date];
    if (prior && ((!prior.calculationKey && !(replaceSamples && prior.sample)) || prior.calculationKey === signature)) continue;
    if (prior?.calculationKey && prayerDayOrigin(prior) !== "calculated") continue;
    let day: PrayerDay;
    try { day = calculatePrayerDay(date, settings, input.life.setup.offsets); } catch { continue; }
    for (const { id } of PRAYERS) if (prior?.entries[id].check) day.entries[id] = { ...prior.entries[id] };
    if (!changed) days = { ...days };
    days[date] = day; changed = true;
  }
  return changed ? { ...input, prayers: { ...input.prayers, days } } : input;
}
export function useCalculatedPrayers(input: State, settings: CalculationSettings, offsets: Record<PrayerId, number>, now = Date.now()): State {
  // Validate before changing the saved profile; failure leaves it untouched.
  const date = dateInZone(now, settings.timezone);
  calculatePrayerDay(date, settings, offsets);
  const next = { ...input, mode: "fresh" as const, timezone: settings.timezone,
    prayers: { ...input.prayers, started: input.prayers.started > date ? date : input.prayers.started },
    life: { ...input.life, calculation: { ...settings }, setup: { ...input.life.setup, configured: true, city: settings.label, source: "calculated" as const, offsets: { ...offsets } } } };
  return refreshCalculatedPrayers(next, now, true);
}
