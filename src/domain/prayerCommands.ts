import type { State } from "../model";
import type { PrayerCommand } from "../contracts/prayerCommands";
import type { CommandContext } from "../contracts/personalCommands";
import { applyPrayerSetup } from "../lifeModel";
import { saveTimetable, validateTimetable } from "../prayerModel";
import { useCalculatedPrayers } from "../prayerCalculation";
import { deliveryPreferences } from "../prayerSchedule";
import { PersonalReferenceError } from "./personalCommands";

export function reducePrayerCommand(input: State, c: PrayerCommand, context: CommandContext): State {
  const s = structuredClone(input);
  switch (c.kind) {
    case "prayer.preferences": s.prayers.preferences = { ...s.prayers.preferences, ...c.changes }; return s;
    case "prayer.reminder": s.life.reminderRules[c.prayer][c.phase] = c.enabled; return s;
    case "prayer.sample-setup": return applyPrayerSetup(s, c.setup, context.date);
    case "prayer.calculated-setup": {
      const next = useCalculatedPrayers(s, c.settings, c.offsets, context.now);
      if (next.life.deviceTimezone) next.life.deviceTimezone = { observed: next.life.deviceTimezone.observed, reviewed: next.life.deviceTimezone.observed };
      return next;
    }
    case "prayer.location-reviewed":
      if (s.life.deviceTimezone?.observed !== c.timezone) throw new PersonalReferenceError();
      s.life.deviceTimezone.reviewed = c.timezone;
      return s;
    case "prayer.timetable": {
      const error = validateTimetable(c.day, c.date);
      if (error) throw new Error(error);
      const next = saveTimetable(s, c.date, { ...c.day, source: c.day.source.trim(), sample: s.mode === "demo" });
      next.prayers.preferences = c.preferences; return next;
    }
    case "fajr.plan":
      s.prayers.fajr = { ...c.plan, backupEnabled: c.backupEnabled ?? c.plan.backupEnabled ?? s.life.backupEnabled };
      s.prayers.prepared[c.date] = { ...s.prayers.fajr };
      if (c.backupEnabled !== undefined) s.life.backupEnabled = c.backupEnabled;
      return s;
    case "fajr.alarm":
      s.life.alarm = s.mode !== "demo" && deliveryPreferences(s).acknowledgedFajr.includes(c.alarm.date) ? { ...c.alarm, stage: "awake" } : c.alarm;
      return s;
    case "delivery.preferences": s.life.delivery = { ...deliveryPreferences(s), ...c.changes }; return s;
    case "readiness.preview":
      if (s.mode !== "demo") throw new PersonalReferenceError();
      s.life.readiness = c.readiness; return s;
  }
}
