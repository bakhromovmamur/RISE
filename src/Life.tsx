import { useEffect, useState } from "react";
import { AlarmClock, ArrowRight, Bell, Check, ChevronRight, CircleAlert, Clock3, Footprints, Languages, MapPin, Moon, Pause, ShieldCheck, Smartphone, Sunrise } from "lucide-react";
import { useApp } from "./context";
import { Button, GroupRow, SectionTitle, Toggle } from "./components";
import { LifeIntro, PreviewLabel, PrivacyNote, useLifeDraft, useText } from "./LifeUI";
import { CITIES, activePause, alarmTimes, illustrativeDay, isPrayerExcluded, prayerKey, type LifeState, type Readiness } from "./lifeModel";
import { PRAYERS, getCurrentPrayerDay, getPrayerDay, isManualPrayerDay, pausePoint, prayerMoment, prayerPhase, preparationDate, type FajrPlan, type PrayerId } from "./prayerModel";
import { usePrayerClock } from "./Prayers";
import { addDays, today } from "./model";
import { DeliverySummary, LiveAlarmReadiness, LivePrayerSetup, PrayerLocationReview, useLiveText } from "./PrayerLive";
import { usePrayerDelivery } from "./PrayerDeliveryProvider";
import { deliveryPlatform, stopAlarmAudio } from "./prayerDelivery";

export function LanguagePicker() {
  const t = useText();
  const { state, dispatch } = useApp();
  return <div className="life-screen">
    <LifeIntro title={t("Make RISE feel familiar.", "RISE sizga yaqin bo‘lsin.")}
      text={t("Choose the language for RISE.", "RISE interfeysi tilini tanlang.")} />
    <div className="choice-list">{([["en", "English"], ["uz", "O‘zbekcha"], ["ru", "Русский"]] as const).map(([code, label]) =>
      <button className={`language-choice ${state.life.language === code ? "selected" : ""}`} key={code} aria-pressed={state.life.language === code} onClick={() => dispatch({ kind: "language.set", language: code })}>
        <Languages size={22} /><span>{label}<small>{code === "uz" ? "Lotin yozuvi" : code === "ru" ? "Кириллица" : "English"}</small></span>{state.life.language === code && <Check size={20} />}
      </button>)}</div>
    <p className="fine-print">{t("Your names, notes and saved content stay as written.", "Nomlar, qaydlar va saqlangan matnlar o‘z holicha qoladi.")}</p>
  </div>;
}

export function TodayPrayerMeta() {
  const t = useText();
  const l = useLiveText();
  const { state, open } = useApp(), pause = activePause(state);
  const day = state.mode !== "demo" ? getCurrentPrayerDay(state, today(state)) : undefined;
  const setupLabel = day && !day.sample && isManualPrayerDay(day) ? `${day.source} · ${day.timezone}` : state.mode !== "demo" && state.life.calculation ? state.life.calculation.label : state.life.setup.configured
    ? `${t(state.life.setup.city)} · ${state.life.setup.source === "local" ? t("local demo", "jadval namunasi") : t("calculated demo", "hisob namunasi")}`
    : t("Prayer setup", "Namoz sozlamalari");
  return <><div className="today-prayer-meta">
    <button aria-label={state.life.setup.configured ? `${t("Prayer times", "Namoz vaqtlari")}: ${setupLabel}` : undefined} onClick={() => open({ type: "prayerSetup" })}><MapPin size={14} />{setupLabel}<ChevronRight size={14} /></button>
    <button onClick={() => open({ type: pause ? "period" : "readiness" })}>{pause ? <Pause size={14} /> : <AlarmClock size={14} />}{pause ? t("Private pause", "Shaxsiy tanaffus") : state.mode !== "demo" ? l("Check alerts", "Signallarni tekshirish", "Проверить сигналы") : state.life.readiness === "ready" ? t("Ready · preview", "Tayyor · namuna") : t("Alarm preview", "Signal namunasi")}<ChevronRight size={14} /></button>
  </div><PrayerLocationReview /></>;
}

export function PauseSummary() {
  const t = useText();
  const { state, open } = useApp();
  if (!activePause(state)) return null;
  return <div className="pause-summary">
    <span className="pause-symbol"><Moon size={23} /></span><div><strong>{t("A little space for you.", "O‘zingiz uchun biroz vaqt.")}</strong>
      <p>{t("Prayer tracking is paused. Your progress is safe.", "Namoz qaydlari to‘xtatilgan. Natijalaringiz saqlanadi.")}</p></div>
    <button className="text-button" onClick={() => open({ type: "period" })}>{t("Manage", "Boshqarish")}<ChevronRight size={16} /></button>
  </div>;
}

