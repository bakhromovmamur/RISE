import { useLifeDraft, useText } from "./LifeUI";
import { useState, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Leaf,
  Sprout,
} from "lucide-react";
import { useApp } from "./context";
import {
  suggestions,
  validateDraft,
  type HabitDraft,
} from "./model";
import {
  Button,
  HabitIcon,
  IconButton,
  Pip,
  Toggle,
  WeekdaySelector,
} from "./components";
export function Onboarding() {
  const t = useText();
  const { dispatch, toast, open } = useApp();
  const [draft, setDraft] = useLifeDraft("onboarding", () => ({ step: 0, areas: ["Reading"], selected: [0],
    habits: structuredClone(suggestions).map(d => ({ ...d, name: t(d.name), reason: t(d.reason), cue: t(d.cue) })), reminders: false, name: "" }));
  const { step, areas, selected, habits, reminders, name } = draft;
  const [error, setError] = useState("");
  const field = <K extends keyof typeof draft>(key: K, action: SetStateAction<typeof draft[K]>) =>
    setDraft(previous => ({ ...previous, [key]: typeof action === "function" ? (action as (value: typeof draft[K]) => typeof draft[K])(previous[key]) : action }));
  const setStep = (value: SetStateAction<number>) => field("step", value);
  const setAreas = (value: SetStateAction<string[]>) => field("areas", value);
  const setSelected = (value: SetStateAction<number[]>) => field("selected", value);
  const setHabits = (value: SetStateAction<HabitDraft[]>) => field("habits", value);
  const setReminders = (value: boolean) => field("reminders", value);
  const setName = (value: string) => field("name", value);
  function toggleArea(area: string) {
    setAreas((a) =>
      a.includes(area)
        ? a.filter((v) => v !== area)
        : a.length < 3
          ? [...a, area]
          : a,
    );
  }
  function toggleHabit(index: number) {
    setSelected((a) =>
      a.includes(index)
        ? a.filter((v) => v !== index)
        : a.length < 3
          ? [...a, index]
          : a,
    );
  }
  function update(index: number, update: Partial<HabitDraft>) {
    setHabits((h) => h.map((d, i) => (i === index ? { ...d, ...update } : d)));
  }
  function next() {
    setError("");
    if (step === 2) {
      for (const i of selected) {
        const e = validateDraft(habits[i]);
        if (e) {
          setError(e);
          return;
        }
      }
    }
    setDraft(previous => ({ ...previous, step: step + 1, ...(step === 1 ? { selected: habits.map((h, i) => areas.includes(h.area) ? i : -1).filter(i => i >= 0).slice(0, 3) } : {}) }));
  }
  function create() {
    try {
      if (!dispatch({ kind: "onboarding.finish", name: name.trim() || t("Friend"), reminders,
        habits: selected.map(i => ({ draft: habits[i], newId: crypto.randomUUID() })) })) return;
      toast(t("Your plan is ready. One small step at a time."));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (step === 0)
    return (
      <div className="welcome-screen">
        <div className="welcome-brand">
          <Sprout size={23} />
          rise
        </div>
        <div className="welcome-art">
          <div className="welcome-circle" />
          <Pip size={298} />
          <span className="welcome-note">
            <Leaf size={14} /> {t(" Meet Pip. Your little companion. ")}</span>
        </div>
        <div className="welcome-copy">
          <h1>
            {t("Five anchors. ")}<br />{t("Room to grow. ")}</h1>
          <p>
            {t("Build your day around salah. ")}<br />
            {t("Make space for your other habits in between. ")}</p>
        </div>
        <div className="welcome-bottom">
          <Button className="wide" onClick={() => {
            dispatch({ kind: "onboarding.skip" });
            open({ type: "timetable" });
          }}>
            {t("Start with salah ")}<ArrowRight size={18} />
          </Button>
          <Button className="wide" variant="ghost" onClick={() => setStep(1)}>{t("Choose other habits first")}</Button>
        </div>
      </div>
    );
  return (
    <div className="onboarding-screen">
      <header className="onboarding-header">
        <IconButton label={t("Back")} onClick={() => setStep(step - 1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <div className="onboarding-steps" aria-label={t("Step {0} of 3", undefined, [step])}>
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= step ? "active" : ""} />
          ))}
        </div>
        <span>{step} {t(" of 3")}</span>
      </header>
      <div className="onboarding-content">
        {step === 1 && (
          <>
            <h1>
              {t("What would you ")}<br />
              {t("like to make room for? ")}</h1>
            <p>{t("Choose one to three areas. There’s no right way to grow.")}</p>
            <div className="focus-options">
              {suggestions.map((d) => (
                <button
                  className={areas.includes(d.area) ? "selected" : ""}
                  key={d.area}
                  aria-pressed={areas.includes(d.area)}
                  onClick={() => toggleArea(d.area)}
                >
                  <HabitIcon name={d.icon} />
                  <span>
                    <strong>{t(d.area)}</strong>
                    <small>
                      {d.area === "Reading"
                        ? t("A few pages, a fresh perspective")
                        : d.area === "Movement"
                          ? t("A little energy for your day")
                          : d.area === "Learning"
                            ? t("Keep your curiosity company")
                            : d.area === "Focus"
                              ? t("Make space for one thing")
                              : t("A moment to check in with yourself")}
                    </small>
                  </span>
                  <span className="selection-circle">
                    {areas.includes(d.area) && <Check size={15} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="onboarding-tip">
              <Pip size={79} />
              <p>{t("Small is a perfectly good place to start.")}</p>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1>
              {t("Make your ")}<br />
              {t("first steps small. ")}</h1>
            <p>
              {t("Pick one to three habits. These targets are just a starting point. ")}</p>
            <div className="suggested-habits">
              {habits.map(
                (d, i) =>
                  areas.includes(d.area) && (
                    <div
                      className={`suggested-habit ${selected.includes(i) ? "selected" : ""}`}
                      key={d.name}
                    >
                      <button
                        className="suggestion-heading"
                        aria-pressed={selected.includes(i)}
                        onClick={() => toggleHabit(i)}
                      >
                        <HabitIcon name={d.icon} />
                        <strong>{d.name}</strong>
                        <span className="selection-circle">
                          {selected.includes(i) && <Check size={15} />}
                        </span>
                      </button>
                      {selected.includes(i) && (
                        <div className="suggestion-targets">
                          <label>
                            {t("Full target ")}<input
                              aria-label={t("{0} full target", undefined, [d.name])}
                              type="number"
                              min="1"
                              value={d.full}
                              onChange={(e) =>
                                update(i, { full: Number(e.target.value) })
                              }
                            />
                            <span>{t.unit(d.unit)}</span>
                          </label>
                          <label>
                            {t("Tiny version ")}<input
                              aria-label={t("{0} tiny target", undefined, [d.name])}
                              type="number"
                              min="1"
                              value={d.tiny ?? 1}
                              onChange={(e) =>
                                update(i, { tiny: Number(e.target.value) })
                              }
                            />
                            <span>{t.unit(d.unit)}</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ),
              )}
            </div>
            <p className="notice">
              <Sprout size={18} />{t("A tiny version is a smaller action for a busy day. It counts as showing up. ")}</p>
          </>
        )}
        {step === 3 && (
          <>
            <h1>
              {t("A plan that fits ")}<br />
              {t("your real life. ")}</h1>
            <p>{t("Choose your days. You can make changes whenever you need.")}</p>
            <label className="field">
              {t("What should Pip call you? ")}<span>{t("optional")}</span>
              <input
                autoComplete="given-name"
                maxLength={30}
                placeholder={t("Your first name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {selected.map((i) => (
              <div className="schedule-choice" key={i}>
                <div>
                  <HabitIcon name={habits[i].icon} small />
                  <h3>{habits[i].name}</h3>
                </div>
                <WeekdaySelector
                  days={habits[i].days}
                  onChange={(days) => update(i, { days })}
                />
              </div>
            ))}
            <div className="onboarding-reminder">
              <BellIcon />
              <span>
                <strong>{t("A gentle reminder?")}</strong>
                <small>{t("Optional · preview only")}</small>
              </span>
              <Toggle
                label={t("Enable reminder preview")}
                checked={reminders}
                onChange={() => setReminders(!reminders)}
              />
            </div>
            {reminders && (
              <p className="fine-print">
                {t("This saves a reminder preference only. Enable device delivery separately in Settings when you are ready.")}</p>
            )}
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {t(error)}
          </p>
        )}
      </div>
      <footer className="onboarding-footer">
        <Button
          className="wide"
          disabled={step === 1 ? !areas.length : !selected.length}
          onClick={step === 3 ? create : next}
        >
          {step === 3 ? t("Create my plan") : t("Continue")}
          <ArrowRight size={18} />
        </Button>
        <p>
          {step === 3
            ? t("A small commitment. A little possibility.")
            : t("{0} of 3 selected", undefined, [step === 1 ? areas.length : selected.length])}
        </p>
      </footer>
    </div>
  );
}
function BellIcon() {
  return (
    <span className="reminder-icon">
      <Heart size={22} />
    </span>
  );
}
