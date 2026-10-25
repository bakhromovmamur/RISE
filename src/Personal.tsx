import { Help } from "./help/Help";
import { Diagnostics } from "./diagnostics/Diagnostics";
import {HabitDeliverySettings} from "./HabitDeliveryProvider";
import {habitText} from "./habitText";
import { PwaSettings } from "./pwa/Pwa";
import { accountText } from "./auth/text";
import { StorageStatus, StorageSummary } from "./data/StorageNotice";
import { createEmptyState } from "./data/initialState";
import { useEffect, useRef, useState } from "react";
import { exportSnapshot, RawRecoveryDownload } from "./data/BackupScreen";
import { backupText } from "./data/backupMessages";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Download,
  Info,
  Leaf,
  Languages,
  Moon,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useApp } from "./context";
import { useText } from "./LifeUI";
import {
  formatDate,
  milestones,
  today,
  versionAt,
  xpTotal,
  type State,
} from "./model";
import {
  Badge,
  Button,
  GroupRow,
  Pip,
  SectionTitle,
  Toggle,
} from "./components";
export function exportData(state: State) {
  return exportSnapshot({ state, archives: [], revision: 0 }, new AbortController().signal);
}
export function Settings() {
  const t = useText();
  const { state, dispatch, open, toast, storage } = useApp();
  const bt = backupText(state.life.language), exportJob = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false);
  useEffect(() => () => exportJob.current?.abort(), []);
  const download = async () => {
    if (exportJob.current) return;
    const controller = new AbortController(); exportJob.current = controller; setExporting(true); setExportError(false);
    try {
      await exportSnapshot(await storage.snapshot(), controller.signal);
      if (!controller.signal.aborted) toast(t("Your local data export is ready.", "Mahalliy ma’lumotlaringiz eksport qilindi."));
    } catch { if (!controller.signal.aborted) setExportError(true); }
    finally { if (!controller.signal.aborted) { exportJob.current = null; setExporting(false); } }
  };
  const pref = <K extends keyof State["prefs"]>(key: K, value: State["prefs"][K]) =>
    dispatch({ kind: "preferences.set", changes: { [key]: value } });
  const ht=habitText(state.life.language);
  const appearance = state.prefs.appearance === "system" ? t("Following your device", "Qurilmaga mos") : state.prefs.appearance === "dark" ? t("Dark appearance", "Tungi ko‘rinish") : t("Light appearance", "Yorug‘ ko‘rinish");
  return <div className="settings-content">
    <label className="field">{t("Your name", "Ismingiz")}
      <input value={state.name} maxLength={30}
        onChange={(e) => dispatch({ kind: "profile.name", name: e.target.value })}
        onBlur={() => { if (!state.name.trim()) dispatch({ kind: "profile.name", name: "Friend" }); }} />
    </label>
    <div className="group">
      <GroupRow icon={<Languages size={20} />} title={t("Language", "Til")}
        detail={state.life.language === "uz" ? "O‘zbekcha" : state.life.language === "ru" ? "Русский" : "English"}
        onClick={() => open({ type: "language" })} />
      <GroupRow icon={<Sprout size={20} />} title={t("Your habits", "Odatlaringiz")}
        detail={t("{0} active habits", "{0} faol odat", [state.habits.filter((h) => !h.archivedAt).length])}
        onClick={() => open({ type: "manage" })} />
    </div>
    <details className="settings-disclosure">
      <summary><Sun size={20} /><span><strong>{t("Appearance & comfort", "Ko‘rinish va qulaylik")}</strong><small>{appearance}</small></span><ChevronRight size={18} /></summary>
      <div className="appearance-options">
        {([{ key: "system", label: t("System", "Tizim"), Icon: Settings2 }, { key: "light", label: t("Light", "Yorug‘"), Icon: Sun }, { key: "dark", label: t("Dark", "Tungi"), Icon: Moon }] as const).map(({ key, label, Icon }) =>
          <button key={key} aria-pressed={state.prefs.appearance === key} className={state.prefs.appearance === key ? "selected" : ""} onClick={() => pref("appearance", key)}>
            <Icon size={22} />{label}{state.prefs.appearance === key && <Check size={14} />}
          </button>)}
      </div>
      <div className="group">
        <GroupRow title={t("Completion sound", "Bajarish ovozi")} detail={t("A quiet tone when you check in", "Bajarganingizda sokin ovoz")}
          end={<Toggle label={t("Completion sound", "Bajarish ovozi")} checked={state.prefs.sound} onChange={() => pref("sound", !state.prefs.sound)} />} />
        <GroupRow title={t("Haptic feedback", "Tebranish")}
          detail={"vibrate" in navigator ? t("Supported when your browser allows it", "Brauzer ruxsat bersa ishlaydi") : t("Unavailable in this browser; preference is saved", "Bu brauzerda mavjud emas; sozlama saqlanadi")}
          end={<Toggle label={t("Haptic feedback preference", "Tebranish sozlamasi")} checked={state.prefs.haptics} onChange={() => pref("haptics", !state.prefs.haptics)} />} />
        <GroupRow title={t("Reduce motion", "Harakatni kamaytirish")} detail={t("Also respects your device preference", "Qurilma sozlamasini ham hisobga oladi")}
          end={<Toggle label={t("Reduce motion", "Harakatni kamaytirish")} checked={state.prefs.reduceMotion} onChange={() => pref("reduceMotion", !state.prefs.reduceMotion)} />} />
      </div>
    </details>
    <details className="settings-disclosure">
      <summary><Bell size={20} /><span><strong>{t("Habit reminders", "Odat eslatmalari")}</strong><small>{state.prefs.reminders ? (state.mode==="demo"?t("Preference saved · preview only", "Sozlama saqlangan · faqat namuna"):ht("saved")) : t("Off · optional", "O‘chiq · ixtiyoriy")}</small></span><ChevronRight size={18} /></summary>
      <div className="group">
        <GroupRow title={t("Reminder preferences", "Eslatma sozlamalari")}
          detail={state.prefs.reminders ? (state.mode==="demo"?t("Preference saved · preview only", "Sozlama saqlangan · faqat namuna"):ht("saved")) : t("Off · optional", "O‘chiq · ixtiyoriy")}
          end={<Toggle label={t("Save reminder preference", "Eslatma sozlamasini saqlash")} checked={state.prefs.reminders}
            onChange={() => { pref("reminders", !state.prefs.reminders); if (!state.prefs.reminders) open({ type: "reminder" }); }} />} />
        <GroupRow title={t("Preview a reminder", "Eslatma namunasini ko‘rish")} detail={t("See how a gentle nudge would look", "Muloyim eslatma qanday ko‘rinishini ko‘ring")}
          onClick={() => open({ type: "reminder" })} />
        <div className="quiet-hours">
          <span>{t("Quiet hours", "Sokin vaqt")}</span>
          <label><span className="sr-only">{t("Quiet hours start", "Sokin vaqt boshlanishi")}</span><input type="time" value={state.prefs.quietStart} onChange={(e) => pref("quietStart", e.target.value)} /></label>
          <span>{t("to", "—")}</span>
          <label><span className="sr-only">{t("Quiet hours end", "Sokin vaqt tugashi")}</span><input type="time" value={state.prefs.quietEnd} onChange={(e) => pref("quietEnd", e.target.value)} /></label>
        </div>
      </div>
      <HabitDeliverySettings />
      <p className="fine-print">{state.mode!=="demo"?ht("help"):t("This prototype saves preferences and previews reminders. It does not deliver notifications. Prayer reminders are in Prayer preferences.", "Bu prototip sozlamalarni saqlaydi va eslatmalarni ko‘rsatadi. Bildirishnoma yubormaydi. Namoz eslatmalari Namoz sozlamalarida.")}</p>
    </details>
    <details className="settings-disclosure">
      <summary><ShieldCheck size={20} /><span><strong>{t("Your data", "Ma’lumotlaringiz")}</strong><small>{t("Export or clear this browser", "Eksport qilish yoki brauzerni tozalash")}</small></span><ChevronRight size={18} /></summary>
      <p className="fine-print">{bt("warning")}</p>
      <p className="fine-print">{bt("supported")}</p>
      <div className="group">
        <GroupRow icon={<Download size={20} />} title={t("Export local data", "Mahalliy ma’lumotlarni eksport qilish")} detail={t("Keep a copy of everything saved here", "Bu yerda saqlangan barcha ma’lumotlardan nusxa olish")}
          onClick={() => void download()} />
        <GroupRow icon={<Upload size={20} />} title={bt("title")} onClick={() => open({ type: "backup" })} />
        <GroupRow icon={<Trash2 size={20} />} title={t("Clear local data", "Mahalliy ma’lumotlarni tozalash")} detail={t("Start again on this browser", "Bu brauzerda boshidan boshlash")}
          onClick={() => open({ type: "clear" })} />
        <GroupRow title={t("Timezone", "Vaqt mintaqasi")} detail={`${state.timezone}${state.mode === "demo" ? t(" · demo calendar", " · namuna taqvimi") : ""}`} />
        <GroupRow icon={<ShieldCheck size={20} />} title={accountText(state.life.language)("account")} detail={accountText(state.life.language)("entry")} onClick={() => open({ type: "account" })} />
      </div>
      {exporting && <><p role="status" className="fine-print">{bt("exporting")}</p><Button variant="ghost" onClick={() => { exportJob.current?.abort(); exportJob.current = null; setExporting(false); }}>{bt("cancel")}</Button></>}
      {exportError && <><p role="alert" className="form-error">{bt("exportFailed")}</p><RawRecoveryDownload /></>}
      <Diagnostics />
      <StorageStatus session={storage} visible />
      <StorageSummary session={storage} />
      <p className="fine-print">{state.mode === "demo" ? t("Demo date: {0}. Only reviewer controls change it.", "Namuna sanasi: {1}. Uni faqat ko‘rib chiqish boshqaruvlari o‘zgartiradi.", [t.date(state.demoDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" }), state.demoDate]) : t("Fresh Start follows your device timezone and real local date.", "Yangi boshlanish qurilmaning vaqt mintaqasi va haqiqiy sanasiga moslashadi.")}</p>
      <p className="fine-print">{t("Stored only in this browser. Clearing browser storage removes it. Export a copy whenever you like.", "Faqat shu brauzerda saqlanadi. Brauzer xotirasi tozalansa, ma’lumotlar o‘chadi. Istalgan payt nusxa oling.")}</p>
    </details>
    <PwaSettings />
    <Help />
    <p className="screen-footer">{t("RISE · ")}{state.mode === "demo" ? t("Local prototype", "Mahalliy prototip") : t("Mobile web app")}</p>
  </div>;
}
export function ReminderPreview() {
  const t = useText();
  const { state, back } = useApp();
  const h = state.habits.find((h) => !h.archivedAt),
    v = h ? versionAt(h, today(state)) : null;
  return (
    <div className="reminder-preview">
      <span className="confirmation-icon">
        <Bell size={29} />
      </span>
      <h1>{t("A nudge, never a nag.")}</h1>
      <p>
        {state.mode==="demo"?t("Here’s a preview of a reminder. No device notification has been scheduled. "):habitText(state.life.language)("preview")}</p>
      <div className="notification">
        <span className="notification-logo">
          <Sprout size={22} />
        </span>
        <div>
          <div>
            <strong>RISE</strong>
            <small>{v?.reminder || t("Your preferred time")}</small>
          </div>
          <h3>{t("A little room for ")}{h?.name || t("yourself")}?</h3>
          <p>
            {v?.tiny
              ? t("Your tiny version is always an option.")
              : t("One small step, whenever it fits.")}
          </p>
        </div>
      </div>
      <p className="fine-print">
        {t("Saved preference: ")}{t(state.prefs.reminders ? "enabled" : "disabled")}{t(". Quiet hours: ")}{state.prefs.quietStart}–{state.prefs.quietEnd}{state.mode==="demo"?t(". Actual notification delivery is unavailable in this prototype. "):""}</p>
      <Button className="wide" onClick={back}>
        {t("Sounds like me ")}</Button>
    </div>
  );
}
export function ClearData() {
  const t = useText();
  const { state, clearLocalData, close, toast } = useApp();
  const [clearing, setClearing] = useState(false);
  return (
    <div className="confirmation">
      <span className="confirmation-icon">
        <Trash2 size={28} />
      </span>
      <h1>{t("A fresh page?")}</h1>
      <p>
        {t("This removes your habits, check-ins, prayer records, Fajr plans, saved work notes, goals, rewards, daily priorities, reflections, preferences, and any timer from this browser. Export first if you want to keep them. ")}</p>
      <Button
        variant="danger"
        className="wide"
        disabled={clearing}
        onClick={async () => {
          setClearing(true);
          const fresh = createEmptyState(); fresh.life.language = state.life.language; fresh.prayers.fajr.message = t(fresh.prayers.fajr.message);
          const cleared = await clearLocalData(fresh);
          setClearing(false);
          if (!cleared) return;
          close();
          toast("Local data cleared. A fresh page is ready.");
        }}
      >
        {t("Clear local data ")}</Button>
      <Button variant="ghost" className="wide" onClick={close}>
        {t("Keep my progress ")}</Button>
    </div>
  );
}
export function Milestone({
  xp,
  celebrate = false,
}: {
  xp: number;
  celebrate?: boolean;
}) {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, dispatch, toast, back } = useApp();
  const m = pipMilestones.find((m) => m.xp === xp)!;
  const total = xpTotal(state),
    eligible = total >= xp,
    claimed = state.claimed.includes(xp);
  const equipped =
    xp === 250
      ? state.equipped === 250
      : xp === 800
        ? state.prefs.golden
        : claimed;
  const claim = () => {
    if (!dispatch({ kind: "collection.claim", xp })) return;
    toast(
      xp === 250
        ? t("Pip’s linen scarf is on. A little warmth, earned.")
        : t("Your reward is in your collection. No extra XP added."),
    );
  };
  return (
    <div className="milestone-detail">
      {celebrate && (
        <div className="celebration-particles" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      )}
      <div className="milestone-art">
        {xp === 250 ? (
          <Pip size={220} mood={eligible ? "scarf" : "welcome"} />
        ) : (
          <Badge xp={xp} size={112} />
        )}
      </div>
      <span className={`milestone-state ${eligible ? "eligible" : ""}`}>
        {claimed
          ? t("A little thing, earned")
          : eligible
            ? t("New milestone unlocked")
            : t("A little further along")}
      </span>
      <h1>{m.name}</h1>
      <p>{m.description}</p>
      <div className="reward-description">
        <GiftIcon />
        <span>
          <strong>{m.reward}</strong>
          <small>{t.number(xp)} {t(" lifetime XP")}</small>
        </span>
        {claimed && <Check size={20} />}
      </div>
      <p className="milestone-progress">
        {t.number(total)} / {t.number(xp)} XP
        {!eligible && t(" · {0} to go", undefined, [xp - total])}
      </p>
      {eligible ? (
        <Button className="wide" onClick={claimed && equipped ? back : claim}>
          {claimed && equipped
            ? t("Lovely, let’s keep going")
            : xp === 250
              ? t("Claim & dress Pip")
              : xp === 800
                ? t("Use golden-hour background")
                : t("Claim reward")}
          <ArrowRight size={18} />
        </Button>
      ) : (
        <Button variant="secondary" className="wide" onClick={back}>
          {t("Back to the trail ")}</Button>
      )}
      <p className="fine-print">
        {t("Cosmetics celebrate logged effort. Claiming adds no XP. Missing a day keeps earned rewards; undoing a check-in recalculates eligibility. ")}</p>
    </div>
  );
}
function GiftIcon() {
  return (
    <span className="gift-icon">
      <Sparkles size={24} />
    </span>
  );
}
export function Collection() {
  const t = useText();
  const pipMilestones = milestones.map((item) => ({ ...item, name: t(item.name), reward: t(item.reward), description: t(item.description) }));
  const { state, dispatch, open, toast } = useApp();
  const xp = xpTotal(state);
  return (
    <>
      <div
        className={`collection-preview ${state.prefs.golden ? "golden" : ""}`}
      >
        <Pip mood={state.equipped === 250 ? "scarf" : "welcome"} size={220} />
      </div>
      <SectionTitle title={t("Pip’s wardrobe")} />
      <div className="accessories">
        <button
          className={state.equipped === null ? "selected" : ""}
          onClick={() => {
            dispatch({ kind: "collection.equip", xp: null });
            toast("Pip is back to the original look.");
          }}
        >
          <Pip size={105} />
          <strong>{t("Just Pip")}</strong>
          <span>{state.equipped === null ? t("Equipped") : t("Always yours")}</span>
        </button>
        <button
          className={state.equipped === 250 ? "selected" : ""}
          onClick={() => {
            if (xp >= 250 && state.claimed.includes(250)) {
              dispatch({ kind: "collection.equip", xp: 250 });
              toast("Linen scarf equipped.");
            } else open({ type: "milestone", xp: 250 });
          }}
        >
          <Pip mood="scarf" size={105} />
          <strong>{t("Linen scarf")}</strong>
          <span>
            {state.equipped === 250
              ? t("Equipped")
              : xp >= 250
                ? t("Unlocked · 250 XP")
                : t("Locked · 250 XP")}
          </span>
        </button>
      </div>
      <SectionTitle title={t("Your world")} />
      <div className="group">
        <GroupRow
          icon={<Leaf size={21} />}
          title={t("Porcelain meadow")}
          detail={t("Your original background")}
          onClick={() =>
            dispatch({ kind: "preferences.set", changes: { golden: false } })
          }
          end={!state.prefs.golden ? <Check size={18} /> : undefined}
        />
        <GroupRow
          icon={<Sun size={21} />}
          title={t("Golden hour")}
          detail={xp >= 800 ? t("Unlocked at 800 XP") : t("800 XP · a warmer light")}
          onClick={() => {
            if (state.claimed.includes(800) && xp >= 800)
              dispatch({ kind: "preferences.set", changes: { golden: true } });
            else open({ type: "milestone", xp: 800 });
          }}
          end={state.prefs.golden ? <Check size={18} /> : undefined}
        />
      </div>
      <SectionTitle title={t("Your keepsakes")} />
      <div className="collection-badges">
        {pipMilestones
          .filter((m) => m.xp !== 250 && m.xp !== 800)
          .map((m) => (
            <button
              key={m.xp}
              className={xp < m.xp ? "locked" : ""}
              onClick={() => open({ type: "milestone", xp: m.xp })}
            >
              <Badge xp={m.xp} />
              <strong>{m.reward}</strong>
              <span>
                {state.claimed.includes(m.xp)
                  ? t("In your collection")
                  : t("{0} XP", undefined, [m.xp])}
              </span>
            </button>
          ))}
      </div>
    </>
  );
}
