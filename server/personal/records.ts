import { keyOf } from "../../src/contracts/sync.ts";
import type pg from "pg";
import { object } from "../../src/data/validation.ts";
import { canonical, personalTables, type Records, type Row, type Table } from "../../src/contracts/personalRecords.ts";
export { hydrate, project, canonical, personalTables } from "../../src/contracts/personalRecords.ts";
export type { Records, Row, Table } from "../../src/contracts/personalRecords.ts";

export async function readRecords(client: pg.PoolClient, actor: string): Promise<Records> {
  const records: Records = {}; let count = 0;
  for (const definition of personalTables) {
    // Dense occurrence history already has JSON data plus UUID/int/text fields.
    // Keep dates as JSON strings: pg's native DATE parser uses process timezone.
    const direct = definition.name === "habit_occurrences";
    const selection = direct
      ? definition.columns.map(key => key === "date" ? "to_json(t.date) as date" : `t.${key}`).join(",")
      : `jsonb_build_object(${definition.columns.map(key => `'${key}', t.${key}`).join(",")}) as record`;
    const order = (definition.order ?? definition.keys).map(key => `t.${key}`).join(",") || "t.owner_id";
    const result = await client.query<Row>(`select ${selection} from rise.${definition.name} t where owner_id = $1 order by ${order} limit 250001`, [actor]);
    count += result.rowCount ?? 0; if (count > 250000) throw new Error("personal_record_limit");
    records[definition.name] = result.rows.map(row => object(direct ? row : row.record, "personal-record"));
  }
  return records;
}

const rowKey = (table: Table, row: Row) => canonical(table.keys.map(key => row[key]));

/** Equality for already-validated relational JSON, not an input validator.
 * Object key order is irrelevant; array order, missing fields and scalar types
 * remain significant. Like canonical JSON, numeric -0 and 0 are equivalent.
 * Keep canonical serialization for identities, fingerprints and import hashes. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameJson(value, right[index]));
  }
  if (Array.isArray(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.hasOwn(right, key) && sameJson(Reflect.get(left, key), Reflect.get(right, key)));
}

/** Only deltas are written; historic note/ack rows and retired referenced milestones survive. */
export async function writeRecords(client: pg.PoolClient, actor: string, revision: number, before: Records, desired: Records, operationId?:string) {
  for (const definition of personalTables) {
    let priorRows = before[definition.name] ?? [], desiredRows = desired[definition.name];
    // Ordered identities already pair a stable occurrence history. Compare all
    // values, then build key maps only for changed rows. Any identity/length
    // mismatch retains the general insertion/removal path below.
    if (definition.name === "habit_occurrences" && priorRows.length === desiredRows.length
      && priorRows.every((row, i) => definition.keys.every(key => row[key] === desiredRows[i][key]))) {
      const changedPrior: Row[] = [], changedDesired: Row[] = [];
      for (let i = 0; i < priorRows.length; i++) if (!sameJson(priorRows[i], desiredRows[i])) {
        changedPrior.push(priorRows[i]); changedDesired.push(desiredRows[i]);
      }
      priorRows = changedPrior; desiredRows = changedDesired;
    }
    const changed=async(row:Row,deleted:boolean)=>{
      const data=row.data as Record<string,unknown>|undefined,old=previous.get(rowKey(definition,row)),oldData=old?.data as Record<string,unknown>|undefined;
      const correction=Boolean(oldData?.earnedOn&&!data?.earnedOn||oldData?.enjoyedOn&&!data?.enjoyedOn||oldData?.completedOn&&!data?.completedOn)||definition.name==="habit_occurrences"&&old?.check_kind==="full"&&row.check_kind==="tiny";
      const barrier=deleted||correction||definition.name==="habit_occurrences"&&row.check_kind===null||row.retired===true||Boolean(data?.archivedAt||data?.archivedOn);
      return client.query(`insert into rise.sync_changes(owner_id,table_name,record_key,revision,deleted,barrier_revision,barrier_operation) values($1,$2,$3,$4,$5,$6,$7) on conflict(owner_id,table_name,record_key) do update set revision=excluded.revision,deleted=excluded.deleted,changed_at=now(),barrier_revision=case when excluded.barrier_revision>0 then excluded.barrier_revision else rise.sync_changes.barrier_revision end,barrier_operation=case when excluded.barrier_revision>0 then excluded.barrier_operation else rise.sync_changes.barrier_operation end`,[actor,definition.name,keyOf(definition.name,row),revision,deleted,barrier?revision:0,barrier?operationId??null:null]);};
    const previous = new Map(priorRows.map(row => [rowKey(definition, row), row]));
    const next = new Map(desiredRows.map(row => [rowKey(definition, row), row]));
    for (const [key, row] of previous) if (!next.has(key)) {
      if (definition.name === "goal_milestones") next.set(key, { ...row, retired: true });
      if (definition.name === "saved_work_breaks") next.set(key, { ...row, active: false });
      if (definition.name === "fajr_acknowledgments") next.set(key, row);
    }
    for (const [key, row] of previous) if (!next.has(key)) {
      const where = definition.keys.map((key, i) => `${key} = $${i + 2}`).join(" and ");
      if (!where) throw new Error("cannot_remove_personal_root");
      await changed(row,true);
      await client.query(`delete from rise.${definition.name} where owner_id = $1 and ${where}`, [actor, ...definition.keys.map(key => row[key])]);
    }
    const rows = [...next.values()];
    if (definition.name === "saved_work_breaks") rows.sort((a, b) => Number(a.active) - Number(b.active));
    for (const row of rows) {
      if (sameJson(row, previous.get(rowKey(definition, row)) ?? null)) continue;
      await changed(row,false);
      const columns = ["owner_id", ...definition.columns, "revision"];
      const values = [actor, ...definition.columns.map(key => row[key]), revision];
      const updates = [...definition.columns.filter(key => !definition.keys.includes(key)), "revision"].map(key => `${key} = excluded.${key}`).join(",");
      await client.query(`insert into rise.${definition.name} (${columns.join(",")}) values (${values.map((_, i) => `$${i + 1}`).join(",")})
        on conflict (owner_id${definition.keys.length ? "," + definition.keys.join(",") : ""}) do update set ${updates},updated_at = now()`, values);
    }
  }
  // An accepted no-op still advances the canonical account revision exactly once.
  await client.query("update rise.profiles set revision = $2, updated_at = now() where owner_id = $1", [actor, revision]);
}
