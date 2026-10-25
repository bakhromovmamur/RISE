import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {hash} from '../../server/auth/crypto.ts';
import {lifecycleDatabase,accountPurger} from '../../server/lifecycle/worker.ts';
import {parseSharedPage,type SharedTask,type SharedItem,type SharedOccurrence,type SharedQuery} from '../../src/contracts/sharedContent.ts';
import type {AccountGroup,GroupCommand,GroupOperation,GroupReceipt} from '../../src/contracts/groups.ts';

let h:Awaited<ReturnType<typeof authHarness>>;const subjects:string[]=[],groups:string[]=[];
before(async()=>{h=await authHarness();});
after(async()=>{if(h)try{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await h.close();}});
async function actor(){const c=new PersonalClient(h);await c.initialize();subjects.push(c.owner);return c;}
async function head(c:PersonalClient,id:string){const r=await c.browser.request('groups');assert.equal(r.statusCode,200);const g=r.json<{groups:AccountGroup[]}>().groups.find(x=>x.id===id);assert.ok(g);return g;}
const operation=(c:PersonalClient,command:GroupCommand,expectedRevision:number):GroupOperation=>({accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command});
async function send(c:PersonalClient,op:GroupOperation,status=200){const r=await c.browser.request('groups/commands',op);assert.equal(r.statusCode,status,`shared_status:${r.json().error?.code??'ok'}`);return r;}
async function command(c:PersonalClient,input:GroupCommand){return (await send(c,operation(c,input,input.kind==='group.create'||input.kind==='group.accept'?0:(await head(c,input.groupId)).revision))).json<GroupReceipt>();}
async function family(c:PersonalClient,kind:'family'|'squad'='family'){const id=randomUUID();groups.push(id);await command(c,{kind:'group.create',groupId:id,groupKind:kind,name:'Synthetic family',timezone:'Pacific/Kiritimati',nickname:'Owner'});return id;}
async function join(a:PersonalClient,b:PersonalClient,id:string){const invite=await command(a,{kind:'group.invite',groupId:id});await command(b,{kind:'group.accept',token:new URL(invite.invitation!.link).hash.slice(8),nickname:'Member'});}
function url(q:SharedQuery){const {groupId,...query}=q;return `groups/${groupId}/content?${new URLSearchParams(Object.entries(query).map<[string,string]>(([k,v])=>[k,String(v)]))}`;}
async function page(c:PersonalClient,q:SharedQuery){const r=await c.browser.request(url(q));assert.equal(r.statusCode,200,`shared_read:${r.json().error?.code??'ok'}`);assert.equal(r.headers['cache-control'],'no-store');return parseSharedPage(r.json());}
const taskFields={title:'Family shopping',notes:'Bring the reusable bag',assignee:null,date:'2026-10-23',time:'10:30',weekdays:[5]};
async function task(c:PersonalClient,groupId:string,changes:Omit<Partial<typeof taskFields>,'assignee'>&{assignee?:string|null}={}){const taskId=randomUUID();await command(c,{kind:'task.create',groupId,taskId,...taskFields,...changes});return taskId;}
async function list(c:PersonalClient,groupId:string){const listId=randomUUID();await command(c,{kind:'list.create',groupId,listId,name:'Groceries'});return listId;}
async function item(c:PersonalClient,groupId:string,listId:string,text='Milk'){const itemId=randomUUID();await command(c,{kind:'item.add',groupId,listId,itemId,text,quantity:'2'});return itemId;}
async function claims(c:PersonalClient){const r=(await h.admin.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(c.browser.cookies.get('rise_test_session')!)])).rows[0];return {sub:r.user_id,session_id:r.provider_session_id,user_metadata:{role:'owner'}};}
async function sqlAs(c:PersonalClient,role:'rise_bff'|'authenticated'|'anon',run:(sql:pg.PoolClient)=>Promise<void>){const sql=await(role==='rise_bff'?h.store.pool:h.admin).connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(await claims(c))]);if(role!=='rise_bff')await sql.query(`set local role ${role}`);await run(sql);}finally{await sql.query('rollback');sql.release();}}
const denied=(code:string)=>(error:unknown)=>!!error&&typeof error==='object'&&'code' in error&&error.code===code;

