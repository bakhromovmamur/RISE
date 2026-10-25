import { makeFixture } from "./review/fixtures";
import { addDays, checkIn, emptyDraft, ensureDays, occurrence, today, type State } from "./model";
import { ensurePriorities, reconcilePersonalRewards } from "./developmentModel";
import { clockText, ensurePrayerDays, getPrayerDay, minuteOf, PRAYERS, prayerScene, recordPrayer } from "./prayerModel";
import { addLifeDemo, alarmTimes } from "./lifeModel";
import { createTranslator, type Language } from "./i18n";

/** Only for an explicitly requested new fixture. Never use on a saved profile. */
export function localizeFixture(input: State, language: Language): State {
  const s = structuredClone(input), t = createTranslator(language);
  s.life.language = language;
  if (language !== "ru") return s;
  const textFields = new Set(["name", "title", "reason", "cue", "notes", "note", "text", "quantity", "message"]);
  function translateExample(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(translateExample); return; }
    for (const [key, item] of Object.entries(value)) {
      if (textFields.has(key) && typeof item === "string") (value as Record<string, unknown>)[key] = t(item);
      else if (key === "milestones" && Array.isArray(item) && item.every((x) => typeof x === "string"))
        (value as Record<string, unknown>)[key] = item.map((x) => t(x));
      else translateExample(item);
    }
  }
  translateExample(s);
  return s;
}

/** These examples are only installed by an explicit demo scene, never by migration. */
export function balancedFixture(scene = "balanced"): State {
  if (scene === "empty") return { ...makeFixture("fresh"), onboarded: true };
  let s = makeFixture();
  const date = today(s);
  s.prayers.demoMinute = 14 * 60;
  const draft = { ...emptyDraft(), name: "Build my little project", icon: "focus" as const, area: "Vibecoding", reason: "Turn an idea into something useful.", type: "duration" as const, unit: "minutes", full: 20, tiny: 2, cue: "One small feature before Asr" };
  s.habits.push({ id: "build", name: draft.name, icon: draft.icon, area: draft.area, reason: draft.reason, type: draft.type, unit: draft.unit, created: date, versions: [{ ...draft, effective: date }] });
  s.days[date].push(occurrence(s.habits.at(-1)!, date));
  s.days["2026-10-18"].find((o) => o.habitId === "read")!.check = "tiny";
  s = checkIn(s, "walk", "tiny");
  s.goals = [
    { id: "book", title: "Finish my current book", reason: "Give good ideas a little room in my day.", targetDate: "2026-11-08", habitIds: ["read"], createdOn: "2026-10-12", status: "active", milestones: [
      { id: "book-1", title: "Choose a book I want to return to", completedOn: "2026-10-12" },
      { id: "book-2", title: "Finish the first quarter", completedOn: date },
      { id: "book-3", title: "Reach the halfway point" },
      { id: "book-4", title: "Finish the final page" },
      { id: "book-5", title: "Write down three ideas to keep" },
    ] },
    { id: "project", title: "Launch a small vibecoded project", reason: "Make a useful thing and share it.", targetDate: "", habitIds: ["build"], createdOn: "2026-10-12", status: "active", milestones: [
      { id: "project-1", title: "Choose one problem to solve", completedOn: "2026-10-18" },
      { id: "project-2", title: "Build the first working screen" },
      { id: "project-3", title: "Let a friend try it" },
      { id: "project-4", title: "Publish the first version" },
    ] },
  ];
  s.personalRewards = [
    { id: "coffee", name: "A slow coffee at my favorite café", condition: { kind: "weekly", week: date, target: 5 }, createdOn: date },
    { id: "next-book", name: "Choose my next book", condition: { kind: "goal", goalId: "book" }, createdOn: date },
  ];
  s.selectedRewardId = "coffee";
  s.dailyPriorities[date] = [{ kind: "habit", habitId: "read" }, { kind: "habit", habitId: "build" }, { kind: "habit", habitId: "walk" }];
  if (scene === "busy") {
    const names = ["Take my scheduled pills", "Plan a weekend with family", "Practice a new skill", "Review my small business idea", "Stretch after work", "Drink a glass of water", "Tidy my desk", "Write a thoughtful message to someone I haven’t spoken to in a while"];
    names.forEach((name, i) => {
      const habit = { id: `extra-${i}`, name, icon: "leaf" as const, area: "Personal", reason: "", type: "check" as const, unit: "check-in", created: date, versions: [{ effective: date, full: 1, tiny: null, days: [0, 1, 2, 3, 4, 5, 6], cue: i === 0 ? "Follow my own prescribed schedule" : "When it fits today", reminder: "" }] };
      s.habits.push(habit);
      s.days[date].push(occurrence(habit, date));
    });
  }
  if (scene === "prayer-due") s.prayers.demoMinute = 15 * 60 + 45;
  if (scene === "completed-priority") for (const id of ["read", "build", "walk"]) s = checkIn(s, id, "full");
  if (scene === "earned-reward") {
    s.personalRewards[0].condition = { kind: "weekly", week: date, target: 3 };
    s = checkIn(checkIn(s, "read", "tiny"), "english", "full");
  }
  if (["prepare", "morning", "evening", "prayer-complete", "gap"].includes(scene)) s = prayerScene(s, scene);
  return ensurePriorities(reconcilePersonalRewards(s));
}