export function PrayerSetup({ live = false }: { live?: boolean }) {
  const { state, open } = useApp(), l = useLiveText();
  if (live || state.mode !== "demo") return <LivePrayerSetup />;
  return <><Button className="wide" onClick={() => open({ type: "prayerSetup", live: true })}><MapPin size={18} />{l("Set up real prayer times", "Haqiqiy namoz vaqtlarini sozlash", "Настроить реальное время молитв")}</Button><DemoPrayerSetup /></>;
}
function DemoPrayerSetup() {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open, toast, storage } = useApp();
  const [draft, setDraft, clear] = useLifeDraft<LifeState["setup"]>("prayer-setup", () => structuredClone(state.life.setup));
  const [saved, markSaved] = useState(false);
  const savedOnDevice = saved && storage.getSnapshot().status === "saved";
  const day = illustrativeDay(draft.city, draft.source, draft.offsets);
  const update = (part: Partial<typeof draft>) => { setDraft({ ...draft, ...part }); markSaved(false); };
  return <div className="life-screen">
    <PreviewLabel>{t("Prayer setup preview · illustrative times", "Namoz sozlamalari namunasi · shartli vaqtlar")}</PreviewLabel>
    <LifeIntro title={t("Five anchors. Your day.", "Besh namoz. Sizning kuningiz.")}
      text={t("A daily rhythm that follows where you are. Choose a city to try the experience.", "Kun tartibingiz manzilingizga moslashadi. Namunani ko‘rish uchun shahar tanlang.")} />
    <label className="field">{t("City", "Shahar")}<select aria-label={t("City", "Shahar")} value={draft.city} onChange={(e) => update({ city: e.target.value })}>{CITIES.map((city) => <option key={city} value={city}>{t(city)}</option>)}</select></label>
    <p className="location-note"><MapPin size={15} />{t("Asia/Tashkent · UTC+05:00")}</p>
    <label className="field">{t("Timetable source", "Vaqtlar manbasi")}<select aria-label={t("Timetable source", "Vaqtlar manbasi")} value={draft.source} onChange={(e) => update({ source: e.target.value as typeof draft.source })}>
      <option value="local">{t("Local published timetable · preview", "Mahalliy e’lon qilingan jadval · namuna")}</option>
      <option value="calculated">{t("Calculated times · preview", "Hisoblangan vaqtlar · namuna")}</option>
    </select></label>
    <p className="fine-print">{t("These sample times are authored for the prototype. Neither source downloads or calculates real prayer times.", "Bu vaqtlar prototip uchun tayyorlangan. Hech bir manba haqiqiy namoz vaqtlarini yuklamaydi yoki hisoblamaydi.")}</p>
    <SectionTitle title={t("Your daily plan", "Kunlik rejangiz")} />
    <div className="timing-table"><div className="timing-table-head"><span>{t("Prayer", "Namoz")}</span><span>{t("Begins", "Boshlanishi")}</span><span>{t("Plan after start", "Boshlanishdan keyin")}</span></div>
      {prayerOptions.map(({ id, name }) => <div className="timing-table-row" key={id}><strong>{name}</strong><span>{day.entries[id].begins}</span><label><span className="sr-only">{name} {t("planned offset", "reja kechikishi")}</span>
        <select aria-label={`${name} ${t("planned offset", "reja kechikishi")}`} value={draft.offsets[id]} onChange={(e) => update({ offsets: { ...draft.offsets, [id]: Number(e.target.value) } })}>
          {[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n ? `+${n} ${t("min", "daq")}` : t("At start", "Boshlanishida")}</option>)}
        </select><small>{t("Planned", "Reja")}: {day.entries[id].target}</small></label></div>)}</div>
    <Button className="wide" onClick={() => { dispatch({ kind: "prayer.sample-setup", setup: draft }); clear(); markSaved(true); toast(t("Sample timetable saved locally.", "Namunaviy jadval shu brauzerda saqlandi.")); }}><Check size={18} />{savedOnDevice ? t("Sample plan saved", "Namunaviy reja saqlandi") : t("Save sample prayer plan", "Namunaviy namoz rejasini saqlash")}</Button>
    <div className="group life-link-group">
      <GroupRow icon={<Bell size={20} />} title={t("Prayer reminders", "Namoz eslatmalari")} detail={t("A cue to prepare. A cue to stop.", "Tayyorlanish va ishni to‘xtatish uchun eslatma.")} onClick={() => open({ type: "prayerReminders" })} />
      <GroupRow icon={<AlarmClock size={20} />} title={t("Prepare for Fajr", "Bomdodga tayyorlanish")} onClick={() => open({ type: "fajr" })} />
      <GroupRow icon={<Smartphone size={20} />} title={t("Alarm readiness", "Signal tayyorligi")} onClick={() => open({ type: "readiness" })} />
      <GroupRow icon={<Clock3 size={20} />} title={t("Enter a timetable manually", "Jadvalni qo‘lda kiritish")} onClick={() => open({ type: "timetable" })} />
    </div>
  </div>;
}

