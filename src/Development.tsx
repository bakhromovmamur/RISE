import { createTranslator } from "./i18n";
import { useLifeDraft, useText } from "./LifeUI";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronRight, Gift, Plus, Target, X } from "lucide-react";
import { useApp } from "./context";
import { availableTasks } from "./lifeModel";
import { Button, GroupRow, HabitIcon, ProgressBar, SectionTitle } from "./components";
import { addDays, formatDate, targetLabel, today, weekStart, type Check as HabitCheck } from "./model";
import {useSharedFamily} from './groups/sharedHooks';
import {useGroups} from './groups/GroupProvider';
import {sharedText} from './groups/sharedText';
import {isSharedPriority,type SharedPriority} from './domain/priorityReferences';
import {
  validateGoalDraft, validateRewardDraft, goalProgress, priorityKey, priorityOptions,
  rewardEligibility, rewardState, spotlightReward,
  type Goal, type GoalDraft, type PersonalReward, type Priority, type RewardCondition,
} from "./developmentModel";

export const shortDate = (date: string) => formatDate(date, { month: "short", day: "numeric" });
export const weekLabel = (start: string) => `${shortDate(start)}–${shortDate(addDays(start, 6))}`;
export function HabitCorrection({ id, date }: { id: string; date: string }) {
  const t = useText();
  const { state, dispatch, back, toast } = useApp(), row = state.days[date]?.find((o) => o.habitId === id);
  const [check, setCheck] = useState<HabitCheck | "none">(row?.check ?? "none");
  if (!row) return <p>{t("This scheduled action is no longer available.")}</p>;
  return <div className="development-form"><div className="form-intro"><h1>{row.name}</h1><p>{t.shortDate(date)} {t(" · Correct what happened on this date.")}</p></div>
    <label className="field">{t("Recorded completion")}<select aria-label={t("Recorded completion")} value={check} onChange={(e) => setCheck(e.target.value as HabitCheck | "none")}><option value="none">{t("No check-in")}</option><option value="full">{t("Full · ")}{t.target(row)}</option>{row.tiny !== null && <option value="tiny">{t("Tiny · ")}{t.target(row, row.tiny)}</option>}</select></label>
    <p className="fine-print">{t("This updates XP, streaks and reward eligibility. Enjoyed rewards keep their history with a correction note.")}</p>
    <Button className="wide" onClick={() => { dispatch({ kind: "habit.correct", date, habitId: id, check: check === "none" ? null : check }); toast("History corrected. Totals and rewards updated."); back(); }}>{t("Save correction")}</Button>
  </div>;
}
const move = <T,>(items: T[], index: number, delta: number) => {
  const result = [...items];
  [result[index], result[index + delta]] = [result[index + delta], result[index]];
  return result;
};

