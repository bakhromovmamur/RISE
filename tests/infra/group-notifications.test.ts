import {before,after,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {parseGroups,type AccountGroup,type GroupCommand,type GroupOperation,type GroupReceipt} from '../../src/contracts/groups.ts';
import {parseSquadPreview,type SquadPreview} from '../../src/contracts/squads.ts';
import {localDate,weekStart} from '../../src/model.ts';
import {claimGroupNotice,dispatchGroupNotice,sendGroupNotices,pruneGroupNotices,type GroupDispatch} from '../../server/push/groupJobs.ts';
import type {PushSenderConfig} from '../../server/push/worker.ts';
import {lifecycleDatabase,accountPurger,purgeAccounts} from '../../server/lifecycle/worker.ts';
const ece=createRequire(import.meta.url)('http_ece') as {decrypt:(body:Buffer,options:object)=>Buffer};
let h:Awaited<ReturnType<typeof authHarness>>,pool:pg.Pool,config:PushSenderConfig;
const subjects:string[]=[],groups:string[]=[];
before(async()=>{h=await authHarness();const e=parseEnv(await readFile('.rise-infra/test/push.env','utf8')),url=new URL(e.DATABASE_WORKER_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55422');assert.equal(url.username,'rise_worker_login');pool=new pg.Pool({connectionString:url.href,max:5,statement_timeout:3000});config={installationId:e.INSTALLATION_ID!,dataKey:Buffer.from(e.PUSH_DATA_ENCRYPTION_KEY!,'hex'),vapid:{publicKey:e.VAPID_PUBLIC_KEY!,privateKey:e.VAPID_PRIVATE_KEY!,subject:e.VAPID_SUBJECT!}};});
afterEach(async()=>{
 // Complete this fixture's requested deletions through the real bounded worker.
 // Leaving queued jobs after direct Auth cleanup would fill a later suite's
 // first 20-job batch. Keep the authoritative suppression ledger intact.
 const pending=async()=>(await h.admin.query('select count(*)::int as n from rise_private.deletion_jobs where user_id=any($1::uuid[]) and purged_at is null',[subjects])).rows[0].n as number;
 if(await pending()){const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});try{await worker.verify();for(let n=0;n<10&&await pending();n++)assert.equal((await purgeAccounts(worker.pool,accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!))).failed,0);assert.equal(await pending(),0);}finally{await worker.close();}}
 await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);groups.length=0;subjects.length=0;
});
after(async()=>{await pool?.end();await h?.close();});
async function actor(){const a=new PersonalClient(h);await a.initialize();subjects.push(a.owner);return a;}
async function head(a:PersonalClient,id:string):Promise<AccountGroup>{const r=await a.browser.request('groups');assert.equal(r.statusCode,200);const g=parseGroups(r.json()).groups.find(g=>g.id===id);assert.ok(g);return g;}
const operation=(a:PersonalClient,command:GroupCommand,expectedRevision:number):GroupOperation=>({accountId:a.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command});
async function send(a:PersonalClient,op:GroupOperation,status=200){const r=await a.browser.request('groups/commands',op);assert.equal(r.statusCode,status,r.json().error?.code);return r;}
async function command(a:PersonalClient,input:GroupCommand){return(await send(a,operation(a,input,input.kind==='group.create'||input.kind==='group.accept'?0:(await head(a,input.groupId)).revision))).json<GroupReceipt>();}
async function create(a:PersonalClient,kind:'family'|'squad'='family',timezone='UTC'){const id=randomUUID();groups.push(id);await command(a,{kind:'group.create',groupId:id,groupKind:kind,name:'Synthetic notice group',timezone,nickname:'Chosen owner'});return id;}
async function join(a:PersonalClient,b:PersonalClient,id:string){const invited=await command(a,{kind:'group.invite',groupId:id});assert.ok(invited.invitation);await command(b,{kind:'group.accept',token:new URL(invited.invitation.link).hash.slice(8),nickname:'Chosen member'});return(await head(b,id)).members.find(m=>m.self)!.id;}
async function subscribe(a:PersonalClient){await a.browser.request('push');const ec=createECDH('prime256v1');ec.generateKeys();const auth=randomBytes(16).toString('base64url'),endpoint=`https://fcm.googleapis.com/fcm/send/synthetic-${randomUUID()}`;const r=await a.browser.request('push',{accountId:a.owner,version:0,details:true,language:'uz',subscription:{endpoint,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth}}});assert.equal(r.statusCode,200);return{id:r.json().installation.id as string,version:r.json().installation.version as number,ec,auth,endpoint,cookie:a.browser.cookies.get('rise_test_push')!};}
async function preferences(a:PersonalClient,id:string,changes:Partial<{muted:boolean;quietStart:string;quietEnd:string;notifications:boolean}>={}){return command(a,{kind:'group.preferences',groupId:id,muted:false,quietStart:'00:00',quietEnd:'00:00',...changes});}
async function setup(kind:'family'|'squad'='family',consent=true){const a=await actor(),b=await actor(),id=await create(a,kind),member=await join(a,b,id),device=await subscribe(b);await preferences(b,id,consent?{notifications:true}:{});return{a,b,id,member,device};}
function task(id:string,member:string):Extract<GroupCommand,{kind:'task.create'|'task.edit'}>{return{kind:'task.create',groupId:id,taskId:randomUUID(),title:'A shared title never sent in a notification',notes:'An authored shared note never sent in a notification',assignee:member,date:localDate('UTC'),time:null,weekdays:[]};}
async function publish(a:PersonalClient,id:string,previous?:SquadPreview){const p=await a.browser.request('squads/preview',{accountId:a.owner,groupId:id,groupRevision:(await head(a,id)).revision,postId:previous?.postId??randomUUID(),postRevision:previous?(await h.admin.query('select revision from rise.squad_posts where id=$1',[previous.postId])).rows[0].revision:0,personalRevision:a.revision,week:weekStart(localDate('UTC')),note:'A chosen reflection never sent in a notification',choices:{habits:false,milestones:false,prayers:false}});assert.equal(p.statusCode,200);const preview=parseSquadPreview(p.json());await command(a,{kind:'squad.publish',groupId:id,postId:preview.postId,previewId:preview.previewId,hash:preview.hash});return preview;}
async function jobs(id:string){return(await h.admin.query('select * from rise.notification_jobs where group_id=$1 order by fire_at,id',[id])).rows;}
function receive(payload:Record<string,unknown>){return 'push/group?'+new URLSearchParams(Object.fromEntries(['owner','installation','id','generation','eventAt','expiresAt'].map(k=>[k,String(payload[k])])));}
const payload=(j:GroupDispatch):Record<string,unknown>=>({owner:j.owner,installation:j.installation,id:j.id,generation:j.generation,eventAt:j.eventAt,expiresAt:j.expiresAt});