export function PrayerReminderSettings() {
  const t = useText();
  const l = useLiveText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open } = useApp();
  const update = (id: PrayerId, key: "preparation" | "due") => dispatch({ kind: "prayer.reminder", prayer: id, phase: key, enabled: !state.life.reminderRules[id][key] });
  return <div className="life-screen">
    {state.mode === "demo" ? <PreviewLabel /> : <DeliverySummary />}
    <LifeIntro title={t("A cue you can act on.", "Amal qilish oson eslatma.")}
      text={t("Finish a thought, save your place, and make room for prayer.", "Fikrni yakunlang, qaytish joyingizni saqlang va namozga vaqt ajrating.")} />
    <label className="field">{t("Preparation lead time", "Tayyorgarlik eslatmasi")}<select aria-label={t("Preparation lead time", "Tayyorgarlik eslatmasi")} value={state.prayers.preferences.leadMinutes} onChange={(e) => dispatch({ kind: "prayer.preferences", changes: { leadMinutes: Number(e.target.value) } })}>
      {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} {t("minutes before your plan", "daqiqa rejangizdan oldin")}</option>)}</select></label>
    <div className="reminder-table"><div className="reminder-table-head"><span>{t("Prayer", "Namoz")}</span><span>{t("Prepare", "Tayyorlanish")}</span><span>{t("At prayer time", "Namoz vaqtida")}</span></div>
      {prayerOptions.map(({ id, name }) => <div className="reminder-table-row" key={id}><strong>{name}</strong><Toggle label={t("{0} preparation reminder", "{0} uchun tayyorgarlik eslatmasi", [name])} checked={state.life.reminderRules[id].preparation} onChange={() => update(id, "preparation")} /><Toggle label={t("{0} prayer-time reminder", "{0} vaqtidagi eslatma", [name])} checked={state.life.reminderRules[id].due} onChange={() => update(id, "due")} /></div>)}</div>
    {state.mode !== "demo" && <GroupRow icon={<Bell size={20} />} title={l("Prayer reminders enabled", "Namoz eslatmalari yoqilgan", "Напоминания о молитвах")} end={<Toggle label={l("Prayer reminders enabled", "Namoz eslatmalari yoqilgan", "Напоминания о молитвах")} checked={state.prayers.preferences.reminders} onChange={() => dispatch({ kind: "prayer.preferences", changes: { reminders: !state.prayers.preferences.reminders } })} />} />}
    <p className="fine-print">{state.mode === "demo" ? t("Preferences save automatically. Fajr’s wake alarm is separate. No notifications are delivered by this prototype.", "Sozlamalar avtomatik saqlanadi. Bomdod signali alohida. Bu prototip bildirishnoma yubormaydi.") : l("Preferences save automatically. Fajr wake-up alerts have their own switch in your Fajr plan.", "Sozlamalar avtomatik saqlanadi. Bomdod uyg‘onish signali bomdod rejasida alohida yoqiladi.", "Настройки сохраняются автоматически. Сигнал пробуждения включается отдельно в плане Фаджра.")}</p>
    <SectionTitle title={t("Try a moment", "Namunani sinab ko‘ring")} />
    <Button variant="secondary" className="wide" onClick={() => open({ type: "prayerNudge", prayer: "asr", preview: "prepare" })}><Bell size={18} />{t("Preview preparation reminder", "Tayyorgarlik eslatmasini ko‘rish")}</Button>
    <Button variant="ghost" className="wide" onClick={() => open({ type: "prayerNudge", prayer: "asr", preview: "due" })}>{t("Preview save-and-stop", "Ishni saqlab to‘xtash namunasini ko‘rish")}<ArrowRight size={18} /></Button>
  </div>;
}

export function PrayerNudge({ id = "asr", prepare = false }: { id?: PrayerId; prepare?: boolean }) {
  const t = useText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, open, back } = useApp(), date = today(state);
  const paused = isPrayerExcluded(state, date, id), name = prayerOptions.find((p) => p.id === id)!.name;
  return <div className="life-screen">
    <PreviewLabel>{t("Reminder preview · nothing will be sent", "Eslatma namunasi · hech narsa yuborilmaydi")}</PreviewLabel>
    <LifeIntro title={paused ? t("A quiet moment.", "Sokin bir lahza.") : prepare ? t("{0} is getting close.", "{0} yaqinlashmoqda.", [name]) : t("Save your place. Go pray.", "Qaytish joyingizni saqlang. Namozga boring.")}
      text={paused ? t("Prayer tracking is paused. This reminder would be suppressed.", "Namoz qaydlari to‘xtatilgan. Bu eslatma ko‘rsatilmaydi.") : t("“Just five more minutes” can wait. One line is enough to return to your work.", "“Yana besh daqiqa” kutishi mumkin. Ishga qaytish uchun bir jumla yetarli.")} />
    {!paused && <div className="nudge-preview"><span className="nudge-brand"><Sunrise size={18} />RISE <small>{t("now · preview", "hozir · namuna")}</small></span><h2>{name} · {state.prayers.days[date]?.entries[id].target ?? "15:45"}</h2><p>{prepare ? t("Finish this small step. Make space for what matters.", "Shu kichik qadamni yakunlang. Muhim narsaga vaqt ajrating.") : t("Your work will be here when you return.", "Qaytganingizda ishingiz shu yerda bo‘ladi.")}</p></div>}
    <Button className="wide" disabled={paused} onClick={() => { dispatch({ kind: "work.begin", prayer: id, date }); open({ type: "workBreak" }); }}><Pause size={18} />{t("Save & step away", "Saqlash va tanaffus")}</Button>
    <Button variant="ghost" className="wide" onClick={back}>{t("Back to what I was doing", "Oldingi ishimga qaytish")}</Button>
  </div>;
}

