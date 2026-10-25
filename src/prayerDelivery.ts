import {pushControl,updatePushControl} from './push/store';
import {claimReminder,clearReminderLedger} from "./push/ledger";
import {pushEventKey} from "./push/policy";
import { registerAppWorker } from "./pwa/registration";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { State } from "./model";
import { alertSignature, buildPrayerSchedule, deliveryPreferences, reconcileDeviceAlerts, type PrayerAlert } from "./prayerSchedule";

export const deliveryPlatform = Capacitor.getPlatform();
export const nativeDelivery = Capacitor.isNativePlatform();
export type DeliveryStatus = {
  permission: string; exact: boolean; confirmed: PrayerAlert[]; error: string; busy: boolean;
};
export const emptyDeliveryStatus: DeliveryStatus = { permission: "unknown", exact: false, confirmed: [], error: "", busy: false };
export async function permissionStatus() {
  if (nativeDelivery) return {
    permission: (await LocalNotifications.checkPermissions()).display,
    exact: deliveryPlatform !== "android" || (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted",
  };
  return { permission: typeof Notification === "undefined" || !window.isSecureContext ? "unavailable" : Notification.permission, exact: false };
}
export async function requestDeliveryPermission() {
  if (nativeDelivery) return (await LocalNotifications.requestPermissions()).display;
  if (typeof Notification === "undefined" || !window.isSecureContext) throw new Error("Notifications are unavailable in this browser.");
  // Invoked directly from a button so browsers retain the user gesture.
  return Notification.requestPermission();
}
export async function requestExactDelivery() {
  if (deliveryPlatform === "android") await LocalNotifications.changeExactNotificationSetting();
}

function alertCopy(event: PrayerAlert, s: State) {
  const language = s.life.language;
  const names = language === "ru" ? ["Фаджр", "Зухр", "Аср", "Магриб", "Иша"] : language === "uz" ? ["Bomdod", "Peshin", "Asr", "Shom", "Xufton"] : ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const name = names[["fajr", "dhuhr", "asr", "maghrib", "isha"].indexOf(event.prayer)];
  const wake = event.kind === "wake" || event.kind === "backup";
  const title = wake ? (language === "ru" ? "Время вставать к Фаджру" : language === "uz" ? "Bomdodga uyg‘onish vaqti" : "Time to wake for Fajr") : `${name} · ${event.kind === "prepare" ? (language === "ru" ? "Приготовьтесь" : language === "uz" ? "Tayyorlaning" : "Prepare") : (language === "ru" ? "Время молитвы" : language === "uz" ? "Namoz vaqti" : "Prayer time")}`;
  const body = wake ? (s.prayers.prepared[event.date] ?? s.prayers.fajr).message : language === "ru" ? "Оставьте место для молитвы. Запишите её после завершения." : language === "uz" ? "Namozga vaqt ajrating. O‘qib bo‘lgach qayd eting." : "Make room for prayer. Record it when you have finished.";
  return { title, body };
}
async function configureNative(s: State) {
  await LocalNotifications.registerActionTypes({ types: [{ id: "RISE_FAJR", actions: [{ id: "awake", title: s.life.language === "ru" ? "Я встал(а)" : s.life.language === "uz" ? "Uyg‘ondim" : "I’m up", foreground: true }] }] });
  // Android channels are created in MainActivity, including an explicitly silent channel.
}

/** Called through the provider's serial queue. A stale job never adds alerts. */
export async function syncDelivery(s: State, current: () => boolean): Promise<DeliveryStatus> {
  const permissions = await permissionStatus();
  const enabled = s.mode !== "demo" && deliveryPreferences(s).enabled;
  if (!nativeDelivery) return { ...permissions, confirmed: [], error: "", busy: false };
  const desired = enabled && permissions.permission === "granted" && permissions.exact ? buildPrayerSchedule(s, Date.now(), deliveryPlatform === "android" ? 10 : 0) : [];
  const variant = `${s.life.language}:${deliveryPreferences(s).sound}:${JSON.stringify([s.prayers.fajr.message, Object.entries(s.prayers.prepared).map(([d, p]) => [d, p.message])])}`;
  if (!current()) return emptyDeliveryStatus;
  const confirmed = await reconcileDeviceAlerts({
    pending: async () => (await LocalNotifications.getPending()).notifications,
    cancel: async ids => { await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) }); },
    schedule: async events => {
      await configureNative(s);
      if (!current()) throw new Error("Scheduling changed. Refreshing alerts.");
      const sound = deliveryPreferences(s).sound;
      const notifications: LocalNotificationSchema[] = events.map(event => ({
        id: event.id, ...alertCopy(event, s),
        schedule: { at: new Date(event.at), allowWhileIdle: true },
        isExactNotification: true, isExactMandatory: true,
        sound: sound ? "default" : deliveryPlatform === "android" ? "rise_silence.wav" : undefined,
        channelId: sound ? "rise-prayer-sound-v1" : "rise-prayer-quiet-v1",
        actionTypeId: event.kind === "wake" || event.kind === "backup" ? "RISE_FAJR" : undefined,
        extra: { rise: true, signature: alertSignature(event, variant), alert: event },
      }));
      await LocalNotifications.schedule({ notifications });
    },
  }, desired, variant);
  return { ...permissions, confirmed, error: "", busy: false };
}

