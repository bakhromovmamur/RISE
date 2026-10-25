import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {personalTotals} from '../support/personalTestData.ts';
import {hash} from '../../server/auth/crypto.ts';
import {lifecycleDatabase,accountPurger} from '../../server/lifecycle/worker.ts';
import {localDate,weekStart} from '../../src/model.ts';
import {parseSquadPage,parseSquadPreview,type SquadPreview,type SquadPreviewRequest,type SquadQuery} from '../../src/contracts/squads.ts';
import type {AccountGroup,GroupCommand,GroupOperation,GroupReceipt} from '../../src/contracts/groups.ts';

let h:Awaited<ReturnType<typeof authHarness>>;const subjects:string[]=[],groups:string[]=[];
before(async()=>{h=await authHarness();});
after(async()=>{if(h)try{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await h.close();}});
const week=()=>weekStart(localDate('UTC'));
async function actor(){const c=new PersonalClient(h);await c.initialize();subjects.push(c.owner);return c;}
async function head(c:PersonalClient,id:string){const r=await c.browser.request('groups');assert.equal(r.statusCode,200);const g=r.json<{groups:AccountGroup[]}>().groups.find(x=>x.id===id);assert.ok(g);return g;}
const operation=(c:PersonalClient,command:GroupCommand,expectedRevision:number):GroupOperation=>({accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command});
async function send(c:PersonalClient,op:GroupOperation,status=200){const r=await c.browser.request('groups/commands',op);assert.equal(r.statusCode,status,`squad_status:${r.json().error?.code??'ok'}`);return r;}
async function command(c:PersonalClient,input:GroupCommand){return (await send(c,operation(c,input,input.kind==='group.create'||input.kind==='group.accept'?0:(await head(c,input.groupId)).revision))).json<GroupReceipt>();}
async function squad(c:PersonalClient,kind:'family'|'squad'='squad'){const id=randomUUID();groups.push(id);await command(c,{kind:'group.create',groupId:id,groupKind:kind,name:'Synthetic squad',timezone:'Pacific/Kiritimati',nickname:'Chosen nickname'});return id;}
async function join(a:PersonalClient,b:PersonalClient,id:string){const invite=await command(a,{kind:'group.invite',groupId:id});await command(b,{kind:'group.accept',token:new URL(invite.invitation!.link).hash.slice(8),nickname:'Member nickname'});}
async function input(c:PersonalClient,groupId:string,changes:Partial<SquadPreviewRequest>={}):Promise<SquadPreviewRequest>{return {accountId:c.owner,groupId,postId:randomUUID(),groupRevision:(await head(c,groupId)).revision,postRevision:0,personalRevision:c.revision,week:week(),note:'A chosen reflection',choices:{habits:false,milestones:false,prayers:false},...changes};}
async function preview(c:PersonalClient,groupId:string,changes:Partial<SquadPreviewRequest>={}){const r=await c.browser.request('squads/preview',await input(c,groupId,changes));assert.equal(r.statusCode,200,`preview_status:${r.json().error?.code??'ok'}`);assert.equal(r.headers['cache-control'],'no-store');return parseSquadPreview(r.json());}
const publish=(p:SquadPreview):GroupCommand=>({kind:'squad.publish',groupId:p.groupId,postId:p.postId,previewId:p.previewId,hash:p.hash});
function url(q:SquadQuery){const {groupId,...query}=q;return `squads/${groupId}?${new URLSearchParams(Object.entries(query).map<[string,string]>(([k,v])=>[k,String(v)]))}`;}
async function feed(c:PersonalClient,id:string,changes:Partial<SquadQuery>={}){const r=await c.browser.request(url({groupId:id,week:week(),...changes}));assert.equal(r.statusCode,200,`squad_read:${r.json().error?.code??'ok'}`);assert.equal(r.headers['cache-control'],'no-store');return parseSquadPage(r.json());}
async function post(c:PersonalClient,id:string,note='A chosen reflection'){const p=await preview(c,id,{note});await command(c,publish(p));return (await feed(c,id)).rows.find(row=>row.id===p.postId)!;}
async function claims(c:PersonalClient){const r=(await h.admin.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(c.browser.cookies.get('rise_test_session')!)])).rows[0];return {sub:r.user_id,session_id:r.provider_session_id,user_metadata:{role:'owner'}};}
async function sqlAs(c:PersonalClient,role:'rise_bff'|'authenticated'|'anon',run:(sql:pg.PoolClient)=>Promise<void>){const sql=await(role==='rise_bff'?h.store.pool:h.admin).connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(await claims(c))]);if(role!=='rise_bff')await sql.query(`set local role ${role}`);await run(sql);}finally{await sql.query('rollback');sql.release();}}
const denied=(code:string)=>(error:unknown)=>!!error&&typeof error==='object'&&'code' in error&&error.code===code;

