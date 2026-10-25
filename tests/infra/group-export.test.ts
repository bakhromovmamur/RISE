import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {personalTotals} from '../support/personalTestData.ts';
import {hash} from '../../server/auth/crypto.ts';
import {Sessions,AuthError} from '../../server/auth/sessions.ts';
import {exportGroup} from '../../server/groups/export.ts';
import {parseGroupArchive} from '../../src/contracts/groupArchive.ts';
import {parseSquadPreview} from '../../src/contracts/squads.ts';
import {addDays,localDate,weekStart} from '../../src/domain/calendar.ts';
import type {AccountGroup,GroupCommand,GroupReceipt} from '../../src/contracts/groups.ts';
import {lifecycleDatabase,accountPurger,purgeAccounts} from '../../server/lifecycle/worker.ts';
import {previewRestore} from '../../src/data/backup.ts';
import {createEmptyState} from '../../src/data/initialState.ts';

let h:Awaited<ReturnType<typeof authHarness>>;const subjects:string[]=[],groups:string[]=[];
before(async()=>{h=await authHarness();});
async function finishPurges(){
 const pending=async()=>(await h.admin.query('select count(*)::int as n from rise_private.deletion_jobs where user_id=any($1::uuid[]) and purged_at is null',[subjects])).rows[0].n as number;
 if(!await pending())return;
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{await worker.verify();for(let i=0;i<10&&await pending();i++)assert.equal((await purgeAccounts(worker.pool,accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!))).failed,0);assert.equal(await pending(),0);}finally{await worker.close();}
}
after(async()=>{if(h)try{await finishPurges();await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await h.close();}});
async function actor(){const c=new PersonalClient(h);await c.initialize();subjects.push(c.owner);return c;}
async function head(c:PersonalClient,id:string){const r=await c.browser.request('groups');assert.equal(r.statusCode,200);const g=r.json<{groups:AccountGroup[]}>().groups.find(x=>x.id===id);assert.ok(g);return g;}
async function command(c:PersonalClient,input:GroupCommand){const expectedRevision=input.kind==='group.create'||input.kind==='group.accept'?0:(await head(c,input.groupId)).revision;
 const r=await c.browser.request('groups/commands',{accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command:input});assert.equal(r.statusCode,200,`group_status:${r.json().error?.code??'ok'}`);return r.json<GroupReceipt>();}
async function group(c:PersonalClient,kind:'family'|'squad'='family'){const id=randomUUID();groups.push(id);await command(c,{kind:'group.create',groupId:id,groupKind:kind,name:'Synthetic shared archive',timezone:'Pacific/Kiritimati',nickname:'Chosen owner'});return id;}
async function join(a:PersonalClient,b:PersonalClient,id:string){const invite=await command(a,{kind:'group.invite',groupId:id});await command(b,{kind:'group.accept',token:new URL(invite.invitation!.link).hash.slice(8),nickname:'Chosen member'});}
const fields={title:'Original shared task',notes:'Shared note · O‘zbek · Русский',assignee:null,date:'2026-10-23',time:'10:30',weekdays:[5]};
async function task(c:PersonalClient,groupId:string,assignee:string|null=null){const taskId=randomUUID();await command(c,{kind:'task.create',groupId,taskId,...fields,assignee});return taskId;}
async function archive(c:PersonalClient,id:string){const revision=(await head(c,id)).revision,r=await c.browser.request(`groups/${id}/export`,{accountId:c.owner,revision});assert.equal(r.statusCode,200,`export_status:${r.json().error?.code??'ok'}`);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['content-disposition'],'attachment; filename="rise-group-archive.json"');return parseGroupArchive(r.body);}
async function preview(c:PersonalClient,groupId:string,note:string,week=weekStart(localDate('UTC'))){const r=await c.browser.request('squads/preview',{accountId:c.owner,groupId,postId:randomUUID(),groupRevision:(await head(c,groupId)).revision,postRevision:0,personalRevision:c.revision,week,note,choices:{habits:false,milestones:false,prayers:false}});assert.equal(r.statusCode,200);return parseSquadPreview(r.json());}

