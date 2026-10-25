import { parseAccountOperation, uuid, type AccountOperation } from "./accountCommands";
import { parseContext, exact, type CommandContext } from "./personalCommands";
import { canonical, personalTables, priorityRecord, type Records, type Row } from "./personalRecords";
import * as v from "../data/validation";

export interface SyncOperation extends AccountOperation { context: CommandContext; expected?: string; observedRevision?: number; predecessor?: string }
export interface SyncBatch { accountId: string; operations: SyncOperation[] }
export interface SyncHead { accountId: string; initialized: boolean; revision: number; xp: number }
export interface PageCursor { table: number; offset: number }
export interface SyncPage extends SyncHead { table: string; rows: Row[]; next: PageCursor | null }
export interface ImportEntry { table: string; row: Row }
export const invalidSync = (): never => { throw new v.StoredDataError("sync"); };
export function parseSyncOperation(value: unknown): SyncOperation {
  v.validateJson(value); const row = v.object(value, "sync-operation");
  exact({ protocolVersion: v.oneOf(1), operationId: v.string(36), baseRevision: v.number(0, Number.MAX_SAFE_INTEGER, true), command: v.validateJson, context: v.validateJson, expected: v.optional(v.string(50*1024*1024)), observedRevision:v.optional(v.number(0,Number.MAX_SAFE_INTEGER,true)),predecessor:v.optional(v.string(36)) })(row, "sync-operation");
  const { context, expected, observedRevision, predecessor, ...operation } = row;
  if(predecessor!==undefined&&!uuid(predecessor)||observedRevision!==undefined&&Number(observedRevision)>Number(row.baseRevision))return invalidSync();
  return { ...(typeof observedRevision==="number"?{observedRevision}:{}),...(typeof predecessor==="string"?{predecessor}:{}), ...parseAccountOperation(operation), context: parseContext(context), ...(typeof expected === "string" ? {expected} : {}) };
}
export function parseSyncBatch(value: unknown): SyncBatch {
  v.validateJson(value); const row = v.object(value, "batch");
  exact({ accountId: v.string(36), operations: v.array(v.validateJson, 100) })(row, "batch");
  if (!uuid(row.accountId) || !Array.isArray(row.operations) || !row.operations.length || new TextEncoder().encode(JSON.stringify(row)).length > 512 * 1024) return invalidSync();
  return { accountId: row.accountId, operations: row.operations.map(parseSyncOperation) };
}
export function parseHead(value: unknown): SyncHead {
  v.validateJson(value);
  const row = v.object(value, "head");
  exact({ accountId: v.string(36), initialized: v.bool, revision: v.number(0, Number.MAX_SAFE_INTEGER, true), xp: v.number(0, Number.MAX_SAFE_INTEGER, true) })(row, "head");
  if (!uuid(row.accountId)||row.initialized!==(Number(row.revision)>0)) return invalidSync();
  return { accountId: row.accountId, initialized: row.initialized === true, revision: Number(row.revision), xp: Number(row.xp) };
}
export function parseCursor(value: unknown): PageCursor {
  v.validateJson(value);
  const row = v.object(value, "cursor"); exact({ table: v.number(0, personalTables.length - 1, true), offset: v.number(0, 250000, true) })(row, "cursor");
  return { table: Number(row.table), offset: Number(row.offset) };
}
const jsonFields: Record<string, string[]> = {
  account_preferences: ["appearance","reminders","quietStart","quietEnd","sound","haptics","reduceMotion","golden"],
  habits: ["name","icon","area","reason","type","unit","created","archivedAt"], habit_versions: ["full","tiny","days","cue","reminder"],
  habit_occurrences: ["name","icon","type","unit","full","tiny","cue"], goals: ["title","reason","targetDate","status","createdOn","completedOn","archivedOn"],
  goal_milestones: ["title","completedOn"], personal_rewards: ["name","createdOn","earnedOn","enjoyedOn","correctedOn","archivedOn"],
  prayer_settings: ["preferences","fajr","backupEnabled","started"], prayer_reminders: ["preparation","due"], prayer_days: ["source","sample","timezone","sunrise"],
  prayer_windows: ["begins","target","ends","beginsAt","targetAt","endsAt"], prayer_records: ["performedAt","recordedAt"],
  fajr_plans: ["bedtime","wakeLead","backupMinutes","message","placement","enabled","backupEnabled"], reflections: ["manageable","smaller"], saved_work_breaks: ["stage","note","wrapUsed"],
};
export function validateRows(table: string, value: unknown): asserts value is Row[] {
  const definition = personalTables.find(t => t.name === table); if (!definition || !Array.isArray(value)) return invalidSync();
  v.validateJson(value);
  for (const item of value) {
    const input = v.object(item, "row"),row=table==='daily_priorities'?priorityRecord(input):input;
    if (Object.keys(row).length !== definition.columns.length || Object.keys(row).some(key => !definition.columns.includes(key))) return invalidSync();
    if (jsonFields[table]) {
      const data = v.object(row.data, "row-data"); if (Object.keys(data).some(key => !jsonFields[table].includes(key))) return invalidSync();
      if (table === "prayer_settings") {
        for (const [key, allowed] of [["preferences", ["place","leadMinutes","style","reminders"]], ["fajr",jsonFields.fajr_plans]] as const) {
          if (Object.keys(v.object(data[key],key)).some(field => !(allowed as readonly string[]).includes(field))) return invalidSync();
        }
      }
    }
  }
}
export const emptyRecords = (): Records => Object.fromEntries(personalTables.map(t => [t.name, []]));
export const keyOf = (table: string, row: Row) => canonical(personalTables.find(t => t.name === table)!.keys.map(key => row[key]));
export function parseEntries(value: unknown): ImportEntry[] {
  if (!Array.isArray(value) || value.length > 200) return invalidSync();
  return value.map(item => { const entry = v.object(item,"entry"); exact({ table: v.string(80), row: v.validateJson })(entry,"entry"); const table = String(entry.table); validateRows(table,[entry.row]); return { table, row: v.object(entry.row,"row") }; });
}
