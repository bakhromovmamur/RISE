import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {PersonalClient} from '../../tests/support/personal.ts';
import type {AccountReceipt} from '../../src/contracts/accountCommands.ts';
import {parseGroups,parseGroupReceipt,type GroupCommand,type GroupOperation,type GroupReceipt} from '../../src/contracts/groups.ts';
import {parseSharedPage,type SharedOccurrence} from '../../src/contracts/sharedContent.ts';
import {SharedContent} from '../../src/groups/content.ts';
import type {GroupState} from '../../src/groups/session.ts';
import {AccountError} from '../../src/auth/client.ts';

type MutationSample={kind:'personal'|'shared';subject:number;round:number;status:number;ms:number;lateMs:number;recovery:boolean;deferred:boolean};
type Observation={group:number;round:number;observer:number;revision:number;completed:boolean;acceptedAt:number;observedMs:number|null};
type Family={id:string;taskId:string;revision:number;owner:number;member:number};
export interface MixedContext {
 clients:PersonalClient[];date:string;habitId:string;expectedXp:number;
 registerGroup:(id:string,owner:string)=>Promise<void>;running:()=>void;progress:Record<string,unknown>;
}
const summary=(samples:MutationSample[])=>{
 const first=samples.filter(s=>!s.recovery),accepted=first.filter(s=>s.status===200).map(s=>s.ms).sort((a,b)=>a-b);
 const scheduled=first.filter(s=>s.status===200).map(s=>s.ms+s.lateMs).sort((a,b)=>a-b);
 return{planned:first.length,accepted:accepted.length,failed:first.filter(s=>!s.deferred&&s.status!==200).length,deferred:first.filter(s=>s.deferred).length,
  p95Ms:accepted[Math.ceil(accepted.length*.95)-1]??null,p95ScheduledMs:scheduled[Math.ceil(scheduled.length*.95)-1]??null,maxMs:accepted.at(-1)??null,maxSchedulingLateMs:Math.max(0,...first.map(s=>s.lateMs))};
};

/** A local protocol-level load diagnostic, not browser paint or hosted capacity.
 * The caller owns fixed-test identity, fixture seeding and exact-owner cleanup. */
