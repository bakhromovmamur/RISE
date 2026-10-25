import { useEffect, useState } from "react";
import {
  ArrowRight, Bell, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Copy, Footprints, Leaf, Moon, Pause, PenLine, Sunrise, Sun, Sunset,
} from "lucide-react";
import { useApp } from "./context";
import { useText } from "./LifeUI";
import { Button, GroupRow, ProgressBar, SectionTitle, Toggle } from "./components";
import { HabitCard } from "./Today";
import { formatDate, today } from "./model";
import {
  PRAYERS, clockText, endMinute, getPrayerDay,
  minuteOf, nextPrayer, phaseLabel, prayerDateAdd, prayerMoment, prayerName,
  prayerDayOrigin, prayerPhase, prayerStreak, prayerTotals, prayerWindowState, preparationDate,
  validateTimetable, weeklyPrayers, wrapRemaining,
  type PrayerCheck, type PrayerDay, type PrayerId, type PrayerMoment,
} from "./prayerModel";

export function usePrayerClock(): PrayerMoment {
  const { state } = useApp();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);
  return prayerMoment(state);
}
export function PrayerIcon({ id, size = 23 }: { id: PrayerId; size?: number }) {
  const Icon = id === "fajr" ? Sunrise : id === "isha" ? Moon : id === "maghrib" ? Sunset : Sun;
  return <Icon size={size} strokeWidth={1.6} />;
}
const shortDate = (date: string) => formatDate(date, { month: "short", day: "numeric" });

export function SalahToday() {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open, toast } = useApp();
  const now = usePrayerClock(), day = getPrayerDay(state, now.date);
  const next = nextPrayer(state, now), preparation = preparationDate(state);
  const onTime = day ? prayerOptions.filter(({ id }) => day.entries[id].check === "on_time").length : 0;
  const unconfirmed = day ? prayerOptions.filter(({ id }) => prayerPhase(state, now.date, id, now) === "unconfirmed") : [];
  const work = state.prayers.work;
  const habit = (state.days[today(state)] ?? []).find((h) => !h.check);
  const start = () => {
    if (!next) return;
    dispatch({ kind: "work.begin", prayer: next.id, date: next.date });
    open({ type: "workBreak" });
  };
  const upcoming = next?.phase === "upcoming";
  const lead = next ? minuteOf(next.entry.target) - now.minute : 0;
  return <div className="screen salah-screen">
    <header className="salah-heading">
      <h1>{t("Make room")}<br />{t("for salah.")}</h1>
      <button className="prayer-date" onClick={() => open({ type: "timetable" })}>
        <span>{t.date(now.date, { weekday: "short", day: "numeric", month: "short" })}</span>
        <strong>{clockText(now.minute)} <ChevronRight size={14} /></strong>
      </button>
    </header>
    {day ? <>
      <div className="prayer-strip" aria-label={t("Your five daily prayers")}>
        {prayerOptions.map(({ id, name }) => {
          const phase = prayerPhase(state, now.date, id, now);
          return <button key={id} className={"prayer-anchor " + phase + (next?.id === id ? " current" : "")}
            aria-label={name + ", " + t(phaseLabel[phase]) + ", " + day.entries[id].target}
            onClick={() => open({ type: "prayer", prayer: id, date: now.date })}>
            <span className="prayer-dot">{phase === "on_time" ? <Check size={19} /> : <PrayerIcon id={id} size={20} />}</span>
            <strong>{name}</strong><small>{day.entries[id].target}</small>
          </button>;
        })}
      </div>
      <div className="prayer-day-caption"><span>{onTime} {t(" of 5 on time")}</span>
        <button onClick={() => open({ type: "timetable" })}>{day.sample ? t("Demo times") : day.source}<ChevronRight size={12} /></button>
      </div>
      <section className="prayer-hero">
        <div className="prayer-hero-title">
          <h2>{next ? upcoming ? t(prayerName(next.id)) + t(" is\ncoming up.") : t("Time for ") + t(prayerName(next.id)) + "." : onTime === 5 ? t("Five moments,\nkept.") : t("A moment\nto reflect.")}</h2>
          {next ? <PrayerIcon id={next.id} size={30} /> : <Leaf size={30} strokeWidth={1.5} />}
        </div>
        <p>{next ? upcoming
          ? (lead <= state.prayers.preferences.leadMinutes ? t("Leave yourself a note. You don’t need to finish everything before you stop.")
            : t("Your next prayer is planned for ") + next.entry.target + t(". Let the next stretch of your day fit around it."))
          : next.id === "fajr" ? t("Feet on the floor. One small move toward the morning you wanted.")
            : t("Leave one line for your return.\nYour work will be here.")
          : onTime === 5 ? t("You made space for every prayer today. Let that be enough.")
            : t("You can record a prayer whenever you return. Your next beginning is still ahead.")}</p>
        {next && <div className="prayer-window"><Clock3 size={15} /><span>{t("Window ")}{next.entry.begins}–{next.entry.ends}{endMinute(next.entry) > 1440 ? t(" next day") : ""}</span></div>}
        {next ? <div className="prayer-hero-actions">
          <Button onClick={next.id === "fajr" ? () => open({ type: "wake", date: next.date }) : start}>
            {next.id === "fajr" ? <Sunrise size={18} /> : <Pause size={17} />}
            {next.id === "fajr" ? t("Try the Fajr wake-up") : t("Save & step away")}
          </Button>
          {!upcoming && <button className="prayer-quiet-action" onClick={() => {
            dispatch({ kind: "prayer.record", date: next.date, prayer: next.id, check: "on_time" });
            toast(t("{0} recorded on time.", undefined, [t(prayerName(next.id))]));
          }}><Check size={16} />{t("Already prayed on time")}</button>}
        </div> : <Button onClick={() => open({ type: "fajr" })}><Moon size={18} />{t("Prepare for Fajr")}</Button>}
      </section>
      {unconfirmed.length > 0 && <button className="prayer-pending" onClick={() => open({ type: "prayer", prayer: unconfirmed[0].id, date: now.date })}>
        <CircleHelp size={18} /><span>{unconfirmed.length} {unconfirmed.length === 1 ? t("prayer hasn’t") : t("prayers haven’t")} {t(" been recorded.")}<small>{t("No assumption made. Add your record.")}</small></span><ChevronRight size={17} />
      </button>}
    </> : <section className="prayer-hero">
      <Sunrise size={36} strokeWidth={1.5} /><h2>{t("A day built")}<br />{t("around salah.")}</h2>
      <p>{t("Add today’s times from the timetable you trust. Your five daily anchors will appear here.")}</p>
      <Button onClick={() => open({ type: "timetable" })}>{t("Add prayer times")}<ArrowRight size={17} /></Button>
    </section>}
    {work && <button className="resume-note" onClick={() => open({ type: "workBreak" })}>
      <PenLine size={19} /><span><strong>{work.stage === "returned" ? t("Your place is saved") : t("Continue your prayer break")}</strong>
        <small>{work.note || t("One line now makes returning easier.")}</small></span><ChevronRight size={17} />
    </button>}
    <div className="fajr-preview-row">
      <GroupRow icon={<Moon size={22} strokeWidth={1.6} />} title={state.prayers.prepared[preparation] ? t("Fajr plan saved") : t("Tomorrow starts tonight")}
        detail={(state.prayers.prepared[preparation] ? t("Review your plan for ") : t("Prepare for Fajr · ")) + t.shortDate(preparation)}
        onClick={() => open({ type: "fajr" })} />
    </div>
    <SectionTitle title={t("Between prayers")}><button className="text-button" onClick={() => open({ type: "habitsToday" })}>{t("All habits")}<ChevronRight size={14} /></button></SectionTitle>
    {habit ? <HabitCard item={habit} /> : <button className="salah-rest" onClick={() => open({ type: "habitsToday" })}><BookOpen size={21} /><span>{t("Your other habits have room here.")}</span><ChevronRight size={17} /></button>}
    <PrayerGarden compact />
    <p className="prayer-footnote">{day?.sample ? t("Sample history and illustrative times. ") : ""}{t("Reminder delivery is a prototype preview.")}</p>
  </div>;
}

