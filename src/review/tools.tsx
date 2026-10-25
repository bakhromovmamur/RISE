import { useState } from "react";
import { ArrowRight, Download, FlaskConical, Palette, RotateCcw } from "lucide-react";
import { useText } from "../LifeUI";
import { addDays, ensureDays, today, xpTotal, streaks, type State } from "../model";
import { balancedFixture, localizeFixture, demoCheckpoints, difficultDayFixture, fullDayFixture } from "../demo";
import { clockText, ensurePrayerDays, prayerMoment, prayerScene } from "../prayerModel";
import { addLifeDemo } from "../lifeModel";
import { exportData } from "../Personal";
import { DesignSystem } from "../DesignSystem";
import { makeFixture } from "./fixtures";
import type { ReviewSupport } from "./types";
import type { Language } from "../i18n";
export { assertReviewOrigin } from "./origin";
function createFixture(kind: string, language: Language): State {
  const lifeScenes = ["daily-life", "family-planning", "squad-reflection", "prayer-pause", "needs-attention", "fajr-morning"];
  const balancedScenes = ["balanced", "busy", "prayer-due", "completed-priority", "earned-reward", "prepare", "morning", "evening", "prayer-complete", "gap", "empty"];
  let s = kind === "difficult-day" ? difficultDayFixture() : kind === "full-day" ? fullDayFixture() : lifeScenes.includes(kind) ? addLifeDemo(balancedFixture(), kind) : balancedScenes.includes(kind) ? balancedFixture(kind) : makeFixture(
    kind === "empty" ? "fresh" : ["prepare", "morning", "evening", "prayer-complete", "gap"].includes(kind) ? "demo" : (kind as Parameters<typeof makeFixture>[0]),
  );
  s = prayerScene(s, kind);
  if (kind === "empty") s.onboarded = true;
  return localizeFixture(s, language);
}

export const reviewTools: ReviewSupport = { initialState: () => addLifeDemo(balancedFixture()), createFixture, Controls: Reviewer, Design: DesignSystem };

function Reviewer({
  state,
  reset,
  setState,
}: {
  state: State;
  reset: (s: string) => void;
  setState: React.Dispatch<React.SetStateAction<State>>;
}) {
  const t = useText();
  const [fixture, setFixture] = useState("daily-life");
  const checkpoints = state.mode === "demo" ? demoCheckpoints(state) : [];
  return (
    <section className="reviewer">
      <div className="reviewer-heading">
        <FlaskConical size={15} />
        <h3>{t("Review the prototype")}</h3>
      </div>
      <label>
        {t("Starting point ")}<select
          value={fixture}
          onChange={(e) => setFixture(e.target.value)}
          aria-label={t("Demo fixture")}
        >
          <option value="daily-life">{t("Daily life · prayer, habits & family")}</option>
          <option value="full-day">{t("Full day · Fajr to bedtime")}</option>
          <option value="difficult-day">{t("Difficult day · one small step")}</option>
          <option value="family-planning">{t("Family planning · tasks & lists")}</option>
          <option value="squad-reflection">{t("Squad reflection · share your week")}</option>
          <option value="fajr-morning">{t("Fajr morning · alarm simulation")}</option>
          <option value="prayer-pause">{t("Prayer pause · private space")}</option>
          <option value="needs-attention">{t("Needs attention · device preview")}</option>
          <option value="balanced">{t("Balanced day · goals & habits")}</option>
          <option value="busy">{t("Busy day · 12 habits")}</option>
          <option value="prayer-due">{t("Prayer due · Asr pause")}</option>
          <option value="completed-priority">{t("Three priorities complete")}</option>
          <option value="earned-reward">{t("A personal reward earned")}</option>
          <option value="prepare">{t("Ten minutes before Asr")}</option>
          <option value="morning">{t("Fajr · wake-up")}</option>
          <option value="evening">{t("Evening · prepare for Fajr")}</option>
          <option value="prayer-complete">{t("All five on time")}</option>
          <option value="gap">{t("An unconfirmed Fajr")}</option>
          <option value="fresh">{t("Fresh Start · onboarding")}</option>
          <option value="return">{t("Returning after a missed day")}</option>
          <option value="complete">{t("All checked in · mixed")}</option>
          <option value="rest">{t("Planned rest day")}</option>
          <option value="empty">{t("Empty · set up your day")}</option>
        </select>
      </label>
      <button className="review-load" onClick={() => reset(fixture)}>
        <RotateCcw size={14} />
        {t("Load selected fixture ")}</button>
      <small>{t("Replaces this browser’s saved prototype data.")}</small>
      <div className="review-divider" />
      <div className="review-current">
        <span>
          {state.mode === "demo"
            ? t("Frozen demo calendar")
            : t("Real device calendar")}
        </span>
        <strong>
          {t.date(today(state), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </strong>
        <span>{state.timezone}</span>
        <strong>{clockText(prayerMoment(state).minute)}</strong>
        {checkpoints.length > 0 && <label>{t("Day checkpoint ")}<select aria-label={t("Day checkpoint")} value={checkpoints.some((point) => point.time === clockText(state.prayers.demoMinute)) ? clockText(state.prayers.demoMinute) : ""}
            onChange={(e) => { if (e.target.value) { const [h, m] = e.target.value.split(":").map(Number); setState((s) => ({ ...s, prayers: { ...s.prayers, demoMinute: h * 60 + m } })); } }}>
            <option value="" disabled>{t("Choose a moment")}</option>
            {checkpoints.map((point) => <option key={point.label} value={point.time}>{point.time} · {t(point.label)}</option>)}
          </select>
          <small>{t("Moves the demo clock. Keeps your records.")}</small>
        </label>}
        {state.mode === "demo" && <label className="review-clock">{t("Demo clock ")}<input type="time" aria-label={t("Demo clock")} value={clockText(state.prayers.demoMinute)}
            onChange={(e) => { if (e.target.value) { const [h,m] = e.target.value.split(":").map(Number);
              setState((s) => ({ ...s, prayers: { ...s.prayers, demoMinute: h * 60 + m } })); } }} />
        </label>}
      </div>
      <button
        disabled={state.mode !== "demo"}
        className="review-link"
        onClick={() =>
          setState((s) =>
            ensurePrayerDays(ensureDays({ ...s, demoDate: addDays(s.demoDate, 1) })),
          )
        }
      >
        {t("Advance one local day ")}<ArrowRight size={14} />
      </button>
      {state.timer && (
        <button
          className="review-link"
          onClick={() =>
            setState((s) => ({
              ...s,
              timer: s.timer
                ? { ...s.timer, elapsed: s.timer.duration, startedAt: null }
                : null,
            }))
          }
        >
          {t("Finish timer (demo shortcut) ")}<ArrowRight size={14} />
        </button>
      )}
      <div className="review-divider" />
      <button
        className="review-link"
        onClick={() =>
          window.open(`${location.pathname}?design=1`, "_blank", "noopener")
        }
      >
        <Palette size={15} /> {t(" Design system ")}<ArrowRight size={14} />
      </button>
      <button className="review-link" onClick={() => exportData(state)}>
        <Download size={15} />
        {t("Export local data ")}<ArrowRight size={14} />
      </button>
      <p className="review-status">
        {xpTotal(state)} {t(" XP · ")}{streaks(state).current} {t(" planned days ")}<br />
        {t("Unlimited habits · Personal prototype ")}</p>
    </section>
  );
}
