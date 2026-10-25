import {addDays} from '../../src/model.ts';
import {dateInZone} from '../../src/domain/zonedTime.ts';
import {buildHabitSchedule,habitEventKey} from '../../src/habitSchedule.ts';
import {pushEventKey} from '../../src/push/policy.ts';
import {quietAt,suppressedEventKeys} from '../../src/push/policy.ts';
import {readRecords,hydrate} from '../personal/records.ts';
import {createEmptyState} from '../../src/data/initialState.ts';
import {senderReady} from './readiness.ts';
import {cancelJobs} from './cancellation.ts';
import { createHash,randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {ServerConfig} from '../config.ts';
import {AuthError} from '../auth/sessions.ts';
import {hash} from '../auth/crypto.ts';
import {lock,revision} from '../personal/repository.ts';
import {parsePushPlan,validatePlanWindow} from '../../src/contracts/pushPlan.ts';
import {parsePushCancellation} from '../../src/contracts/pushCancellation.ts';
/** Local-only, explicitly consented plans; hosted activation remains deferred. */
export async function savePushPlan(c:pg.PoolClient,actor:string,token:string,config:ServerConfig,value:unknown){
 if(!['local','test'].includes(config.environment))throw new AuthError(503,'unavailable');
 let input;try{input=parsePushPlan(value);}catch{throw new AuthError(422,'invalid_input');}
 if(input.accountId!==actor)throw new AuthError(409,'account_changed');
 await lock(c,actor);
 const s=(await c.query("select id,version from rise.push_subscriptions where user_id=$1 and installation_hash=$2 and enabled and provider_session_id=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid",[actor,hash(`${actor}:${token}`)])).rows[0];
 if(!s)throw new AuthError(409,'account_changed');
 const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const replay=(await c.query('select digest,result from rise.push_plan_receipts where user_id=$1 and id=$2',[actor,input.requestId])).rows[0];
 if(replay){if(replay.digest!==digest)throw new AuthError(409,'account_changed');return replay.result;}
 if(input.sourceRevision!==await revision(c,actor))throw new AuthError(409,'account_changed');
 const old=(await c.query('select * from rise.push_plans where user_id=$1',[actor])).rows[0];
 if((old?.generation??0)!==input.expectedGeneration || (old?.primary_installation!==s.id&&!input.takeover) || (old&&input.sourceRevision<old.source_revision))throw new AuthError(409,'account_changed');
 const now=(await c.query('select clock_timestamp() as now')).rows[0].now as Date;
 try{validatePlanWindow(input.events,now.getTime());}catch{throw new AuthError(422,'invalid_input');}
 if((await c.query("select count(*)::int as n from rise.push_plan_receipts where user_id=$1 and created_at>now()-interval '1 day'",[actor])).rows[0].n>=144)throw new AuthError(429,'rate_limited',600);
 const state=input.sourceRevision?hydrate(await readRecords(c,actor)):createEmptyState();
 const blocked=await suppressedEventKeys(state);
 const habits=new Map(await Promise.all(buildHabitSchedule(state,now.getTime()).map(async e=>[await pushEventKey(e.key),e.at] as const)));
 const start=dateInZone(now,state.timezone);
 const knownHabits=new Set(await Promise.all(state.habits.flatMap(h=>Array.from({length:8},(_,i)=>pushEventKey(habitEventKey(addDays(start,i),h.id))))));
 const events=input.events.filter(e=>!blocked.has(e.key)&&(e.kind==='habit'||knownHabits.has(e.key)?input.timezone===state.timezone&&habits.get(e.key)===Date.parse(e.at):(input.allowDuringQuiet||!quietAt(Date.parse(e.at),input.timezone,state.prefs.quietStart,state.prefs.quietEnd))));
 const suppressed=input.events.length-events.length;
 const generation=input.expectedGeneration+1,through=events.at(-1)?.at??null;
 await c.query("update rise.push_jobs set status='canceled',lease_token=null,lease_until=null,completed_at=now() where user_id=$1 and status in ('queued','leased')",[actor]);
 await c.query('insert into rise.push_plans(user_id,primary_installation,generation,source_revision,timezone,queued_through) values($1,$2,$3,$4,$5,$6) on conflict(user_id) do update set primary_installation=excluded.primary_installation,generation=excluded.generation,source_revision=excluded.source_revision,timezone=excluded.timezone,queued_through=excluded.queued_through,updated_at=now()',[actor,s.id,generation,input.sourceRevision,input.timezone,through]);
 await c.query('update rise.push_plans set allow_during_quiet=$2,suppressed=$3 where user_id=$1',[actor,input.allowDuringQuiet??false,suppressed]);
 const devices=(await c.query('select id,version from rise.push_subscriptions where user_id=$1 and enabled',[actor])).rows;
 for(const event of events)for(const device of devices)await c.query('insert into rise.push_jobs(id,user_id,installation_id,installation_version,generation,event_key,fire_at,expires_at,next_attempt_at) values($1,$2,$3,$4,$5,$6,$7,$8,$7)',[randomUUID(),actor,device.id,device.version,generation,event.key,event.at,event.expiresAt]);
 const result={generation,primaryInstallation:s.id,queuedThrough:through,jobs:devices.length*events.length,suppressed,dispatchEnabled:await senderReady(c)};
 await c.query('insert into rise.push_plan_receipts(user_id,id,digest,result) values($1,$2,$3,$4)',[actor,input.requestId,digest,result]);
 return result;
}
export async function readPushPlan(c:pg.PoolClient,actor:string,token:string|null){
 // Serialize the metadata projection with replacement/cancellation so one read
 // cannot combine a former plan with a new installation's queue.
 await lock(c,actor);
 const serverNow=((await c.query('select clock_timestamp() as now')).rows[0].now as Date).toISOString();
 const plan=(await c.query('select primary_installation,generation,source_revision,timezone,queued_through,suppressed,allow_during_quiet from rise.push_plans where user_id=$1',[actor])).rows[0];
 const subscription=token?(await c.query("select id,version from rise.push_subscriptions where user_id=$1 and installation_hash=$2 and enabled and provider_session_id=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid",[actor,hash(`${actor}:${token}`)])).rows[0]:null;
 const jobs=plan&&subscription?(await c.query("select event_key,fire_at,expires_at,status from rise.push_jobs where user_id=$1 and generation=$2 and installation_id=$3 and installation_version=$4 order by fire_at,event_key",[actor,plan.generation,subscription.id,subscription.version])).rows:[];
 const pending=jobs.filter(j=>['queued','leased'].includes(j.status)&&j.expires_at>new Date(serverNow));
 const receiver=subscription?{installation:subscription.id,version:subscription.version,queuedThrough:pending.at(-1)?.fire_at.toISOString()??null,nextAt:pending[0]?.fire_at.toISOString()??null,failed:jobs.filter(j=>['failed','retired'].includes(j.status)).length,events:pending.map(j=>({key:j.event_key,at:j.fire_at.toISOString(),expiresAt:j.expires_at.toISOString()}))}:null;
 if(!plan)return {accountId:actor,serverNow,plan:null,receiver,dispatchEnabled:await senderReady(c)};
 const counts=(await c.query("select case when status in ('queued','leased') and expires_at<=$3 then 'expired' else status end as status,count(*)::int as count from rise.push_jobs where user_id=$1 and generation=$2 group by 1",[actor,plan.generation,serverNow])).rows;
 return {accountId:actor,serverNow,plan:{primaryInstallation:plan.primary_installation,generation:plan.generation,sourceRevision:plan.source_revision,timezone:plan.timezone,queuedThrough:plan.queued_through?.toISOString()??null,suppressed:plan.suppressed,allowDuringQuiet:plan.allow_during_quiet,coverageExpired:!plan.queued_through||plan.queued_through<=new Date(serverNow),counts},receiver,dispatchEnabled:await senderReady(c)};
}
export async function cancelPushPlan(c:pg.PoolClient,actor:string,_token:string,config:ServerConfig,value:unknown){
 if(!['local','test'].includes(config.environment))throw new AuthError(503,'unavailable');
 let v;try{v=parsePushCancellation(value);}catch{throw new AuthError(422,'invalid_input');}
 if(v.accountId!==actor)throw new AuthError(409,'account_changed');await lock(c,actor);
 const digest=createHash('sha256').update(JSON.stringify(["cancel",actor,v.keys,...(v.throughGeneration!==undefined?[v.throughGeneration]:[])])).digest('hex');
 const old=(await c.query('select digest,result from rise.push_plan_receipts where user_id=$1 and id=$2',[actor,v.requestId])).rows[0];
 if(old){if(old.digest!==digest)throw new AuthError(409,'account_changed');return old.result;}
 // Old v1 clients have no immutable generation bound. Once any receipts were
 // pruned, absence cannot distinguish a first submission from a lost reply.
 if(v.throughGeneration===undefined&&(await c.query('select 1 from rise.push_receipt_floors where user_id=$1',[actor])).rowCount)throw new AuthError(409,'cancellation_review_required');
 const generation=(await c.query('select generation from rise.push_plans where user_id=$1',[actor])).rows[0]?.generation??0;
 if(v.throughGeneration!==undefined&&v.throughGeneration>generation)throw new AuthError(409,'account_changed');
 if((await c.query("select count(*)::int as n from rise.push_plan_receipts where user_id=$1 and created_at>now()-interval '1 day'",[actor])).rows[0].n>=1000)throw new AuthError(429,'rate_limited',600);
 await cancelJobs(c,actor,v.keys,v.throughGeneration);const result={canceled:true,requestId:v.requestId};
 await c.query('insert into rise.push_plan_receipts(user_id,id,digest,result) values($1,$2,$3,$4)',[actor,v.requestId,digest,result]);return result;
}
