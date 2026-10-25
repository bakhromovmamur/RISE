import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {authHarness} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {hash} from '../../server/auth/crypto.ts';
import {canonical,hydrate,personalTables} from '../../src/contracts/personalRecords.ts';
import {intentView} from '../../src/sync/policy.ts';
import {parseAccountExport} from '../../src/account/export.ts';
import {addDays,localDate} from '../../src/model.ts';
import type {SharedPriority} from '../../src/domain/priorityReferences.ts';
import type {AccountCommand} from '../../src/contracts/accountCommands.ts';
import type {SyncOperation} from '../../src/contracts/sync.ts';
import type {AccountGroup,GroupCommand,GroupReceipt} from '../../src/contracts/groups.ts';
import {prepareGuestImport,importPages} from '../../src/sync/importModel.ts';
import {digest} from '../../src/data/migration.ts';
import {syncGuest} from '../support/syncData.ts';
import {accountPurger,lifecycleDatabase} from '../../server/lifecycle/worker.ts';

let h:Awaited<ReturnType<typeof authHarness>>;const subjects:string[]=[],groups:string[]=[],date=localDate('UTC'),taskDate=addDays(date,1);
before(async()=>{h=await authHarness();});
after(async()=>{if(h)try{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await h.close();}});
async function actor(){const c=new PersonalClient(h);await c.initialize();subjects.push(c.owner);return c;}
async function head(c:PersonalClient,id:string){const r=await c.browser.request('groups');assert.equal(r.statusCode,200);const g=r.json<{groups:AccountGroup[]}>().groups.find(x=>x.id===id);assert.ok(g);return g;}
async function groupCommand(c:PersonalClient,command:GroupCommand){
 const expectedRevision=command.kind==='group.create'||command.kind==='group.accept'?0:(await head(c,command.groupId)).revision;
 const r=await c.browser.request('groups/commands',{accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command});assert.equal(r.statusCode,200,`group_status:${r.json().error?.code??'ok'}`);return r.json<GroupReceipt>();
}
async function family(c:PersonalClient){const groupId=randomUUID();groups.push(groupId);await groupCommand(c,{kind:'group.create',groupId,groupKind:'family',name:'Synthetic priority family',timezone:'Pacific/Kiritimati',nickname:'Owner'});return groupId;}
async function join(a:PersonalClient,b:PersonalClient,groupId:string){const invitation=await groupCommand(a,{kind:'group.invite',groupId});await groupCommand(b,{kind:'group.accept',token:new URL(invitation.invitation!.link).hash.slice(8),nickname:'Member'});return (await head(b,groupId)).members.find(m=>m.self)!.id;}
async function task(c:PersonalClient,groupId:string):Promise<SharedPriority>{const taskId=randomUUID();await groupCommand(c,{kind:'task.create',groupId,taskId,title:'Private shared title',notes:'Shared notes never enter a private priority',assignee:null,date:taskDate,time:'09:30',weekdays:[]});return{kind:'task',groupId,taskId,date:taskDate};}
const pin=(priority:SharedPriority,selected=true):AccountCommand=>({kind:'priority.pin',date,priority,selected});
async function operation(c:PersonalClient,command:AccountCommand):Promise<SyncOperation>{const view=await c.read(),state=hydrate(view.records!),context={now:Date.now(),date,timezone:'UTC'};return{protocolVersion:1,operationId:randomUUID(),baseRevision:view.revision,command,context,expected:intentView(state,command,context)};}
const request=(c:PersonalClient,path:string,body:object)=>c.browser.request(`sync/${path}`,{accountId:c.owner,...body});
const push=(c:PersonalClient,...operations:SyncOperation[])=>request(c,'commands',{operations});
async function unavailable(c:PersonalClient,priority:SharedPriority){const before=await c.read(),op=await operation(c,pin(priority)),r=await push(c,op);assert.equal(r.statusCode,409);assert.equal(r.json().error.code,'entity_unavailable');assert.deepEqual(await c.read(),before);return op;}

