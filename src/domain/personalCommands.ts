import { checkIn, ensureDays, milestones, saveHabit, timerElapsed, versionAt, xpTotal, type State } from "../model";
import { ensurePriorities, priorityKey, retryReward, saveGoal, savePersonalReward, setPriorities } from "../developmentModel";
import { beginWorkBreak, ensurePrayerDays, startWrapUp } from "../prayerModel";
import { refreshCalculatedPrayers } from "../prayerCalculation";
import { canonicalZone } from "./zonedTime";
import type { CommandContext, PersonalCommand } from "../contracts/personalCommands";

// Kept here to avoid a commands <-> reducer import cycle.
export class PersonalReferenceError extends Error {}
const requireRecord = (value: unknown) => { if (!value) throw new PersonalReferenceError(); };
const clearDraft = (s: State, key: string) => { delete s.life.drafts[key]; return s; };

export function reducePersonalCommand(input: State, c: PersonalCommand, { date, now }: CommandContext, sharedPriorities?:ReadonlySet<string>): State {
  // These pure helpers already return a deep owned copy. Other cases mutate
  // their working state directly and still need the copy here.
  let s = c.kind === "habit.save" || c.kind === "goal.save" || c.kind === "reward.save"
    || c.kind === "reward.retry" || c.kind === "timer.complete" ? input : structuredClone(input);
  switch (c.kind) {
    case "habit.save":
      requireRecord(c.draft.id ? s.habits.some(h => h.id === c.draft.id && !h.archivedAt) : !s.habits.some(h => h.id === c.newId));
      s = saveHabit(s, c.draft, c.newId, date);
      return clearDraft(s, `habit:${c.draft.id ?? "new"}`);
    case "habit.draft": s.draft = c.draft; return s;
    case "timer.start": {
      const habit = s.habits.find(h => h.id === c.habitId && !h.archivedAt);
      requireRecord(habit && !s.timer);
      const row = s.days[date]?.find(o => o.habitId === c.habitId);
      s.timer = { habitId: c.habitId, duration: (row?.full ?? versionAt(habit!, date).full) * 60, elapsed: 0, startedAt: now, date };
      return s;
    }
    case "timer.pause": case "timer.resume":
      requireRecord(s.timer?.habitId === c.habitId);
      if ((c.kind === "timer.pause") === (s.timer!.startedAt !== null)) s.timer = { ...s.timer!, elapsed: timerElapsed(s.timer!, now), startedAt: c.kind === "timer.pause" ? null : now };
      return s;
    case "timer.end":
      requireRecord(!s.timer || s.timer.habitId === c.habitId); s.timer = null; return s;
    case "timer.complete": {
      requireRecord(s.timer?.habitId === c.habitId && s.timer.date === c.date && date === c.date && timerElapsed(s.timer, now) >= s.timer.duration);
      // Check-in materializes the same calendar and owns its result. Validate
      // that result rather than cloning/materializing the full history twice.
      s = checkIn(s, c.habitId, "full", c.date, date);
      requireRecord(s.days[c.date]?.some(o => o.habitId === c.habitId));
      s.timer = null; return s;
    }
    case "priorities.ensure": return ensurePriorities(s, c.date);
    case "priority.pin": {
      const previous = s.dailyPriorities[c.date] ?? [], key = priorityKey(c.priority);
      if (!c.selected) { s.dailyPriorities[c.date] = previous.filter(p => priorityKey(p) !== key); return s; }
      if (previous.some(p => priorityKey(p) === key)) return s;
      requireRecord(previous.length < 3 && setPriorities(s, c.date, [c.priority],sharedPriorities).dailyPriorities[c.date].length === 1);
      s.dailyPriorities[c.date] = [...previous, c.priority]; return s;
    }
    case "goal.save":
      requireRecord(c.draft.id ? s.goals.some(g => g.id === c.draft.id) : !s.goals.some(g => g.id === c.newId));
      requireRecord(new Set(c.draft.milestones.map(m => m.id)).size === c.draft.milestones.length);
      requireRecord(c.draft.habitIds.every(id => s.habits.some(h => h.id === id)));
      return clearDraft(saveGoal(s, c.draft, c.newId, date), `goal:${c.draft.id ?? "new"}`);
    case "reward.save":
      requireRecord(c.draft.id ? s.personalRewards.some(r => r.id === c.draft.id) : !s.personalRewards.some(r => r.id === c.newId));
      return clearDraft(savePersonalReward(s, c.draft, c.newId, date), `reward:${c.draft.id ?? "new"}`);
    case "reward.retry":
      requireRecord(s.personalRewards.some(r => r.id === c.rewardId) && !s.personalRewards.some(r => r.id === c.newId));
      return retryReward(s, c.rewardId, c.newId, date);
    case "reward.select":
      requireRecord(s.personalRewards.some(r => r.id === c.rewardId)); s.selectedRewardId = c.rewardId; return s;
    case "reward.archive": {
      const reward = s.personalRewards.find(r => r.id === c.rewardId); requireRecord(reward);
      if (c.archived) reward!.archivedOn = date; else delete reward!.archivedOn; return s;
    }
    case "collection.claim":
      requireRecord(milestones.some(m => m.xp === c.xp) && xpTotal(s) >= c.xp);
      s.claimed = [...new Set([...s.claimed, c.xp])];
      if (c.xp === 250) s.equipped = 250;
      if (c.xp === 800) s.prefs.golden = true;
      return s;
    case "collection.equip":
      requireRecord(c.xp === null || (s.claimed.includes(c.xp) && xpTotal(s) >= c.xp)); s.equipped = c.xp; return s;
    case "profile.name": s.name = c.name; return s;
    case "preferences.set":
      requireRecord(!c.changes.golden || (s.claimed.includes(800) && xpTotal(s) >= 800));
      s.prefs = { ...s.prefs, ...c.changes }; return s;
    case "language.set": s.life.language = c.language; return s;
    case "reflection.save":
      s.reflections[c.date] = c.reflection; return clearDraft(s, `reflection:${c.date}`);
    case "draft.save": s.life.drafts[c.key] = c.value; return s;
    case "draft.clear": return clearDraft(s, c.key);
    case "onboarding.skip": s.onboarded = true; return clearDraft(s, "onboarding");
    case "onboarding.finish":
      requireRecord(!s.onboarded && new Set(c.habits.map(h => h.newId)).size === c.habits.length);
      s.name = c.name; s.prefs.reminders = c.reminders;
      for (const h of c.habits) { requireRecord(!h.draft.id && !s.habits.some(old => old.id === h.newId)); s = saveHabit(s, h.draft, h.newId, date); }
      s.onboarded = true; return clearDraft(s, "onboarding");
    case "calendar.refresh":
      if (s.mode !== "demo" && c.deviceTimezone) {
        const observed = canonicalZone(c.deviceTimezone), previous = s.life.deviceTimezone;
        s.life.deviceTimezone = previous ? { ...previous, observed } : { observed, ...(canonicalZone(s.timezone) === observed ? { reviewed: observed } : {}) };
      }
      // ensurePrayerDays uses the captured civil day; the original calendar mode is retained.
      if (!s.days[date] && s.habits.length) s = ensureDays(s, date);
      return refreshCalculatedPrayers(ensurePrayerDays(s, date), now);
    case "work.begin":
      return beginWorkBreak(s, c.prayer, c.date);
    case "work.note": case "work.stage": case "work.wrap":
      requireRecord(s.prayers.work?.date === c.date && s.prayers.work.prayer === c.prayer);
      if (c.kind === "work.note") s.prayers.work!.note = c.note;
      if (c.kind === "work.stage") s.prayers.work!.stage = c.stage;
      return c.kind === "work.wrap" ? startWrapUp(s, now) : s;
  }
}
