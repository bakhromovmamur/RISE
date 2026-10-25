import { archiveHabit, checkIn, correctHabitRecord, type State } from "../model";
import { changeGoalStatus, completeMilestone, enjoyReward, setPriorities, priorityKey } from "../developmentModel";
import { getPrayerDay, recordPrayer, prayerMoment } from "../prayerModel";
import { acknowledgeFajr } from "../prayerSchedule";
import { activePause, prayerKey, resumePrayers, startPause } from "./prayerPause";
import { isPrayerCommand } from "../contracts/prayerCommands";
import { reducePrayerCommand } from "./prayerCommands";
import { reducePersonalCommand } from "./personalCommands";
import type { CommandContext } from "../contracts/personalCommands";
import { today } from "./calendar";
import { parseCommand, parseCommandContext, type DomainCommand } from "../contracts/commands";

export class CommandReferenceError extends Error {
  constructor() { super("The selected record is no longer available for this action."); this.name = "CommandReferenceError"; }
}
const requireRecord = (condition: unknown) => { if (!condition) throw new CommandReferenceError(); };

/** No browser, storage, permission or delivery access. Validation precedes every domain mutation. */
export interface DomainReferences {sharedPriorities?:ReadonlySet<string>}
export function applyDomainCommand(input: State, value: unknown, context?: CommandContext, references:DomainReferences={}): State {
  const command = parseCommand(value);
  const clock = context ? parseCommandContext(context) : { date: today(input), now: Date.now(), timezone: input.timezone };
  return reduceCommand(input, command, clock, references);
}
function reduceCommand(s: State, c: DomainCommand, context: CommandContext, references:DomainReferences): State {
  const date = context.date;
  switch (c.kind) {
    case "habit.check": case "habit.correct": {
      requireRecord(c.kind === "habit.check" ? c.date === date : c.date <= date);
      // These reducers are pure and check-in materializes its calendar already.
      // Inspect that result instead of cloning/materializing the history twice.
      const next = c.kind === "habit.check" ? checkIn(s, c.habitId, c.check, c.date, date) : correctHabitRecord(s, c.date, c.habitId, c.check, date);
      // Undo can remove today's archived occurrence; its original record remains
      // the authority for validating that explicit correction.
      const row = s.days[c.date]?.find(o => o.habitId === c.habitId) ?? next.days[c.date]?.find(o => o.habitId === c.habitId);
      requireRecord(row && (c.check !== "tiny" || row.tiny !== null));
      return next;
    }
    case "habit.archive":
      requireRecord(s.habits.some(h => h.id === c.habitId));
      return archiveHabit(s, c.habitId, date);
    case "priorities.set": {
      const next = setPriorities(structuredClone(s), c.date, c.priorities,references.sharedPriorities);
      const valid = new Set(next.dailyPriorities[c.date].map(priorityKey));
      const previous = new Set((s.dailyPriorities[c.date] ?? []).map(priorityKey));
      requireRecord(c.priorities.every(p => valid.has(priorityKey(p)) || previous.has(priorityKey(p))));
      next.dailyPriorities[c.date] = structuredClone(c.priorities);
      delete next.life.drafts[`priorities:${c.date}`];
      return next;
    }
    case "goal.milestone":
      requireRecord(s.goals.some(g => g.id === c.goalId && g.milestones.some(m => m.id === c.milestoneId)));
      return completeMilestone(s, c.goalId, c.milestoneId, c.completed, date);
    case "goal.status":
      requireRecord(s.goals.some(g => g.id === c.goalId));
      return changeGoalStatus(s, c.goalId, c.status, date);
    case "reward.enjoy":
      requireRecord(s.personalRewards.some(r => r.id === c.rewardId));
      return enjoyReward(s, c.rewardId, date);
    case "prayer.record": {
      requireRecord(getPrayerDay(s, c.date)?.entries[c.prayer]);
      const next = recordPrayer(s, c.date, c.prayer, c.check, prayerMoment(s, new Date(context.now)), context.now), work = next.prayers.work;
      if (c.returnToWork && work?.date === c.date && work.prayer === c.prayer && c.check && next.prayers.days[c.date]?.entries[c.prayer].check === c.check) return { ...next, prayers: { ...next.prayers, work: { ...work, stage: "returned" } } };
      return next;
    }
    case "prayer.pause":
      requireRecord(c.date >= s.prayers.started && c.date <= date);
      requireRecord(activePause(s) || !s.life.pauses.some(p => p.id === c.pauseId));
      return startPause(s, c.date, c.prayer, c.pauseId);
    case "prayer.resume": {
      requireRecord(c.date >= s.prayers.started && c.date <= date);
      requireRecord(s.life.pauses.every(p => p.through || prayerKey(c.date, c.prayer) >= p.from));
      return resumePrayers(s, c.date, c.prayer, c.includeCurrent);
    }
    case "fajr.acknowledge":
      requireRecord(s.prayers.prepared[c.date] || s.life.alarm?.date === c.date || getPrayerDay(s, c.date)?.entries.fajr);
      return acknowledgeFajr(s, c.date);
    default: return isPrayerCommand(c) ? reducePrayerCommand(s, c, context) : reducePersonalCommand(s, c, context,references.sharedPriorities);
  }
}
