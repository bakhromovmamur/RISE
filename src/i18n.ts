import { ru } from "./messages.ru";
import { uz as uzbekMessages } from "./messages.uz";

export type Language = "en" | "uz" | "ru";
export type MessageValue = string | number | null | undefined;
const locales: Record<Language, string> = { en: "en-US", uz: "uz-Latn-UZ", ru: "ru-RU" };
const russianPlurals = new Intl.PluralRules("ru-RU");
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const shortMonths = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const weekdays = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const shortWeekdays = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

/** UI formatting only: Intl retains the requested instant/timezone. Its Uzbek
 * data is incomplete in Chromium, so supply calendar labels over a supported
 * day/month/year format. Never apply this formatter to authored text. */
export function formatDisplayDate(value: Date | number, language: Language, options: Intl.DateTimeFormatOptions): string {
  if (language !== "uz") return new Intl.DateTimeFormat(locales[language], options).format(value);
  const monthWidth = options.month ?? (options.dateStyle === "long" || options.dateStyle === "full" ? "long" : "short");
  const weekdayWidth = options.weekday ?? "long";
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...options,
    ...(options.month === "narrow" ? { month: "long" } : {}),
    ...(options.weekday === "narrow" ? { weekday: "long" } : {}),
  }).formatToParts(value);
  return parts.map(part => {
    if (part.type === "month") {
      const index = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(part.value.slice(0, 3));
      if (index >= 0) return monthWidth === "narrow" ? months[index][0].toUpperCase() : (monthWidth === "long" ? months : shortMonths)[index];
    }
    if (part.type === "weekday") {
      const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part.value.slice(0, 3));
      if (index >= 0) return weekdayWidth === "narrow" ? weekdays[index][0].toUpperCase() : (weekdayWidth === "long" ? weekdays : shortWeekdays)[index];
    }
    if (part.type === "dayPeriod") return part.value.toLowerCase() === "am" ? "TO" : part.value.toLowerCase() === "pm" ? "TK" : part.value;
    if (part.type === "literal" && /\bat\b/.test(part.value)) return ", ";
    return part.value;
  }).join("");
}

/** Pure, render-time localization. Never translates or rewrites saved user content. */
export function createTranslator(language: Language) {
  const number = (value: number) => new Intl.NumberFormat(locales[language], { maximumFractionDigits: 2 }).format(value);
  const plural = (value: number, one: string, few: string, many: string) => {
    const form = russianPlurals.select(value);
    return form === "one" ? one : form === "few" ? few : many;
  };
  const t = (en: string, uz?: string, values: readonly MessageValue[] = []): string => {
    const translated = language === "ru" ? ru[normalize(en)] : language === "uz" ? uz ?? uzbekMessages[normalize(en)] : undefined;
    const text = translated === undefined ? en : `${/^\s/.test(en) ? " " : ""}${translated}${/\s$/.test(en) ? " " : ""}`;
    return text.replace(/\{(\d+)(?:\|([^{}|]+)\|([^{}|]+)\|([^{}|]+))?\}/g, (token, index, one, few, many) => {
      const value = values[Number(index)];
      if (value === undefined) return values.length ? "" : token;
      if (one) return plural(Number(value), one, few, many);
      return typeof value === "number" && language === "ru" ? number(value) : String(value ?? "");
    });
  };
  const date = (value: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }) =>
    formatDisplayDate(new Date(`${value}T12:00:00Z`), language, { ...options, timeZone: "UTC" });
  const shortDate = (value: string) => date(value, { month: "short", day: "numeric" });
  const week = (value: string) => {
    const end = new Date(`${value}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6);
    return `${shortDate(value)}–${shortDate(end.toISOString().slice(0, 10))}`;
  };
  const units: Record<string, [string, string, string]> = {
    page: ["страница", "страницы", "страниц"], pages: ["страница", "страницы", "страниц"],
    minute: ["минута", "минуты", "минут"], minutes: ["минута", "минуты", "минут"],
    session: ["занятие", "занятия", "занятий"], sessions: ["занятие", "занятия", "занятий"],
    glass: ["стакан", "стакана", "стаканов"], glasses: ["стакан", "стакана", "стаканов"],
    step: ["шаг", "шага", "шагов"], steps: ["шаг", "шага", "шагов"],
    time: ["раз", "раза", "раз"], times: ["раз", "раза", "раз"],
  };
  const uzbekUnits: Record<string, string> = {
    page: "sahifa", pages: "sahifa", minute: "daqiqa", minutes: "daqiqa",
    session: "mashg‘ulot", sessions: "mashg‘ulot", glass: "stakan", glasses: "stakan",
    step: "qadam", steps: "qadam", time: "marta", times: "marta",
    sentence: "jumla", sentences: "jumla", "check-in": "qayd",
  };
  const unit = (value: string) => language === "uz" ? uzbekUnits[value] ?? value : language === "ru" && units[value] ? units[value][2] : language === "ru" && value === "check-in" ? t(value) : value;
  const unitKey = (value: string) => language === "uz" ? Object.keys(uzbekUnits).find(key => uzbekUnits[key] === value.trim()) ?? value : language === "ru" ? Object.keys(units).find((key) => units[key].includes(value.trim())) ?? value : value;
  const target = (item: { type: string; full: number; unit: string }, tiny?: number | null) => {
    if (item.type === "check") return t(tiny != null ? "A tiny version" : "One check-in");
    const value = tiny ?? item.full;
    if (language === "uz") return `${number(value)} ${unit(item.unit)}`;
    const forms = units[unitKey(item.unit)];
    if (language === "ru" && forms) return `${number(value)} ${plural(value, ...forms)}`;
    return `${value} ${value === 1 ? item.unit.replace(/s$/, "") : item.unit}`;
  };
  const weekday = (index: number, short = false) => date(`2026-10-${18 + index}`, { weekday: short ? language === "en" ? "narrow" : "short" : "long" });
  // Domain validation keeps its language-neutral behavior; only its known messages
  // are formatted here. Never run this formatter on user-authored content.
  const error = (message: string) => {
    const patterns: [RegExp, string][] = [
      [/^Enter all three times for (Fajr|Dhuhr|Asr|Maghrib|Isha)\.$/, "Enter all three times for {0}."],
      [/^Check the end time for (Fajr|Dhuhr|Asr|Maghrib|Isha)\.$/, "Check the end time for {0}."],
      [/^(Fajr|Dhuhr|Asr|Maghrib|Isha)’s planned time must be inside its entered window\.$/, "{0}’s planned time must be inside its entered window."],
      [/^Check the overlapping windows for (Fajr|Dhuhr|Asr|Maghrib|Isha) and (Fajr|Dhuhr|Asr|Maghrib|Isha)\.$/, "Check the overlapping windows for {0} and {1}."],
    ];
    for (const [pattern, key] of patterns) {
      const match = message.match(pattern);
      if (match) return t(key, undefined, match.slice(1).map((name) => t(name)));
    }
    const uzbek: Record<string, string> = {
      "Choose a valid date.": "To‘g‘ri sanani tanlang.",
      "These times do not exist on this date in the selected time zone. Check the date, time zone and timetable.": "Tanlangan vaqt mintaqasida bu sanada bunday vaqt mavjud emas. Sana, vaqt mintaqasi va jadvalni tekshiring.",
    };
    return t(message, uzbek[message]);
  };
  return Object.assign(t, { language, number, plural, date, shortDate, week, target, weekday, error, unit, unitKey });
}
export type Translator = ReturnType<typeof createTranslator>;
