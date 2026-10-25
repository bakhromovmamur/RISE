import {
  ArrowRight,
  Check,
  ChevronRight,
  CirclePlus,
  MoreHorizontal,
  Sprout,
  Sunrise,
  Trophy,
} from "lucide-react";
import { useApp } from "./context";
import { useText } from "./LifeUI";
import {
  countDay,
  formatDate,
  isReturn,
  milestones,
  streaks,
  targetLabel,
  today,
  xpTotal,
  type Occurrence,
} from "./model";
import {
  Button,
  CheckMark,
  EmptyState,
  HabitIcon,
  IconButton,
  Pip,
  ProgressBar,
  SectionTitle,
  Streak,
} from "./components";
export function HabitCard({
  item,
  featured = false,
  recovery = false,
  compact = false,
}: {
  item: Occurrence;
  featured?: boolean;
  recovery?: boolean;
  compact?: boolean;
}) {
  const t = useText();
  const { state, open, log } = useApp();
  const h = state.habits.find((h) => h.id === item.habitId);
  const name = h?.name ?? item.name;
  const tinyFirst = recovery && item.tiny !== null;
  const primaryLabel = item.type === "check" ? tinyFirst ? t("Log a tiny version") : t("Log full target") : t("Log {0}", undefined, [t.target(item, tinyFirst ? item.tiny : undefined)]);
  const goals = state.goals.filter((g) => g.status !== "archived" && g.habitIds.includes(item.habitId));
  if (compact) return <article className={`today-habit ${item.check ? "completed" : ""}`}>
    <button className="today-habit-main" aria-label={t("View {0}", undefined, [name])} onClick={() => open({ type: "detail", id: item.habitId })}>
      <HabitIcon name={h?.icon ?? item.icon} />
      <span><strong>{name}</strong><small>{item.check === "full" ? t("Full target completed", "To‘liq bajarildi") : item.check === "tiny" ? t("Tiny version completed", "Kichik qadam bajarildi") : t.target(item)}</small></span>
      {item.check ? <CheckMark tiny={item.check === "tiny"} /> : null}
    </button>
    {!item.check && <button className="today-check" aria-label={t("Log full {0}: {1}", undefined, [name, t.target(item)])} title={t("Mark full target complete", "To‘liq bajarildi deb belgilash")} onClick={() => log(item.habitId, "full")}><Check size={19} /></button>}
    {item.check && <ChevronRight size={16} className="muted" aria-hidden="true" />}
  </article>;
  return (
    <article
      className={`habit-card ${featured ? "featured" : ""} ${item.check ? "completed" : ""}`}
    >
      <button
        className="habit-main"
        onClick={() => open({ type: "detail", id: item.habitId })}
        aria-label={t("View {0}", undefined, [name])}
      >
        <HabitIcon name={h?.icon ?? item.icon} />
        <span className="habit-copy">
          <strong>{name}</strong>
          <span>
            {item.check === "full"
              ? t("Full target completed")
              : item.check === "tiny"
                ? t("Tiny version completed")
                : t.target(item)}
          </span>
        </span>
        {item.check ? (
          <CheckMark tiny={item.check === "tiny"} />
        ) : (
          <ChevronRight size={18} className="muted" />
        )}
      </button>
      {!item.check && (
        <>
          <p className="habit-cue">{item.cue || t("Whenever it fits your day")}</p>
          <div className="habit-actions">
            <Button
              onClick={() =>
                log(
                  item.habitId,
                  tinyFirst ? "tiny" : "full",
                )
              }
              aria-label={
                tinyFirst
                  ? t("{0} +10 · Tiny {1}", undefined, [primaryLabel, name])
                  : undefined
              }
              variant={featured ? "primary" : "secondary"}
            >
              <Check size={17} />
              <span className="habit-action-label">{primaryLabel}</span>
              <span className="xp-label">
                {tinyFirst ? "+10" : "+20"}
              </span>
            </Button>
            {item.tiny !== null && (
              <button
                className="tiny-button"
                onClick={() => log(item.habitId, tinyFirst ? "full" : "tiny")}
                aria-label={
                  tinyFirst
                    ? t("Full · {0} · Log {1}", undefined, [t.target(item), name])
                    : t("Log tiny {0}: {1}", undefined, [name, t.target(item, item.tiny)])
                }
              >
                <Sprout size={15} />
                <span>
                  {tinyFirst ? t("Full") : t("Tiny")} ·{" "}
                  {t.target(item, tinyFirst ? undefined : item.tiny)}
                </span>
              </button>
            )}
          </div>
        </>
      )}
      {item.check === "tiny" && (
        <button
          className="upgrade-link"
          onClick={() => log(item.habitId, "full")}
        >
          {t("Upgrade to full target")}{" "}
          <span>
            {t("+10 XP ")}<ArrowRight size={14} />
          </span>
        </button>
      )}
      {goals.map((g) => <button key={g.id} className="habit-goal-link" onClick={() => open({ type: "goal", id: g.id })}>{t("Supports: ")}{g.title}<ChevronRight size={14} /></button>)}
      {item.check && <button className="text-button habit-undo" onClick={() => log(item.habitId, null)}>{t("Undo check-in")}</button>}
    </article>
  );
}
export function Today() {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, open, setTab } = useApp();
  const date = today(state),
    rows = state.days[date] || [],
    stats = countDay(rows),
    xp = xpTotal(state),
    streak = streaks(state).current;
  const pending = rows.filter((o) => !o.check),
    done = rows.filter((o) => o.check);
  const recovery = isReturn(state),
    next = pipMilestones.find((m) => m.xp > xp);
  const all = rows.length > 0 && !pending.length;
  const active = state.habits.filter((h) => !h.archivedAt).length;
  function addHabit() {
    open({ type: "edit" });
  }
  return (
    <div className="screen today-screen">
      <header className="today-heading">
        <div>
          <p className="date-label">
            {t.date(date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <h1>
            {recovery ? t("Welcome back,") : t("Hello,")}
            <br />
            {state.name} <span className="greeting-dot">.</span>
          </h1>
        </div>
        <Streak count={streak} onClick={() => open({ type: "streak" })} />
      </header>
      {rows.length > 0 ? (
        <>
          <section className={`companion-scene ${all ? "all-done" : ""}`}>
            <div className="scene-copy">
              <span className="scene-spark">
                <Sunrise size={19} />
              </span>
              <h2>
                {recovery
                  ? t("A small step\nis a fresh start.")
                  : all
                    ? t("Look at you,\nshowing up.")
                    : t("Small steps.\nReal momentum.")}
              </h2>
              <p>
                {recovery
                  ? t("Your progress is still here.")
                  : all
                    ? t("Your effort has a place here.")
                    : t("A little is a lovely place to start.")}
              </p>
            </div>
            <Pip
              mood={
                all
                  ? "celebrate"
                  : recovery
                    ? "return"
                    : state.equipped === 250
                      ? "scarf"
                      : "welcome"
              }
              size={171}
            />
            <span className="scene-orbit orbit-one" />
            <span className="scene-orbit orbit-two" />
          </section>
          <div className="daily-progress">
            <div className="progress-caption">
              <h2>
                {stats.checked}{" "}
                <span>{t("of ")}{stats.scheduled} {t(" habits checked in")}</span>
              </h2>
              <span className="progress-fraction">
                {Math.round((stats.checked / stats.scheduled) * 100)}%
              </span>
            </div>
            <ProgressBar
              value={(stats.checked / stats.scheduled) * 100}
              label={t("Today's habits checked in")}
            />
            <p>
              {stats.checked
                ? t("{0} full · {1} tiny{2}", undefined, [stats.full, stats.tiny, all ? t(" · All checked in") : t(" · Every bit counts")])
                : t("A fresh page. Make one small mark.")}
            </p>
          </div>
          <SectionTitle
            title={
              pending.length
                ? recovery
                  ? t("Start small today")
                  : t("Your daily plan")
                : t("You showed up")
            }
          >
            <IconButton
              label={t("Manage habits")}
              onClick={() => open({ type: "manage" })}
            >
              <MoreHorizontal size={22} />
            </IconButton>
          </SectionTitle>
          {recovery && (
            <p className="supportive-note">
              {t("Start with something small. Your tiny version counts as showing up. ")}</p>
          )}
          <div className="habit-list">
            {pending.map((o, i) => (
              <HabitCard
                key={o.habitId}
                item={o}
                featured={i === 0}
                recovery={recovery && i === 0}
              />
            ))}
          </div>
          {recovery && pending[0] && (
            <button
              className="text-button recovery-adjust"
              onClick={() => open({ type: "edit", id: pending[0].habitId })}
            >
              {t("Make a future target smaller ")}<ArrowRight size={15} />
            </button>
          )}
          {done.length > 0 && (
            <>
              <div className="done-heading">
                <Check size={16} />
                <span>{t("Checked in · ")}{done.length}</span>
              </div>
              <div className="habit-list">
                {done.map((o) => (
                  <HabitCard key={o.habitId} item={o} />
                ))}
              </div>
            </>
          )}
          {all && (
            <p className="all-summary">
              {stats.tiny
                ? t("All checked in, in your own way. Tiny actions count, too.")
                : t("Every full target completed. Take this feeling with you.")}
            </p>
          )}
          <button className="add-habit" onClick={addHabit}>
            <CirclePlus size={19} /> {t(" Add a habit ")}</button>
          <button className="journey-peek" onClick={() => setTab("journey")}>
            <span className="peek-icon">
              <Sprout size={22} />
            </span>
            <span>
              <strong>
                {next
                  ? t("{0} XP to {1}", undefined, [next.xp - xp, next.name])
                  : t("Look how far you’ve come")}
              </strong>
              <small>{t("Your Momentum Trail")}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </>
      ) : (
        <>
          <EmptyState
            title={
              active
                ? t("A little room to breathe.")
                : t("Start with one small thing.")
            }
            text={
              active
                ? t("Nothing is scheduled today. Rest days keep your planned-day streak as it is.")
                : t("Choose a habit that fits your life. You can always make it smaller.")
            }
            mood={active ? "rest" : "welcome"}
          >
            <Button
              onClick={active ? () => open({ type: "manage" }) : addHabit}
            >
              {active ? t("View your habits") : t("Add your first habit")}
              <ArrowRight size={18} />
            </Button>
          </EmptyState>
          <div className="quiet-note">
            <Sprout size={20} />
            {active
              ? t("Your progress is still here.")
              : t("One habit is a whole beginning.")}
          </div>
        </>
      )}
      <p className="screen-footer">{t("Small actions. A stronger you.")}</p>
    </div>
  );
}