const readinessNames: Record<Readiness, [string, string]> = {
  ready: ["Ready in this preview", "Bu namunada tayyor"],
  permission: ["Alarm permission needed", "Signal uchun ruxsat kerak"],
  coverage: ["More prayer times needed", "Keyingi namoz vaqtlari kerak"],
  waiting: ["Waiting for iPhone", "iPhone tasdig‘i kutilmoqda"],
};
export function AlarmReadiness() {
  const { state } = useApp();
  return state.mode === "demo" ? <DemoAlarmReadiness /> : <LiveAlarmReadiness />;
}
function DemoAlarmReadiness() {
  const t = useText();
  const { state, dispatch, open } = useApp(), date = preparationDate(state);
  const status = state.life.readiness, times = alarmTimes(state, date), paused = !!activePause(state);
  const coverage = Object.keys(state.prayers.days).filter((d) => d >= date).sort();
  const descriptions: Record<Readiness, [string, string]> = {
    ready: [t("Your sample alarm and timetable are in place. This browser will not ring."), "Namunaviy signal va jadval tayyor. Bu brauzer signal chalmaydi."],
    permission: [t("A real iPhone app would ask for alarm permission here. Try the allowed state below."), "Haqiqiy iPhone ilovasi shu yerda signal uchun ruxsat so‘raydi. Quyida ruxsat berilgan holatni sinang."],
    coverage: [t("There are no future times in this example. RISE would ask you to refresh the timetable."), "Bu misolda keyingi kunlar vaqti yo‘q. RISE jadvalni yangilashni so‘raydi."],
    waiting: [t("This change is saved here. The example iPhone hasn’t confirmed it yet."), "O‘zgarish shu yerda saqlandi. Namunaviy iPhone uni hali tasdiqlamadi."],
  };
  return <div className="life-screen">
    <PreviewLabel>{t("Device simulation · no alarm is scheduled", "Qurilma namunasi · signal o‘rnatilmagan")}</PreviewLabel>
    <LifeIntro title={t("Know before you sleep.", "Uxlashdan oldin tekshiring.")}
      text={t("A setting is a wish. A confirmed alarm is a plan.", "Sozlama — niyat. Tasdiqlangan signal — reja.")} />
    <div className={`readiness-status ${status}`}>
      {paused ? <Moon size={30} /> : status === "ready" ? <ShieldCheck size={30} /> : status === "waiting" ? <Smartphone size={30} /> : <CircleAlert size={30} />}
      <h2>{paused ? t("Prayer alarms paused", "Namoz signallari to‘xtatilgan") : t(...readinessNames[status])}</h2>
      <p>{paused ? t("Your private pause keeps prayer reminders quiet. Resume whenever you’re ready.", "Shaxsiy tanaffusda namoz eslatmalari o‘chiriladi. Tayyor bo‘lganda davom eting.") : t(...descriptions[status])}</p>
    </div>
    <dl className="life-facts">
      <div><dt>{t("Device", "Qurilma")}</dt><dd>{t("My iPhone · simulated", "Mening iPhone’im · namuna")}</dd></div>
      <div><dt>{t("Next wake-up", "Keyingi uyg‘onish")}</dt><dd>{paused || status !== "ready" ? "—" : times?.wake ?? "—"}</dd></div>
      <div><dt>{t("Backup", "Zaxira signal")}</dt><dd>{paused || !state.life.backupEnabled || status !== "ready" ? t("Off", "O‘chiq") : times?.backup ?? "—"}</dd></div>
      <div><dt>{t("Sample coverage", "Namunaviy qamrov")}</dt><dd>{status === "ready" && !paused && coverage.length ? `${t.shortDate(coverage[0])} — ${t.shortDate(coverage.at(-1)!)}` : t("Not confirmed", "Tasdiqlanmagan")}</dd></div>
    </dl>
    {!times && <Button variant="secondary" className="wide" onClick={() => open({ type: "prayerSetup" })}>{t("Set up sample prayer times", "Namunaviy namoz vaqtlarini sozlash")}</Button>}
    <label className="field">{t("Preview device state", "Qurilma holatini ko‘rish")}<select aria-label={t("Preview device state", "Qurilma holatini ko‘rish")} value={status} onChange={(e) => dispatch({ kind: "readiness.preview", readiness: e.target.value as Readiness })}>
      {(Object.keys(readinessNames) as Readiness[]).map((key) => <option value={key} key={key}>{t(...readinessNames[key])}</option>)}</select></label>
    {status !== "ready" && <Button className="wide" onClick={() => dispatch({ kind: "readiness.preview", readiness: "ready" })}>{status === "waiting" ? t("Simulate iPhone confirmation", "iPhone tasdig‘ini sinash") : status === "permission" ? t("Simulate permission allowed", "Ruxsat berilgan holatni sinash") : t("Simulate timetable refreshed", "Jadval yangilanishini sinash")}</Button>}
    <Button variant="secondary" className="wide" onClick={() => open({ type: paused ? "period" : "fajr" })}>{paused ? t("Manage private pause", "Shaxsiy tanaffusni boshqarish") : t("Open my Fajr plan", "Bomdod rejamni ochish")}<ChevronRight size={18} /></Button>
  </div>;
}