test('authorized shared archive retains full family history and archived content, omits removed items and every private projection',async()=>{
 const a=await actor(),b=await actor(),id=await group(a);await join(a,b,id);const member=(await head(b,id)).members.find(m=>m.self)!.id,taskId=await task(a,id,member);
 await command(b,{kind:'task.complete',groupId:id,taskId,date:fields.date,completed:true});
 await command(a,{kind:'task.edit',groupId:id,taskId,...fields,title:'Changed task',assignee:null});await command(a,{kind:'task.archive',groupId:id,taskId});
 const listId=randomUUID(),itemId=randomUUID(),removed=randomUUID();await command(a,{kind:'list.create',groupId:id,listId,name:'Archived shared list'});
 for(const item of [itemId,removed])await command(b,{kind:'item.add',groupId:id,listId,itemId:item,text:item===removed?'Removed secret text':'Visible item',quantity:'2'});
 await command(b,{kind:'item.remove',groupId:id,listId,itemId:removed});await command(a,{kind:'list.archive',groupId:id,listId});await command(a,{kind:'group.archive',groupId:id});
 const before=await a.read(),file=await archive(b,id);assert.equal(file.group.archived,true);assert.equal(file.group.members.find(m=>m.self)?.id,member);assert.equal(file.content.kind,'family');
 if(file.content.kind!=='family')throw new Error('family archive');
 assert.equal(file.content.tasks[0].title,'Changed task');assert.equal(file.content.tasks[0].archived,true);assert.equal(file.content.occurrences[0].snapshot.title,fields.title);assert.equal(file.content.occurrences[0].snapshot.assignee,member);assert.equal(file.content.occurrences[0].snapshot.timezone,'Pacific/Kiritimati');
 assert.equal(file.content.items.length,1);assert.equal(file.content.items[0].id,itemId);assert.equal(file.content.lists[0].archived,true);
 const raw=JSON.stringify(file);assert.ok(!raw.includes(a.owner)&&!raw.includes(b.owner));assert.doesNotMatch(raw,/Removed secret text|example\.invalid|csrf|preferences|invitations|provider|endpoint|coordinates|private journey|owner_id|user_id|drafts/);
 const personal=await b.browser.request('account/export',{accountId:b.owner});assert.equal(personal.statusCode,200);assert.deepEqual(personal.json().shared,{available:false,items:[]});assert.ok(!personal.body.includes(id));
 assert.deepEqual(await a.read(),before);
 await h.admin.query("update rise.task_occurrences set timezone='invalid/zone' where group_id=$1",[id]);
 const corrupt=await b.browser.request(`groups/${id}/export`,{accountId:b.owner,revision:file.group.revision});assert.equal(corrupt.statusCode,503);assert.equal(corrupt.json().error.code,'unavailable');assert.equal(corrupt.headers['content-disposition'],undefined);
});

test('squad archive includes exact published choices and viewer reaction only; staging, withdrawal and removal stay erased',async()=>{
 const a=await actor(),b=await actor(),id=await group(a,'squad');await join(a,b,id);
 const published=await preview(a,id,'Exact shared snapshot');await command(a,{kind:'squad.publish',groupId:id,postId:published.postId,previewId:published.previewId,hash:published.hash});
 await command(b,{kind:'squad.react',groupId:id,postId:published.postId,encourage:true});
 const hidden=await preview(b,id,'Withdrawn secret');await command(b,{kind:'squad.publish',groupId:id,postId:hidden.postId,previewId:hidden.previewId,hash:hidden.hash});await command(b,{kind:'squad.withdraw',groupId:id,postId:hidden.postId});
 await preview(a,id,'Unpublished secret',addDays(weekStart(localDate('UTC')),-7));const file=await archive(b,id);assert.equal(file.content.kind,'squad');if(file.content.kind!=='squad')throw new Error('squad archive');
 assert.equal(file.content.posts.length,1);assert.deepEqual(file.content.posts[0].snapshot,published.snapshot);assert.deepEqual(file.content.posts[0].reactions,{count:1,mine:true});
 assert.doesNotMatch(JSON.stringify(file),/Withdrawn secret|Unpublished secret|previewId|sourceRevision|postRevision|choices|user_id|owner_id/);
 await command(a,{kind:'squad.remove',groupId:id,postId:published.postId});const empty=await archive(b,id);assert.deepEqual(empty.content,{kind:'squad',posts:[]});
});