test('squad preview requires verified owner, consent selections and current membership; hostile private fields fail closed',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a),family=await squad(a,'family'),request=await input(a,id),anonymous=new AuthBrowser(h);await anonymous.read();
 assert.equal((await anonymous.request('squads/preview',request)).statusCode,401);
 for(const headers of [{'x-rise-csrf':''},{origin:'https://foreign.invalid'}] as Record<string,string>[])assert.equal((await a.browser.request('squads/preview',request,headers)).statusCode,403);
 for(const fields of [{ownerId:b.owner},{snapshot:{week:week(),note:'Injected'}},{habits:999},{coordinates:[1,2]},{choices:{...request.choices,pause:true}},{note:'',choices:request.choices},{week:localDate('UTC')+'junk'}])assert.equal((await a.browser.request('squads/preview',{...request,...fields})).statusCode,422);
 assert.equal((await a.browser.request('squads/preview',{...request,accountId:b.owner})).statusCode,403);
 assert.equal((await b.browser.request('squads/preview',{...request,accountId:b.owner})).statusCode,404);
 assert.equal((await a.browser.request('squads/preview',{...request,groupId:family,groupRevision:(await head(a,family)).revision})).statusCode,404);
 assert.equal((await b.browser.request(url({groupId:id,week:week()}))).statusCode,404);
 const p=await preview(a,id);assert.deepEqual(p.snapshot,{week:week(),note:request.note});assert.deepEqual((await feed(a,id)).rows,[]);
 const raw=(await h.admin.query('select expires_at-created_at as lifetime from rise_private.squad_previews where id=$1',[p.previewId])).rows[0];assert.equal(raw.lifetime.minutes,10);
 const fresh=new PersonalClient(h);await fresh.login();subjects.push(fresh.owner);assert.equal((await fresh.browser.request('squads/preview',{...request,accountId:fresh.owner})).statusCode,409);assert.equal((await fresh.read()).initialized,false);
});

test('publication equals the committed preview after private corrections and discloses only chosen aggregate fields',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const f=await personalTotals(a),before=await a.read();
 const p=await preview(a,id,{choices:{habits:true,milestones:true,prayers:true}});
 assert.deepEqual(p.snapshot,{week:week(),note:'A chosen reflection',habits:6,milestones:['Second step'],prayers:1});assert.equal(p.sourceRevision,before.revision);
 assert.equal((await a.read()).revision,before.revision);assert.equal((await a.read()).xp,before.xp);
 await a.command({kind:'habit.correct',habitId:f.habits[0],date:f.date,check:null});const current=await a.read();
 await command(a,publish(p));const published=(await feed(b,id)).rows[0];assert.deepEqual(published.snapshot,p.snapshot);
 assert.equal((await a.read()).revision,current.revision);assert.equal((await a.read()).xp,current.xp);
 assert.doesNotMatch(JSON.stringify(published),/Synthetic habit|private|pause|latitude|longitude|fajr|sourceRevision|owner_id|user_id|example\.invalid|provider|token/i);
 assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where id=$1',[p.previewId])).rows[0].count,'0');
 const edit=await preview(a,id,{postId:p.postId,postRevision:published.revision,choices:{habits:true,milestones:false,prayers:false},note:'Reviewed correction'});assert.equal(edit.snapshot.habits,5);
 await command(a,publish(edit));assert.deepEqual((await feed(b,id)).rows[0].snapshot,edit.snapshot);assert.doesNotMatch(JSON.stringify(h.logs),/A chosen reflection|Reviewed correction|First private synthetic|Second private synthetic/);
});

