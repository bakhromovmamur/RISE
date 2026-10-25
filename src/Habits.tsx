import {habitText} from "./habitText";
import { useLifeDraft, useText } from "./LifeUI";
import { useEffect, useState, type SetStateAction } from "react";
import {
  Archive,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Info,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sprout,
  TimerReset,
} from "lucide-react";
import { useApp } from "./context";
import {
  addDays,
  DAY_NAMES,
  draftOf,
  emptyDraft,
  formatDate,
  targetLabel,
  timerElapsed,
  today,
  validateDraft,
  versionAt,
  type HabitDraft,
  type IconName,
} from "./model";
import {
  Button,
  CheckMark,
  GroupRow,
  HabitIcon,
  Pip,
  SectionTitle,
  WeekdaySelector,
} from "./components";
export function HabitDetail({ id }: { id: string }) {
  const t = useText();
  const { state, open, log } = useApp();
  const h = state.habits.find((h) => h.id === id);
  if (!h) return <p>{t("This habit is no longer available.")}</p>;
  const date = today(state),
    v = versionAt(h, date),
    o = state.days[date]?.find((o) => o.habitId === id);
  const pending = h.versions.find((v) => v.effective > date);
  const data = o ?? { ...h, ...v };
  return (
    <div className="detail-body">
      <div className="detail-identity">
        <HabitIcon name={h.icon} />
        <h1>{h.name}</h1>
        <p>
          {t(h.area)} ·{" "}
          {h.type === "duration"
            ? t("A little time for you")
            : h.type === "check"
              ? t("A simple check-in")
              : t("One small commitment")}
        </p>
      </div>
      <div className="target-display">
        <span>{t("Your full target")}</span>
        <strong>{t.target(data)}</strong>
        {data.tiny !== null && (
          <p>
            <Sprout size={16} /> {t(" Tiny version: ")}{t.target(data, data.tiny)}
          </p>
        )}
      </div>
      {o?.check ? (
        <div className="detail-completed">
          <CheckMark tiny={o.check === "tiny"} />
          <div>
            <h3>
              {o.check === "full"
                ? t("Full target completed.")
                : t("Tiny version completed.")}
            </h3>
            <p>
              {o.check === "full"
                ? t("+20 XP for this scheduled date")
                : t("+10 XP for a smaller action")}
            </p>
          </div>
        </div>
      ) : !o ? (
        <p className="notice">
          {h.archivedAt
            ? t("This habit is archived. Your history is still here.")
            : t("Not scheduled today. No check-in is expected.")}
        </p>
      ) : null}
      {o && !o.check && (
        <div className="action-stack">
          <Button onClick={() => log(id, "full")}>
            <Check size={18} />
            {t("Full target completed ")}<span>{t("+20 XP")}</span>
          </Button>
          {o.tiny !== null && (
            <Button variant="secondary" onClick={() => log(id, "tiny")}>
              <Sprout size={18} />
              {t("Tiny version completed ")}<span>{t("+10 XP")}</span>
            </Button>
          )}
        </div>
      )}
      {o?.check === "tiny" && (
        <Button className="wide" onClick={() => log(id, "full")}>
          {t("Upgrade to full target ")}<span>{t("+10 XP")}</span>
        </Button>
      )}
      {o?.check && (
        <Button variant="ghost" className="wide" onClick={() => log(id, null)}>
          <RotateCcw size={16} />
          {t("Undo check-in ")}</Button>
      )}
      {h.type === "duration" && o && !o.check && (
        <Button
          className="wide timer-entry"
          variant="secondary"
          onClick={() => open({ type: "timer", id })}
        >
          <Clock3 size={18} />
          {t("Open focus timer ")}<ChevronRight size={16} />
        </Button>
      )}
      <SectionTitle title={t("Make it fit your life")} />
      <div className="group">
        <GroupRow title={t("Your cue")} detail={v.cue || t("No cue set")} />
        <GroupRow
          title={t("Planned days")}
          detail={
            v.days.length === 7
              ? t("Every day")
              : v.days.map((d) => t.weekday(d, false).slice(0, 3)).join(" · ")
          }
        />
        {h.reason && <GroupRow title={t("Your why")} detail={h.reason} />}
        {state.goals.filter((g) => g.status !== "archived" && g.habitIds.includes(id)).map((g) => <GroupRow key={g.id} title={g.title} detail={t("This habit supports your goal")} onClick={() => open({ type: "goal", id: g.id })} />)}
        <GroupRow
          title={t("Reminder preference")}
          detail={
            v.reminder ? (state.mode==="demo"?t("{0} · preview only", undefined, [v.reminder]):`${v.reminder} · ${habitText(state.life.language)("time")}`) : t("No reminder set")
          }
        />
      </div>
      {pending && (
        <p className="notice">
          {t("Your updated targets and schedule start")}{" "}
          {t.date(pending.effective)}{t(". Today keeps its original plan. ")}</p>
      )}
      <SectionTitle title={t("Recent check-ins")} />
      <div className="recent-history">
        {Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map((d) => {
          const item = state.days[d]?.find((o) => o.habitId === id);
          return (
            <button
              key={d}
              onClick={() => open({ type: "history", date: d })}
              aria-label={`${t.date(d)}: ${(item?.check ? t(item.check) : undefined) ?? (item ? t("not checked in") : t("not scheduled"))}`}
            >
              <span>{t.date(d, { weekday: "short" }).slice(0, 1)}</span>
              {item?.check ? (
                <CheckMark tiny={item.check === "tiny"} />
              ) : (
                <i className={item ? "empty-check" : "unscheduled"}>
                  {item ? "" : "–"}
                </i>
              )}
              <small>{Number(d.slice(-2))}</small>
            </button>
          );
        })}
      </div>
      <p className="fine-print">
        {t("A sprout means tiny; a check means full; a dash means unscheduled. ")}</p>
      {!h.archivedAt && (
        <>
          <Button
            variant="secondary"
            className="wide"
            onClick={() => open({ type: "edit", id })}
          >
            {t("Edit habit ")}</Button>
          <Button
            variant="ghost"
            className="wide"
            onClick={() => open({ type: "archive", id })}
          >
            <Archive size={17} />
            {t("Archive habit ")}</Button>
        </>
      )}
    </div>
  );
}
export function HabitForm({ id }: { id?: string }) {
  const t = useText();
  const { state, dispatch, storage, open, back, toast } = useApp();
  const existing = state.habits.find((h) => h.id === id);
  const [fallback, setFallback] = useState<HabitDraft>(() =>
    existing ? draftOf(existing, today(state)) : (state.draft ?? emptyDraft()),
  );
  const [editDraft, setEditDraft] = useLifeDraft(`habit:${id ?? "new"}`, () => fallback);
  const draft = id ? editDraft : (state.draft ?? fallback);
  const [error, setError] = useState("");
  const [more, setMore] = useState(
    !!existing || !!draft.cue || !!draft.reason || !!draft.reminder,
  );
  const setDraft = (action: SetStateAction<HabitDraft>) => {
    if (id) { setEditDraft(action); return; }
    const current = storage.getSnapshot().state.draft ?? fallback;
    const next = typeof action === "function" ? action(current) : action;
    setFallback(next); dispatch({ kind: "habit.draft", draft: next });
  };
  const set = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) => setDraft(d => ({ ...d, [key]: value }));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      if (!dispatch({ kind: "habit.save", draft, newId: crypto.randomUUID() })) return;
      toast(
        existing
          ? t("Habit saved. Targets and schedule change tomorrow.")
          : t("Your small step is ready."),
      );
      back();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form noValidate className="habit-form" onSubmit={submit}>
      <div className="form-intro">
        <h1>{existing ? t("Make it yours.") : t("One small beginning.")}</h1>
        <p>
          {existing
            ? t("Your plan can change as your life does.")
            : t("Choose something small enough for a busy day.")}
        </p>
      </div>
      <label className="field">
        {t("Habit name ")}<input
          autoComplete="off"
          maxLength={70}
          placeholder={t("e.g. Read a little")}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <fieldset className="icon-field">
        <legend>{t("Choose an icon")}</legend>
        <div className="icon-options">
          {(
            ["book", "walk", "learn", "reflect", "focus", "leaf"] as IconName[]
          ).map((icon) => (
            <button
              type="button"
              key={icon}
              aria-label={t("{0} icon", undefined, [t(icon)])}
              aria-pressed={draft.icon === icon}
              className={draft.icon === icon ? "selected" : ""}
              onClick={() => set("icon", icon)}
            >
              <HabitIcon name={icon} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <label className="field">
          {t("Focus area ")}<select
            value={draft.area}
            onChange={(e) => set("area", e.target.value)}
          >
            {[
              "Personal",
              "Reading",
              "Learning",
              "Movement",
              "Focus",
              "Reflection",
            ].map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("Habit type ")}<select
            disabled={!!existing}
            value={draft.type}
            onChange={(e) => {
              const type = e.target.value as HabitDraft["type"];
              setDraft((d) => ({
                ...d,
                type,
                unit:
                  type === "duration"
                    ? "minutes"
                    : type === "check"
                      ? "check-in"
                      : "times",
                full: type === "check" ? 1 : d.full,
                tiny: type === "check" ? null : d.tiny,
              }));
            }}
          >
            <option value="count">{t("Count")}</option>
            <option value="duration">{t("Duration")}</option>
            <option value="check">{t("Simple check-in")}</option>
          </select>
        </label>
      </div>
      {existing && (
        <p className="fine-print">
          {t("Measurement type and unit stay fixed. Create a new habit to use a different measurement. ")}</p>
      )}
      <div className="form-grid">
        <label className="field">
          {t("Full target ")}<input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            disabled={draft.type === "check"}
            value={Number.isNaN(draft.full) ? "" : draft.full}
            onChange={(e) =>
              set("full", e.target.value === "" ? NaN : Number(e.target.value))
            }
          />
        </label>
        <label className="field">
          {t("Unit ")}<input
            maxLength={24}
            disabled={!!existing || draft.type !== "count"}
            value={t.unit(draft.unit)}
            onChange={(e) => set("unit", t.unitKey(e.target.value))}
          />
        </label>
      </div>
      <div className="tiny-field">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.tiny !== null}
            onChange={(e) => set("tiny", e.target.checked ? 1 : null)}
          />
          <span>
            <strong>{t("Give yourself a tiny version")}</strong>
            <small>{t("For days when a little is enough.")}</small>
          </span>
          <Sprout size={21} />
        </label>
        {draft.tiny !== null && (
          <label className="field">
            {t("Tiny target (")}{t.unit(draft.unit)})
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={Number.isNaN(draft.tiny) ? "" : draft.tiny}
              onChange={(e) =>
                set(
                  "tiny",
                  e.target.value === "" ? NaN : Number(e.target.value),
                )
              }
            />
          </label>
        )}
      </div>
      <fieldset>
        <legend>{t("Planned days")}</legend>
        <WeekdaySelector
          days={draft.days}
          onChange={(days) => set("days", days)}
        />
      </fieldset>
      <button
        className="form-disclosure"
        type="button"
        aria-expanded={more}
        onClick={() => setMore(!more)}
      >
        {t("Cue, personal reason & reminder")}{" "}
        <Plus size={17} className={more ? "rotate" : ""} />
      </button>
      {more && (
        <div className="extra-fields">
          <label className="field">
            {t("Your cue ")}<span>{t("optional")}</span>
            <input
              maxLength={100}
              placeholder={t("After breakfast")}
              value={draft.cue}
              onChange={(e) => set("cue", e.target.value)}
            />
          </label>
          <label className="field">
            {t("Your personal reason ")}<span>{t("optional")}</span>
            <textarea
              maxLength={240}
              rows={2}
              placeholder={t("What would this make room for?")}
              value={draft.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
          </label>
          <label className="field">
            {t("Reminder preference ")}<span>{t("optional")}</span>
            <input
              type="time"
              value={draft.reminder}
              onChange={(e) => set("reminder", e.target.value)}
            />
          </label>
          {draft.reminder && (
            <button
              type="button"
              className="text-button"
              onClick={() => set("reminder", "")}
            >
              {t("Remove reminder ")}</button>
          )}
          <p className="fine-print">
            {state.mode==="demo"?t("Saved locally. This browser prototype previews reminders; it doesn’t schedule device notifications. "):habitText(state.life.language)("help")}</p>
        </div>
      )}
      {existing && (
        <p className="notice">
          <Info size={16} />
          {t("Targets, schedule, cue and reminder changes start")}{" "}
          {t.date(addDays(today(state), 1))}{t(". Name and icon update now. ")}</p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="form-save">
        <Button type="submit" className="wide">
          {existing ? t("Save changes") : t("Add habit")}
          <ArrowRight size={18} />
        </Button>
        <Button type="button" variant="ghost" className="wide" onClick={back}>
          {t("Cancel ")}</Button>
      </div>
    </form>
  );
}
export function ManageHabits() {
  const t = useText();
  const { state, open } = useApp();
  const active = state.habits.filter((h) => !h.archivedAt),
    archived = state.habits.filter((h) => h.archivedAt);
  return (
    <>
      <div className="form-intro">
        <h1>{t("A plan that fits.")}</h1>
        <p>
          {active.length}
          {t(" active habits. Choose up to three daily priorities; keep as many habits as you need.")}
        </p>
      </div>
      <div className="group">
        {active.map((h) => (
          <GroupRow
            key={h.id}
            icon={<HabitIcon name={h.icon} small />}
            title={h.name}
            detail={t.target({ ...h, ...versionAt(h, today(state)) })}
            onClick={() => open({ type: "detail", id: h.id })}
          />
        ))}
      </div>
      <Button
        className="wide"
        variant="secondary"
        onClick={() => open({ type: "edit" })}
      >
        <Plus size={18} />
        {t("Add a habit ")}</Button>
      {archived.length > 0 && (
        <>
          <SectionTitle title={t("Archived")} />
          <p className="section-description">
            {t("Your past effort stays part of your story. ")}</p>
          <div className="group">
            {archived.map((h) => (
              <GroupRow
                key={h.id}
                icon={<HabitIcon name={h.icon} small />}
                title={h.name}
                detail={t("Archived {0}", undefined, [t.date(h.archivedAt!)])}
                onClick={() => open({ type: "detail", id: h.id })}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function ArchiveConfirm({ id }: { id: string }) {
  const t = useText();
  const { state, dispatch, close, back, toast } = useApp();
  const h = state.habits.find((h) => h.id === id)!;
  const o = state.days[today(state)]?.find((o) => o.habitId === id);
  return (
    <div className="confirmation">
      <span className="confirmation-icon">
        <Archive size={28} />
      </span>
      <h1>{t("Make a little room?")}</h1>
      <p>{t("Archive “")}{h.name}{t("” and free an active-habit slot.")}</p>
      <div className="notice">
        {o && !o.check
          ? t("Today’s plan will change from {0} to {1} habits. This unchecked action will be removed.", undefined, [state.days[today(state)].length, state.days[today(state)].length - 1])
          : o?.check
            ? t("Today’s logged action and Today’s count will stay.")
            : t("Today’s plan count will stay the same.")}{" "}
        {t("Past plans, check-ins and XP stay in your history. No future actions will be scheduled. ")}</div>
      <Button
        variant="primary"
        className="wide"
        onClick={() => {
          if (!dispatch({ kind: "habit.archive", habitId: id })) return;
          close();
          toast("Habit archived. Your past effort is still here.");
        }}
      >
        {t("Archive habit ")}</Button>
      <Button variant="ghost" className="wide" onClick={back}>
        {t("Keep habit ")}</Button>
    </div>
  );
}
export function FocusTimer({ id }: { id: string }) {
  const t = useText();
  const { state, dispatch, log, back, open } = useApp();
  const h = state.habits.find((h) => h.id === id)!;
  const o = state.days[today(state)]?.find((o) => o.habitId === id);
  const [clock, setClock] = useState(Date.now());
  const other = state.timer && state.timer.habitId !== id;
  const timer = state.timer?.habitId === id ? state.timer : null;
  const duration =
    timer?.duration ?? (o?.full ?? versionAt(h, today(state)).full) * 60;
  const elapsed = timer ? timerElapsed(timer, clock) : 0,
    remain = Math.max(0, Math.ceil(duration - elapsed)),
    finished = remain === 0;
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  function toggle() {
    dispatch({ kind: !timer ? "timer.start" : timer.startedAt === null ? "timer.resume" : "timer.pause", habitId: id });
  }
  return (
    <div className="focus-timer">
      <div className="focus-habit">
        <HabitIcon name={h.icon} />
        <h2>{h.name}</h2>
      </div>
      <Pip mood={finished ? "celebrate" : "focus"} size={214} />
      <div
        className="timer-display"
        role="timer"
        aria-label={t("{0} minutes {1} seconds remaining", undefined, [Math.floor(remain / 60), remain % 60])}
      >
        {String(Math.floor(remain / 60)).padStart(2, "0")}
        <span>:</span>
        {String(remain % 60).padStart(2, "0")}
      </div>
      <p>
        {finished
          ? t("A little time, well given.")
          : timer?.startedAt
            ? t("One moment at a time.")
            : timer
              ? t("Take a breath. Resume when you’re ready.")
              : t("Make a little space for yourself.")}
      </p>
      {other ? (
        <div className="notice">
          {t("Another timer is in progress. ")}<Button
            variant="secondary"
            onClick={() => open({ type: "timer", id: state.timer!.habitId })}
          >
            {t("Return to that timer ")}</Button>
        </div>
      ) : finished ? (
        <>
          <Button
            className="wide"
            disabled={!o || timer?.date !== today(state)}
            onClick={() => {
              log(id, "full", true);
              back();
            }}
          >
            {t("Confirm full target completed ")}</Button>
          <p className="fine-print">
            {timer?.date !== today(state)
              ? t("This session began on a different date. Return to Today to log today’s action.")
              : t("Only confirm if you completed your real-world action. Timer time alone does not earn XP.")}
          </p>
        </>
      ) : (
        <Button className="wide" onClick={toggle}>
          {timer?.startedAt ? <Pause size={20} /> : <Play size={20} />}{" "}
          {timer?.startedAt
            ? t("Pause")
            : timer
              ? t("Resume")
              : t("Start focus session")}
        </Button>
      )}
      <Button variant="ghost" className="wide" onClick={back}>
        {!finished && timer?.startedAt
          ? t("Leave timer running in background")
          : t("Back to habit")}
      </Button>
      {timer && (
        <Button
          variant="ghost"
          className="wide muted"
          onClick={() => {
            dispatch({ kind: "timer.end", habitId: id });
            back();
          }}
        >
          <TimerReset size={17} />
          {t("End session without check-in ")}</Button>
      )}
    </div>
  );
}
