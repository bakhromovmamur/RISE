import type pg from "pg";
import { AuthError } from "../auth/sessions.ts";
import { lock, revision } from "../personal/repository.ts";
import type { DeletionStatus } from "../../src/contracts/accountLifecycle.ts";
import { retireOwnerPush } from "../push/repository.ts";
import {groupError} from '../groups/repository.ts';

export function deletionStatus(row: { user_id:string; request_id:string; requested_at:Date; purge_by:Date; purged_at:Date|null }):DeletionStatus {
  return { accountId:row.user_id, requestId:row.request_id, requestedAt:row.requested_at.toISOString(), purgeBy:row.purge_by.toISOString(), purgedAt:row.purged_at?.toISOString()??null };
}
export async function recentAuthentication(client:pg.PoolClient, actor:string) {
  const result=await client.query(`select 1 from rise_private.server_sessions where user_id=$1 and provider_session_id::text=(current_setting('request.jwt.claims',true)::jsonb->>'session_id') and authenticated_at > now()-interval '10 minutes' and authenticated_at <= now()`,[actor]);
  if(!result.rowCount)throw new AuthError(403,"recent_auth_required");
}
/** The owner lock orders deletion after any earlier personal commit. Suppression is atomic. */
export async function queueDeletion(client:pg.PoolClient,actor:string,requestId:string,expectedRevision:number):Promise<DeletionStatus> {
  await lock(client,actor);
  await recentAuthentication(client,actor);
  if(await revision(client,actor)!==expectedRevision)throw new AuthError(409,"account_changed");
  if(!(await client.query("select rise_private.deletion_integrations_ready() as ready")).rows[0].ready)throw new AuthError(409,"ownership_resolution_required");
  try{await client.query('select rise_private.prepare_group_deletion()');}catch(error){throw groupError(error)??error;}
  await retireOwnerPush(client,actor);
  await client.query("insert into rise_private.deletion_ledger(user_id) values($1)",[actor]);
  const result=await client.query("insert into rise_private.deletion_jobs(user_id,request_id) values($1,$2) returning *",[actor,requestId]);
  await client.query(`insert into rise_private.deleted_sessions(id_hash,context_hash,user_id) select id_hash,context_hash,user_id from rise_private.server_sessions where user_id=$1 on conflict(id_hash) do nothing`,[actor]);
  await client.query(`update rise_private.server_sessions set revoked_at=coalesce(revoked_at,now()),provider_cipher=null where id_hash in (select id_hash from rise_private.server_sessions where user_id=$1 for update skip locked)`,[actor]);
  // The ledger predicate immediately rejects every session/JWT. Provider tokens are
  // destroyed by the isolated purge, without locking other in-flight session rows.
  return deletionStatus(result.rows[0]);
}
