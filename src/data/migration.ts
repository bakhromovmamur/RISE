import type { State } from "../model";
import { makePrayerState } from "../prayerModel";
import { makeLifeState } from "../lifeModel";
import { parseStoredState, validateState } from "./storedState";
import { object, oneOf, parseJson, zone, date } from "./validation";
import { localDate } from "../domain/calendar";

export interface ImportSummary {
  importedAt: string;
  sourceSchema: number | null;
  habits: number;
  habitChecks: number;
  prayerChecks: number;
  sampleDays: number;
  fixtureSignatures: boolean;
  provenance: "new" | "demo-or-mixed" | "unverified-legacy";
  cloudEligible: false;
}
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
/** Add only fields introduced by the known legacy schema. Never seed sample activity. */
export function migrateLegacy(raw: string): State {
  const input = object(parseJson(raw), "legacy");
  oneOf(1, 2, 3, 4)(input.schema, "schema");
  const migrated: Record<string, unknown> = { ...input, schema: 4 };
  if (input.schema === 1 && input.prayers === undefined) {
    // Validate the whole resulting profile before any calendar/domain code sees it.
    zone(input.timezone, "timezone"); date(input.demoDate, "demo date");
    const started = input.mode === "fresh" ? localDate(String(input.timezone)) : String(input.demoDate);
    migrated.prayers = makePrayerState("fresh", started, String(input.timezone), false);
  }
  if (Number(input.schema) < 3) {
    for (const [key, fallback] of Object.entries({ goals: [], personalRewards: [], dailyPriorities: {}, selectedRewardId: null })) {
      if (input[key] === undefined) migrated[key] = fallback;
    }
  }
  if (Number(input.schema) < 4 && input.life === undefined) migrated.life = makeLifeState();
  validateState(migrated);
  return migrated;
}
export async function prepareProfile(raw: string | null, initial: State) {
  const state = raw === null ? parseStoredState(JSON.stringify(initial)) : migrateLegacy(raw);
  const sampleDays = Object.values(state.prayers.days).filter(day => day.sample).length;
  const fixtureSignatures = state.habits.some(h => ["read", "walk", "english"].includes(h.id) && h.created === "2026-10-12")
    || state.life.groups.some(g => ["family", "squad"].includes(g.id) && g.members.some(m => ["amina", "aziz", "sara"].includes(m.id)));
  const summary: ImportSummary = {
    importedAt: new Date().toISOString(), sourceSchema: raw === null ? null : Number(object(parseJson(raw), "legacy").schema),
    habits: state.habits.length, habitChecks: Object.values(state.days).flat().filter(o => o.check).length,
    prayerChecks: Object.values(state.prayers.days).flatMap(day => Object.values(day.entries)).filter(p => p.check).length,
    sampleDays, fixtureSignatures,
    provenance: raw === null ? "new" : state.mode === "demo" || sampleDays > 0 || fixtureSignatures ? "demo-or-mixed" : "unverified-legacy",
    cloudEligible: false,
  };
  return { state, summary, hash: await digest(state) };
}
export type PreparedProfile = Awaited<ReturnType<typeof prepareProfile>>;