export function PrayerDetail({ id, date }: { id: PrayerId; date: string }) {
  const t = useText();
  const { state, dispatch, open, toast, close, setTab } = useApp();
  const now = usePrayerClock(), day = getPrayerDay(state, date), entry = day?.entries[id];
  if (!entry) return <div className="prayer-detail"><h1>{t(prayerName(id))}</h1><p>{t("No timetable was entered for ")}{t.shortDate(date)}.</p>
    <Button onClick={() => open({ type: "timetable", date })}>{t("Add this day’s times")}</Button></div>;
  if (day && !entry.check && prayerDayOrigin(day) === "review") return <div className="prayer-detail"><h1>{t(prayerName(id))}</h1>
    <p className="muted">{t("Compare this saved date with a trusted timetable and time zone, then save again.", "Bu saqlangan sanani ishonchli jadval va vaqt mintaqasi bilan solishtiring, so‘ng qayta saqlang.")}</p>
    <Button className="wide" onClick={() => open({ type: "timetable", date })}>{t("Enter a timetable manually", "Jadvalni qo‘lda kiritish")}</Button></div>;
  const phase = prayerPhase(state, date, id, now), streak = prayerStreak(state, id, now);
  const window = prayerWindowState(state, date, id, now), started = !!window?.started, ended = !!window?.ended;
  const needsRecovery = entry.check === "missed" || entry.check === "later";
  const log = (check: PrayerCheck | null) => {
    dispatch({ kind: "prayer.record", date, prayer: id, check, returnToWork: "if-recorded" });
    toast(check ? t(prayerName(id)) + " · " + t(phaseLabel[check]) : t("Prayer record removed."));
  };
  return <div className="prayer-detail">
    <div className="prayer-detail-icon"><PrayerIcon id={id} size={35} /></div>
    <h1>{t(prayerName(id))}</h1><p className="muted">{t.date(date, { weekday: "long", month: "short", day: "numeric" })}</p>
    <div className={"prayer-status " + phase}>{t(phaseLabel[phase])}</div>
    <dl className="prayer-times"><div><dt>{t("Begins")}</dt><dd>{entry.begins}</dd></div><div><dt>{t("Your plan")}</dt><dd>{entry.target}</dd></div><div><dt>{t("Window ends")}</dt><dd>{entry.ends}{endMinute(entry) > 1440 && <small>{t("next day")}</small>}</dd></div></dl>
    <p className="prayer-source">{day?.sample ? t("Illustrative demo times") : day?.source}</p>
    {needsRecovery ? <div className="prayer-recovery">
      <h2>{t("Keep going from here.", "Shu yerdan davom eting.")}</h2>
      <p>{t("{0}’s on-time streak starts again. Your earlier prayers, habit XP and earned rewards stay.", "{0}ning vaqtida o‘qish ketma-ketligi qayta boshlanadi. Avvalgi namoz qaydlari, odat XP va olingan mukofotlar saqlanadi.", [t(prayerName(id))])}</p>
      <Button className="wide" onClick={() => { close(); setTab("today"); }}>{t("Back to Today", "Bugunga qaytish")}<ArrowRight size={17} /></Button>
    </div> : <p className="prayer-detail-guidance">{phase === "paused" ? t("This prayer is privately paused. It isn’t counted as completed or missed.") : started || entry.check ? t("Record when you prayed, even if you’re logging it later.") : t("This prayer hasn’t begun. Come back to record it after you pray.")}</p>}
    {phase === "paused" && <Button variant="secondary" className="wide" onClick={() => open({ type: "period" })}>{t("Manage private pause")}</Button>}
    <div className="prayer-record-actions">
      {needsRecovery && <p className="fine-print">{t("Need to correct this record? Choose what happened.", "Qaydni tuzatish kerakmi? Nima bo‘lganini tanlang.")}</p>}
      <Button variant={needsRecovery ? "secondary" : "primary"} disabled={phase === "paused" || (!started && !entry.check) || entry.check === "on_time"} onClick={() => log("on_time")}><Check size={18} />{entry.check === "on_time" ? t("Recorded on time") : t("Prayed on time")}</Button>
      <div><Button variant="secondary" disabled={phase === "paused" || (!ended && !entry.check) || entry.check === "later"} onClick={() => log("later")}>{t("Prayed later")}</Button>
        <Button variant="ghost" disabled={phase === "paused" || (!ended && !entry.check) || entry.check === "missed"} onClick={() => log("missed")}>{t("Missed")}</Button></div>
      {!entry.check && !ended && started && <small className="muted">{t("“Later” and “Missed” become available after this window ends.")}</small>}
      {entry.check && <button className="text-button" onClick={() => log(null)}>{t("Undo this record")}</button>}
    </div>
    <button className="prayer-streak-detail" onClick={() => open({ type: "prayerRules" })}>
      <Leaf size={22} /><span><strong>{streak.current === null ? t("Streak pending") : streak.current + t(" on time in a row")}</strong>
        <small>{streak.pending ? t("An earlier prayer needs your record.") : t("Your best: ") + streak.longest + t(" in a row.")}</small></span><CircleHelp size={18} />
    </button>
    {(phase === "open" || phase === "upcoming") && <Button variant="secondary" className="wide" onClick={() => {
      dispatch({ kind: "work.begin", prayer: id, date }); open({ type: "workBreak" });
    }}>{t("Try the save-and-stop reminder")}</Button>}
  </div>;
}

