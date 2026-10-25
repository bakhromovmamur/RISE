import {loadavg,freemem} from "node:os";
import {install} from './router.mjs';
// Opt-in fixed-test diagnostic. Admin access seeds/cleans synthetic fixtures only;
// measured commands use real Auth, the restricted BFF, RLS and existing timeouts.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,statfs,writeFile} from 'node:fs/promises';
import {authHarness} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/auth.ts';
import {PersonalClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/personal.ts';
import {capacityProfile} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/capacity.ts';
import {project,personalTables,type Records} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/personalRecords.ts';
import {localDate,xpTotal} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/model.ts';
import type {AccountReceipt} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/accountCommands.ts';

assert.equal(process.argv.length,2,'no_arguments');
const mixed=false,users=5,run=randomUUID(),date=localDate('UTC');
const disk=await statfs('.');assert.ok(disk.bavail*disk.bsize>(users===100?12:2)*1024**3,'insufficient_host_disk_headroom');
const h=await authHarness(),lock=await h.admin.connect(),clients:PersonalClient[]=[],emails:string[]=[];
const groups:{id:string;owner:string}[]=[];
const directory=`.rise-infra/test/capacity/${run}`;
await mkdir(directory,{recursive:true,mode:0o700});
const saveManifest=()=>writeFile(`${directory}/fixtures.json`,JSON.stringify({installationId:h.config.installationId,run,emails,groups}),{mode:0o600});
const samples:{wave:string;user:number;ms:number;status:number;recovery:boolean}[]=[];
const report:Record<string,unknown>={run,environment:'fixed test',transport:'Fastify inject; real Auth/BFF/Postgres, no network latency or hosted acceptance',users,habitsPerUser:100,daysPerUser:730,occurrencesPerUser:73000,pool:h.config.database.max,samples};
let interrupted=false,locked=false;
const resources:unknown[]=[];let resourceTimer:ReturnType<typeof setInterval>|undefined,resourcePending:Promise<void>|null=null;
function sampleResources(){if(resourcePending)return;resourcePending=(async()=>{try{const phase=report.mixed&&typeof report.mixed==="object"&&"phase" in report.mixed?report.mixed.phase:"setup";const at=Date.now();const activity=(await h.admin.query("select backend_type,state,wait_event_type,count(*)::int as count from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() group by backend_type,state,wait_event_type")).rows;const vacuum=(await h.admin.query("select count(*)::int as count from pg_stat_progress_vacuum where datname=current_database()")).rows;const tables=(await h.admin.query("select schemaname,sum(n_live_tup)::bigint::text as estimated_live,sum(n_dead_tup)::bigint::text as estimated_dead,sum(autovacuum_count)::bigint::text as autovacuums from pg_stat_user_tables where schemaname in ('rise','rise_private','auth') group by schemaname")).rows;resources.push({at,phase,loadAverage:loadavg(),freeBytes:freemem(),activity,vacuum,tables});}catch{resources.push({at:Date.now(),error:"resource_sample_failed"});}})().finally(()=>{resourcePending=null;});}
const interrupt=()=>{interrupted=true;};process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
function running(){assert.ok(!interrupted,'interrupted');assert.equal(localDate('UTC'),date,'date_changed_during_workload');}
function ordered(records:Records){return Object.fromEntries(personalTables.map(table=>[table.name,[...records[table.name]].sort((a,b)=>JSON.stringify(table.keys.map(k=>a[k])).localeCompare(JSON.stringify(table.keys.map(k=>b[k]))))]));}
try{
 locked=(await lock.query("select pg_try_advisory_lock(hashtextextended('rise-capacity-workload',0)) as locked")).rows[0].locked;
 assert.ok(locked,'capacity_workload_already_running');
 const state=capacityProfile(date),ids=new Map(state.habits.map((habit,i)=>[habit.id,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
 for(const habit of state.habits){const id=ids.get(habit.id);assert.ok(id);habit.id=id;}
 for(const rows of Object.values(state.days))for(const row of rows){const id=ids.get(row.habitId);assert.ok(id);row.habitId=id;}
 const records=project(state,date),expectedRecords=ordered(records),expectedXp=xpTotal(state),seedStart=performance.now();
 const before=Number((await h.admin.query('select pg_database_size(current_database()) as bytes')).rows[0].bytes);
 for(let i=0;i<users;i++){
  running();const email=`auth-${run}-${i}@example.invalid`,c=new PersonalClient(h);emails.push(email);await saveManifest();
  clients.push(c);c.email=email;const login=await c.browser.login(email);c.owner=login.session.json().account.id;
  await c.command({kind:'account.initialize',name:'Synthetic capacity',timezone:'UTC',language:'en'});
  const db=await h.admin.connect();
  try{
   await db.query('begin');await db.query("set local statement_timeout='15s'");
   assert.equal((await db.query('select id from auth.users where id=$1 and email=$2',[c.owner,email])).rowCount,1);
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`rise-personal:${c.owner}`]);
   for(const table of personalTables){
    const updates=[...table.columns.filter(k=>!table.keys.includes(k)),'revision'].map(k=>`${k}=excluded.${k}`).join(',');
    for(let offset=0;offset<records[table.name].length;offset+=1000)await db.query(`insert into rise.${table.name} (owner_id,${table.columns.join(',')},revision) select $1::uuid,${table.columns.map(k=>`r.${k}`).join(',')},2 from jsonb_populate_recordset(null::rise.${table.name},$2::jsonb) r on conflict(owner_id${table.keys.length?','+table.keys.join(','):''}) do update set ${updates},updated_at=now()`,[c.owner,JSON.stringify(records[table.name].slice(offset,offset+1000))]);
   }
   await db.query('commit');c.revision=2;
  }catch(error){await db.query('rollback');throw error;}finally{db.release();}
  if((i+1)%10===0||users===1)process.stderr.write(`Seeded ${i+1}/${users} synthetic profiles\n`);
 }
 report.seedMs=performance.now()-seedStart;
 report.databaseGrowthBytes=Number((await h.admin.query('select pg_database_size(current_database()) as bytes')).rows[0].bytes)-before;
 const counts=(await h.admin.query('select owner_id,count(*)::int as n from rise.habit_occurrences where owner_id=any($1::uuid[]) group by owner_id',[clients.map(c=>c.owner)])).rows;
 assert.equal(counts.length,users);assert.ok(counts.every(row=>row.n===73000));
 report.execution=await install(h);sampleResources();resourceTimer=setInterval(sampleResources,10000);report.transport='Real loopback HTTP after injected synthetic login/seed; not hosted acceptance';process.stderr.write('One instrumented restricted BFF HTTP worker; original five-connection budget\n');
 const trials:unknown[]=[];report.trials=trials;
 let operationIndex=0;
 for(let round=0;round<4;round++)for(const check of ['full','undo']){
  running(); const index=operationIndex++;
  const intentions=clients.map(c=>({c,body:{protocolVersion:1,operationId:randomUUID(),baseRevision:c.revision,command:check==='full'?{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'}:{kind:'habit.correct',habitId:state.habits[0].id,date,check:null}}}));
  const at=performance.now();
  const mutations=Promise.all(intentions.map(async({c,body},user)=>{const response=await c.browser.request('personal/commands',body,{'x-rise-small-trial':String(index)});return{user,status:response.statusCode,ms:performance.now()-at,receipt:response.statusCode===200?response.json<AccountReceipt>():undefined};}));
  await new Promise(resolve=>setTimeout(resolve,25));
  const reads=await Promise.all(Array.from({length:10},async(_,i)=>{const user=i%users,begin=performance.now(),response=await clients[user].browser.request('groups',undefined,{'x-rise-small-trial':String(index)});if(response.statusCode===200){const result=response.json();assert.equal(result.accountId,clients[user].owner);assert.deepEqual(result.groups,[]);}return{user,status:response.statusCode,ms:performance.now()-begin};}));
  const results=await mutations;let recoveries=0;
  for(const result of results){const {c,body}=intentions[result.user];let receipt=result.receipt;
   if(!receipt){const retry=await c.browser.request('personal/commands',body);assert.equal(retry.statusCode,200,'exact_retry');receipt=retry.json<AccountReceipt>();recoveries++;}
   assert.equal(receipt.xp,expectedXp+(check==='full'?20:0));assert.equal(receipt.operationRevision,c.revision+1);c.revision=receipt.operationRevision;
   const replay=await c.browser.request('personal/commands',body);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),{...receipt,replayed:true});
  }
  trials.push({index,round,check,mutations:results.map(({receipt,...rest})=>rest),reads,recoveries});process.stderr.write(`Concurrent trial ${index}: ${results.filter(s=>s.status===200).length}/5 mutations, ${reads.filter(s=>s.status===200).length}/10 reads, ${recoveries} recoveries\n`);
 }
 report.exactReplay=true;
 let readBytes=0;const reads:number[]=[];
 for(const c of clients){
  running();const at=performance.now(),response=await c.browser.request('personal');reads.push(performance.now()-at);assert.equal(response.statusCode,200);
  readBytes+=Buffer.byteLength(response.body);const body=response.json();
  assert.equal(body.revision,c.revision);assert.equal(body.xp,expectedXp);assert.deepEqual(ordered(body.records),expectedRecords,'full_history_round_trip');
 }
 report.reads={samplesMs:reads,totalBytes:readBytes};report.historyAndXpRestored=true;
}catch(error){report.error=error instanceof Error?error.message:'capacity_check_failed';process.exitCode=1;}
finally{
 // Only this run's exact generated emails are eligible, including an account
 // created by Auth just before a lost login reply. Never sweep other test users.
 if(resourceTimer)clearInterval(resourceTimer);await resourcePending;await writeFile(new URL("./resources.json",import.meta.url),JSON.stringify(resources,null,2));
 const cleanupErrors:string[]=[];
 for(const c of clients)if(c.owner)try{await c.browser.request('logout',{});}catch{cleanupErrors.push('logout_failed');}
 for(const group of groups)try{
  assert.ok(clients.some(c=>c.owner===group.owner&&emails.includes(c.email)),'fixture_group_owner_mismatch');
  await h.admin.query('delete from rise.groups where id=$1 and owner_id=$2',[group.id,group.owner]);
 }catch{cleanupErrors.push('synthetic_group_cleanup_failed');}
 for(const email of emails)try{
  assert.ok(email.startsWith(`auth-${run}-`)&&email.endsWith('@example.invalid'));
  await h.admin.query('delete from auth.users where email=$1',[email]);
 }catch{cleanupErrors.push('synthetic_owner_cleanup_failed');}
 try{
  assert.equal((await h.admin.query('select count(*)::int as n from auth.users where email=any($1::text[])',[emails])).rows[0].n,0);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.groups where id=any($1::uuid[])',[groups.map(g=>g.id)])).rows[0].n,0);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.habit_occurrences where owner_id=any($1::uuid[])',[clients.filter(c=>c.owner).map(c=>c.owner)])).rows[0].n,0);
 }catch{cleanupErrors.push('cleanup_verification_failed');}
 report.cleanupErrors=cleanupErrors;report.cleaned=cleanupErrors.length===0;if(cleanupErrors.length)process.exitCode=1;
 await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2),{mode:0o600});
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(locked)await lock.query("select pg_advisory_unlock(hashtextextended('rise-capacity-workload',0))");lock.release();await h.close();
 process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);
}