test('authors alone edit and withdraw, each member controls only their own encouragement and owners can remove abuse',async()=>{
 const owner=await actor(),author=await actor(),member=await actor(),id=await squad(owner);await join(owner,author,id);await join(owner,member,id);const p=await post(author,id);
 for(const c of [owner,member])assert.equal((await c.browser.request('squads/preview',await input(c,id,{postId:p.id,postRevision:p.revision,note:'Impersonation'}))).statusCode,404);
 await send(member,operation(member,{kind:'squad.withdraw',groupId:id,postId:p.id},(await head(member,id)).revision),403);
 await command(member,{kind:'squad.react',groupId:id,postId:p.id,encourage:true});await command(owner,{kind:'squad.react',groupId:id,postId:p.id,encourage:true});
 assert.deepEqual((await feed(author,id)).rows[0].reactions,{count:2,mine:false});assert.deepEqual((await feed(member,id)).rows[0].reactions,{count:2,mine:true});
 const inputOp=operation(member,{kind:'squad.react',groupId:id,postId:p.id,encourage:false},(await head(member,id)).revision);
 assert.equal((await member.browser.request('groups/commands',{...inputOp,command:{...inputOp.command,memberId:(await head(owner,id)).members.find(m=>m.self)!.id}})).statusCode,422);
 await send(member,inputOp);assert.deepEqual((await feed(owner,id)).rows[0].reactions,{count:1,mine:true});
 const edit=await preview(author,id,{postId:p.id,postRevision:p.revision,note:'The reviewed edit'});await command(author,publish(edit));assert.equal((await feed(owner,id)).rows[0].reactions.count,1);
 await send(member,operation(member,{kind:'squad.remove',groupId:id,postId:p.id},(await head(member,id)).revision),403);
 await command(owner,{kind:'squad.remove',groupId:id,postId:p.id});assert.deepEqual((await feed(author,id)).rows,[]);
 assert.deepEqual((await h.admin.query('select status,snapshot from rise.squad_posts where id=$1',[p.id])).rows[0],{status:'removed',snapshot:null});assert.equal((await h.admin.query('select count(*) from rise.squad_reactions where post_id=$1',[p.id])).rows[0].count,'0');
});

test('preview expiry, hashes, source revision and cross-account/group IDs cannot substitute a different approved snapshot',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a),other=await squad(a);await join(a,b,id);const p=await preview(a,id),request=await input(a,id);
 assert.equal((await a.browser.request('squads/preview',{...request,personalRevision:a.revision+1})).statusCode,409);
 const wrong=publish(p);assert.equal(wrong.kind,'squad.publish');
 await send(b,operation(b,wrong,(await head(b,id)).revision),409);
 await send(a,operation(a,{...wrong,groupId:other},(await head(a,other)).revision),409);
 await send(a,operation(a,{...wrong,postId:randomUUID()},(await head(a,id)).revision),409);
 await send(a,operation(a,{...wrong,hash:'0'.repeat(64)},(await head(a,id)).revision),409);
 await h.admin.query("update rise_private.squad_previews set created_at=created_at-interval '11 minutes',expires_at=expires_at-interval '11 minutes' where id=$1",[p.previewId]);
 const response=await send(a,operation(a,wrong,(await head(a,id)).revision),409);assert.equal(response.json().error.code,'squad_preview_expired');assert.deepEqual((await feed(a,id)).rows,[]);
 const replacement=await preview(a,id,{postId:p.postId});await command(a,publish(replacement));
 assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where user_id=$1',[a.owner])).rows[0].count,'0');
});