test('unmuted legacy preferences never consent; explicit consent is separate, replayable and does not backfill',async()=>{
 const s=await setup('family',false);assert.equal((await head(s.b,s.id)).preferences.notifications,false);const first=task(s.id,s.member);await command(s.a,first);assert.equal((await jobs(s.id)).length,0);
 await preferences(s.b,s.id,{notifications:true});assert.equal((await jobs(s.id)).length,0);await preferences(s.b,s.id,{quietStart:'01:00',quietEnd:'01:00'});assert.equal((await head(s.b,s.id)).preferences.notifications,true);
 const op=operation(s.a,task(s.id,s.member),(await head(s.a,s.id)).revision),accepted=(await send(s.a,op)).json();assert.equal((await jobs(s.id)).length,1);assert.deepEqual((await send(s.a,op)).json(),accepted);assert.equal((await jobs(s.id)).length,1);
 await preferences(s.b,s.id,{notifications:false});assert.ok((await jobs(s.id)).every(j=>j.status==='canceled'&&j.presentation_canceled));await preferences(s.b,s.id);assert.equal((await head(s.b,s.id)).preferences.notifications,false);
 const noDevice=await actor(),member=await join(s.a,noDevice,s.id);await preferences(noDevice,s.id,{notifications:true});await command(s.a,task(s.id,member));assert.equal((await jobs(s.id)).length,1);
 assert.equal((await s.a.read()).xp,0);assert.equal((await s.b.read()).xp,0);
});

