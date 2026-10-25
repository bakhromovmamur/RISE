import { before,after,test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authHarness } from "../support/auth.ts";
import { PersonalClient } from "../support/personal.ts";
import { hydrate } from "../../src/contracts/personalRecords.ts";
import { intentView } from "../../src/sync/policy.ts";
import { emptyDraft,localDate,addDays } from "../../src/model.ts";
import type { AccountCommand } from "../../src/contracts/accountCommands.ts";
import type { SyncOperation } from "../../src/contracts/sync.ts";
let h:Awaited<ReturnType<typeof authHarness>>;
before(async()=>{h=await authHarness();});after(async()=>{await h?.close();});
const request=(c:PersonalClient,path:string,body:object)=>c.browser.request(`sync/${path}`,{accountId:c.owner,...body});
async function operation(c:PersonalClient,command:AccountCommand):Promise<SyncOperation>{const view=await c.read(),state=hydrate(view.records!),now=Date.now(),context={now,date:localDate(state.timezone,new Date(now)),timezone:state.timezone};return{protocolVersion:1,operationId:randomUUID(),baseRevision:view.revision,command,context,expected:intentView(state,command,context)};}
const push=(c:PersonalClient,...operations:SyncOperation[])=>request(c,"commands",{operations});
async function habit(c:PersonalClient){const id=randomUUID();await c.command({kind:"habit.save",newId:id,draft:{...emptyDraft(),name:"Synthetic race",days:[0,1,2,3,4,5,6]}});return id;}
test("different records merge; conflicting reflections retain stable intent and exact receipt replay",async()=>{
 const c=new PersonalClient(h);await c.initialize();const date=localDate("UTC"),a=await operation(c,{kind:"reflection.save",date,reflection:{manageable:"first",smaller:""}}),b=await operation(c,{kind:"profile.name",name:"Other device"}),conflict={...a,operationId:randomUUID(),command:{kind:"reflection.save" as const,date,reflection:{manageable:"competing",smaller:""}}};
 assert.equal((await push(c,b)).statusCode,200);assert.equal((await push(c,a)).statusCode,200);const rejected=await push(c,conflict);assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,"intent_conflict");
 const replay=await push(c,a);assert.equal(replay.statusCode,200);assert.equal(replay.json().receipts[0].replayed,true);assert.equal(hydrate((await c.read()).records!).reflections[date].manageable,"first");
});
test("identical check states converge, full versus Undo conflicts, and archived habits reject stale work",async()=>{
 const c=new PersonalClient(h);await c.initialize();const id=await habit(c),date=localDate("UTC");
 const full=await operation(c,{kind:"habit.check",habitId:id,date,check:"full"}),same={...full,operationId:randomUUID()},undo={...full,operationId:randomUUID(),command:{...full.command,kind:"habit.correct" as const,habitId:id,date,check:null}};
 assert.equal((await push(c,full)).statusCode,200);assert.equal((await push(c,same)).statusCode,200);assert.equal((await c.read()).xp,20);assert.equal((await push(c,undo)).statusCode,409);
 const stale=await operation(c,{kind:"habit.correct",habitId:id,date,check:"tiny"});await c.command({kind:"habit.archive",habitId:id});const result=await push(c,stale);assert.equal(result.statusCode,409);assert.equal(result.json().error.code,"entity_unavailable");
 const state=hydrate((await c.read()).records!);assert.equal(state.days[date].find(o=>o.habitId===id)?.check,"full");assert.ok(state.habits[0].archivedAt);
 const fresh=await operation(c,{kind:"habit.correct",habitId:id,date,check:null});assert.equal((await push(c,fresh)).statusCode,200);assert.equal((await c.read()).xp,0);assert.ok(hydrate((await c.read()).records!).habits[0].archivedAt);
});
test("prayer correction conflicts and deleted record produces a retained tombstone",async()=>{
 const c=new PersonalClient(h);await c.initialize();const date=localDate("UTC"),day={source:"Synthetic manual",sample:false,timezone:"UTC",entries:Object.fromEntries(["fajr","dhuhr","asr","maghrib","isha"].map((p,i)=>[p,{begins:`${String(1+i*4).padStart(2,"0")}:00`,target:`${String(1+i*4).padStart(2,"0")}:00`,ends:`${String(4+i*4).padStart(2,"0")}:00`}])),};
 // Manual coverage is validated by the existing independent personal boundary.
 await c.command({kind:"prayer.timetable",date,day,preferences:{place:"home",leadMinutes:10,style:"gentle",reminders:false}});
 const a=await operation(c,{kind:"prayer.record",date,prayer:"fajr",check:"later"}),b={...a,operationId:randomUUID(),command:{kind:"prayer.record" as const,date,prayer:"fajr" as const,check:"missed" as const}};
 assert.equal((await push(c,a)).statusCode,200);assert.equal((await push(c,b)).statusCode,409);
 const base=(await c.read()).revision,remove=await operation(c,{kind:"prayer.record",date,prayer:"fajr",check:null});assert.equal((await push(c,remove)).statusCode,200);
 const changes=await request(c,"changes",{since:base,revision:(await c.read()).revision,offset:0});assert.equal(changes.statusCode,200);assert.ok(changes.json().entries.some((r:{table:string;row:unknown})=>r.table==="prayer_records"&&r.row===null));
 assert.equal((await push(c,b)).statusCode,409);
});
test("reward enjoyment races against correction, and removed milestones cannot reappear",async()=>{
 const c=new PersonalClient(h);await c.initialize();const goalId=randomUUID(),milestoneId=randomUUID(),rewardId=randomUUID();
 await c.command({kind:"goal.save",newId:goalId,draft:{title:"Synthetic goal",reason:"",targetDate:"",habitIds:[],milestones:[{id:milestoneId,title:"First"}]}});
 await c.command({kind:"reward.save",newId:rewardId,draft:{name:"Synthetic reward",condition:{kind:"goal",goalId}}});await c.command({kind:"goal.milestone",goalId,milestoneId,completed:true});
 const enjoy=await operation(c,{kind:"reward.enjoy",rewardId}),stale=await operation(c,{kind:"goal.milestone",goalId,milestoneId,completed:true});await c.command({kind:"goal.milestone",goalId,milestoneId,completed:false});assert.equal((await push(c,enjoy)).statusCode,409);
 await c.command({kind:"goal.save",newId:randomUUID(),draft:{id:goalId,title:"Synthetic goal",reason:"",targetDate:"",habitIds:[],milestones:[{id:randomUUID(),title:"Replacement"}]}});
 assert.equal((await push(c,stale)).json().error.code,"entity_unavailable");assert.equal((await request(c,"review",{revision:(await c.read()).revision,operation:stale})).json().canReapply,false);
});
test("90-day pruning advances a floor, denies old IDs, and review distinguishes committed from eligible intent",async()=>{
 const c=new PersonalClient(h);await c.initialize();const date=localDate("UTC"),old=await operation(c,{kind:"reflection.save",date,reflection:{manageable:"retained intent",smaller:""}});const accepted=await push(c,old);assert.equal(accepted.statusCode,200);
 assert.equal((await request(c,"review",{revision:(await c.read()).revision,operation:old})).json().reason,"committed");
 await h.admin.query("update rise.personal_receipts set created_at=now()-interval '91 days' where owner_id=$1",[c.owner]);await h.admin.query("update rise.sync_changes set changed_at=now()-interval '91 days' where owner_id=$1",[c.owner]);
 const base=(await c.read()).revision;assert.equal((await request(c,"changes",{since:0,revision:base,offset:0})).statusCode,409);
 // A successful current-head delta request commits pruning/floor advancement.
 assert.equal((await request(c,"changes",{since:base,revision:base,offset:0})).statusCode,200);
 assert.equal((await h.admin.query("select count(*) from rise.personal_receipts where owner_id=$1",[c.owner])).rows[0].count,"0");
 assert.equal((await push(c,old)).json().error.code,"rebase_required");
 const reviewed=await operation(c,{kind:"reflection.save",date,reflection:{manageable:"new explicit action",smaller:""}});assert.notEqual(reviewed.operationId,old.operationId);assert.equal((await push(c,reviewed)).statusCode,200);
 const staleClock={...await operation(c,{kind:"profile.name",name:"Old"}),operationId:randomUUID()};staleClock.context.now-=91*86400000;staleClock.context.date=localDate("UTC",new Date(staleClock.context.now));assert.equal((await push(c,staleClock)).json().error.code,"rebase_required");
});
test("new sync metadata remains owner/session isolated and current receipts cannot be pruned by the BFF",async()=>{
 const c=new PersonalClient(h),other=new PersonalClient(h);await c.initialize();await other.initialize();const view=await c.read();
 assert.equal((await request(other,"changes",{accountId:c.owner,since:0,revision:view.revision,offset:0})).statusCode,409);
 const session=(await h.admin.query("select provider_session_id from rise_private.server_sessions where user_id=$1 limit 1",[other.owner])).rows[0];const conn=await h.store.pool.connect();
 try{await conn.query("begin");await conn.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:other.owner,session_id:session.provider_session_id})]);for(const table of ["sync_state","sync_changes"])assert.equal((await conn.query(`select * from rise.${table} where owner_id=$1`,[c.owner])).rowCount,0);assert.equal((await conn.query("delete from rise.personal_receipts where owner_id=$1",[other.owner])).rowCount,0);}finally{await conn.query("rollback");conn.release();}
 await c.browser.request("logout",{});assert.equal((await request(c,"review",{revision:view.revision,operation:await operation(other,{kind:"profile.name",name:"Synthetic"})})).statusCode,401);
});
test("check and prayer removal barriers reject ABA resurrection while a direct queued successor remains valid",async()=>{
 const c=new PersonalClient(h);await c.initialize();const id=await habit(c),date=localDate("UTC"),original=await operation(c,{kind:"habit.check",habitId:id,date,check:"full"});
 original.expected=`sha256:${await (await import("../../src/data/migration.ts")).digest(original.expected!)}`;
 const first=await push(c,original);assert.equal(first.statusCode,200);const undo=await operation(c,{kind:"habit.correct",habitId:id,date,check:null});assert.equal((await push(c,undo)).statusCode,200);
 const stale={...original,operationId:randomUUID()};assert.equal((await push(c,stale)).json().error.code,"intent_conflict");assert.equal((await c.read()).xp,0);
 const successor={...stale,operationId:randomUUID(),predecessor:undo.operationId};assert.equal((await push(c,successor)).statusCode,200);assert.equal((await c.read()).xp,20);
});
test("receipt failure rolls back canonical rows and compact changes together",async()=>{
 const c=new PersonalClient(h);await c.initialize();const op=await operation(c,{kind:"profile.name",name:"Must roll back"}),before=await c.read(),changes=(await h.admin.query("select table_name,record_key,revision,deleted,barrier_revision from rise.sync_changes where owner_id=$1 order by table_name,record_key",[c.owner])).rows;
 await h.admin.query("create function rise_private.recovery_test_failure() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'synthetic_failure'; end $$");
 try{await h.admin.query(`create trigger recovery_test_failure before insert on rise.personal_receipts for each row when (new.operation_id='${op.operationId}'::uuid) execute function rise_private.recovery_test_failure()`);assert.equal((await push(c,op)).statusCode,503);assert.deepEqual(await c.read(),before);assert.deepEqual((await h.admin.query("select table_name,record_key,revision,deleted,barrier_revision from rise.sync_changes where owner_id=$1 order by table_name,record_key",[c.owner])).rows,changes);}
 finally{await h.admin.query("drop trigger if exists recovery_test_failure on rise.personal_receipts");await h.admin.query("drop function rise_private.recovery_test_failure()");}
 assert.equal((await push(c,op)).statusCode,200);
});
test("a reward correction and re-earning cannot hide an intervening destructive change",async()=>{
 const c=new PersonalClient(h);await c.initialize();const goalId=randomUUID(),milestoneId=randomUUID(),rewardId=randomUUID();await c.command({kind:"goal.save",newId:goalId,draft:{title:"Synthetic reward race",reason:"",targetDate:"",habitIds:[],milestones:[{id:milestoneId,title:"Finish"}]}});await c.command({kind:"reward.save",newId:rewardId,draft:{name:"Synthetic earned reward",condition:{kind:"goal",goalId}}});await c.command({kind:"goal.milestone",goalId,milestoneId,completed:true});const old=await operation(c,{kind:"reward.enjoy",rewardId});await c.command({kind:"goal.milestone",goalId,milestoneId,completed:false});await c.command({kind:"goal.milestone",goalId,milestoneId,completed:true});assert.equal((await push(c,old)).statusCode,409);assert.equal(hydrate((await c.read()).records!).personalRewards[0].enjoyedOn,undefined);
});

test("a fresh next-week retry preserves the archived original attempt",async()=>{
 const c=new PersonalClient(h);await c.initialize();const rewardId=randomUUID(),newId=randomUUID(),week=addDays(localDate("UTC"),-14);await c.command({kind:"reward.save",newId:rewardId,draft:{name:"Synthetic archived attempt",condition:{kind:"weekly",week,target:999}}});await c.command({kind:"reward.archive",rewardId,archived:true});const retry=await operation(c,{kind:"reward.retry",rewardId,newId});assert.equal((await push(c,retry)).statusCode,200);const state=hydrate((await c.read()).records!);assert.ok(state.personalRewards.find(r=>r.id===rewardId)?.archivedOn);assert.equal(state.personalRewards.find(r=>r.id===newId)?.previousAttemptId,rewardId);
});