export function PeriodMode() {
  const t = useText();
  const l = useLiveText();
  const prayerOptions = PRAYERS.map((item) => ({ ...item, name: t(item.name) }));
  const { state, dispatch, toast, back } = useApp(), now = usePrayerClock(), current = activePause(state);
  const [draft, setDraft, clear] = useLifeDraft("prayer-pause", () => ({ ...pausePoint(state, now), includeCurrent: true }));
  const affected = prayerOptions.filter(({ id }, i) => i >= prayerOptions.findIndex((p) => p.id === draft.prayer) && !state.prayers.days[draft.date]?.entries[id].check);
  return <div className="life-screen prayer-pause">
    <PrivacyNote>{t("Only you can see this. Never included in squad updates or family views.", "Buni faqat siz ko‘rasiz. Guruh yangiliklari va oilaviy sahifalarda ko‘rsatilmaydi.")}</PrivacyNote>
    <div className="period-art"><Moon size={45} strokeWidth={1.3} /></div>
    <LifeIntro title={current ? t("Your rhythm can rest.", "Kun tartibingiz dam olishi mumkin.") : t("Make room for a pause.", "Tanaffus uchun joy ajrating.")}
      text={t("Period mode pauses prayer tracking and reminder previews. Your habits, goals, and family plans are still here.", "Hayz davri rejimi namoz qaydlari va eslatma namunalarini to‘xtatadi. Odatlar, maqsadlar va oilaviy rejalar saqlanadi.")} />
    {current && <div className="period-active"><Pause size={18} /><span>{t("Prayer tracking is paused", "Namoz qaydlari to‘xtatilgan")}<small>{t("Since", "Boshlangan sana")}: {t.date(current.from.slice(0, 10))}</small></span></div>}
    <div className="life-two-fields">
      <label className="field">{t("Date", "Sana")}<input type="date" value={draft.date} max={now.date} min={current?.from.slice(0, 10) ?? state.prayers.started} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="field">{current ? t("Resume from", "Davom etish namozi") : t("Pause from", "Tanaffus boshlanishi")}<select aria-label={current ? t("Resume from", "Davom etish namozi") : t("Pause from", "Tanaffus boshlanishi")} value={draft.prayer} onChange={(e) => setDraft({ ...draft, prayer: e.target.value as typeof draft.prayer })}>{prayerOptions.map(({ id, name }) => <option value={id} key={id} disabled={!!current && prayerKey(draft.date, id) < current.from}>{name}</option>)}</select></label>
    </div>
    {current ? <label className="check-choice"><input type="checkbox" checked={draft.includeCurrent} onChange={(e) => setDraft({ ...draft, includeCurrent: e.target.checked })} /><span>{t("Include this prayer when I resume", "Davom etganda shu namozni ham kiriting")}</span></label> :
      <div className="pause-affected"><h2>{t("What changes", "Nima o‘zgaradi")}</h2><p>{affected.length ? affected.map((p) => p.name).join(" · ") : t("Existing records stay unchanged.", "Mavjud qaydlar o‘zgarmaydi.")}</p><small>{t("These unrecorded prayers and future prayers will be paused until you resume.", "Shu qayd qilinmagan va keyingi namozlar davom etguningizcha to‘xtatiladi.")}</small></div>}
    <ul className="life-rules"><li>{t("Paused prayers are neither completed nor missed.", "To‘xtatilgan namozlar bajarilgan yoki qoldirilgan hisoblanmaydi.")}</li><li>{t("Your streak holds its place. It doesn’t grow during a pause.", "Ketma-ketlik saqlanadi. Tanaffusda u oshmaydi.")}</li><li>{t("No cycle prediction, reason, or health details needed.", "Davr bashorati, sabab yoki sog‘liq ma’lumotlari kerak emas.")}</li></ul>
    <Button className="wide" disabled={!draft.date || draft.date < state.prayers.started || draft.date > now.date || (!!current && prayerKey(draft.date, draft.prayer) < current.from)} onClick={() => {
      dispatch(current ? { kind: "prayer.resume", date: draft.date, prayer: draft.prayer, includeCurrent: draft.includeCurrent } : { kind: "prayer.pause", pauseId: crypto.randomUUID(), date: draft.date, prayer: draft.prayer });
      clear(); toast(current ? t("Prayer tracking resumed.", "Namoz qaydlari davom ettirildi.") : t("Your prayer tracking is privately paused.", "Namoz qaydlari shaxsiy to‘xtatildi.")); back();
    }}>{current ? <Sunrise size={18} /> : <Pause size={18} />}{current ? t("Resume prayer tracking", "Namoz qaydlarini davom ettirish") : t("Pause prayer tracking", "Namoz qaydlarini to‘xtatish")}</Button>
    <p className="fine-print">{state.mode === "demo" ? t("This prototype changes local tracking only. No device alarm is affected.", "Bu prototip faqat mahalliy qaydlarni o‘zgartiradi. Qurilma signaliga ta’sir qilmaydi.") : l("RISE cancels prayer and Fajr alerts during your pause. Check delivery status to confirm the phone has updated.", "Tanaffus paytida RISE namoz va bomdod signallarini bekor qiladi. Telefon yangilanganini holat sahifasida tekshiring.", "На время паузы RISE отменяет уведомления молитв и Фаджра. Проверьте статус доставки, чтобы убедиться, что телефон обновлён.")}</p>
  </div>;
}

