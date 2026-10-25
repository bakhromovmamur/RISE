import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Gift, ListChecks, Moon, Pause, PenLine, Plus, Sparkles, Sunrise, Target } from "lucide-react";
import { useApp } from "./context";
import { PauseSummary, TodayPrayerMeta } from "./Life";
import { FamilyToday, TaskRow } from "./groups/TodayGroups";
import {SharedTaskPriority} from './groups/SharedToday';
import {useSharedFamily} from './groups/sharedHooks';
import {isSharedPriority} from './domain/priorityReferences';
import { activePause } from "./lifeModel";
import { useText } from "./LifeUI";
import { PrayerLocationReview } from "./PrayerLive";
import { Button, GroupRow, SectionTitle, TabHeading } from "./components";
import { HabitCard } from "./Today";
import { HabitProgress } from "./Explore";
import { PrayerIcon, PrayerProgress, usePrayerClock } from "./Prayers";
import { GoalRow, MilestonePriority, shortDate, weekLabel } from "./Development";
import { addDays, formatDate, isReturn, milestones, today, weekStart, xpTotal } from "./model";
import {
  priorityKey, rewardEligibility,
  spotlightReward, weekGoalMovement, weeklyHabits, type ProgressView,
} from "./developmentModel";
import {
  PRAYERS, clockText, getCurrentPrayerDay, getPrayerDay, minuteOf, phaseLabel, prayerDayOrigin,
  prayerName, prayerPhase, prayerProminence, preparationDate, weeklyPrayers,
} from "./prayerModel";

