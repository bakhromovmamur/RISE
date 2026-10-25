import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Leaf,
  LockKeyhole,
  Pencil,
  Sparkles,
  Sprout,
  Sun,
  Trophy,
} from "lucide-react";
import { useApp } from "./context";
import { useText } from "./LifeUI";
import { PrayerProgress } from "./Prayers";
import { PersonalRewards } from "./Development";
import { weeklyHabits } from "./developmentModel";
import {
  addDays,
  formatDate,
  milestones,
  streaks,
  today,
  weekStart,
  weekStats,
  xpTotal,
} from "./model";
import {
  Badge,
  Button,
  GroupRow,
  Pip,
  ProgressBar,
  SectionTitle,
  TabHeading,
} from "./components";
export function Journey() {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, open } = useApp();
  const xp = xpTotal(state),
    next = pipMilestones.find((m) => m.xp > xp),
    unlocked = pipMilestones.find(
      (m) => xp >= m.xp && !state.claimed.includes(m.xp),
    );
  const current = unlocked ?? next ?? pipMilestones[4];
  const collected = pipMilestones.filter((m) => state.claimed.includes(m.xp)).length;
  const allCollected = collected === pipMilestones.length;
  const currentRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="screen journey-screen">
      <TabHeading title={t("Your journey", "Sizning yo‘lingiz")} />
      <section className="pip-unlock" aria-label={t("Your next Pip unlock")}>
        <div className="pip-unlock-heading">
          <div>
            <h2>{allCollected ? t("Pip’s collection is complete") : unlocked ? t("A little thing, earned") : t("Pip’s next unlock")}</h2>
            <p className="pip-unlock-name">{allCollected ? t("Every milestone, kept.") : current.reward}</p>
            <p className="pip-unlock-status">{allCollected ? t("Your small steps brought you here.") : unlocked ? t("Ready to claim") : t("{0} XP to go", undefined, [current.xp - xp])}</p>
          </div>
          <Pip size={92} mood={state.equipped === 250 ? "scarf" : unlocked ? "celebrate" : "welcome"} />
        </div>
        {!allCollected && <ProgressBar value={Math.min(100, xp / current.xp * 100)} label={t("Lifetime habit XP toward {0}", undefined, [current.reward])} />}
        <p className="unlock-xp">{t.number(xp)}{!allCollected && ` / ${t.number(current.xp)}`} {t(" lifetime habit XP")}</p>
        <Button variant={unlocked ? "primary" : "secondary"} className="wide" onClick={() => open(allCollected ? { type: "collection" } : { type: "milestone", xp: current.xp })}>
          {allCollected ? t("Open Pip’s collection") : unlocked ? t("Open your unlock") : t("Preview this unlock")}<ArrowRight size={17} />
        </Button>
      </section>
      <PersonalRewards compact />
      <details className="journey-disclosure">
        <summary><Sprout size={21} /><span><strong>{t("Explore Pip’s trail")}</strong><small>{collected} {t(" of ")}{pipMilestones.length} {t(" unlocks collected")}</small></span><ChevronRight size={18} /></summary>
        <div className="journey-disclosure-content">
          <p className="fine-print">{t("Full habit check-ins earn 20 XP; tiny ones earn 10. Prayer records stay separate.")}</p>
      <div className={`trail ${state.prefs.golden ? "golden" : ""}`}>
        <svg
          className="trail-route"
          viewBox="0 0 350 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="trail-shadow"
            d="M83 96 C83 175 263 175 263 267 S83 360 83 438 S263 530 263 609 S83 700 83 780"
          />
          <path d="M83 96 C83 175 263 175 263 267 S83 360 83 438 S263 530 263 609 S83 700 83 780" />
        </svg>
        {pipMilestones.map((m, i) => {
          const eligible = xp >= m.xp,
            claimed = state.claimed.includes(m.xp),
            isCurrent = m.xp === current.xp;
          return (
            <div
              className={`trail-stop stop-${i} ${isCurrent ? "current" : ""} ${eligible ? "reached" : "upcoming"}`}
              key={m.xp}
              style={{
                top: `${48 + i * 171}px`,
                left: i % 2 === 0 ? "9%" : "60%",
              }}
            >
              <button
                ref={isCurrent ? currentRef : undefined}
                className="trail-node"
                onClick={() => open({ type: "milestone", xp: m.xp })}
                aria-label={t("{0}, {1} lifetime XP, {2}", undefined, [m.reward, m.xp, claimed ? t("in your collection") : eligible ? t("ready to claim") : isCurrent ? t("next unlock") : t("Upcoming").toLowerCase()])}
              >
                {eligible ? (
                  <Badge xp={m.xp} size={72} />
                ) : isCurrent ? (
                  <Gift size={29} />
                ) : (
                  <LockKeyhole size={23} />
                )}
                <span className="node-status">
                  {claimed ? (
                    <Check size={11} />
                  ) : eligible ? (
                    <Sparkles size={11} />
                  ) : (
                    i + 1
                  )}
                </span>
              </button>
              <div className={`trail-label ${i % 2 ? "to-left" : "to-right"}`}>
                <h3>{m.name}</h3>
                <span>{t.number(m.xp)} XP</span>
                <p>
                  {claimed
                    ? t("Reached")
                    : eligible
                      ? t("Newly unlocked")
                      : isCurrent
                        ? t("Your next milestone")
                        : t("Up ahead")}
                </p>
                <small className="trail-reward-name">{m.reward}</small>
              </div>
            </div>
          );
        })}
        {state.claimed.includes(500) && (
          <span className="earned-plant">
            <Sprout size={45} />
          </span>
        )}
        <p className="trail-end">{t("There’s no rush. This is your path.")}</p>
      </div>
      <div className="back-current">
        <Button
          variant="secondary"
          onClick={() =>
            currentRef.current?.scrollIntoView({
              behavior: state.prefs.reduceMotion ? "instant" : "smooth",
              block: "center",
            })
          }
        >
          <ArrowDown size={16} /> {allCollected ? t("See the final milestone") : t("Find my next unlock")}
        </Button>
      </div>
        </div>
      </details>
      {!allCollected && <div className="journey-collection"><GroupRow icon={<Sparkles size={21} />} title={t("Pip’s collection")} detail={t("Dress Pip and revisit your keepsakes")} onClick={() => open({ type: "collection" })} /></div>}
      <p className="screen-footer">{t("Small steps. Little celebrations. Your own pace.")}</p>
    </div>
  );
}
export function Progress() {
  return <PrayerProgress />;
}
export function HabitProgress({ start: sharedStart, embedded = false }: { start?: string; embedded?: boolean } = {}) {
  const t = useText();
  const { state, open } = useApp();
  const [period, setPeriod] = useState<"this" | "last">("this");
  const start = sharedStart ?? addDays(weekStart(today(state)), period === "last" ? -7 : 0);
  const week = weeklyHabits(state, start),
    streak = streaks(state);
  const elapsed = week.days.filter((d) => d.date <= today(state)),
    due = elapsed.reduce((a, d) => a + d.scheduled, 0);
  const saved = state.reflections[start];
  return (
    <div className={embedded ? "progress-screen embedded-progress" : "screen progress-screen"}>
      {!embedded && <><header className="page-heading">
        <div>
          <h1>{t("Your progress")}</h1>
          <p>{t("Small things, adding up.")}</p>
        </div>
        <span className="heading-symbol">
          <Sun size={25} />
        </span>
      </header>
      <div className="segmented" aria-label={t("Week")}>
        <button
          aria-pressed={period === "this"}
          className={period === "this" ? "selected" : ""}
          onClick={() => setPeriod("this")}
        >
          {t("This week ")}</button>
        <button
          aria-pressed={period === "last"}
          className={period === "last" ? "selected" : ""}
          onClick={() => setPeriod("last")}
        >
          {t("Last week ")}</button>
      </div>
      <div className="week-title">
        <h2>
          {t.date(start, { month: "short", day: "numeric" })} –{" "}
          {t.date(addDays(start, 6), { day: "numeric", month: "short" })}
        </h2>
        <span>{t.date(start, { year: "numeric" })}</span>
      </div></>}
      <section className="weekly-card">
        <div className="weekly-summary">
          <strong>
            {week.checked}
            <span> / {week.total}</span>
          </strong>
          <p>
            {t("scheduled actions ")}<br />
            {t("checked in ")}</p>
          <span className="little-sprout">
            <Sprout size={29} />
          </span>
        </div>
        <div
          className="weekly-chart"
          role="group"
          aria-label={t("Daily check-ins, full and tiny completions")}
        >
          {week.days.map((d) => (
            <button
              key={d.date}
              className={`chart-day ${d.date === today(state) ? "is-today" : ""}`}
              onClick={() => open({ type: "history", date: d.date })}
              aria-label={t("{0}: {1} full, {2} tiny, {3} scheduled{4}", undefined, [t.date(d.date, { weekday: "long", month: "short", day: "numeric" }), d.full, d.tiny, d.scheduled, d.date > today(state) ? t(", upcoming") : ""])}
            >
              <span className="bar-label">
                {d.date > today(state) ? "–" : d.checked || "0"}
              </span>
              <span className="bar-lane">
                {d.scheduled > 0 && (
                  <span
                    className="bar-planned"
                    style={{
                      height: `${(d.scheduled / Math.max(3, ...week.days.map((x) => x.scheduled))) * 100}%`,
                    }}
                  >
                    <span
                      className="bar-tiny"
                      style={{ height: `${(d.tiny / d.scheduled) * 100}%` }}
                    />
                    <span
                      className="bar-full"
                      style={{ height: `${(d.full / d.scheduled) * 100}%` }}
                    />
                  </span>
                )}
              </span>
              <span className="day-name">
                {t.date(d.date, { weekday: "short" }).slice(0, 1)}
              </span>
              <span className="day-number">{Number(d.date.slice(-2))}</span>
            </button>
          ))}
        </div>
        <div className="chart-legend">
          <span>
            <i className="full-dot" />
            {week.full} {t(" full ")}</span>
          <span>
            <i className="tiny-dot" />
            {week.tiny} {t(" tiny ")}</span>
          <span>
            <i className="plan-dot" />
            {t("Scheduled ")}</span>
        </div>
        <div className="rate-row">
          <span>{t("Check-in rate")}</span>
          <strong>
            {week.rate === null ? "—" : `${t.number(Number(week.rate.toFixed(1)))}%`}
          </strong>
        </div>
        <p className="fine-print">
          {t("Full or tiny check-ins ÷ scheduled actions. ")}{start === weekStart(today(state)) &&
            t(" {0} scheduled through today; later days are upcoming.", undefined, [due])}
          {week.total === 0 && t(" No scheduled actions this week.")}
        </p>
      </section>
      {!embedded && <section className="observation">
        <Leaf size={21} />
        <p>
          {week.total === 0
            ? t("Your story starts with your first planned day.")
            : week.checked === 0
              ? t("A fresh week has room for a small beginning.")
              : t("{0} of {1} scheduled actions checked in: {2} full, {3} tiny. {4}", undefined, [week.checked, week.total, week.full, week.tiny, week.tiny ? t("Your smaller steps helped you show up.") : t("You made space for your plan.")])}
        </p>
      </section>}
      <details className="progress-detail-disclosure" open={embedded ? undefined : true}>
      <summary>{t("Individual habits")}<ChevronRight size={18} /></summary>
      <div className="group">{state.habits.map((h) => {
        const actions = week.days.filter((d) => d.date <= today(state)).flatMap((d) => d.rows.filter((o) => o.habitId === h.id));
        if (!actions.length) return null;
        const full = actions.filter((o) => o.check === "full").length, tiny = actions.filter((o) => o.check === "tiny").length;
        return <GroupRow key={h.id} title={h.name} detail={t("{0}/{1} scheduled · {2} full, {3} tiny{4}", undefined, [full + tiny, actions.length, full, tiny, h.archivedAt ? t(" · archived") : ""])} onClick={() => open({ type: "detail", id: h.id })} />;
      })}</div>
      {!week.total && <Button variant="secondary" onClick={() => open({ type: "edit" })}>{t("Add a habit")}</Button>}
      </details>
      <details className="progress-detail-disclosure" open={embedded ? undefined : true}>
      <summary>{t("Streaks & lifetime XP")}<ChevronRight size={18} /></summary>
      <p className="fine-print">{xpTotal(state)} {t(" lifetime habit XP. Streaks below are current and best across all recorded days.")}</p>
      <div className="streak-stats">
        <button onClick={() => open({ type: "streak" })}>
          <Flame size={20} />
          <strong>{streak.current}</strong>
          <span>
            {t("planned days ")}<br />
            {t("in a row ")}</span>
        </button>
        <button onClick={() => open({ type: "streak" })}>
          <Trophy size={20} />
          <strong>{streak.longest}</strong>
          <span>
            {t("longest planned-day ")}<br />
            {t("streak ")}</span>
        </button>
      </div>
      </details>
      {!embedded && <>
      <SectionTitle title={t("A moment to reflect")}>
        <Pencil size={18} />
      </SectionTitle>
      <p className="section-description">
        {t("What felt manageable? What could be smaller? ")}</p>
      <Button
        className="wide"
        variant="secondary"
        onClick={() => open({ type: "reflection", date: start })}
      >
        {saved ? t("Read your reflection") : t("Reflect on this week")}
        <ArrowRight size={17} />
      </Button>
      <p className="screen-footer">
        {t("No score for who you are. Just a record of your effort. ")}</p>
      </>}
    </div>
  );
}