test('shared selection stores only an owner-scoped opaque occurrence and real pull/export preserve its separate civil date',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),ref=await task(a,groupId);await join(a,b,groupId);
 const op=await operation(b,pin(ref)),accepted=await push(b,op);assert.equal(accepted.statusCode,200);
 const view=await b.read(),state=hydrate(view.records!);assert.deepEqual(state.dailyPriorities[date],[ref]);assert.equal(view.xp,0);assert.equal((await a.read()).records!.daily_priorities.length,0);
 assert.equal((await h.admin.query('select count(*) from rise.task_occurrences where group_id=$1',[groupId])).rows[0].count,'0');
 assert.doesNotMatch(JSON.stringify(view),/Private shared title|Shared notes never/);
 const row=view.records!.daily_priorities[0];assert.deepEqual(row,{date,slot:0,kind:'task',habit_id:null,goal_id:null,milestone_id:null,group_id:groupId,task_id:ref.taskId,task_date:taskDate});
 const pulled=await request(b,'pull',{revision:view.revision,cursor:{table:personalTables.findIndex(t=>t.name==='daily_priorities'),offset:0}});assert.equal(pulled.statusCode,200);assert.deepEqual(pulled.json().rows,[row]);
 const exported=await b.browser.request('account/export',{accountId:b.owner});assert.equal(exported.statusCode,200);const file=await parseAccountExport(exported.body);assert.deepEqual(file.backup.data.personal.dailyPriorities[date],[ref]);assert.deepEqual(file.shared,{available:false,items:[]});
 const replay=await push(b,op);assert.equal(replay.statusCode,200);assert.equal(replay.json().receipts[0].replayed,true);assert.equal((await b.read()).revision,view.revision);
});

test('new selections require current family membership, active group/task and the exact scheduled date',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),other=await family(a),ref=await task(a,groupId);
 await unavailable(b,ref);await unavailable(a,{...ref,groupId:other});await unavailable(a,{...ref,date:addDays(taskDate,1)});
 await groupCommand(a,{kind:'task.archive',groupId,taskId:ref.taskId});await unavailable(a,ref);
 await groupCommand(a,{kind:'task.restore',groupId,taskId:ref.taskId});await groupCommand(a,{kind:'group.archive',groupId});await unavailable(a,ref);
 await groupCommand(a,{kind:'group.restore',groupId});await a.command(pin(ref));assert.deepEqual(hydrate((await a.read()).records!).dailyPriorities[date],[ref]);
 const malformed=await a.browser.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:a.revision,command:{...pin(ref),ownerId:b.owner}});assert.equal(malformed.statusCode,422);
});

test('loss of membership retains selections for reorder/removal but blocks pending new references and recovery override',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),memberId=await join(a,b,groupId),one=await task(a,groupId),two=await task(a,groupId),three=await task(a,groupId);
 await b.command({kind:'priorities.set',date,priorities:[one,two]});const pending=await operation(b,pin(three)),original=structuredClone(pending),accepted=await operation(b,{kind:'priorities.set',date,priorities:[two,one]});
 assert.equal((await push(b,accepted)).statusCode,200);await groupCommand(a,{kind:'group.remove',groupId,memberId});
 assert.deepEqual(hydrate((await b.read()).records!).dailyPriorities[date],[two,one]);
 const reviewed=await request(b,'review',{revision:b.revision,operation:pending});assert.equal(reviewed.statusCode,200);assert.equal(reviewed.json().canReapply,false);assert.equal(reviewed.json().reason,'unavailable');assert.deepEqual(pending,original);
 // A committed personal receipt acknowledges private work; it reveals no shared record.
 const replay=await push(b,accepted);assert.equal(replay.statusCode,200);assert.equal(replay.json().receipts[0].replayed,true);assert.doesNotMatch(replay.body,/Private shared title|Shared notes/);
 assert.equal((await b.browser.request(`groups/${groupId}/content?collection=tasks`)).statusCode,404);
 await b.command({kind:'priorities.set',date,priorities:[one,two]});await b.command(pin(one,false));await unavailable(b,one);
 await groupCommand(a,{kind:'group.delete',groupId});assert.deepEqual(hydrate((await b.read()).records!).dailyPriorities[date],[two]);await b.command(pin(two,false));assert.deepEqual(hydrate((await b.read()).records!).dailyPriorities[date],[]);
});