test('lost replies replay exact receipt after expiry and later edits; competing previews require explicit fresh review',async()=>{
 const a=await actor(),id=await squad(a),p=await preview(a,id),op=operation(a,publish(p),p.groupRevision),accepted=await send(a,op);
 const current=(await feed(a,id)).rows[0],one=await preview(a,id,{postId:p.postId,postRevision:current.revision,note:'First edit'}),two=await preview(a,id,{postId:p.postId,postRevision:current.revision,note:'Competing edit'});
 const first=operation(a,publish(one),one.groupRevision),second=operation(a,publish(two),two.groupRevision),results=await Promise.all([a.browser.request('groups/commands',first),a.browser.request('groups/commands',second)]);
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);const loser=results[0].statusCode===200?two:one;
 const stale=await send(a,operation(a,publish(loser),(await head(a,id)).revision),409);assert.equal(stale.json().error.code,'squad_changed');
 const before=await feed(a,id);assert.deepEqual((await send(a,op)).json(),accepted.json());assert.deepEqual(await feed(a,id),before);
 const changed={...op,command:{...op.command,postId:randomUUID()}};await send(a,changed,409);
 const newer=await preview(a,id,{postId:p.postId,postRevision:before.rows[0].revision,note:'Explicitly reviewed latest edit'});await command(a,publish(newer));assert.deepEqual((await feed(a,id)).rows[0].snapshot,newer.snapshot);
});

test('withdrawal erases active payloads and previews, preserves a removal barrier and stays available after archive',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const p=await post(a,id),draft=await preview(a,id,{postId:p.id,postRevision:p.revision,note:'Unpublished private revision'});
 await command(b,{kind:'squad.react',groupId:id,postId:p.id,encourage:true});await command(a,{kind:'group.archive',groupId:id});
 assert.equal((await feed(b,id)).rows.length,1);await send(a,operation(a,publish(draft),(await head(a,id)).revision),409);
 await command(b,{kind:'squad.react',groupId:id,postId:p.id,encourage:false});await command(a,{kind:'squad.withdraw',groupId:id,postId:p.id});assert.deepEqual((await feed(b,id)).rows,[]);
 assert.deepEqual((await h.admin.query('select status,snapshot from rise.squad_posts where id=$1',[p.id])).rows[0],{status:'withdrawn',snapshot:null});
 assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where post_id=$1',[p.id])).rows[0].count,'0');
 await command(a,{kind:'group.restore',groupId:id});assert.equal((await a.browser.request('squads/preview',await input(a,id,{postId:p.id}))).statusCode,404);
 const replacement=await post(a,id,'A new explicit update');assert.notEqual(replacement.id,p.id);await send(a,operation(a,publish(draft),(await head(a,id)).revision),409);assert.equal((await feed(b,id)).rows[0].id,replacement.id);
});

test('membership removal immediately fences feed, preview, pending publication and previously accepted receipts',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const p=await preview(b,id),op=operation(b,publish(p),(await head(b,id)).revision);await send(b,op);
 const published=(await feed(b,id)).rows[0],pending=await preview(b,id,{postId:published.id,postRevision:published.revision,note:'Pending'}),oldClaims=await claims(b);
 await command(a,{kind:'group.remove',groupId:id,memberId:(await head(b,id)).members.find(m=>m.self)!.id});
 await send(b,op,404);await send(b,operation(b,publish(pending),(await head(a,id)).revision),404);
 assert.equal((await b.browser.request(url({groupId:id,week:week()}))).statusCode,404);assert.equal((await b.browser.request('groups/receipt',{accountId:b.owner,operationId:op.operationId})).statusCode,404);
 const sql=await h.store.pool.connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(oldClaims)]);assert.equal((await sql.query('select id from rise.squad_posts where group_id=$1',[id])).rowCount,0);assert.equal((await sql.query('select member_id from rise.squad_reactions where group_id=$1',[id])).rowCount,0);}finally{await sql.query('rollback');sql.release();}
 assert.deepEqual((await feed(a,id)).rows[0].snapshot,p.snapshot); // Chosen publication remains until withdrawal, moderation or account deletion.
});

