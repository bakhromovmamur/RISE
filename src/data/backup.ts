import { xpTotal, type State } from "../model";
import { migrateLegacy, prepareProfile, type ImportSummary } from "./migration";
import { projectBackup, validateArchives, type BackupContent, type LocalArchive } from "./backupProjection";
import { validateState } from "./storedState";
import * as v from "./validation";

export const BACKUP_FORMAT = "rise.private-backup";
export interface BackupCounts {
  habits: number; habitChecks: number; prayerChecks: number; goals: number; rewards: number;
  groups: number; tasks: number; lists: number; updates: number; drafts: number;
}
export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT; version: 1; schemaVersion: 4; exportedAt: string; timezone: string;
  counts: BackupCounts; data: BackupContent; checksum: { algorithm: "SHA-256"; value: string };
}
export interface BackupSnapshot { state: State; archives: LocalArchive[]; revision: number }
export interface RestorePreview {
  content: BackupContent; hash: string; summary: ImportSummary; baseRevision: number;
  source: "backup" | "legacy" | "recovery"; exportedAt: string | null; counts: BackupCounts;
  dates: { first: string | null; last: string | null }; xp: number; currentXp: number;
  changes: { matching: number; conflicting: number; added: number; removed: number };
  filtered: boolean;
  accountExport?: boolean;
}

