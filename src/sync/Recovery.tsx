import { useRef, useState } from "react";
import { Button } from "../components";
import { createTranslator, type Language } from "../i18n";
import { prayerName } from "../prayerModel";
import type { State } from "../model";
import type { AccountJourney } from "./session";
import type { SyncOperation } from "../contracts/sync";
import { recoveryPending } from "./store";

const copy={
  title:["Review pending changes","Kutilayotgan o‘zgarishlarni tekshirish","Проверить ожидающие изменения"],
  help:["Load the latest account records and review each queued action. The original local records and actions remain in your private recovery download. A new recovery replaces the previous recovery point. Finish this review before editing account records. If the account timezone changed, review location setup again; the original setup stays in the recovery copy.","Hisobning so‘nggi qaydlarini yuklab, har bir amalni tekshiring. Asl mahalliy qaydlar va amallar shaxsiy tiklash nusxasida qoladi. Yangi tiklash avvalgi tiklash nuqtasini almashtiradi. Hisobni tahrirlashdan oldin tekshiruvni tugating. Hisobning vaqt mintaqasi o‘zgargan bo‘lsa, joylashuvni qayta sozlang; asl sozlamalar tiklash nusxasida qoladi.","Загрузите актуальные записи и проверьте каждое действие. Исходные локальные записи и действия останутся в личной копии восстановления. Новое восстановление заменяет предыдущую точку. Завершите проверку перед редактированием аккаунта. Если часовой пояс изменился, проверьте настройку местоположения; исходная настройка остаётся в копии."],
  account:["Current account record","Hisobdagi joriy qayd","Текущая запись аккаунта"],local:["Your queued action","Sizning kutilayotgan amalingiz","Ваше ожидающее действие"],
  keep:["Keep account record","Hisobdagi qaydni saqlash","Оставить запись аккаунта"],apply:["Apply my action","Mening amalimni qo‘llash","Применить моё действие"],
  blocked:["This action cannot be reapplied. The record is unavailable, archived, no longer eligible, or this operation already committed. Keep the account record; the original intent stays in the recovery download.","Bu amalni qayta qo‘llab bo‘lmaydi. Qayd mavjud emas, arxivlangan, shartlarga mos kelmaydi yoki amal allaqachon bajarilgan. Hisobdagi qaydni saqlang; asl amal tiklash nusxasida qoladi.","Действие нельзя применить повторно: запись недоступна, архивирована, условия изменились или операция уже выполнена. Оставьте запись аккаунта; исходное действие останется в копии восстановления."],
  renewed:["Applying creates a new reviewed action using the current account timezone and time. A dated record keeps its selected date. Another concurrent edit will require review again.","Qo‘llash hisobning joriy vaqt mintaqasi va vaqti bilan yangi tekshirilgan amal yaratadi. Sanali qayd tanlangan sanasini saqlaydi. Boshqa qurilma yana o‘zgartirsa, qayta tekshirish kerak.","Применение создаст новое проверенное действие с текущим временем и часовым поясом аккаунта. Дата выбранной записи сохраняется. Новая одновременная правка потребует повторной проверки."],
  failed:["Review could not finish. Your changes are retained. Reconnect, sync any applied action, then load a fresh review.","Tekshiruv tugamadi. O‘zgarishlaringiz saqlangan. Aloqani tiklang, qo‘llangan amalni sinxronlang va qayta tekshiring.","Проверка не завершена. Изменения сохранены. Подключитесь, синхронизируйте применённое действие и загрузите свежую проверку."],
  left:["Actions left","Qolgan amallar","Осталось действий"],check:["Habit check-in","Odat qaydi","Отметка привычки"],prayer:["Prayer record","Namoz qaydi","Запись намаза"],reflection:["Reflection","Mulohaza","Размышление"],reward:["Reward","Mukofot","Награда"],goal:["Goal","Maqsad","Цель"],settings:["Personal settings","Shaxsiy sozlamalar","Личные настройки"],
  enabled:["On","Yoqilgan","Включено"],disabled:["Off","O‘chirilgan","Выключено"],
  appearance:["Appearance","Ko‘rinish","Оформление"],reminders:["Reminders","Eslatmalar","Напоминания"],quietStart:["Quiet hours start","Sokin vaqt boshlanishi","Начало тихих часов"],quietEnd:["Quiet hours end","Sokin vaqt tugashi","Конец тихих часов"],sound:["Sound","Ovoz","Звук"],haptics:["Haptics","Tebranish","Вибрация"],reduceMotion:["Reduce motion","Harakatni kamaytirish","Уменьшить движение"],golden:["Golden appearance","Oltin ko‘rinish","Золотое оформление"],place:["Prayer place","Namoz joyi","Место намаза"],leadMinutes:["Preparation minutes","Tayyorgarlik daqiqalari","Минуты подготовки"],style:["Reminder style","Eslatma uslubi","Стиль напоминаний"],
  light:["Light","Yorug‘","Светлое"],dark:["Dark","Qorong‘i","Тёмное"],system:["System","Tizim","Системное"],home:["Home","Uy","Дома"],mosque:["Mosque","Masjid","В мечети"],gentle:["Gentle","Yumshoq","Мягкий"],firm:["Firm","Qat’iy","Настойчивый"],
  active:["Active","Faol","Активна"],paused:["Paused","To‘xtatilgan","Приостановлена"],archived:["Archived","Arxivlangan","В архиве"],completed:["Completed","Bajarilgan","Выполнено"],open:["Not completed","Bajarilmagan","Не выполнено"],calendar:["Update calendar","Taqvimni yangilash","Обновить календарь"],
  full:["Full","To‘liq","Полностью"],tiny:["Tiny","Kichik","Маленький шаг"],none:["No record","Qayd yo‘q","Нет записи"],on_time:["On time","O‘z vaqtida","Вовремя"],later:["Later","Keyinroq","Позже"],missed:["Missed","O‘tkazib yuborilgan","Пропущено"],enjoy:["Enjoy reward","Mukofotdan foydalanish","Получить награду"],save:["Save changes","O‘zgarishlarni saqlash","Сохранить изменения"],archive:["Archive","Arxivlash","Архивировать"],
} as const;
type Key=keyof typeof copy;
const text=(l:Language)=>(k:Key)=>copy[k][l==="uz"?1:l==="ru"?2:0];
export function recoveryDescription(state:State,operation:SyncOperation,language:Language,queued=false){
  const c=operation.command,t=text(language),display=createTranslator(language),date="date"in c?c.date:"";
  if(c.kind==="habit.check"||c.kind==="habit.correct"){const h=state.habits.find(h=>h.id===c.habitId),check=queued?c.check:state.days[c.date]?.find(h=>h.habitId===c.habitId)?.check;return`${h?.name??t("check")} · ${date} · ${t(check??"none")}`;}
  if(c.kind==="prayer.record"){const check=queued?c.check:state.prayers.days[c.date]?.entries[c.prayer].check;return`${t("prayer")} · ${date} · ${display(prayerName(c.prayer))} · ${t(check??"none")}`;}
  if(c.kind==="reflection.save"){const r=queued?c.reflection:state.reflections[c.date];return`${t("reflection")} · ${date} · ${r?[r.manageable,r.smaller].filter(Boolean).join(" · "):t("none")}`;}
  if("rewardId"in c){const r=state.personalRewards.find(r=>r.id===c.rewardId);return`${r?.name??t("reward")} · ${queued?t(c.kind==="reward.enjoy"?"enjoy":c.kind==="reward.archive"?"archive":"save"):r?.archivedOn?t("archive"):r?.enjoyedOn??r?.earnedOn??t("none")}`;}
  if(c.kind==="habit.save")return queued?`${c.draft.name} · ${display.target(c.draft)} · ${c.draft.cue}`:state.habits.filter(h=>h.id===(c.draft.id??c.newId)).map(h=>{const version=h.versions.at(-1);return`${h.name} · ${version?display.target({...h,...version}):""} · ${version?.cue??""}`;}).join(" · ")||t("none");
  if(c.kind==="habit.archive")return`${state.habits.find(h=>h.id===c.habitId)?.name??t("check")} · ${t("archive")}`;
  if(c.kind==="goal.save"){const goal=queued?c.draft:state.goals.find(g=>g.id===(c.draft.id??c.newId));return goal?`${goal.title} · ${goal.reason} · ${goal.targetDate} · ${goal.milestones.map(m=>m.title).join(" / ")} · ${goal.habitIds.map(id=>state.habits.find(h=>h.id===id)?.name??t("none")).join(" / ")}`:t("none");}
  if(c.kind==="reward.save"){const reward=queued?c.draft:state.personalRewards.find(r=>r.id===(c.draft.id??c.newId)),condition=reward?.condition;return reward&&condition?`${reward.name} · ${condition.kind==="goal"?state.goals.find(g=>g.id===condition.goalId)?.title??t("none"):`${condition.week} · ${condition.target}`}`:t("none");}
  if(c.kind==="preferences.set"||c.kind==="prayer.preferences"){
    const current=c.kind==="preferences.set"?state.prefs:state.prayers.preferences;
    const show=(value:unknown):string=>typeof value==="boolean"?t(value?"enabled":"disabled"):typeof value==="string"&&value in copy?t(value as Key):String(value??"");
    return Object.entries(c.changes).map(([key,value])=>`${key in copy?t(key as Key):key}: ${show(queued?value:Reflect.get(current,key))}`).join(" · ");
  }
  if(c.kind==="goal.status"){const g=state.goals.find(g=>g.id===c.goalId);return`${g?.title??t("goal")} · ${t(queued?c.status:g?.status??"active")}`;}
  if(c.kind==="goal.milestone"){const g=state.goals.find(g=>g.id===c.goalId),m=g?.milestones.find(m=>m.id===c.milestoneId);return`${g?.title??t("goal")} · ${m?.title??t("none")} · ${t((queued?c.completed:!!m?.completedOn)?"completed":"open")}`;}
  if(c.kind==="profile.name")return queued?c.name:state.name;
  if(c.kind==="language.set")return {en:"English",uz:"O‘zbekcha",ru:"Русский"}[queued?c.language:state.life.language];
  if(c.kind==="account.timezone")return queued?c.timezone:state.timezone;
  if(c.kind==="calendar.refresh")return`${t("calendar")} · ${operation.context.date}`;
  if(c.kind==="prayer.coverage"){const day=queued?c.day:state.prayers.days[c.date];return day?`${date} · ${day.source} · ${day.timezone} · ${Object.values(day.entries).map(p=>`${p.begins}–${p.ends}`).join(" / ")}`:t("none");}
  if(c.kind==="fajr.plan"){const plan=queued?c.plan:state.prayers.prepared[c.date];return plan?`${date} · ${plan.bedtime} · ${plan.wakeLead} · ${plan.message}`:t("none");}
  if("goalId"in c)return`${state.goals.find(g=>g.id===c.goalId)?.title??t("goal")} · ${t("save")}`;
  return`${c.kind.startsWith("prayer.")?t("prayer"):t("settings")} ${date} · ${t("save")}`;
}
export function SyncRecovery({journey,language}:{journey:AccountJourney;language:Language}){
  const t=text(language),[busy,setBusy]=useState(false),[error,setError]=useState(false),[preview,setPreview]=useState<Awaited<ReturnType<AccountJourney["recoveryPreview"]>>>(null),heading=useRef<HTMLHeadingElement>(null);
  const load=async()=>{await journey.beginRecovery();const next=await journey.recoveryPreview();setPreview(next);requestAnimationFrame(()=>heading.current?.focus());};
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError(false);try{await action();}catch{setPreview(null);setError(true);}finally{setBusy(false);}};
  return <div className="backup-screen"><section aria-label={t("title")}>
    <h3 ref={heading} tabIndex={-1}>{t("title")}</h3><p className="fine-print">{t("help")}</p>
    {preview?<><p className="fine-print" role="status">{t("left")}: {recoveryPending(journey.cacheSnapshot())}</p>
      <p className="fine-print"><strong>{t("account")}</strong><br/>{recoveryDescription(preview.state,preview.operation,language)}</p>
      <p className="fine-print"><strong>{t("local")}</strong><br/>{recoveryDescription(journey.cacheSnapshot().recovery!.state,preview.operation,language,true)}</p>
      <p className="fine-print">{t(preview.canReapply?"renewed":"blocked")}</p>
      <Button className="wide" variant="secondary" disabled={busy} onClick={()=>void run(async()=>{await journey.resolveRecovery(preview,"account");await load();})}>{t("keep")}</Button>
      <Button className="wide" disabled={busy||!preview.canReapply} onClick={()=>void run(async()=>{await journey.resolveRecovery(preview,"local");await load();})}>{t("apply")}</Button>
    </>:<Button className="wide" variant="secondary" disabled={busy} onClick={()=>void run(load)}>{t("title")}</Button>}
    {error&&<p className="field-error" role="alert">{t("failed")}</p>}
  </section></div>;
}