export function FajrPlanPreview() {
  const t = useText();
  const l = useLiveText();
  const { state, dispatch, open, toast, close, setTab, storage } = useApp();
  const [fallbackDate] = useState(() => preparationDate(state));
  const [plan, setDraft, clear] = useLifeDraft<FajrPlan & { date?: string; backupEnabled: boolean }>("fajr-plan", () => {
    const initial = state.prayers.prepared[fallbackDate] ?? state.prayers.fajr;
    return { ...initial, date: fallbackDate, backupEnabled: initial.backupEnabled ?? state.life.backupEnabled };
  });
  const date = plan.date ?? fallbackDate;
  const setPlan = (next: typeof plan) => setDraft({ ...next, date });
  const saved = state.prayers.prepared[date];
  const isSaved = storage.getSnapshot().status === "saved" && !!saved && (["bedtime", "wakeLead", "backupMinutes", "message", "placement", "enabled"] as const).every((key) => saved[key] === plan[key]) && (saved.backupEnabled ?? state.life.backupEnabled) === plan.backupEnabled;
  const dateLabel = state.life.language === "uz" ? date.split("-").reverse().join(".") :
    t.date(date, { weekday: "long", month: t.language === "ru" ? "long" : "short", day: "numeric" });
  const prayer = getPrayerDay(state, date)?.entries.fajr;
  const wake = alarmTimes(state, date, plan)?.wake ?? "—";
  const save = () => {
    const { date: plannedDate = date, backupEnabled, ...fajr } = plan;
    dispatch({ kind: "fajr.plan", date: plannedDate, plan: fajr, backupEnabled });
    clear(); toast(state.mode === "demo" ? t("Fajr plan saved. Alarm delivery is a preview.", "Bomdod rejasi saqlandi. Signal faqat namuna.") : l("Fajr plan saved. Check delivery status before you sleep.", "Bomdod rejasi saqlandi. Uxlashdan oldin yetkazilish holatini tekshiring.", "План Фаджра сохранён. Проверьте доставку перед сном."));
  };
  return <div className="life-screen fajr-planning">
    {state.mode === "demo" ? <PreviewLabel>{t("Fajr plan · no real alarm delivery", "Bomdod rejasi · haqiqiy signal chalinmaydi")}</PreviewLabel> : <DeliverySummary />}
    <LifeIntro title={date <= today(state) ? t("Make waking a little easier.", "Uyg‘onishni biroz osonlashtiring.") : t("Tomorrow starts tonight.", "Ertangi kun bugun kechadan boshlanadi.")}
      text={t("Fajr plan for {0}.", "{0} uchun bomdod rejasi.", [dateLabel])} />
    <div className="fajr-preview-times"><div><Sunrise size={22} /><span>{t("Fajr begins", "Bomdod boshlanishi")}</span><strong>{prayer?.begins ?? "—"}</strong></div><ArrowRight size={20} /><div><AlarmClock size={22} /><span>{t("Your wake-up", "Uyg‘onish vaqtingiz")}</span><strong>{wake}</strong></div></div>
    {!prayer && <Button variant="secondary" className="wide" onClick={() => open({ type: "prayerSetup" })}>{state.mode === "demo" ? t("Set up sample prayer times", "Namunaviy namoz vaqtlarini sozlash") : t("Prayer times", "Namoz vaqtlari")}</Button>}
    {state.mode !== "demo" && <GroupRow icon={<AlarmClock size={20} />} title={l("Fajr wake-up alerts", "Bomdod uyg‘onish signali", "Сигналы пробуждения на Фаджр")} end={<Toggle label={l("Fajr wake-up alerts", "Bomdod uyg‘onish signali", "Сигналы пробуждения на Фаджр")} checked={plan.enabled} onChange={() => setPlan({ ...plan, enabled: !plan.enabled })} />} />}
    <label className="field">{t("Begin winding down at", "Uyquga tayyorlanish vaqti")}<input type="time" value={plan.bedtime} onChange={(e) => setPlan({ ...plan, bedtime: e.target.value })} /></label>
    <label className="field">{t("Wake before Fajr", "Bomdoddan oldin uyg‘onish")}<select aria-label={t("Wake before Fajr", "Bomdoddan oldin uyg‘onish")} value={plan.wakeLead} onChange={(e) => setPlan({ ...plan, wakeLead: Number(e.target.value) })}>{[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{t("{0} minutes", "{0} daqiqa", [n])}</option>)}</select></label>
    <GroupRow icon={<Bell size={20} />} title={t("A backup wake-up", "Zaxira uyg‘onish signali")} detail={t("One more cue, if you need it", "Kerak bo‘lsa, yana bir eslatma")} end={<Toggle label={t("Enable backup alarm", "Zaxira signalini yoqish")} checked={plan.backupEnabled} onChange={() => setPlan({ ...plan, backupEnabled: !plan.backupEnabled })} />} />
    {plan.backupEnabled && <label className="field">{t("Backup interval", "Zaxira signal oralig‘i")}<select aria-label={t("Backup interval", "Zaxira signal oralig‘i")} value={state.mode !== "demo" && deliveryPlatform === "android" ? Math.max(10, plan.backupMinutes) : plan.backupMinutes || 3} onChange={(e) => setPlan({ ...plan, backupMinutes: Number(e.target.value) })}>{(state.mode !== "demo" && deliveryPlatform === "android" ? [10, 15, 20] : [3, 5, 10]).map((n) => <option key={n} value={n}>{t("{0} minutes later", "{0} daqiqadan keyin", [n])}</option>)}</select></label>}
    <label className="field">{t("Where your phone will be", "Telefoningiz qayerda bo‘ladi")}<select aria-label={t("Where your phone will be", "Telefoningiz qayerda bo‘ladi")} value={plan.placement} onChange={(e) => setPlan({ ...plan, placement: e.target.value as "away" | "bedside" })}><option value="away">{t("Across the room", "Xonaning narigi tomonida")}</option><option value="bedside">{t("Beside the bed", "Yotoq yonida")}</option></select></label>
    <label className="field">{t("A message from your evening self", "Kechki o‘zingizdan xabar")}<textarea rows={3} maxLength={160} value={plan.message} onChange={(e) => setPlan({ ...plan, message: e.target.value })} /></label>
    <Button className="wide" disabled={!plan.bedtime} onClick={save}>{t("Save my Fajr plan", "Bomdod rejamni saqlash")}</Button>
    {isSaved && <p className="life-success" role="status"><Check size={17} />{t("Plan saved on this device.", "Reja shu qurilmada saqlandi.")}</p>}
    <Button variant="secondary" className="wide" disabled={!prayer || !plan.bedtime} onClick={() => { save(); if (state.mode === "demo") dispatch({ kind: "fajr.alarm", alarm: { date, stage: "ringing", backup: false } }); open({ type: "wake", date }); }}>{t("Save & preview wake-up", "Saqlash va uyg‘onish namunasini ko‘rish")}<ArrowRight size={18} /></Button>
    <button className="text-button" onClick={() => open({ type: "readiness" })}>{t("Check alarm readiness", "Signal tayyorligini tekshirish")}<ChevronRight size={16} /></button>
    {isSaved && <Button variant="ghost" className="wide" onClick={() => { close(); setTab("today"); }}>{t("Back to Today", "Bugunga qaytish")}<ChevronRight size={18} /></Button>}
  </div>;
}

