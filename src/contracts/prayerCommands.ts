import type { State } from "../model";
import type { PrayerDay, PrayerId, FajrPlan } from "../prayerModel";
import type { CalculationSettings } from "../prayerCalculation";
import * as v from "../data/validation";
import { exact } from "./personalCommands";

export type PrayerCommand =
  | { kind: "prayer.preferences"; changes: Partial<State["prayers"]["preferences"]> }
  | { kind: "prayer.reminder"; prayer: PrayerId; phase: "preparation" | "due"; enabled: boolean }
  | { kind: "prayer.sample-setup"; setup: State["life"]["setup"] }
  | { kind: "prayer.calculated-setup"; settings: CalculationSettings; offsets: Record<PrayerId, number> }
  | { kind: "prayer.timetable"; date: string; day: PrayerDay; preferences: State["prayers"]["preferences"] }
  | { kind: "prayer.location-reviewed"; timezone: string }
  | { kind: "fajr.plan"; date: string; plan: FajrPlan; backupEnabled?: boolean }
  | { kind: "fajr.alarm"; alarm: NonNullable<State["life"]["alarm"]> }
  | { kind: "delivery.preferences"; changes: { enabled?: boolean; sound?: boolean } }
  | { kind: "readiness.preview"; readiness: State["life"]["readiness"] };

const prefs = { place: v.oneOf("home", "mosque"), leadMinutes: v.number(0), style: v.oneOf("gentle", "firm"), reminders: v.bool };
const prayer = v.oneOf("fajr", "dhuhr", "asr", "maghrib", "isha");
const prayers = (check: v.Check) => exact({ fajr: check, dhuhr: check, asr: check, maghrib: check, isha: check });
const offsets = prayers(v.number(0, 120)), text = v.string(5000);
const fields: { [K in PrayerCommand["kind"]]: Record<string, v.Check> } = {
  "prayer.preferences": { changes: exact(Object.fromEntries(Object.entries(prefs).map(([key, check]) => [key, v.optional(check)]))) },
  "prayer.reminder": { prayer, phase: v.oneOf("preparation", "due"), enabled: v.bool },
  "prayer.sample-setup": { setup: exact({ configured: v.bool, city: v.string(160), source: v.oneOf("local", "calculated"), offsets }) },
  "prayer.location-reviewed": { timezone: v.zone },
  "prayer.calculated-setup": { settings: exact({ latitude: v.number(-90, 90), longitude: v.number(-180, 180), timezone: v.zone, label: v.string(160), method: v.oneOf("Karachi", "MuslimWorldLeague", "NorthAmerica", "Egyptian", "UmmAlQura", "MoonsightingCommittee", "Singapore", "Tehran"), madhab: v.oneOf("Hanafi", "Shafi"), highLatitude: v.oneOf("MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle") }), offsets },
  "prayer.timetable": { date: v.date, preferences: exact(prefs), day: exact({ source: text, sample: v.bool, timezone: v.zone, calculationKey: v.optional(text), sunrise: v.optional(v.clock), entries: prayers(exact({ begins: v.clock, target: v.clock, ends: v.clock, beginsAt: v.optional(v.instant), targetAt: v.optional(v.instant), endsAt: v.optional(v.instant), check: v.optional(v.oneOf("on_time", "later", "missed")), performedAt: v.optional(v.clock), recordedAt: v.optional(v.instant) })) }) },
  "fajr.plan": { date: v.date, plan: exact({ bedtime: v.clock, wakeLead: v.number(0, 120), backupMinutes: v.number(0, 120), message: text, placement: v.oneOf("away", "bedside"), enabled: v.bool, backupEnabled: v.optional(v.bool) }), backupEnabled: v.optional(v.bool) },
  "fajr.alarm": { alarm: exact({ date: v.date, stage: v.oneOf("ringing", "stopped", "awake"), backup: v.bool }) },
  "delivery.preferences": { changes: exact({ enabled: v.optional(v.bool), sound: v.optional(v.bool) }) },
  "readiness.preview": { readiness: v.oneOf("ready", "permission", "coverage", "waiting") },
};
export function isPrayerCommand(value: unknown): value is PrayerCommand {
  return !!value && typeof value === "object" && "kind" in value && typeof value.kind === "string" && Object.hasOwn(fields, value.kind);
}
export function parsePrayerCommand(value: PrayerCommand): PrayerCommand {
  exact({ kind: v.oneOf(value.kind), ...fields[value.kind] })(value, value.kind);
  return structuredClone(value);
}
