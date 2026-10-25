import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {authHarness,AuthBrowser} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {hash} from '../../server/auth/crypto.ts';
import {groupInvitationToken} from '../../server/groups/repository.ts';
import {lifecycleDatabase,accountPurger} from '../../server/lifecycle/worker.ts';
import type {AccountGroup,GroupCommand,GroupOperation,GroupReceipt} from '../../src/contracts/groups.ts';

let h:Awaited<ReturnType<typeof authHarness>>;
const subjects:string[]=[],groupIds:string[]=[];
before(async()=>{h=await authHarness();});
after(async()=>{
 if(h){try{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groupIds]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[subjects]);}finally{await h.close();}}
});
async function actor(){const c=new PersonalClient(h);await c.initialize();subjects.push(c.owner);return c;}
async function groups(c:PersonalClient):Promise<AccountGroup[]>{const r=await c.browser.request('groups');assert.equal(r.statusCode,200);assert.equal(r.json().accountId,c.owner);return r.json().groups;}
async function group(c:PersonalClient,id:string){const g=(await groups(c)).find(x=>x.id===id);assert.ok(g,'current_group_visible');return g;}
const operation=(c:PersonalClient,command:GroupCommand,expectedRevision=0):GroupOperation=>({accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command});
async function send(c:PersonalClient,op:GroupOperation,status=200){const r=await c.browser.request('groups/commands',op);assert.equal(r.statusCode,status,`group_status:${r.json().error?.code??'ok'}`);return r;}
async function command(c:PersonalClient,input:GroupCommand){const revision=input.kind==='group.create'||input.kind==='group.accept'?0:(await group(c,input.groupId)).revision;return (await send(c,operation(c,input,revision))).json<GroupReceipt>();}
async function create(c:PersonalClient,kind:'family'|'squad'='family'){
 const id=randomUUID();groupIds.push(id);await command(c,{kind:'group.create',groupId:id,groupKind:kind,name:'Synthetic shared group',timezone:'Asia/Tashkent',nickname:'Owner nickname'});return id;
}
async function invite(c:PersonalClient,id:string){const receipt=await command(c,{kind:'group.invite',groupId:id});assert.ok(receipt.invitation);return {receipt,token:new URL(receipt.invitation.link).hash.slice('#invite='.length)};}
async function join(c:PersonalClient,token:string,name='Shared nickname'){return command(c,{kind:'group.accept',token,nickname:name});}
async function claims(c:PersonalClient){const r=(await h.admin.query('select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(c.browser.cookies.get('rise_test_session')!)])).rows[0];return {sub:r.user_id,session_id:r.provider_session_id,user_metadata:{role:'owner'}};}
async function sqlAs<T>(c:PersonalClient,role:string,run:(sql:pg.PoolClient)=>Promise<T>){
 assert.ok(['rise_bff','authenticated','anon','rise_worker','rise_lifecycle'].includes(role));
 const state=JSON.parse(await readFile('.rise-infra/test/state.json','utf8'));
 const temporary=role==='rise_worker'||role==='rise_lifecycle'?new pg.Pool({...h.config.database,user:`${role}_login`,password:state.passwords[role.slice(5)],max:1}):null;
 const sql=await (temporary??(role==='rise_bff'?h.store.pool:h.admin)).connect();
 try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(await claims(c))]);if(role==='authenticated'||role==='anon')await sql.query(`set local role ${role}`);return await run(sql);}
 finally{await sql.query('rollback');sql.release();await temporary?.end();}
}
const failed=(code:string)=>(error:unknown)=>!!error&&typeof error==='object'&&'code' in error&&error.code===code;