function blankDay(timezone: string): PrayerDay {
  return { source: "", sample: false, timezone, entries: Object.fromEntries(PRAYERS.map(({ id }) => [id, { begins: "", target: "", ends: "" }])) as PrayerDay["entries"] };
}
export function PrayerTimetable({ date: initialDate }: { date?: string }) {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, toast, storage } = useApp();
  const [date, setDate] = useState(initialDate ?? prayerMoment(state).date);
  const [draft, setDraft] = useState(() => structuredClone(getPrayerDay(state, date) ?? blankDay(state.timezone)));
  const [preferences, setPreferences] = useState({ ...state.prayers.preferences });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedOnDevice = saved && storage.getSnapshot().status === "saved";
  function changeDate(value: string) {
    setDate(value); setDraft(structuredClone(getPrayerDay(state, value) ?? blankDay(state.timezone))); setError(""); setSaved(false);
  }
  return <form className="prayer-form" onSubmit={(e) => {
    e.preventDefault();
    const message = validateTimetable(draft, date);
    if (!date || message) { setError(message || "Choose a date for these times."); return; }
    if (!dispatch({ kind: "prayer.timetable", date, day: draft, preferences })) return;
    setError(""); setSaved(true); toast(t("Timetable saved for {0}.", undefined, [t.shortDate(date)]));
  }}>
    <h1>{t("Your day’s anchors.")}</h1><p className="muted">{t("Use the timetable you follow for prayer windows and your preferred time for each prayer.")}</p>
    <label className="field">{t("Date")}<input type="date" value={date} min={state.prayers.started} required onChange={(e) => changeDate(e.target.value)} /></label>
    <label className="field">{t("Timetable source")}<input value={draft.source} placeholder={t("Your mosque or trusted timetable")} maxLength={100} onChange={(e) => { setDraft({ ...draft, source: e.target.value }); setSaved(false); }} /></label>
    <label className="field">{t("Time zone", "Vaqt mintaqasi")}<input value={draft.timezone} required onChange={e => { setDraft({ ...draft, timezone: e.target.value }); setSaved(false); }} placeholder="Asia/Tashkent" /></label>
    <p className="prayer-form-note">{state.mode === "demo" ? t("These sample times are for exploring the prototype. ") : ""}{t("Times use ")}{draft.timezone}{t(". Save each date separately; prayer times can change every day.")}</p>
    {prayerOptions.map(({ id, name }) => <fieldset className="prayer-time-fields" key={id}>
      <legend><PrayerIcon id={id} size={19} />{name}</legend>
      <div>{(["begins", "target", "ends"] as const).map((key) => <label className="field" key={key}>
        {key === "begins" ? t("Begins") : key === "target" ? t("Your plan") : t("Window ends")}
        <input type="time" aria-label={name + " " + (key === "target" ? t("planned time") : t(key))} value={draft.entries[id][key]} required onChange={(e) => {
          setDraft({ ...draft, entries: { ...draft.entries, [id]: { ...draft.entries[id], [key]: e.target.value } } }); setSaved(false);
        }} /></label>)}</div>
    </fieldset>)}
    <p className="prayer-form-note">{t("Use the window ends given by your source, including sunrise for Fajr. An Isha end time earlier than its start means the following day. Recorded prayers keep their original times.")}</p>
    <SectionTitle title={t("How you want to pause")} />
    <label className="field">{t("Where you plan to pray")}<select value={preferences.place} onChange={(e) => { setPreferences({ ...preferences, place: e.target.value as "home" | "mosque" }); setSaved(false); }}>
      <option value="home">{t("At home or work")}</option><option value="mosque">{t("At the mosque")}</option></select></label>
    <label className="field">{t("Preparation reminder")}<select value={preferences.leadMinutes} onChange={(e) => { setPreferences({ ...preferences, leadMinutes: Number(e.target.value) }); setSaved(false); }}>
      {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} {t(" minutes before your plan")}</option>)}</select></label>
    <label className="field">{t("Reminder voice")}<select value={preferences.style} onChange={(e) => { setPreferences({ ...preferences, style: e.target.value as "gentle" | "firm" }); setSaved(false); }}>
      <option value="firm">{t("Clear & direct")}</option><option value="gentle">{t("Gentle")}</option></select></label>
    <GroupRow icon={<Bell size={20} />} title={t("Reminder previews")} detail={t("Preview the cues inside RISE.")} end={<Toggle checked={preferences.reminders} label={t("Reminder previews")} onChange={() => { setPreferences({ ...preferences, reminders: !preferences.reminders }); setSaved(false); }} />} />
    <p className="prayer-form-note">{state.mode === "demo" ? t("This browser prototype does not deliver scheduled alarms or notifications.") : t("Saving a timetable does not enable device notifications. Review delivery settings separately.")}</p>
    {error && <p role="alert" className="field-error">{t.error(error)}</p>}
    <Button type="submit" className="wide">{savedOnDevice ? <Check size={18} /> : null}{savedOnDevice ? t("Saved for ") + t.shortDate(date) : t("Save times & preferences")}</Button>
  </form>;
}

