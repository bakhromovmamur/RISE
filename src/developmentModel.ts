import type { State } from "./model";
import { addDays, today, weekStart } from "./domain/calendar";
import { weekStats } from "./domain/habitCalendar";
import { migratePrayers } from "./prayerModel";
import { availableTasks, makeLifeState } from "./lifeModel";

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export interface GoalMilestone {
  id: string;
  title: string;
  completedOn?: string;
}
export interface Goal {
  id: string;
  title: string;
  reason: string;
  targetDate: string;
  habitIds: string[];
  milestones: GoalMilestone[];
  status: GoalStatus;
  createdOn: string;
  completedOn?: string;
  archivedOn?: string;
}
export type GoalDraft = Pick<Goal, "title" | "reason" | "targetDate" | "habitIds" | "milestones"> & { id?: string };
export type Priority = { kind: "habit"; habitId: string } | { kind: "milestone"; goalId: string; milestoneId: string } | { kind: "task"; taskId: string; date: string; groupId?: string };
export type RewardCondition = { kind: "goal"; goalId: string } | { kind: "weekly"; week: string; target: number };
export interface PersonalReward {
  id: string;
  name: string;
  condition: RewardCondition;
  createdOn: string;
  earnedOn?: string;
  enjoyedOn?: string;
  correctedOn?: string;
  archivedOn?: string;
  previousAttemptId?: string;
}
export type RewardDraft = Pick<PersonalReward, "name" | "condition"> & { id?: string };
export type ProgressView = "overview" | "salah" | "habits" | "goals";