/** Stable key ordering permits harmless formatting changes. This is not authentication. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function contentHash(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function countsOf({ personal: s, localArchives }: BackupContent): BackupCounts {
  return {
    habits: s.habits.length, habitChecks: Object.values(s.days).reduce((n, rows) => n + rows.filter(o => o.check).length, 0),
    prayerChecks: Object.values(s.prayers.days).reduce((n, d) => n + Object.values(d.entries).filter(e => e.check).length, 0),
    goals: s.goals.length, rewards: s.personalRewards.length, drafts: Object.keys(s.life.drafts).length,
    groups: localArchives.reduce((n, a) => n + a.groups.length, 0), tasks: localArchives.reduce((n, a) => n + a.tasks.length, 0),
    lists: localArchives.reduce((n, a) => n + a.lists.length, 0), updates: localArchives.reduce((n, a) => n + a.updates.length, 0),
  };
}
function datesOf({ personal: s, localArchives }: BackupContent) {
  const dates = [
    ...Object.keys(s.days), ...Object.keys(s.prayers.days), ...Object.keys(s.prayers.prepared), ...Object.keys(s.reflections), ...Object.keys(s.dailyPriorities),
    ...s.habits.flatMap(h => [h.created, h.archivedAt, ...h.versions.map(v => v.effective)]),
    ...s.goals.flatMap(g => [g.createdOn, g.targetDate, g.completedOn, g.archivedOn, ...g.milestones.map(m => m.completedOn)]),
    ...s.personalRewards.flatMap(r => [r.createdOn, r.earnedOn, r.enjoyedOn, r.correctedOn, r.archivedOn, r.condition.kind === "weekly" ? r.condition.week : undefined]),
    ...s.life.pauses.flatMap(p => [p.from.slice(0, 10), p.through?.slice(0, 10)]),
    ...localArchives.flatMap(a => [...a.tasks.flatMap(t => [t.date, ...Object.keys(t.completions)]), ...a.updates.map(u => u.week)]),
  ].filter((d): d is string => typeof d === "string" && d.length === 10).sort();
  return { first: dates[0] ?? null, last: dates.at(-1) ?? null };
}
function records(content: BackupContent): Map<string, string> {
  const s = content.personal, result = new Map<string, string>();
  const add = (key: string, value: unknown) => result.set(key, canonical(value));
  add("settings", { ...s, habits: [], days: {}, goals: [], personalRewards: [], dailyPriorities: {}, reflections: {}, prayers: { ...s.prayers, days: {}, prepared: {} }, life: { ...s.life, pauses: [] } });
  s.habits.forEach(h => add(`habit:${h.id}`, h));
  Object.entries(s.days).forEach(([date, rows]) => rows.forEach(row => add(`habit-day:${date}:${row.habitId}`, row)));
  Object.entries(s.prayers.days).forEach(([date, row]) => add(`prayer-day:${date}`, row));
  for (const key of ["reflections", "dailyPriorities"] as const) Object.entries(s[key]).forEach(([date, row]) => add(`${key}:${date}`, row));
  Object.entries(s.prayers.prepared).forEach(([date, row]) => add(`fajr:${date}`, row));
  for (const key of ["goals", "personalRewards"] as const) s[key].forEach(row => add(`${key}:${row.id}`, row));
  s.life.pauses.forEach(row => add(`pause:${row.id}`, row));
  content.localArchives.forEach((a, i) => { for (const key of ["groups", "tasks", "lists", "updates"] as const) a[key].forEach(row => add(`archive:${i}:${key}:${row.id}`, row)); });
  return result;
}
function changesBetween(current: BackupContent, incoming: BackupContent) {
  const before = records(current), after = records(incoming), changes = { matching: 0, conflicting: 0, added: 0, removed: 0 };
  after.forEach((value, key) => { if (!before.has(key)) changes.added++; else if (value === before.get(key)) changes.matching++; else changes.conflicting++; });
  before.forEach((_, key) => { if (!after.has(key)) changes.removed++; });
  return changes;
}
export async function createBackup(snapshot: BackupSnapshot): Promise<string> {
  const data = projectBackup(snapshot.state, snapshot.archives);
  const payload = { format: BACKUP_FORMAT, version: 1, schemaVersion: 4, exportedAt: new Date().toISOString(), timezone: data.personal.timezone, counts: countsOf(data), data } as const;
  const envelope: BackupEnvelope = { ...payload, checksum: { algorithm: "SHA-256", value: await contentHash(payload) } };
  const raw = JSON.stringify(envelope);
  v.parseJson(raw); // An export must fit the same limits as its restore path.
  return raw;
}
export async function previewRestore(raw: string, current: BackupSnapshot): Promise<RestorePreview> {
  const input = v.object(v.parseJson(raw), "backup");
  if(input.format==="rise.account-export"){
    const {parseAccountExport}=await import("../account/export");
    const envelope=await parseAccountExport(raw);
    return {...await previewRestore(JSON.stringify(envelope.backup),current),accountExport:true};
  }
  let state: State, archives: LocalArchive[] = [], source: RestorePreview["source"], exportedAt: string | null = null;
  if (input.format !== undefined) {
    v.oneOf(BACKUP_FORMAT)(input.format, "backup format"); v.oneOf(1)(input.version, "backup version"); v.oneOf(4)(input.schemaVersion, "schema version");
    v.instant(input.exportedAt, "export time"); v.zone(input.timezone, "export timezone");
    const checksum = v.object(input.checksum, "checksum"), data = v.object(input.data, "data");
    v.oneOf("SHA-256")(checksum.algorithm, "checksum algorithm"); v.string(64, /^[a-f0-9]{64}$/)(checksum.value, "checksum");
    const { checksum: _, ...payload } = input;
    if (await contentHash(payload) !== checksum.value) throw new v.StoredDataError("checksum mismatch");
    validateState(data.personal); validateArchives(data.localArchives, data.personal);
    state = data.personal; archives = data.localArchives; source = "backup"; exportedAt = String(input.exportedAt);
    const normalized = projectBackup(state, archives);
    if (input.timezone !== state.timezone || canonical(input.counts) !== canonical(countsOf(normalized)) || canonical(data) !== canonical(normalized)) throw new v.StoredDataError("backup contents");
  } else { state = migrateLegacy(raw); source = "legacy"; }
  const content = projectBackup(state, archives), prepared = await prepareProfile(JSON.stringify(content.personal), content.personal);
  if (source === "legacy") prepared.summary.sourceSchema = Number(input.schema);
  return {
    content, hash: await contentHash(content), summary: prepared.summary, baseRevision: current.revision, source, exportedAt,
    counts: countsOf(content), dates: datesOf(content), xp: xpTotal(content.personal), currentXp: xpTotal(current.state),
    changes: changesBetween(projectBackup(current.state, current.archives), content),
    filtered: source === "legacy" && canonical(state) !== canonical(content.personal),
  };
}

/** Recheck the staged payload at the persistence boundary, even after worker validation. */
export async function validateRestore(preview: RestorePreview) {
  v.validateJson(preview); validateState(preview.content.personal); validateArchives(preview.content.localArchives, preview.content.personal);
  if (canonical(projectBackup(preview.content.personal, preview.content.localArchives)) !== canonical(preview.content)
    || await contentHash(preview.content) !== preview.hash) throw new v.StoredDataError("staged backup changed");
  v.number(0, Number.MAX_SAFE_INTEGER, true)(preview.baseRevision, "base revision");
}
