import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createECDH,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {claimPushJob,dispatchPushJob,prunePushJobs} from '../../server/push/jobs.ts';
import {lock} from '../../server/personal/repository.ts';
let h:Awaited<ReturnType<typeof authHarness>>,worker:pg.Pool;
before(async()=>{h=await authHarness();const env=parseEnv(await readFile('.rise-infra/test/push.env','utf8'));const url=new URL(env.DATABASE_WORKER_URL!);assert.equal(url.port,'55422');worker=new pg.Pool({connectionString:url.href});});
after(async()=>{await worker?.end();await h?.close();});
async function setup(){const b=new AuthBrowser(h);const login=await b.login();const owner=login.session.json().account.id;await b.request('push');const ec=createECDH('prime256v1');ec.generateKeys();const saved=await b.request('push',{accountId:owner,version:0,details:false,language:'en',subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}});assert.equal(saved.statusCode,200);return {b,owner,device:saved.json().installation.id};}
function plan(owner:string){const at=Date.now()+60000;return {accountId:owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'Asia/Tashkent',events:[{key:String(randomUUID()),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]};}
async function due(owner:string){await h.admin.query("update rise.push_jobs set fire_at=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()+interval '90 seconds',next_attempt_at=clock_timestamp()-interval '1 second' where user_id=$1",[owner]);}
test('plan replay, generation CAS, privacy validation and transactional replacement',async()=>{
 const s=await setup(),p=plan(s.owner);const saved=await s.b.request('push/plan',p);assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().jobs,1);assert.equal(saved.json().dispatchEnabled,false);
 assert.deepEqual((await s.b.request('push/plan',p)).json(),saved.json());
 assert.equal((await s.b.request('push/plan',{...p,timezone:'Asia/Almaty'})).statusCode,409);
 assert.equal((await s.b.request('push/plan',{...p,requestId:randomUUID()})).statusCode,409);
 assert.equal((await s.b.request('push/plan',{...p,coordinates:[1,2]})).statusCode,422);
 const replacement=await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1,events:[]});assert.equal(replacement.statusCode,200);assert.equal(replacement.json().queuedThrough,null);
 assert.equal((await h.admin.query('select status from rise.push_jobs where user_id=$1',[s.owner])).rows[0].status,'canceled');
 await s.b.request('logout',{});
});
test('duplicate workers, durable restart leases, stale lease and accepted terminal receipt',async()=>{
 const s=await setup();await s.b.request('push/plan',plan(s.owner));await due(s.owner);
 const claims=await Promise.all([claimPushJob(worker,s.owner),claimPushJob(worker,s.owner)]);assert.equal(claims.filter(Boolean).length,1);const old=claims.find(Boolean)!;
 await h.admin.query("update rise.push_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[old.id]);
 const recovered=await claimPushJob(worker,s.owner);assert.ok(recovered);let sends=0;
 assert.equal(await dispatchPushJob(worker,old,async()=>{sends++;return 201;}),'lost_lease');
 assert.equal(await dispatchPushJob(worker,recovered,async job=>{sends++;assert.ok(job.ttl<=90);assert.deepEqual(Object.keys(job).sort(),['event','eventAt','expiresAt','generation','installation','owner','planGeneration','ttl']);return 201;}),'accepted');
 assert.equal(await dispatchPushJob(worker,recovered,async()=>{sends++;return 201;}),'lost_lease');assert.equal(sends,1);
 await s.b.request('logout',{});
});
test('transient failures retry within expiry; offline/late windows expire without sending',async()=>{
 const s=await setup();await s.b.request('push/plan',plan(s.owner));await due(s.owner);
 const first=await claimPushJob(worker,s.owner);assert.ok(first);assert.equal(await dispatchPushJob(worker,first,async()=>503),'queued');assert.equal(await claimPushJob(worker,s.owner),null);
 await h.admin.query("update rise.push_jobs set fire_at=now()-interval '3 minutes',expires_at=now()-interval '1 minute' where user_id=$1",[s.owner]);
 assert.equal(await claimPushJob(worker,s.owner),null);assert.equal((await h.admin.query('select status from rise.push_jobs where user_id=$1',[s.owner])).rows[0].status,'expired');await s.b.request('logout',{});
});
test('invalid endpoint retires subscription; logout cancels leased jobs',async()=>{
 for(const response of [410,201]){const s=await setup();await s.b.request('push/plan',plan(s.owner));await due(s.owner);const lease=await claimPushJob(worker,s.owner);assert.ok(lease);
 if(response===201)await s.b.request('logout',{});
 let calls=0;const status=await dispatchPushJob(worker,lease,async()=>{calls++;return response;});assert.equal(status,response===410?'retired':'lost_lease');assert.equal(calls,response===410?1:0);
 await s.b.request('logout',{});}
});
test('unrelated users and direct public roles cannot access plans; worker cannot alter intent',async()=>{
 const s=await setup(),other=await setup();assert.equal((await other.b.request('push/plan',plan(s.owner))).statusCode,409);
 for(const role of ['anon','authenticated']){const c=await h.admin.connect();try{await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query('select * from rise.push_jobs'),{code:'42501'});}finally{await c.query('rollback');c.release();}}
 for(const query of ["update rise.push_jobs set fire_at=now()","update rise.push_plans set generation=2","select * from rise.push_plan_receipts"])await assert.rejects(worker.query(query),{code:'42501'});
 await prunePushJobs(worker);await s.b.request('logout',{});await other.b.request('logout',{});
});
test('primary takeover is explicit; competing generations commit once and failed writes roll back',async()=>{
 const s=await setup(),p=plan(s.owner);assert.equal((await s.b.request('push/plan',p)).statusCode,200);
 s.b.cookies.delete('rise_test_push');await s.b.request('push');const ec=createECDH('prime256v1');ec.generateKeys();
 const subscribed=await s.b.request('push',{accountId:s.owner,version:0,details:false,language:'en',subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}});assert.equal(subscribed.statusCode,200);
 const next={...p,requestId:randomUUID(),expectedGeneration:1,takeover:false};assert.equal((await s.b.request('push/plan',next)).statusCode,409);
 const responses=await Promise.all([s.b.request('push/plan',{...next,takeover:true}),s.b.request('push/plan',{...next,requestId:randomUUID(),takeover:true})]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 const rows=(await h.admin.query('select generation,primary_installation from rise.push_plans where user_id=$1',[s.owner])).rows;assert.equal(rows[0].generation,2);assert.equal(rows[0].primary_installation,subscribed.json().installation.id);
 assert.equal((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and status='queued'",[s.owner])).rows[0].n,2);
 await s.b.request('logout',{});
});
import {pushEventKey} from '../../src/push/policy.ts';
test('quiet suppression defaults on; explicit plan override and coverage counts remain honest',async()=>{
 const s=await setup(),p=plan(s.owner);p.allowDuringQuiet=false;
 // A future UTC midnight is inside default quiet hours, regardless of test runtime.
 const at=new Date();at.setUTCHours(0,0,0,0);at.setUTCDate(at.getUTCDate()+1);p.timezone='UTC';p.events=[{key:randomUUID(),at:at.toISOString(),expiresAt:new Date(at.getTime()+120000).toISOString()}];
 const quiet=await s.b.request('push/plan',p);assert.equal(quiet.statusCode,200);assert.equal(quiet.json().suppressed,1);assert.equal(quiet.json().jobs,0);assert.equal(quiet.json().queuedThrough,null);
 const allowed=await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1,allowDuringQuiet:true});assert.equal(allowed.json().jobs,1);
 await s.b.request('logout',{});
});
test('acknowledgment cancels only dated wake jobs, preserves prayer records/XP and rejects stale worker',async()=>{
 const s=await setup();
 const init=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:0,command:{kind:'account.initialize',name:'Synthetic',timezone:'UTC',language:'en'}});assert.equal(init.statusCode,200);
 const date=new Date().toISOString().slice(0,10),p=plan(s.owner);
 const day=cleanDay(calculatePrayerDay(date,{...defaultCalculation(),timezone:'UTC'},{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0}));
 const coverage=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:1,command:{kind:'prayer.coverage',date,day,preferences:{place:'home',leadMinutes:10,style:'gentle',reminders:true}}});assert.equal(coverage.statusCode,200,coverage.body);
 p.sourceRevision=2;p.events=await Promise.all(['wake','backup','due'].map(async k=>({...p.events[0],key:await pushEventKey(`rise:${date}:fajr:${k}`)})));
 assert.equal((await s.b.request('push/plan',p)).statusCode,200);await due(s.owner);
 const lease=await claimPushJob(worker,s.owner);assert.ok(lease);
 const before=(await s.b.request('personal')).json();
 const command={protocolVersion:1,operationId:randomUUID(),baseRevision:2,command:{kind:'fajr.acknowledge',date}};
 const receipt=await s.b.request('personal/commands',command);assert.equal(receipt.statusCode,200,receipt.body);assert.equal(receipt.json().xp,before.xp);
 const rows=(await h.admin.query('select event_key,status from rise.push_jobs where user_id=$1',[s.owner])).rows;
 const wakeKeys=await Promise.all(['wake','backup'].map(k=>pushEventKey(`rise:${date}:fajr:${k}`)));assert.equal(rows.filter(r=>wakeKeys.includes(r.event_key)&&r.status==='canceled').length,2);
 const after=(await s.b.request('personal')).json();assert.deepEqual(after.records.prayer_records,before.records.prayer_records);
 assert.equal((await s.b.request('personal/commands',command)).statusCode,200);
 const refreshed=await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1,sourceRevision:3});assert.equal(refreshed.statusCode,200);assert.equal(refreshed.json().jobs,1);assert.equal(refreshed.json().suppressed,2);
 const pause=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:3,command:{kind:'prayer.pause',pauseId:randomUUID(),date,prayer:'fajr'}});assert.equal(pause.statusCode,200,pause.body);assert.equal(pause.json().xp,before.xp);
 const resume=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:4,command:{kind:'prayer.resume',date,prayer:'fajr',includeCurrent:true}});assert.equal(resume.statusCode,200,resume.body);
 assert.equal((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and status in ('queued','leased')",[s.owner])).rows[0].n,0);

 await s.b.request('logout',{});
});
test('cancel receipts cannot cancel a later generation on lost-reply retry',async()=>{
 const s=await setup(),p=plan(s.owner);await s.b.request('push/plan',p);const cancel={accountId:s.owner,requestId:randomUUID(),keys:null};const first=await s.b.request('push/cancel-plan',cancel);assert.equal(first.statusCode,200);
 await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1});assert.deepEqual((await s.b.request('push/cancel-plan',cancel)).json(),first.json());assert.equal((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and status='queued'",[s.owner])).rows[0].n,1);
 await s.b.request('logout',{});
});

