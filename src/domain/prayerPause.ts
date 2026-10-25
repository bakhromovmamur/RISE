import type { State } from "../model";
import { PRAYERS, type PrayerId } from "./prayerIds";
import { addDays } from "./calendar";

export const prayerKey = (date: string, id: PrayerId) => `${date}:${PRAYERS.findIndex((p) => p.id === id)}`;
export const activePause = (s: State) => s.life.pauses.find((p) => !p.through);
export function isPrayerExcluded(s: State, date: string, id: PrayerId) {
  if (s.prayers.days[date]?.entries[id].check) return false;
  const key = prayerKey(date, id);
  return s.life?.pauses.some((p) => p.from <= key && (!p.through || key <= p.through)) ?? false;
}
export function startPause(s: State, date: string, id: PrayerId, pauseId: string = crypto.randomUUID()): State {
  if (activePause(s)) return s;
  return { ...s, life: { ...s.life, alarm: null, pauses: [...s.life.pauses, { id: pauseId, from: prayerKey(date, id) }] } };
}
export function resumePrayers(s: State, date: string, id: PrayerId, includeCurrent = true): State {
  if (!activePause(s) || s.life.pauses.some(p => !p.through && prayerKey(date, id) < p.from)) return s;
  const index = PRAYERS.findIndex((p) => p.id === id);
  const through = includeCurrent
    ? index === 0 ? prayerKey(addDays(date, -1), "isha") : prayerKey(date, PRAYERS[index - 1].id)
    : prayerKey(date, id);
  return { ...s, life: { ...s.life, pauses: s.life.pauses.flatMap((p) => p.through ? [p] : through < p.from ? [] : [{ ...p, through }]) } };
}