export function FajrAlarmPreview({ date: requested, live = false }: { date?: string; live?: boolean }) {
  const t = useText();
  const l = useLiveText(), delivery = usePrayerDelivery();
  useEffect(() => () => { if (live) stopAlarmAudio(); }, [live]);
  const { state, dispatch, open, back, close, setTab } = useApp(), now = usePrayerClock();
  const [preview, setPreview] = useState<LifeState["alarm"]>(null);
  const date = requested ?? preparationDate(state), times = alarmTimes(state, date, undefined, live && deliveryPlatform === "android" ? 10 : 0);
  const storedAlarm = live || state.mode === "demo" ? state.life.alarm : preview;
  const alarm = live && state.life.delivery?.acknowledgedFajr.includes(date) ? { date, stage: "awake" as const, backup: false } : storedAlarm?.date === date ? storedAlarm : { date, stage: "ringing" as const, backup: false };
  const backupEnabled = (state.prayers.prepared[date] ?? state.prayers.fajr).backupEnabled ?? state.life.backupEnabled;
  const record = getPrayerDay(state, date)?.entries.fajr.check;
  const phase = prayerPhase(state, date, "fajr", now);
  const recordMessage = record === "on_time" ? t("Fajr recorded on time.", "Bomdod o‘z vaqtida qayd etildi.")
    : record === "later" ? t("Fajr recorded as prayed later.", "Bomdod kechroq o‘qilgan deb qayd etildi.")
    : t("Fajr recorded as missed.", "Bomdod o‘tkazib yuborilgan deb qayd etildi.");
  const paused = isPrayerExcluded(state, date, "fajr");
  const change = (values: Partial<typeof alarm>) => {
    const next = { ...alarm, ...values };
    if (!live && state.mode !== "demo") setPreview(next);
    else dispatch({ kind: "fajr.alarm", alarm: next });
  };
  return <div className="life-screen alarm-preview">
    {!live && <PreviewLabel>{t("Alarm simulation · your device will not ring", "Signal namunasi · qurilmangiz chalinmaydi")}</PreviewLabel>}
    <div className={`alarm-orbit ${alarm.stage === "awake" ? "awake" : ""}`}>{paused ? <Moon size={51} strokeWidth={1.2} /> : alarm.stage === "awake" ? <Footprints size={51} strokeWidth={1.2} /> : <Sunrise size={62} strokeWidth={1.2} />}</div>
    <h1>{paused ? t("Rest in your rhythm.", "O‘z maromingizda dam oling.") : alarm.stage === "awake" ? t("You’re up.", "Uyg‘ondingiz.") : alarm.stage === "stopped" ? t("Alarm stopped.", "Signal to‘xtatildi.") : t("A new beginning.", "Yangi boshlanish.")}</h1>
    {!paused && alarm.stage !== "awake" && <p className="alarm-clock">{(alarm.backup ? times?.backup : times?.wake) ?? "—"}</p>}
    <p className="alarm-message">{paused ? t("Your private pause keeps Fajr alarms quiet.", "Shaxsiy tanaffusda bomdod signali o‘chiriladi.") : alarm.stage === "awake" ? record ? t("Your record is saved. Return to your day when you’re ready.", "Qaydingiz saqlandi. Tayyor bo‘lganda kuningizni davom ettiring.") : phase === "upcoming" ? t("Feet on the floor. Make wudu, then pray when Fajr begins.", "Oyoqlaringizni yerga qo‘ying. Tahorat qiling va vaqti kirganda namoz o‘qing.") : phase === "open" ? t("Make wudu, then pray. Record Fajr when you’re finished.", "Tahorat qiling va namoz o‘qing. Tugatgach, bomdodni qayd eting.") : t("You can add your Fajr record whenever you’re ready.", "Tayyor bo‘lganda bomdod qaydingizni kiriting.") : alarm.backup ? t("One more cue. Stay on your feet.", "Yana bir eslatma. O‘rningizdan turing.") : (state.prayers.prepared[date] ?? state.prayers.fajr).message}</p>
    {times && <p className="muted">{t("Fajr begins", "Bomdod boshlanadi")} {times.begins} · {t.language === "ru" ? t.date(date, { day: "numeric", month: "long", year: "numeric" }) : date}</p>}
    {!paused && alarm.stage !== "awake" && <Button className="wide" onClick={() => live ? delivery.acknowledge(date) : change({ stage: "awake" })}><Footprints size={19} />{t("I’m up", "Uyg‘ondim")}</Button>}
    {!paused && alarm.stage === "ringing" && <Button variant="secondary" className="wide" onClick={() => { if (live) stopAlarmAudio(); change({ stage: "stopped" }); }}>{t("Stop this alarm", "Shu signalni to‘xtatish")}</Button>}
    {!live && !paused && alarm.stage !== "awake" && backupEnabled && !alarm.backup && <Button variant="ghost" className="wide" onClick={() => change({ stage: "ringing", backup: true })}>{t("Preview backup alarm", "Zaxira signalini ko‘rish")}</Button>}
    {!paused && alarm.stage === "awake" && <><p className="alarm-confirmation" role="status"><Check size={17} />{record ? recordMessage : !live && backupEnabled ? t("Backup dismissed in preview. No prayer recorded.", "Namunada zaxira signal bekor qilindi. Namoz qayd etilmadi.") : t("Wake-up acknowledged. No prayer recorded.", "Uyg‘onganingiz tasdiqlandi. Namoz qayd etilmadi.")}</p><Button variant="secondary" className="wide" onClick={() => open({ type: "prayer", prayer: "fajr", date })}>{record ? t("View Fajr record", "Bomdod qaydini ko‘rish") : phase === "upcoming" ? t("View Fajr time", "Bomdod vaqtini ko‘rish") : t("Record Fajr", "Bomdodni qayd etish")}<ChevronRight size={18} /></Button></>}
    {paused && <Button className="wide" onClick={() => open({ type: "period" })}>{t("Manage private pause", "Shaxsiy tanaffusni boshqarish")}</Button>}
    {live && alarm.stage === "awake" && <p className="fine-print">{l("Wake-up acknowledged. Your remaining wake alerts are being cancelled. No prayer was recorded.", "Uyg‘onganingiz tasdiqlandi. Qolgan uyg‘onish signallari bekor qilinmoqda. Namoz qayd etilmadi.", "Пробуждение подтверждено. Оставшиеся сигналы пробуждения отменяются. Молитва не записана.")}</p>}
    <Button variant="ghost" className="wide" onClick={alarm.stage === "awake" ? () => { close(); setTab("today"); } : back}>{alarm.stage === "awake" ? t("Back to Today", "Bugunga qaytish") : live ? t("Close", "Yopish") : t("Close preview", "Namunani yopish")}</Button>
  </div>;
}
