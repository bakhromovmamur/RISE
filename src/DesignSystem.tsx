import { useText } from "./LifeUI";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, Sprout } from "lucide-react";
import {
  Badge,
  Button,
  CheckMark,
  HabitIcon,
  Pip,
  ProgressBar,
  Toggle,
  WeekdaySelector,
} from "./components";
export function DesignSystem() {
  const t = useText();
  const [days, setDays] = useState([1, 3, 5]),
    [checked, setChecked] = useState(false),
    [progress, setProgress] = useState(33);
  return (
    <main className="design-board">
      <header>
        <a href="./">
          <ArrowLeft size={17} />
          {t("Back to prototype ")}</a>
        <span>{t("RISE / DESIGN SYSTEM 01")}</span>
      </header>
      <h1>{t("Small by design.")}</h1>
      <p className="board-intro">
        {t("A calm foundation. A little personality. One coherent system for all the ways people show up. ")}</p>
      <section className="board-palette">
        <h2>{t("Porcelain, forest & a little light")}</h2>
        <div>
          {[
            { name: "Porcelain", hex: "#F5F7F3" },
            { name: "Forest ink", hex: "#17241F" },
            { name: "Action", hex: "#1F7855" },
            { name: "Soft mint", hex: "#DDF5E8" },
            { name: "Mint light", hex: "#7EDDB1" },
            { name: "Reward gold", hex: "#F1BD58" },
          ].map((c) => (
            <figure key={c.hex}>
              <div style={{ background: c.hex }} />
              <figcaption>
                <strong>{c.name}</strong>
                <span>{c.hex}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section>
        <h2>{t("A familiar voice, with room to breathe")}</h2>
        <div className="type-specimen">
          <div>
            <h1>
              {t("A little better, ")}<br />
              {t("every day. ")}</h1>
            <span>{t("Large title · 34 / 37 · system sans")}</span>
          </div>
          <div>
            <h2>{t("Your daily plan")}</h2>
            <p>{t("One small step is a whole beginning.")}</p>
            <small>{t("Supporting text is quiet, never hidden.")}</small>
            <span>{t("Section 22 · Body 16 · Supporting 13")}</span>
          </div>
        </div>
      </section>
      <section>
        <h2>{t("Meet Pip, in every moment")}</h2>
        <div className="pip-specimens">
          {(
            [
              "welcome",
              "focus",
              "celebrate",
              "rest",
              "return",
              "scarf",
            ] as const
          ).map((mood) => (
            <figure key={mood}>
              <Pip mood={mood} size={145} />
              <figcaption>
                {
                  {
                    welcome: t("Welcoming"),
                    focus: t("Focused"),
                    celebrate: t("Celebrating"),
                    rest: t("Resting"),
                    return: t("A gentle return"),
                    scarf: t("Linen scarf"),
                  }[mood]
                }
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section>
        <h2>{t("The same care, in both appearances")}</h2>
        <div className="component-themes">
          {(["light", "dark"] as const).map((theme) => (
            <div className="component-sample" data-theme={theme} key={theme}>
              <h3>
                {theme === "light" ? t("A fresh page") : t("A quieter evening")}
              </h3>
              <div className="sample-habit">
                <HabitIcon name="book" />
                <div>
                  <strong>{t("Read a little")}</strong>
                  <p>{t("10 pages · After breakfast")}</p>
                </div>
                <CheckMark tiny={theme === "dark"} />
              </div>
              <ProgressBar
                value={progress}
                label={t("{0} example progress", undefined, [theme])}
              />
              <Button
                onClick={() => setProgress((p) => (p === 100 ? 33 : 100))}
              >
                <Check size={17} />
                {progress === 100 ? t("Reset example") : t("Log full target")}
                <span>{t("+20 XP")}</span>
              </Button>
              <Button variant="secondary" onClick={() => setProgress(66)}>
                <Sprout size={17} />
                {t("Log tiny version ")}</Button>
              <Button disabled>{t("Disabled action")}</Button>
              <WeekdaySelector days={days} onChange={setDays} />
              <div className="sample-toggle">
                <span>{t("Reduce motion")}</span>
                <Toggle
                  checked={checked}
                  onChange={() => setChecked(!checked)}
                  label={t("{0} example toggle", undefined, [theme])}
                />
              </div>
              <label className="field">
                {t("Habit name ")}<input placeholder={t("A small commitment")} />
              </label>
              <div className="sample-rewards">
                <Badge xp={100} />
                <Badge xp={250} />
                <Badge xp={500} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="board-rules">
        <div>
          <h2>{t("Space & shape")}</h2>
          <p>
            {t("4 · 8 · 12 · 16 · 20 · 24 · 32 px ")}<br />
            {t("Screen inset 20 px · Card radius 20–24 px ")}<br />
            {t("Primary actions 52 px · Touch targets ≥44 px ")}</p>
        </div>
        <div>
          <h2>{t("Motion with a reason")}</h2>
          <p>
            {t("200 ms controls · 240 ms sheets ")}<br />{t("A brief check-in bounce. One milestone celebration. ")}<br />
            {t("System and in-app reduced motion respected. ")}</p>
        </div>
        <div>
          <h2>{t("Words that make room")}</h2>
          <p>
            {t("“Tiny version completed.” ")}<br />
            {t("“Your progress is still here.” ")}<br />
            {t("“Start with something small.” ")}</p>
        </div>
      </section>
      <footer>
        <Sprout size={24} />
        <span>{t("RISE — Small actions. A stronger you.")}</span>
        <a href="./">
          {t("Open prototype ")}<ArrowRight size={17} />
        </a>
      </footer>
    </main>
  );
}
