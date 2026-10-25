import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {sendPushReminders,type PushSenderConfig} from '../../server/push/worker.ts';
import {tickPushSender,stopPushSender} from '../../server/push/runtime.ts';
const ece=createRequire(import.meta.url)('http_ece') as {decrypt:(body:Buffer,options:object)=>Buffer};
let h:Awaited<ReturnType<typeof authHarness>>,pool:pg.Pool,config:PushSenderConfig;
before(async()=>{h=await authHarness();const e=parseEnv(await readFile('.rise-infra/test/push.env','utf8'));const url=new URL(e.DATABASE_WORKER_URL!);assert.equal(url.port,'55422');pool=new pg.Pool({connectionString:url.href,max:5,statement_timeout:3000});config={installationId:e.INSTALLATION_ID!,dataKey:Buffer.from(e.PUSH_DATA_ENCRYPTION_KEY!,'hex'),vapid:{publicKey:e.VAPID_PUBLIC_KEY!,privateKey:e.VAPID_PRIVATE_KEY!,subject:e.VAPID_SUBJECT!}};});
after(async()=>{await pool?.end();await h?.close();});
async function setup(){
 const b=new AuthBrowser(h),login=await b.login(),owner=login.session.json().account.id;
 const subscribe=async()=>{await b.request('push');const ec=createECDH('prime256v1');ec.generateKeys();const auth=randomBytes(16).toString('base64url');const saved=await b.request('push',{accountId:owner,version:0,details:false,language:'uz',subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth}}});assert.equal(saved.statusCode,200);return {id:saved.json().installation.id,ec,auth,cookie:b.cookies.get('rise_test_push')!};};
 const first=await subscribe();b.cookies.delete('rise_test_push');const second=await subscribe();b.cookies.set('rise_test_push',first.cookie);
 const at=Date.now()+60000,input={accountId:owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'UTC',events:[{key:randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]};
 const saved=await b.request('push/plan',input);assert.equal(saved.statusCode,200);
 await h.admin.query("update rise.push_jobs set fire_at=date_trunc('milliseconds',clock_timestamp())-interval '1 second',expires_at=date_trunc('milliseconds',clock_timestamp())+interval '90 seconds',next_attempt_at=clock_timestamp()-interval '1 second' where user_id=$1",[owner]);
 return {b,owner,first,second,input};
}
function query(payload:Record<string,unknown>){return 'push/reminder?'+new URLSearchParams(Object.fromEntries(['owner','installation','id','generation','planGeneration','eventAt','expiresAt'].map(k=>[k,String(payload[k])])));}
test('live queue fan-out encrypts generic reminders, authenticates closed receivers and deduplicates retries',async()=>{
 const s=await setup(),payloads:Record<string,unknown>[]=[];
 try{
  const result=await sendPushReminders(pool,config,async details=>{
   let payload:Record<string,unknown>|null=null;
   for(const device of [s.first,s.second])try{payload=JSON.parse(ece.decrypt(details.body!,{version:'aes128gcm',privateKey:device.ec,authSecret:device.auth}).toString());break;}catch{/* Try the other synthetic receiver key. */}
   assert.ok(payload);assert.deepEqual(Object.keys(payload).sort(),['eventAt','expiresAt','generation','id','installation','language','owner','planGeneration','type','version']);assert.equal(payload.type,'reminder');assert.equal(payload.language,'uz');assert.equal(payload.planGeneration,1);assert.equal(payload.id,s.input.events[0].key);assert.ok(Number(details.headers.TTL)>0&&Number(details.headers.TTL)<=90);assert.ok(String(details.headers.Authorization).includes('vapid'));payloads.push(payload);return 201;
  });assert.equal(result.accepted,2);
  await sendPushReminders(pool,config,async()=>{throw new Error('duplicate_provider_request');});assert.equal(payloads.length,2);
  for(const p of payloads){s.b.cookies.set('rise_test_push',p.installation===s.first.id?s.first.cookie:s.second.cookie);const decision=await s.b.request(query(p));assert.equal(decision.statusCode,200);assert.equal(decision.headers['cache-control'],'no-store');assert.deepEqual(decision.json(),{valid:true});assert.deepEqual((await s.b.request(query({...p,planGeneration:2}))).json(),{valid:false});assert.deepEqual((await s.b.request(query({...p,owner:randomUUID()}))).json(),{valid:false});}
  s.b.cookies.delete('rise_test_push');assert.deepEqual((await s.b.request(query(payloads[0]))).json(),{valid:false});
  const guest=new AuthBrowser(h);assert.equal((await guest.request(query(payloads[0]))).statusCode,401);
  assert.equal((await s.b.request(query({...payloads[0],eventAt:'bad'}))).statusCode,422);
 }finally{await s.b.request('logout',{});}
});
test('post-acceptance cancellation denies receive while preserving provider outcome and personal data',async()=>{
 const s=await setup();let payload:Record<string,unknown>={};
 try{
  await sendPushReminders(pool,config,async details=>{try{payload=JSON.parse(ece.decrypt(details.body!,{version:'aes128gcm',privateKey:s.first.ec,authSecret:s.first.auth}).toString());}catch{/* Second installation. */}return 201;});
  assert.deepEqual((await s.b.request(query(payload))).json(),{valid:true});
  const before=(await s.b.request('personal')).json();
  const accepted=(await h.admin.query('select id,completed_at from rise.push_jobs where user_id=$1 order by id',[s.owner])).rows;
  assert.equal((await s.b.request('push/cancel-plan',{accountId:s.owner,requestId:randomUUID(),keys:[s.input.events[0].key]})).statusCode,200);
  assert.deepEqual((await s.b.request(query(payload))).json(),{valid:false});
  const jobs=(await h.admin.query('select status,presentation_canceled,attempts from rise.push_jobs where user_id=$1',[s.owner])).rows;assert.equal(jobs.length,2);assert.deepEqual((await h.admin.query('select id,completed_at from rise.push_jobs where user_id=$1 order by id',[s.owner])).rows,accepted);assert.ok(jobs.every(j=>j.status==='accepted'&&j.presentation_canceled&&j.attempts===1));assert.deepEqual((await s.b.request('personal')).json(),before);
 }finally{await s.b.request('logout',{});}
});
test('replacement, expiry, wrong installation and revoked sessions deny receive',async()=>{
 const s=await setup();let payload:Record<string,unknown>={};
 try{
  await sendPushReminders(pool,config,async details=>{try{payload=JSON.parse(ece.decrypt(details.body!,{version:'aes128gcm',privateKey:s.first.ec,authSecret:s.first.auth}).toString());}catch{/* Second installation. */}return 201;});
  s.b.cookies.set('rise_test_push',s.second.cookie);assert.deepEqual((await s.b.request(query(payload))).json(),{valid:false});s.b.cookies.set('rise_test_push',s.first.cookie);
  assert.equal((await s.b.request('push/plan',{...s.input,requestId:randomUUID(),expectedGeneration:1,events:[]})).statusCode,200);assert.deepEqual((await s.b.request(query(payload))).json(),{valid:false});
  const id=(await h.admin.query('select provider_session_id from rise.push_subscriptions where id=$1',[s.first.id])).rows[0].provider_session_id;await h.admin.query('delete from auth.sessions where id=$1',[id]);assert.equal((await s.b.request(query(payload))).statusCode,401);
 }finally{await s.b.request('logout',{});}
});
test('sender readiness follows heartbeat, expires after crash and respects concurrent processes',async()=>{
 const s=await setup(),a=randomUUID(),b=randomUUID();
 try{
  assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,false);
  const result=await tickPushSender(pool,a,config,async()=>201);assert.ok(result.reminders.accepted>=1);assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,true);
  await tickPushSender(pool,b,config,async()=>201);await stopPushSender(pool,a);assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,true);
  await h.admin.query("update rise_private.push_senders set heartbeat_at=clock_timestamp()-interval '31 seconds' where id=$1",[b]);assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,false);
  await tickPushSender(pool,b,config,async()=>{throw new Error('no_due_job');});assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,true);await stopPushSender(pool,b);assert.equal((await s.b.request('push/plan')).json().dispatchEnabled,false);
  for(const role of ['anon','authenticated','service_role']){const c=await h.admin.connect();try{await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query('select * from rise_private.push_senders'),{code:'42501'});}finally{await c.query('rollback');c.release();}}
  await assert.rejects(h.store.pool.query('insert into rise_private.push_senders(id) values($1)',[randomUUID()]),{code:'42501'});
  await assert.rejects(pool.query('update rise.push_jobs set presentation_canceled=false'),{code:'42501'});
 }finally{await stopPushSender(pool,a);await stopPushSender(pool,b);await s.b.request('logout',{});}
});
test('real signer retries transient errors and retires expired endpoints without replaying accepted receivers',async()=>{
 const s=await setup();let calls=0;
 try{
  assert.equal((await sendPushReminders(pool,config,async()=>{calls++;return 503;})).queued,2);
  await h.admin.query("update rise.push_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where user_id=$1",[s.owner]);
  assert.equal((await sendPushReminders(pool,config,async()=>{calls++;return 410;})).retired,2);assert.equal(calls,4);
  assert.ok((await h.admin.query('select enabled,subscription_cipher from rise.push_subscriptions where user_id=$1',[s.owner])).rows.every(s=>!s.enabled&&s.subscription_cipher===null));
 }finally{await s.b.request('logout',{});}
});
import {spawn} from 'node:child_process';
test('local watch command advertises readiness and clears it on graceful shutdown without provider traffic',async()=>{
 // This suite owns the fixed test environment; never start the real transport
 // when any synthetic test has eligible outbound work left behind.
 const due=(await h.admin.query("select (select count(*) from rise.push_jobs where status in ('queued','leased') and fire_at<=clock_timestamp()+interval '15 seconds' and expires_at>clock_timestamp())+(select count(*) from rise.push_tests t join rise.push_subscriptions s on s.id=t.installation_id where s.enabled and t.status='queued' and t.expires_at>clock_timestamp())+(select count(*) from rise.notification_jobs where status in ('queued','leased') and fire_at<=clock_timestamp()+interval '15 seconds' and expires_at>clock_timestamp()) as n")).rows[0].n;assert.equal(Number(due),0);
 const child=spawn(process.execPath,['--import','tsx','scripts/infra/push.ts','watch','test'],{stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{output+=String(chunk);});
 const exit=new Promise<number|null>((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});const timer=setTimeout(()=>child.kill('SIGKILL'),15000);
 try{
  let ready=false;for(let n=0;n<80;n++){ready=(await h.admin.query("select exists(select 1 from rise_private.push_senders where heartbeat_at>clock_timestamp()-interval '30 seconds') as ready")).rows[0].ready;if(ready)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(ready,true,'watch_process_started');child.kill('SIGTERM');assert.equal(await exit,0);
  assert.equal((await h.admin.query('select count(*)::int as n from rise_private.push_senders')).rows[0].n,0);
  assert.ok(!/https:|Authorization|PRIVATE KEY|subscription_cipher/.test(output),'output_contains_only_aggregate_status');
 }finally{clearTimeout(timer);if(child.exitCode===null){child.kill('SIGTERM');await exit;}}
});