test('forced RLS and narrow grants protect drafts, author identities, mutations and cross-group references',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a),other=await squad(b),p=await post(a,id);await command(a,{kind:'squad.react',groupId:id,postId:p.id,encourage:true});await preview(a,id,{postId:p.id,postRevision:p.revision});
 for(const role of ['rise_bff','authenticated'] as const){
  await sqlAs(a,role,async sql=>{assert.equal((await sql.query('select id,snapshot from rise.squad_posts where group_id=$1',[id])).rowCount,1);assert.equal((await sql.query('select member_id from rise.squad_reactions where group_id=$1',[id])).rowCount,1);});
  await sqlAs(b,role,async sql=>{assert.equal((await sql.query('select id from rise.squad_posts where group_id=$1',[id])).rowCount,0);});
  for(const query of ['select author_id from rise.squad_posts','select user_id from rise.squad_reactions','select snapshot from rise_private.squad_previews','delete from rise.squad_posts','delete from rise.squad_reactions'])await sqlAs(a,role,async sql=>{await assert.rejects(sql.query(query),denied('42501'));});
 }
 await sqlAs(a,'anon',async sql=>{await assert.rejects(sql.query('select id from rise.squad_posts'),denied('42501'));});
 await sqlAs(a,'authenticated',async sql=>{await assert.rejects(sql.query('select rise_private.change_squad($1,$2,$3::jsonb)',[id,1,JSON.stringify({kind:'squad.withdraw',groupId:id,postId:p.id})]),denied('42501'));});
 await sqlAs(a,'rise_bff',async sql=>{await assert.rejects(sql.query('set local role rise_group_guard'),denied('42501'));});
 await send(b,operation(b,{kind:'squad.react',groupId:other,postId:p.id,encourage:true},(await head(b,other)).revision),404);
 await assert.rejects(h.admin.query('update rise.squad_posts set author_member_id=$1 where id=$2',[(await head(b,other)).members[0].id,p.id]),denied('23503'));
 const flags=(await h.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where (relnamespace='rise'::regnamespace and relname in ('squad_posts','squad_reactions')) or (relnamespace='rise_private'::regnamespace and relname in ('squad_previews','squad_limits'))")).rows;assert.equal(flags.length,4);assert.ok(flags.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 const access=(await h.admin.query("select has_table_privilege('rise_group_guard','rise.profiles','select') as private,has_column_privilege('rise_worker','rise.squad_posts','snapshot','select') as worker,has_column_privilege('rise_lifecycle','rise_private.squad_previews','snapshot','select') as lifecycle")).rows[0];assert.deepEqual(access,{private:false,worker:false,lifecycle:false});
});

test('receipt insertion failure rolls back publication, preview consumption and revision together',async()=>{
 const a=await actor(),id=await squad(a),p=await preview(a,id),op=operation(a,publish(p),p.groupRevision),before=await feed(a,id);
 await h.admin.query(`create function rise_private.synthetic_squad_receipt_failure() returns trigger language plpgsql set search_path='' as $$begin if new.id='${op.operationId}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_squad_receipt_failure before insert on rise.group_receipts for each row execute function rise_private.synthetic_squad_receipt_failure()`);
 try{await send(a,op,503);assert.deepEqual(await feed(a,id),before);assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where id=$1',[p.previewId])).rows[0].count,'1');}finally{await h.admin.query('drop trigger synthetic_squad_receipt_failure on rise.group_receipts;drop function rise_private.synthetic_squad_receipt_failure()');}
 await send(a,op);assert.deepEqual((await feed(a,id)).rows[0].snapshot,p.snapshot);
});

test('preview and post quotas stay bounded without a worker, Unicode round-trips and expired preview cleanup is narrow',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a),other=await squad(b),limits=(await h.admin.query('select * from rise_private.squad_limits')).rows[0];
 await h.admin.query('update rise_private.squad_limits set previews_per_account=2,posts_per_group=1');
 try{
  const one=await preview(a,id,{note:'🌱'.repeat(600)}),two=await preview(a,id),safe=await preview(b,other);
  assert.equal((await a.browser.request('squads/preview',await input(a,id))).json().error.code,'squad_preview_limit');
  await command(a,publish(one));assert.equal((await feed(a,id)).rows[0].snapshot.note,'🌱'.repeat(600));await command(a,{kind:'squad.withdraw',groupId:id,postId:one.postId});
  const blocked=await send(a,operation(a,publish(two),(await head(a,id)).revision),409);assert.equal(blocked.json().error.code,'squad_limit');
  await h.admin.query("update rise_private.squad_previews set created_at=created_at-interval '11 minutes',expires_at=expires_at-interval '11 minutes' where id=$1",[two.previewId]);
  const state=JSON.parse(await readFile('.rise-infra/test/state.json','utf8')),worker=new pg.Pool({...h.config.database,user:'rise_worker_login',password:state.passwords.worker,max:1});
  try{await assert.rejects(worker.query('select snapshot from rise_private.squad_previews'),denied('42501'));assert.equal((await worker.query('select rise_private.prune_squad_previews(1) as removed')).rows[0].removed,1);await assert.rejects(worker.query('select rise_private.prune_squad_previews(501)'),denied('22023'));}finally{await worker.end();}
  assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where id=$1',[safe.previewId])).rows[0].count,'1');
 }finally{await h.admin.query('update rise_private.squad_limits set previews_per_account=$1,posts_per_group=$2,reactions_per_post=$3',[limits.previews_per_account,limits.posts_per_group,limits.reactions_per_post]);}
});