test('shared content is opt-in family data with verified identity, exact fields, same-group assignment and no private import',async()=>{
 const a=await actor(),b=await actor(),id=await family(a),other=await family(b),squad=await family(a,'squad');
 const stranger=new AuthBrowser(h);await stranger.read();assert.equal((await stranger.request(url({groupId:id,collection:'tasks'}))).statusCode,401);
 const op=operation(a,{kind:'task.create',groupId:id,taskId:randomUUID(),...taskFields},(await head(a,id)).revision);
 for(const headers of [{'x-rise-csrf':''},{origin:'https://foreign.invalid'}] as Record<string,string>[])assert.equal((await a.browser.request('groups/commands',op,headers)).statusCode,403);
 for(const fields of [{byMemberId:b.owner},{ownerId:a.owner},{role:'owner'},{weekdays:[5,5]},{date:'2026-02-30'}])assert.equal((await a.browser.request('groups/commands',{...op,command:{...op.command,...fields}})).statusCode,422);
 assert.equal((await send(a,{...op,accountId:b.owner},403)).json().error.code,'account_mismatch');
 await send(a,{...op,command:{kind:'task.create',groupId:squad,taskId:randomUUID(),...taskFields},expectedRevision:(await head(a,squad)).revision},404);
 await send(a,{...op,command:{kind:'task.create',groupId:id,taskId:randomUUID(),...taskFields,assignee:(await head(b,other)).members[0].id}},404);
 const accepted=await send(a,op);assert.deepEqual((await send(a,op)).json(),accepted.json());
 const read=await page(a,{groupId:id,collection:'tasks'});assert.equal(read.rows.length,1);assert.doesNotMatch(JSON.stringify(read),/example\.invalid|user_id|owner_id|prayers|token|csrf/);
 assert.equal((await b.browser.request(url({groupId:id,collection:'tasks'}))).statusCode,404);
 assert.equal((await a.browser.request(`groups/${id}/content?collection=tasks&ownerId=${a.owner}`)).statusCode,422);
 const personal=await a.read();assert.equal(personal.xp,0);assert.equal(personal.revision,1);
});

test('recurring dates keep actor, database time and snapshots; edits, duplicate completion and Undo affect only the selected date',async()=>{
 const a=await actor(),b=await actor(),id=await family(a);await join(a,b,id);const member=(await head(b,id)).members.find(x=>x.self)!.id;
 const taskId=await task(a,id,{assignee:member});
 await command(b,{kind:'task.complete',groupId:id,taskId,date:'2026-10-23',completed:true});
 await command(a,{kind:'task.complete',groupId:id,taskId,date:'2026-10-30',completed:true});
 const first=(await page(a,{groupId:id,collection:'occurrences',parentId:taskId})).rows as SharedOccurrence[];
 assert.equal(first.length,2);assert.equal(first[0].byMemberId,member);assert.equal(first[0].snapshot.timezone,'Pacific/Kiritimati');assert.equal(first[0].snapshot.assignee,member);
 assert.ok(Math.abs(Date.parse(first[0].at!)-Date.now())<30000);
 await command(a,{kind:'task.complete',groupId:id,taskId,date:'2026-10-23',completed:true});
 assert.deepEqual((await page(b,{groupId:id,collection:'occurrences',parentId:taskId})).rows,first);
 await command(b,{kind:'task.edit',groupId:id,taskId,...taskFields,title:'Changed plan',date:'2026-11-01',weekdays:[0],assignee:null});
 assert.deepEqual((await page(b,{groupId:id,collection:'occurrences',parentId:taskId})).rows,first);
 await command(a,{kind:'task.archive',groupId:id,taskId});
 await command(b,{kind:'task.complete',groupId:id,taskId,date:'2026-10-23',completed:false});
 const after=(await page(a,{groupId:id,collection:'occurrences',parentId:taskId})).rows as SharedOccurrence[];
 assert.equal(after[0].completed,false);assert.equal(after[0].byMemberId,null);assert.equal(after[0].at,null);assert.deepEqual(after[0].snapshot,first[0].snapshot);assert.deepEqual(after[1],first[1]);
 assert.equal((await send(b,operation(b,{kind:'task.complete',groupId:id,taskId,date:'2026-11-01',completed:true},(await head(b,id)).revision),409)).json().error.code,'shared_archived');
 await command(b,{kind:'task.restore',groupId:id,taskId});
 assert.equal((await send(b,operation(b,{kind:'task.complete',groupId:id,taskId,date:'2026-10-23',completed:true},(await head(b,id)).revision),409)).json().error.code,'occurrence_unavailable');
 assert.equal((await a.read()).xp,0);assert.equal((await b.read()).xp,0);assert.equal((await a.read()).revision,1);
});

