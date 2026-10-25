import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {unlink,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {authHarness} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {emptyDraft,localDate} from '../../src/model.ts';
import {createBackup,recoverySource,restoreDrill,sql} from '../../scripts/infra/recovery/database.ts';
import {maintainRecords} from '../../scripts/infra/recovery/maintenance.ts';
import type {GroupCommand,GroupReceipt,AccountGroup} from '../../src/contracts/groups.ts';
import {hash} from '../../server/auth/crypto.ts';

test('encrypted real database restore preserves personal/shared records, replays suppression and revocations with no network or push',async t=>{
 const h=await authHarness(),source=await recoverySource('test');
 const a=new PersonalClient(h),b=new PersonalClient(h),deleted=new PersonalClient(h),groups:string[]=[];let backupName:string|undefined;
 t.after(async()=>{await h.admin.query('delete from rise.groups where id=any($1::uuid[])',[groups]);await h.admin.query('delete from auth.users where id=any($1::uuid[])',[[a.owner,b.owner,deleted.owner].filter(Boolean)]);if(backupName)await unlink(resolve(source.directory,backupName));await h.close();await source.pool.end();});
 await a.initialize();await b.initialize();await deleted.initialize();
 const habit=randomUUID();await a.command({kind:'habit.save',newId:habit,draft:{...emptyDraft(),name:'OPS02 synthetic habit',days:[0,1,2,3,4,5,6]}});await a.command({kind:'habit.check',habitId:habit,date:localDate('UTC'),check:'full'});
 const before=await a.read();
 async function head(c:PersonalClient,id:string){return (await c.browser.request('groups')).json<{groups:AccountGroup[]}>().groups.find(g=>g.id===id)!;}
 async function command(c:PersonalClient,input:GroupCommand){const expectedRevision=['group.create','group.accept'].includes(input.kind)?0:(await head(c,'groupId'in input?input.groupId:'')).revision;
 const r=await c.browser.request('groups/commands',{accountId:c.owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision,command:input});assert.equal(r.statusCode,200);return r.json<GroupReceipt>();}
 async function create(){const id=randomUUID();groups.push(id);await command(a,{kind:'group.create',groupId:id,groupKind:'family',name:'OPS02 synthetic group',timezone:'UTC',nickname:'Owner'});return id;}
 const stable=await create(),changed=await create();const task=randomUUID();await command(a,{kind:'task.create',groupId:stable,taskId:task,title:'Preserved shared task',notes:'',assignee:null,date:localDate('UTC'),time:null,weekdays:[]});
 const invite=await command(a,{kind:'group.invite',groupId:changed});await command(b,{kind:'group.accept',token:new URL(invite.invitation!.link).hash.slice(8),nickname:'Member'});
 const member=(await head(b,changed)).members.find(m=>m.self)!.id;
 const session=(await h.admin.query('select provider_session_id from rise_private.server_sessions where id_hash=$1',[hash(a.browser.cookies.get('rise_test_session')!)])).rows[0].provider_session_id;
 const installation=randomUUID();await h.admin.query("insert into rise.push_subscriptions(id,user_id,installation_hash,provider_session_id,language,enabled,subscription_cipher,endpoint_hash) values($1,$2,$3,$4,'en',true,$5,$6)",[installation,a.owner,randomBytes(32),session,'synthetic-not-a-real-endpoint-0000000',randomBytes(32)]);
 const backup=await createBackup(source);backupName=backup.name;
 await command(a,{kind:'group.remove',groupId:changed,memberId:member});
 const deletion=await deleted.browser.request('account/deletion',{accountId:deleted.owner,requestId:randomUUID(),revision:deleted.revision,confirm:'delete-account'});assert.equal(deletion.statusCode,200);
 const result=await restoreDrill(source,backup.name,async container=>{
  // Old JWT/session and removed group have no access; unchanged data survives.
  const denied=await sql(container,`begin;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${a.owner}","session_id":"${session}"}',true);select rise_private.active_session();rollback;`);assert.match(denied,/\nf\n/);
  const counts=await sql(container,`select count(*) from auth.users where id='${deleted.owner}';select count(*) from rise.groups where id='${changed}';select count(*) from rise.family_tasks where id='${task}';select count(*) from rise.habit_occurrences where owner_id='${a.owner}';`);assert.deepEqual(counts.trim().split('\n'),['0','0','1','1']);
  const fresh=randomUUID();await sql(container,`insert into auth.sessions(id,user_id,created_at,updated_at) values('${fresh}','${a.owner}',now(),now());update rise_private.server_sessions set provider_session_id='${fresh}',provider_cipher='synthetic',revoked_at=null,idle_expires_at=now()+interval '1 hour',absolute_expires_at=now()+interval '1 hour' where user_id='${a.owner}' and provider_session_id='${session}';`);
  const allowed=await sql(container,`begin;set local role rise_bff;select set_config('request.jwt.claims','{"sub":"${a.owner}","session_id":"${fresh}"}',true);select rise_private.active_session();select count(*) from rise.profiles;select count(*) from rise.family_tasks where group_id='${stable}';select xp from rise.personal_totals where owner_id='${a.owner}';rollback;`);assert.match(allowed,/\nt\n1\n1\n20\n/);
  const otherFresh=randomUUID();await sql(container,`insert into auth.sessions(id,user_id,created_at,updated_at) values('${otherFresh}','${b.owner}',now(),now());update rise_private.server_sessions set provider_session_id='${otherFresh}',provider_cipher='synthetic',revoked_at=null,idle_expires_at=now()+interval '1 hour',absolute_expires_at=now()+interval '1 hour' where user_id='${b.owner}';`);
  const unrelated=await sql(container,`begin;set local role rise_bff;select set_config('request.jwt.claims','{"sub":"${b.owner}","session_id":"${otherFresh}"}',true);select rise_private.active_session();select count(*) from rise.profiles where owner_id='${a.owner}';select count(*) from rise.profiles;select count(*) from rise.family_tasks;rollback;`);assert.match(unrelated,/\nt\n0\n1\n0\n/);
 });
 assert.equal(result.pushDisabled,true);assert.equal(result.networkDisabled,true);assert.equal(result.accessReopened,false);assert.ok(result.quarantinedGroups>=1);assert.ok(result.recoveryPointAgeMs<86400000);assert.ok(result.recoveryDurationMs<4*3600000);
 assert.deepEqual((await a.read()).records,before.records);assert.equal((await h.admin.query('select enabled from rise.push_subscriptions where id=$1',[installation])).rows[0].enabled,true);
 await assert.rejects(restoreDrill(source,backup.name,async()=>{await command(a,{kind:'group.rename',groupId:stable,name:'Synthetic change during restore'});}),/recovery_authority_changed_retry_required/);
 // A rerun must not overwrite the dated evidence for a previous release.
 const dir=resolve('test-results/infra');await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'backup-drill.json'),JSON.stringify(result,null,2)+'\n');
});

test('scheduled local retention shares sync floors and leaves recent personal records intact',async t=>{
 const h=await authHarness(),source=await recoverySource('test');const a=new PersonalClient(h);t.after(async()=>{if(a.owner)await h.admin.query('delete from auth.users where id=$1',[a.owner]);await source.pool.end();await h.close();});await a.initialize();
 await a.command({kind:'profile.name',name:'Retained synthetic name'});const before=await a.read();
 await h.admin.query("update rise.personal_receipts set created_at=now()-interval '91 days' where owner_id=$1 and revision=1",[a.owner]);
 const result=await maintainRecords(source);assert.ok(result.owners>=1);assert.deepEqual((await a.read()).records,before.records);
 assert.equal(Number((await h.admin.query('select floor_revision from rise.sync_state where owner_id=$1',[a.owner])).rows[0].floor_revision),1);
 assert.equal((await h.admin.query('select count(*) from rise.personal_receipts where owner_id=$1',[a.owner])).rows[0].count,'1');
});
