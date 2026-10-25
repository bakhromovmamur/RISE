import { AlarmClock, Bell, ChevronRight, Home, LockKeyhole, Settings2, Sunrise, Users } from "lucide-react";
import { useApp } from "./context";
import { GroupRow, Pip, TabHeading } from "./components";
import { PreviewLabel, useText } from "./LifeUI";
import { activePause } from "./lifeModel";
import { useLiveText } from "./PrayerLive";

export function You() {
  const t = useText();
  const { state, open } = useApp();
  return <div className="screen you-screen">
    <TabHeading title={t("Your little world", "Sizning olamingiz")} />
    <button className="you-profile" onClick={() => open({ type: "collection" })}>
      <Pip size={64} mood={state.equipped === 250 ? "scarf" : "welcome"} />
      <span><strong>{state.name} {t(" & Pip")}</strong><small>{t("Make Pip yours", "Pipni o‘zingizga moslang")}</small></span>
      <ChevronRight size={18} />
    </button>
    <nav className="you-destinations" aria-label={t("Your spaces and preferences", "Joylaringiz va sozlamalaringiz")}>
      <GroupRow icon={<Sunrise size={22} />} title={t("Prayer preferences", "Namoz sozlamalari")}
        detail={activePause(state) ? t("Tracking paused · private", "Qaydlar to‘xtatilgan · shaxsiy") : t("Times, reminders & Fajr", "Vaqtlar, eslatmalar va bomdod")}
        onClick={() => open({ type: "prayerPreferences" })} />
      <GroupRow icon={<Home size={22} />} title={t("Family", "Oila")}
        detail={t("Tasks & shared lists", "Vazifalar va umumiy ro‘yxatlar")}
        onClick={() => open({ type: "groups", kind: "family" })} />
      <GroupRow icon={<Users size={22} />} title={t("Squads", "Guruhlar")}
        detail={t("Weekly updates & encouragement", "Haftalik yangiliklar va qo‘llab-quvvatlash")}
        onClick={() => open({ type: "groups", kind: "squad" })} />
      <GroupRow icon={<Settings2 size={22} />} title={t("Settings", "Sozlamalar")}
        detail={t("Appearance, language, habits & data", "Ko‘rinish, til, odatlar va ma’lumotlar")}
        onClick={() => open({ type: "settings" })} />
    </nav>
    <p className="screen-footer">{t("Built around your life. At your pace.", "Hayotingizga mos. O‘z maromingizda.")}</p>
  </div>;
}

export function PrayerPreferences() {
  const t = useText();
  const l = useLiveText();
  const { state, open } = useApp();
  const pause = activePause(state);
  return <div className="preferences-hub">
    {state.mode === "demo" && <PreviewLabel>{t("Timetables & alarms are previews", "Namoz jadvallari va signallar — namuna")}</PreviewLabel>}
    <div className="group">
      <GroupRow icon={<Sunrise size={21} />} title={t("Prayer times", "Namoz vaqtlari")}
        detail={state.mode !== "demo" && state.life.calculation ? `${state.life.calculation.label} · ${state.life.calculation.method}` : state.life.setup.configured ? `${t(state.life.setup.city)} · ${t("illustrative timetable", "shartli jadval")}` : t("Choose your city and daily plan", "Shahar va kunlik rejani tanlang")}
        onClick={() => open({ type: "prayerSetup" })} />
      <GroupRow icon={<Bell size={21} />} title={t("Prayer reminders", "Namoz eslatmalari")}
        detail={t("Prepare, save your place, step away", "Tayyorlanish, ishni saqlash va tanaffus")}
        onClick={() => open({ type: "prayerReminders" })} />
      <GroupRow icon={<AlarmClock size={21} />} title={t("Prepare for Fajr", "Bomdodga tayyorlanish")}
        detail={state.mode === "demo" ? t("Bedtime, wake-up & backup preview", "Uyqu vaqti, uyg‘onish va zaxira signali") : l("Bedtime, wake-up & backup", "Uyqu, uyg‘onish va zaxira signal", "Сон, пробуждение и повтор")}
        onClick={() => open({ type: "fajr" })} />
      <GroupRow icon={<Settings2 size={21} />} title={t("Alarm readiness", "Signal tayyorligi")}
        detail={state.mode === "demo" ? t("Review device preview states", "Qurilma holati namunalarini ko‘rish") : l("Permissions & confirmed alerts", "Ruxsatlar va tasdiqlangan signallar", "Разрешения и подтверждённые сигналы")}
        onClick={() => open({ type: "readiness" })} />
      <GroupRow icon={<LockKeyhole size={21} />} title={t("Period mode", "Hayz davri rejimi")}
        detail={pause ? t("Tracking paused · manage or resume", "Qaydlar to‘xtatilgan · boshqarish yoki davom etish") : t("Pause prayer tracking privately", "Namoz qaydlarini shaxsiy to‘xtatish")}
        onClick={() => open({ type: "period" })} />
    </div>
    <p className="fine-print">{t("Prayer preferences stay private. Your habits and family plans keep their own rhythm.", "Namoz sozlamalari shaxsiy saqlanadi. Odatlar va oilaviy rejalar alohida davom etadi.")}</p>
  </div>;
}
