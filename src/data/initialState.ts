import type { State } from "../model";
import { localDate } from "../domain/calendar";
import { makePrayerState } from "../prayerModel";
import { makeLifeState } from "../lifeModel";

export function createEmptyState(): State {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = localDate(timezone);
  return {
    schema: 4,
    mode: "fresh",
    demoDate: date,
    timezone,
    name: "Friend",
    onboarded: false,
    habits: [],
    days: {},
    claimed: [],
    equipped: null,
    plus: false,
    prefs: {
      appearance: "system",
      reminders: false,
      quietStart: "22:00",
      quietEnd: "08:00",
      sound: false,
      haptics: false,
      reduceMotion: false,
      golden: false,
    },
    reflections: {},
    timer: null,
    draft: null,
    prayers: makePrayerState("fresh", date, timezone),
    goals: [],
    personalRewards: [],
    dailyPriorities: {},
    selectedRewardId: null,
    life: makeLifeState(),
  };
}