/** A continuous rehearsal: only explicit actions earn or complete anything. */
export function fullDayFixture(): State {
  const s = addLifeDemo(balancedFixture(), "fajr-morning"), date = today(s);
  for (const row of s.days[date]) delete row.check;
  for (const goal of s.goals) for (const milestone of goal.milestones) {
    if (milestone.completedOn === date) delete milestone.completedOn;
  }
  const coffee = s.personalRewards.find((reward) => reward.id === "coffee")!;
  coffee.condition = { kind: "weekly", week: date, target: 3 };
  s.prayers.prepared[date] = { ...s.prayers.fajr };
  return reconcilePersonalRewards(s);
}

/** Prior fictional accomplishments stay visible; this day's setbacks require explicit records. */
export function difficultDayFixture(): State {
  let s = fullDayFixture();
  const previous = today(s);
  s.prayers.demoMinute = 22 * 60;
  for (const { id } of PRAYERS) s = recordPrayer(s, previous, id, "on_time");
  s = checkIn(checkIn(checkIn(s, "read", "full"), "walk", "tiny"), "build", "full");
  s.claimed = [...new Set([...s.claimed, 250])];
  s.equipped = 250;
  s.goals.find((goal) => goal.id === "project")!.milestones.find((m) => m.id === "project-2")!.completedOn = previous;
  s = reconcilePersonalRewards(s);
  s.demoDate = addDays(previous, 1);
  s.prayers.demoMinute = 8 * 60;
  s.prayers.work = null;
  s.prayers.prepared[s.demoDate] = { ...s.prayers.fajr };
  return ensurePriorities(ensurePrayerDays(ensureDays(s)));
}

export function demoCheckpoints(s: State) {
  const day = getPrayerDay(s, today(s));
  if (!day) return [];
  return [
    { time: alarmTimes(s, today(s))!.wake, label: "Fajr · wake-up" },
    { time: clockText(minuteOf(day.entries.fajr.target) + 15), label: "After Fajr · record your prayer" },
    { time: "08:00", label: "Morning · reading & a walk" },
    ...PRAYERS.filter(({ id }) => id !== "fajr").flatMap(({ id, name }) => [
      ...(id === "asr" ? [{ time: clockText(minuteOf(day.entries.asr.target) - s.prayers.preferences.leadMinutes), label: "Before Asr · save your work" }] : []),
      { time: day.entries[id].target, label: name },
    ]),
    { time: clockText(minuteOf(day.entries.asr.ends) + 15), label: "After Asr’s window · return to your day" },
    { time: "20:30", label: "Family time & rewards" },
    { time: "22:00", label: "Bedtime · prepare for Fajr" },
  ].sort((a, b) => minuteOf(a.time) - minuteOf(b.time));
}
