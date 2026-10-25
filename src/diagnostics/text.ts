const copy={
  download:['Download diagnostics','Скачать диагностику','Diagnostikani yuklab olish'],
  detail:['App version and save/sync status only. No profile content.','Только версия приложения и состояние сохранения/синхронизации. Без содержимого профиля.','Faqat ilova versiyasi va saqlash/sinxronlash holati. Profil mazmunisiz.'],
  help:['Nothing is sent automatically. Review the file before sharing it privately with support.','Ничего не отправляется автоматически. Проверьте файл перед личной отправкой в поддержку.','Hech narsa avtomatik yuborilmaydi. Yordam xizmatiga shaxsiy yuborishdan oldin faylni tekshiring.'],
  failed:['Could not download diagnostics. Please try again.','Не удалось скачать диагностику. Попробуйте ещё раз.','Diagnostikani yuklab bo‘lmadi. Qayta urinib ko‘ring.'],
} as const;
export const diagnosticsText=(language:'en'|'ru'|'uz')=>(key:keyof typeof copy)=>copy[key][language==='ru'?1:language==='uz'?2:0];