test('shared export requires current verified actor, Origin/CSRF, recent auth and exact reviewed revision',async()=>{
 const a=await actor(),b=await actor(),id=await group(a),revision=(await head(a,id)).revision,input={accountId:a.owner,revision},url=`groups/${id}/export`,anonymous=new AuthBrowser(h);await anonymous.read();
 assert.equal((await anonymous.request(url,input)).statusCode,401);assert.equal((await b.browser.request(url,{...input,accountId:b.owner})).statusCode,404);
 for(const headers of [{'x-rise-csrf':''},{origin:'https://foreign.invalid'}] as Record<string,string>[])assert.equal((await a.browser.request(url,input,headers)).statusCode,403);
 for(const body of [{...input,revision:0},{...input,ownerId:a.owner},{...input,accountId:'bad'},{...input,revision:'1'}])assert.equal((await a.browser.request(url,body)).statusCode,422);
 assert.equal((await a.browser.request('groups/bad/export',input)).statusCode,422);assert.equal((await a.browser.request(url,{...input,accountId:b.owner})).statusCode,409);
 await task(a,id);const stale=await a.browser.request(url,input);assert.equal(stale.statusCode,409);assert.equal(stale.json().error.code,'group_changed');
 await h.admin.query("update rise_private.server_sessions set authenticated_at=now()-interval '11 minutes' where id_hash=$1",[hash(a.browser.cookies.get('rise_test_session')!)]);
 const old=await a.browser.request(url,{...input,revision:(await head(a,id)).revision});assert.equal(old.statusCode,403);assert.equal(old.json().error.code,'recent_auth_required');
 await h.admin.query('update rise_private.server_sessions set revoked_at=now(),provider_cipher=null where id_hash=$1',[hash(a.browser.cookies.get('rise_test_session')!)]);
 assert.equal((await a.browser.request(url,input)).statusCode,401);
});

test('left and removed members cannot export; remaining members retain opaque family references without departed names',async()=>{
 const a=await actor(),b=await actor(),id=await group(a);await join(a,b,id);const member=(await head(b,id)).members.find(m=>m.self)!.id,taskId=await task(a,id,member);
 await command(b,{kind:'task.complete',groupId:id,taskId,date:fields.date,completed:true});const old=await head(b,id);await command(a,{kind:'group.remove',groupId:id,memberId:member});
 assert.equal((await b.browser.request(`groups/${id}/export`,{accountId:b.owner,revision:old.revision})).statusCode,404);
 const file=await archive(a,id);assert.equal(file.group.members.length,1);assert.doesNotMatch(JSON.stringify(file),/Chosen member/);if(file.content.kind!=='family')throw new Error('family');assert.equal(file.content.occurrences[0].byMemberId,member);
 const second=await group(a);await join(a,b,second);const before=await head(b,second);await command(b,{kind:'group.leave',groupId:second});assert.equal((await b.browser.request(`groups/${second}/export`,{accountId:b.owner,revision:before.revision})).statusCode,404);
});

test('bounded keyset export includes more than one page of every family collection without truncation',async()=>{
 const a=await actor(),id=await group(a),revision=(await head(a,id)).revision;
 await h.admin.query("insert into rise.family_tasks(id,group_id,title,notes,date,revision) select gen_random_uuid(),$1,'Synthetic page '||n,'','2026-10-23',$2 from generate_series(1,201) n",[id,revision]);
 await h.admin.query("insert into rise.shared_lists(id,group_id,name,revision) select gen_random_uuid(),$1,'Synthetic list '||n,$2 from generate_series(1,201) n",[id,revision]);
 await h.admin.query("insert into rise.shared_items(id,group_id,list_id,text,quantity,position,revision) select gen_random_uuid(),group_id,id,'Synthetic item','',1,revision from rise.shared_lists where group_id=$1",[id]);
 await h.admin.query("insert into rise.task_occurrences(group_id,task_id,date,completed,title,notes,timezone,task_revision,revision) select group_id,id,date,false,title,notes,'Pacific/Kiritimati',revision,revision from rise.family_tasks where group_id=$1",[id]);
 const file=await archive(a,id);if(file.content.kind!=='family')throw new Error('family');for(const key of ['tasks','lists','items','occurrences'] as const)assert.equal(file.content[key].length,201);
});

