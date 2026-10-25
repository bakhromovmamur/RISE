// Fixed test installation only. The real BFF/queue/signing path uses synthetic
// accounts and an injected outbound boundary: this script never sends Web Push.
import assert from 'node:assert/strict';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../../tests/support/auth.ts';
import {tickPushSender,stopPushSender} from '../../server/push/runtime.ts';
import type {PushSenderConfig} from '../../server/push/worker.ts';

const h=await authHarness(),env=parseEnv(await readFile('.rise-infra/test/push.env','utf8'));
const url=new URL(env.DATABASE_WORKER_URL!);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55422');assert.equal(url.username,'rise_worker_login');
const pool=new pg.Pool({connectionString:url.href,max:5,connectionTimeoutMillis:3000,statement_timeout:3000});
const config:PushSenderConfig={installationId:env.INSTALLATION_ID!,dataKey:Buffer.from(env.PUSH_DATA_ENCRYPTION_KEY!,'hex'),vapid:{publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!,subject:env.VAPID_SUBJECT!}};
const fixtures:{browser:AuthBrowser;owner:string}[]=[],destinations=new Set<string>(),seen=new Set<string>(),latency:number[]=[],sender=randomUUID();
try{
 assert.equal(Number((await h.admin.query("select count(*) as n from rise.push_jobs where status in ('queued','leased') and fire_at<clock_timestamp()+interval '3 minutes' and expires_at>clock_timestamp()")).rows[0].n),0,'run_sequentially_without_other_imminent_work');
 assert.equal(Number((await h.admin.query("select count(*) as n from rise.push_tests where status='queued' and expires_at>clock_timestamp()")).rows[0].n),0,'pending_tests_require_isolation');
 for(let batch=0;batch<25;batch++)await Promise.all(Array.from({length:4},async()=>{
  const browser=new AuthBrowser(h),login=await browser.login(),owner=String(login.session.json().account.id);fixtures.push({browser,owner});
  for(let d=0;d<2;d++){
   browser.cookies.delete('rise_test_push');await browser.request('push');const ec=createECDH('prime256v1');ec.generateKeys();
   const endpoint=`https://fcm.googleapis.com/fcm/send/load-${randomUUID()}`;destinations.add(endpoint);
   const r=await browser.request('push',{accountId:owner,version:0,details:false,language:'en',subscription:{endpoint,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}});assert.equal(r.statusCode,200);
  }
  const at=Date.now()+3600000,r=await browser.request('push/plan',{accountId:owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'UTC',events:[{key:randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]});assert.equal(r.statusCode,200);assert.equal(r.json().jobs,2);
 }));
 assert.equal(Number((await h.admin.query("select count(*) as n from rise.push_jobs where user_id<>all($1::uuid[]) and status in ('queued','leased') and fire_at<clock_timestamp()+interval '1 minute' and expires_at>clock_timestamp()",[fixtures.map(f=>f.owner)])).rows[0].n),0,'another_owner_has_imminent_work');
 const due=(await h.admin.query('select clock_timestamp() as now')).rows[0].now as Date;
 await h.admin.query("update rise.push_jobs set fire_at=$2,expires_at=$2::timestamptz+interval '2 minutes',next_attempt_at=$2 where user_id=any($1::uuid[]) and status='queued'",[fixtures.map(f=>f.owner),due]);
 let active=0,peak=0,ticks=0;const errors:string[]=[];
 while(latency.length<200&&Date.now()-due.getTime()<35000){
  const result=await tickPushSender(pool,sender,config,async details=>{
   if(!destinations.has(details.endpoint)||seen.has(details.endpoint)){errors.push('unexpected_or_duplicate_submission');return 400;}
   seen.add(details.endpoint);active++;peak=Math.max(peak,active);
   try{
    const now=(await h.admin.query('select clock_timestamp() as now')).rows[0].now as Date;latency.push(now.getTime()-due.getTime());
    assert.ok(details.body?.length);assert.ok(String(details.headers.Authorization).includes('vapid'));
    await new Promise(resolve=>setTimeout(resolve,100));return 201;
   }finally{active--;}
  });ticks++;
  const attempted=Object.entries(result.reminders).filter(([status])=>status!=='deferred').reduce((n,[,count])=>n+count,0);
  if(attempted<4&&latency.length<200)await new Promise(resolve=>setTimeout(resolve,1000));
 }
 latency.sort((a,b)=>a-b);
 const statuses=(await h.admin.query('select status,count(*)::int as count from rise.push_jobs where user_id=any($1::uuid[]) group by status',[fixtures.map(f=>f.owner)])).rows;
 const report={environment:'test',owners:100,installations:200,simultaneouslyDue:200,syntheticProviderMs:100,connections:5,lanes:4,peakConcurrent:peak,ticks,submitted:latency.length,p50Ms:latency[99],p95Ms:latency[189],maxMs:latency.at(-1),statuses,externalRequests:0};
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 assert.deepEqual(errors,[]);assert.equal(latency.length,200);assert.ok(peak>1&&peak<=4);assert.deepEqual(statuses,[{status:'accepted',count:200}]);assert.ok(latency[189]<=30000,'local_due_to_submission_p95_exceeds_30_seconds');
}finally{
 await stopPushSender(pool,sender);
 for(const f of fixtures){await f.browser.request('logout',{});await h.admin.query('delete from auth.users where id=$1',[f.owner]);}
 await pool.end();await h.close();
}