export function FajrPreparation() {
  const t = useText();
  const { state, dispatch, open, toast, storage } = useApp();
  const date = preparationDate(state), prayer = getPrayerDay(state, date)?.entries.fajr;
  const [plan, setPlan] = useState(() => ({ ...state.prayers.prepared[date] ?? state.prayers.fajr }));
  const [saved, setSaved] = useState(!!state.prayers.prepared[date]);
  const savedOnDevice = saved && storage.getSnapshot().status === "saved";
  const update = (values: Partial<typeof plan>) => { setPlan({ ...plan, ...values }); setSaved(false); };
  function save() {
    dispatch({ kind: "fajr.plan", date, plan });
    setSaved(true); toast(t("Fajr plan saved. This is an alarm preview."));
  }
  return <div className="fajr-preparation">
    <div className="fajr-intro"><Moon size={34} strokeWidth={1.4} /><h1>{t("Tomorrow starts")}<br />{t("tonight.")}</h1>
      <p>{t("A little preparation for Fajr on ")}{t.shortDate(date)}.</p></div>
    <div className="fajr-plan-summary"><div><small>{t("Fajr begins")}</small><strong>{prayer?.begins ?? t("Add times")}</strong></div><ArrowRight size={20} /><div><small>{t("Your wake-up")}</small><strong>{prayer ? clockText(minuteOf(prayer.begins) - plan.wakeLead) : "—"}</strong></div></div>
    {!prayer ? <Button variant="secondary" className="wide" onClick={() => open({ type: "timetable", date })}>{t("Add the timetable for ")}{t.shortDate(date)}</Button> : <p className="prayer-source">{getPrayerDay(state, date)?.sample ? t("Illustrative demo times") : getPrayerDay(state, date)?.source}</p>}
    <label className="field">{t("Begin winding down at")}<input type="time" value={plan.bedtime} required onChange={(e) => update({ bedtime: e.target.value })} /></label>
    <div className="prayer-two-fields">
      <label className="field">{t("Wake before Fajr")}<select value={plan.wakeLead} onChange={(e) => update({ wakeLead: Number(e.target.value) })}>{[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n === 0 ? t("At Fajr") : n + t(" minutes")}</option>)}</select></label>
      <label className="field">{t("Backup wake-up")}<select value={plan.backupMinutes} onChange={(e) => update({ backupMinutes: Number(e.target.value) })}><option value={0}>{t("None")}</option><option value={3}>{t("3 min later")}</option><option value={5}>{t("5 min later")}</option></select></label>
    </div>
    <label className="field">{t("Where your phone will be")}<select value={plan.placement} onChange={(e) => update({ placement: e.target.value as "away" | "bedside" })}><option value="away">{t("Across the room")}</option><option value="bedside">{t("Beside the bed")}</option></select></label>
    <label className="field">{t("A message from your evening self")}<textarea aria-label={t("A message from your evening self")} rows={3} maxLength={160} value={plan.message} onChange={(e) => update({ message: e.target.value })} /></label>
    <div className="prayer-preview-note"><Bell size={20} /><p>{t("Keep your usual alarm. This saves your plan and previews the wake-up flow; it won’t ring on your device.")}</p></div>
    <Button className="wide" disabled={!plan.bedtime || !plan.message.trim()} onClick={save}>{savedOnDevice ? <Check size={18} /> : <Moon size={18} />}{savedOnDevice ? t("Plan saved") : t("Save my Fajr plan")}</Button>
    <Button variant="ghost" className="wide" disabled={!prayer || !plan.message.trim() || !plan.bedtime} onClick={() => { save(); open({ type: "wake", date }); }}>{t("Save & preview wake-up")}<ArrowRight size={17} /></Button>
  </div>;
}

