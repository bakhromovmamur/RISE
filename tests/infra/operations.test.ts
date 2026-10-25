import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {operationsDatabase} from '../../server/operations/database.ts';

test('real aggregate monitor cannot read private rows, mutate queues or assume guard roles',async t=>{
  const h=await authHarness();t.after(()=>h.close());
  const env=parseEnv(await readFile('.rise-infra/test/ops.env','utf8')),db=operationsDatabase(env,'test');t.after(()=>db.close());
  const raw=new pg.Pool({connectionString:env.DATABASE_OPS_URL});t.after(()=>raw.end());
  const initial=await db.sample();assert.equal(typeof initial.senderReady,'boolean');
  for(const sql of ['select * from rise.push_jobs','select status from rise.push_jobs','select * from rise.profiles','select * from rise_private.server_sessions','select * from rise_private.deletion_jobs','select subscription_cipher from rise.push_subscriptions','set role rise_ops_guard','set role rise_worker','delete from rise.push_jobs','select * from auth.users'])await assert.rejects(raw.query(sql),{code:'42501'});
  await assert.rejects(raw.query('select rise_private.operations_snapshot($1,$2)',['local',env.INSTALLATION_ID]));
  await assert.rejects(raw.query('select rise_private.operations_snapshot($1,$2)',['test',randomUUID()]));
  for(const role of ['anon','authenticated']){
    const c=await h.admin.connect();try{await c.query('begin');await c.query(`set local role ${role}`);await assert.rejects(c.query('select rise_private.operations_snapshot($1,$2)',['test',env.INSTALLATION_ID]),{code:'42501'});}finally{await c.query('rollback');c.release();}
  }
  const workerEnv=parseEnv(await readFile('.rise-infra/test/push.env','utf8'));assert.equal(new URL(workerEnv.DATABASE_WORKER_URL!).port,'55422');
  const worker=new pg.Pool({connectionString:workerEnv.DATABASE_WORKER_URL});t.after(()=>worker.end());
  for(const pool of [h.store.pool,worker])await assert.rejects(pool.query('select rise_private.operations_snapshot($1,$2)',['test',env.INSTALLATION_ID]),{code:'42501'});
  const b=new AuthBrowser(h),login=await b.login(),owner=login.session.json().account.id,installation=randomUUID(),job=randomUUID();
  try{
    await h.admin.query("insert into rise.push_subscriptions(id,user_id,installation_hash,provider_session_id,language) values($1,$2,$3,$4,'en')",[installation,owner,randomBytes(32),randomUUID()]);
    await h.admin.query("insert into rise.push_jobs(id,user_id,installation_id,installation_version,generation,event_key,fire_at,expires_at,next_attempt_at) values($1,$2,$3,1,1,$4,clock_timestamp()-interval '45 seconds',clock_timestamp()+interval '45 seconds',clock_timestamp())",[job,owner,installation,randomUUID()]);
    const sample=await db.sample();assert.ok(sample.due>=initial.due+1);assert.ok(sample.oldestDueSeconds>=45);
    assert.equal(JSON.stringify(sample).includes(owner),false);assert.equal(JSON.stringify(sample).includes(installation),false);
    assert.equal((await h.admin.query('select status from rise.push_jobs where id=$1',[job])).rows[0].status,'queued');
  }finally{await h.admin.query('delete from auth.users where id=$1',[owner]);}
});

test('request errors expose bounded release/latency/status, never canary inputs or supplied request IDs',async t=>{
  const h=await authHarness();t.after(()=>h.close());const canary='OPS01_PRIVATE_CANARY';
  h.app.get('/api/v1/sync/diagnostic-test',async()=>{throw new Error(canary);});
  const response=await h.app.inject({method:'POST',url:'/api/v1/auth/code?token='+canary,headers:{host:'127.0.0.1:4191',origin:h.config.origin,'content-type':'application/json','x-request-id':canary,cookie:canary},payload:'{"private":"'+canary});
  assert.equal(response.statusCode,400);assert.notEqual(response.headers['x-request-id'],canary);
  const logs=JSON.stringify(h.logs);assert.equal(logs.includes(canary),false);
  const entries=h.logs as {event:string;durationMs?:number;release?:string;webRelease?:string}[];
  const entry=entries.find(e=>e.event==='request');assert.ok(entry);assert.equal(typeof entry.durationMs,'number');assert.equal(entry.release,h.config.release);assert.match(entry.webRelease??'',/^[a-f0-9]{20}$/);
  assert.equal((await h.app.inject({url:'/api/v1/sync/diagnostic-test',headers:{host:'127.0.0.1:4191'}})).statusCode,500);
  assert.equal(h.app.operationsSnapshot().requests,2);assert.equal(h.app.operationsSnapshot().syncFailures,1);assert.equal(JSON.stringify(h.logs).includes(canary),false);
});