test('groups require verified identity/CSRF, have no automatic private import and project only shared names',async()=>{
 const guest=new AuthBrowser(h);await guest.read();assert.equal((await guest.request('groups')).statusCode,401);
 const a=await actor(),b=await actor();assert.deepEqual(await groups(a),[]);
 const id=randomUUID();groupIds.push(id);const op=operation(a,{kind:'group.create',groupId:id,groupKind:'family',name:'Family name',timezone:'UTC',nickname:'Public nickname'});
 for(const headers of [{'x-rise-csrf':''},{origin:'https://foreign.invalid'}] as Record<string,string>[])assert.equal((await a.browser.request('groups/commands',op,headers)).statusCode,403);
 for(const extra of [{ownerId:b.owner},{role:'owner'},{prayers:[]}])assert.equal((await a.browser.request('groups/commands',{...op,command:{...op.command,...extra}})).statusCode,422);
 assert.equal((await send(a,{...op,accountId:b.owner},403)).json().error.code,'account_mismatch');
 const first=await send(a,op);assert.deepEqual((await send(a,op)).json(),first.json());
 const g=await group(a,id);assert.equal(g.members.length,1);assert.deepEqual(g.members.map(x=>[x.name,x.role,x.self]),[['Public nickname','owner',true]]);assert.deepEqual(await groups(b),[]);
 assert.equal(g.timezone,'UTC');assert.deepEqual(g.preferences,{muted:false,quietStart:'22:00',quietEnd:'07:00',notifications:false});
 assert.doesNotMatch(JSON.stringify(g),/example\.invalid|Synthetic account|owner_id|user_id|token|csrf|prayers/);
 assert.equal((await a.read()).xp,0);assert.equal((await a.read()).revision,1);
 assert.equal((await a.browser.request('groups')).headers['cache-control'],'no-store');
 assert.equal((await a.browser.request('groups/commands',{...op,command:{...op.command,name:'Changed'}})).json().error.code,'operation_reused');
});

test('receipt recovery is owner-bound, omits invitation secrets and rechecks current membership',async()=>{
 const a=await actor(),b=await actor(),id=await create(a),invited=await invite(a,id);
 const accepted=operation(b,{kind:'group.accept',token:invited.token,nickname:'Receipt recovery member'});
 const receipt=(await send(b,accepted)).json<GroupReceipt>(),request={accountId:b.owner,operationId:accepted.operationId};
 const read=await b.browser.request('groups/receipt',request);assert.equal(read.statusCode,200);assert.deepEqual(read.json(),receipt);assert.equal(read.headers['cache-control'],'no-store');
 assert.equal((await a.browser.request('groups/receipt',request)).statusCode,403);
 const missing=await b.browser.request('groups/receipt',{...request,operationId:randomUUID()});assert.equal(missing.statusCode,200);assert.equal(missing.json(),null);
 assert.equal((await b.browser.request('groups/receipt',{...request,token:invited.token})).statusCode,422);
 assert.equal((await b.browser.request('groups/receipt',request,{'x-rise-csrf':''})).statusCode,403);
 const invitationRead=await a.browser.request('groups/receipt',{accountId:a.owner,operationId:invited.receipt.operationId});assert.equal(invitationRead.statusCode,200);assert.equal(invitationRead.json().invitation,undefined);assert.doesNotMatch(invitationRead.body,new RegExp(invited.token));
 const member=(await group(a,id)).members.find(m=>!m.self)!;await command(a,{kind:'group.remove',groupId:id,memberId:member.id});
 assert.equal((await b.browser.request('groups/receipt',request)).statusCode,404);
});

test('invitation preview is minimal; concurrent acceptance is single use with exact retry and immediate revocation',async()=>{
 const a=await actor(),b=await actor(),c=await actor(),id=await create(a,'squad'),link=await invite(a,id);
 assert.match(link.token,/^[\w-]{43}$/);
 const stored=(await h.admin.query('select token_hash,expires_at-created_at as lifetime from rise.group_invitations where id=$1',[link.receipt.invitation!.id])).rows[0];
 assert.ok(stored.token_hash.equals(createHash('sha256').update(link.token).digest()));assert.equal(stored.lifetime.days,7);
 const preview=await b.browser.request('groups/invitations/preview',{accountId:b.owner,token:link.token});assert.equal(preview.statusCode,200);
 assert.deepEqual(Object.keys(preview.json()).sort(),['expiresAt','id','kind','name','timezone']);assert.deepEqual(await groups(b),[]);
 const bOp=operation(b,{kind:'group.accept',token:link.token,nickname:'Member B'}),cOp=operation(c,{kind:'group.accept',token:link.token,nickname:'Member C'});
 const results=await Promise.all([b.browser.request('groups/commands',bOp),c.browser.request('groups/commands',cOp)]);assert.deepEqual(results.map(x=>x.statusCode).sort(),[200,404]);
 const winner=results[0].statusCode===200?b:c,op=winner===b?bOp:cOp;
 assert.deepEqual((await send(winner,op)).json(),results[winner===b?0:1].json());assert.equal((await group(a,id)).members.length,2);
 const oldUnused=await invite(a,id),member=(await group(a,id)).members.find(m=>!m.self)!;
 await command(a,{kind:'group.remove',groupId:id,memberId:member.id});assert.deepEqual(await groups(winner),[]);
 assert.equal((await send(winner,op,404)).json().error.code,'group_unavailable');
 assert.equal((await send(winner,operation(winner,{kind:'group.accept',token:oldUnused.token,nickname:'Rejoin'}),404)).json().error.code,'invitation_unavailable');
 const fresh=await invite(a,id);await join(winner,fresh.token);assert.equal((await group(a,id)).members.length,2);
 const revoked=await invite(a,id);await command(a,{kind:'group.revoke',groupId:id,invitationId:revoked.receipt.invitation!.id});
 assert.equal((await (winner===b?c:b).browser.request('groups/invitations/preview',{accountId:(winner===b?c:b).owner,token:revoked.token})).statusCode,404);
 const expired=await invite(a,id);await h.admin.query("update rise.group_invitations set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",[expired.receipt.invitation!.id]);
 assert.equal((await b.browser.request('groups/invitations/preview',{accountId:b.owner,token:expired.token})).statusCode,404);
 assert.doesNotMatch(JSON.stringify(h.logs),new RegExp(link.token));
});