export function WakePreview({ date: requestedDate }: { date?: string }) {
  const t = useText();
  const { state, dispatch, open, back, toast } = useApp();
  const now = usePrayerClock(), date = requestedDate ?? preparationDate(state);
  const plan = state.prayers.prepared[date] ?? state.prayers.fajr;
  const entry = getPrayerDay(state, date)?.entries.fajr;
  const [awake, setAwake] = useState(false), [backup, setBackup] = useState(false);
  const phase = prayerPhase(state, date, "fajr", now);
  return <div className="wake-preview">
    <div className="prayer-preview-label"><Bell size={14} />{t("Alarm preview · ")}{t.shortDate(date)}</div>
    <Sunrise className="wake-sun" size={72} strokeWidth={1.1} />
    <h1>{awake ? t("You’re up.") : t("A new beginning.")}</h1>
    {!awake && <p className="wake-time">{entry ? clockText(minuteOf(entry.begins) - plan.wakeLead + (backup ? plan.backupMinutes : 0)) : t("Add prayer times")}</p>}
    <p className="wake-message">{awake ? t("Put the phone down. Make wudu, then pray when Fajr begins.") : backup ? t("One more cue. Put both feet on the floor.") : plan.message}</p>
    <p className="muted">{entry ? t("Fajr begins at ") + entry.begins + ". " : ""}{awake ? t("Acknowledging this alarm hasn’t recorded a prayer.") : plan.placement === "away" ? t("Your phone is across the room. Stay on your feet.") : t("Sit up and place your feet on the floor.")}</p>
    {!awake ? <Button className="wide" onClick={() => setAwake(true)}><Footprints size={20} />{t("I’m up")}</Button> :
      phase === "open" ? <Button className="wide" onClick={() => {
        dispatch({ kind: "prayer.record", date, prayer: "fajr", check: "on_time" }); toast("Fajr recorded on time."); back();
      }}><Check size={18} />{t("I prayed Fajr on time")}</Button> :
        <Button className="wide" onClick={() => open({ type: "prayer", prayer: "fajr", date })}>{phase === "upcoming" ? t("View Fajr time") : t("View Fajr record")}<ArrowRight size={18} /></Button>}
    {!awake && plan.backupMinutes > 0 && !backup && <Button variant="ghost" className="wide" onClick={() => setBackup(true)}>{t("Preview the backup cue")}</Button>}
    <Button variant="ghost" className="wide" onClick={back}>{t("Dismiss preview")}</Button>
    <p className="prayer-footnote">{t("No alarm is scheduled by this preview.")}</p>
  </div>;
}

