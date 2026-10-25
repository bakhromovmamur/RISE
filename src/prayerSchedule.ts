import type { State } from "./model";
import { isPrayerExcluded } from "./lifeModel";
import { PRAYERS, getCurrentPrayerDay, isManualPrayerDay, prayerWindowInstants, type PrayerId } from "./prayerModel";
export { wallTimeInstant } from "./domain/zonedTime";

export type PrayerAlert = {
  id: number; key: string; date: string; prayer: PrayerId;
  kind: "prepare" | "due" | "wake" | "backup"; at: number; expiresAt: number;
};
export const deliveryPreferences = (s: State) => s.life.delivery ?? { enabled: false, sound: true, acknowledgedFajr: [] };
const identifier = (key: string) => {
  let value = 2166136261;
  for (const c of key) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return 100000000 + ((value >>> 0) % 1900000000);
};

/** Pure plan. No permission requests, delivery, prayer records, or XP side effects. */
export function buildPrayerSchedule(s: State, now = Date.now(), minimumBackupMinutes = 0): PrayerAlert[] {
  const preferences = deliveryPreferences(s);
  if (s.mode === "demo" || !preferences.enabled) return [];
  const events: PrayerAlert[] = [];
  const add = (date: string, prayer: PrayerId, kind: PrayerAlert["kind"], at: number | null, expiresAt: number) => {
    if (at === null || !Number.isFinite(at) || at <= now || at >= expiresAt) return;
    const key = `rise:${date}:${prayer}:${kind}`;
    events.push({ id: identifier(key), key, date, prayer, kind, at, expiresAt });
  };
  for (const [date, day] of Object.entries(s.prayers.days)) {
    if (day.sample) continue;
    // A partially resolvable manual date is unavailable, rather than a partial
    // alert plan. This also protects legacy manual data created before validation.
    const manual = isManualPrayerDay(day);
    if (manual && PRAYERS.some(({ id }) => {
      const entry = day.entries[id];
      if (!entry) return true;
      if (entry.check) return false;
      return !prayerWindowInstants(s, date, id);
    })) continue;
    // A time-zone change can leave yesterday's old-location Isha in the future.
    // Retain that history, but never deliver a stale calculated schedule.
    if (!getCurrentPrayerDay(s, date)) continue;
    for (const { id } of PRAYERS) {
      const entry = day.entries[id];
      if (!entry || entry.check || isPrayerExcluded(s, date, id)) continue;
      const window = prayerWindowInstants(s, date, id);
      if (!window) continue;
      const { start, target, end } = window;
      if (s.prayers.preferences.reminders) {
        if (s.life.reminderRules[id].preparation) add(date, id, "prepare", target - s.prayers.preferences.leadMinutes * 60000, target);
        if (s.life.reminderRules[id].due) add(date, id, "due", target, end);
      }
      const plan = s.prayers.prepared[date] ?? s.prayers.fajr;
      if (id !== "fajr" || !plan.enabled || preferences.acknowledgedFajr.includes(date)) continue;
      if (!Number.isFinite(plan.wakeLead) || plan.wakeLead < 0 || plan.wakeLead > 120) continue;
      const wake = start - plan.wakeLead * 60000;
      add(date, id, "wake", wake, end);
      if ((plan.backupEnabled ?? s.life.backupEnabled) && Number.isFinite(plan.backupMinutes) && plan.backupMinutes > 0)
        add(date, id, "backup", wake + Math.max(minimumBackupMinutes, plan.backupMinutes) * 60000, end);
    }
  }
  return events.sort((a, b) => a.at - b.at || a.id - b.id);
}

export function acknowledgeFajr(s: State, date: string): State {
  const prefs = deliveryPreferences(s);
  return { ...s, life: { ...s.life, alarm: { date, stage: "awake", backup: false }, delivery: {
    ...prefs, acknowledgedFajr: [...new Set([...prefs.acknowledgedFajr, date])].sort().slice(-90),
  } } };
}

export interface PendingAlert { id: number; extra?: { rise?: boolean; signature?: string } }
export interface SchedulePort {
  pending(): Promise<PendingAlert[]>;
  cancel(ids: number[]): Promise<void>;
  schedule(alerts: PrayerAlert[]): Promise<void>;
}
export const alertSignature = (event: PrayerAlert, variant: string) => `${event.key}:${event.at}:${variant}`;

/** Reconcile OS state rather than trusting a saved "ready" flag. Never cancel another feature's alerts. */
export async function reconcileDeviceAlerts(port: SchedulePort, events: PrayerAlert[], variant: string) {
  const pending = await port.pending();
  const otherCount = pending.filter(n => !n.extra?.rise).length;
  const desired = events.slice(0, Math.max(0, Math.min(60, 64 - otherCount)));
  const existing = pending.filter(n => n.extra?.rise);
  const valid = new Map(desired.map(event => [event.id, alertSignature(event, variant)]));
  const obsolete = existing.filter(n => valid.get(n.id) !== n.extra?.signature);
  if (obsolete.length) await port.cancel(obsolete.map(n => n.id));
  const kept = new Set(existing.filter(n => valid.get(n.id) === n.extra?.signature).map(n => n.id));
  const missing = desired.filter(event => !kept.has(event.id));
  if (missing.length) await port.schedule(missing);
  const verified = (await port.pending()).filter(n => n.extra?.rise && valid.get(n.id) === n.extra?.signature);
  if (verified.length !== desired.length) throw new Error("The device did not confirm every alert. Try scheduling again.");
  return desired;
}
