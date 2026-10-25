import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {parseSquadPreviewRequest,parseSquadPreview,parseSquadQuery,parseSquadPage,type SquadPage} from '../../src/contracts/squads.ts';
import {buildSquadSnapshot} from '../../src/domain/squadSnapshot.ts';
import {StoredDataError} from '../../src/data/validation.ts';
import {localDate,weekStart} from '../../src/domain/calendar.ts';
import {AuthError} from '../auth/sessions.ts';
import {lock,readPersonal} from '../personal/repository.ts';
import {hydrate} from '../personal/records.ts';
import {groupAction,groupError} from './repository.ts';
import {squadProjection} from './projections.ts';

export async function previewSquad(c:pg.PoolClient,actor:string,value:unknown){
 let input;try{input=parseSquadPreviewRequest(value);}catch(error){const failure=groupError(error);if(failure)return {failure};throw error;}
 if(input.accountId!==actor)return {failure:new AuthError(403,'account_mismatch')};
 await lock(c,actor);
 if(!(await c.query("select rise_private.group_rate('change') as allowed")).rows[0].allowed)return {failure:new AuthError(429,'rate_limited',3600)};
 return groupAction(c,async()=>{
  // No profile is initialized on this read. The expected personal revision
  // prevents an unsynced/stale local view being mistaken for the source.
  const personal=await readPersonal(c,actor);
  if(!personal.initialized||!personal.records)throw new AuthError(409,'initialize_required');
  if(personal.revision!==input.personalRevision)throw new AuthError(409,'squad_source_changed');
  const now=Number((await c.query('select floor(extract(epoch from now())*1000)::bigint as time')).rows[0].time),state=hydrate(personal.records);
  if(input.week>weekStart(localDate(state.timezone,new Date(now))))throw new AuthError(422,'invalid_input');
  let snapshot;try{snapshot=buildSquadSnapshot(state,input,now);}catch(error){if(error instanceof StoredDataError)throw new AuthError(409,'squad_snapshot_limit');throw error;}
  const row=(await c.query<{preview:unknown}>('select rise_private.stage_squad_preview($1,$2,$3,$4,$5,$6,$7::jsonb) as preview',
   [input.groupId,input.groupRevision,randomUUID(),input.postId,input.postRevision,personal.revision,JSON.stringify(snapshot)])).rows[0];
  return parseSquadPreview(row.preview);
 });
}

/** One statement snapshot covers membership, revision, posts and reactions.
 * No author account IDs, private source metadata or withdrawn payloads leave it. */
export async function readSquad(c:pg.PoolClient,actor:string,value:unknown):Promise<SquadPage>{
 let q;try{q=parseSquadQuery(value);}catch(error){if(error instanceof StoredDataError)throw new AuthError(422,'invalid_input');throw error;}
 const result=await c.query<{revision:number;rows:unknown[]}>(`select g.revision,
  (select coalesce(jsonb_agg(page.value order by page.id),'[]'::jsonb) from (select p.id,jsonb_build_object(
   ${squadProjection('$4')}) as value
   from rise.squad_posts p where p.group_id=g.id and p.week=$2::date and ($3::uuid is null or p.id>$3::uuid) and ($5::uuid is null or p.author_member_id=$5::uuid) order by p.id limit 21) page) as rows
  from rise.groups g where g.id=$1::uuid and g.kind='squad'`,[q.groupId,q.week,q.cursor??null,actor,q.authorMemberId??null]);
 const head=result.rows[0];if(!head)throw new AuthError(404,'group_unavailable');
 if(q.revision!==undefined&&q.revision!==head.revision)throw new AuthError(409,'group_changed');
 const rows=head.rows.slice(0,20),last=rows.at(-1);
 const next=head.rows.length>20&&last&&typeof last==='object'&&'id'in last?last.id:null;
 return parseSquadPage({accountId:actor,groupId:q.groupId,revision:head.revision,week:q.week,rows,next});
}