export function WorkBreakFlow() {
  const t = useText();
  const { state, dispatch, open, close, toast, setTab } = useApp();
  const returnToToday = () => { close(); setTab("today"); };
  const now = usePrayerClock(), work = state.prayers.work;
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setClock(Date.now()), 500); return () => window.clearInterval(t); }, []);
  if (!work) return <div className="prayer-detail"><h1>{t("A place to pause.")}</h1><p>{t("Start a prayer break from Today to save your next step.")}</p><Button onClick={returnToToday}>{t("Back to Today")}</Button></div>;
  const change = (values: Partial<Pick<typeof work, "note" | "stage">>) => {
    if (values.note !== undefined) dispatch({ kind: "work.note", date: work.date, prayer: work.prayer, note: values.note });
    if (values.stage !== undefined) dispatch({ kind: "work.stage", date: work.date, prayer: work.prayer, stage: values.stage });
  };
  const seconds = wrapRemaining(work, clock), name = t(prayerName(work.prayer));
  const phase = prayerPhase(state, work.date, work.prayer, now), entry = getPrayerDay(state, work.date)?.entries[work.prayer];
  const expired = !!entry && !!prayerWindowState(state, work.date, work.prayer, now)?.ended;
  const record = () => open({ type: "prayer", prayer: work.prayer, date: work.date });
  const leaveUnrecorded = () => { change({ stage: "returned" }); returnToToday(); };
  const reminders = state.prayers.preferences.reminders, gentle = state.prayers.preferences.style === "gentle";
  return <div className={"work-break " + work.stage}>
    <div className="prayer-preview-label"><Pause size={14} />{name} · {work.stage === "returned" ? t("Your return") : reminders ? t("Reminder preview") : t("Manual prayer break")}</div>
    {work.stage === "save" ? <>
      <div className="work-symbol"><PenLine size={35} strokeWidth={1.5} /></div>
      <h1>{expired ? t("Pick up from here.", "Shu yerdan davom eting.") : gentle ? t("Leave a little\nroom for prayer.") : t("Save your place.\nThen stand up.")}</h1>
      <p>{expired ? t("{0}’s window ended at {1}. Your note stays saved. Record what happened, or return to Today for your next prayer.", "{0} vaqti {1} da tugadi. Qaydingiz saqlanadi. Nima bo‘lganini qayd eting yoki keyingi namoz uchun Bugunga qayting.", [name, entry!.ends]) : state.prayers.preferences.place === "mosque" ? t("Leave enough time for wudu and the walk to the mosque.") : t("One line is enough. You can pick up where you left off.")}</p>
      <label className="field">{t("When I come back, I’ll…")}<textarea aria-label={t("When I come back, I’ll…")} value={work.note} rows={4} maxLength={600} autoFocus placeholder={t("Finish the login button, then run the tests.")} onChange={(e) => change({ note: e.target.value })} /></label>
      <p className="prayer-form-note">{t("This note saves as you type. Save your code or document in its own app.")}</p>
      {expired ? <><Button className="wide" onClick={record}>{t("Record {0}", "{0}ni qayd etish", [name])}</Button><Button variant="ghost" className="wide" onClick={leaveUnrecorded}>{t("Back to Today", "Bugunga qaytish")}</Button><p className="prayer-footnote">{t("Returning keeps the prayer unlogged until you add a record.", "Qaytish namozni avtomatik qayd etmaydi.")}</p></> : <>
        {seconds !== null && <div className="wrap-count" role="status"><Clock3 size={20} /><strong>{seconds > 0 ? seconds + t(" seconds to wrap up") : t("Your minute is up. Step away.")}</strong></div>}
        <Button className="wide" onClick={() => change({ stage: "away" })}><Footprints size={19} />{t("Save & step away")}</Button>
        {!work.wrapUsed && <Button variant="ghost" className="wide" onClick={() => dispatch({ kind: "work.wrap", date: work.date, prayer: work.prayer })}>{t("I need 60 seconds to save")}</Button>}
        <p className="prayer-footnote">{t("One wrap-up minute. Your note stays even if you close RISE.")}</p>
      </>}
    </> : work.stage === "away" ? <>
      <div className="work-symbol"><PrayerIcon id={work.prayer} size={42} /></div>
      <h1>{expired ? t("Pick up from here.", "Shu yerdan davom eting.") : <>{t("Your place")}<br />{t("is saved.")}</>}</h1>
      <p>{expired ? t("{0}’s window has ended. Your note stays saved; add what happened when you’re ready.", "{0} vaqti tugadi. Qaydingiz saqlanadi; tayyor bo‘lganda nima bo‘lganini qayd eting.", [name]) : <>{t("Step away from the screen.")}<br />{t("Make space for ")}{name}.</>}</p>
      {entry && <div className="prayer-window"><Clock3 size={16} />{t("Window ")}{entry.begins}–{entry.ends}</div>}
      {work.note && <blockquote className="saved-note">{work.note}</blockquote>}
      {phase === "open" ? <Button className="wide" onClick={() => {
        dispatch({ kind: "prayer.record", date: work.date, prayer: work.prayer, check: "on_time", returnToWork: "always" });
        toast(t("{0} recorded on time.", undefined, [name]));
      }}><Check size={18} />{t("I prayed ")}{name} {t(" on time")}</Button> : phase === "upcoming" ?
        <p className="prayer-form-note">{t("Prayer begins at ")}{entry?.begins}{t(". Return to record it after you pray.")}</p> :
        <Button className="wide" onClick={record}>{expired && !entry?.check ? t("Record {0}", "{0}ni qayd etish", [name]) : t("View or update prayer record")}</Button>}
      <Button variant="ghost" className="wide" onClick={() => change({ stage: "returned" })}>{t("Return without recording")}</Button>
    </> : <>
      <div className="work-symbol"><Leaf size={36} strokeWidth={1.4} /></div>
      <h1>{t("Welcome back.")}</h1>
      <p>{phase === "on_time" ? name + t(" is recorded on time. Here’s where you left off.") : phase === "later" ? t("{0} is recorded as prayed later. Your next step is still here.", "{0} keyinroq o‘qilgan deb qayd etildi. Keyingi qadamingiz shu yerda.", [name]) : phase === "missed" ? t("{0} is recorded as missed. Your earlier progress stays. Here’s your saved next step.", "{0} o‘tkazib yuborilgan deb qayd etildi. Avvalgi natijalar va keyingi qadam qaydingiz saqlanadi.", [name]) : t("Your note is ready. You can record your prayer from Today whenever you’re ready.")}</p>
      <blockquote className="saved-note">{work.note || t("You left yourself a little space. Choose your next small step.")}</blockquote>
      {work.note && <Button variant="secondary" className="wide" onClick={async () => {
        try { await navigator.clipboard.writeText(work.note); toast("Resume note copied."); } catch { toast("Copy isn’t available here. Select the note to copy it."); }
      }}><Copy size={17} />{t("Copy my next step")}</Button>}
      <Button className="wide" onClick={returnToToday}>{t("Back to Today")}<ArrowRight size={17} /></Button>
    </>}
  </div>;
}

