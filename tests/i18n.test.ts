import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator, formatDisplayDate } from "../src/i18n";
import { balancedFixture, localizeFixture } from "../src/demo";
import { addLifeDemo } from "../src/lifeModel";
import { migrateState } from "../src/developmentModel";
import { emptyDraft, xpTotal } from "../src/model";
import { validateTimetable } from "../src/prayerModel";
import { ru } from "../src/messages.ru";
import { uz } from "../src/messages.uz";
import { recoveryDescription } from "../src/sync/Recovery";
import { parseSyncOperation } from "../src/contracts/sync";

test("recovery summaries translate prayer names and units without rewriting the reviewed intent", () => {
  const state = balancedFixture(), original = structuredClone(state);
  const base = {protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:1,context:{now:Date.parse("2026-10-19T08:00:00Z"),date:"2026-10-19",timezone:state.timezone}};
  const prayer = parseSyncOperation({...base,command:{kind:"prayer.record",date:"2026-10-19",prayer:"fajr",check:"on_time"}});
  assert.equal(recoveryDescription(state,prayer,"uz",true), "Namoz qaydi · 2026-10-19 · Bomdod · O‘z vaqtida");
  assert.match(recoveryDescription(state,prayer,"ru",true), /Фаджр/);
  const habit = parseSyncOperation({...base,command:{kind:"habit.save",newId:crypto.randomUUID(),draft:{...emptyDraft(),name:"Today",cue:"Save",type:"count",full:2,unit:"pages"}}});
  const before = structuredClone(habit);
  assert.equal(recoveryDescription(state,habit,"uz",true), "Today · 2 sahifa · Save");
  assert.equal(recoveryDescription(state,habit,"ru",true), "Today · 2 страницы · Save");
  assert.deepEqual(habit,before);
  assert.deepEqual(state,original);
});

test("Uzbek fallback covers the shared catalog and preserves explicit copy and authored interpolation", () => {
  const t = createTranslator("uz");
  assert.deepEqual(Object.keys(uz).sort(), Object.keys(ru).sort());
  assert.equal(Object.values(uz).some(value => !value.trim()), false);
  assert.equal(t(" Save goal "), " Maqsadni saqlash ");
  assert.equal(t("Save goal", "Maqsadni saqlab qo‘yish"), "Maqsadni saqlab qo‘yish");
  assert.equal(t("Goal {0}", undefined, ["Today · Мой план · O‘zimning rejam"]), "Maqsad Today · Мой план · O‘zimning rejam");
  assert.equal(t("{0} milestone{1} completed {2}", undefined, [2, "s", "shu hafta"]), "2 ta bosqich bajarildi shu hafta");
  assert.equal(t("A small step\nis a fresh start."), "Kichik qadam — yangi boshlanish.");
  assert.equal(createTranslator("en")("Save goal"), "Save goal");
  assert.equal(createTranslator("ru")("Save goal"), ru["Save goal"]);
});

test("Uzbek targets localize known measurements without translating custom units or changing quantities", () => {
  const t = createTranslator("uz");
  assert.equal(t.target({type:"count", unit:"pages", full:21}), "21 sahifa");
  assert.equal(t.target({type:"duration", unit:"minutes", full:10}, 1.5), `${t.number(1.5)} daqiqa`);
  assert.equal(t.target({type:"count", unit:"sentences", full:3}), "3 jumla");
  assert.equal(t.target({type:"check", unit:"check-in", full:1}), "Bitta qayd");
  assert.equal(t.target({type:"count", unit:"My custom steps", full:1}), "1 My custom steps");
  assert.equal(t.unit("Today"), "Today");
  assert.equal(t.unitKey("Today"), "Today");
  assert.equal(t.unit(t.unitKey("daqiqa")), "daqiqa");
  assert.equal(t.error("Enter all three times for Fajr."), "Bomdod uchun uchala vaqtni kiriting.");
  assert.equal(t.error("Check the overlapping windows for Dhuhr and Asr."), "Peshin va Asrning ustma-ust kelgan oraliqlarini tekshiring.");
});

