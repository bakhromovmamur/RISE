import type { Language } from "../i18n";
import type { JourneySession } from "./journeySession";
import { syncStatusText } from "../sync/text";
import { STORAGE_KEY } from "../model";
import { DATABASE_NAME } from "./indexedDb";

const copy = {
  en: { title: "Your saved data needs attention", blocked: "RISE has paused changes to protect your saved data. Download a recovery copy, then retry.", conflict: "Another tab saved changes first. Your unsaved changes are still available to export. Reload the saved copy to continue.", retry: "Retry", export: "Download recovery copy", pending: "Export unsaved changes", reload: "Reload saved copy", confirm: "Discard this tab’s unsaved changes and load the saved copy? Export them first if you want to keep them.", summary: "Existing data preserved", mixed: "This profile contains sample or mixed history. Everything stays on this device. Review and consent will be required before any future cloud import.", legacy: "Your existing profile was preserved. Its origin is unverified; future cloud import requires review and consent.", date: "Migrated", habits: "Habits", checks: "Habit check-ins", prayers: "Prayer records", saved: "Saved on this device", saving: "Saving on this device", failedExport: "The recovery copy could not be read. Keep this tab open and retry." },
  ru: { title: "Сохранённые данные требуют внимания", blocked: "RISE приостановил изменения, чтобы защитить данные. Скачайте копию для восстановления и повторите попытку.", conflict: "Другая вкладка сохранила изменения первой. Ваши несохранённые изменения доступны для экспорта. Загрузите сохранённую копию, чтобы продолжить.", retry: "Повторить", export: "Скачать копию для восстановления", pending: "Экспорт несохранённых изменений", reload: "Загрузить сохранённую копию", confirm: "Отменить несохранённые изменения этой вкладки и загрузить сохранённую копию? Сначала экспортируйте их, если хотите сохранить.", summary: "Прежние данные сохранены", mixed: "В профиле есть демонстрационная или смешанная история. Всё остаётся на этом устройстве. Перед будущим импортом в облако потребуются проверка и согласие.", legacy: "Прежний профиль сохранён. Происхождение данных не подтверждено; будущий импорт в облако требует проверки и согласия.", date: "Перенесено", habits: "Привычки", checks: "Отметки привычек", prayers: "Записи молитв", saved: "Сохранено на этом устройстве", saving: "Сохранение на этом устройстве", failedExport: "Не удалось прочитать копию для восстановления. Оставьте вкладку открытой и повторите попытку." },
  uz: { title: "Saqlangan ma’lumotlarni tekshirish kerak", blocked: "Ma’lumotlaringizni himoyalash uchun RISE o‘zgarishlarni to‘xtatdi. Tiklash nusxasini yuklab oling va qayta urinib ko‘ring.", conflict: "Boshqa oyna o‘zgarishlarni avval saqladi. Saqlanmagan o‘zgarishlaringizni eksport qilishingiz mumkin. Davom etish uchun saqlangan nusxani yuklang.", retry: "Qayta urinish", export: "Tiklash nusxasini yuklab olish", pending: "Saqlanmagan o‘zgarishlarni eksport qilish", reload: "Saqlangan nusxani yuklash", confirm: "Bu oynadagi saqlanmagan o‘zgarishlar bekor qilinib, saqlangan nusxa yuklansinmi? Ularni saqlash uchun avval eksport qiling.", summary: "Avvalgi ma’lumotlar saqlandi", mixed: "Bu profilda namuna yoki aralash tarix bor. Barchasi shu qurilmada qoladi. Kelajakda bulutga ko‘chirishdan oldin tekshirish va rozilik talab qilinadi.", legacy: "Avvalgi profilingiz saqlandi. Ma’lumotlarning kelib chiqishi tasdiqlanmagan; bulutga ko‘chirish tekshirish va rozilikni talab qiladi.", date: "Ko‘chirildi", habits: "Odatlar", checks: "Odat belgilari", prayers: "Namoz qaydlari", saved: "Shu qurilmada saqlandi", saving: "Shu qurilmada saqlanmoqda", failedExport: "Tiklash nusxasini o‘qib bo‘lmadi. Bu oynani ochiq qoldirib, qayta urinib ko‘ring." },
};
export function downloadRecovery(raw: string, name = "rise-recovery.txt") {
  const url = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportRecovery(session?: JourneySession) {
  const raw = session ? await session.original() : localStorage.getItem(STORAGE_KEY);
  if (raw !== null) { downloadRecovery(raw); return; }
  await exportDeviceRecovery();
}
export async function exportDeviceRecovery() {
  // Read unvalidated records for recovery when the schema itself is damaged/newer.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    const recovered: Record<string, unknown> = {};
    for (const name of Array.from(db.objectStoreNames)) {
      recovered[name] = await new Promise((resolve, reject) => {
        const request = db.transaction(name, "readonly").objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    }
    downloadRecovery(JSON.stringify(recovered), "rise-device-recovery.json");
  } finally { db.close(); }
}
export function StorageRecovery({ session, retry }: { session?: JourneySession; retry?: () => void }) {
  const language: Language = session?.getSnapshot().state.life.language ?? (navigator.language.startsWith("ru") ? "ru" : navigator.language.startsWith("uz") ? "uz" : "en");
  const t = copy[language];
  const invalidEdit = session?.getSnapshot().error === "invalid-edit";
  return <main className="app-shell" data-theme={session?.getSnapshot().state.prefs.appearance === "dark" ? "dark" : "light"} lang={language}>
    <div className="storage-warning storage-recovery" role="alert">
      <h1>{t.title}</h1><p>{invalidEdit ? ({ en: "This edit does not meet the saved-data limits. Export your unsaved changes, then reload the saved copy to continue.", ru: "Это изменение не соответствует ограничениям данных. Экспортируйте несохранённые изменения, затем загрузите сохранённую копию.", uz: "Bu o‘zgarish ma’lumot cheklovlariga mos kelmaydi. Saqlanmagan o‘zgarishlarni eksport qiling, keyin saqlangan nusxani yuklang." })[language] : session?.getSnapshot().error === "conflict" ? t.conflict : t.blocked}</p>
      <button onClick={() => { void exportRecovery(session).catch(() => window.alert(t.failedExport)); }}>{t.export}</button>
      <button onClick={() => { void exportDeviceRecovery().catch(() => window.alert(t.failedExport)); }}>
        {({ en: "Export device recovery archive", ru: "Экспорт архива устройства", uz: "Qurilma tiklash arxivini eksport qilish" })[language]}
      </button>
      {session && <button onClick={() => downloadRecovery(session.pendingExport(), "rise-unsaved.json")}>{t.pending}</button>}
      {!invalidEdit && <button onClick={() => { if (session) void session.retry(); else retry?.(); }}>{t.retry}</button>}
      {session && <button onClick={() => { if (window.confirm(t.confirm)) void session.reloadSaved(); }}>{t.reload}</button>}
    </div>
  </main>;
}
export function StorageSummary({ session }: { session: JourneySession }) {
  const t = copy[session.getSnapshot().state.life.language], summary = session.summary;
  if (summary.provenance === "new") return null;
  return <details className="settings-disclosure"><summary>{t.summary}</summary>
    <p>{summary.provenance === "demo-or-mixed" ? t.mixed : t.legacy}</p>
    <p>{t.date}: {summary.importedAt.slice(0, 10)} · {t.habits}: {summary.habits} · {t.checks}: {summary.habitChecks} · {t.prayers}: {summary.prayerChecks}</p>
    <button className="storage-recovery-download" onClick={() => { void exportRecovery(session).catch(() => window.alert(t.failedExport)); }}>{t.export}</button>
  </details>;
}
export function StorageStatus({ session, visible = false }: { session: JourneySession; visible?: boolean }) {
  const view = session.getSnapshot(), t = copy[view.state.life.language];
  const account=session.accountStatus?.();
  if(account)return<span className="fine-print" role="status">{syncStatusText(view.state.life.language,view.status==="saving"?{...account,phase:account.persistent?"saving-device":"saved-device"}:account)}</span>;
  return <span className={visible ? "fine-print" : "sr-only"} role="status">{view.status === "saved" ? t.saved : t.saving}</span>;
}