test('ownership transfer is recent-auth, atomic and current; archive, leave and deletion cannot orphan an owner',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);await join(b,(await invite(a,id)).token);
 const member=(await group(a,id)).members.find(m=>!m.self)!,oldInvite=await invite(a,id);
 await h.admin.query("update rise_private.server_sessions set authenticated_at=now()-interval '11 minutes' where user_id=$1",[a.owner]);
 const transfer=operation(a,{kind:'group.transfer',groupId:id,memberId:member.id},(await group(a,id)).revision);
 assert.equal((await send(a,transfer,403)).json().error.code,'recent_auth_required');
 await h.admin.query('update rise_private.server_sessions set authenticated_at=now() where user_id=$1',[a.owner]);
 await send(a,transfer);assert.equal((await group(b,id)).members.find(m=>m.self)!.role,'owner');assert.equal((await group(a,id)).members.find(m=>m.self)!.role,'member');
 assert.equal((await a.browser.request('groups/invitations/preview',{accountId:a.owner,token:oldInvite.token})).statusCode,404);
 assert.equal((await send(a,operation(a,{kind:'group.rename',groupId:id,name:'Not allowed'},(await group(a,id)).revision),403)).json().error.code,'owner_required');
 assert.equal((await send(b,operation(b,{kind:'group.leave',groupId:id},(await group(b,id)).revision),409)).json().error.code,'ownership_resolution_required');
 await command(b,{kind:'group.archive',groupId:id});
 assert.equal((await send(b,operation(b,{kind:'group.rename',groupId:id,name:'Read only'},(await group(b,id)).revision),409)).json().error.code,'group_archived');
 await command(a,{kind:'group.preferences',groupId:id,muted:true,quietStart:'21:00',quietEnd:'08:00'});
 assert.equal((await group(a,id)).preferences.muted,true);assert.equal((await group(b,id)).preferences.muted,false);
 const leave=operation(a,{kind:'group.leave',groupId:id},(await group(a,id)).revision);const left=await send(a,leave);assert.deepEqual((await send(a,leave)).json(),left.json());assert.deepEqual(await groups(a),[]);
 await command(b,{kind:'group.restore',groupId:id});assert.equal((await group(b,id)).archived,false);
 const del=operation(b,{kind:'group.delete',groupId:id},(await group(b,id)).revision);await send(b,del);await send(b,del);assert.deepEqual(await groups(b),[]);
 assert.equal((await h.admin.query('select count(*) from rise.memberships where group_id=$1',[id])).rows[0].count,'0');
});