test("Russian numbers, dates, weekdays and counts use Russian grammar", () => {
  const t = createTranslator("ru");
  for (const [value, word] of [[1,"минута"],[2,"минуты"],[5,"минут"],[11,"минут"],[21,"минута"],[22,"минуты"],[25,"минут"],[1.5,"минут"]] as const)
    assert.equal(t("{0} minutes", undefined, [value]), `${t.number(value)} ${word}`);
  assert.equal(t.target({type:"count",unit:"pages",full:21}), "21 страница");
  assert.equal(t.target({type:"count",unit:"страниц",full:2}), "2 страницы");
  assert.equal(t.date("2026-10-19"), "19 октября");
  assert.equal(t.weekday(1), "понедельник");
  assert.equal(t.number(10.5), "10,5");
  assert.equal(createTranslator("en").weekday(1,true), "M");
  assert.equal(createTranslator("uz")("Today", "Bugun"), "Bugun");
});
test("Uzbek display dates retain civil dates, selected timezones and DST while supplying readable calendar labels", () => {
  const t = createTranslator("uz");
  assert.equal(t.date("2026-10-19", { month: "short", day: "numeric", weekday: "short" }), "Dush 19 okt");
  assert.equal(t.week("2026-10-19"), "19 okt–25 okt");
  assert.equal(t.weekday(1), "dushanba");
  const instant = new Date("2026-01-01T01:30:00Z"), original = instant.getTime();
  const when = (timeZone: string) => formatDisplayDate(instant, "uz", { timeZone, dateStyle: "full", timeStyle: "short" });
  assert.equal(when("America/Los_Angeles"), "chorshanba, 31 dekabr 2025, 17:30");
  assert.equal(when("Asia/Tashkent"), "payshanba, 1 yanvar 2026, 06:30");
  assert.equal(when("Pacific/Kiritimati"), "payshanba, 1 yanvar 2026, 15:30");
  assert.equal(instant.getTime(), original);
  const dst = { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  assert.equal(formatDisplayDate(new Date("2026-03-08T06:59:00Z"), "uz", dst), "01:59");
  assert.equal(formatDisplayDate(new Date("2026-03-08T07:00:00Z"), "uz", dst), "03:00");
  const months = Array.from({ length: 12 }, (_, month) => t.date(`2026-${String(month + 1).padStart(2, "0")}-01`, { month: "long" }));
  assert.equal(new Set(months).size, 12);
  assert.equal(months[9], "oktabr");
  assert.doesNotMatch(months.join(" "), /\bM\d{1,2}\b/);
});
test("display formatting preserves existing English and Russian output", () => {
  const date = new Date("2026-10-24T12:30:00Z");
  for (const language of ["en", "ru"] as const) for (const timeZone of ["Asia/Tashkent", "America/New_York"]) {
    const options = { timeZone, dateStyle: "medium", timeStyle: "short" } as const;
    assert.equal(formatDisplayDate(date, language, options), new Intl.DateTimeFormat(language, options).format(date));
  }
});
test("explicit Russian demo creation localizes example content without altering achievement calculations", () => {
  const original = addLifeDemo(balancedFixture());
  const ru = localizeFixture(original,"ru");
  assert.equal(original.life.language,"en");
  assert.equal(ru.life.language,"ru");
  assert.equal(ru.habits[0].name,"Немного почитать");
  assert.equal(ru.life.lists[0].items[0].text,"Яблоки");
  assert.equal(xpTotal(ru),xpTotal(original));
  assert.deepEqual(ru.dailyPriorities,original.dailyPriorities);
  assert.deepEqual(ru.prayers.days,original.prayers.days);
  assert.deepEqual(ru.habits.map(h=>[h.id,h.icon,h.area,h.unit]),original.habits.map(h=>[h.id,h.icon,h.area,h.unit]));
});
test("saved profiles migrate without translating user content or resetting Russian preference", () => {
  const s = addLifeDemo(balancedFixture());
  s.life.language="ru"; s.habits[0].name="Today"; s.life.tasks[0].notes="Save";
  const migrated=migrateState(s);
  assert.deepEqual(migrated,s);
  assert.deepEqual(migrateState(migrated),migrated);
});
test("timetable errors localize dynamic prayer names while leaving domain validation unchanged", () => {
  const day=balancedFixture().prayers.days["2026-10-19"], t=createTranslator("ru");
  day.entries.asr.target="23:00";
  const error=validateTimetable(day);
  assert.equal(error,"Asr’s planned time must be inside its entered window.");
  assert.match(t.error(error),/Аср/);
  assert.doesNotMatch(t.error(error),/[A-Za-z]/);
  day.entries.fajr.begins="bad";
  assert.equal(t.error(validateTimetable(day)),"Укажите все три времени: Фаджр.");
});