test('pending selection checks membership after removal without renumbering or accepting a partial batch',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),memberId=await join(a,b,groupId),ref=await task(a,groupId),op=await operation(b,pin(ref)),before=await b.read();
 await groupCommand(a,{kind:'group.remove',groupId,memberId});const rejected=await push(b,op);assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,'entity_unavailable');assert.deepEqual(await b.read(),before);
 const first=await operation(b,{kind:'profile.name',name:'Must roll back'}),second={...op,baseRevision:first.baseRevision+1,expected:undefined};
 assert.equal((await push(b,first,second)).statusCode,409);assert.deepEqual(await b.read(),before);
 assert.equal((await h.admin.query('select count(*) from rise.personal_receipts where owner_id=$1 and operation_id=any($2::uuid[])',[b.owner,[first.operationId,op.operationId]])).rows[0].count,'0');
});

test('selection racing membership removal has one authorized order and preserves private selections after the removal',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),memberId=await join(a,b,groupId),ref=await task(a,groupId),op=await operation(b,pin(ref)),revision=(await head(a,groupId)).revision;
 const [selected,removed]=await Promise.all([push(b,op),a.browser.request('groups/commands',{accountId:a.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:revision,command:{kind:'group.remove',groupId,memberId}})]);
 assert.equal(removed.statusCode,200);assert.ok([200,409].includes(selected.statusCode));const view=await b.read();assert.deepEqual(hydrate(view.records!).dailyPriorities[date]??[],selected.statusCode===200?[ref]:[]);assert.equal(view.xp,0);
 if(selected.statusCode===409)assert.equal(selected.json().error.code,'entity_unavailable');
 assert.equal((await b.browser.request(`groups/${groupId}/content?collection=tasks`)).statusCode,404);
});

test('private priority constraints, forced RLS and guard grants keep shared members out of each other’s selected priorities',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),ref=await task(a,groupId);await join(a,b,groupId);await a.command(pin(ref));
 const session=(await h.admin.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(b.browser.cookies.get('rise_test_session')!)])).rows[0],c=await h.store.pool.connect();
 try{await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:session.user_id,session_id:session.provider_session_id})]);assert.equal((await c.query('select * from rise.daily_priorities where owner_id=$1',[a.owner])).rowCount,0);assert.equal((await c.query('delete from rise.daily_priorities where owner_id=$1',[a.owner])).rowCount,0);}finally{await c.query('rollback');c.release();}
 const grants=(await h.admin.query("select has_function_privilege('authenticated','rise_private.authorize_shared_priorities(jsonb)','execute') as direct,has_function_privilege('anon','rise_private.lock_shared_priority_groups(uuid[])','execute') as anonymous,has_table_privilege('rise_group_guard','rise.daily_priorities','select') as private")).rows[0];assert.deepEqual(grants,{direct:false,anonymous:false,private:false});
 for(const change of ["group_id=null","habit_id=gen_random_uuid()","task_date='0001-01-01 BC'::date"]){await assert.rejects(h.admin.query(`update rise.daily_priorities set ${change} where owner_id=$1`,[a.owner]),(e:{code?:string})=>e.code==='23514');}
 const flags=(await h.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='rise.daily_priorities'::regclass")).rows[0];assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
});