test('bounded receipt cleanup fences old cancellations without deleting another owner or current receipts',async()=>{
 const s=await setup(),other=await setup(),p=plan(s.owner);
 try{
  await s.b.request('push/plan',p);
  const bound={accountId:s.owner,requestId:randomUUID(),keys:null,throughGeneration:1};
  const canceled=await s.b.request('push/cancel-plan',bound);assert.equal(canceled.statusCode,200);
  const legacy={accountId:s.owner,requestId:randomUUID(),keys:null};assert.equal((await s.b.request('push/cancel-plan',legacy)).statusCode,200);
  await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1});
  const otherPlan=plan(other.owner);await other.b.request('push/plan',otherPlan);
  await h.admin.query("update rise.push_plan_receipts set created_at=clock_timestamp()-interval '8 days' where user_id=$1 and id=any($2::uuid[])",[s.owner,[bound.requestId,legacy.requestId]]);
  const before=Number((await h.admin.query('select count(*) as n from rise.push_plan_receipts')).rows[0].n);
  assert.equal((await worker.query('select rise_private.prune_push_receipts(1) as n')).rows[0].n,1);
  assert.equal(Number((await h.admin.query('select count(*) as n from rise.push_plan_receipts')).rows[0].n),before-1);
  await worker.query('select rise_private.prune_push_receipts(500)');
  assert.deepEqual((await s.b.request('push/cancel-plan',bound)).json(),canceled.json());
  assert.equal((await s.b.request('push/cancel-plan',legacy)).json().error.code,'cancellation_review_required');
  assert.equal((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and status='queued'",[s.owner])).rows[0].n,1);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.push_plan_receipts where user_id=$1 and id=$2',[other.owner,otherPlan.requestId])).rows[0].n,1);
  await assert.rejects(worker.query('select * from rise.push_receipt_floors'),{code:'42501'});
  await assert.rejects(worker.query('select result from rise.push_plan_receipts'),{code:'42501'});
  await assert.rejects(h.store.pool.query('select rise_private.prune_push_receipts(1)'),{code:'42501'});
  await assert.rejects(worker.query('select rise_private.prune_push_receipts(501)'));
 }finally{await s.b.request('logout',{});await other.b.request('logout',{});}
});

