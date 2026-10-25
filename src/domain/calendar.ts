import type { State } from "../model";

export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekday = (date: string) =>
  new Date(date + "T12:00:00Z").getUTCDay();
export const localDate = (zone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const today = (s: State) =>
  s.mode === "demo" ? s.demoDate : localDate(s.timezone);
export const formatDate = (
  date: string,
  opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    ...opts,
    timeZone: "UTC",
  });
export const weekStart = (date: string) =>
  addDays(date, -((weekday(date) + 6) % 7));