export function PrayerGarden({ compact = false }: { compact?: boolean }) {
  const t = useText();
  const { state, setTab, open } = useApp();
  const total = prayerTotals(state).onTime, milestones = [5, 15, 30, 60, 100];
  const next = milestones.find((n) => n > total);
  return <section className={"prayer-garden " + (compact ? "compact" : "")}>
    <div className="prayer-garden-title"><Leaf size={22} strokeWidth={1.5} /><h2>{t("A growing rhythm")}</h2><button aria-label={t("How prayer progress works")} onClick={() => open({ type: "prayerRules" })}><CircleHelp size={18} /></button></div>
    <p>{total} {t(" prayers recorded on time. Each one stays part of your story.")}</p>
    <div className="prayer-leaves" aria-label={t("On-time prayer milestones. ") + total + t(" recorded.")}>{milestones.map((n) => <span key={n} className={total >= n ? "earned" : ""}><Leaf size={25} strokeWidth={1.3} /><small>{n}</small></span>)}</div>
    {next && <ProgressBar value={total / next * 100} label={t("Progress toward ") + next + t(" prayers recorded on time")} />}
    {compact && <button className="text-button" onClick={() => setTab("progress")}>{t("See your prayer progress")}<ArrowRight size={16} /></button>}
  </section>;
}