test('expired job cleanup is bounded and leaves current delivery history intact',async()=>{
 const s=await setup(),p=plan(s.owner);
 try{
  p.events=Array.from({length:4},()=>({...p.events[0],key:randomUUID()}));await s.b.request('push/plan',p);
  await h.admin.query("update rise.push_jobs set fire_at=now()-interval '2 days',expires_at=now()-interval '2 days'+interval '2 minutes' where user_id=$1",[s.owner]);
  await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1,events:[p.events[0]]});
  assert.equal((await prunePushJobs(worker,2)).rowCount,2);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.push_jobs where user_id=$1',[s.owner])).rows[0].n,3);
  await prunePushJobs(worker,500);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.push_jobs where user_id=$1',[s.owner])).rows[0].n,1);
 }finally{await s.b.request('logout',{});}
});

test('busy-owner dispatch defers without sending and retention preserves atomicity, authorization and owner cascades',async()=>{
 const s=await setup(),p=plan(s.owner),c=await h.admin.connect();
 try{
  await s.b.request('push/plan',p);await due(s.owner);const lease=await claimPushJob(worker,s.owner);assert.ok(lease);
  await c.query('begin');await lock(c,s.owner);
  assert.equal(await dispatchPushJob(worker,lease,async()=>{assert.fail('busy_owner_sent');}),'deferred');
  assert.equal((await c.query('select attempts from rise.push_jobs where id=$1',[lease.id])).rows[0].attempts,0);
  await c.query('rollback');
  await h.admin.query("update rise.push_plan_receipts set created_at=now()-interval '8 days' where user_id=$1",[s.owner]);
  await c.query('begin');await lock(c,s.owner);await worker.query('select rise_private.prune_push_receipts(500)');
  assert.equal((await c.query('select count(*)::int as n from rise.push_plan_receipts where user_id=$1',[s.owner])).rows[0].n,1);
  await c.query('rollback');
  const cleanup=await worker.connect();try{await cleanup.query('begin');await cleanup.query('select rise_private.prune_push_receipts(500)');await cleanup.query('rollback');}finally{cleanup.release();}
  assert.equal((await c.query('select count(*)::int as n from rise.push_receipt_floors where user_id=$1',[s.owner])).rows[0].n,0);
  assert.equal((await c.query('select count(*)::int as n from rise.push_plan_receipts where user_id=$1',[s.owner])).rows[0].n,1);
  await worker.query('select rise_private.prune_push_receipts(500)');
  assert.equal((await c.query('select count(*)::int as n from rise.push_receipt_floors where user_id=$1',[s.owner])).rows[0].n,1);
  assert.equal((await h.store.pool.query('select count(*)::int as n from rise.push_receipt_floors')).rows[0].n,0);
  for(const role of ['anon','authenticated','service_role']){
   await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query('select rise_private.prune_push_receipts(1)'),{code:'42501'});await c.query('rollback');
  }
  await s.b.request('logout',{});
  // Only the synthetic account created above is removed to verify the FK.
  await c.query('delete from auth.users where id=$1',[s.owner]);
  assert.equal((await c.query('select count(*)::int as n from rise.push_receipt_floors where user_id=$1',[s.owner])).rows[0].n,0);
 }finally{await c.query('rollback');c.release();await s.b.request('logout',{});}
});

