import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {parseGroups,type AccountGroup,type GroupCommand,type GroupOperation,type GroupReceipt} from '../../src/contracts/groups.ts';
import {parseGroupInvitationPage} from '../../src/contracts/groupInvitations.ts';
import {hash} from '../../server/auth/crypto.ts';
let h:Awaited<ReturnType<typeof authHarness>>,worker:pg.Pool;
const subjects:string[]=[],ids:string[]=[];
before(async()=>{h=await authHarness();const env=parseEnv(await readFile('.rise-infra/test/push.env','utf8')),url=new URL(env.DATABASE_WORKER_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55422');assert.equal(url.username,'rise_worker_login');worker=new pg.Pool({connectionString:url.href,max:1});});
after(async()=>{try{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[ids]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await worker?.end();await h?.close();}});
async function actor(){const a=new PersonalClient(h);await a.initialize();subjects.push(a.owner);return a;}
async function groups(a:PersonalClient){const r=await a.browser.request('groups');assert.equal(r.statusCode,200);return parseGroups(r.json()).groups;}
async function group(a:PersonalClient,id:string):Promise<AccountGroup>{const result=(await groups(a)).find(g=>g.id===id);assert.ok(result);return result;}
function operation(a:PersonalClient,command:GroupCommand,expectedRevision:number):GroupOperation{return {accountId:a.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command};}
async function command(a:PersonalClient,input:GroupCommand){const revision=input.kind==='group.create'||input.kind==='group.accept'?0:(await group(a,input.groupId)).revision;const response=await a.browser.request('groups/commands',operation(a,input,revision));assert.equal(response.statusCode,200,response.json().error?.code);return response.json<GroupReceipt>();}
async function create(a:PersonalClient){const id=randomUUID();ids.push(id);await command(a,{kind:'group.create',groupId:id,groupKind:'family',name:'Synthetic paged invitations',timezone:'UTC',nickname:'Owner'});return id;}
async function claims(a:PersonalClient){const r=(await h.admin.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(a.browser.cookies.get('rise_test_session')!)])).rows[0];return {sub:r.user_id,session_id:r.provider_session_id,user_metadata:{role:'owner'}};}
async function directInvitations(id:string,identity:object){const c=await h.store.pool.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(identity)]);return(await c.query('select id from rise.group_invitations where group_id=$1',[id])).rows;}finally{await c.query('rollback');c.release();}}

test('maximum retained invitation history remains owner-only and paged while cleanup is stopped',async()=>{
 const owner=await actor(),member=await actor(),other=await actor(),id=await create(owner),invite=await command(owner,{kind:'group.invite',groupId:id});assert.ok(invite.invitation);
 await command(member,{kind:'group.accept',token:new URL(invite.invitation.link).hash.slice(8),nickname:'Member'});
 const limits=(await h.admin.query('select invitations_per_group,invites_per_hour from rise_private.group_limits')).rows[0];
 try{
  await h.admin.query('update rise_private.group_limits set invitations_per_group=100000,invites_per_hour=100');
  // Reconstruct only this synthetic group's historical metadata. No token is
  // usable, and no retention worker is run while exercising the full bound.
  await h.admin.query(`insert into rise.group_invitations(id,group_id,created_by,token_hash,created_at,expires_at)
   select gen_random_uuid(),$1::uuid,$2::uuid,sha256(convert_to($1::uuid::text||':'||n::text,'UTF8')),
   '2000-01-01T00:00:00Z'::timestamptz+n*interval '1 millisecond','2000-01-08T00:00:00Z'::timestamptz+n*interval '1 millisecond' from generate_series(1,99999) n`,[id,owner.owner]);
  const first=await group(owner,id);assert.equal(first.invitations.length,20);assert.equal(first.invitationNext,first.invitations.at(-1)!.id);assert.ok(JSON.stringify(first).length<10000);
  const path=`groups/${id}/invitations?revision=${first.revision}&cursor=${first.invitationNext}`;
  const response=await owner.browser.request(path);assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'no-store');const second=parseGroupInvitationPage(response.json());assert.equal(second.rows.length,20);assert.ok(second.rows.every(row=>!first.invitations.some(old=>old.id===row.id)));assert.ok(second.next);
  assert.doesNotMatch(response.body,/token|created_by|consumed_by|user_id|email/);
  assert.deepEqual((await group(member,id)).invitations,[]);assert.equal((await member.browser.request(path)).statusCode,404);assert.equal((await other.browser.request(path)).statusCode,404);
  assert.equal((await owner.browser.request(`groups/${id}/invitations?cursor=${first.invitationNext}`)).statusCode,422);
  assert.equal((await owner.browser.request(`groups/${id}/invitations?revision=${first.revision}&cursor=${randomUUID()}`)).statusCode,409);
  assert.equal((await owner.browser.request(`groups/${id}/invitations?owner=${owner.owner}`)).statusCode,422);
  const pending=operation(owner,{kind:'group.invite',groupId:id},first.revision),full=await owner.browser.request('groups/commands',pending);assert.equal(full.statusCode,409);assert.equal(full.json().error.code,'invitation_limit');assert.equal((await group(owner,id)).revision,first.revision);
  assert.equal((await h.admin.query('select count(*)::int as n from rise.group_receipts where user_id=$1 and id=$2',[owner.owner,pending.operationId])).rows[0].n,0);
  const anchor=(await h.admin.query('select id from rise.group_invitations where group_id=$1 order by expires_at,id limit 1',[id])).rows[0].id;
  const pruned=await worker.query('select rise_private.prune_group_invitations(500) as n');assert.equal(pruned.rows[0].n,500);
  assert.equal((await owner.browser.request(`groups/${id}/invitations?revision=${first.revision}&cursor=${anchor}`)).statusCode,409);
  assert.equal((await owner.browser.request('groups/commands',pending)).statusCode,200);assert.equal((await owner.browser.request(path)).statusCode,409);
  const current=await group(owner,id);await command(owner,{kind:'group.transfer',groupId:id,memberId:current.members.find(m=>!m.self)!.id});assert.equal((await owner.browser.request(`groups/${id}/invitations`)).statusCode,404);assert.equal((await member.browser.request(`groups/${id}/invitations`)).statusCode,200);
 }finally{await h.admin.query('update rise_private.group_limits set invitations_per_group=$1,invites_per_hour=$2',[limits.invitations_per_group,limits.invites_per_hour]);}
});

