import {cancelForCommand} from "../push/cancellation.ts";
import { createHash } from "node:crypto";
import type pg from "pg";
import { fingerprint, retention } from "./recovery.ts";
import { intentView, blockedIntent, convergedIntent, removalKeys, archivedTarget } from "../../src/sync/policy.ts";
import { parseAccountOperation, type AccountReceipt } from "../../src/contracts/accountCommands.ts";
import { CommandValidationError } from "../../src/contracts/commands.ts";
import { StoredDataError } from "../../src/data/validation.ts";
import { object } from "../../src/data/validation.ts";
import { createEmptyState } from "../../src/data/initialState.ts";
import { makePrayerState } from "../../src/prayerModel.ts";
import { validateState } from "../../src/data/storedState.ts";
import { localDate, xpTotal } from "../../src/model.ts";
import { applyDomainCommand, CommandReferenceError } from "../../src/domain/commands.ts";
import { PersonalReferenceError } from "../../src/domain/personalCommands.ts";
import type { State } from "../../src/model.ts";
import { AuthError } from "../auth/sessions.ts";
import { hydrate, project, readRecords, writeRecords, type Records } from "./records.ts";
import { dateInZone, timeInZone } from "../../src/domain/zonedTime.ts";
import { PRAYERS, validateTimetable } from "../../src/prayerModel.ts";
import type { CommandContext } from "../../src/contracts/personalCommands.ts";
import {authorizePriorityReferences} from '../groups/priorities.ts';

const revisionOf = (value: unknown) => { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw new Error("invalid_personal_revision"); return number; };
export async function lock(client: pg.PoolClient, actor: string, shared = false) {
  await client.query(`select pg_advisory_xact_lock${shared ? "_shared" : ""}(hashtextextended($1, 0))`, [`rise-personal:${actor}`]);
}
export async function revision(client: pg.PoolClient, actor: string) {
  return revisionOf((await client.query<{ revision: string }>("select revision from rise.profiles where owner_id = $1", [actor])).rows[0]?.revision ?? 0);
}
export async function total(client: pg.PoolClient, actor: string) {
  return revisionOf((await client.query<{ xp: string }>("select xp from rise.personal_totals where owner_id = $1", [actor])).rows[0]?.xp ?? 0);
}
export interface PersonalView { initialized: boolean; revision: number; xp: number; records: Records | null }