import {calculatePrayerDay,defaultCalculation} from '../../src/prayerCalculation.ts';
import {cleanDay} from '../../src/sync/operations.ts';
test('dispatch and cancellation serialize: before-send stops, submitted sends cannot be recalled',async()=>{
 const s=await setup(),p=plan(s.owner);await s.b.request('push/plan',p);await due(s.owner);
 const first=await claimPushJob(worker,s.owner);assert.ok(first);
 await s.b.request('push/cancel-plan',{accountId:s.owner,requestId:randomUUID(),keys:null});let calls=0;
 assert.equal(await dispatchPushJob(worker,first,async()=>{calls++;return 201;}),'lost_lease');assert.equal(calls,0);
 await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1});await due(s.owner);const second=await claimPushJob(worker,s.owner);assert.ok(second);
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 const dispatch=dispatchPushJob(worker,second,async()=>{calls++;entered();await hold;return 201;});await started;
 const cancel=s.b.request('push/cancel-plan',{accountId:s.owner,requestId:randomUUID(),keys:null});release();assert.equal(await dispatch,'accepted');assert.equal((await cancel).statusCode,200);assert.equal(calls,1);
 assert.equal((await s.b.request('push/plan')).json().plan.queuedThrough,null);await s.b.request('logout',{});
});

