export const PRAYERS = [
  { id: "fajr", name: "Fajr" },
  { id: "dhuhr", name: "Dhuhr" },
  { id: "asr", name: "Asr" },
  { id: "maghrib", name: "Maghrib" },
  { id: "isha", name: "Isha" },
] as const;
export type PrayerId = (typeof PRAYERS)[number]["id"];