test('real encrypted group dispatch is generic and exact current receiving authorization rejects substitutions',async()=>{
 const s=await setup(),op=operation(s.a,task(s.id,s.member),(await head(s.a,s.id)).revision);await send(s.a,op);const beforeA=await s.a.read(),beforeB=await s.b.read(),values:Record<string,unknown>[]=[];
 const sent=await sendGroupNotices(pool,config,async details=>{assert.equal(details.endpoint,s.device.endpoint);const p=JSON.parse(ece.decrypt(details.body!,{version:'aes128gcm',privateKey:s.device.ec,authSecret:s.device.auth}).toString());assert.deepEqual(Object.keys(p).sort(),['eventAt','expiresAt','generation','id','installation','language','owner','type','version']);assert.equal(p.type,'group');assert.equal(p.language,'uz');assert.doesNotMatch(JSON.stringify(p),/shared|authored|reflection|nickname|prayer|title|notes/i);assert.ok(Number(details.headers.TTL)>0&&Number(details.headers.TTL)<=120);values.push(p);return 201;});assert.equal(sent.accepted,1);
 await sendGroupNotices(pool,config,async()=>{assert.fail('duplicate_send');});assert.equal(values.length,1);const p=values[0],decision=await s.b.browser.request(receive(p));assert.equal(decision.statusCode,200);assert.equal(decision.headers['cache-control'],'no-store');assert.deepEqual(decision.json(),{valid:true});
 for(const change of [{owner:s.a.owner},{generation:Number(p.generation)+1},{id:randomUUID()},{eventAt:new Date(Date.parse(String(p.eventAt))+1).toISOString()}])assert.deepEqual((await s.b.browser.request(receive({...p,...change}))).json(),{valid:false});
 assert.equal((await s.b.browser.request(receive({...p,eventAt:'invalid'}))).statusCode,422);assert.equal((await s.b.browser.request(receive(p)+'&note=private')).statusCode,422);assert.deepEqual((await s.a.browser.request(receive(p))).json(),{valid:false});
 s.b.browser.cookies.delete('rise_test_push');assert.deepEqual((await s.b.browser.request(receive(p))).json(),{valid:false});s.b.browser.cookies.set('rise_test_push',s.device.cookie);const guest=new AuthBrowser(h);assert.equal((await guest.request(receive(p))).statusCode,401);
 assert.deepEqual(await s.a.read(),beforeA);assert.deepEqual(await s.b.read(),beforeB);
});

test('squad notices reach only other opted-in members; reactions do not create messages and edits cancel prior presentation',async()=>{
 const s=await setup('squad'),other=await actor();await join(s.a,other,s.id);await subscribe(other);const first=await publish(s.a,s.id);assert.equal((await jobs(s.id)).length,1);assert.equal((await jobs(s.id))[0].user_id,s.b.owner);
 await command(s.b,{kind:'squad.react',groupId:s.id,postId:first.postId,encourage:true});assert.equal((await jobs(s.id)).length,1);const lease=await claimGroupNotice(pool,s.b.owner);assert.ok(lease);let p:Record<string,unknown>={};assert.equal(await dispatchGroupNotice(pool,lease,async j=>{p=payload(j);return 201;}),'accepted');
 await publish(s.a,s.id,first);const current=await jobs(s.id);assert.equal(current.length,2);assert.equal(current[0].status,'accepted');assert.equal(current[0].presentation_canceled,true);assert.deepEqual((await s.b.browser.request(receive(p))).json(),{valid:false});
 await command(s.a,{kind:'squad.withdraw',groupId:s.id,postId:first.postId});assert.ok((await jobs(s.id)).every(j=>j.presentation_canceled));let calls=0;await sendGroupNotices(pool,config,async()=>{calls++;return 201;});assert.equal(calls,0);
});