function FajrRow() {
  const t = useText();
  const { state, open } = useApp(), date = preparationDate(state), saved = state.prayers.prepared[date];
  return <div className="tomorrow-row">
    <GroupRow icon={<Moon size={20} />} title={saved ? t("Fajr plan saved", "Bomdod rejasi saqlandi") : t("Prepare for Fajr", "Bomdodga tayyorlanish")}
      detail={`${t.shortDate(date)} · ${saved ? t("Bedtime {0}", undefined, [saved.bedtime]) : t("Make waking a little easier")}`} onClick={() => open({ type: "fajr" })} />
  </div>;
}
export function RewardCue({ overview = false, compact = false }: { overview?: boolean; compact?: boolean } = {}) {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, open } = useApp(), xp = xpTotal(state);
  const pip = pipMilestones.find((m) => xp >= m.xp && !state.claimed.includes(m.xp)) ?? pipMilestones.find((m) => m.xp > xp);
  const personal = spotlightReward(state), progress = personal && rewardEligibility(state, personal);
  return <section className={`reward-cue ${compact ? "quiet-rewards" : ""}`} aria-label={t("Your next rewards")}>
    {!compact && <div className="cue-heading"><Gift size={17} /><h2>{overview ? t("Your rewards now") : t("Something to look forward to")}</h2></div>}
    <button onClick={() => open(pip ? { type: "milestone", xp: pip.xp } : { type: "collection" })}>
      <Sparkles size={18} /><span><strong>{pip?.reward ?? t("Pip’s collection")}</strong><small>{pip ? xp >= pip.xp ? t("Ready to unlock") : t("{0} XP to unlock{1}", undefined, [pip.xp - xp, compact ? "" : t(" · {0}/{1} lifetime XP", undefined, [xp, pip.xp])]) : t("Every trail milestone reached")}</small></span><ChevronRight size={17} />
    </button>
    <button onClick={() => open(personal ? { type: "reward", id: personal.id } : { type: "rewardEdit" })}>
      <Gift size={18} /><span><strong>{personal?.name ?? t("Choose a personal reward", "Shaxsiy mukofot tanlash")}</strong><small>{personal ? personal.earnedOn ? t("Earned · ready to enjoy") : `${progress!.count}/${progress!.target} ${personal.condition.kind === "weekly" ? t("check-ins") : t("milestones")} · ${personal.condition.kind === "weekly" ? t.week(personal.condition.week) : t("linked goal")}` : t("For a goal or a week of showing up")}</small></span><ChevronRight size={17} />
    </button>
  </section>;
}
function PrayerOverview() {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open } = useApp(), now = usePrayerClock(), day = getCurrentPrayerDay(state, now.date);
  const savedDay = getPrayerDay(state, now.date), needsReview = !!savedDay && prayerDayOrigin(savedDay) === "review";
  const recover = !!state.life.calculation || needsReview;
  const { next, level, canRecord } = prayerProminence(state, now);
  const pending = day ? prayerOptions.filter(({ id }) => prayerPhase(state, now.date, id, now) === "unconfirmed") : [];
  const start = () => {
    if (!next) return;
    dispatch({ kind: "work.begin", prayer: next.id, date: next.date });
    open({ type: "workBreak" });
  };
  const paused = !!activePause(state);
  return <section className={`balanced-prayer ${level}`} aria-label={t("Salah first")}>
    {paused && <PauseSummary />}
    {day ? <>
      <div className="prayer-strip" aria-label={t("Your five daily prayers")}>{prayerOptions.map(({ id, name }) => {
        const phase = prayerPhase(state, now.date, id, now);
        return <button key={id} className={`prayer-anchor ${phase}${next?.id === id && next.date === now.date ? " current" : ""}`} aria-label={t("{0}, {1}, planned {2}", undefined, [name, t(phaseLabel[phase]), day.entries[id].target])} onClick={() => open({ type: "prayer", prayer: id, date: now.date })}>
          <span className="prayer-dot">{phase === "on_time" ? <Check size={18} /> : phase === "paused" ? <Pause size={16} /> : <PrayerIcon id={id} size={19} />}</span><strong>{name}</strong><small>{day.entries[id].target}</small>
        </button>;
      })}</div>
      <div className="compact-prayer-summary">
        <span><strong>{next ? `${level === "due" ? t("Time for") : t("Next:")} ${t(prayerName(next.id))}` : t("Today’s prayers")}</strong><small>{next ? t("Planned {0}{1}", undefined, [next.entry.target, canRecord && level !== "due" ? t(" · recording open") : ""]) : t("Your records are always here")}</small></span>
        {next && canRecord && <button className="text-button" onClick={() => open({ type: "prayer", prayer: next.id, date: next.date })}>{t("Record")}<ChevronRight size={15} /></button>}
      </div>
      {level !== "compact" && next && <div className="prayer-prompt">
        <p>{level === "prepare" ? t("{0} is close. Save one line for your return.", undefined, [t(prayerName(next.id))]) : next.id === "fajr" ? t("Feet on the floor. Your morning begins with one small move.") : t("Your work will be here. Save your place, then step away.")}</p>
        <Button className="wide" onClick={next.id === "fajr" ? () => open({ type: "wake", date: next.date }) : start}>{next.id === "fajr" ? <Sunrise size={18} /> : <Pause size={17} />}{next.id === "fajr" ? t("Open Fajr wake-up") : t("Save & step away")}</Button>
      </div>}
      {pending.length > 0 && <button className="pending-inline" onClick={() => open({ type: "prayer", date: now.date, prayer: pending[0].id })}>{t("{0} pending {1} · No assumption made", undefined, [pending.length, pending.length === 1 ? "record" : "records"])}<ChevronRight size={15} /></button>}
      <TodayPrayerMeta />
    </> : <div className="empty-prayer"><Sunrise size={23} /><div><h2>{needsReview ? t("Review saved prayer times", "Saqlangan namoz vaqtlarini tekshiring") : recover ? t("Prayer times unavailable", "Namoz vaqtlari mavjud emas") : t("Salah comes first.")}</h2><p>{needsReview ? t("Compare this saved date with a trusted timetable and time zone, then save again.", "Bu saqlangan sanani ishonchli jadval va vaqt mintaqasi bilan solishtiring, so‘ng qayta saqlang.") : recover ? t("Check your location and method, or use a trusted timetable for this date.", "Joylashuv va usulni tekshiring yoki bu sana uchun ishonchli jadvaldan foydalaning.") : t("Choose your city to preview a daily prayer plan.")}</p></div><Button variant="secondary" onClick={() => open({ type: recover ? "timetable" : "prayerSetup", date: now.date })}>{recover ? t("Enter a timetable manually", "Jadvalni qo‘lda kiritish") : t("Set up prayer times")}</Button></div>}
    {!day && <PrayerLocationReview />}
  </section>;
}
export function BalancedToday() {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open, setTab, setProgressView } = useApp(), date = today(state), now = usePrayerClock();
  useEffect(() => { if (!state.dailyPriorities[date]) dispatch({ kind: "priorities.ensure", date }); }, [date, state.dailyPriorities, dispatch]);
  const priorities = state.dailyPriorities[date] ?? [];
  const sharedFamily=useSharedFamily(priorities);
  const rows = state.days[date] ?? [], priorityHabits = new Set(priorities.flatMap((p) => p.kind === "habit" ? [p.habitId] : []));
  const routine = rows.filter((o) => !priorityHabits.has(o.habitId));
  const pending = routine.filter((o) => !o.check), done = routine.filter((o) => o.check);
  const goals = state.goals.filter((g) => g.status === "active");
  const evening = now.minute >= minuteOf(getPrayerDay(state, date)?.entries.maghrib.begins ?? "18:00");
  const work = state.prayers.work;
  const isDone = (p: typeof priorities[number]) => !!(isSharedPriority(p)?sharedFamily.occurrence(p)?.completed:p.kind === "task" ? state.life.tasks.find((task) => task.id === p.taskId)?.completions[p.date] : p.kind === "habit" ? rows.find((o) => o.habitId === p.habitId)?.check : state.goals.find((g) => g.id === p.goalId)?.milestones.find((m) => m.id === p.milestoneId)?.completedOn);
  const completed = priorities.filter(isDone).length;
  const prioritiesDone = priorities.length > 0 && completed === priorities.length;
  const nextHabit = priorities.find((p) => p.kind === "habit" && !isDone(p));
  const recordedSetback = prayerOptions.some(({ id }) => ["missed", "later"].includes(getPrayerDay(state, date)?.entries[id].check ?? ""));
  const lighterStart = recordedSetback || isReturn(state) || evening;
  const bedtime = now.minute >= 21 * 60;
  const oldBreak = work && prayerPhase(state, work.date, work.prayer, now) === "unconfirmed";
  const prayerDue = prayerProminence(state, now).level === "due";
  return <div className="screen balanced-today">
    <TabHeading title={`${t("Your day", "Sizning kuningiz")}, ${state.name}.`}><p className="today-date">{t.date(date, { weekday: "long", month: "short", day: "numeric" })}{state.mode === "demo" ? t(" · Demo day", " · Namunaviy kun") : ""}<span>{clockText(now.minute)}</span></p></TabHeading>
    <PrayerOverview />
    {evening && <FajrRow />}
    {work && work.stage !== "returned" && <button className="resume-note compact-return" onClick={() => open({ type: "workBreak" })}><PenLine size={18} /><span><strong>{oldBreak ? t("{0} · record or return", "{0} · qayd etish yoki qaytish", [t(prayerName(work.prayer))]) : t("Continue your prayer break")}</strong><small>{work.note || t("Your place is saved here.")}</small></span><ChevronRight size={16} /></button>}
    <section className="today-focus" aria-label={t("Your priorities", "Ustuvor ishlaringiz")}>
    <SectionTitle title={t("Your priorities", "Ustuvor ishlaringiz")}><button className="text-button" aria-label={t("Edit priorities", "Ustuvor ishlarni o‘zgartirish")} onClick={() => open({ type: "priorities", date })}>{t("Edit", "Tahrirlash")}</button></SectionTitle>
    {!prioritiesDone && !!priorities.length && (lighterStart ? <div className="lighter-day">
      <p className="focus-caption">{bedtime ? t("You can leave the rest for today. Unfinished habits stay in today’s history; tomorrow gets its own plan. Your XP and earned rewards stay.", "Qolganini bugun bajarmasangiz ham bo‘ladi. Tugallanmagan odatlar bugungi tarixda qoladi; ertaning o‘z rejasi bor. XP va olingan mukofotlar saqlanadi.") : t("Your earlier progress stays. Try one tiny step, or choose fewer priorities.", "Avvalgi natijalaringiz saqlanadi. Bitta kichik qadamdan boshlang yoki ustuvor ishlarni kamaytiring.")}</p>
      {priorities.length > 1 && <button className="text-button" onClick={() => open({ type: "priorities", date })}>{t("Make today lighter", "Bugungi rejani yengillashtirish")}<ChevronRight size={15} /></button>}
    </div> : <p className="focus-caption">{completed} {t("of", "/")} {priorities.length} {t("done. One small step at a time.", "bajarildi. Bittadan kichik qadam.")}</p>)}
    {prioritiesDone && <p className="priority-complete"><Check size={17} />{t("Your priorities are done. Let that feel good.")}</p>}
    <div className="priority-list">{priorities.map((p) => {
      if (p.kind === "task") {
        if(isSharedPriority(p))return <SharedTaskPriority key={priorityKey(p)} priority={p}/>;
        const task = state.life.tasks.find((task) => task.id === p.taskId);
        return task ? <TaskRow key={priorityKey(p)} task={task} date={p.date} priority /> : <p className="fine-print" key={priorityKey(p)}>{t("This family task is no longer available.")}</p>;
      }
      if (p.kind === "milestone") return <MilestonePriority key={priorityKey(p)} goalId={p.goalId} milestoneId={p.milestoneId} compact />;
      const item = rows.find((o) => o.habitId === p.habitId);
      const featured = p === nextHabit && !item?.check;
      return item ? <HabitCard key={priorityKey(p)} item={item} featured={featured && !prayerDue} compact={!featured} recovery={lighterStart && featured} /> : <div className="inline-note" key={priorityKey(p)}>{t("This habit was archived. Edit priorities if you’d like a different focus.")}</div>;
    })}</div>
    {!priorities.length && <div className="empty-inline"><p>{rows.length || goals.length ? t("A little focus can make starting easier.") : t("Make room for a small beginning.")}</p><Button variant="secondary" onClick={() => open({ type: rows.length || goals.length ? "priorities" : "edit", date })}>{rows.length || goals.length ? t("Choose priorities") : t("Add your first habit")}</Button></div>}
    </section>
    <RewardCue compact />
    <section className="today-rest" aria-label={t("The rest of your day", "Kuningizning qolgan qismi")}>
    <h2>{t("The rest of your day", "Kuningizning qolgan qismi")}</h2>
    <details className="today-disclosure">
      <summary><ListChecks size={20} /><span><strong>{t("My routine", "Kundalik ishlarim")}</strong><small>{pending.length ? `${pending.length} ${t("still to do", "ta bajariladigan ish")}` : t("Nothing else planned", "Boshqa reja yo‘q")}{done.length ? ` · ${done.length} ${t("done", "bajarildi")}` : ""}</small></span><ChevronRight size={18} /></summary>
      <div className="disclosure-content">
    <div className="routine-list">{pending.map((item) => <HabitCard key={item.habitId} item={item} />)}</div>
    {!pending.length && <p className="muted routine-quiet">{done.length ? t("Everything else planned for today is checked in.") : t("No other habits scheduled today.")}</p>}
    {done.length > 0 && <details className="done-group"><summary>{t("Done today · ")}{done.length}</summary>{done.map((item) => <HabitCard key={item.habitId} item={item} />)}</details>}
    <button className="text-button" onClick={() => open({ type: "manage" })}>{t("Manage all habits")}<ChevronRight size={15} /></button>
    <button className="text-button routine-add" onClick={() => open({ type: "edit" })}><Plus size={16} />{t("Add a habit", "Odat qo‘shish")}</button>
      </div>
    </details>
    <FamilyToday />
    <details className="today-disclosure">
      <summary><Target size={20} /><span><strong>{t("Your goals", "Maqsadlaringiz")}</strong><small>{goals.length ? `${goals.length} ${t("in progress", "ta davom etmoqda")} · ${goals[0].title}` : t("Give your small steps a direction", "Kichik qadamlarga yo‘nalish bering")}</small></span><ChevronRight size={18} /></summary>
      <div className="disclosure-content">
        {goals.length ? <div className="goal-list">{goals.slice(0, 3).map((g) => <GoalRow key={g.id} goal={g} />)}</div> : <div className="empty-inline"><Button variant="secondary" onClick={() => open({ type: "goalEdit" })}>{t("Create a goal")}</Button></div>}
        <button className="text-button" onClick={() => { setProgressView("goals"); setTab("progress"); }}>{t("All goals in Progress", "Barcha maqsadlar Natijalarda")}<ChevronRight size={15} /></button>
      </div>
    </details>
    {!evening && <FajrRow />}
    {work?.stage === "returned" && <button className="resume-note compact-return saved-return" onClick={() => open({ type: "workBreak" })}><PenLine size={18} /><span><strong>{t("Your return note", "Ishga qaytish qaydingiz")}</strong><small>{work.note || t("Your place is saved here.")}</small></span><ChevronRight size={16} /></button>}
    </section>
    <p className="screen-footer">{state.mode === "demo" ? t("Fictional sample history. ") : ""}{t("Reminder and alarm delivery are previews.")}</p>
  </div>;
}
const views: ProgressView[] = ["overview", "salah", "habits", "goals"];
function ProgressSummary({ title, icon, headline, context, children }: {
  title: string; icon: ReactNode; headline: string; context: string; children: ReactNode;
}) {
  return <details className="progress-disclosure">
    <summary>
      {icon}<span><strong>{title}</strong><span className="progress-headline">{headline}</span><small>{context}</small></span><ChevronRight size={18} />
    </summary>
    <div className="progress-disclosure-content">{children}</div>
  </details>;
}
export function BalancedProgress() {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, open, progressView, setProgressView, setTab } = useApp(), current = weekStart(today(state)), now = usePrayerClock();
  // Store the selected date, not an offset: changing days never silently changes the inspected week.
  const [selected, setSelected] = useState(current);
  const start = selected > current ? current : selected;
  const habits = weeklyHabits(state, start), prayers = weeklyPrayers(state, start, now), movement = weekGoalMovement(state, start);
  const active = state.goals.filter((g) => g.status === "active");
  const history = state.goals.filter((g) => g.status !== "active");
  const weeklyMilestones = movement.reduce((n, item) => n + item.completed, 0);
  const visibleGoals = movement.filter(({ goal, completed }) => goal.status === "active" || completed > 0);
  const weekContext = start === current ? t("This week") : t("Selected week");
  const hasPrayerTimes = Object.keys(state.prayers.days).some((d) => d >= start && d <= addDays(start, 6));
  const readyUnlocks = pipMilestones.filter((m) => xpTotal(state) >= m.xp && !state.claimed.includes(m.xp)).length;
  const readyRewards = state.personalRewards.filter((r) => r.earnedOn && !r.enjoyedOn && !r.archivedOn).length;
  const rewardAvailability = [
    readyUnlocks ? `${readyUnlocks} ${t(readyUnlocks === 1 ? "Pip unlock ready" : "Pip unlocks ready", "ta Pip mukofoti tayyor")}` : "",
    readyRewards ? `${readyRewards} ${t(readyRewards === 1 ? "personal reward earned" : "personal rewards earned", "ta shaxsiy mukofot olindi")}` : "",
  ].filter(Boolean).join(" · ");
  const earliest = [current, state.prayers.started, ...state.habits.map((h) => h.created), ...state.goals.map((g) => g.createdOn)].sort()[0];
  return <div className="screen balanced-progress">
    <TabHeading title={t("Your progress", "Natijalaringiz")} />
    <div className="progress-views" role="tablist" aria-label={t("Progress views")}>{views.map((view, i) => <button key={view} role="tab" aria-selected={view === progressView} aria-controls={`progress-${view}`} tabIndex={view === progressView ? 0 : -1} onClick={() => setProgressView(view)} onKeyDown={(e) => {
      const next = e.key === "ArrowRight" ? (i + 1) % 4 : e.key === "ArrowLeft" ? (i + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : null;
      if (next === null) return;
      e.preventDefault(); setProgressView(views[next]); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    }}>{t(view[0].toUpperCase() + view.slice(1))}</button>)}</div>
    <div className="shared-week">
      <button className="icon-button" aria-label={t("Previous week")} disabled={start <= weekStart(earliest)} onClick={() => setSelected(addDays(start, -7))}><ChevronLeft size={20} /></button>
      <div><strong>{t.week(start)}</strong><span>{start === current ? t("This week") : t("Selected week")} · {t.date(start, { year: "numeric" })}</span></div>
      <button className="icon-button" aria-label={t("Next week")} disabled={start >= current} onClick={() => setSelected(addDays(start, 7))}><ChevronRight size={20} /></button>
    </div>
    {start !== current && <button className="text-button week-reset" onClick={() => setSelected(current)}>{t("Back to this week")}</button>}
    <div role="tabpanel" aria-label={t("{0} progress", undefined, [t.language !== "en" ? t(progressView[0].toUpperCase() + progressView.slice(1)) : progressView])} id={`progress-${progressView}`}>
      {progressView === "overview" && <div className="progress-overview">
        <ProgressSummary title={t("Salah")} icon={<Sunrise size={22} />}
          headline={hasPrayerTimes ? t("{0} {1} on time", undefined, [prayers.on_time, prayers.on_time === 1 ? t("prayer") : t("prayers")]) : t("Set up your prayer times")}
          context={activePause(state) ? t("Tracking paused now · streaks hold") : !hasPrayerTimes ? t("Choose a city to begin") : prayers.paused ? t("{0} paused · excluded from tracking", undefined, [prayers.paused]) : prayers.unconfirmed ? t("{0} unlogged · waiting for your record", undefined, [prayers.unconfirmed]) : prayers.noTimes ? t("{0} days without times", undefined, [prayers.noTimes]) : t("{0} · your own records", undefined, [weekContext])}>
          <dl className="progress-breakdown">
            <div><dt>{t("On time")}</dt><dd>{prayers.on_time}</dd></div>
            <div><dt>{t("Prayed later")}</dt><dd>{prayers.later}</dd></div>
            <div><dt>{t("Recorded missed")}</dt><dd>{prayers.missed}</dd></div>
            <div><dt>{t("Unlogged")}</dt><dd>{prayers.unconfirmed}</dd></div>
          </dl>
          <p className="fine-print">{prayers.open} {t(" ready to record · ")}{prayers.upcoming} {t(" upcoming. Unlogged prayers are never assumed missed.")}</p>
          {prayers.paused > 0 && <p className="fine-print">{prayers.paused} {t(" paused prayers are excluded. Paused days hold your streak without adding to it.")}</p>}
          {!hasPrayerTimes && <Button variant="secondary" onClick={() => open({ type: "prayerSetup" })}>{t("Set up prayer times")}</Button>}
          <button className="text-button" onClick={() => setProgressView("salah")}>{t("Prayer calendar & streaks")}<ChevronRight size={15} /></button>
        </ProgressSummary>
        <ProgressSummary title={t("Habits")} icon={<ListChecks size={22} />}
          headline={habits.total ? t("{0} of {1} checked in", undefined, [habits.checked, habits.total]) : t("No habits scheduled")}
          context={start === current ? t("Scheduled through today") : t("Scheduled in the selected week")}>
          <dl className="progress-breakdown">
            <div><dt>{t("Full check-ins")}</dt><dd>{habits.full}</dd></div>
            <div><dt>{t("Tiny check-ins")}</dt><dd>{habits.tiny}</dd></div>
            <div><dt>{t("Check-in rate")}</dt><dd>{habits.rate === null ? "—" : `${t.number(Number(habits.rate.toFixed(1)))}%`}</dd></div>
            <div><dt>{t("Upcoming actions")}</dt><dd>{habits.upcoming}</dd></div>
          </dl>
          <p className="fine-print">{t("Full and tiny each count once. Future days stay upcoming.")}</p>
          <p className="fine-print">{t("Unfinished habits don’t remove earlier check-ins or XP, and aren’t added to tomorrow as extra tasks.", "Tugallanmagan odatlar avvalgi qaydlar yoki XPni o‘chirmaydi va ertaga qo‘shimcha vazifa sifatida o‘tmaydi.")}</p>
          {!state.habits.some((h) => !h.archivedAt) && <Button variant="secondary" onClick={() => open({ type: "edit" })}>{t("Add a habit")}</Button>}
          <button className="text-button" onClick={() => setProgressView("habits")}>{t("Daily history & habits")}<ChevronRight size={15} /></button>
        </ProgressSummary>
        <ProgressSummary title={t("Goals")} icon={<Target size={22} />}
          headline={state.goals.length ? t("{0} milestone{1} completed", undefined, [weeklyMilestones, weeklyMilestones === 1 ? "" : "s"]) : t("Give your small steps a direction")}
          context={t("{0} · {1} active {2} now", undefined, [weekContext, active.length, active.length === 1 ? t("goal") : t("goals")])}>
          {visibleGoals.slice(0, 3).map(({ goal, completed }) => <GoalRow key={goal.id} goal={goal} weekly={completed} weekContext={start === current ? "this week" : "selected week"} compact />)}
          {!state.goals.length && <Button variant="secondary" onClick={() => open({ type: "goalEdit" })}>{t("Create a goal")}</Button>}
          {state.goals.length > 0 && !visibleGoals.length && <p className="fine-print">{t("No milestones completed in this week. Your saved goals are still here.")}</p>}
          <button className="text-button" onClick={() => setProgressView("goals")}>{t("All goals")}<ChevronRight size={15} /></button>
        </ProgressSummary>
        <button className="progress-rewards-link" onClick={() => setTab("journey")}>
          <Gift size={22} /><span><strong>{t("Rewards in Journey", "Yo‘ldagi mukofotlar")}</strong>
          <span className="progress-headline">{rewardAvailability || t("See what you’re working toward", "Intilayotgan mukofotlaringizni ko‘ring")}</span>
          <small>{t("Available now · separate from this week", "Hozirgi holat · bu haftadan alohida")}</small></span><ChevronRight size={18} />
        </button>
        <button className="progress-reflection" onClick={() => open({ type: "reflection", date: start })}><PenLine size={20} /><span><strong>{state.reflections[start] ? t("Read your reflection") : t("A moment to reflect")}</strong><small>{t.week(start)} {t(" · What felt manageable?")}</small></span><ChevronRight size={17} /></button>
      </div>}
      {progressView === "salah" && <PrayerProgress start={start} embedded />}
      {progressView === "habits" && <HabitProgress start={start} embedded />}
      {progressView === "goals" && <>
        <SectionTitle title={t("Your goals")}><button className="text-button" onClick={() => open({ type: "goalEdit" })}><Plus size={16} />{t("New goal")}</button></SectionTitle>
        <p className="fine-print">{t("Current overall progress. Weekly movement below each goal uses ")}{t.week(start)}.</p>
        {!active.length && <div className="empty-inline"><p>{state.goals.length ? t("Room for your next goal.") : t("What would you like your small steps to lead to?")}</p><Button variant="secondary" onClick={() => open({ type: "goalEdit" })}>{t("Create a goal")}</Button></div>}
        {active.map((g) => <GoalRow key={g.id} goal={g} weekly={movement.find((m) => m.goal.id === g.id)?.completed ?? 0} weekContext={start === current ? "this week" : "selected week"} />)}
        {history.length > 0 && <details className="done-group"><summary>{t("Completed, paused & archived · ")}{history.length}</summary>{history.map((g) => <div key={g.id}><span className="status-label">{t(g.status)}</span><GoalRow goal={g} weekly={movement.find((m) => m.goal.id === g.id)?.completed ?? 0} weekContext={start === current ? "this week" : "selected week"} /></div>)}</details>}
        <p className="fine-print">{t("Linked habits support your goals. Milestones are yours to mark complete; they don’t add XP.")}</p>
      </>}
    </div>
    <p className="screen-footer">{state.mode === "demo" ? t("Includes fictional sample history. ") : ""}{t("No score for who you are. A record of your effort.")}</p>
  </div>;
}