test('all group tables force RLS and narrow grants; forged roles, cross-group member IDs and direct writes fail',async()=>{
 const a=await actor(),b=await actor(),stranger=await actor(),id=await create(a),other=await create(stranger);await join(b,(await invite(a,id)).token);
 for(const role of ['rise_bff','authenticated']){
  await sqlAs(stranger,role,async sql=>{for(const t of ['groups','memberships','group_preferences'])assert.equal((await sql.query(`select ${t==='groups'?'id':'group_id'} from rise.${t} where ${t==='groups'?'id':'group_id'}=$1`,[id])).rowCount,0);});
  await sqlAs(a,role,async sql=>{assert.equal((await sql.query('select id from rise.groups where id=$1',[id])).rowCount,1);assert.equal((await sql.query('select user_id from rise.group_preferences where group_id=$1',[id])).rowCount,1);});
  for(const statement of ["update rise.groups set archived=true where id=$1","delete from rise.memberships where group_id=$1","update rise.group_preferences set muted=true where group_id=$1"]){await sqlAs(a,role,async sql=>{await assert.rejects(sql.query(statement,[id]),failed('42501'));});}
 }
 for(const role of ['anon','rise_worker','rise_lifecycle'])await sqlAs(a,role,async sql=>{await assert.rejects(sql.query('select * from rise.groups'),failed('42501'));});
 await sqlAs(a,'rise_bff',async sql=>{await assert.rejects(sql.query('select token_hash from rise.group_invitations'),failed('42501'));});
 await sqlAs(a,'rise_bff',async sql=>{await assert.rejects(sql.query('set local role rise_group_guard'),failed('42501'));});
 for(const kind of ['group.transfer','group.remove'] as const){const memberId=(await group(stranger,other)).members[0].id;assert.equal((await send(a,operation(a,{kind,groupId:id,memberId},(await group(a,id)).revision),404)).json().error.code,'member_unavailable');}
 const flags=(await h.admin.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in('rise.groups'::regclass,'rise.memberships'::regclass,'rise.group_preferences'::regclass,'rise.group_invitations'::regclass,'rise.group_receipts'::regclass)")).rows;
 assert.equal(flags.length,5);assert.ok(flags.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 await sqlAs(a,'rise_bff',async sql=>{assert.equal((await sql.query('delete from rise.group_receipts where user_id=$1',[a.owner])).rowCount,0);});
 const sql=await h.admin.connect();try{await sql.query('begin');await sql.query("update rise.memberships set status='left' where group_id=$1 and user_id=$2",[id,a.owner]);await assert.rejects(sql.query('set constraints all immediate'),failed('23503'));}finally{await sql.query('rollback');sql.release();}
 const memberClaims=await claims(b);await command(a,{kind:'group.remove',groupId:id,memberId:(await group(a,id)).members.find(x=>!x.self)!.id});
 const direct=await h.store.pool.connect();try{await direct.query('begin');await direct.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(memberClaims)]);assert.equal((await direct.query('select id from rise.groups where id=$1',[id])).rowCount,0);}finally{await direct.query('rollback');direct.release();}
});

test('concurrent edits preserve a conflict; a receipt insertion failure rolls back every group change',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);await join(b,(await invite(a,id)).token);
 const revision=(await group(a,id)).revision,rename=operation(a,{kind:'group.rename',groupId:id,name:'Renamed'},revision),prefs=operation(b,{kind:'group.preferences',groupId:id,muted:true,quietStart:'23:00',quietEnd:'06:00'},revision);
 const outcomes=await Promise.all([a.browser.request('groups/commands',rename),b.browser.request('groups/commands',prefs)]);assert.deepEqual(outcomes.map(x=>x.statusCode).sort(),[200,409]);assert.equal(outcomes.find(x=>x.statusCode===409)!.json().error.code,'group_changed');
 const before=await group(a,id),op=operation(a,{kind:'group.rename',groupId:id,name:'Must roll back'},before.revision);
 await h.admin.query(`create function rise_private.synthetic_group_receipt_failure() returns trigger language plpgsql set search_path='' as $$begin if new.id='${op.operationId}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_group_receipt_failure before insert on rise.group_receipts for each row execute function rise_private.synthetic_group_receipt_failure()`);
 try{await send(a,op,503);assert.deepEqual(await group(a,id),before);}finally{await h.admin.query('drop trigger synthetic_group_receipt_failure on rise.group_receipts;drop function rise_private.synthetic_group_receipt_failure()');}
 await send(a,op);assert.equal((await group(a,id)).name,'Must roll back');
});