test('group quiet hours use the group timezone and cannot inherit a prayer quiet-hours override',async()=>{
 const s=await setup();const times=(await h.admin.query("select to_char(clock_timestamp() at time zone 'UTC','HH24:MI') as start,to_char((clock_timestamp()+interval '3 minutes') at time zone 'UTC','HH24:MI') as finish")).rows[0];
 await preferences(s.b,s.id,{notifications:true,quietStart:times.start,quietEnd:times.finish});await command(s.a,task(s.id,s.member));assert.equal((await jobs(s.id)).length,0);
 await preferences(s.b,s.id,{notifications:true});await command(s.a,task(s.id,s.member));assert.equal((await jobs(s.id)).length,1);await preferences(s.b,s.id,{quietStart:times.start,quietEnd:times.finish});assert.equal((await jobs(s.id))[0].status,'canceled');
 const c=await h.admin.connect();try{await c.query('begin');await c.query('grant rise_group_guard to postgres');const result=await c.query("select rise_private.group_notice_quiet('Asia/Tashkent','22:00','07:00','2026-10-23T18:00:00Z') as quiet,rise_private.group_notice_quiet('UTC','22:00','07:00','2026-10-23T18:00:00Z') as awake,rise_private.group_notice_quiet('America/New_York','01:00','02:00','2026-11-01T06:30:00Z') as repeated,rise_private.group_notice_quiet('UTC','00:00','00:00','2026-10-23T18:00:00Z') as equal");assert.deepEqual(result.rows[0],{quiet:true,awake:false,repeated:true,equal:false});}finally{await c.query('rollback');c.release();}
 let calls=0;await sendGroupNotices(pool,config,async()=>{calls++;return 201;});assert.equal(calls,0);
});

test('leave, removal, archive, mute and disabling consent suppress future sends and accepted presentation',async()=>{
 for(const action of ['leave','remove','archive','mute','consent'] as const){const s=await setup();await command(s.a,task(s.id,s.member));const lease=await claimGroupNotice(pool,s.b.owner);assert.ok(lease);let p:Record<string,unknown>={};await dispatchGroupNotice(pool,lease,async j=>{p=payload(j);return 201;});const accepted=(await jobs(s.id))[0].completed_at;
  if(action==='leave')await command(s.b,{kind:'group.leave',groupId:s.id});else if(action==='remove')await command(s.a,{kind:'group.remove',groupId:s.id,memberId:s.member});else if(action==='archive')await command(s.a,{kind:'group.archive',groupId:s.id});else await preferences(s.b,s.id,action==='mute'?{muted:true}:{notifications:false});
  const j=(await jobs(s.id))[0];assert.equal(j.status,'accepted',action);assert.equal(j.presentation_canceled,true,action);assert.deepEqual(j.completed_at,accepted);assert.deepEqual((await s.b.browser.request(receive(p))).json(),{valid:false});await sendGroupNotices(pool,config,async()=>{assert.fail('canceled_send');});
 }
});

test('source assignment and archive, installation retirement and logout cancel queued notices',async()=>{
 for(const action of ['assignment','archive','disable','logout'] as const){const s=await setup(),t=task(s.id,s.member);await command(s.a,t);
  if(action==='assignment')await command(s.a,{...t,kind:'task.edit',assignee:null});else if(action==='archive')await command(s.a,{kind:'task.archive',groupId:s.id,taskId:t.taskId});else if(action==='disable')assert.equal((await s.b.browser.request('push/disable',{accountId:s.b.owner,version:s.device.version})).statusCode,200);else assert.equal((await s.b.browser.request('logout',{})).statusCode,200);
  assert.ok((await jobs(s.id)).every(j=>j.status==='canceled'&&j.presentation_canceled),action);await sendGroupNotices(pool,config,async()=>{assert.fail('stale_source_send');});
 }
});

