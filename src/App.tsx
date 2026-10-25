import {BackgroundNotifications} from './push/PushSettings';
import {HabitDeliveryProvider} from "./HabitDeliveryProvider";
import {PushRenewalProvider} from "./push/PushRenewal";
import {GroupProvider} from './groups/GroupProvider';
import {groupText} from './groups/text';
import { PwaNotice, usePwa } from "./pwa/Pwa";
import { Account } from "./auth/Account";
import type { JourneySession } from "./data/journeySession";
import type { WorkspaceSession } from "./sync/workspace";
import { AccountDataBoundary } from "./sync/AccountSync";
import { StorageRecovery, StorageStatus } from "./data/StorageNotice";
import type { ReviewSupport } from "./review/types";
import { LocaleContext } from "./LifeUI";
import { createTranslator } from "./i18n";
import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  Check,
  CircleHelp,
  Compass,
  Home,
  Leaf,
  Monitor,
  Settings2,
  Sparkles,
  Sprout,
  UserRound,
  X,
} from "lucide-react";
import { AppContext, type Screen, type Tab } from "./context";
import { BackupScreen } from "./data/BackupScreen";
import {
  formatDate,
  milestones,
  today,
  xpTotal,
  type Check as CheckType,
} from "./model";
import { Button, Pip, Sheet } from "./components";
import { Today as HabitToday } from "./Today";
import { Journey, HabitProgress } from "./Explore";
import { You, PrayerPreferences } from "./You";
import { BalancedToday, BalancedProgress } from "./Balanced";
import { GoalDetail, GoalForm, HabitCorrection, PersonalRewards, PriorityPicker, RewardDetail, RewardForm } from "./Development";
import { type ProgressView } from "./developmentModel";
import { SalahToday, PrayerDetail, PrayerTimetable, FajrPreparation, WakePreview, WorkBreakFlow, PrayerRules } from "./Prayers";
import {
  ArchiveConfirm,
  FocusTimer,
  HabitDetail,
  HabitForm,
  ManageHabits,
} from "./Habits";
import {
  ClearData,
  Collection,
  Milestone,
  ReminderPreview,
  Settings,
} from "./Personal";
import { History, Reflection, StreakInfo } from "./Review";
import { Onboarding } from "./Onboarding";
import { copy } from "./copy";
import { PrayerDeliveryProvider } from "./PrayerDeliveryProvider";
import { AlarmReadiness, FajrAlarmPreview, FajrPlanPreview, LanguagePicker, PeriodMode, PrayerNudge, PrayerReminderSettings, PrayerSetup } from "./Life";
import {DeferredGroupScreen} from './groups/DeferredGroupScreen';
const nav = [
  { id: "today", Icon: Home },
  { id: "journey", Icon: Compass },
  { id: "progress", Icon: BarChart3 },
  { id: "you", Icon: UserRound },
] as const;
const titles: Record<Screen["type"], string> = {
  detail: "Your habit",
  edit: "Your small commitment",
  manage: "Manage habits",
  milestone: "A little milestone",
  collection: "Pip’s collection",
  settings: "Settings",
  backup: "Restore a backup",
  account: "Account",
  backgroundNotifications: "Background notifications",
  prayerPreferences: "Prayer preferences",
  reflection: "Weekly reflection",
  history: "Your history",
  streak: "Showing up",
  info: "Good to know",
  timer: "A moment of focus",
  archive: "Archive habit",
  clear: "Clear local data",
  reminder: "Reminder preview",
  prayer: "Your prayer",
  timetable: "Prayer times & reminders",
  fajr: "Prepare for Fajr",
  wake: "Fajr wake-up preview",
  workBreak: "Save & step away",
  prayerRules: "A rhythm you can trust",
  habitsToday: "Your other habits",
  habitProgress: "Habit progress",
  priorities: "Your daily priorities",
  goal: "Your goal",
  goalEdit: "Shape your goal",
  personalRewards: "Personal rewards",
  reward: "Your personal reward",
  rewardEdit: "Choose a reward",
  habitCorrection: "Correct a habit record",
  prayerSetup: "Prayer setup", prayerReminders: "Prayer reminders", prayerNudge: "A moment for prayer",
  readiness: "Alarm readiness", period: "Period mode · private", groups: "Your people",
  group: "Your private space", groupCreate: "Create a group", groupSettings: "Group settings",
  invite: "Invitation preview", groupJoin:"Review invitation", task: "Family task", taskEdit: "Plan a family task",
  sharedList: "Shared list", listCreate: "Create a list", squadCompose: "Share my week", language: "Language",
};
const uzTitles: Partial<Record<Screen["type"], string>> = {
  backup: "Zaxira nusxani tiklash",
  account: "Hisob",
  backgroundNotifications: "Fon bildirishnomalari",
  settings: "Sozlamalar", prayerPreferences: "Namoz sozlamalari",
  prayerSetup: "Namoz sozlamalari", prayerReminders: "Namoz eslatmalari", prayerNudge: "Namoz uchun vaqt",
  readiness: "Signal tayyorligi", period: "Hayz davri · shaxsiy", groups: "Yaqinlaringiz",
  group: "Shaxsiy joyingiz", groupCreate: "Guruh yaratish", groupSettings: "Guruh sozlamalari",
  invite: "Taklif namunasi", task: "Oilaviy vazifa", taskEdit: "Oilaviy vazifani rejalash",
  sharedList: "Umumiy ro‘yxat", listCreate: "Ro‘yxat yaratish", squadCompose: "Haftamni ulashish",
  language: "Til", fajr: "Bomdodga tayyorlanish", wake: "Bomdod signal namunasi",
};
function ScreenBody({ screen }: { screen: Screen }) {
  const { workspace } = useContext(AppContext);
  if(workspace?.scope!==undefined&&workspace.scope!=="guest"&&(screen.type==="backup"||screen.type==="clear"))return<AccountDataBoundary/>;
  switch (screen.type) {
    case "account": return <Account />;
    case "backgroundNotifications": return <BackgroundNotifications/>;
    case "backup": return <BackupScreen />;
    case "prayerPreferences": return <PrayerPreferences />;
    case "prayerSetup": return <PrayerSetup live={screen.live} />;
    case "prayerReminders": return <PrayerReminderSettings />;
    case "prayerNudge": return <PrayerNudge id={screen.prayer} prepare={screen.preview === "prepare"} />;
    case "readiness": return <AlarmReadiness />;
    case "period": return <PeriodMode />;
    case "language": return <LanguagePicker />;
    case "groups": case "group": case "groupCreate": case "groupSettings": case "invite": case "groupJoin":
    case "task": case "taskEdit": case "sharedList": case "listCreate": case "squadCompose":
      return <DeferredGroupScreen screen={screen} />;
    case "priorities":
      return <PriorityPicker date={screen.date!} candidate={screen.groupId&&screen.id&&screen.occurrenceDate?{kind:'task',groupId:screen.groupId,taskId:screen.id,date:screen.occurrenceDate}:undefined} />;
    case "goal":
      return <GoalDetail id={screen.id!} />;
    case "goalEdit":
      return <GoalForm id={screen.id} />;
    case "personalRewards":
      return <PersonalRewards />;
    case "reward":
      return <RewardDetail id={screen.id!} />;
    case "rewardEdit":
      return <RewardForm id={screen.id} />;
    case "habitCorrection":
      return <HabitCorrection id={screen.id!} date={screen.date!} />;
    case "prayer":
      return <PrayerDetail id={screen.prayer!} date={screen.date!} />;
    case "timetable":
      return <PrayerTimetable date={screen.date} />;
    case "fajr":
      return <FajrPlanPreview />;
    case "wake":
      return <FajrAlarmPreview date={screen.date} live={screen.live} />;
    case "workBreak":
      return <WorkBreakFlow />;
    case "prayerRules":
      return <PrayerRules />;
    case "habitsToday":
      return <HabitToday />;
    case "habitProgress":
      return <HabitProgress />;
    case "detail":
      return <HabitDetail id={screen.id!} />;
    case "edit":
      return <HabitForm id={screen.id} />;
    case "manage":
      return <ManageHabits />;
    case "milestone":
      return <Milestone xp={screen.xp!} celebrate={screen.celebrate} />;
    case "collection":
      return <Collection />;
    case "settings":
      return <Settings />;
    case "reflection":
      return <Reflection date={screen.date!} />;
    case "history":
      return <History date={screen.date!} />;
    case "streak":
      return <StreakInfo />;
    case "timer":
      return <FocusTimer id={screen.id!} />;
    case "archive":
      return <ArchiveConfirm id={screen.id!} />;
    case "clear":
      return <ClearData />;
    case "reminder":
      return <ReminderPreview />;
    case "info":
      return (
        <div className="info-content">
          <CircleHelp size={30} />
          <h1>{screen.title}</h1>
          <p>{screen.text}</p>
        </div>
      );
  }
}
export default function App({ review, storage, workspace, invitation }: { review?: ReviewSupport; storage: JourneySession; workspace?:WorkspaceSession;invitation?:string|null }) {
  const pwa = usePwa();
  const view = useSyncExternalStore(storage.subscribe, storage.getSnapshot);
  const state = view.state, setState = storage.setState, dispatch = storage.dispatch;
  const
    [tab, setTab] = useState<Tab>("today"),
    [progressView, setProgressView] = useState<ProgressView>("overview"),
    [tabDestination, setTabDestination] = useState<Tab | null>(null),
    [screens, setScreens] = useState<Screen[]>([]),
    [message, setMessage] = useState(""),
    [systemDark, setSystemDark] = useState(
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  const t = createTranslator(state.life.language);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scope=workspace?.scope??"guest",previousScope=useRef(scope);
  useEffect(()=>{if(previousScope.current!==scope){previousScope.current=scope;setScreens([]);setMessage("");setTab("today");setProgressView("overview");}},[scope]);
  const goToTab = useCallback((destination: Tab) => {
    setTab(destination);
    setTabDestination(destination);
  }, []);
  useEffect(() => {
    if (!tabDestination) return;
    // Explicit shortcuts arrive at the destination's start. Normal tabs keep their place.
    const panel = document.getElementById(`panel-${tabDestination}`);
    panel?.scrollTo({ top: 0, behavior: "instant" });
    panel?.querySelector<HTMLElement>(".tab-heading h1")?.focus({ preventScroll: true });
    setTabDestination(null);
  }, [tabDestination]);
  const toast = useCallback((text: string) => {
    void storage.whenSaved().then(saved => {
      if (!saved) return;
      setMessage(text);
      if (messageTimer.current) clearTimeout(messageTimer.current);
      messageTimer.current = setTimeout(() => setMessage(""), 4500);
    });
  }, [storage]);
  const open = useCallback(
      (screen: Screen) => setScreens((s) => [...s, screen]),
      [],
    ),
    close = useCallback(() => setScreens([]), []),
    back = useCallback(() => setScreens((s) => s.slice(0, -1)), []);
  useEffect(() => {
    document.documentElement.lang = state.life.language;
    document.title = state.life.language === "ru" ? "RISE — день вокруг важного" : "RISE — A complete day, built around salah";
  }, [state.life.language]);
  useEffect(() => {
    // A review-only URL option makes 200% text reproducible without device settings.
    document.documentElement.style.fontSize = review && new URLSearchParams(location.search).get("text") === "large" ? "200%" : "";
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const refresh = () =>
      dispatch({ kind: "calendar.refresh", deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [storage,scope]);
  const log = (id: string, kind: CheckType | null, finishTimer = false) => {
    const next = dispatch(finishTimer ? { kind: "timer.complete", habitId: id, date: today(state) } : { kind: "habit.check", habitId: id, date: today(state), check: kind });
    if (!next) return;
    const before = xpTotal(state),
      after = xpTotal(next);
    if (after === before) return;
    toast(
      kind === null
        ? copy.feedback.undo
        : kind === "tiny"
          ? copy.feedback.tiny
          : after - before === 10
            ? copy.feedback.upgrade
            : copy.feedback.full,
    );
    if (state.prefs.haptics && navigator.vibrate) navigator.vibrate(18);
    if (state.prefs.sound) {
      try {
        const ctx = new AudioContext(),
          osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = kind === null ? 390 : 660;
        gain.gain.setValueAtTime(0.045, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.23);
        osc.onended = () => {
          void ctx.close();
        };
      } catch {
        /* Optional device capability; visual feedback always remains available. */
      }
    }
    const unlocked = milestones.filter((m) => before < m.xp && after >= m.xp);
    if (unlocked.length)
      open({ type: "milestone", xp: unlocked.at(-1)!.xp, celebrate: true });
  };
  const theme =
    state.prefs.appearance === "system"
      ? systemDark
        ? "dark"
        : "light"
      : state.prefs.appearance;
  const reset = (kind: string) => {
    if (!review) return;
    const s = review.createFixture(kind, state.life.language);
    setState(s);
    setTab("today");
    setProgressView("overview");
    close();
    if (kind === "family-planning") setScreens([{ type: "group", id: "family" }]);
    if (kind === "squad-reflection") setScreens([{ type: "group", id: "squad" }]);
    if (kind === "needs-attention") setScreens([{ type: "readiness" }]);
    if (kind === "fajr-morning" || kind === "full-day") setScreens([{ type: "wake", date: s.demoDate }]);
    setMessage("");
  };
  if (view.error) return <StorageRecovery session={storage} />;
  if (review && new URLSearchParams(location.search).has("design"))
    return <LocaleContext.Provider value={state.life.language}><review.Design /></LocaleContext.Provider>;
  const reviewMobile = !!review && new URLSearchParams(location.search).has("review");
  const tabLabel = (id: Tab) => state.life.language === "uz" ? ({ today: "Bugun", journey: "Yo‘l", progress: "Natijalar", you: "Siz" })[id] : t(copy.tabs[id]);
  return (
    <LocaleContext.Provider value={state.life.language}><AppContext.Provider
      value={{ state, setState, dispatch, storage, workspace, clearLocalData: storage.clear, open, close, back, log, toast, setTab: goToTab, progressView, setProgressView }}
    ><GroupProvider invitation={invitation}><PrayerDeliveryProvider><HabitDeliveryProvider><PushRenewalProvider key={scope} workspace={workspace}>
      <div data-storage-status={view.status} className={`workspace ${reviewMobile ? "show-review" : ""} ${review && new URLSearchParams(location.search).get("text") === "large" ? "large-text" : ""}`}>
        <aside className="studio-sidebar">
          <a
            className="studio-wordmark"
            href="./"
            aria-label="RISE"
          >
            <Sprout size={25} />
            rise
          </a>
          <div className="studio-description">
            <h2>
              {t("A complete day. ")}<br />{t("Salah at its heart. ")}</h2>
            <p>
              {t("Five daily anchors, small steps, and meaningful things to work toward. ")}</p>
          </div>
          {review && <review.Controls state={state} reset={reset} setState={setState} />}
          <div className="studio-footnote">
            <span className="live-dot" />
            {review ? t("Local prototype · No account needed ") : ({ en: "Private on this device", ru: "Лично · на этом устройстве", uz: "Shu qurilmada shaxsiy" })[state.life.language]}</div>
        </aside>
        <div className="preview-column">
          <div className="preview-caption">
            <span>{t("RISE / MOBILE EXPERIENCE")}</span>
            <span>{t("A BALANCED DAY")}</span>
          </div>
          <div
            className={`app-shell ${state.prefs.reduceMotion ? "reduce-motion" : ""}`}
            data-theme={theme}
            onClickCapture={event => {
              // WebKit does not focus clicked buttons. Capture the actual opener
              // before its action creates a sheet, without moving the viewport.
              const control = event.target instanceof Element
                ? event.target.closest<HTMLElement>("button,a[href],summary") : null;
              if (control && !control.matches(":disabled") && !control.closest("[hidden],[inert]")) {
                control.focus({ preventScroll: true });
              }
            }}
          >
            <PwaNotice />
            <div
              className="app-main"
              inert={screens.length > 0 || pwa.updating ? true : undefined}
            >
              <StorageStatus session={storage} />
              {state.onboarded ? (
                <>
                  <div className="tab-panels" inert={screens.length > 0}>
                    {nav.map(({ id }) => (
                      <div
                        role="tabpanel"
                        aria-label={tabLabel(id)}
                        aria-labelledby={`tab-${id}`}
                        key={id}
                        hidden={tab !== id}
                        className="tab-panel"
                        id={`panel-${id}`}
                      >
                        {id === "today" ? (
                          <BalancedToday />
                        ) : id === "journey" ? (
                          <Journey />
                        ) : id === "progress" ? (
                          <BalancedProgress />
                        ) : (
                          <You />
                        )}
                      </div>
                    ))}
                  </div>
                  <nav
                    className="tab-bar"
                    inert={screens.length > 0}
                    role="tablist"
                    aria-label={state.life.language === "uz" ? "Asosiy navigatsiya" : t("Main navigation")}
                  >
                    {nav.map(({ id, Icon }) => (
                      <button
                        key={id}
                        role="tab"
                        id={`tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls={`panel-${id}`}
                        className={tab === id ? "active" : ""}
                        tabIndex={tab === id ? 0 : -1}
                        onKeyDown={(e) => {
                          const current = nav.findIndex((n) => n.id === id);
                          let index = current;
                          if (e.key === "ArrowRight") index = (current + 1) % 4;
                          else if (e.key === "ArrowLeft")
                            index = (current + 3) % 4;
                          else if (e.key === "Home") index = 0;
                          else if (e.key === "End") index = 3;
                          else return;
                          e.preventDefault();
                          setTab(nav[index].id);
                          (
                            e.currentTarget.parentElement?.querySelectorAll(
                              "[role=tab]",
                            )[index] as HTMLElement
                          )?.focus();
                        }}
                        onClick={() => setTab(id)}
                      >
                        <span>
                          <Icon size={23} strokeWidth={tab === id ? 2 : 1.7} />
                        </span>
                        <span>{tabLabel(id)}</span>
                      </button>
                    ))}
                  </nav>
                </>
              ) : (
                <Onboarding />
              )}
            </div>
            {screens.map((screen, i) => (
              <div
                hidden={i !== screens.length - 1}
                key={`${i}-${screen.type}-${screen.id ?? ""}`}
              >
                <Sheet
                  active={i === screens.length - 1}
                  title={screen.title ?? (screen.type==='backgroundNotifications'?groupText(state.life.language)('notificationDevice'):screen.type==='groupJoin'?groupText(state.life.language)('joinTitle'):workspace&&screen.type==='invite'?groupText(state.life.language)('invite'):state.life.language === "uz" ? uzTitles[screen.type] ?? t(titles[screen.type]) : t(titles[screen.type]))}
                  closeLabel={state.life.language === "uz" ? "Yopish" : t("Close")}
                  backLabel={state.life.language === "uz" ? "Orqaga" : t("Back")}
                  onClose={back}
                  onBack={i > 0 ? back : undefined}
                  full={[
                    "edit",
                    "manage",
                    "settings",
                    "backup",
                    "reflection",
                    "timer",
                    "timetable",
                    "fajr",
                    "wake",
                    "workBreak",
                    "habitsToday",
                    "habitProgress",
                    "priorities",
                    "goal",
                    "goalEdit",
                    "personalRewards",
                    "reward",
                    "rewardEdit",
                    "prayerPreferences", "prayerSetup", "prayerReminders", "prayerNudge", "readiness", "period",
                    "backgroundNotifications", "groups", "group", "groupCreate", "groupSettings", "invite", "groupJoin", "task", "taskEdit",
                    "sharedList", "listCreate", "squadCompose", "language",
                  ].includes(screen.type)}
                >
                  <ScreenBody screen={screen} />
                </Sheet>
              </div>
            ))}
            <div
              className={`toast ${message ? "visible" : ""}`}
              role="status"
              aria-live="polite"
            >
              {message && (
                <>
                  <span>
                    <Check size={16} />
                  </span>
                  <p>{t(message)}</p>
                  <button
                    aria-label={t("Dismiss message")}
                    onClick={() => setMessage("")}
                  >
                    <X size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="preview-under">
            <span>{t("Make space for what matters.")}</span>
            <Leaf size={14} />
          </div>
        </div>
        <aside className="studio-note">
          <span className="note-line" />
          <p>
            {t("A little focus. ")}<br />
            {t("A fuller life. ")}</p>
          <span>
            {t("Prayer. Progress. ")}<br />
            {t("Room to grow. ")}</span>
          <div className="studio-pip">
            <Pip mood="rest" size={102} />
          </div>
        </aside>
      </div>
    </PushRenewalProvider></HabitDeliveryProvider></PrayerDeliveryProvider></GroupProvider></AppContext.Provider></LocaleContext.Provider>
  );
}
