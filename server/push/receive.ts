import type pg from 'pg';
import {pushObject,pushOnly,pushUUID} from '../../src/contracts/push.ts';
import {hash} from '../auth/crypto.ts';
import {AuthError} from '../auth/sessions.ts';
import {lock} from '../personal/repository.ts';

/** Read-only authorization for a closed receiving installation. The payload
 * selects a candidate; verified session, cookie, current plan and job authorize it. */
export async function authorizeReminder(c:pg.PoolClient,actor:string,token:string|null,value:unknown){
 if(!pushObject(value)||!pushOnly(value,['owner','installation','id','generation','planGeneration','eventAt','expiresAt'])||!pushUUID(value.owner)||!pushUUID(value.installation)||!pushUUID(value.id))throw new AuthError(422,'invalid_input');
 for(const key of ['generation','planGeneration'])if(typeof value[key]!=='string'||! /^[1-9][0-9]{0,9}$/.test(value[key])||Number(value[key])>=2147483647)throw new AuthError(422,'invalid_input');
 for(const key of ['eventAt','expiresAt'])if(typeof value[key]!=='string'||!Number.isFinite(Date.parse(value[key]))||new Date(value[key]).toISOString()!==value[key])throw new AuthError(422,'invalid_input');
 if(actor!==value.owner||!token)return {valid:false};
 await lock(c,actor);
 const row=await c.query(`select j.id from rise.push_jobs j
 join rise.push_subscriptions s on s.user_id=j.user_id and s.id=j.installation_id
 join rise.push_plans p on p.user_id=j.user_id and p.generation=j.generation
 where j.user_id=$1 and s.installation_hash=$2 and s.id=$3 and j.event_key=$4
 and s.enabled and s.provider_session_id=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid
 and s.version=$5 and j.installation_version=s.version and j.generation=$6
 and j.fire_at=$7 and j.expires_at=$8 and j.fire_at<=clock_timestamp() and j.expires_at>clock_timestamp()
 and j.status in ('leased','accepted') and not j.presentation_canceled`,[actor,hash(`${actor}:${token}`),value.installation,value.id,value.generation,value.planGeneration,value.eventAt,value.expiresAt]);
 return {valid:row.rowCount===1};
}
