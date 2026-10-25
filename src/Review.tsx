import { useLifeDraft, useText } from "./LifeUI";
import { Check, Flame, Sprout, Trophy } from "lucide-react";
import { useApp } from "./context";
import {
  DAY_NAMES,
  formatDate,
  streaks,
  targetLabel,
  today,
  scheduled,
  occurrence,
  type State,
} from "./model";
import {
  Button,
  CheckMark,
  GroupRow,
  HabitIcon,
  Pip,
  SectionTitle,
} from "./components";
export function Reflection({ date }: { date: string }) {
  const t = useText();
  const { state, dispatch, back, open, toast } = useApp();
  const [draft, setDraft] = useLifeDraft(`reflection:${date}`, () => state.reflections[date] ?? { manageable: "", smaller: "" });
  const { manageable, smaller } = draft;
  const setManageable = (manageable: string) => setDraft({ ...draft, manageable });
  const setSmaller = (smaller: string) => setDraft({ ...draft, smaller });
  return (
    <div className="reflection">
      <Pip mood="rest" size={118} />
      <h1>
        {t("Pause. Notice. ")}<br />
        {t("Make a little room. ")}</h1>
      <p>
        {t("A few words for the week of ")}{t.date(date)}{t(". No right answers. No XP required. ")}</p>
      <label className="field">
        {t("What felt manageable? ")}<textarea
          rows={3}
          maxLength={1500}
          placeholder={t("The short walk after lunch…")}
          value={manageable}
          onChange={(e) => setManageable(e.target.value)}
        />
      </label>
      <div className="reflection-chips">
        {[t("Starting tiny"), t("A familiar cue"), t("Keeping it flexible")].map((t) => (
          <button
            key={t}
            aria-pressed={manageable === t}
            onClick={() => setManageable(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="field">
        {t("What would you like to make smaller next week? ")}<textarea
          rows={3}
          maxLength={1500}
          placeholder={t("Maybe fewer pages on a busy day…")}
          value={smaller}
          onChange={(e) => setSmaller(e.target.value)}
        />
      </label>
      <SectionTitle title={t("Adjust a habit")} />
      <div className="group">
        {state.habits
          .filter((h) => !h.archivedAt)
          .map((h) => (
            <GroupRow
              key={h.id}
              icon={<HabitIcon name={h.icon} small />}
              title={h.name}
              onClick={() => open({ type: "edit", id: h.id })}
            />
          ))}
      </div>
      <Button
        className="wide"
        onClick={() => {
          if (!dispatch({ kind: "reflection.save", date, reflection: { manageable, smaller } })) return;
          toast("Reflection saved. A little understanding goes a long way.");
          back();
        }}
      >
        {t("Save reflection ")}</Button>
      <Button variant="ghost" className="wide" onClick={back}>
        {t("Skip for now ")}</Button>
    </div>
  );
}
export function History({ date }: { date: string }) {
  const t = useText();
  const { state, open } = useApp();
  const future = date > today(state);
  const rows =
    state.days[date] ??
    (future
      ? state.habits
          .filter((h) => scheduled(h, date))
          .map((h) => occurrence(h, date))
      : []);
  return (
    <div className="history-detail">
      <h1>{t.date(date, { weekday: "long" })}</h1>
      <p>
        {t.date(date, { month: "long", day: "numeric", year: "numeric" })}
      </p>
      {rows.length ? (
        <div className="group">
          {rows.map((o) => (
            <GroupRow
              key={o.habitId}
              icon={<HabitIcon name={o.icon} small />}
              title={o.name}
              onClick={future ? undefined : () => open({ type: "habitCorrection", id: o.habitId, date })}
              detail={`${t.target(o)} · ${o.check === "full" ? t("Full target completed") : o.check === "tiny" ? t("Tiny version completed ({0})", undefined, [t.target(o, o.tiny)]) : future ? t("Upcoming") : t("No check-in")}`}
              end={
                o.check ? (
                  <CheckMark tiny={o.check === "tiny"} />
                ) : (
                  <span className="history-empty">—</span>
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty-history">
          <Pip mood="rest" size={150} />
          <h2>
            {future ? t("This day is still ahead.") : t("No scheduled actions.")}
          </h2>
          <p>
            {future
              ? t("Your plan will appear on Today when the day arrives.")
              : t("An unscheduled date never counts as a missed day.")}
          </p>
        </div>
      )}
      <p className="notice">
        {t("History keeps each date’s original targets and planned actions, even if a habit changes or is archived. Open a past action to correct its check-in. ")}</p>
    </div>
  );
}
export function StreakInfo() {
  const t = useText();
  const { state, back } = useApp();
  const s = streaks(state);
  return (
    <div className="streak-explanation">
      <span className="streak-hero">
        <Flame size={35} />
        {s.current}
      </span>
      <h1>
        {t("Planned days ")}<br />
        {t("in a row. ")}</h1>
      <p>{t("Your streak celebrates showing up, not doing everything.")}</p>
      <div className="group">
        <GroupRow
          icon={<Check size={20} />}
          title={t("One step is enough")}
          detail={t("At least one full or tiny scheduled check-in makes a planned date qualify.")}
        />
        <GroupRow
          icon={<Sprout size={20} />}
          title={t("Rest days leave it as it is")}
          detail={t("A day with no scheduled habits preserves your streak without adding a day.")}
        />
        <GroupRow
          icon={<Trophy size={20} />}
          title={t("Your effort stays with you")}
          detail={t("Your longest streak is {0} planned days. A missed planned date starts a fresh streak, but keeps your XP, history and earned rewards.", undefined, [s.longest])}
        />
      </div>
      <p className="fine-print">
        {t("Today’s unfinished plan does not break the streak before the day ends. The daily summary separately counts how much of your plan you checked in. Daily boundaries use ")}{state.timezone}.
      </p>
      <Button className="wide" onClick={back}>
        {t("Got it ")}</Button>
    </div>
  );
}