/** Migration only adds fields: existing records, snapshots and legacy entitlements stay intact. */
export function migrateState(input: State, seedDemoHistory = true): State {
  const s = migratePrayers(structuredClone(input), seedDemoHistory);
  return {
    ...s,
    schema: 4,
    goals: s.goals ?? [],
    personalRewards: s.personalRewards ?? [],
    dailyPriorities: s.dailyPriorities ?? {},
    selectedRewardId: s.selectedRewardId ?? null,
    life: { ...(s.life ?? makeLifeState()), language: ["en", "uz", "ru"].includes(s.life?.language) ? s.life.language : "en" },
  };
}
export const priorityKey = (p: Priority) => p.kind === "habit" ? `habit:${p.habitId}` : p.kind === "task" ? p.groupId ? `shared-task:${p.groupId}:${p.taskId}:${p.date}` : `task:${p.taskId}:${p.date}` : `milestone:${p.goalId}:${p.milestoneId}`;
export function goalProgress(g: Goal) {
  const done = g.milestones.filter((m) => m.completedOn).length;
  return { done, total: g.milestones.length, percent: g.milestones.length ? done / g.milestones.length * 100 : 0 };
}
export const goalIsComplete = (g: Goal) => g.milestones.length > 0 && g.milestones.every((m) => m.completedOn);
export function priorityOptions(s: State, date: string): Priority[] {
  return [
    ...(s.days[date] ?? []).filter((o) => !o.check).map((o): Priority => ({ kind: "habit", habitId: o.habitId })),
    ...s.goals.filter((g) => g.status === "active").flatMap((g): Priority[] => {
      const next = g.milestones.find((m) => !m.completedOn);
      return next ? [{ kind: "milestone", goalId: g.id, milestoneId: next.id }] : [];
    }),
  ];
}
export function ensurePriorities(input: State, date = today(input)): State {
  if (input.dailyPriorities[date]) return input;
  return { ...input, dailyPriorities: { ...input.dailyPriorities, [date]: priorityOptions(input, date).slice(0, 3) } };
}
export function setPriorities(input: State, date: string, priorities: Priority[], sharedPriorities?: ReadonlySet<string>) {
  const keys = new Set<string>();
  const valid = priorities.filter((p) => {
    const key = priorityKey(p);
    const exists = p.kind === "task" ? p.groupId ? sharedPriorities?.has(key) : p.date === date && availableTasks(input, date).some((t) => t.id === p.taskId) : p.kind === "habit"
      ? (input.days[date] ?? []).some((o) => o.habitId === p.habitId)
      : input.goals.some((g) => g.id === p.goalId && g.status !== "archived" && g.milestones.some((m) => m.id === p.milestoneId));
    if (!exists || keys.has(key)) return false;
    keys.add(key);
    return true;
  }).slice(0, 3);
  return { ...input, dailyPriorities: { ...input.dailyPriorities, [date]: valid } };
}
export function weeklyHabits(s: State, start: string) {
  const week = weekStats(s, start);
  const elapsed = week.days.filter((d) => d.date <= today(s));
  const full = elapsed.reduce((n, d) => n + d.full, 0);
  const tiny = elapsed.reduce((n, d) => n + d.tiny, 0);
  const total = elapsed.reduce((n, d) => n + d.scheduled, 0);
  return { ...week, full, tiny, checked: full + tiny, total, rate: total ? (full + tiny) / total * 100 : null, upcoming: week.days.filter((d) => d.date > today(s)).reduce((n, d) => n + d.scheduled, 0) };
}
export function rewardEligibility(s: State, reward: Pick<PersonalReward, "condition">, date = today(s)) {
  const c = reward.condition;
  if (c.kind === "goal") {
    const goal = s.goals.find((g) => g.id === c.goalId);
    const progress = goal ? goalProgress(goal) : { done: 0, total: 1, percent: 0 };
    return { eligible: !!goal && goalIsComplete(goal), count: progress.done, target: progress.total, percent: progress.percent };
  }
  const end = addDays(c.week, 6);
  let count = 0;
  for (const [day, rows] of Object.entries(s.days)) {
    if (day < c.week || day > end || day > date) continue;
    count += new Set(rows.filter((o) => o.check).map((o) => o.habitId)).size;
  }
  return { eligible: count >= c.target, count, target: c.target, percent: Math.min(100, count / c.target * 100) };
}
/** Call on explicit action/correction, never on a new-day reset. A week is immutable. */
export function reconcilePersonalRewards(s: State, date = today(s)) {
  for (const r of s.personalRewards) {
    const { eligible } = rewardEligibility(s, r, date);
    if (r.enjoyedOn) {
      if (!eligible) r.correctedOn ??= date;
    } else if (eligible) {
      r.earnedOn ??= date;
    } else {
      delete r.earnedOn;
    }
  }
  return s;
}
export const rewardState = (r: PersonalReward) => r.enjoyedOn ? "Enjoyed" : r.earnedOn ? "Earned" : "Working toward";
export function spotlightReward(s: State) {
  const active = s.personalRewards.filter((r) => !r.archivedOn && !r.enjoyedOn);
  return active.find((r) => r.earnedOn)
    ?? active.find((r) => r.id === s.selectedRewardId)
    ?? active.find((r) => r.condition.kind === "goal" || addDays(r.condition.week, 6) >= today(s));
}
export function validateGoalDraft(draft: GoalDraft) {
  if (!draft.title.trim()) throw new Error("Give your goal a name.");
  if (!draft.milestones.length || draft.milestones.some((m) => !m.title.trim())) throw new Error("Give every milestone a name. Keep at least one.");
  if (draft.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.targetDate)) throw new Error("Choose a valid target date or leave it empty.");
}
export function saveGoal(input: State, draft: GoalDraft, newId: string = crypto.randomUUID(), date = today(input)) {
  validateGoalDraft(draft);
  const s = structuredClone(input);
  const existing = s.goals.find((g) => g.id === draft.id);
  const g: Goal = {
    id: existing?.id ?? newId,
    title: draft.title.trim(), reason: draft.reason.trim(), targetDate: draft.targetDate,
    habitIds: [...new Set(draft.habitIds)].filter((id) => s.habits.some((h) => h.id === id)),
    milestones: draft.milestones.map((m) => {
      const old = existing?.milestones.find((x) => x.id === m.id);
      return { id: m.id, title: m.title.trim(), ...(old?.completedOn ? { completedOn: old.completedOn } : {}) };
    }),
    status: existing?.status ?? "active", createdOn: existing?.createdOn ?? date,
    ...(existing?.completedOn ? { completedOn: existing.completedOn } : {}),
    ...(existing?.archivedOn ? { archivedOn: existing.archivedOn } : {}),
  };
  updateGoalCompletion(g, date);
  if (existing) s.goals[s.goals.indexOf(existing)] = g;
  else s.goals.push(g);
  return reconcilePersonalRewards(s, date);
}
function updateGoalCompletion(g: Goal, date: string) {
  if (goalIsComplete(g)) {
    g.completedOn ??= date;
    if (g.status !== "archived") g.status = "completed";
  } else {
    delete g.completedOn;
    if (g.status === "completed") g.status = "active";
  }
}
export function completeMilestone(input: State, goalId: string, milestoneId: string, completed: boolean, date = today(input)) {
  const s = structuredClone(input), g = s.goals.find((g) => g.id === goalId);
  const m = g?.milestones.find((m) => m.id === milestoneId);
  if (!g || !m) return s;
  if (completed && !m.completedOn && (g.status === "paused" || g.status === "archived")) return s;
  if (completed) m.completedOn ??= date;
  else delete m.completedOn;
  updateGoalCompletion(g, date);
  return reconcilePersonalRewards(s, date);
}
export function changeGoalStatus(input: State, id: string, status: "active" | "paused" | "archived", date = today(input)) {
  const s = structuredClone(input), g = s.goals.find((g) => g.id === id);
  if (!g) return s;
  g.status = status;
  if (status === "archived") g.archivedOn = date;
  else delete g.archivedOn;
  updateGoalCompletion(g, date);
  return reconcilePersonalRewards(s, date);
}
export function validateRewardDraft(input: State, draft: RewardDraft) {
  const draftCondition = draft.condition;
  if (!draft.name.trim()) throw new Error("Name something you’d enjoy.");
  if (draftCondition.kind === "goal" && !input.goals.some((g) => g.id === draftCondition.goalId)) throw new Error("Choose a goal for this reward.");
  if (draft.condition.kind === "weekly" && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.condition.week) || !Number.isInteger(draft.condition.target) || draft.condition.target < 1)) throw new Error("Choose a week and a whole number of check-ins greater than zero.");
}
export function savePersonalReward(input: State, draft: RewardDraft, newId: string = crypto.randomUUID(), date = today(input)) {
  validateRewardDraft(input, draft);
  const s = structuredClone(input), existing = s.personalRewards.find((r) => r.id === draft.id);
  const condition = existing?.enjoyedOn ? existing.condition : structuredClone(draft.condition);
  if (condition.kind === "weekly") condition.week = weekStart(condition.week);
  if (existing) { existing.name = draft.name.trim(); existing.condition = condition; }
  else s.personalRewards.push({ id: newId, name: draft.name.trim(), condition, createdOn: date });
  return reconcilePersonalRewards(s, date);
}
export function enjoyReward(input: State, id: string, date = today(input)) {
  const s = reconcilePersonalRewards(structuredClone(input), date), r = s.personalRewards.find((r) => r.id === id);
  if (r?.earnedOn) r.enjoyedOn ??= date;
  return s;
}
export function retryReward(input: State, id: string, newId: string = crypto.randomUUID(), date = today(input)) {
  const s = structuredClone(input), old = s.personalRewards.find((r) => r.id === id);
  if (!old || old.condition.kind !== "weekly" || old.earnedOn || old.enjoyedOn || addDays(old.condition.week, 6) >= date) return s;
  if (s.personalRewards.some((r) => r.previousAttemptId === id)) return s;
  const next: PersonalReward = { id: newId, name: old.name, condition: { ...old.condition, week: addDays(old.condition.week, 7) }, createdOn: date, previousAttemptId: old.id };
  s.personalRewards.push(next);
  s.selectedRewardId = next.id;
  return reconcilePersonalRewards(s, date);
}
export function weekGoalMovement(s: State, start: string) {
  const end = addDays(start, 6);
  return s.goals.map((goal) => ({ goal, completed: goal.milestones.filter((m) => m.completedOn && m.completedOn >= start && m.completedOn <= end && m.completedOn <= today(s)).length }));
}
