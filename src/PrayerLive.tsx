import { useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { AlarmClock, Bell, Check, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { useApp } from "./context";
import { Button, GroupRow, SectionTitle, Toggle } from "./components";
import { LifeIntro, useLifeDraft, useText } from "./LifeUI";
import { LOCATIONS, METHODS, calculatePrayerDay, dateInZone, defaultCalculation, useCalculatedPrayers, zoneAt, type CalculationSettings } from "./prayerCalculation";
import { PRAYERS, type PrayerDay } from "./prayerModel";
import { deliveryPreferences } from "./prayerSchedule";
import { deliveryPlatform, nativeDelivery } from "./prayerDelivery";
import { usePrayerDelivery } from "./PrayerDeliveryProvider";
import { activePause } from "./lifeModel";
import { PushSettings } from "./push/PushSettings";
import { formatDisplayDate } from "./i18n";

export function useLiveText() {
  const { state } = useApp();
  return (en: string, uz: string, ru: string) => state.life.language === "ru" ? ru : state.life.language === "uz" ? uz : en;
}
export function PrayerLocationReview() {
  const { state, dispatch, open } = useApp(), l = useLiveText();
  const device = state.life.deviceTimezone;
  if (state.mode === "demo" || (!state.life.setup.configured && !Object.keys(state.prayers.days).length) || !device || device.observed === device.reviewed) return null;
  return <div className="group" role="status">
    <GroupRow icon={<MapPin size={20} />} title={l("Review your prayer location", "Namoz joylashuvini tekshiring", "Проверьте место молитв")}
      detail={`${l("Device time zone changed", "Qurilma vaqt mintaqasi o‘zgardi", "Часовой пояс устройства изменился")}: ${device.observed}. ${l("Prayer time zone", "Namoz vaqt mintaqasi", "Часовой пояс молитв")}: ${state.timezone}.`}
      onClick={() => open({ type: "prayerSetup", live: true })} />
    <Button variant="ghost" className="wide" onClick={() => dispatch({ kind: "prayer.location-reviewed", timezone: device.observed })}>{l("Keep my current prayer location", "Joriy namoz joylashuvini saqlash", "Оставить текущее место молитв")}</Button>
  </div>;
}
export function LivePrayerSetup() {
  const { state, dispatch, open, toast } = useApp(), l = useLiveText(), t = useText();
  const [draft, setDraft, clear] = useLifeDraft("live-prayer-setup", () => {
    const settings = state.life.calculation ?? defaultCalculation();
    return { ...settings, latitude: String(settings.latitude), longitude: String(settings.longitude), offsets: { ...state.life.setup.offsets } };
  });
  const [locating, setLocating] = useState(false), [error, setError] = useState("");
  const update = (part: Partial<typeof draft>) => { setDraft({ ...draft, ...part }); setError(""); };
  const settings = { label: draft.label, timezone: draft.timezone, method: draft.method, madhab: draft.madhab, highLatitude: draft.highLatitude, latitude: draft.latitude.trim() ? Number(draft.latitude) : NaN, longitude: draft.longitude.trim() ? Number(draft.longitude) : NaN } as CalculationSettings;
  let preview: PrayerDay | undefined, date = "";
  try { date = dateInZone(Date.now(), settings.timezone); preview = calculatePrayerDay(date, settings, draft.offsets); }
  catch { /* Validation feedback below retains the saved profile. */ }
  const location = async () => {
    setLocating(true); setError("");
    try {
      const coords = nativeDelivery ? (await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })).coords
        : (await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }) : reject(new Error("Unavailable")))).coords;
      update({ latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5), timezone: zoneAt(coords.latitude, coords.longitude), label: l("My location", "Mening joylashuvim", "Моё местоположение") });
    } catch { setError(l("Location is unavailable. Choose a city or enter coordinates below.", "Joylashuv olinmadi. Shahar tanlang yoki koordinatalarni kiriting.", "Не удалось определить местоположение. Выберите город или введите координаты.")); }
    finally { setLocating(false); }
  };
  const save = () => {
    try {
      // Validate synchronously; preserve the old profile if calculation fails.
      useCalculatedPrayers(state, settings, draft.offsets);
      if (!dispatch({ kind: "prayer.calculated-setup", settings, offsets: draft.offsets })) return; clear();
      toast(l("Real prayer times saved. Choose how to receive alerts next.", "Haqiqiy namoz vaqtlari saqlandi. Endi bildirishnomalarni sozlang.", "Время молитв сохранено. Теперь настройте уведомления."));
      open({ type: "readiness" });
    } catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
  };
  return <div className="life-screen live-prayer-setup">
    <LifeIntro title={l("Prayer times for your day.", "Kuningiz uchun namoz vaqtlari.", "Время молитв на ваш день.")}
      text={l("Calculated on your device, even offline. Your location stays here. Compare your method with your local mosque’s timetable.", "Vaqtlar qurilmangizda, internetsiz ham hisoblanadi. Joylashuvingiz shu yerda qoladi. Usulni mahalliy masjid jadvali bilan solishtiring.", "Расчёт на устройстве, даже без интернета. Местоположение остаётся здесь. Сверьте метод с расписанием вашей мечети.")} />
    <label className="field">{t("City", "Shahar")}<select aria-label={t("City", "Shahar")} value={LOCATIONS.some(item => item.label === draft.label) ? draft.label : "custom"} onChange={e => {
      const city = LOCATIONS.find(item => item.label === e.target.value);
      if (city) update({ ...city, latitude: String(city.latitude), longitude: String(city.longitude) });
      else update({ label: "", latitude: "", longitude: "" });
    }}>{LOCATIONS.map(item => <option key={item.label} value={item.label}>{t(item.label)}</option>)}<option value="custom">{l("Custom location", "Boshqa joylashuv", "Другое место")}</option></select></label>
    <Button variant="secondary" className="wide" disabled={locating} onClick={() => void location()}><MapPin size={18} />{locating ? l("Finding your location…", "Joylashuv aniqlanmoqda…", "Определяем местоположение…") : l("Use my location", "Joylashuvimdan foydalanish", "Моё местоположение")}</Button>
    <details className="live-location-details" open={!LOCATIONS.some(item => item.label === draft.label)}>
      <summary>{l("Coordinates & time zone", "Koordinatalar va vaqt mintaqasi", "Координаты и часовой пояс")}</summary>
      <label className="field">{l("Location name", "Joylashuv nomi", "Название места")}<input value={draft.label} maxLength={60} onChange={e => update({ label: e.target.value })} /></label>
      <div className="life-two-fields">
        <label className="field">{l("Latitude", "Kenglik", "Широта")}<input inputMode="decimal" value={draft.latitude} onChange={e => update({ latitude: e.target.value })} /></label>
        <label className="field">{l("Longitude", "Uzunlik", "Долгота")}<input inputMode="decimal" value={draft.longitude} onChange={e => update({ longitude: e.target.value })} /></label>
      </div>
      <label className="field">{l("Time zone", "Vaqt mintaqasi", "Часовой пояс")}<input value={draft.timezone} onChange={e => update({ timezone: e.target.value })} placeholder="Asia/Tashkent" /></label>
      <Button variant="ghost" className="wide" onClick={() => { try { update({ timezone: zoneAt(settings.latitude, settings.longitude) }); } catch { setError(l("Enter valid coordinates first.", "Avval to‘g‘ri koordinatalarni kiriting.", "Сначала введите корректные координаты.")); } }}>{l("Find time zone from coordinates", "Koordinatalardan vaqt mintaqasini aniqlash", "Определить пояс по координатам")}</Button>
    </details>
    <label className="field">{l("Calculation method", "Hisoblash usuli", "Метод расчёта")}<select value={draft.method} onChange={e => update({ method: e.target.value as CalculationSettings["method"] })}>{METHODS.map(method => <option key={method} value={method}>{t(method.replace(/([a-z])([A-Z])/g, "$1 $2"))}</option>)}</select></label>
    <label className="field">{l("Asr convention", "Asr hisobi", "Расчёт Асра")}<select value={draft.madhab} onChange={e => update({ madhab: e.target.value as CalculationSettings["madhab"] })}><option value="Hanafi">{l("Hanafi", "Hanafiy", "Ханафитский")}</option><option value="Shafi">{l("Shafi / Maliki / Hanbali", "Shofe’iy / Molikiy / Hanbaliy", "Шафии / Малики / Ханбали")}</option></select></label>
    <details className="live-location-details"><summary>{l("Advanced calculation", "Qo‘shimcha hisoblash sozlamalari", "Дополнительные настройки расчёта")}</summary><label className="field">{l("High-latitude rule", "Yuqori kengliklar qoidasi", "Правило высоких широт")}<select value={draft.highLatitude} onChange={e => update({ highLatitude: e.target.value as CalculationSettings["highLatitude"] })}>
      <option value="MiddleOfTheNight">{l("Middle of the night", "Tunning yarmi", "Середина ночи")}</option><option value="SeventhOfTheNight">{l("One seventh of the night", "Tunning yettidan biri", "Одна седьмая ночи")}</option><option value="TwilightAngle">{l("Twilight angle", "Shafaq burchagi", "Угол сумерек")}</option>
    </select></label></details>
    <SectionTitle title={l("Today’s times", "Bugungi vaqtlar", "Время на сегодня")} />
    {preview ? <><p className="fine-print">{date} · {draft.timezone}<br />{l("Sunrise", "Quyosh chiqishi", "Восход")}: {preview.sunrise}</p>
      <div className="timing-table"><div className="timing-table-head"><span>{t("Prayer", "Namoz")}</span><span>{t("Begins", "Boshlanishi")}</span><span>{t("Plan after start", "Boshlanishdan keyin")}</span></div>{PRAYERS.map(({ id, name }) => <div className="timing-table-row" key={id}><strong>{t(name)}</strong><span>{preview.entries[id].begins}</span><label><span className="sr-only">{t(name)} {t("planned offset", "reja kechikishi")}</span><select aria-label={`${t(name)} ${t("planned offset", "reja kechikishi")}`} value={draft.offsets[id]} onChange={e => update({ offsets: { ...draft.offsets, [id]: Number(e.target.value) } })}>{[0, 5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n ? `+${n} ${t("min", "daq")}` : t("At start", "Boshlanishida")}</option>)}</select><small>{t("Planned", "Reja")}: {preview.entries[id].target}</small></label></div>)}</div></> : <p className="live-error" role="status">{l("Times could not be calculated. Check the location, time zone and method, or enter a trusted timetable manually.", "Vaqtlar hisoblanmadi. Joylashuv, mintaqa va usulni tekshiring yoki ishonchli jadvalni qo‘lda kiriting.", "Не удалось рассчитать время. Проверьте место, пояс и метод или введите проверенное расписание вручную.")}</p>}
    {error && <p className="live-error" role="alert">{error}</p>}
    {state.mode === "demo" && <p className="fine-print">{l("This switches RISE to today’s real date. Existing records stay saved; sample dates will never send alerts.", "RISE bugungi haqiqiy sanaga o‘tadi. Oldingi qaydlar saqlanadi; namunaviy sanalar bildirishnoma yubormaydi.", "RISE перейдёт на сегодняшнюю дату. Записи сохранятся; демонстрационные даты не отправляют уведомления.")}</p>}
    <Button className="wide" disabled={!preview || locating} onClick={save}><Check size={18} />{l("Use these prayer times", "Shu namoz vaqtlaridan foydalanish", "Использовать это время")}</Button>
    <Button variant="ghost" className="wide" onClick={() => open({ type: "timetable" })}>{t("Enter a timetable manually", "Jadvalni qo‘lda kiritish")}</Button>
  </div>;
}