export function GoalRow({ goal, weekly, weekContext = "this week", compact = false }: { goal: Goal; weekly?: number; weekContext?: string; compact?: boolean }) {
  const t = useText();
  const { open } = useApp(), progress = goalProgress(goal);
  const next = goal.milestones.find((m) => !m.completedOn);
  if (compact) return <button className="goal-row compact-goal" onClick={() => open({ type: "goal", id: goal.id })}>
    <span className="goal-row-heading"><strong>{goal.title}</strong><ChevronRight size={17} /></span>
    <span className="goal-row-meta">{progress.done}/{progress.total} {t(" milestones overall · ")}{weekly ?? 0} {t(" completed ")}{weekContext === "selected week" ? t("in the selected week") : t(weekContext)}</span>
  </button>;
  return <button className="goal-row" onClick={() => open({ type: "goal", id: goal.id })}>
    <span className="goal-row-heading"><strong>{goal.title}</strong><ChevronRight size={18} /></span>
    <span className="goal-row-meta">{progress.done}/{progress.total} {t(" milestones · ")}{goal.status === "completed" ? t("Completed") : t("{0}% overall", undefined, [Math.round(progress.percent)])}</span>
    <ProgressBar value={progress.percent} label={t("{0}: current overall progress", undefined, [goal.title])} />
    <span className="goal-next">{weekly !== undefined ? t("{0} milestone{1} completed {2}", undefined, [weekly, weekly === 1 ? "" : "s", weekContext === "selected week" ? t("in the selected week") : t(weekContext)]) : next ? t("Next: {0}", undefined, [next.title]) : t("Every milestone, kept.")}</span>
  </button>;
}
export function MilestonePriority({ goalId, milestoneId, compact = false }: { goalId: string; milestoneId: string; compact?: boolean }) {
  const t = useText();
  const { state, dispatch, open, toast } = useApp();
  const goal = state.goals.find((g) => g.id === goalId), milestone = goal?.milestones.find((m) => m.id === milestoneId);
  if (!goal || !milestone) return <p className="inline-note">{t("This milestone was removed. Edit priorities to choose another.")}</p>;
  const unavailable = goal.status === "archived" || goal.status === "paused";
  return <article className={`milestone-priority ${compact ? "compact-milestone" : ""} ${milestone.completedOn ? "completed" : ""}`}>
    <button className="milestone-summary" onClick={() => open({ type: "goal", id: goalId })}><Target size={22} /><span><strong>{milestone.title}</strong><small>{compact && milestone.completedOn ? t("Completed · ") : compact && unavailable ? t("Goal {0} · ", undefined, [t(goal.status)]) : ""}{goal.title}</small></span><ChevronRight size={18} /></button>
    <Button variant="secondary" aria-label={compact ? milestone.completedOn ? t("Undo milestone") : t("Complete milestone") : undefined} disabled={unavailable && !milestone.completedOn} onClick={() => {
      dispatch({ kind: "goal.milestone", goalId, milestoneId, completed: !milestone.completedOn });
      toast(milestone.completedOn ? "Milestone corrected." : "A step toward your goal, complete.");
    }}>{compact ? <Check size={18} /> : milestone.completedOn ? <><Check size={17} />{t("Completed · Undo")}</> : unavailable ? t("Goal {0}", undefined, [t(goal.status)]) : t("Complete milestone")}</Button>
  </article>;
}
export function PriorityPicker({ date,candidate }: { date: string;candidate?:SharedPriority }) {
  const t = useText();
  const { state, dispatch, storage, workspace, back, toast, open } = useApp(),{session}=useGroups(),copy=sharedText(state.life.language);
  const [selected, select] = useLifeDraft<Priority[]>(`priorities:${date}`, () => state.dailyPriorities[date] ?? []);
  const family=useSharedFamily([...selected,...(candidate?[candidate]:[])]),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const all = [...selected,...(candidate?[candidate]:[]), ...priorityOptions(state, date), ...(state.days[date] ?? []).map((o): Priority => ({ kind: "habit", habitId: o.habitId })), ...(workspace?family.choices.map(c=>c.priority):availableTasks(state, date).map((task): Priority => ({ kind: "task", taskId: task.id, date })))];
  const options = [...new Map(all.map((p) => [priorityKey(p), p])).values()];
  const title = (p: Priority) => isSharedPriority(p)?family.occurrence(p)?.snapshot.title??family.task(p)?.title??copy('unavailable'):p.kind === "task" ? state.life.tasks.find((task) => task.id === p.taskId)?.title ?? t("Unavailable family task") : p.kind === "habit"
    ? state.habits.find((h) => h.id === p.habitId)?.name ?? t("Archived habit")
    : state.goals.find((g) => g.id === p.goalId)?.milestones.find((m) => m.id === p.milestoneId)?.title ?? t("Removed milestone");
  const toggle = (p: Priority) => select((items) => items.some((x) => priorityKey(x) === priorityKey(p)) ? items.filter((x) => priorityKey(x) !== priorityKey(p)) : [...items, p].slice(0, 3));
  return <div className={`development-form${workspace?' server-groups':''}`}>
    <div className="form-intro"><h1>{t("A little focus.")}</h1><p>{t("Choose up to three for ")}{t.shortDate(date)}{t(". Everything else stays in your routine.")}</p></div>
    <h2>{selected.length} {t(" of 3 priorities")}</h2>
    {selected.map((p, i) => <div className="ordered-item" key={priorityKey(p)}>
      <span>{title(p)}</span>
      <button className="icon-button" aria-label={t("Move {0} up", undefined, [title(p)])} disabled={saving||i === 0} onClick={() => select(move(selected, i, -1))}><ArrowUp size={18} /></button>
      <button className="icon-button" aria-label={t("Move {0} down", undefined, [title(p)])} disabled={saving||i === selected.length - 1} onClick={() => select(move(selected, i, 1))}><ArrowDown size={18} /></button>
      <button className="icon-button" disabled={saving} aria-label={t("Remove {0} from priorities", undefined, [title(p)])} onClick={() => toggle(p)}><X size={18} /></button>
    </div>)}
    <div className="choice-list">{options.map((p) => {
      const chosen = selected.some((x) => priorityKey(x) === priorityKey(p));
      const available=!isSharedPriority(p)||family.allows(p)||(state.dailyPriorities[date]??[]).some(old=>priorityKey(old)===priorityKey(p));
      return <label className="check-choice" key={priorityKey(p)}><input type="checkbox" checked={chosen} disabled={saving||!chosen&&(selected.length === 3||!available)} onChange={() => toggle(p)} /><span><strong>{title(p)}</strong><small>{p.kind === "task" ? t("Shared family task · no XP") : p.kind === "habit" ? t("Scheduled habit") : t("Goal milestone")}</small>{isSharedPriority(p)&&<small>{t.date(p.date)}</small>}</span></label>;
    })}</div>
    {session&&family.loading&&<p role="status" className="fine-print">{copy('loading')}</p>}{session&&family.error&&<p role="alert" className="field-error">{copy('readFailed')} <button className="text-button" onClick={family.retry}>{copy('retry')}</button></p>}
    {!options.length && <><p className="muted">{t("Add a habit or goal to give your day a starting point.")}</p><Button variant="secondary" onClick={() => open({ type: "edit" })}>{t("Add a habit")}</Button><Button variant="ghost" onClick={() => open({ type: "goalEdit" })}>{t("Create a goal")}</Button></>}
    <p className="fine-print">{t("Choosing a priority never records completion or awards XP. Completed priorities stay in your plan.")}</p>
    {failed&&<p role="alert" className="field-error">{copy('pinFailed')}</p>}<Button className="wide" disabled={saving} onClick={async () => {const owner=workspace?.scope;setSaving(true);setFailed(false);const next=dispatch({ kind: "priorities.set", date, priorities: selected }),saved=!!next&&await storage.whenSaved();if(!alive.current||workspace?.scope!==owner)return;setSaving(false);if(!saved){setFailed(true);return;}toast("Your priorities are saved.");back();}}>{saving?copy('saving'):t("Save priorities")}</Button>
  </div>;
}
export function GoalForm({ id }: { id?: string }) {
  const t = useText();
  const { state, dispatch, back } = useApp();
  const original = state.goals.find((g) => g.id === id);
  const [draft, setDraft] = useLifeDraft<GoalDraft>(`goal:${id ?? "new"}`, () => original ? { id: original.id, title: original.title, reason: original.reason, targetDate: original.targetDate, habitIds: [...original.habitIds], milestones: structuredClone(original.milestones) } : { title: "", reason: "", targetDate: "", habitIds: [], milestones: [{ id: crypto.randomUUID(), title: "" }] });
  const [error, setError] = useState("");
  return <form noValidate className="development-form" onSubmit={(e) => {
    e.preventDefault();
    try { validateGoalDraft(draft); if (dispatch({ kind: "goal.save", draft, newId: crypto.randomUUID() })) back(); } catch (err) { setError((err as Error).message); }
  }}>
    <div className="form-intro"><h1>{original ? t("Shape your goal.") : t("Something to work toward.")}</h1><p>{t("A clear outcome, with small steps you can see.")}</p></div>
    <label className="field">{t("Goal name")}<input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t("Finish my current book")} /></label>
    <label className="field">{t("Why it matters")}<textarea aria-label={t("Why it matters")} rows={2} maxLength={300} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder={t("A little reminder for the harder days")} /></label>
    <label className="field">{t("Target date (optional)")}<input type="date" value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} /></label>
    <p className="fine-print">{t("A date to aim for. No penalties if life changes.")}</p>
    <SectionTitle title={t("Your milestones")} />
    <div className="milestone-editor">{draft.milestones.map((m, i) => <div className="milestone-edit-row" key={m.id}>
      <label className="field">{t("Milestone ")}{i + 1}{m.completedOn ? t(" · completed") : ""}<input aria-label={t("Milestone {0}", undefined, [i + 1])} required maxLength={180} value={m.title} onChange={(e) => setDraft({ ...draft, milestones: draft.milestones.map((item) => item.id === m.id ? { ...item, title: e.target.value } : item) })} /></label>
      <div className="row-controls">
        <button type="button" className="icon-button" aria-label={t("Move milestone {0} up", undefined, [i + 1])} disabled={i === 0} onClick={() => setDraft({ ...draft, milestones: move(draft.milestones, i, -1) })}><ArrowUp size={18} /></button>
        <button type="button" className="icon-button" aria-label={t("Move milestone {0} down", undefined, [i + 1])} disabled={i === draft.milestones.length - 1} onClick={() => setDraft({ ...draft, milestones: move(draft.milestones, i, 1) })}><ArrowDown size={18} /></button>
        <button type="button" className="icon-button" aria-label={t("Remove milestone {0}", undefined, [i + 1])} disabled={draft.milestones.length === 1} onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((item) => item.id !== m.id) })}><X size={18} /></button>
      </div>
    </div>)}</div>
    <Button type="button" variant="secondary" onClick={() => setDraft({ ...draft, milestones: [...draft.milestones, { id: crypto.randomUUID(), title: "" }] })}><Plus size={17} />{t("Add milestone")}</Button>
    <SectionTitle title={t("Habits that support it")} />
    <p className="fine-print">{t("Check-ins support your goal. You decide when a milestone is complete.")}</p>
    <div className="choice-list">{state.habits.filter((h) => !h.archivedAt || draft.habitIds.includes(h.id)).map((h) => <label className="check-choice" key={h.id}>
      <input type="checkbox" checked={draft.habitIds.includes(h.id)} onChange={() => setDraft({ ...draft, habitIds: draft.habitIds.includes(h.id) ? draft.habitIds.filter((id) => id !== h.id) : [...draft.habitIds, h.id] })} /><span>{h.name}{h.archivedAt ? t(" · archived") : ""}</span>
    </label>)}</div>
    {!state.habits.length && <p className="muted">{t("You can link habits later.")}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <Button type="submit" className="wide">{t("Save goal")}</Button>
  </form>;
}
export function GoalDetail({ id }: { id: string }) {
  const t = useText();
  const { state, dispatch, open, toast } = useApp();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const goal = state.goals.find((g) => g.id === id);
  if (!goal) return <p>{t("This goal is no longer available.")}</p>;
  const progress = goalProgress(goal);
  return <div className="development-detail">
    <Target size={32} strokeWidth={1.5} /><h1>{goal.title}</h1>
    <p>{goal.reason || t("One milestone at a time.")}</p>
    <div className="detail-meta"><span className="status-label">{t(goal.status)}</span>{goal.targetDate && <span>{t("Aiming for ")}{t.shortDate(goal.targetDate)}</span>}</div>
    <ProgressBar value={progress.percent} label={t("Current goal progress")} /><p className="muted">{progress.done} {t(" of ")}{progress.total} {t(" milestones complete")}</p>
    <div className="milestone-list">{goal.milestones.map((m) => <div className="milestone-item" key={m.id}>
      <span><strong>{m.title}</strong>{m.completedOn && <small>{t("Completed ")}{t.shortDate(m.completedOn)}</small>}</span>
      <button className={`milestone-check ${m.completedOn ? "checked" : ""}`} disabled={!m.completedOn && (goal.status === "paused" || goal.status === "archived")} aria-label={`${m.completedOn ? t("Undo") : t("Complete")} ${m.title}`} aria-pressed={!!m.completedOn} onClick={() => {
        dispatch({ kind: "goal.milestone", goalId: id, milestoneId: m.id, completed: !m.completedOn });
        toast(m.completedOn ? "Milestone corrected. Reward eligibility updated." : "Milestone complete.");
      }}>{m.completedOn ? <Check size={20} /> : <span />}</button>
    </div>)}</div>
    <p className="fine-print">{t("Milestones mark achievement without adding habit XP.")}</p>
    <SectionTitle title={t("Supporting habits")} />
    {goal.habitIds.length ? <div className="group">{goal.habitIds.map((id) => {
      const h = state.habits.find((h) => h.id === id);
      return h ? <GroupRow key={id} icon={<HabitIcon name={h.icon} small />} title={h.name} detail={h.archivedAt ? t("Archived · history kept") : t("Open habit")} onClick={() => open({ type: "detail", id })} /> : null;
    })}</div> : <p className="muted">{t("No linked habits yet.")}</p>}
    <div className="detail-actions">
      <Button variant="secondary" onClick={() => open({ type: "goalEdit", id })}>{t("Edit goal & milestones")}</Button>
      {goal.status === "active" || goal.status === "paused" ? <Button variant="ghost" onClick={() => dispatch({ kind: "goal.status", goalId: id, status: goal.status === "paused" ? "active" : "paused" })}>{goal.status === "paused" ? t("Resume goal") : t("Pause goal")}</Button> : null}
      {goal.status === "archived" ? <Button variant="ghost" onClick={() => dispatch({ kind: "goal.status", goalId: id, status: "active" })}>{t("Restore goal")}</Button> : confirmArchive ? <div className="inline-note"><p>{t("Keep all milestones and linked history, and move this goal out of your active plan?")}</p><Button variant="secondary" onClick={() => { dispatch({ kind: "goal.status", goalId: id, status: "archived" }); setConfirmArchive(false); }}>{t("Confirm archive")}</Button><Button variant="ghost" onClick={() => setConfirmArchive(false)}>{t("Keep active")}</Button></div> : <Button variant="ghost" onClick={() => setConfirmArchive(true)}>{t("Archive goal")}</Button>}
    </div>
  </div>;
}
export function rewardConditionText(s: ReturnType<typeof useApp>["state"], r: PersonalReward) {
  const t = createTranslator(s.life.language);
  const c = r.condition;
  return c.kind === "goal" ? t("Complete “{0}”", undefined, [s.goals.find((g) => g.id === c.goalId)?.title ?? t("Archived goal")]) : t("{0} habit check-ins · {1}", undefined, [c.target, t.week(c.week)]);
}
export function RewardRow({ reward }: { reward: PersonalReward }) {
  const t = useText();
  const { state, open } = useApp(), eligibility = rewardEligibility(state, reward);
  return <button className="reward-row" onClick={() => open({ type: "reward", id: reward.id })}>
    <Gift size={21} /><span><strong>{reward.name}</strong><small>{t(rewardState(reward))} · {reward.enjoyedOn ? t.shortDate(reward.enjoyedOn) : `${eligibility.count}/${eligibility.target} ${reward.condition.kind === "goal" ? t("milestones") : t("check-ins")}`}</small></span><ChevronRight size={17} />
  </button>;
}
export function PersonalRewards({ compact = false }: { compact?: boolean }) {
  const t = useText();
  const { state, open } = useApp();
  const active = state.personalRewards.filter((r) => !r.archivedOn && !r.enjoyedOn);
  const history = state.personalRewards.filter((r) => r.archivedOn || r.enjoyedOn);
  if (compact) {
    const reward = spotlightReward(state) ?? active[0], progress = reward && rewardEligibility(state, reward);
    const expired = reward?.condition.kind === "weekly" && addDays(reward.condition.week, 6) < today(state);
    return <section className="personal-rewards journey-personal">
      <SectionTitle title={t("Personal rewards")}><button className="text-button" aria-label={t("Add personal reward")} onClick={() => open({ type: "rewardEdit" })}><Plus size={16} />{t("Add")}</button></SectionTitle>
      {reward ? <button className="personal-spotlight" onClick={() => open({ type: "reward", id: reward.id })}>
        <span className="personal-spotlight-title"><strong>{reward.name}</strong><ChevronRight size={18} /></span>
        <span className="personal-spotlight-state">{reward.earnedOn ? t("Earned · ready to enjoy") : expired ? t("This week ended · review your attempt") : t("Working toward")}</span>
        <span aria-hidden="true"><ProgressBar value={progress!.percent} label={t("Personal reward: {0}", undefined, [reward.name])} /></span>
        <span className="personal-spotlight-count">{progress!.count}/{progress!.target} {reward.condition.kind === "goal" ? t("milestones") : t("check-ins")}{reward.condition.kind === "weekly" && ` · ${t.week(reward.condition.week)}`}</span>
        {reward.condition.kind === "goal" && <span className="personal-spotlight-condition">{rewardConditionText(state, reward)}</span>}
      </button> : <div className="empty-inline">
        <p>{history.some((r) => r.enjoyedOn) ? t("A little celebration, kept in your history.") : t("Choose a small treat for a goal or a week of showing up.")}</p>
        <Button variant="secondary" onClick={() => open({ type: "rewardEdit" })}>{t("Choose a personal reward")}</Button>
      </div>}
      <details className="journey-disclosure">
        <summary><Gift size={21} /><span><strong>{t("All rewards & history")}</strong><small>{state.personalRewards.length ? t("{0} saved · personal rewards", undefined, [state.personalRewards.length]) : t("Your own things to look forward to")}</small></span><ChevronRight size={18} /></summary>
        <div className="journey-disclosure-content">
          {active.map((r) => <RewardRow key={r.id} reward={r} />)}
          {history.length > 0 && <details className="done-group"><summary>{t("Enjoyed & archived · ")}{history.length}</summary>{history.map((r) => <RewardRow key={r.id} reward={r} />)}</details>}
          {!state.personalRewards.length && <p className="fine-print">{t("Your rewards will appear here once you choose one.")}</p>}
          <button className="text-button" onClick={() => open({ type: "personalRewards" })}>{t("Manage personal rewards")}<ChevronRight size={16} /></button>
        </div>
      </details>
    </section>;
  }
  return <section className="personal-rewards">
    <SectionTitle title={t("Personal rewards")}><button className="text-button" onClick={() => open({ type: "rewardEdit" })}><Plus size={16} />{t("Add")}</button></SectionTitle>
    {!active.length && <div className="empty-inline"><p>{t("Something to look forward to.")}</p><Button variant="secondary" onClick={() => open({ type: "rewardEdit" })}>{t("Choose a personal reward")}</Button></div>}
    <div className="reward-list">{active.map((r) => <RewardRow key={r.id} reward={r} />)}</div>
    {history.length > 0 && <details className="done-group"><summary>{t("Enjoyed & archived · ")}{history.length}</summary>{history.map((r) => <RewardRow key={r.id} reward={r} />)}</details>}
    <p className="fine-print">{t("Personal promises to yourself. No points to spend and no automatic purchases.")}</p>
  </section>;
}
export function RewardForm({ id }: { id?: string }) {
  const t = useText();
  const { state, dispatch, back, open } = useApp(), original = state.personalRewards.find((r) => r.id === id);
  const [rewardDraft, setRewardDraft] = useLifeDraft<{ name: string; condition: RewardCondition }>(`reward:${id ?? "new"}`, () => ({ name: original?.name ?? "", condition: original?.condition ?? { kind: "weekly", week: weekStart(today(state)), target: 5 } }));
  const { name, condition } = rewardDraft;
  const setName = (name: string) => setRewardDraft({ ...rewardDraft, name });
  const setCondition = (condition: RewardCondition) => setRewardDraft({ ...rewardDraft, condition });
  const [error, setError] = useState("");
  return <form noValidate className="development-form" onSubmit={(e) => {
    e.preventDefault();
    try { const draft = { ...(id ? { id } : {}), name, condition }; validateRewardDraft(state, draft); if (dispatch({ kind: "reward.save", draft, newId: crypto.randomUUID() })) back(); } catch (err) { setError((err as Error).message); }
  }}>
    <div className="form-intro"><h1>{t("Something to enjoy.")}</h1><p>{t("A small promise to yourself, with one clear finish line.")}</p></div>
    <label className="field">{t("Reward name")}<input required maxLength={140} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("A relaxed afternoon at my favorite café")} /></label>
    <label className="field">{t("Unlock this reward by")}<select aria-label={t("Unlock this reward by")} disabled={!!original?.enjoyedOn} value={condition.kind} onChange={(e) => setCondition(e.target.value === "goal" ? { kind: "goal", goalId: "" } : { kind: "weekly", week: weekStart(today(state)), target: 5 })}><option value="weekly">{t("Weekly habit check-ins")}</option><option value="goal">{t("Completing a goal")}</option></select></label>
    {condition.kind === "weekly" ? <>
      <label className="field">{t("Choose a day in the week")}<input required type="date" disabled={!!original?.enjoyedOn} value={condition.week} onChange={(e) => setCondition({ ...condition, week: e.target.value })} /></label>
      {condition.week && <p className="fine-print">{t("Monday–Sunday: ")}{t.week(weekStart(condition.week))} · {state.timezone}</p>}
      <label className="field">{t("Number of check-ins")}<input required disabled={!!original?.enjoyedOn} type="number" min={1} step={1} value={condition.target || ""} onChange={(e) => setCondition({ ...condition, target: Number(e.target.value) })} /></label>
      <p className="fine-print">{t("Full or tiny counts once. Upgrading doesn’t count twice. Prayer records stay separate.")}</p>
    </> : <>
      <label className="field">{t("Goal")}<select aria-label={t("Goal")} required disabled={!!original?.enjoyedOn} value={condition.goalId} onChange={(e) => setCondition({ ...condition, goalId: e.target.value })}><option value="">{t("Choose a goal")}</option>{state.goals.map((g) => <option key={g.id} value={g.id}>{g.title} · {g.status}</option>)}</select></label>
      {!state.goals.length && <Button type="button" variant="secondary" onClick={() => open({ type: "goalEdit" })}>{t("Create a goal first")}</Button>}
    </>}
    {original?.enjoyedOn && <p className="inline-note">{t("This reward was enjoyed. Its original condition stays with its history.")}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <Button type="submit" className="wide">{t("Save reward")}</Button>
  </form>;
}
export function RewardDetail({ id }: { id: string }) {
  const t = useText();
  const { state, dispatch, open, toast, close, setTab } = useApp();
  const reward = state.personalRewards.find((r) => r.id === id);
  if (!reward) return <p>{t("This reward is no longer available.")}</p>;
  const eligibility = rewardEligibility(state, reward);
  const expired = reward.condition.kind === "weekly" && addDays(reward.condition.week, 6) < today(state);
  const retry = state.personalRewards.find((r) => r.previousAttemptId === id);
  return <div className="development-detail">
    <Gift size={33} strokeWidth={1.5} /><h1>{reward.name}</h1><span className="status-label">{t(rewardState(reward))}</span>
    <p>{rewardConditionText(state, reward)}</p>
    <ProgressBar value={eligibility.percent} label={t("Reward progress")} /><p className="muted">{eligibility.count} {t(" of ")}{eligibility.target} {reward.condition.kind === "goal" ? t("milestones") : t("check-ins")}</p>
    {reward.earnedOn && <p>{t("Earned ")}{t.shortDate(reward.earnedOn)}{reward.enjoyedOn ? t(" · Enjoyed {0}", undefined, [t.shortDate(reward.enjoyedOn)]) : t(". A little celebration is waiting.")}</p>}
    {reward.correctedOn && <p className="inline-note">{t("Records were corrected on ")}{t.shortDate(reward.correctedOn)} {t(" after you enjoyed this reward. Your enjoyed history is kept.")}</p>}
    {!reward.enjoyedOn && reward.earnedOn && <Button className="wide" onClick={() => { dispatch({ kind: "reward.enjoy", rewardId: id }); toast("Enjoyed. A moment worth keeping."); }}><Check size={17} />{t("Mark as enjoyed")}</Button>}
    {!reward.earnedOn && expired && <div className="inline-note"><p>{t("This week ended below your target. The effort you recorded stays.")}</p>{retry ? <Button variant="secondary" onClick={() => open({ type: "reward", id: retry.id })}>{t("View next attempt")}</Button> : <Button variant="secondary" onClick={() => { dispatch({ kind: "reward.retry", rewardId: id, newId: crypto.randomUUID() }); toast("A separate attempt is ready for the following week."); }}>{t("Try next week")}</Button>}</div>}
    {reward.condition.kind === "goal" && <Button variant="secondary" onClick={() => open({ type: "goal", id: reward.condition.kind === "goal" ? reward.condition.goalId : "" })}>{t("Open linked goal")}</Button>}
    <div className="detail-actions">
      {!reward.enjoyedOn && !reward.archivedOn && <Button variant="secondary" onClick={() => { dispatch({ kind: "reward.select", rewardId: id }); toast("Selected for Today and Journey. Earned rewards appear first."); }}>{state.selectedRewardId === id ? t("Selected for Today & Journey") : t("Feature on Today & Journey")}</Button>}
      <Button variant="ghost" onClick={() => open({ type: "rewardEdit", id })}>{t("Edit reward")}</Button>
      <Button variant="ghost" onClick={() => dispatch({ kind: "reward.archive", rewardId: id, archived: !reward.archivedOn })}>{reward.archivedOn ? t("Restore reward") : t("Archive reward")}</Button>
    </div>
    <p className="fine-print">{t("Marking it enjoyed records your own action. RISE doesn’t buy or book anything.")}</p>
    <Button variant="ghost" onClick={() => { close(); setTab("journey"); }}>{t("All rewards in Journey")}<ChevronRight size={16} /></Button>
  </div>;
}