test('two members converge on list edits, checks and ordering; archive retains items and removal never recycles an ID',async()=>{
 const a=await actor(),b=await actor(),id=await family(a);await join(a,b,id);const listId=await list(a,id),one=await item(a,id,listId),two=await item(b,id,listId,'Bread'),three=await item(a,id,listId,'Tea');
 await command(b,{kind:'list.rename',groupId:id,listId,name:'Weekend groceries'});await command(b,{kind:'item.edit',groupId:id,listId,itemId:one,text:'Oat milk',quantity:'3 cartons'});
 await command(a,{kind:'item.check',groupId:id,listId,itemId:two,checked:true});await command(b,{kind:'item.move',groupId:id,listId,itemId:three,beforeId:one});
 let rows=(await page(a,{groupId:id,collection:'items',parentId:listId})).rows as SharedItem[];
 assert.deepEqual(rows.map(x=>x.id),[three,one,two]);assert.deepEqual(rows.map(x=>x.position),[1,2,3]);assert.equal(rows[1].quantity,'3 cartons');assert.equal(rows[2].checked,true);
 assert.deepEqual((await page(b,{groupId:id,collection:'items',parentId:listId})).rows,rows);
 await command(b,{kind:'list.archive',groupId:id,listId});assert.deepEqual((await page(a,{groupId:id,collection:'items',parentId:listId})).rows,rows);
 assert.equal((await send(a,operation(a,{kind:'item.check',groupId:id,listId,itemId:one,checked:true},(await head(a,id)).revision),409)).json().error.code,'shared_archived');
 await command(a,{kind:'list.restore',groupId:id,listId});await command(b,{kind:'item.remove',groupId:id,listId,itemId:one});
 rows=(await page(a,{groupId:id,collection:'items',parentId:listId})).rows as SharedItem[];assert.deepEqual(rows.map(x=>x.id),[three,two]);assert.deepEqual(rows.map(x=>x.position),[1,2]);
 await send(a,operation(a,{kind:'item.edit',groupId:id,listId,itemId:one,text:'Old offline edit',quantity:''},(await head(a,id)).revision),404);
 await send(a,operation(a,{kind:'item.add',groupId:id,listId,itemId:one,text:'Recycled',quantity:''},(await head(a,id)).revision),409);
 const tombstone=(await h.admin.query('select removed,text,quantity,position from rise.shared_items where id=$1',[one])).rows[0];assert.deepEqual(tombstone,{removed:true,text:'',quantity:'',position:null});
 await command(a,{kind:'item.move',groupId:id,listId,itemId:three,beforeId:null});assert.deepEqual(((await page(a,{groupId:id,collection:'items',parentId:listId})).rows as SharedItem[]).map(x=>x.id),[two,three]);
});