test('real concurrent mutation/removal between export pages rejects the entire file',async()=>{
 for(const remove of [false,true]){
  const owner=await actor(),member=await actor(),id=await group(owner);await join(owner,member,id);await task(owner,id);const reviewed=await head(member,id),sessions=new Sessions(h.config,h.store.pool,h.real);let changed=false;
  const request={context:member.browser.cookies.get('rise_test_context')??null,session:member.browser.cookies.get('rise_test_session')??null,csrf:member.browser.csrf,ip:member.browser.ip};
  await assert.rejects(sessions.asActor(request,true,async(client,actor)=>{
   // Keep the real restricted connection, RLS and transaction. Pause only after
   // a real page has returned, then commit another member's real API command.
   const observed=new Proxy(client,{get(target,key){if(key!=='query')return Reflect.get(target,key);return async(sql:string,values?:unknown[])=>{
    const result=await target.query(sql,values);if(!changed&&sql.includes('from rise.family_tasks r')){changed=true;await command(owner,remove?{kind:'group.remove',groupId:id,memberId:reviewed.members.find(m=>m.self)!.id}:{kind:'group.rename',groupId:id,name:'Concurrent revision'});}return result;
   };}});
   return exportGroup(observed,actor,id,{accountId:member.owner,revision:reviewed.revision});
  }),error=>error instanceof AuthError&&error.code===(remove?'group_unavailable':'group_changed'));
  assert.equal(changed,true);
 }
});

test('a real oversized shared history fails as a whole without truncation, data mutation or retained export files',async()=>{
 const a=await actor(),id=await group(a),taskId=await task(a,id),revision=(await head(a,id)).revision;
 // Synthetic maximum-length Unicode history crosses the 50 MiB wire limit
 // without changing the installation's limits or another group's records.
 await h.admin.query("insert into rise.task_occurrences(group_id,task_id,date,completed,title,notes,timezone,task_revision,revision) select $1,$2,date '2000-01-01'+n,false,'Synthetic history',repeat('界',800),'UTC',$3,$3 from generate_series(0,19999) n",[id,taskId,revision]);
 // Bulk synthetic history needs planner statistics equivalent to retained data.
 await h.admin.query('analyze rise.task_occurrences');
 const before=await a.read(),response=await a.browser.request(`groups/${id}/export`,{accountId:a.owner,revision});
 assert.equal(response.statusCode,422);assert.equal(response.json().error.code,'export_too_large');assert.equal(response.headers['content-disposition'],undefined);assert.ok(response.body.length<1000);
 assert.equal((await h.admin.query('select count(*) from rise.task_occurrences where group_id=$1',[id])).rows[0].count,'20000');assert.deepEqual(await a.read(),before);
});