test('transient retries, stale leases, duplicate claims and expiry stay bounded and idempotent',async()=>{
 const s=await setup();await command(s.a,task(s.id,s.member));assert.equal((await sendGroupNotices(pool,config,async()=>503)).queued,1);await h.admin.query("update rise.notification_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where group_id=$1",[s.id]);
 const first=await claimGroupNotice(pool,s.b.owner);assert.ok(first);await h.admin.query("update rise.notification_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[first.id]);const second=await claimGroupNotice(pool,s.b.owner);assert.ok(second);assert.notEqual(first.lease_token,second.lease_token);assert.equal(await dispatchGroupNotice(pool,first,async()=>{assert.fail('stale_lease');}),'lost_lease');
 assert.equal(await dispatchGroupNotice(pool,second,async()=>201),'accepted');assert.equal(await claimGroupNotice(pool,s.b.owner),null);assert.equal((await jobs(s.id))[0].attempts,2);
 await command(s.a,task(s.id,s.member));await h.admin.query("update rise.notification_jobs set attempts=4 where group_id=$1 and status='queued'",[s.id]);assert.equal((await sendGroupNotices(pool,config,async()=>503)).failed,1);
 await command(s.a,task(s.id,s.member));await h.admin.query("update rise.notification_jobs set fire_at=fire_at-interval '3 minutes',expires_at=expires_at-interval '3 minutes' where group_id=$1 and status='queued'",[s.id]);assert.equal(await claimGroupNotice(pool,s.b.owner),null);assert.equal((await jobs(s.id)).filter(j=>j.status==='expired').length,1);
});

test('message frequency and stopped-worker capacity suppress optional delivery without losing shared edits or replaying later',async()=>{
 const s=await setup(),limits=(await h.admin.query('select * from rise_private.group_notification_limits')).rows[0];
 try{await h.admin.query('update rise_private.group_notification_limits set per_recipient_hour=1,retained_global=2');const first=task(s.id,s.member);await command(s.a,first);await command(s.a,{...first,kind:'task.edit',title:'A later accepted title'});assert.equal((await jobs(s.id)).length,1);assert.equal((await jobs(s.id))[0].status,'canceled');
  await h.admin.query('update rise_private.group_notification_limits set per_recipient_hour=100');await command(s.a,task(s.id,s.member));const third=task(s.id,s.member),op=operation(s.a,third,(await head(s.a,s.id)).revision);await send(s.a,op);assert.equal((await jobs(s.id)).length,2);assert.equal((await h.admin.query('select title from rise.family_tasks where id=$1',[third.taskId])).rows[0].title,third.title);
  await h.admin.query("update rise.notification_jobs set fire_at=fire_at-interval '2 days',expires_at=expires_at-interval '2 days' where group_id=$1",[s.id]);assert.equal((await pruneGroupNotices(pool,1)).rowCount,1);await send(s.a,op);assert.equal((await jobs(s.id)).length,1);await command(s.a,{...third,kind:'task.edit',title:'An explicit later edit'});assert.equal((await jobs(s.id)).length,2);
 }finally{await h.admin.query('update rise_private.group_notification_limits set per_recipient_hour=$1,retained_global=$2',[limits.per_recipient_hour,limits.retained_global]);}
});

test('a removal racing provider acceptance waits for the checked dispatch then suppresses later presentation',async()=>{
 const s=await setup();await command(s.a,task(s.id,s.member));const lease=await claimGroupNotice(pool,s.b.owner);assert.ok(lease);let enter!:()=>void,release!:()=>void,p:Record<string,unknown>={};const started=new Promise<void>(r=>{enter=r;}),held=new Promise<void>(r=>{release=r;});
 const dispatched=dispatchGroupNotice(pool,lease,async j=>{p=payload(j);enter();await held;return 201;});await started;let removed=false;const removal=command(s.a,{kind:'group.remove',groupId:s.id,memberId:s.member}).then(()=>{removed=true;});
 try{await new Promise(r=>setTimeout(r,60));assert.equal(removed,false);}finally{release();}assert.equal(await dispatched,'accepted');await removal;assert.equal((await jobs(s.id))[0].status,'accepted');assert.equal((await jobs(s.id))[0].presentation_canceled,true);assert.deepEqual((await s.b.browser.request(receive(p))).json(),{valid:false});
});

test('notification tables and capabilities force RLS and grant neither shared text nor private identity authority to the sender',async()=>{
 const s=await setup();await command(s.a,task(s.id,s.member));const flags=(await h.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where oid in ('rise.notification_jobs'::regclass,'rise_private.group_notification_limits'::regclass)")).rows;assert.ok(flags.every(f=>f.relrowsecurity&&f.relforcerowsecurity));
 await assert.rejects(h.store.pool.query('select * from rise.notification_jobs'),{code:'42501'});await assert.rejects(h.store.pool.query('select rise_private.lock_group_notice($1,$2,$3)',[randomUUID(),s.b.owner,randomUUID()]),{code:'42501'});
 for(const query of ['select title from rise.family_tasks','select snapshot from rise.squad_posts','select * from rise.profiles','select source_actor_id from rise.notification_jobs','update rise.notification_jobs set presentation_canceled=false'])await assert.rejects(pool.query(query),{code:'42501'});
 assert.equal((await h.admin.query("select has_column_privilege('rise_group_guard','rise.push_subscriptions','subscription_cipher','select') as secret")).rows[0].secret,false);
 for(const role of ['anon','authenticated','service_role']){const c=await h.admin.connect();try{await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query('select id from rise.notification_jobs'),{code:'42501'});}finally{await c.query('rollback');c.release();}}
});

test('failed receipt or notification insertion rolls back content, revision and jobs together',async()=>{
 const s=await setup(),original=(await head(s.a,s.id)).revision;
 for(const table of ['group_receipts','notification_jobs']){const name=`synthetic_notice_${table}`;await h.admin.query(`create function rise_private.${name}() returns trigger language plpgsql set search_path='' as $$begin if new.group_id='${s.id}'::uuid then raise exception 'synthetic notice failure';end if;return new;end;$$;create trigger ${name} before insert on rise.${table} for each row execute function rise_private.${name}()`);
  try{const t=task(s.id,s.member);await send(s.a,operation(s.a,t,original),503);assert.equal((await head(s.a,s.id)).revision,original);assert.equal((await jobs(s.id)).length,0);assert.equal((await h.admin.query('select count(*)::int as n from rise.family_tasks where id=$1',[t.taskId])).rows[0].n,0);}finally{await h.admin.query(`drop trigger ${name} on rise.${table};drop function rise_private.${name}()`);}
 }
});

test('account suppression erases recipient and source-actor notices before primary purge while retaining family content',async()=>{
 for(const deleting of ['recipient','source'] as const){const s=await setup();await command(s.a,task(s.id,s.member));if(deleting==='source')await command(s.a,{kind:'group.transfer',groupId:s.id,memberId:s.member});const subject=deleting==='recipient'?s.b:s.a;
  assert.equal((await jobs(s.id)).length,1);const r=await subject.browser.request('account/deletion',{accountId:subject.owner,requestId:randomUUID(),revision:subject.revision,confirm:'delete-account'});assert.equal(r.statusCode,200,r.json().error?.code);assert.equal((await jobs(s.id)).length,0);assert.equal((await h.admin.query('select count(*)::int as n from rise.family_tasks where group_id=$1',[s.id])).rows[0].n,1);assert.equal((await subject.browser.read()).json().signedIn,false);
 }
});

test('source departure, subscription rotation and provider retirement invalidate only eligible installations',async()=>{
 for(const action of ['leave','remove','rotate','retire'] as const){const s=await setup();await command(s.a,task(s.id,s.member));
  if(action==='leave'||action==='remove'){const source=(await head(s.a,s.id)).members.find(m=>m.self)!.id;await command(s.a,{kind:'group.transfer',groupId:s.id,memberId:s.member});if(action==='leave')await command(s.a,{kind:'group.leave',groupId:s.id});else await command(s.b,{kind:'group.remove',groupId:s.id,memberId:source});}
  else if(action==='rotate'){const r=await s.b.browser.request('push',{accountId:s.b.owner,version:s.device.version,details:false,language:'en',subscription:{endpoint:s.device.endpoint,expirationTime:null,keys:{p256dh:s.device.ec.getPublicKey().toString('base64url'),auth:s.device.auth}}});assert.equal(r.statusCode,200);assert.equal(r.json().installation.version,s.device.version+1);}
  else{assert.equal((await sendGroupNotices(pool,config,async()=>410)).retired,1);assert.equal((await s.b.browser.request('push')).json().installation.enabled,false);}
  assert.ok((await jobs(s.id)).every(j=>j.presentation_canceled&&j.status===(action==='retire'?'retired':'canceled')),action);await sendGroupNotices(pool,config,async()=>{assert.fail('invalidated_send');});
 }
});

test('failed deletion rolls back notice erasure; retained suppression wins over restored notification and consent rows',async()=>{
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{await worker.verify();for(const deleting of ['recipient','source'] as const){const s=await setup();await command(s.a,task(s.id,s.member));if(deleting==='source')await command(s.a,{kind:'group.transfer',groupId:s.id,memberId:s.member});const subject=deleting==='recipient'?s.b:s.a,request={accountId:subject.owner,requestId:randomUUID(),revision:subject.revision,confirm:'delete-account'};
   const original=(await h.admin.query('select to_jsonb(j) as row from rise.notification_jobs j where group_id=$1',[s.id])).rows[0].row;
   await h.admin.query(`create function rise_private.synthetic_notice_suppression_failure() returns trigger language plpgsql set search_path='' as $$begin if new.user_id='${subject.owner}'::uuid then raise exception 'synthetic notice failure';end if;return new;end;$$;create trigger synthetic_notice_suppression_failure before insert on rise_private.deletion_ledger for each row execute function rise_private.synthetic_notice_suppression_failure()`);
   try{assert.equal((await subject.browser.request('account/deletion',request)).statusCode,503);assert.deepEqual((await h.admin.query('select to_jsonb(j) as row from rise.notification_jobs j where group_id=$1',[s.id])).rows[0].row,original);assert.equal((await subject.browser.read()).json().signedIn,true);}finally{await h.admin.query('drop trigger synthetic_notice_suppression_failure on rise_private.deletion_ledger;drop function rise_private.synthetic_notice_suppression_failure()');}
   const member=(await h.admin.query('select to_jsonb(m) as row from rise.memberships m where group_id=$1 and user_id=$2',[s.id,subject.owner])).rows[0].row,preference=(await h.admin.query('select to_jsonb(p) as row from rise.group_preferences p where group_id=$1 and user_id=$2',[s.id,subject.owner])).rows[0]?.row,subscription=(await h.admin.query('select to_jsonb(s) as row from rise.push_subscriptions s where user_id=$1',[subject.owner])).rows[0]?.row;
   assert.equal((await subject.browser.request('account/deletion',request)).statusCode,200);assert.equal((await jobs(s.id)).length,0);
   // Replay only captured synthetic rows under the retained deletion ledger.
   // No restored credential or notification is exposed to an external provider.
   await h.admin.query("update rise.memberships set user_id=$2,display_name=$3,status='active',departed_at=null where id=$1",[member.id,member.user_id,member.display_name]);
   if(preference)await h.admin.query('insert into rise.group_preferences select * from jsonb_populate_record(null::rise.group_preferences,$1::jsonb)',[JSON.stringify(preference)]);
   if(subscription){await h.admin.query('delete from rise.push_subscriptions where id=$1',[subscription.id]);await h.admin.query('insert into rise.push_subscriptions select * from jsonb_populate_record(null::rise.push_subscriptions,$1::jsonb)',[JSON.stringify(subscription)]);}
   await h.admin.query('insert into rise.notification_jobs select * from jsonb_populate_record(null::rise.notification_jobs,$1::jsonb)',[JSON.stringify(original)]);
   await h.admin.query("update rise.notification_jobs set status='accepted',completed_at=clock_timestamp() where id=$1",[original.id]);const restoredPayload={owner:original.user_id,installation:original.installation_id,id:original.id,generation:original.installation_version,eventAt:new Date(original.fire_at).toISOString(),expiresAt:new Date(original.expires_at).toISOString()};const received=await s.b.browser.request(receive(restoredPayload));if(deleting==='source')assert.deepEqual(received.json(),{valid:false});else assert.equal(received.statusCode,401);await h.admin.query("update rise.notification_jobs set status='queued',completed_at=null where id=$1",[original.id]);
   let outbound=0;await sendGroupNotices(pool,config,async()=>{outbound++;return 201;});assert.equal(outbound,0);assert.equal((await subject.browser.request('push')).statusCode,401);
   await worker.pool.query('select rise_private.purge_group_identity($1)',[subject.owner]);assert.equal((await jobs(s.id)).length,0);assert.equal((await h.admin.query('select count(*)::int as n from rise_private.deletion_ledger where user_id=$1',[subject.owner])).rows[0].n,1);
   await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(subject.owner);assert.equal((await h.admin.query('select count(*)::int as n from auth.users where id=$1',[subject.owner])).rows[0].n,0);assert.equal((await h.admin.query('select count(*)::int as n from rise.family_tasks where group_id=$1',[s.id])).rows[0].n,1);
  }
 }finally{await worker.close();}
});