test('invalid invitation attempts consume a bounded quota; stale operations and rotated invite keys do not recreate intent',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);
 await h.admin.query('update rise_private.group_limits set lookups_per_hour=2');
 try{for(let i=0;i<2;i++)assert.equal((await b.browser.request('groups/invitations/preview',{accountId:b.owner,token:'a'.repeat(43)})).statusCode,404);
  const limited=await b.browser.request('groups/commands',operation(b,{kind:'group.accept',token:'b'.repeat(43),nickname:'No access'}));assert.equal(limited.statusCode,429);
  assert.equal((await h.admin.query("select count(*) from rise_private.group_attempts where user_id=$1 and kind='lookup'",[b.owner])).rows[0].count,'2');
 }finally{await h.admin.query('update rise_private.group_limits set lookups_per_hour=60');}
 const op=operation(a,{kind:'group.invite',groupId:id},(await group(a,id)).revision);const first=(await send(a,op)).json<GroupReceipt>();
 assert.deepEqual((await send(a,op)).json(),first);
 assert.notEqual(groupInvitationToken({...h.config,sessionKey:Buffer.alloc(32,1)},a.owner,op.operationId,id),new URL(first.invitation!.link).hash.slice(8));
 const old=operation(a,{kind:'group.create',groupId:randomUUID(),groupKind:'family',name:'Stale',timezone:'UTC',nickname:'Stale'});old.issuedAt=Date.now()-8*86400000;
 assert.equal((await send(a,old,409)).json().error.code,'operation_expired');assert.equal((await groups(a)).length,1);
});

test('account deletion blocks current owners and deidentifies a member before suppression; old JWTs and provider purge stay safe',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);await join(b,(await invite(a,id)).token);
 const deletion=(c:PersonalClient)=>({accountId:c.owner,requestId:randomUUID(),revision:c.revision,confirm:'delete-account'});
 assert.equal((await a.browser.request('account/deletion',deletion(a))).json().error.code,'ownership_resolution_required');
 assert.equal((await a.browser.read()).json().signedIn,true);
 const priorClaims=await claims(b),memberId=(await group(b,id)).members.find(x=>x.self)!.id;
 assert.equal((await b.browser.request('account/deletion',deletion(b))).statusCode,200);
 assert.deepEqual((await group(a,id)).members.map(x=>x.role),['owner']);
 const retained=(await h.admin.query('select user_id,display_name,status from rise.memberships where id=$1',[memberId])).rows[0];assert.deepEqual(retained,{user_id:null,display_name:null,status:'deleted'});
 const sql=await h.store.pool.connect();try{await sql.query('begin');await sql.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(priorClaims)]);assert.equal((await sql.query('select id from rise.groups where id=$1',[id])).rowCount,0);assert.equal((await sql.query('select rise_private.active_session() as active')).rows[0].active,false);}finally{await sql.query('rollback');sql.release();}
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{await worker.verify();await worker.pool.query('select rise_private.purge_group_identity($1)',[b.owner]);await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(b.owner);}finally{await worker.close();}
 assert.equal((await h.admin.query('select count(*) from auth.users where id=$1',[b.owner])).rows[0].count,'0');assert.equal((await group(a,id)).members.length,1);
});

test('bounded invitation pruning retains live links and never grants the sender membership authority',async()=>{
 const a=await actor(),id=await create(a),old=await invite(a,id),live=await invite(a,id);
 await h.admin.query("update rise.group_invitations set created_at=now()-interval '16 days',expires_at=now()-interval '9 days' where id=$1",[old.receipt.invitation!.id]);
 const s=JSON.parse(await readFile('.rise-infra/test/state.json','utf8')),worker=new pg.Client({...h.config.database,user:'rise_worker_login',password:s.passwords.worker});await worker.connect();
 try{await assert.rejects(worker.query('select * from rise.group_invitations'),failed('42501'));await assert.rejects(worker.query('select rise_private.prune_group_invitations(501)'),failed('22023'));
  assert.equal((await worker.query('select rise_private.prune_group_invitations(1) as count')).rows[0].count,1);
 }finally{await worker.end();}
 assert.equal((await h.admin.query('select count(*) from rise.group_invitations where id=$1',[old.receipt.invitation!.id])).rows[0].count,'0');
 assert.equal((await a.browser.request('groups/invitations/preview',{accountId:a.owner,token:live.token})).statusCode,200);
});

