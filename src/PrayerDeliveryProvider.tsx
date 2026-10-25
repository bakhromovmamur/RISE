import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App as NativeApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useApp } from "./context";
import { buildPrayerSchedule, deliveryPreferences, type PrayerAlert } from "./prayerSchedule";
import { clearAccountAlerts,deliverBrowserAlert, deliveryPlatform, emptyDeliveryStatus, nativeDelivery, primeAlarmAudio, requestDeliveryPermission, requestExactDelivery, ringInApp, stopAlarmAudio, syncDelivery, testDelivery, type DeliveryStatus } from "./prayerDelivery";

interface DeliveryContextValue extends DeliveryStatus {
  refresh(): void; enable(): Promise<void>; disable(): void; exactPermission(): Promise<void>; test(): Promise<void>; acknowledge(date: string): void;
}
const DeliveryContext = createContext<DeliveryContextValue>(null!);
export const usePrayerDelivery = () => useContext(DeliveryContext);
// React StrictMode and rapid settings edits share one serialized device queue.
let queue = Promise.resolve();
let generation = 0;
export function PrayerDeliveryProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, open, storage,workspace } = useApp(),scope=workspace?.scope??"guest";
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>()=>{stopAlarmAudio();if(scope!=="guest")void clearAccountAlerts(scope).catch(()=>{});},[scope]);
  const saveStatus = storage.getSnapshot().status;
  const latest = useRef(state); latest.current = state;
  const [status, setStatus] = useState(emptyDeliveryStatus), [revision, bump] = useState(0);
  const key = JSON.stringify([scope,state.mode, state.prayers.days, state.prayers.fajr, state.prayers.prepared, state.prayers.preferences, state.life.delivery, state.life.reminderRules, state.life.pauses, state.life.backupEnabled, state.life.language]);
  const refresh = useCallback(() => { dispatch({ kind: "calendar.refresh", deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); bump(n => n + 1); }, [dispatch]);
  const acknowledge = useCallback((date: string) => { stopAlarmAudio(); dispatch({ kind: "fajr.acknowledge", date }); }, [dispatch]);
  const receive = useCallback((unknown: unknown, awake = false,sourceScope="guest") => {
    if(sourceScope!==currentScope.current)return;
    const event = unknown as PrayerAlert | undefined;
    if (!event || typeof event.at !== "number" || typeof event.key !== "string" || Date.now() > event.expiresAt || Date.now() < event.at - 5000) return;
    // Ignore stale notifications after a pause, a check-in, or a location/plan change.
    const current = buildPrayerSchedule(latest.current, event.at - 1, deliveryPlatform === "android" ? 10 : 0).some(item => item.key === event.key && item.at === event.at);
    if (!current) return;
    if (event.kind === "wake" || event.kind === "backup") {
      if (awake) acknowledge(event.date);
      else {
        dispatch({ kind: "fajr.alarm", alarm: { date: event.date, stage: "ringing", backup: event.kind === "backup" } });
        if (deliveryPreferences(latest.current).sound) ringInApp();
      }
      const language = latest.current.life.language;
      open({ type: "wake", date: event.date, live: true,
        title: language === "ru" ? "Пробуждение на Фаджр" : language === "uz" ? "Bomdodga uyg‘onish" : "Fajr wake-up" });
    } else open({ type: "prayer", prayer: event.prayer, date: event.date });
  }, [acknowledge, open, dispatch]);

  useEffect(() => {
    const mine = ++generation;
    if (saveStatus !== "saved") return;
    setStatus(previous => ({ ...previous, busy: true, confirmed: [], error: "" }));
    queue = queue.catch(() => {}).then(async () => {
      if (mine !== generation) return;
      try {
        const next = await syncDelivery(latest.current, () => mine === generation);
        if (mine === generation) setStatus(next);
      } catch (error) {
        if (mine === generation) setStatus(previous => ({ ...previous, confirmed: [], busy: false, error: error instanceof Error ? error.message : "Unable to confirm alerts. Try again." }));
      }
    });
    return () => { if (mine === generation) generation++; };
  }, [key, revision, saveStatus]);

  useEffect(() => {
    const focus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", focus);
    const timer = setInterval(refresh, 60000);
    const listener = nativeDelivery ? NativeApp.addListener("appStateChange", ({ isActive }) => { if (isActive) refresh(); }) : null;
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", focus); void listener?.then(handle => handle.remove()); };
  }, [refresh]);

  useEffect(() => {
    if (nativeDelivery) {
      const received = LocalNotifications.addListener("localNotificationReceived", notification => { receive(notification.extra?.alert); refresh(); });
      const action = LocalNotifications.addListener("localNotificationActionPerformed", result => { receive(result.notification.extra?.alert, result.actionId === "awake"); refresh(); });
      return () => { void received.then(h => h.remove()); void action.then(h => h.remove()); stopAlarmAudio(); };
    }
    const message = (event: MessageEvent) => { if (event.data?.type === "rise-alert") receive(event.data.alert,false,event.data.scope??"guest"); };
    navigator.serviceWorker?.addEventListener("message", message);
    return () => { navigator.serviceWorker?.removeEventListener("message", message); stopAlarmAudio(); };
  }, [receive, refresh]);

  const webEvents = useMemo(() => nativeDelivery ? [] : buildPrayerSchedule(state, Date.now()), [key, revision]);
  useEffect(() => {
    if (nativeDelivery || !deliveryPreferences(state).enabled || status.permission !== "granted") return;
    let cursor = Date.now(), alive = true;
    const targetScope=scope;
    const timer = setInterval(() => {
      const now = Date.now(), since = Math.max(cursor, now - 60000); cursor = now;
      for (const event of webEvents.filter(item => item.at > since && item.at <= now)) {
        void deliverBrowserAlert(event, latest.current,()=>alive&&currentScope.current===targetScope,targetScope).then(delivered => {
          if (delivered && alive && (event.kind === "wake" || event.kind === "backup")) receive(event,false,targetScope);
        }).catch(error => { if (alive) setStatus(previous => ({ ...previous, error: String(error.message ?? error) })); });
      }
    }, 1000);
    return () => { alive = false; clearInterval(timer); };
  }, [webEvents, status.permission, receive,scope]);

  const enable = async () => {
    primeAlarmAudio(); setStatus(previous => ({ ...previous, busy: true, error: "" }));
    try {
      const permission = await requestDeliveryPermission();
      if (permission === "granted") dispatch({ kind: "delivery.preferences", changes: { enabled: true } });
      setStatus(previous => ({ ...previous, permission, busy: false })); refresh();
    } catch (error) { setStatus(previous => ({ ...previous, busy: false, error: String(error) })); }
  };
  const disable = () => { stopAlarmAudio(); dispatch({ kind: "delivery.preferences", changes: { enabled: false } }); };
  const exactPermission = async () => { try { await requestExactDelivery(); refresh(); } catch (error) { setStatus(previous => ({ ...previous, error: String(error) })); } };
  const test = async () => { try { primeAlarmAudio(); await testDelivery(latest.current); } catch (error) { setStatus(previous => ({ ...previous, error: String(error) })); } };
  return <DeliveryContext.Provider value={{ ...status, refresh, enable, disable, exactPermission, test, acknowledge }}>{children}</DeliveryContext.Provider>;
}