export function PrayerProgress({ start: sharedStart, embedded = false }: { start?: string; embedded?: boolean } = {}) {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, open } = useApp();
  const now = usePrayerClock();
  const [offset, setOffset] = useState(0);
  const weekday = new Date(now.date + "T12:00:00Z").getUTCDay();
  const start = sharedStart ?? prayerDateAdd(now.date, -((weekday + 6) % 7) + offset * 7);
  const dates = Array.from({ length: 7 }, (_, i) => prayerDateAdd(start, i));
  const totals = prayerTotals(state), all = prayerStreak(state, "all", now);
  const count = weeklyPrayers(state, start, now);
  return <div className={embedded ? "prayer-progress embedded-progress" : "screen prayer-progress"}>
    {!embedded && <><header className="prayer-progress-heading"><h1>{t("Your rhythm.")}</h1><button className="icon-button" aria-label={t("How prayer streaks work")} onClick={() => open({ type: "prayerRules" })}><CircleHelp size={22} /></button></header>
    <p className="muted">{t("Five daily anchors. A history of showing up.")}</p>
    <div className="segmented"><button className={offset === -1 ? "selected" : ""} aria-pressed={offset === -1} onClick={() => setOffset(-1)}>{t("Last week")}</button><button className={offset === 0 ? "selected" : ""} aria-pressed={offset === 0} onClick={() => setOffset(0)}>{t("This week")}</button></div>
    <div className="prayer-week-title">
      <button className="icon-button" aria-label={t("Previous prayer week")} disabled={start <= state.prayers.started} onClick={() => setOffset(offset - 1)}><ChevronLeft size={20} /></button>
      <div><strong>{t.shortDate(start)}–{t.shortDate(dates[6])}</strong><span>{count.on_time} {t(" on time")}</span></div>
      <button className="icon-button" aria-label={t("Next prayer week")} disabled={offset === 0} onClick={() => setOffset(offset + 1)}><ChevronRight size={20} /></button>
    </div></>}
    {embedded && <div className="section-title"><h2>{t("Your prayer records")}</h2><button className="icon-button" aria-label={t("How prayer streaks work")} onClick={() => open({ type: "prayerRules" })}><CircleHelp size={21} /></button></div>}
    <div className="prayer-calendar">
      <div className="prayer-calendar-days">{dates.map((date) => <span key={date}>{t.date(date, { weekday: "narrow" })}<small>{Number(date.slice(-2))}</small></span>)}</div>
      {prayerOptions.map(({ id, name }) => {
        const streak = prayerStreak(state, id, now);
        return <div className="prayer-calendar-row" key={id}>
          <div className="prayer-calendar-label"><span><PrayerIcon id={id} size={19} />{name}</span><small>{streak.pending ? t("Streak pending") : streak.current + t(" in a row")}</small></div>
          <div className="prayer-calendar-cells">{dates.map((date) => {
            const tracked = date >= state.prayers.started, future = date > now.date && !getPrayerDay(state, date)?.entries[id].check && !prayerWindowState(state, date, id, now)?.started;
            const phase = prayerPhase(state, date, id, now);
            return <button key={date} disabled={!tracked || future} className={tracked ? phase : "untracked"}
              aria-label={name + ", " + t.shortDate(date) + ", " + (tracked ? t(phaseLabel[phase]) : t("Before tracking began"))}
              onClick={() => open({ type: "prayer", prayer: id, date })}>
              {phase === "paused" && tracked ? <Pause size={15} /> : phase === "on_time" && tracked ? <Check size={18} /> : phase === "later" && tracked ? <Clock3 size={17} /> : phase === "missed" && tracked ? <span className="prayer-missed-mark" /> : phase === "unconfirmed" && tracked ? <CircleHelp size={16} /> : <span className="prayer-empty-dot" />}
            </button>;
          })}</div>
        </div>;
      })}
    </div>
    <div className="prayer-legend"><span><Check size={14} />{t("On time")}</span><span><Clock3 size={14} />{t("Later")}</span><span><span className="prayer-missed-mark" />{t("Missed")}</span><span><CircleHelp size={14} />{t("Unlogged")}</span><span><Pause size={14} />{t("Paused")}</span></div>
    <p className="prayer-week-summary">{count.later} {t(" prayed later · ")}{count.missed} {t(" missed · ")}{count.unconfirmed} {t(" unlogged")}</p>
    {count.paused > 0 && <p className="inline-note">{count.paused} {t(" paused prayers are excluded. Paused days hold your streak without adding to it.")}</p>}
    <p className="fine-print">{t("The calendar uses the selected week. Individual streaks are current; unresolved records leave them pending.")}</p>
    <details className="progress-detail-disclosure" open={embedded ? undefined : true}>
    <summary>{t("All-five days & prayer milestones")}<ChevronRight size={18} /></summary>
    <div className="prayer-all-five"><Leaf size={27} strokeWidth={1.5} /><div><h2>{t("{0} lifetime days with all five on time", undefined, [totals.completeDays])}</h2><p>{all.pending ? t("Current streak pending a record.") : t("{0} complete days in a row.", undefined, [all.current])} {t(" Best: ")}{all.longest}.</p></div></div>
    <PrayerGarden />
    </details>
    {!embedded && <GroupRow icon={<BookOpen size={21} />} title={t("Your other habits")} detail={t("Habit consistency, XP and weekly reflections")} onClick={() => open({ type: "habitProgress" })} />}
    {!embedded && <p className="prayer-footnote">{state.mode === "demo" ? t("Includes clearly fictional sample history. ") : ""}{t("Streaks use your own prayer records.")}</p>}
  </div>;
}

export function PrayerRules() {
  const t = useText();
  return <div className="prayer-rules">
    <Leaf size={34} strokeWidth={1.5} /><h1>{t("Progress with room")}<br />{t("for honesty.")}</h1>
    <p>{t("Each prayer has its own on-time streak. Your records describe your routine; they don’t measure your faith.")}</p>
    <dl>
      <div><dt>{t("On time")}</dt><dd>{t("You report that you prayed within the window you follow. Logging it later still counts.")}</dd></div>
      <div><dt>{t("Prayed later or missed")}</dt><dd>{t("That prayer’s current on-time streak starts again. Other prayer streaks and earlier records remain.")}</dd></div>
      <div><dt>{t("Not recorded")}</dt><dd>{t("After its window, an unlogged prayer leaves the streak pending. Add your record to resolve it; RISE never assumes a miss or joins a streak across a gap.")}</dd></div>
      <div><dt>{t("All five on time")}</dt><dd>{t("A complete day means five on-time records. Upcoming prayers don’t break a streak, and days with unknown records stay unresolved.")}</dd></div>
      <div><dt>{t("A growing rhythm")}</dt><dd>{t("Leaves mark cumulative on-time records. A missed day doesn’t take your history away. Correcting or undoing a record updates the totals.")}</dd></div>
    </dl>
    <p className="prayer-preview-note">{t("Prayer records earn no habit XP. Preparing for Fajr, dismissing a reminder and tapping “I’m up” never count as praying.")}</p>
  </div>;
}
