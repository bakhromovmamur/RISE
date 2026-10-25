import type { Language } from "../i18n";
import type { SyncStatus } from "./session";
const messages={
  title:["Account sync","Hisobni sinxronlash","Синхронизация аккаунта"],
  guest:["You are using the separate device-only profile.","Siz alohida qurilma profilidan foydalanmoqdasiz.","Сейчас открыт отдельный профиль устройства."],
  account:["You are using your account records.","Siz hisobingizdagi qaydlardan foydalanmoqdasiz.","Сейчас открыты записи аккаунта."],
  choose:["Choose what to import","Ko‘chiriladigan qaydlarni tanlang","Выберите записи для импорта"],
  privacy:["Review your private records before uploading. The original device profile and its recovery source stay here. Existing account records are kept. Location coordinates, calculation keys, drafts, timers, groups and invitation secrets are excluded.","Yuklashdan oldin shaxsiy qaydlarni tekshiring. Asl qurilma profili va tiklash manbasi shu yerda qoladi. Hisobdagi mavjud qaydlar saqlanadi. Joylashuv koordinatalari, hisoblash kalitlari, qoralamalar, taymerlar, guruhlar va taklif sirlari ko‘chirilmaydi.","Проверьте личные записи до загрузки. Исходный профиль устройства и источник восстановления остаются здесь. Существующие записи аккаунта сохраняются. Координаты, ключи расчёта, черновики, таймеры, группы и секреты приглашений исключены."],
  provenance:["Legacy or mixed data needs your review. Known fictional habits/goals and sample prayer dates stay on this device. Select only your real records.","Eski yoki aralash ma’lumotlarni tekshiring. Ma’lum namunaviy odatlar, maqsadlar va namoz sanalari shu qurilmada qoladi. Faqat haqiqiy qaydlaringizni tanlang.","Старые или смешанные данные требуют проверки. Известные вымышленные привычки, цели и примерные даты намаза остаются на устройстве. Выбирайте только настоящие записи."],
  profile:["Profile and planning timezone","Profil va rejalash vaqt mintaqasi","Профиль и часовой пояс планирования"],
  habits:["Habits and dated history","Odatlar va sana bo‘yicha tarix","Привычки и история по датам"],
  goals:["Goals, milestones and personal rewards","Maqsadlar, bosqichlar va shaxsiy mukofotlar","Цели, этапы и личные награды"],
  prayers:["Real prayer history, private pauses and Fajr plans","Haqiqiy namoz tarixi, shaxsiy tanaffuslar va Bomdod rejalari","Настоящая история намаза, личные паузы и планы Фаджра"],
  reflections:["Saved reflections","Saqlangan mulohazalar","Сохранённые размышления"],
  settings:["Personal preferences","Shaxsiy sozlamalar","Личные настройки"],
  prepare:["Prepare a device-only preview","Qurilmada dastlabki ko‘rinish","Подготовить просмотр на устройстве"],
  consent:["I reviewed these records and consent to uploading only this selection to the account shown above.","Bu qaydlarni tekshirdim va faqat shu tanlovni yuqorida ko‘rsatilgan hisobga yuklashga roziman.","Я проверил(а) записи и разрешаю загрузить только выбранные данные в указанный выше аккаунт."],
  upload:["Upload selection for account review","Tanlovni hisob uchun tekshirishga yuklash","Загрузить выбранное для проверки"],
  confirm:["Import selected records","Tanlangan qaydlarni ko‘chirish","Импортировать выбранные записи"],
  keep:["Existing account records will be kept. No account is replaced. Skipped records remain in the original device profile.","Hisobdagi mavjud qaydlar saqlanadi. Hisob almashtirilmaydi. Ko‘chirilmagan qaydlar asl qurilma profilida qoladi.","Существующие записи аккаунта сохранятся. Аккаунт не заменяется целиком. Пропущенные записи останутся в исходном профиле устройства."],
  added:["New records","Yangi qaydlar","Новые записи"],kept:["Kept or skipped","Saqlangan yoki o‘tkazib yuborilgan","Сохранено или пропущено"],
  checks:["Habit check-ins","Odat belgilari","Отметки привычек"],xp:["Habit XP","Odat XP","XP привычек"],excluded:["Samples and unavailable references excluded","Namunalar va mavjud bo‘lmagan havolalar chiqarildi","Примеры и недоступные ссылки исключены"],
  dates:["Selected record dates","Tanlangan qaydlar sanalari","Даты выбранных записей"],noDates:["No dated history selected","Sana bo‘yicha tarix tanlanmagan","История по датам не выбрана"],
  prayerChecks:["Prayer records","Namoz qaydlari","Записи намаза"],goalCount:["Goals","Maqsadlar","Цели"],
  cancel:["Cancel import","Ko‘chirishni bekor qilish","Отменить импорт"],review:["Review again","Qayta tekshirish","Проверить заново"],
  use:["Use account records","Hisob qaydlaridan foydalanish","Открыть записи аккаунта"],
  empty:["Start an empty account","Bo‘sh hisobdan boshlash","Начать с пустого аккаунта"],
  emptyHelp:["An empty account uses your selected planning timezone and interface language. It starts without your device habits or history.","Bo‘sh hisob tanlangan vaqt mintaqasi va interfeys tilidan foydalanadi. Qurilmadagi odatlar yoki tarix ko‘chirilmaydi.","Пустой аккаунт использует выбранный часовой пояс и язык интерфейса, без привычек и истории устройства."],
  device:["Use device-only profile","Qurilma profilidan foydalanish","Открыть профиль устройства"],
  sync:["Sync now","Hozir sinxronlash","Синхронизировать"],
  export:["Download pending changes","Kutilayotgan o‘zgarishlarni yuklab olish","Скачать ожидающие изменения"],
  exportHelp:["This private recovery copy includes cached account records and pending edits, not credentials. Keep it somewhere private.","Bu shaxsiy tiklash nusxasida hisobning keshlangan qaydlari va kutilayotgan o‘zgarishlar bor; kirish ma’lumotlari yo‘q. Uni maxfiy joyda saqlang.","Эта личная копия восстановления содержит кэшированные записи и ожидающие изменения, без учётных секретов. Храните её в безопасном месте."],
  discard:["Allow sign-out to discard these unsynced account changes","Hisobdan chiqishda sinxronlanmagan o‘zgarishlarni o‘chirishga ruxsat berish","Разрешить удалить эти несинхронизированные изменения при выходе"],
  pending:["Sync or export pending changes before signing out. Discard them only if you intend to lose those unsynced edits.","Chiqishdan oldin kutilayotgan o‘zgarishlarni sinxronlang yoki eksport qiling. Faqat ularni yo‘qotishga rozi bo‘lsangiz o‘chiring.","Перед выходом синхронизируйте или экспортируйте ожидающие изменения. Удаляйте их только если готовы потерять несинхронизированные правки."],
  busy:["Please wait…","Kuting…","Подождите…"],
  conflict:["Your account changed on another device, or an edit needs review. Local changes are retained. Download pending changes before leaving; retrying does not overwrite the account’s newer records.","Hisob boshqa qurilmada o‘zgargan yoki o‘zgarishni tekshirish kerak. Mahalliy o‘zgarishlar saqlangan. Chiqishdan oldin ularni yuklab oling; qayta urinish hisobdagi yangi qaydlarni almashtirmaydi.","Аккаунт изменился на другом устройстве или правка требует проверки. Локальные изменения сохранены. Скачайте ожидающие изменения перед выходом; повтор не заменяет более новые записи аккаунта."],
  failed:["This could not be completed. Your original device profile is intact. Reconnect and retry; if records changed elsewhere, review the import again.","Amalni tugatib bo‘lmadi. Asl qurilma profilingiz saqlangan. Aloqani tiklab qayta urining; qaydlar boshqa joyda o‘zgargan bo‘lsa, ko‘chirishni qayta tekshiring.","Не удалось завершить действие. Исходный профиль устройства сохранён. Подключитесь и повторите; если записи изменились на другом устройстве, проверьте импорт заново."],
  boundary:["Restore and clear apply to the device-only profile. Switch to it to use these controls. Account records on the server are not deleted by a device clear.","Tiklash va tozalash qurilma profiliga tegishli. Bu amallar uchun shu profilga o‘ting. Qurilmani tozalash serverdagi hisob qaydlarini o‘chirmaydi.","Восстановление и очистка относятся к профилю устройства. Переключитесь на него для этих действий. Очистка устройства не удаляет записи аккаунта на сервере."],
  drafts:["Drafts, running timers and location settings stay on this device. Account sync does not send them.","Qoralamalar, faol taymerlar va joylashuv sozlamalari shu qurilmada qoladi. Hisob sinxronlashi ularni yubormaydi.","Черновики, работающие таймеры и настройки местоположения остаются на устройстве и не отправляются при синхронизации."],
  session:["Session-only account data stays in memory. A save needs the server acknowledgment; offline edits may be lost if this tab closes. Export pending changes before leaving.","Seans hisobining ma’lumotlari faqat xotirada qoladi. Saqlash server tasdig‘ini talab qiladi; oyna yopilsa, oflayn o‘zgarishlar yo‘qolishi mumkin. Chiqishdan oldin ularni eksport qiling.","Данные этого сеанса хранятся в памяти. Для сохранения нужен ответ сервера; офлайн-изменения могут пропасть при закрытии вкладки. Экспортируйте их перед выходом."],
} as const;
export type SyncTextKey=keyof typeof messages;
export const syncText=(language:Language)=>(key:SyncTextKey)=>messages[key][language==="uz"?1:language==="ru"?2:0];
export function syncStatusText(language:Language,status:SyncStatus){
  if(status.error==="group_pending")return ["Group change needs confirmation","Guruh o‘zgarishini tasdiqlash kerak","Изменение группы ожидает подтверждения"][language==="uz"?1:language==="ru"?2:0];
  const key=status.phase,values:Record<typeof key,readonly[string,string,string]>={
    "saving-device":["Saving on this device…","Qurilmada saqlanmoqda…","Сохранение на устройстве…"],
    "synced":["Synced","Sinxronlandi","Синхронизировано"],"syncing":["Syncing…","Sinxronlanmoqda…","Синхронизация…"],
    "saved-device":[status.persistent?"Saved on this device · sync pending":"Waiting for server acknowledgment",status.persistent?"Qurilmada saqlandi · sinxronlash kutilmoqda":"Server tasdig‘i kutilmoqda",status.persistent?"Сохранено на устройстве · ожидает синхронизации":"Ожидаем подтверждения сервера"],
    "offline":[status.persistent?"Offline · saved on this device":"Offline · unsaved session changes",status.persistent?"Oflayn · qurilmada saqlangan":"Oflayn · seans o‘zgarishlari saqlanmagan",status.persistent?"Офлайн · сохранено на устройстве":"Офлайн · изменения сеанса не сохранены"],
    "attention":["Sync needs attention · changes retained","Sinxronlashni tekshiring · o‘zgarishlar saqlangan","Нужна проверка синхронизации · изменения сохранены"],
    "sign-in":["Sign in again to sync pending changes","Kutilayotgan o‘zgarishlar uchun qayta kiring","Войдите снова для синхронизации изменений"],
  };return values[key][language==="uz"?1:language==="ru"?2:0];
}