test('competing edits and reorders return a recoverable conflict and exact replay never overwrites later work',async()=>{
 const a=await actor(),b=await actor(),id=await family(a);await join(a,b,id);const taskId=await task(a,id),revision=(await head(a,id)).revision;
 const first=operation(a,{kind:'task.edit',groupId:id,taskId,...taskFields,title:'First edit'},revision),second=operation(b,{kind:'task.edit',groupId:id,taskId,...taskFields,title:'Second edit'},revision);
 const results=await Promise.all([a.browser.request('groups/commands',first),b.browser.request('groups/commands',second)]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
 const winner=results[0].statusCode===200?a:b,winningOp=results[0].statusCode===200?first:second,loser=winner===a?b:a,losingOp=winner===a?second:first;
 await send(loser,losingOp,409);const later=await command(loser,{kind:'task.edit',groupId:id,taskId,...taskFields,title:'Explicitly reviewed edit'});
 assert.deepEqual((await send(winner,winningOp)).json(),results[winner===a?0:1].json());assert.equal((await head(a,id)).revision,later.revision);
 assert.equal(((await page(a,{groupId:id,collection:'tasks'})).rows[0] as SharedTask).title,'Explicitly reviewed edit');
 const listId=await list(a,id),one=await item(a,id,listId,'One'),two=await item(a,id,listId,'Two'),three=await item(a,id,listId,'Three'),rev=(await head(a,id)).revision;
 const moves=await Promise.all([a.browser.request('groups/commands',operation(a,{kind:'item.move',groupId:id,listId,itemId:three,beforeId:one},rev)),b.browser.request('groups/commands',operation(b,{kind:'item.move',groupId:id,listId,itemId:two,beforeId:one},rev))]);assert.deepEqual(moves.map(r=>r.statusCode).sort(),[200,409]);
 assert.deepEqual(((await page(a,{groupId:id,collection:'items',parentId:listId})).rows as SharedItem[]).map(x=>x.position),[1,2,3]);
});

test('pending changes and accepted receipts recheck membership; removal racing a write commits in one authorized order',async()=>{
 const a=await actor(),b=await actor(),id=await family(a);await join(a,b,id);const taskId=await task(a,id),rev=(await head(a,id)).revision;
 const op=operation(b,{kind:'task.complete',groupId:id,taskId,date:taskFields.date,completed:true},rev),member=(await head(b,id)).members.find(x=>x.self)!.id;
 const results=await Promise.all([b.browser.request('groups/commands',op),a.browser.request('groups/commands',operation(a,{kind:'group.remove',groupId:id,memberId:member},rev))]);
 if(results[0].statusCode===200){assert.equal(results[1].statusCode,409);await command(a,{kind:'group.remove',groupId:id,memberId:member});}else{assert.equal(results[0].statusCode,404);assert.equal(results[1].statusCode,200);}
 await send(b,op,404);assert.equal((await b.browser.request('groups/receipt',{accountId:b.owner,operationId:op.operationId})).statusCode,results[0].statusCode===200?404:200);
 assert.equal((await b.browser.request(url({groupId:id,collection:'tasks'}))).statusCode,404);
 assert.equal((await b.browser.request(url({groupId:id,collection:'occurrences',parentId:taskId}))).statusCode,404);
});

test('forced RLS, narrow column ownership and composite references deny direct writes and cross-group IDs',async()=>{
 const a=await actor(),b=await actor(),id=await family(a),other=await family(b),taskId=await task(a,id),listId=await list(a,id),itemId=await item(a,id,listId);
 await command(a,{kind:'task.complete',groupId:id,taskId,date:taskFields.date,completed:true});
 const tables=['family_tasks','task_occurrences','shared_lists','shared_items'];
 for(const role of ['rise_bff','authenticated'] as const){
  await sqlAs(a,role,async sql=>{for(const table of tables)assert.equal((await sql.query(`select group_id from rise.${table} where group_id=$1`,[id])).rowCount,1);});
  await sqlAs(b,role,async sql=>{for(const table of tables)assert.equal((await sql.query(`select group_id from rise.${table} where group_id=$1`,[id])).rowCount,0);});
  for(const table of tables)await sqlAs(a,role,async sql=>{await assert.rejects(sql.query(`delete from rise.${table} where group_id=$1`,[id]),denied('42501'));});
 }
 await sqlAs(a,'anon',async sql=>{await assert.rejects(sql.query('select * from rise.family_tasks'),denied('42501'));});
 await sqlAs(a,'rise_bff',async sql=>{await assert.rejects(sql.query('set local role rise_group_guard'),denied('42501'));});
 const flags=(await h.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where relnamespace='rise'::regnamespace and relname=any($1::text[])",[tables])).rows;assert.equal(flags.length,4);assert.ok(flags.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 const otherList=await list(b,other);
 await send(b,operation(b,{kind:'task.archive',groupId:other,taskId},(await head(b,other)).revision),404);
 await send(a,operation(a,{kind:'item.edit',groupId:id,listId:otherList,itemId,text:'Cross list',quantity:''},(await head(a,id)).revision),404);
 await send(b,operation(b,{kind:'item.check',groupId:other,listId:otherList,itemId,checked:true},(await head(b,other)).revision),404);
 await assert.rejects(h.admin.query('update rise.family_tasks set assigned_member_id=$1 where id=$2',[(await head(b,other)).members[0].id,taskId]),denied('23503'));
 const allowed=(await h.admin.query("select has_function_privilege('authenticated','rise_private.change_shared_content(uuid,integer,jsonb)','execute') as direct,has_table_privilege('rise_worker','rise.family_tasks','select') as worker,has_table_privilege('rise_group_guard','rise.profiles','select') as private")).rows[0];assert.deepEqual(allowed,{direct:false,worker:false,private:false});
});

test('pagination is bounded and revision-fenced; quotas include archived content and removal barriers',async()=>{
 const a=await actor(),id=await family(a);for(let i=0;i<53;i++)await task(a,id,{title:`Task ${i}`});
 const first=await page(a,{groupId:id,collection:'tasks'});assert.equal(first.rows.length,50);assert.ok(first.next);
 const second=await page(a,{groupId:id,collection:'tasks',cursor:first.next,revision:first.revision});assert.equal(second.rows.length,3);assert.equal(second.next,null);assert.equal(new Set([...first.rows,...second.rows].map(x=>'id' in x?x.id:'')).size,53);
 for(const row of [...first.rows,...second.rows] as SharedTask[])await command(a,{kind:'task.complete',groupId:id,taskId:row.id,date:taskFields.date,completed:true});
 const reports=await page(a,{groupId:id,collection:'occurrences',date:taskFields.date});assert.equal(reports.rows.length,50);assert.ok(reports.next);
 const later=await page(a,{groupId:id,collection:'occurrences',date:taskFields.date,cursor:reports.next,revision:reports.revision});assert.equal(later.rows.length,3);assert.equal(later.next,null);
 const pagedList=await list(a,id);for(let i=0;i<53;i++)await item(a,id,pagedList,`Item ${i}`);
 const items=await page(a,{groupId:id,collection:'items',parentId:pagedList});assert.equal(items.rows.length,50);assert.ok(items.next);
 const remaining=await page(a,{groupId:id,collection:'items',parentId:pagedList,cursor:items.next,revision:items.revision});assert.equal(remaining.rows.length,3);assert.equal(remaining.next,null);
 assert.deepEqual(([...items.rows,...remaining.rows] as SharedItem[]).map(r=>r.position),Array.from({length:53},(_,i)=>i+1));
 await command(a,{kind:'task.archive',groupId:id,taskId:(first.rows[0] as SharedTask).id});
 assert.equal((await a.browser.request(url({groupId:id,collection:'tasks',cursor:first.next,revision:first.revision}))).statusCode,409);
 await h.admin.query('update rise_private.shared_limits set tasks_per_group=53,items_per_list=2');
 try{await send(a,operation(a,{kind:'task.create',groupId:id,taskId:randomUUID(),...taskFields},(await head(a,id)).revision),409);
  const listId=await list(a,id),one=await item(a,id,listId);await item(a,id,listId);await command(a,{kind:'item.remove',groupId:id,listId,itemId:one});
  assert.equal((await send(a,operation(a,{kind:'item.add',groupId:id,listId,itemId:randomUUID(),text:'Beyond retained quota',quantity:''},(await head(a,id)).revision),409)).json().error.code,'shared_limit');
 }finally{await h.admin.query('update rise_private.shared_limits set tasks_per_group=500,items_per_list=1000');}
});

test('bounded Unicode fields round-trip, archived groups remain readable and fresh changes require restoration',async()=>{
 const a=await actor(),id=await family(a),title='🌱'.repeat(160),notes='🌱'.repeat(799)+'\n',taskId=await task(a,id,{title,notes});
 const original=(await page(a,{groupId:id,collection:'tasks'})).rows[0] as SharedTask;assert.equal(original.title,title);assert.equal(original.notes,notes);
 await command(a,{kind:'group.archive',groupId:id});assert.deepEqual((await page(a,{groupId:id,collection:'tasks'})).rows,[original]);
 assert.equal((await send(a,operation(a,{kind:'task.complete',groupId:id,taskId,date:taskFields.date,completed:true},(await head(a,id)).revision),409)).json().error.code,'group_archived');
 await command(a,{kind:'group.restore',groupId:id});await command(a,{kind:'task.complete',groupId:id,taskId,date:taskFields.date,completed:true});
 const snapshot=((await page(a,{groupId:id,collection:'occurrences',parentId:taskId})).rows[0] as SharedOccurrence).snapshot;assert.equal(snapshot.title,title);assert.equal(snapshot.notes,notes);
});

test('receipt failure rolls back content, ranking and revision; the same operation can then recover',async()=>{
 const a=await actor(),id=await family(a),listId=await list(a,id),one=await item(a,id,listId,'One'),two=await item(a,id,listId,'Two');
 const before=await page(a,{groupId:id,collection:'items',parentId:listId}),op=operation(a,{kind:'item.move',groupId:id,listId,itemId:two,beforeId:one},before.revision);
 await h.admin.query(`create function rise_private.synthetic_shared_receipt_failure() returns trigger language plpgsql set search_path='' as $$begin if new.id='${op.operationId}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_shared_receipt_failure before insert on rise.group_receipts for each row execute function rise_private.synthetic_shared_receipt_failure()`);
 try{await send(a,op,503);assert.deepEqual(await page(a,{groupId:id,collection:'items',parentId:listId}),before);}finally{await h.admin.query('drop trigger synthetic_shared_receipt_failure on rise.group_receipts;drop function rise_private.synthetic_shared_receipt_failure()');}
 const accepted=await send(a,op);assert.deepEqual((await send(a,op)).json(),accepted.json());assert.deepEqual(((await page(a,{groupId:id,collection:'items',parentId:listId})).rows as SharedItem[]).map(x=>x.id),[two,one]);
});

test('account suppression and primary purge retain deidentified shared history; group deletion cascades all content',async()=>{
 const a=await actor(),b=await actor(),id=await family(a);await join(a,b,id);const member=(await head(b,id)).members.find(x=>x.self)!.id,taskId=await task(b,id,{assignee:member}),listId=await list(b,id);await item(b,id,listId,'Retained shared item');
 await command(b,{kind:'task.complete',groupId:id,taskId,date:taskFields.date,completed:true});const oldClaims=await claims(b);
 assert.equal((await b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})).statusCode,200);
 const row=(await h.admin.query('select user_id,display_name,status from rise.memberships where id=$1',[member])).rows[0];assert.deepEqual(row,{user_id:null,display_name:null,status:'deleted'});
 assert.equal(((await page(a,{groupId:id,collection:'occurrences',parentId:taskId})).rows[0] as SharedOccurrence).byMemberId,member);
 const sql=await h.store.pool.connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(oldClaims)]);assert.equal((await sql.query('select * from rise.family_tasks where group_id=$1',[id])).rowCount,0);}finally{await sql.query('rollback');sql.release();}
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{await worker.verify();await worker.pool.query('select rise_private.purge_group_identity($1)',[b.owner]);await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(b.owner);}finally{await worker.close();}
 assert.equal((await page(a,{groupId:id,collection:'tasks'})).rows.length,1);assert.equal((await page(a,{groupId:id,collection:'items',parentId:listId})).rows.length,1);
 await command(a,{kind:'group.delete',groupId:id});for(const table of ['family_tasks','task_occurrences','shared_lists','shared_items'])assert.equal((await h.admin.query(`select count(*) from rise.${table} where group_id=$1`,[id])).rows[0].count,'0');
});
