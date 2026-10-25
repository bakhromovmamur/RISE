import type pg from 'pg';
import {pushObject,pushOnly,pushUUID} from '../../src/contracts/push.ts';
import {hash} from '../auth/crypto.ts';
import {AuthError} from '../auth/sessions.ts';
import {lock} from '../personal/repository.ts';

/** A pushed ID selects a candidate. The verified session, installation cookie,
 * current group/source/consent and exact event instants decide authorization. */
export async function authorizeGroupNotice(c:pg.PoolClient,actor:string,token:string|null,value:unknown){
 if(!pushObject(value)||!pushOnly(value,['owner','installation','id','generation','eventAt','expiresAt'])||!pushUUID(value.owner)||!pushUUID(value.installation)||!pushUUID(value.id))throw new AuthError(422,'invalid_input');
 if(typeof value.generation!=='string'||! /^[1-9][0-9]{0,9}$/.test(value.generation)||Number(value.generation)>=2147483647)throw new AuthError(422,'invalid_input');
 for(const key of ['eventAt','expiresAt'])if(typeof value[key]!=='string'||!Number.isFinite(Date.parse(value[key]))||new Date(value[key]).toISOString()!==value[key])throw new AuthError(422,'invalid_input');
 if(actor!==value.owner||!token)return {valid:false};
 await lock(c,actor);
 const result=await c.query<{valid:boolean}>('select rise_private.receive_group_notice($1,$2,$3,$4,$5,$6) as valid',[value.id,value.installation,value.generation,value.eventAt,value.expiresAt,hash(`${actor}:${token}`)]);
 return {valid:result.rows[0].valid===true};
}