test('invite consumption and account identity scrubbing roll back when the following receipt or suppression write fails',async()=>{
 const a=await actor(),b=await actor(),id=await create(a),link=await invite(a,id),accept=operation(b,{kind:'group.accept',token:link.token,nickname:'Recoverable shared name'});
 await h.admin.query(`create function rise_private.synthetic_group_receipt_failure() returns trigger language plpgsql set search_path='' as $$begin if new.id='${accept.operationId}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_group_receipt_failure before insert on rise.group_receipts for each row execute function rise_private.synthetic_group_receipt_failure()`);
 try{await send(b,accept,503);assert.deepEqual(await groups(b),[]);assert.equal((await h.admin.query('select consumed_at from rise.group_invitations where id=$1',[link.receipt.invitation!.id])).rows[0].consumed_at,null);}
 finally{await h.admin.query('drop trigger synthetic_group_receipt_failure on rise.group_receipts;drop function rise_private.synthetic_group_receipt_failure()');}
 await send(b,accept);const before=await group(b,id);
 await h.admin.query(`create function rise_private.synthetic_group_deletion_failure() returns trigger language plpgsql set search_path='' as $$begin if new.user_id='${b.owner}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_group_deletion_failure before insert on rise_private.deletion_ledger for each row execute function rise_private.synthetic_group_deletion_failure()`);
 try{assert.equal((await b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})).statusCode,503);assert.deepEqual(await group(b,id),before);}
 finally{await h.admin.query('drop trigger synthetic_group_deletion_failure on rise_private.deletion_ledger;drop function rise_private.synthetic_group_deletion_failure()');}
});

test('ownership transfer racing recipient deletion never creates an orphan or grants a suppressed identity access',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);await join(b,(await invite(a,id)).token);
 const current=await group(a,id),transfer=operation(a,{kind:'group.transfer',groupId:id,memberId:current.members.find(m=>!m.self)!.id},current.revision);
 const [t,d]=await Promise.all([a.browser.request('groups/commands',transfer),b.browser.request('account/deletion',{accountId:b.owner,requestId:randomUUID(),revision:b.revision,confirm:'delete-account'})]);
 if(t.statusCode===200){assert.equal(d.statusCode,409);assert.equal(d.json().error.code,'ownership_resolution_required');assert.equal((await group(b,id)).members.find(m=>m.self)!.role,'owner');}
 else{assert.equal(d.statusCode,200);assert.ok([404,409].includes(t.statusCode));assert.equal((await b.browser.request('groups')).statusCode,401);}
 assert.equal((await h.admin.query("select count(*) from rise.groups g join rise.memberships m on m.group_id=g.id and m.user_id=g.owner_id and m.status='active' where g.id=$1",[id])).rows[0].count,'1');
});

test('terminal backup replay removes restored pre-transfer ownership only for a suppressed identity',async()=>{
 const a=await actor(),b=await actor(),id=await create(a);await join(b,(await invite(a,id)).token);
 const oldMember=(await h.admin.query('select id,display_name from rise.memberships where group_id=$1 and user_id=$2',[id,a.owner])).rows[0];
 await command(a,{kind:'group.transfer',groupId:id,memberId:(await group(a,id)).members.find(m=>!m.self)!.id});
 assert.equal((await a.browser.request('account/deletion',{accountId:a.owner,requestId:randomUUID(),revision:a.revision,confirm:'delete-account'})).statusCode,200);
 const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
 try{
  await assert.rejects(worker.pool.query('select rise_private.purge_group_identity($1)',[b.owner]),failed('42501'));
  const sql=await h.admin.connect();try{await sql.query('begin');await sql.query("update rise.memberships set user_id=$1,display_name=$2,status='active',departed_at=null where id=$3",[a.owner,oldMember.display_name,oldMember.id]);await sql.query('update rise.groups set owner_id=$1 where id=$2',[a.owner,id]);await sql.query('commit');}catch(error){await sql.query('rollback');throw error;}finally{sql.release();}
  // Represents an offline backup restore; no restored identity is served before
  // the retained authoritative deletion ledger's terminal cleanup finishes.
  await worker.pool.query('select rise_private.purge_group_identity($1)',[a.owner]);
  await accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!)(a.owner);
  assert.equal((await h.admin.query('select count(*) from rise.groups where id=$1',[id])).rows[0].count,'0');assert.deepEqual(await groups(b),[]);
 }finally{await worker.close();}
 await sqlAs(b,'rise_bff',async sql=>{await assert.rejects(sql.query('select rise_private.purge_group_identity($1)',[b.owner]),failed('42501'));});
});