test('squad feed pages contain at most twenty exact posts and changed group revisions reject continuation',async()=>{
 const a=await actor(),id=await squad(a);await post(a,id,'Owner update');
 // Synthetic Auth roots and memberships exercise a full page without sending
 // invitations or creating credentials for the extra authors.
 for(let i=0;i<20;i++){
  const author=randomUUID(),member=randomUUID(),postId=randomUUID();subjects.push(author);
  await h.admin.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)",[author,`auth-${author}@example.invalid`]);
  await h.admin.query("insert into rise.memberships(id,group_id,user_id,display_name) values($1,$2,$3,$4)",[member,id,author,`Synthetic ${i}`]);
  await h.admin.query("insert into rise.squad_posts(id,group_id,author_id,author_member_id,week,status,snapshot,revision) values($1,$2,$3,$4,$5,'published',$6::jsonb,$7)",[postId,id,author,member,week(),JSON.stringify({week:week(),note:`Shared ${i}`}), (await head(a,id)).revision]);
 }
 const first=await feed(a,id);assert.equal(first.rows.length,20);assert.ok(first.next);const second=await feed(a,id,{cursor:first.next,revision:first.revision});assert.equal(second.rows.length,1);assert.equal(second.next,null);assert.equal(new Set([...first.rows,...second.rows].map(p=>p.id)).size,21);
 const own=await feed(a,id,{authorMemberId:(await head(a,id)).members.find(m=>m.self)!.id});assert.equal(own.rows.length,1);assert.equal(own.rows[0].snapshot.note,'Owner update');assert.equal(own.next,null);
 await command(a,{kind:'squad.react',groupId:id,postId:first.rows[0].id,encourage:true});assert.equal((await a.browser.request(url({groupId:id,week:week(),cursor:first.next,revision:first.revision}))).statusCode,409);
});

test('publication racing suppression commits in one authorized order and no authored payload remains',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const p=await preview(b,id),op=operation(b,publish(p),p.groupRevision);
 const [published,deleted]=await Promise.all([b.browser.request('groups/commands',op),b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})]);
 assert.equal(deleted.statusCode,200);assert.ok([200,401].includes(published.statusCode));assert.deepEqual((await feed(a,id)).rows,[]);
 assert.equal((await h.admin.query('select count(*) from rise.squad_posts where author_id=$1',[b.owner])).rows[0].count,'0');assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where user_id=$1',[b.owner])).rows[0].count,'0');
 assert.equal((await b.browser.request('groups/commands',op)).statusCode,401);
});