export async function showBrowserNotification(title: string, body: string, tag: string, data?: unknown, silent = false,current=()=>true) {
  if(!current())return false;
  if ("serviceWorker" in navigator) {
    const registration = await registerAppWorker();
    // Wait only for this worker, never indefinitely for navigator.serviceWorker.ready.
    if (!registration.active) await new Promise<void>((resolve, reject) => {
      const worker = registration.installing ?? registration.waiting;
      const timeout = setTimeout(() => reject(new Error("Notification service is not ready. Try again.")), 8000);
      const changed = () => { if (worker?.state === "activated" || registration.active) { clearTimeout(timeout); resolve(); } };
      worker?.addEventListener("statechange", changed); changed();
    });
    if(!current())return false;
    await registration.showNotification(title, { body, tag, data, silent, icon: "/favicon.svg" });
    if(!current()){for(const notification of await registration.getNotifications({tag}))notification.close();return false;}
  } else {if(!current())return false;new Notification(title, { body, tag, silent });}
  return true;
}
export async function deliverBrowserAlert(event: PrayerAlert, s: State,current=()=>true,scope="guest") {
  if (nativeDelivery || Notification.permission !== "granted") return false;
  const run = async () => {
    const key = `rise.alert.${scope==="guest"?"":`${scope}:`}${event.key}:${event.at}`;
    if (!current()||localStorage.getItem(key)) return false;
    if(!buildPrayerSchedule(s,event.at-1).some(e=>e.key===event.key&&e.at===event.at))return false;
    const opaque=scope==="guest"?null:await pushEventKey(event.key);
    if(opaque&&!await claimReminder(scope,opaque,event.at,Math.min(event.expiresAt,event.at+120000),current))return false;
    const copy = alertCopy(event, s);
    if(!await showBrowserNotification(copy.title, copy.body, scope==="guest"?event.key:`rise-reminder:${scope}:${opaque}:${event.at}`, { alert: event,scope }, !deliveryPreferences(s).sound,current))return false;
    if(!current())return false;
    localStorage.setItem(key, String(Date.now()));
    // Keep the delivery ledger bounded without touching saved app records.
    for (const stored of Object.keys(localStorage).filter(k => k.startsWith("rise.alert.")))
      if (Number(localStorage.getItem(stored)) < Date.now() - 7 * 86400000) localStorage.removeItem(stored);
    return true;
  };
  return navigator.locks ? navigator.locks.request("rise-alert-delivery", run) : run();
}
/** Remove only this owner's delivery ledger/visible alerts; retain guest and PWA. */
export async function clearAccountAlerts(owner:string){
  if(!/^[a-f0-9-]{36}$/.test(owner))return;
  if(typeof indexedDB!=="undefined"){const control=await pushControl();if(control.habitForeground===owner)await updatePushControl(control.revision,{habitForeground:null});await clearReminderLedger(owner);}
  if(typeof localStorage!=="undefined")for(const key of Object.keys(localStorage))if(key.startsWith(`rise.alert.${owner}:`))localStorage.removeItem(key);
  if(typeof navigator!=="undefined"&&navigator.serviceWorker){const registration=await navigator.serviceWorker.getRegistration("/");if(registration&&typeof registration.getNotifications==="function")for(const notification of await registration.getNotifications())if(notification.data?.scope===owner)notification.close();}
}
export async function testDelivery(s: State) {
  if ((await permissionStatus()).permission !== "granted") throw new Error("Allow notifications before sending a test.");
  const body = s.life.language === "ru" ? "Тест RISE. Молитва не записана." : s.life.language === "uz" ? "RISE sinovi. Namoz qayd etilmadi." : "RISE test. No prayer was recorded.";
  if (!nativeDelivery) return showBrowserNotification("RISE", body, "rise-test", undefined, !deliveryPreferences(s).sound);
  await configureNative(s);
  await LocalNotifications.schedule({ notifications: [{ id: 90001, title: "RISE", body, sound: deliveryPreferences(s).sound ? "default" : deliveryPlatform === "android" ? "rise_silence.wav" : undefined, channelId: deliveryPreferences(s).sound ? "rise-prayer-sound-v1" : "rise-prayer-quiet-v1", isExactNotification: false }] });
}

let audio: AudioContext | undefined;
let ringing: ReturnType<typeof setInterval> | undefined;
export function primeAlarmAudio() {
  try { audio ??= new AudioContext(); void audio.resume(); } catch { /* OS notification can still be delivered. */ }
}
export function stopAlarmAudio() { if (ringing) clearInterval(ringing); ringing = undefined; }
export function ringInApp() {
  stopAlarmAudio();
  const play = () => {
    if (!audio || audio.state !== "running") return;
    const tone = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    tone.connect(gain); gain.connect(audio.destination); tone.frequency.value = 660;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.12, now + .04); gain.gain.exponentialRampToValueAtTime(.001, now + .8);
    tone.start(now); tone.stop(now + .85); tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  };
  play(); ringing = setInterval(play, 2000); setTimeout(stopAlarmAudio, 60000);
}