export async function mixedAccountLoad({clients,date,habitId,expectedXp,registerGroup,running,progress}:MixedContext){
 assert.ok(clients.length===2||clients.length===100,'fixed_mixed_dimensions');
 const families:Family[]=[],origin=clients[0].browser.harness.config.origin;
 const samples:MutationSample[]=[],observations:Observation[]=[],polls:{user:number;status:number;ms:number;lateMs:number;collection:string}[]=[];
 Object.assign(progress,{phase:'setup',samples,observations,polls});
 let fatal:unknown;
 const seen=new Map<number,{revision:number;completed:boolean;at:number}>(),refreshers=new Map<number,()=>Promise<void>>();
 async function setup(user:number,command:GroupCommand,expectedRevision=0){
  running();const c=clients[user],body:GroupOperation={accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command};
  const response=await c.browser.request('groups/commands',body);assert.equal(response.statusCode,200,'mixed_group_setup_status');
  return parseGroupReceipt(response.json(),origin);
 }
 for(let owner=0;owner<clients.length;owner+=2){
  const id=randomUUID(),member=owner+1,taskId=randomUUID();await registerGroup(id,clients[owner].owner);
  const made=await setup(owner,{kind:'group.create',groupId:id,groupKind:'family',name:'Synthetic capacity family',timezone:'UTC',nickname:'Owner'});
  const invite=await setup(owner,{kind:'group.invite',groupId:id},made.revision);assert.ok(invite.invitation);
  const joined=await setup(member,{kind:'group.accept',token:new URL(invite.invitation.link).hash.slice(8),nickname:'Member'});
  const task=await setup(owner,{kind:'task.create',groupId:id,taskId,title:'Synthetic shared task',notes:'',assignee:null,date,time:null,weekdays:[]},joined.revision);
  families.push({id,taskId,revision:task.revision,owner,member});
 }
 process.stderr.write(`Mixed setup: ${clients.length} accounts, ${families.length} families\n`);
 const rounds=4,roundMs=30000,pollMs=15000,start=performance.now()+500;
 // Capture every operation before scheduling. Later failed/deferred intentions
 // retain these same IDs, revisions and bodies during sequential recovery.
 const personal=clients.map(c=>Array.from({length:rounds},(_,round)=>({protocolVersion:1,operationId:randomUUID(),baseRevision:2+round,
  command:round%2?{kind:'habit.correct',habitId,date,check:null}:{kind:'habit.check',habitId,date,check:'full'}})));
 const shared=families.map(f=>Array.from({length:rounds},(_,round):GroupOperation=>({accountId:clients[round%2?f.member:f.owner].owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:f.revision+round,
  command:{kind:'task.complete',groupId:f.id,taskId:f.taskId,date,completed:round%2===0}})));
 const personalReceipts:(AccountReceipt|null)[][]=clients.map(()=>Array.from({length:rounds},()=>null));
 const sharedReceipts:(GroupReceipt|null)[][]=families.map(()=>Array.from({length:rounds},()=>null));
 const blockedPersonal=new Set<number>(),blockedShared=new Set<number>(),stop=new AbortController();
 async function until(at:number,signal?:AbortSignal){if(at>performance.now())await delay(at-performance.now(),undefined,signal?{signal}:undefined);running();}
 async function mutate(kind:'personal'|'shared',subject:number,round:number,recovery:boolean,due:number){
  running();const blocked=kind==='personal'?blockedPersonal:blockedShared,lateMs=recovery?0:Math.max(0,performance.now()-due);
  if(!recovery&&blocked.has(subject)){samples.push({kind,subject,round,status:0,ms:0,lateMs,recovery:false,deferred:true});return;}
  const family=families[subject],user=kind==='personal'?subject:round%2?family.member:family.owner;
  const body=kind==='personal'?personal[subject][round]:shared[subject][round],at=performance.now();
  const response=await clients[user].browser.request(kind==='personal'?'personal/commands':'groups/commands',body);
  samples.push({kind,subject,round,status:response.statusCode,ms:performance.now()-at,lateMs,recovery,deferred:false});
  if(response.statusCode!==200){blocked.add(subject);return;}
  if(kind==='personal'){
   const receipt=response.json<AccountReceipt>();assert.equal(receipt.operationRevision,3+round);assert.equal(receipt.xp,expectedXp+(round%2?0:20));
   personalReceipts[subject][round]=receipt;clients[user].revision=receipt.operationRevision;
  }else{
   const receipt=parseGroupReceipt(response.json(),origin);assert.equal(receipt.operationId,body.operationId);assert.equal(receipt.revision,family.revision+round+1);
   sharedReceipts[subject][round]=receipt;
   if(!recovery){
    const observer=round%2?family.owner:family.member,acceptedAt=performance.now()-start,prior=seen.get(observer);
    observations.push({group:subject,round,observer,revision:receipt.revision,completed:round%2===0,acceptedAt,observedMs:prior?.revision===receipt.revision&&prior.completed===(round%2===0)?Math.max(0,prior.at-acceptedAt):null});
    await refreshers.get(user)?.();
   }
  }
 }
 async function poll(user:number){
  const family=families[Math.floor(user/2)],listeners=new Set<()=>void>();let version=0;
  let view:GroupState={groups:[],loaded:false,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null};
  const refresh=async(due=performance.now())=>{
   const generation=++version,at=performance.now(),head=await clients[user].browser.request('groups');
   polls.push({user,status:head.statusCode,ms:performance.now()-at,lateMs:Math.max(0,at-due),collection:'groups'});
   if(generation!==version)return false;
   if(head.statusCode===200){const parsed=parseGroups(head.json());assert.equal(parsed.accountId,clients[user].owner);view={...view,groups:parsed.groups,loaded:true,readError:null};}
   else view={...view,groups:[],loaded:false,readError:'unavailable'};
   for(const notify of listeners)notify();return view.loaded;
  };
  const reader=new SharedContent(clients[user].owner,{getSnapshot:()=>view,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},refresh},
   {content:async query=>{
    const {groupId,...parameters}=query,url=`groups/${groupId}/content?${new URLSearchParams(Object.entries(parameters).map<[string,string]>(([k,v])=>[k,String(v)]))}`;
    const at=performance.now(),response=await clients[user].browser.request(url);polls.push({user,status:response.statusCode,ms:performance.now()-at,lateMs:0,collection:query.collection});
    if(response.statusCode!==200)throw new AccountError(response.json<{error?:{code?:string}}>().error?.code??'unavailable');
    return parseSharedPage(response.json());
   }},()=>!stop.signal.aborted);
  async function load(){
   // Match the existing hook: loaded/error entries remain until invalidated by
   // metadata. A group_changed load triggers the real reader's immediate refresh.
   for(let pass=0;pass<3;pass++){
    const revision=view.groups.find(g=>g.id===family.id)?.revision;if(!view.loaded||revision===undefined)return;
    await Promise.all((['tasks','occurrences'] as const).map(async collection=>{
     const query={groupId:family.id,collection,...(collection==='occurrences'?{date}:{})},entry=reader.get(query);
     if(!entry.loaded&&!entry.error&&!entry.loading)await reader.load(query);
    }));
    const entry=reader.get({groupId:family.id,collection:'occurrences',date});
    if(entry.loaded){
     assert.equal(entry.next,null);const row=entry.rows.find((r):r is SharedOccurrence=>'taskId'in r&&r.taskId===family.taskId&&r.date===date);
     if(row){seen.set(user,{revision:entry.revision!,completed:row.completed,at:performance.now()-start});
      for(const expected of observations)if(expected.observer===user&&expected.observedMs===null&&expected.revision===entry.revision&&row.completed===expected.completed)expected.observedMs=Math.max(0,performance.now()-start-expected.acceptedAt);
     }
    }
    if(revision===view.groups.find(g=>g.id===family.id)?.revision)return;
   }
  }
  refreshers.set(user,async()=>{await refresh();await load();});
  try{for(let tick=0;!stop.signal.aborted;tick++){
   const due=start+user*pollMs/clients.length+tick*pollMs;
   try{await until(due,stop.signal);}catch(error){if(stop.signal.aborted)return;throw error;}
   await refresh(due);await load();
  }}finally{reader.close();refreshers.delete(user);}
 }
 const pollers=clients.map((_,i)=>poll(i).catch(error=>{fatal??=error;}));
 progress.phase='measurement';const heartbeat=setInterval(()=>process.stderr.write(`Mixed ${Math.max(0,Math.round((performance.now()-start)/1000))}s: ${samples.filter(s=>s.status===200).length}/${samples.length} first intentions accepted\n`),15000);
 try{
  const jobs=[...clients.map((_,i)=>(async()=>{for(let round=0;round<rounds;round++){const due=start+round*roundMs+i*roundMs/clients.length;await until(due);await mutate('personal',i,round,false,due);}})()),
   ...families.map((_,i)=>(async()=>{for(let round=0;round<rounds;round++){const due=start+round*roundMs+(i+.5)*roundMs/families.length;await until(due);await mutate('shared',i,round,false,due);}})())];
  const finished=await Promise.allSettled(jobs);for(const result of finished)if(result.status==='rejected')fatal??=result.reason;
  if(fatal)throw fatal;
  await until(start+rounds*roundMs+pollMs+1000);
 }finally{clearInterval(heartbeat);stop.abort();await Promise.allSettled(pollers);}
 if(fatal)throw fatal;
 process.stderr.write(`Mixed measured: ${samples.filter(s=>s.status===200).length}/${samples.length} first intentions accepted\n`);
 const measuredMs=performance.now()-start;
 progress.phase='recovery';
 for(let user=0;user<clients.length;user++)for(let round=0;round<rounds;round++){
  if(!personalReceipts[user][round])await mutate('personal',user,round,true,0);
  assert.ok(personalReceipts[user][round],'mixed_personal_recovery_failed');
  const replay=await clients[user].browser.request('personal/commands',personal[user][round]);assert.equal(replay.statusCode,200);
  assert.deepEqual(replay.json(),{...personalReceipts[user][round],replayed:true},'mixed_personal_exact_replay');
 }
 for(let index=0;index<families.length;index++){
  const f=families[index];
  for(let round=0;round<rounds;round++){
   if(!sharedReceipts[index][round])await mutate('shared',index,round,true,0);
   assert.ok(sharedReceipts[index][round],'mixed_shared_recovery_failed');
   const user=round%2?f.member:f.owner,replay=await clients[user].browser.request('groups/commands',shared[index][round]);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),sharedReceipts[index][round],'mixed_shared_exact_replay');
  }
  const rows=[];
  for(const user of [f.owner,f.member]){
   const response=await clients[user].browser.request(`groups/${f.id}/content?collection=occurrences&date=${date}`);assert.equal(response.statusCode,200);
   const page=parseSharedPage(response.json());assert.equal(page.revision,f.revision+rounds);assert.equal(page.rows.length,1);
   const row=page.rows[0];assert.ok('completed'in row);assert.equal(row.completed,false);assert.equal(row.byMemberId,null);assert.equal(row.at,null);
   assert.deepEqual(row.snapshot,{title:'Synthetic shared task',notes:'',assignee:null,time:null,timezone:'UTC',taskRevision:f.revision});rows.push(page.rows);
  }
  assert.deepEqual(rows[0],rows[1],'mixed_shared_final_parity');
 }
 const personalSummary=summary(samples.filter(s=>s.kind==='personal')),sharedSummary=summary(samples.filter(s=>s.kind==='shared'));
 const failures=observations.filter(o=>o.observedMs===null||o.observedMs>15000),convergence=observations.map(o=>o.observedMs).filter((n):n is number=>n!==null).sort((a,b)=>a-b);
 const passed=personalSummary.accepted===clients.length*rounds&&sharedSummary.accepted===families.length*rounds&&personalSummary.p95ScheduledMs!==null&&personalSummary.p95ScheduledMs<=1000&&sharedSummary.p95ScheduledMs!==null&&sharedSummary.p95ScheduledMs<=1000&&failures.length===0&&observations.length===families.length*rounds;
 return{phase:'complete',scope:'Fixed-test scheduled mixed load; real API/session/RLS with injected transport and existing SharedContent reader; client-state convergence, not browser paint',rounds,roundMs,pollMs,measuredMs,users:clients.length,families:families.length,samples,polls,observations,
  personal:personalSummary,shared:sharedSummary,convergence:{expected:families.length*rounds,accepted:observations.length,observed:convergence.length,over15SecondsOrMissing:failures.length,p95Ms:convergence[Math.ceil(convergence.length*.95)-1]??null,maxMs:convergence.at(-1)??null},
  exactRecoveryAndSharedReadback:true,finalPersonalRevision:2+rounds,passed};
}