test('receipt failure rolls back priority, revision and change rows; conflicts require an explicit current-head review',async()=>{
 const a=await actor(),groupId=await family(a),one=await task(a,groupId),two=await task(a,groupId),op=await operation(a,pin(one)),before=await a.read();
 await h.admin.query(`create function rise_private.synthetic_priority_failure() returns trigger language plpgsql set search_path='' as $$begin if new.operation_id='${op.operationId}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_priority_failure before insert on rise.personal_receipts for each row execute function rise_private.synthetic_priority_failure()`);
 try{assert.equal((await push(a,op)).statusCode,503);assert.deepEqual(await a.read(),before);}finally{await h.admin.query('drop trigger synthetic_priority_failure on rise.personal_receipts;drop function rise_private.synthetic_priority_failure()');}
 const competing=await operation(a,pin(two));assert.equal((await push(a,op)).statusCode,200);const rejected=await push(a,competing);assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,'intent_conflict');
 const view=await a.read(),review=await request(a,'review',{revision:view.revision,operation:competing});assert.equal(review.json().canReapply,true);
 await groupCommand(a,{kind:'task.archive',groupId,taskId:two.taskId});assert.equal((await request(a,'review',{revision:view.revision,operation:competing})).json().canReapply,false);
 assert.equal((await push(a,op)).json().receipts[0].replayed,true);assert.deepEqual(hydrate((await a.read()).records!).dailyPriorities[date],[one]);
});

test('legacy staged import rows retain their original hash and append without replacing selected shared references',async()=>{
 const a=await actor(),groupId=await family(a),ref=await task(a,groupId);await a.command(pin(ref));
 const source=syncGuest();source.dailyPriorities[date]=[{kind:'habit',habitId:'authored-reading'}];
 const proposal=await prepareGuestImport(source,a.owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true});
 for(const row of proposal.records.daily_priorities){delete row.group_id;delete row.task_id;delete row.task_date;}
 const entries=personalTables.flatMap(t=>proposal.records[t.name].map(row=>({table:t.name,row}))),pages=importPages(entries),sourceHash=await digest(canonical(proposal.records)),original=structuredClone(entries),importId=randomUUID(),baseRevision=a.revision;
 assert.equal((await request(a,'imports',{importId,baseRevision,sourceHash,provenance:'unverified-legacy',pages:pages.length,consent:true})).statusCode,200);
 for(const[page,entries]of pages.entries())assert.equal((await request(a,'imports/page',{importId,page,entries})).statusCode,200);
 assert.equal((await request(a,'imports/preview',{importId})).statusCode,200);assert.deepEqual(entries,original);
 const staged=(await h.admin.query('select source_hash from rise.sync_imports where owner_id=$1 and id=$2',[a.owner,importId])).rows[0];assert.equal(staged.source_hash,sourceHash);
 const commit={importId,baseRevision,sourceHash,keepExisting:true};assert.equal((await request(a,'imports/commit',commit)).statusCode,200);assert.equal((await request(a,'imports/commit',commit)).json().replayed,true);
 const view=await a.read();assert.equal(view.xp,20);assert.deepEqual(hydrate(view.records!).dailyPriorities[date],[ref]);assert.equal(view.records!.habits.length,1);assert.deepEqual(entries,original);
});

test('account deletion purges the owner’s opaque selections while preserving other members’ shared tasks and private selections',async()=>{
 const a=await actor(),b=await actor(),groupId=await family(a),ref=await task(a,groupId);await join(a,b,groupId);await a.command(pin(ref));await b.command(pin(ref));
 assert.equal((await b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})).statusCode,200);
 assert.equal((await b.browser.request('personal')).statusCode,401);
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{await worker.verify();await worker.pool.query('select rise_private.purge_group_identity($1)',[b.owner]);await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(b.owner);}finally{await worker.close();}
 assert.equal((await h.admin.query('select count(*) from rise.daily_priorities where owner_id=$1',[b.owner])).rows[0].count,'0');
 assert.equal((await h.admin.query('select count(*) from rise_private.deletion_ledger where user_id=$1',[b.owner])).rows[0].count,'1');
 assert.deepEqual(hydrate((await a.read()).records!).dailyPriorities[date],[ref]);assert.equal((await h.admin.query('select count(*) from rise.family_tasks where id=$1',[ref.taskId])).rows[0].count,'1');
});