export function DeliverySummary() {
  const { state, open } = useApp(), l = useLiveText(), delivery = usePrayerDelivery();
  const enabled = deliveryPreferences(state).enabled;
  return <GroupRow icon={<Bell size={20} />} title={l("Notification delivery", "Bildirishnomalar", "Доставка уведомлений")}
    detail={delivery.busy ? l("Checking this device…", "Qurilma tekshirilmoqda…", "Проверяем устройство…") : !enabled ? l("Off · choose how to receive alerts", "O‘chiq · bildirishnomalarni sozlang", "Выключена · настройте уведомления") : nativeDelivery && delivery.confirmed.length ? l("Confirmed by this phone", "Telefon tasdiqladi", "Подтверждено телефоном") : l("Review delivery status", "Yetkazilish holatini ko‘rish", "Проверить доставку")}
    onClick={() => open({ type: "readiness" })} />;
}

export function LiveAlarmReadiness() {
  const { state, dispatch, open } = useApp(), t = useText(), l = useLiveText(), delivery = usePrayerDelivery();
  const prefs = deliveryPreferences(state), paused = !!activePause(state), nextWake = delivery.confirmed.find(event => event.kind === "wake"), backup = delivery.confirmed.find(event => event.kind === "backup" && event.date === nextWake?.date);
  const when = (at?: number) => at ? formatDisplayDate(at, state.life.language, { timeZone: state.timezone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const heading = delivery.busy ? l("Checking this device…", "Qurilma tekshirilmoqda…", "Проверяем устройство…")
    : delivery.error ? l("Alerts are not confirmed", "Signallar tasdiqlanmagan", "Уведомления не подтверждены")
    : paused ? l("Prayer alerts are paused", "Namoz signallari to‘xtatilgan", "Уведомления приостановлены")
    : !prefs.enabled ? l("Choose how to stay reminded.", "Eslatmalarni sozlang.", "Настройте напоминания.")
    : delivery.permission !== "granted" ? l("Notification permission needed", "Bildirishnoma ruxsati kerak", "Нужно разрешение на уведомления")
    : !nativeDelivery ? l("Reminders while RISE is open", "RISE ochiq bo‘lganda eslatmalar", "Напоминания, пока RISE открыт")
    : !delivery.exact ? l("Allow alarms & reminders", "Signal va eslatmalarga ruxsat bering", "Разрешите будильники и напоминания")
    : delivery.confirmed.length ? l("Alerts confirmed by your phone", "Signallar telefoningizda tasdiqlandi", "Уведомления подтверждены телефоном") : l("No upcoming alerts", "Keyingi signallar yo‘q", "Нет предстоящих уведомлений");
  return <div className="life-screen">
    <LifeIntro title={t("Know before you sleep.", "Uxlashdan oldin tekshiring.")} text={l("Set up delivery, send a test, and check your next Fajr alert.", "Yetkazilishni sozlang, sinov yuboring va keyingi bomdod signalini tekshiring.", "Настройте доставку, отправьте тест и проверьте следующий сигнал Фаджра.")} />
    <div className="readiness-status" aria-live="polite">{nativeDelivery && delivery.confirmed.length > 0 && !delivery.busy ? <ShieldCheck size={28} /> : <Bell size={28} />}<h2>{heading}</h2>
      <p>{nativeDelivery ? l("These are scheduled notifications, including Fajr wake-up and backup alerts. Sound follows your phone’s notification volume, silent mode, Focus and battery settings.", "Bular rejalashtirilgan bildirishnomalar, jumladan bomdod va zaxira signallari. Ovoz telefoningizning bildirishnoma ovozi, jim rejimi, Fokus va batareya sozlamalariga bog‘liq.", "Это запланированные уведомления, включая сигнал Фаджра и повтор. Звук зависит от громкости уведомлений, беззвучного режима, Фокуса и настроек батареи.") : l("Keep RISE open and this device awake. A browser cannot reliably wake you when the app is closed or the phone is asleep. Use your phone’s Clock alarm as a backup.", "RISE ochiq, qurilma esa uyg‘oq bo‘lsin. Ilova yopiq yoki telefon uyquda bo‘lsa, brauzer ishonchli uyg‘ota olmaydi. Zaxira uchun telefon budilnigidan foydalaning.", "Оставьте RISE открытым и устройство активным. Браузер не может надёжно разбудить вас, если приложение закрыто или телефон спит. Поставьте запасной будильник в приложении «Часы».")}</p>
    </div>
    {delivery.error && <p role="alert" className="live-error">{l("Could not confirm delivery. Check permissions and try again.", "Yetkazilish tasdiqlanmadi. Ruxsatlarni tekshirib qayta urinib ko‘ring.", "Не удалось подтвердить доставку. Проверьте разрешения и повторите попытку.")}</p>}
    {delivery.permission === "denied" && <p className="fine-print">{l("Notifications are blocked. Allow them in your browser or phone settings, then tap Refresh status.", "Bildirishnomalar bloklangan. Brauzer yoki telefon sozlamalarida ruxsat bering, keyin holatni yangilang.", "Уведомления заблокированы. Разрешите их в настройках браузера или телефона и обновите статус.")}</p>}
    {delivery.permission === "unavailable" && <p className="fine-print">{l("This browser cannot deliver notifications. Use the installed phone app or a supported browser over HTTPS.", "Bu brauzer bildirishnomalarni yetkaza olmaydi. Telefon ilovasi yoki HTTPS orqali mos brauzerdan foydalaning.", "Этот браузер не поддерживает уведомления. Используйте приложение на телефоне или поддерживаемый браузер через HTTPS.")}</p>}
    {delivery.permission === "denied" ? <Button className="wide" disabled={delivery.busy} onClick={delivery.refresh}><RefreshCw size={17} />{l("Refresh status", "Holatni yangilash", "Обновить статус")}</Button> : !prefs.enabled || delivery.permission !== "granted" ? <Button className="wide" disabled={delivery.busy || delivery.permission === "unavailable" || state.mode === "demo"} onClick={() => void delivery.enable()}><Bell size={18} />{l("Enable notifications", "Bildirishnomalarni yoqish", "Включить уведомления")}</Button> : <Button variant="secondary" className="wide" onClick={delivery.disable}>{l("Turn off prayer alerts", "Namoz signallarini o‘chirish", "Выключить уведомления молитв")}</Button>}
    {deliveryPlatform === "android" && !delivery.exact && <Button className="wide" onClick={() => void delivery.exactPermission()}>{l("Allow exact alarms", "Aniq vaqtdagi signallarga ruxsat", "Разрешить точные сигналы")}</Button>}
    <dl className="life-facts">
      <div><dt>{t("Device", "Qurilma")}</dt><dd>{nativeDelivery ? deliveryPlatform === "ios" ? "iPhone / iPad" : "Android" : l("This browser", "Shu brauzer", "Этот браузер")}</dd></div>
      <div><dt>{l("OS-scheduled alerts", "Qurilma rejalashtirgan signallar", "Запланировано системой")}</dt><dd>{delivery.confirmed.length}</dd></div>
      <div><dt>{t("Next wake-up", "Keyingi uyg‘onish")}</dt><dd>{when(nextWake?.at)}</dd></div>
      <div><dt>{t("Backup", "Zaxira signal")}</dt><dd>{when(backup?.at)}</dd></div>
      {delivery.confirmed.length > 0 && <div><dt>{l("Last queued alert", "Oxirgi rejalashtirilgan signal", "Последнее в очереди")}</dt><dd>{when(delivery.confirmed.at(-1)?.at)}</dd></div>}
    </dl>
    {nativeDelivery && <p className="fine-print">{l("RISE queues up to 60 alerts. Open the app before the last queued alert to refill the schedule. A confirmed schedule does not override silent mode or guarantee sound.", "RISE 60 tagacha signal rejalashtiradi. Navbat tugashidan oldin ilovani ochib yangilang. Tasdiqlangan reja jim rejimni chetlab o‘tmaydi va ovozni kafolatlamaydi.", "RISE ставит в очередь до 60 уведомлений. Откройте приложение до последнего из них, чтобы пополнить расписание. Подтверждённая очередь не отменяет беззвучный режим и не гарантирует звук.")}</p>}
    {deliveryPlatform === "android" && <p className="fine-print">{l("Android limits alerts while idle. Backup wake-ups are at least 10 minutes apart; nearby prayer reminders may be delayed. Check sound and battery settings on your phone.", "Android uyqu rejimida signallarni cheklaydi. Zaxira signal kamida 10 daqiqadan keyin; yaqin eslatmalar kechikishi mumkin. Ovoz va batareya sozlamalarini tekshiring.", "Android ограничивает сигналы в режиме ожидания. Повтор — не раньше чем через 10 минут; близкие напоминания могут задерживаться. Проверьте звук и настройки батареи.")}</p>}
    <GroupRow icon={<Bell size={19} />} title={l("Notification sound", "Bildirishnoma ovozi", "Звук уведомлений")} end={<Toggle label={l("Notification sound", "Bildirishnoma ovozi", "Звук уведомлений")} checked={prefs.sound} onChange={() => dispatch({ kind: "delivery.preferences", changes: { sound: !prefs.sound } })} />} />
    <Button variant="secondary" className="wide" disabled={delivery.permission !== "granted" || delivery.busy} onClick={() => void delivery.test()}>{l("Send a test notification", "Sinov bildirishnomasini yuborish", "Отправить тестовое уведомление")}</Button>
    {delivery.permission !== "denied" && <Button variant="ghost" className="wide" disabled={delivery.busy} onClick={delivery.refresh}><RefreshCw size={17} />{l("Refresh status", "Holatni yangilash", "Обновить статус")}</Button>}
    {!nativeDelivery&&<PushSettings />}
    <div className="group life-link-group"><GroupRow icon={<AlarmClock size={20} />} title={t("Open my Fajr plan", "Bomdod rejamni ochish")} onClick={() => open({ type: "fajr" })} /><GroupRow icon={<MapPin size={20} />} title={t("Prayer times", "Namoz vaqtlari")} onClick={() => open({ type: "prayerSetup", live: true })} /></div>
  </div>;
}