test('suppression removes authored posts, reactions and drafts before provider completion and terminal replay purges restored copies',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const retained=await post(a,id,'Retained other author'),authored=await post(b,id,'Deleted authored snapshot');
 await command(b,{kind:'squad.react',groupId:id,postId:retained.id,encourage:true});await preview(b,id,{postId:authored.id,postRevision:authored.revision,note:'Deleted unpublished preview'});
 const oldClaims=await claims(b),postRows=(await h.admin.query('select to_jsonb(p) as row from rise.squad_posts p where author_id=$1',[b.owner])).rows.map(r=>r.row),reactions=(await h.admin.query('select to_jsonb(r) as row from rise.squad_reactions r where user_id=$1',[b.owner])).rows.map(r=>r.row),previews=(await h.admin.query('select to_jsonb(p) as row from rise_private.squad_previews p where user_id=$1',[b.owner])).rows.map(r=>r.row);
 await command(b,{kind:'group.leave',groupId:id});const before=(await head(a,id)).revision;
 const request={accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'};
 assert.equal((await b.browser.request('account/deletion',request)).statusCode,200);
 const current=await feed(a,id);assert.equal(current.rows.length,1);assert.equal(current.rows[0].id,retained.id);assert.equal(current.rows[0].reactions.count,0);assert.ok(current.revision>before);
 for(const [table,column]of [['rise.squad_posts','author_id'],['rise.squad_reactions','user_id'],['rise_private.squad_previews','user_id']])assert.equal((await h.admin.query(`select count(*) from ${table} where ${column}=$1`,[b.owner])).rows[0].count,'0');
 assert.equal((await h.admin.query('select count(*) from auth.users where id=$1',[b.owner])).rows[0].count,'1'); // Provider has not purged yet.
 const sql=await h.store.pool.connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(oldClaims)]);assert.equal((await sql.query('select id from rise.squad_posts')).rowCount,0);}finally{await sql.query('rollback');sql.release();}
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{
  await assert.rejects(worker.pool.query('select rise_private.purge_group_identity($1)',[a.owner]),denied('42501'));
  // Replay pre-deletion rows while the retained ledger still suppresses access,
  // including a membership whose account identity was already scrubbed.
  for(const [table,rows]of [['rise.squad_posts',postRows],['rise.squad_reactions',reactions],['rise_private.squad_previews',previews]] as const)for(const row of rows)await h.admin.query(`insert into ${table} select * from jsonb_populate_record(null::${table},$1::jsonb)`,[JSON.stringify(row)]);
  await worker.pool.query('select rise_private.purge_group_identity($1)',[b.owner]);
  for(const [table,column]of [['rise.squad_posts','author_id'],['rise.squad_reactions','user_id'],['rise_private.squad_previews','user_id']])assert.equal((await h.admin.query(`select count(*) from ${table} where ${column}=$1`,[b.owner])).rows[0].count,'0');
  await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(b.owner);
 }finally{await worker.close();}
 assert.equal((await feed(a,id)).rows[0].id,retained.id);assert.equal((await b.browser.request(url({groupId:id,week:week()}))).statusCode,401);
});

test('failed suppression rolls back squad erasure and group deletion cascades all shared and preview rows',async()=>{
 const a=await actor(),b=await actor(),id=await squad(a);await join(a,b,id);const p=await post(b,id);await command(b,{kind:'squad.react',groupId:id,postId:p.id,encourage:true});await preview(b,id,{postId:p.id,postRevision:p.revision,note:'Recoverable preview'});const before=await feed(b,id);
 await h.admin.query(`create function rise_private.synthetic_squad_deletion_failure() returns trigger language plpgsql set search_path='' as $$begin if new.user_id='${b.owner}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_squad_deletion_failure before insert on rise_private.deletion_ledger for each row execute function rise_private.synthetic_squad_deletion_failure()`);
 try{assert.equal((await b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})).statusCode,503);assert.deepEqual(await feed(b,id),before);assert.equal((await h.admin.query('select count(*) from rise_private.squad_previews where user_id=$1',[b.owner])).rows[0].count,'1');}finally{await h.admin.query('drop trigger synthetic_squad_deletion_failure on rise_private.deletion_ledger;drop function rise_private.synthetic_squad_deletion_failure()');}
 await command(a,{kind:'group.delete',groupId:id});for(const table of ['rise.squad_posts','rise.squad_reactions','rise_private.squad_previews'])assert.equal((await h.admin.query(`select count(*) from ${table} where group_id=$1`,[id])).rows[0].count,'0');
});
