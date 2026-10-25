import {hash} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/server/auth/crypto.ts';
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

assert.ok(process.argv.length===3&&['smoke','full'].includes(process.argv[2]),'usage: node --import tsx scripts/infra/check-account-load.ts smoke|full');
const users=process.argv[2]==='full'?100:1,run=randomUUID(),date=localDate('UTC');
const disk=await statfs('.');assert.ok(disk.bavail*disk.bsize>(users===100?12:2)*1024**3,'insufficient_host_disk_headroom');
const h=await authHarness(),lock=await h.admin.connect(),clients:PersonalClient[]=[],emails:string[]=[];
const directory=`.rise-infra/test/capacity/${run}`;
await mkdir(directory,{recursive:true,mode:0o700});
const saveManifest=()=>writeFile(`${directory}/fixtures.json`,JSON.stringify({installationId:h.config.installationId,run,emails}),{mode:0o600});
const samples:{wave:string;user:number;ms:number;status:number;recovery:boolean}[]=[];
const report:Record<string,unknown>={run,environment:'fixed test',transport:'Fastify inject; real Auth/BFF/Postgres, no network latency or hosted acceptance',users,habitsPerUser:100,daysPerUser:730,occurrencesPerUser:73000,pool:h.config.database.max,samples};
let interrupted=false,locked=false;
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
 const comparison=[];
 const c=clients[0],sql=await h.store.pool.connect();
 try{
  await sql.query('begin');
  const actor=(await sql.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(c.browser.cookies.get('rise_test_session')!)])).rows[0];
  assert.equal(actor.user_id,c.owner);
  await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.user_id,session_id:actor.provider_session_id})]);
  assert.equal((await sql.query('select rise_private.active_session() as active')).rows[0].active,true);
  const table=personalTables.find(t=>t.name==='habit_occurrences')!;
  const select=table.columns.map(k=>`'${k}',t.${k}`).join(',');
  let reference:unknown;
  for(let round=0;round<3;round++)for(const fn of (round%2?['direct_columns','jsonb_build_object']:['jsonb_build_object','direct_columns'])){
   const selection=fn==='direct_columns'?"to_json(t.date) as date,t.habit_id,t.position,t.check_kind,t.data":`${fn}(${select}) as record`;
   const query=`select ${selection} from rise.habit_occurrences t where owner_id=$1 order by t.date,t.position,t.habit_id limit 250001`;
   const at=performance.now(),response=await sql.query(query,[c.owner]),ms=performance.now()-at;
   const values=fn==='direct_columns'?response.rows:response.rows.map(row=>row.record);
   if(reference)assert.deepEqual(values,reference,'projection_value_parity');else reference=values;
   const plan=(await sql.query(`explain(analyze,buffers,format json) ${query}`,[c.owner])).rows[0]['QUERY PLAN'][0];
   comparison.push({round,fn,ms,rows:response.rowCount,executionMs:plan['Execution Time'],planningMs:plan['Planning Time'],sharedHits:plan.Plan['Shared Hit Blocks'],sharedReads:plan.Plan['Shared Read Blocks'],node:plan.Plan['Node Type']});
  }
  await sql.query('rollback');
 }catch(e){await sql.query('rollback');throw e;}finally{sql.release();}
 await writeFile('/tmp/rise-account-direct-columns-comparison.json',JSON.stringify(comparison,null,2));
 for(const wave of ['full','undo'] as const){
  running();const pending=clients.map(c=>({protocolVersion:1,operationId:randomUUID(),baseRevision:c.revision,command:wave==='full'?{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'}:{kind:'habit.correct',habitId:state.habits[0].id,date,check:null}}));
  async function send(i:number,recovery:boolean){
   const at=performance.now(),response=await clients[i].browser.request('personal/commands',pending[i]);
   samples.push({wave,user:i,ms:performance.now()-at,status:response.statusCode,recovery});
   if(response.statusCode!==200)return null;
   const receipt=response.json<AccountReceipt>();assert.equal(receipt.xp,expectedXp+(wave==='full'?20:0));
   assert.equal(receipt.operationRevision,3+(wave==='undo'?1:0));clients[i].revision=receipt.operationRevision;return receipt;
  }
  const receipts=await Promise.all(clients.map((_,i)=>send(i,false)));
  process.stderr.write(`${wave}: ${receipts.filter(Boolean).length}/${users} first attempts accepted\n`);
  // Recover identical operations sequentially after the burst; never hide these
  // retries in the first-attempt percentile or assign a replacement operation ID.
  for(let i=0;i<users;i++){
   running();if(!receipts[i]){receipts[i]=await send(i,true);assert.ok(receipts[i],'sequential_exact_retry_failed');}
   const replay=await clients[i].browser.request('personal/commands',pending[i]);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),{...receipts[i],replayed:true},'exact_receipt_replay');
  }
 }
 let readBytes=0;const reads:number[]=[];
 for(const c of clients){
  running();const at=performance.now(),response=await c.browser.request('personal');reads.push(performance.now()-at);assert.equal(response.statusCode,200);
  readBytes+=Buffer.byteLength(response.body);const body=response.json();
  assert.equal(body.revision,4);assert.equal(body.xp,expectedXp);assert.deepEqual(ordered(body.records),expectedRecords,'full_history_round_trip');
 }
 report.reads={samplesMs:reads,totalBytes:readBytes};report.historyAndXpRestored=true;
 const first=samples.filter(s=>!s.recovery),accepted=first.filter(s=>s.status===200).map(s=>s.ms).sort((a,b)=>a-b);
 report.firstAttempts={count:first.length,accepted:accepted.length,failed:first.length-accepted.length,p95Ms:accepted[Math.ceil(accepted.length*.95)-1]??null,maxMs:accepted.at(-1)??null};
 report.localPersonalGate=first.length===users*2&&accepted.length===first.length&&accepted[Math.ceil(accepted.length*.95)-1]<=1000;
 if(!report.localPersonalGate)process.exitCode=1;
}catch(error){report.error=error instanceof Error?error.message:'capacity_check_failed';process.exitCode=1;}
finally{
 // Only this run's exact generated emails are eligible, including an account
 // created by Auth just before a lost login reply. Never sweep other test users.
 const cleanupErrors:string[]=[];
 for(const c of clients)if(c.owner)try{await c.browser.request('logout',{});}catch{cleanupErrors.push('logout_failed');}
 for(const email of emails)try{
  assert.ok(email.startsWith(`auth-${run}-`)&&email.endsWith('@example.invalid'));
  await h.admin.query('delete from auth.users where email=$1',[email]);
 }catch{cleanupErrors.push('synthetic_owner_cleanup_failed');}
 try{
  assert.equal((await h.admin.query('select count(*)::int as n from auth.users where email=any($1::text[])',[emails])).rows[0].n,0);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.habit_occurrences where owner_id=any($1::uuid[])',[clients.filter(c=>c.owner).map(c=>c.owner)])).rows[0].n,0);
 }catch{cleanupErrors.push('cleanup_verification_failed');}
 report.cleanupErrors=cleanupErrors;report.cleaned=cleanupErrors.length===0;if(cleanupErrors.length)process.exitCode=1;
 await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2),{mode:0o600});
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(locked)await lock.query("select pg_advisory_unlock(hashtextextended('rise-capacity-workload',0))");lock.release();await h.close();
 process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);
}
