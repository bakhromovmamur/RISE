import type pg from "pg";
import { createHash } from "node:crypto";
import type { AccountOperation } from "../../src/contracts/accountCommands.ts";
import type { CommandContext } from "../../src/contracts/personalCommands.ts";
import type { SyncOperation } from "../../src/contracts/sync.ts";
import { canonical } from "./records.ts";
export const fingerprint=(operation:AccountOperation,context?:CommandContext,expected?:string,causal?:object)=>createHash("sha256").update(canonical({...operation,...(context?{context}:{}),...(expected!==undefined?{expected}:{}),...causal})).digest();
export async function retention(client:pg.PoolClient,actor:string){
  await client.query("update rise.sync_changes set barrier_revision=revision where owner_id=$1 and deleted and barrier_revision=0",[actor]);
  // Called under the canonical owner lock. The floor advances in the same transaction as pruning.
  await client.query("insert into rise.sync_state(owner_id,floor_revision) values($1,0) on conflict do nothing",[actor]);
  await client.query(`update rise.sync_state set floor_revision=greatest(floor_revision,
    coalesce((select max(revision) from rise.personal_receipts where owner_id=$1 and created_at<now()-interval '90 days'),0),
    coalesce((select max(revision) from rise.sync_changes where owner_id=$1 and changed_at<now()-interval '90 days'),0)) where owner_id=$1`,[actor]);
  await client.query("delete from rise.personal_receipts where owner_id=$1 and created_at<now()-interval '90 days'",[actor]);
  await client.query("delete from rise.sync_changes where owner_id=$1 and changed_at<now()-interval '90 days'",[actor]);
  return Number((await client.query("select floor_revision from rise.sync_state where owner_id=$1",[actor])).rows[0].floor_revision);
}
export async function receiptStatus(client:pg.PoolClient,actor:string,operation:SyncOperation){
  const {context,expected,observedRevision,predecessor,...value}=operation;const causal={...(observedRevision!==undefined?{observedRevision}:{}),...(predecessor?{predecessor}:{})};
  const prior=(await client.query("select request_hash from rise.personal_receipts where owner_id=$1 and operation_id=$2",[actor,operation.operationId])).rows[0];
  return !prior?"unknown":Buffer.from(prior.request_hash).equals(fingerprint(value,context,expected,causal))?"committed":"reused";
}