export async function readPersonal(client: pg.PoolClient, actor: string): Promise<PersonalView> {
  await lock(client, actor, true);
  const current = await revision(client, actor);
  if (!current) return { initialized: false, revision: 0, xp: 0, records: null };
  const records = await readRecords(client, actor), state = hydrate(records), xp = await total(client, actor);
  if (xp !== xpTotal(state)) throw new Error("personal_total_mismatch");
  return { initialized: true, revision: current, xp, records };
}
/** All writes, revisions and the immutable replay receipt share the caller's actor transaction. */
export async function applyPersonal(client: pg.PoolClient, actor: string, value: unknown, captured?: CommandContext, expected?: string, causal:{observedRevision?:number;predecessor?:string}={}): Promise<AccountReceipt> {
  let operation;
  try { operation = parseAccountOperation(value); }
  catch (error) { if (error instanceof StoredDataError || error instanceof CommandValidationError) throw new AuthError(422, "invalid_command"); throw error; }
  await lock(client, actor);
  const current = await revision(client, actor);
  const requestHash = fingerprint(operation,captured,expected,causal);
  const prior = (await client.query<{ request_hash: Buffer; result: unknown; revision: string }>("select request_hash, result, revision from rise.personal_receipts where owner_id = $1 and operation_id = $2", [actor, operation.operationId])).rows[0];
  if (prior) {
    if (!prior.request_hash.equals(requestHash)) throw new AuthError(409, "operation_reused");
    const result = object(prior.result, "receipt");
    if (Object.keys(result).some(key => !["operationId", "operationRevision", "xp"].includes(key)) || result.operationId !== operation.operationId) throw new Error("invalid_personal_receipt");
    const operationRevision = result.operationRevision, xp = result.xp;
    if (typeof operationRevision !== "number" || !Number.isSafeInteger(operationRevision) || operationRevision < 1 || operationRevision > current || operationRevision !== revisionOf(prior.revision)
      || typeof xp !== "number" || !Number.isSafeInteger(xp) || xp < 0) throw new Error("invalid_personal_receipt");
    return { operationId: operation.operationId, operationRevision, xp, replayed: true };
  }
  if (operation.baseRevision>current || expected===undefined && operation.baseRevision !== current) throw new AuthError(409, "revision_conflict");
  if (current === Number.MAX_SAFE_INTEGER) throw new AuthError(409, "revision_limit");
  const floor=await retention(client,actor);
  if((causal.observedRevision??operation.baseRevision)<floor)throw new AuthError(409,"rebase_required");
  const now = Number((await client.query<{ now: string }>("select floor(extract(epoch from transaction_timestamp()) * 1000)::bigint as now")).rows[0].now);
  let next: State, before: Records, started: string;
  if (operation.command.kind === "account.initialize") {
    if (current) throw new AuthError(409, "already_initialized");
    const command = operation.command; started = localDate(command.timezone, new Date(now));
    next = createEmptyState(); next.name = command.name.trim() || "Friend"; next.timezone = command.timezone; next.demoDate = started;
    next.prayers = makePrayerState("fresh", started, command.timezone); next.life.language = command.language;
    before = {};
  } else {
    if (!current) throw new AuthError(409, "initialize_required");
    before = await readRecords(client, actor); const state = hydrate(before); started = String(before.profiles[0].started_on);
    const command = operation.command;
    let context = { date: localDate(state.timezone, new Date(now)), timezone: state.timezone, now };
    if (captured) {
      if(captured.now < now - 90 * 86400000)throw new AuthError(409,"rebase_required");
      if (captured.timezone !== state.timezone) throw new AuthError(409, "timezone_conflict");
      if (captured.now > now + 300000 || localDate(captured.timezone, new Date(captured.now)) !== captured.date || localDate(captured.timezone, new Date(Math.min(captured.now, now))) !== captured.date) throw new AuthError(422, "clock_invalid");
      context = { ...captured, now: Math.min(captured.now, now) };
    }
    if(expected!==undefined&&captured){
      const matches=(value:string)=>expected.startsWith("sha256:")?`sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`===expected:value===expected;
      if(blockedIntent(state,command)&&!(archivedTarget(state,command)&&matches(intentView(state,command,captured))))throw new AuthError(409,"entity_unavailable");
      const keys=removalKeys(command);
      for(const [table,key]of keys){const barrier=(await client.query("select barrier_revision,barrier_operation from rise.sync_changes where owner_id=$1 and table_name=$2 and record_key=$3",[actor,table,key])).rows[0];if(barrier&&Number(barrier.barrier_revision)>(causal.observedRevision??operation.baseRevision)&&(!causal.predecessor||barrier.barrier_operation!==causal.predecessor))throw new AuthError(409,"intent_conflict");}
      if(!matches(intentView(state,command,captured))&&!convergedIntent(state,command,expected,captured,matches))throw new AuthError(409,"intent_conflict");
    }
    if (command.kind.startsWith("work.") && "date" in command && "prayer" in command && !state.prayers.days[command.date]?.entries[command.prayer]) throw new AuthError(404, "missing_record");
    try {
      if (command.kind === "account.timezone") next = { ...state, timezone: command.timezone };
      else if (command.kind === "prayer.coverage") {
        if (validateTimetable(command.day, command.date)) throw new Error("invalid_coverage");
        const day = structuredClone(command.day); let previousEnd = 0;
        for (const { id } of PRAYERS) {
          const entry = day.entries[id], start = Date.parse(entry.beginsAt ?? ""), target = Date.parse(entry.targetAt ?? ""), end = Date.parse(entry.endsAt ?? "");
          if (![start,target,end].every(Number.isFinite) || start < previousEnd || target < start || target >= end || end - start > 86400000
            || dateInZone(start,day.timezone) !== command.date || timeInZone(start,day.timezone) !== entry.begins || timeInZone(target,day.timezone) !== entry.target || timeInZone(end,day.timezone) !== entry.ends) throw new Error("invalid_coverage");
          previousEnd = end;
          if (state.prayers.days[command.date]?.entries[id].check) day.entries[id] = structuredClone(state.prayers.days[command.date].entries[id]);
        }
        next = { ...state, prayers: { ...state.prayers, preferences: command.preferences, days: { ...state.prayers.days, [command.date]: day } } };
      } else next = applyDomainCommand(state, command, context,{sharedPriorities:await authorizePriorityReferences(client,state,command)});
    }
    catch (error) {
      if(error instanceof AuthError)throw error;
      if (error instanceof PersonalReferenceError || error instanceof CommandReferenceError) throw new AuthError(404, "missing_record");
      if (error instanceof Error) throw new AuthError(422, "invalid_command");
      throw error;
    }
  }
  validateState(next);
  const nextRevision = current + 1;
  await writeRecords(client, actor, nextRevision, before, project(next, started),operation.operationId);
  await cancelForCommand(client,actor,operation.command);
  const xp = await total(client, actor);
  if (xp !== xpTotal(next)) throw new Error("personal_total_mismatch");
  const result = { operationId: operation.operationId, operationRevision: nextRevision, xp };
  await client.query("insert into rise.personal_receipts (owner_id, operation_id, request_hash, result, revision) values ($1,$2,$3,$4,$5)", [actor, operation.operationId, requestHash, result, nextRevision]);
  return { ...result, replayed: false };
}