test('integrated ownership, deletion and backup replay preserve family history while erasing squad identity, previews and notification jobs',async()=>{
 const a=await actor(),b=await actor(),family=await group(a),squad=await group(a,'squad'),solo=await group(a);
 await join(a,b,family);await join(a,b,squad);await personalTotals(a);const privateBefore=await a.read(),otherBefore=await b.read();
 for(const person of [a,b]){
  await person.browser.request('push');const ec=createECDH('prime256v1');ec.generateKeys();
  const subscribed=await person.browser.request('push',{accountId:person.owner,version:0,details:false,language:'en',subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}});assert.equal(subscribed.statusCode,200);
  for(const groupId of [family,squad])await command(person,{kind:'group.preferences',groupId,muted:false,quietStart:'00:00',quietEnd:'00:00',notifications:true});
 }
 const aMember=(await head(a,family)).members.find(m=>m.self)!.id,bMember=(await head(b,family)).members.find(m=>m.self)!.id;
 const taskId=await task(b,family,aMember);await command(a,{kind:'task.complete',groupId:family,taskId,date:fields.date,completed:true});await task(a,family,bMember);
 const listId=randomUUID();await command(a,{kind:'list.create',groupId:family,listId,name:'Retained family list'});await command(a,{kind:'item.add',groupId:family,listId,itemId:randomUUID(),text:'Retained shared item',quantity:'1'});
 const authored=await preview(a,squad,'Erase this authored snapshot'),retained=await preview(b,squad,'Retain the other author');
 await command(a,{kind:'squad.publish',groupId:squad,postId:authored.postId,previewId:authored.previewId,hash:authored.hash});
 // Refresh the other author's exact preview after the group revision changed.
 const current=await preview(b,squad,retained.snapshot.note);await command(b,{kind:'squad.publish',groupId:squad,postId:current.postId,previewId:current.previewId,hash:current.hash});
 await command(a,{kind:'squad.react',groupId:squad,postId:current.postId,encourage:true});await command(b,{kind:'squad.react',groupId:squad,postId:authored.postId,encourage:true});await preview(a,squad,'Erase the unpublished preview',addDays(weekStart(localDate('UTC')),-7));
 const privateFile=await a.browser.request('account/export',{accountId:a.owner});assert.equal(privateFile.statusCode,200);const familyBefore=await archive(a,family),squadBefore=await archive(a,squad);
 assert.ok(!JSON.stringify(familyBefore).includes('Private synthetic reflection'));assert.ok(!JSON.stringify(squadBefore).includes('Erase the unpublished preview'));
 const blocked=await a.browser.request('account/deletion',{accountId:a.owner,requestId:randomUUID(),revision:a.revision,confirm:'delete-account'});assert.equal(blocked.statusCode,409);assert.equal(blocked.json().error.code,'ownership_resolution_required');assert.deepEqual((await archive(a,family)).content,familyBefore.content);
 for(const id of [family,squad])await command(a,{kind:'group.transfer',groupId:id,memberId:(await head(b,id)).members.find(m=>m.self)!.id});await command(a,{kind:'group.delete',groupId:solo});
 const captured=(await h.admin.query<{row:Record<string,unknown>}>("select jsonb_build_object('sub',user_id,'session_id',provider_session_id) as row from rise_private.server_sessions where id_hash=$1",[hash(a.browser.cookies.get('rise_test_session')!)])).rows[0].row;
 const tables=[['rise.memberships','user_id'],['rise.group_preferences','user_id'],['rise.squad_posts','author_id'],['rise.squad_reactions','user_id'],['rise_private.squad_previews','user_id'],['rise.push_subscriptions','user_id']] as const;
 const capturedRows=new Map<string,Record<string,unknown>[]>();
 for(const [table,column]of tables)capturedRows.set(table,(await h.admin.query<{row:Record<string,unknown>}>(`select to_jsonb(r) as row from ${table} r where ${column}=$1`,[a.owner])).rows.map(r=>r.row));
 const notices=(await h.admin.query<{row:Record<string,unknown>}>('select to_jsonb(j) as row from rise.notification_jobs j where user_id=$1 or source_actor_id=$1',[a.owner])).rows.map(r=>r.row);assert.ok(notices.length>0);
 const request={accountId:a.owner,requestId:randomUUID(),revision:a.revision,confirm:'delete-account'};
 await h.admin.query(`create function rise_private.synthetic_group05_failure() returns trigger language plpgsql set search_path='' as $$begin if new.user_id='${a.owner}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_group05_failure before insert on rise_private.deletion_ledger for each row execute function rise_private.synthetic_group05_failure()`);
 try{
  assert.equal((await a.browser.request('account/deletion',request)).statusCode,503);
  for(const [table,column]of tables)assert.deepEqual((await h.admin.query<{row:Record<string,unknown>}>(`select to_jsonb(r) as row from ${table} r where ${column}=$1`,[a.owner])).rows.map(r=>r.row),capturedRows.get(table));
 }finally{await h.admin.query('drop trigger synthetic_group05_failure on rise_private.deletion_ledger;drop function rise_private.synthetic_group05_failure()');}
 const deleted=await a.browser.request('account/deletion',request);assert.equal(deleted.statusCode,200);assert.deepEqual((await a.browser.request('account/deletion',request)).json(),deleted.json());
 for(const path of [`groups/${family}/export`,`groups/${squad}/export`])assert.equal((await a.browser.request(path,{accountId:a.owner,revision:1})).statusCode,401);
 const afterFamily=await archive(b,family),afterSquad=await archive(b,squad);assert.equal(afterFamily.group.members.length,1);assert.deepEqual(afterFamily.content,familyBefore.content);assert.equal(afterSquad.content.kind,'squad');
 if(afterSquad.content.kind!=='squad')throw new Error('squad');assert.equal(afterSquad.content.posts.length,1);assert.equal(afterSquad.content.posts[0].id,current.postId);assert.equal(afterSquad.content.posts[0].reactions.count,0);
 const assertErased=async()=>{
  for(const [table,column]of tables.filter(([table])=>table!=='rise.push_subscriptions'))assert.equal((await h.admin.query(`select count(*) from ${table} where ${column}=$1`,[a.owner])).rows[0].count,'0',table);
  assert.equal((await h.admin.query('select count(*) from rise.notification_jobs where user_id=$1 or source_actor_id=$1',[a.owner])).rows[0].count,'0');
 };
 await assertErased();assert.equal((await h.admin.query('select count(*) from auth.users where id=$1',[a.owner])).rows[0].count,'1');
 const oldAccess=async()=>{const sql=await h.store.pool.connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(captured)]);for(const table of ['groups','family_tasks','squad_posts'])assert.equal((await sql.query(`select id from rise.${table}`)).rowCount,0);}finally{await sql.query('rollback');sql.release();}};await oldAccess();
 // Offline synthetic backup replay: keep the authoritative suppression ledger.
 // No restored content is served to remaining members until terminal replay.
 for(const member of capturedRows.get('rise.memberships')!)await h.admin.query("update rise.memberships set user_id=$2,display_name=$3,status='active',departed_at=null where id=$1",[member.id,member.user_id,member.display_name]);
 for(const [table]of tables.filter(([table])=>table!=='rise.memberships'))for(const row of capturedRows.get(table)!){
  if(table==='rise.push_subscriptions')await h.admin.query('delete from rise.push_subscriptions where id=$1',[row.id]);
  await h.admin.query(`insert into ${table} select * from jsonb_populate_record(null::${table},$1::jsonb)`,[JSON.stringify(row)]);
 }
 for(const row of notices)await h.admin.query('insert into rise.notification_jobs select * from jsonb_populate_record(null::rise.notification_jobs,$1::jsonb)',[JSON.stringify(row)]);
 await oldAccess();assert.equal((await a.browser.request(`groups/${family}/export`,{accountId:a.owner,revision:1})).statusCode,401);
 await finishPurges();await assertErased();assert.equal((await h.admin.query('select count(*) from auth.users where id=$1',[a.owner])).rows[0].count,'0');assert.equal((await h.admin.query('select count(*) from rise.profiles where owner_id=$1',[a.owner])).rows[0].count,'0');assert.equal((await h.admin.query('select count(*) from rise.push_subscriptions where user_id=$1',[a.owner])).rows[0].count,'0');
 assert.equal((await h.admin.query('select count(*) from rise_private.deletion_jobs j join rise_private.deletion_ledger l using(user_id) where user_id=$1 and purged_at is not null',[a.owner])).rows[0].count,'1');
 assert.deepEqual((await archive(b,family)).content,familyBefore.content);assert.deepEqual(await b.read(),otherBefore);
 const device={state:createEmptyState(),archives:[],revision:0},before=structuredClone(device);await assert.rejects(previewRestore(JSON.stringify(familyBefore),device));assert.deepEqual(device,before);
 const portable=await previewRestore(privateFile.body,device);assert.equal(portable.content.personal.life.groups.length,0);assert.equal(privateFile.json().xp,privateBefore.xp);assert.equal((await a.browser.request('personal/commands',{protocolVersion:1,operationId:randomUUID(),baseRevision:0,command:{kind:'account.initialize',name:'Resurrection',timezone:'UTC',language:'en'}})).statusCode,401);
});
