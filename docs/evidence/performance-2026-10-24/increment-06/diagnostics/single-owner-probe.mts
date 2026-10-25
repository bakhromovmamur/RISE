import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {authHarness} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/auth.ts';
import {PersonalClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/personal.ts';
import {capacityProfile} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/capacity.ts';
import {project,personalTables} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/personalRecords.ts';
import {localDate,xpTotal} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/model.ts';

const h=await authHarness(),run=randomUUID(),email=`auth-${run}-${randomUUID()}@example.invalid`,c=new PersonalClient(h),date=localDate('UTC');
const state=capacityProfile(date),ids=new Map(state.habits.map((habit,i)=>[habit.id,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
for(const habit of state.habits){const id=ids.get(habit.id);assert.ok(id);habit.id=id;}
for(const rows of Object.values(state.days))for(const row of rows){const id=ids.get(row.habitId);assert.ok(id);row.habitId=id;}
const records=project(state,date),expectedXp=xpTotal(state),started=performance.now();
const report:{[key:string]:unknown}={scope:'One-owner full-history discovery through real session/BFF/database; injected HTTP transport, no hosted/device/100-user acceptance.',date,habits:100,days:730,occurrences:73000,expectedXp};
try{
 const login=await c.browser.login(email);c.owner=login.session.json().account.id;c.email=email;
 await c.command({kind:'account.initialize',name:'Synthetic capacity smoke',timezone:'UTC',language:'en'});
 const before=(await h.admin.query('select pg_database_size(current_database())::text as bytes')).rows[0];
 const db=await h.admin.connect(),seed=performance.now();
 try{
  await db.query('begin');await db.query("set local statement_timeout='15s'");
  assert.equal((await db.query('select id from auth.users where id=$1 and email=$2',[c.owner,email])).rowCount,1);
  await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`rise-personal:${c.owner}`]);
  for(const table of personalTables){
   const columns=['owner_id',...table.columns,'revision'];
   const updates=[...table.columns.filter(k=>!table.keys.includes(k)),'revision'].map(k=>`${k}=excluded.${k}`).join(',');
   for(let offset=0;offset<records[table.name].length;offset+=1000){
    await db.query(`insert into rise.${table.name} (${columns.join(',')}) select $1::uuid,${table.columns.map(k=>`r.${k}`).join(',')},2 from jsonb_populate_recordset(null::rise.${table.name},$2::jsonb) r on conflict(owner_id${table.keys.length?','+table.keys.join(','):''}) do update set ${updates},updated_at=now()`,[c.owner,JSON.stringify(records[table.name].slice(offset,offset+1000))]);
   }
  }
  await db.query('commit');c.revision=2;
 }catch(error){await db.query('rollback');throw error;}finally{db.release();}
 report.seedMs=performance.now()-seed;
 const metrics=(await h.admin.query('select pg_database_size(current_database())::text as bytes,(select count(*)::int from rise.habit_occurrences where owner_id=$1) as occurrences,(select count(*)::int from rise.habits where owner_id=$1) as habits,(select count(*)::int from rise.habit_days where owner_id=$1) as days',[c.owner])).rows[0];
 assert.equal(metrics.occurrences,73000);assert.equal(metrics.habits,100);assert.equal(metrics.days,730);
 report.databaseGrowthBytes=Number(metrics.bytes)-Number(before.bytes);
 const samples=[];
 for(const check of ['full',null,'tiny',null,'full',null] as const){
  assert.equal(localDate('UTC'),date);
  const operationId=randomUUID(),baseRevision=c.revision,command=check?{kind:'habit.check',habitId:state.habits[0].id,date,check}:{kind:'habit.correct',habitId:state.habits[0].id,date,check:null};
  const at=performance.now(),response=await c.browser.request('personal/commands',{protocolVersion:1,operationId,baseRevision,command});
  const body=response.json();samples.push({action:check??'undo',ms:performance.now()-at,status:response.statusCode,code:body.error?.code??null});
  if(response.statusCode!==200)break;
  c.revision=body.operationRevision;assert.equal(body.xp,expectedXp+(check==='full'?20:check==='tiny'?10:0));
 }
 report.samples=samples;
 const readStart=performance.now(),read=await c.browser.request('personal');report.read={ms:performance.now()-readStart,status:read.statusCode,responseBytes:Buffer.byteLength(read.body)};
 if(read.statusCode===200){const body=read.json();assert.equal(body.records.habit_occurrences.length,73000);assert.equal(body.records.habits.length,100);report.finalRevision=body.revision;report.finalXp=body.xp;}
 report.totalMs=performance.now()-started;
}finally{
 const cleanup=performance.now();
 if(c.owner){await c.browser.request('logout',{});const removed=await h.admin.query('delete from auth.users where id=$1 and email=$2',[c.owner,email]);assert.equal(removed.rowCount,1);assert.equal((await h.admin.query('select count(*)::int as n from rise.habit_occurrences where owner_id=$1',[c.owner])).rows[0].n,0);}
 report.cleanupMs=performance.now()-cleanup;report.cleaned=true;await h.close();
 writeFileSync('/tmp/rise-capacity-smoke.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