test('plan readiness is current, installation-scoped and excludes obsolete subscription versions',async()=>{
 const s=await setup(),p=plan(s.owner);await s.b.request('push/plan',p);
 const first=(await s.b.request('push/plan')).json();assert.equal(first.accountId,s.owner);assert.equal(first.receiver.installation,s.device);assert.equal(first.receiver.events.length,1);assert.equal(first.receiver.queuedThrough,p.events[0].at);
 // Same account, newly consenting receiving installation: it has no backfilled coverage.
 s.b.cookies.delete('rise_test_push');await s.b.request('push');const ec=createECDH('prime256v1');ec.generateKeys();
 const subscription={endpoint:`https://fcm.googleapis.com/fcm/send/${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const device=await s.b.request('push',{accountId:s.owner,version:0,details:false,language:'en',subscription});assert.equal(device.statusCode,200);
 const fresh=(await s.b.request('push/plan')).json();assert.equal(fresh.plan.primaryInstallation,s.device);assert.equal(fresh.receiver.queuedThrough,null);assert.deepEqual(fresh.receiver.events,[]);
 const next={...p,requestId:randomUUID(),expectedGeneration:1};assert.equal((await s.b.request('push/plan',{...next,takeover:false})).statusCode,409);assert.equal((await s.b.request('push/plan',next)).statusCode,200);
 const own=(await s.b.request('push/plan')).json();assert.equal(own.receiver.events.length,1);assert.notEqual(own.plan.primaryInstallation,s.device);
 await s.b.request('push',{accountId:s.owner,version:device.json().installation.version,details:true,language:'en',subscription});assert.equal((await s.b.request('push/plan')).json().receiver.queuedThrough,null);
 const other=await setup();assert.equal((await other.b.request('push/plan')).json().plan,null);await other.b.request('logout',{});await s.b.request('logout',{});
});

import {emptyDraft} from '../../src/model.ts';
import {buildWebPushEvents} from '../../src/push/plan.ts';
import {hydrate} from '../../server/personal/records.ts';
import {dateInZone,timeInZone} from '../../src/domain/zonedTime.ts';
test('habit plans validate saved eligibility, cancel completion/archive transactionally and dispatch through local transport',async()=>{
 const s=await setup();let revision=0,generation=0;
 const command=async(command:object)=>{const response=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:revision,command});assert.equal(response.statusCode,200,response.body);revision=response.json().operationRevision;return response.json();};
 const timezone=new Date().getUTCHours()<22?'UTC':'Asia/Tashkent',date=dateInZone(Date.now(),timezone),reminder=timeInZone(Date.now()+300000,timezone),id=randomUUID();
 await command({kind:'account.initialize',name:'Synthetic',timezone,language:'en'});
 await command({kind:'preferences.set',changes:{reminders:true,quietStart:'00:00',quietEnd:'00:00'}});
 await command({kind:'habit.save',newId:id,draft:{...emptyDraft(),name:'Private habit title',reminder,days:[0,1,2,3,4,5,6]}});
 const view=(await s.b.request('personal')).json(),state=hydrate(view.records),events=await buildWebPushEvents(state,Date.now(),true);
 assert.equal(events.length,7);assert.ok(events.every(e=>e.kind==='habit'));
 const save=async(inputEvents=events)=>{const r=await s.b.request('push/plan',{accountId:s.owner,requestId:randomUUID(),expectedGeneration:generation,sourceRevision:revision,takeover:true,allowDuringQuiet:true,timezone,events:inputEvents});assert.equal(r.statusCode,200,r.body);generation=r.json().generation;return r.json();};
 assert.equal((await save()).jobs,7);
 const completed=await command({kind:'habit.check',habitId:id,date,check:'full'});assert.equal(completed.xp,20);
 const todayKey=await pushEventKey(`rise:${date}:habit:${id}`);
 assert.equal((await h.admin.query('select status from rise.push_jobs where user_id=$1 and event_key=$2 and generation=$3',[s.owner,todayKey,generation])).rows[0].status,'canceled');
 assert.equal((await save()).suppressed,1); // Fresh revision cannot revive completed occurrence.
 await command({kind:'habit.correct',habitId:id,date,check:null});assert.equal((await save()).jobs,7);
 await due(s.owner);const lease=await claimPushJob(worker,s.owner);assert.ok(lease);
 let calls=0;assert.equal(await dispatchPushJob(worker,lease,async job=>{calls++;assert.ok(!JSON.stringify(job).includes('Private'));assert.ok(job.ttl<=90);return 201;}),'accepted');assert.equal(calls,1);
 await command({kind:'habit.archive',habitId:id});assert.equal((await save()).jobs,0);
 assert.equal((await s.b.request('personal')).json().xp,0);
 // A typed habit with arbitrary identity/time has no corresponding saved occurrence.
 assert.equal((await save([{...events[0],key:randomUUID()}])).jobs,0);
 await s.b.request('logout',{});
});
test('habit quiet hours cannot inherit the prayer override and disabling preferences cancels all coverage',async()=>{
 const s=await setup();let revision=0;
 const command=async(command:object)=>{const r=await s.b.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:revision,command});assert.equal(r.statusCode,200,r.body);revision=r.json().operationRevision;};
 await command({kind:'account.initialize',name:'Synthetic',timezone:'UTC',language:'en'});
 await command({kind:'preferences.set',changes:{reminders:true,quietStart:'00:00',quietEnd:'00:00'}});
 await command({kind:'habit.save',newId:randomUUID(),draft:{...emptyDraft(),name:'Private',reminder:'03:00',days:[0,1,2,3,4,5,6]}});
 const events=await buildWebPushEvents(hydrate((await s.b.request('personal')).json().records),Date.now(),true);
 const p={accountId:s.owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:revision,takeover:true,allowDuringQuiet:true,timezone:'UTC',events};
 assert.equal((await s.b.request('push/plan',p)).json().jobs,events.length);
 await command({kind:'preferences.set',changes:{quietStart:'22:00',quietEnd:'07:00'}});
 const quiet=await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:1,sourceRevision:revision});assert.equal(quiet.statusCode,200,quiet.body);assert.equal(quiet.json().jobs,0);assert.equal(quiet.json().suppressed,events.length);
 const legacy=await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:2,sourceRevision:revision,events:events.map(({key,at,expiresAt})=>({key,at,expiresAt}))});assert.equal(legacy.json().jobs,0);
 await command({kind:'preferences.set',changes:{reminders:false,quietStart:'00:00',quietEnd:'00:00'}});
 assert.equal((await s.b.request('push/plan',{...p,requestId:randomUUID(),expectedGeneration:3,sourceRevision:revision})).json().jobs,0);
 await s.b.request('logout',{});
});