test('maximum invitation frequency rejects the next new action while an exact accepted retry remains replayable',async()=>{
 const owner=await actor(),id=await create(owner),limits=(await h.admin.query('select invitations_per_group,invites_per_hour from rise_private.group_limits')).rows[0];
 try{await h.admin.query('update rise_private.group_limits set invitations_per_group=100000,invites_per_hour=100');let accepted:GroupOperation|undefined,response:unknown;
  for(let i=0;i<100;i++){accepted=operation(owner,{kind:'group.invite',groupId:id},(await group(owner,id)).revision);const result=await owner.browser.request('groups/commands',accepted);assert.equal(result.statusCode,200);response=result.json();}
  const head=await group(owner,id),limited=await owner.browser.request('groups/commands',operation(owner,{kind:'group.invite',groupId:id},head.revision));assert.equal(limited.statusCode,429);assert.equal(limited.json().error.code,'rate_limited');assert.equal((await group(owner,id)).revision,head.revision);
  const replay=await owner.browser.request('groups/commands',accepted!);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),response);assert.equal((await h.admin.query('select count(*)::int as n from rise.group_invitations where group_id=$1',[id])).rows[0].n,100);
 }finally{await h.admin.query('update rise_private.group_limits set invitations_per_group=$1,invites_per_hour=$2',[limits.invitations_per_group,limits.invites_per_hour]);}
});

test('invitation owner-set policy rechecks current membership and active sessions even with forged metadata',async()=>{
 const owner=await actor(),member=await actor(),other=await actor(),id=await create(owner),invite=await command(owner,{kind:'group.invite',groupId:id});assert.ok(invite.invitation);
 await command(member,{kind:'group.accept',token:new URL(invite.invitation.link).hash.slice(8),nickname:'Member'});
 const oldClaims=await claims(owner),memberClaims=await claims(member);
 assert.equal((await directInvitations(id,oldClaims)).length,1);assert.deepEqual(await directInvitations(id,memberClaims),[]);assert.deepEqual(await directInvitations(id,await claims(other)),[]);assert.deepEqual(await directInvitations(id,{}),[]);
 const current=await group(owner,id);await command(owner,{kind:'group.transfer',groupId:id,memberId:current.members.find(m=>!m.self)!.id});
 assert.deepEqual(await directInvitations(id,oldClaims),[]);assert.equal((await directInvitations(id,memberClaims)).length,1);
 const owned=await group(member,id);await command(member,{kind:'group.remove',groupId:id,memberId:owned.members.find(m=>!m.self)!.id});assert.deepEqual(await directInvitations(id,oldClaims),[]);
 assert.equal((await member.browser.request('logout',{})).statusCode,200);assert.deepEqual(await directInvitations(id,memberClaims),[]);
});
