import { before,after,test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { AuthBrowser,authHarness,localCode } from "../support/auth.ts";
import { PersonalClient } from "../support/personal.ts";
import { hash,secrets } from "../../server/auth/crypto.ts";
import { lifecycleDatabase,purgeAccounts,accountPurger } from "../../server/lifecycle/worker.ts";
import { parseAccountExport } from "../../src/account/export.ts";
import { emptyDraft,localDate } from "../../src/model.ts";
let h:Awaited<ReturnType<typeof authHarness>>,worker:ReturnType<typeof lifecycleDatabase>,purger:(subject:string)=>Promise<void>;
before(async()=>{h=await authHarness();const e=parseEnv(await readFile(".rise-infra/test/lifecycle.env","utf8"));worker=lifecycleDatabase({environment:"test",installationId:e.INSTALLATION_ID!,databaseUrl:e.DATABASE_LIFECYCLE_URL!});await worker.verify();purger=accountPurger("test",e.SUPABASE_URL!,e.SUPABASE_SECRET_KEY!);});
after(async()=>{await worker?.close();await h?.close();});
const deletion=(c:PersonalClient,overrides:object={})=>({accountId:c.owner,requestId:randomUUID(),revision:c.revision,confirm:"delete-account",...overrides});
async function permitSyntheticResend(email:string){assert.match(email,/^auth-[a-f0-9-]+@example\.invalid$/);await h.admin.query("delete from rise_private.auth_limits where subject_hash=$1",[secrets(h.config.sessionKey,h.config.installationId).rate(`send-email:${email}`)]);await new Promise(resolve=>setTimeout(resolve,1100));}
async function active(owner:string,session:string){const client=await h.admin.connect();try{await client.query("begin");await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner,session_id:session})]);await client.query("set local role authenticated");return (await client.query("select rise_private.active_session() as active")).rows[0].active;}finally{await client.query("rollback");client.release();}}
async function sessionRow(c:PersonalClient){return (await h.admin.query("select * from rise_private.server_sessions where id_hash=$1",[hash(c.browser.cookies.get("rise_test_session")!)])).rows[0];}
test("recent-auth export retains current and retired records, dates and derived XP",async()=>{
 const c=new PersonalClient(h);await c.initialize();const id=randomUUID(),goalId=randomUUID(),milestoneId=randomUUID();
 await c.command({kind:"habit.save",newId:id,draft:{...emptyDraft(),name:"Synthetic private habit",days:[0,1,2,3,4,5,6]}});await c.command({kind:"habit.check",habitId:id,date:localDate("UTC"),check:"full"});
 await c.command({kind:"goal.save",newId:goalId,draft:{title:"Synthetic goal",reason:"",targetDate:"",habitIds:[id],milestones:[{id:milestoneId,title:"Retired history"}]}});
 await c.command({kind:"goal.save",newId:randomUUID(),draft:{id:goalId,title:"Synthetic goal",reason:"",targetDate:"",habitIds:[id],milestones:[{id:randomUUID(),title:"Current"}]}});
 const before=await c.read(),result=await c.browser.request("account/export",{accountId:c.owner});assert.equal(result.statusCode,200);assert.equal(result.headers["cache-control"],"no-store");
 const parsed=await parseAccountExport(result.body);assert.equal(parsed.xp,20);assert.deepEqual(parsed.records,before.records);assert.ok(parsed.records.goal_milestones.some(r=>r.id===milestoneId&&r.retired));assert.equal((await c.read()).revision,before.revision);
 assert.doesNotMatch(result.body,/provider_cipher|refreshToken|csrfToken|accessToken/);
});
test("expired authentication blocks export/deletion; purpose-bound email reauthentication rotates cookies",async()=>{
 const c=new PersonalClient(h);await c.initialize();const oldCookie=c.browser.cookies.get("rise_test_session"),oldSession=await sessionRow(c);
 await h.admin.query("update rise_private.server_sessions set authenticated_at=now()-interval '11 minutes' where user_id=$1",[c.owner]);
 assert.equal((await c.browser.request("account/export",{accountId:c.owner})).json().error.code,"recent_auth_required");assert.equal((await c.browser.request("account/deletion",deletion(c))).json().error.code,"recent_auth_required");
 const previous=await localCode(c.email);await permitSyntheticResend(c.email);
 const sent=await c.browser.request("auth/reauth/code",{accountId:c.owner});assert.equal(sent.statusCode,202);
 const code=await localCode(c.email,[previous.id]);assert.equal((await c.browser.request("auth/reauth/verify",{accountId:randomUUID(),challenge:sent.json().challenge,code:code.code})).statusCode,401);
 assert.equal((await c.browser.request("auth/reauth/verify",{accountId:c.owner,challenge:sent.json().challenge,code:code.code})).statusCode,200);await c.browser.read();
 assert.notEqual(c.browser.cookies.get("rise_test_session"),oldCookie);assert.equal(await active(c.owner,oldSession.provider_session_id),false);assert.equal((await c.browser.request("account/export",{accountId:c.owner})).statusCode,200);
});
test("forged owners, missing confirmation, stale heads and CSRF leave records and sessions intact",async()=>{
 const c=new PersonalClient(h);await c.initialize();const revision=c.revision;
 assert.equal((await c.browser.request("account/export",{accountId:randomUUID()})).statusCode,409);
 assert.equal((await c.browser.request("account/deletion",deletion(c,{confirm:undefined}))).statusCode,422);
 assert.equal((await c.browser.request("account/deletion",deletion(c),{"x-rise-csrf":"invalid"})).statusCode,403);
 assert.equal((await c.browser.request("account/deletion",deletion(c,{accountId:randomUUID()}))).statusCode,401);
 await c.command({kind:"profile.name",name:"Changed after review"});assert.equal((await c.browser.request("account/deletion",deletion(c,{revision}))).statusCode,409);
 assert.equal((await c.browser.read()).json().signedIn,true);assert.equal((await c.read()).records!.profiles[0].name,"Changed after review");assert.equal((await h.admin.query("select count(*) from rise_private.deletion_ledger where user_id=$1",[c.owner])).rows[0].count,"0");
});
test("deletion revokes every session and JWT immediately; lost-reply retry is idempotent and another owner survives",async()=>{
 const c=new PersonalClient(h),other=new PersonalClient(h);await c.initialize();await other.initialize();const original=await sessionRow(c);
 await permitSyntheticResend(c.email);const second=new AuthBrowser(h);await second.login(c.email,true);const secondId=(await h.admin.query("select provider_session_id from rise_private.server_sessions where id_hash=$1",[hash(second.cookies.get("rise_test_session")!)])).rows[0].provider_session_id;
 const intent=deletion(c),first=await c.browser.request("account/deletion",intent);assert.equal(first.statusCode,200);assert.equal(first.json().purgedAt,null);
 assert.equal(await active(c.owner,original.provider_session_id),false);assert.equal(await active(c.owner,secondId),false);assert.equal((await c.browser.request("personal")).statusCode,401);
 assert.equal((await c.browser.request("account/deletion",intent)).json().requestId,intent.requestId);
 assert.equal((await c.browser.request("account/deletion",{...intent,requestId:randomUUID()})).statusCode,409);
 assert.equal((await second.read()).json().reason,"deleted");assert.equal((await c.browser.read()).json().deletion.accountId,c.owner);
 assert.equal((await second.request("sync/commands",{accountId:c.owner,operations:[]})).statusCode,401);
 assert.equal((await other.read()).initialized,true);
 const result=await purgeAccounts(worker.pool,purger);assert.equal(result.failed,0);assert.ok(result.completed>=1);
 assert.equal((await h.admin.query("select count(*) from auth.users where id=$1",[c.owner])).rows[0].count,"0");assert.equal((await h.admin.query("select count(*) from rise.profiles where owner_id=$1",[c.owner])).rows[0].count,"0");
 assert.ok((await c.browser.read()).json().deletion.purgedAt);assert.equal((await c.browser.request("account/deletion",intent)).statusCode,200);assert.equal((await other.read()).initialized,true);
});
test("failed enqueue rolls back suppression; failed purge retains suppression and retries after restart",async()=>{
 const c=new PersonalClient(h);await c.initialize();
 await h.admin.query(`create function rise_private.synthetic_lifecycle_failure() returns trigger language plpgsql set search_path='' as $$begin if new.user_id='${c.owner}'::uuid then raise exception 'synthetic failure';end if;return new;end;$$;create trigger synthetic_lifecycle_failure before insert on rise_private.deletion_jobs for each row execute function rise_private.synthetic_lifecycle_failure()`);
 try{assert.equal((await c.browser.request("account/deletion",deletion(c))).statusCode,503);}finally{await h.admin.query("drop trigger synthetic_lifecycle_failure on rise_private.deletion_jobs;drop function rise_private.synthetic_lifecycle_failure()");}
 assert.equal((await c.browser.read()).json().signedIn,true);assert.equal((await h.admin.query("select count(*) from rise_private.deletion_ledger where user_id=$1",[c.owner])).rows[0].count,"0");
 const intent=deletion(c);assert.equal((await c.browser.request("account/deletion",intent)).statusCode,200);
 await h.admin.query(`create function rise_private.synthetic_purge_failure() returns trigger language plpgsql set search_path='' as $$begin if old.id='${c.owner}'::uuid then raise exception 'synthetic failure';end if;return old;end;$$;create trigger synthetic_purge_failure before delete on auth.users for each row execute function rise_private.synthetic_purge_failure()`);
 try{assert.ok((await purgeAccounts(worker.pool,purger)).failed>=1);}finally{await h.admin.query("drop trigger synthetic_purge_failure on auth.users;drop function rise_private.synthetic_purge_failure()");}
 assert.equal((await c.browser.read()).json().reason,"deleted");assert.equal((await h.admin.query("select last_error from rise_private.deletion_jobs where user_id=$1",[c.owner])).rows[0].last_error,"purge_failed");
 await h.admin.query("update rise_private.deletion_jobs set next_attempt_at=now() where user_id=$1",[c.owner]);assert.ok((await purgeAccounts(worker.pool,purger)).completed>=1);assert.equal((await purgeAccounts(worker.pool,purger)).completed,0);
});
test("a missing notification cleanup hook fails closed without deleting an account or its real job table",async()=>{
 const c=new PersonalClient(h);await c.initialize();const original=(await h.admin.query("select 'rise_private.erase_group_notifications(uuid)'::regprocedure::oid as oid")).rows[0].oid;let renamed=false;
 await h.admin.query('grant rise_group_guard to postgres');
 try{await h.admin.query('alter function rise_private.erase_group_notifications(uuid) rename to synthetic_unavailable_group_cleanup');renamed=true;
  const result=await c.browser.request("account/deletion",deletion(c));assert.equal(result.statusCode,409);assert.equal(result.json().error.code,"ownership_resolution_required");
 }finally{try{if(renamed)await h.admin.query('alter function rise_private.synthetic_unavailable_group_cleanup(uuid) rename to erase_group_notifications');}finally{await h.admin.query('revoke rise_group_guard from postgres');}}
 assert.equal((await h.admin.query("select 'rise_private.erase_group_notifications(uuid)'::regprocedure::oid as oid")).rows[0].oid,original);
 assert.equal((await c.browser.read()).json().signedIn,true);assert.equal((await c.read()).initialized,true);
});
test("ordinary BFF cannot run purge, remove the ledger or read managed Auth; lifecycle cannot read journeys",async()=>{
 await assert.rejects(h.store.pool.query("delete from auth.users"));
 await assert.rejects(h.store.pool.query("delete from rise_private.deletion_ledger"));await assert.rejects(h.store.pool.query("select * from auth.users"));await assert.rejects(worker.pool.query("select * from rise.profiles"));
});

test("retention starts after primary purge; unpurged and recently purged suppression survive cleanup",async()=>{
 const c=new PersonalClient(h);await c.initialize();const result=await c.browser.request("account/deletion",deletion(c));assert.equal(result.statusCode,200);
 await h.admin.query("update rise_private.deletion_ledger set deleted_at=now()-interval '40 days' where user_id=$1",[c.owner]);
 await purgeAccounts(worker.pool,purger);
 assert.equal((await h.admin.query("select count(*) from rise_private.deletion_ledger where user_id=$1",[c.owner])).rows[0].count,"1");
 await h.admin.query("update rise_private.deletion_jobs set purged_at=now()-interval '36 days' where user_id=$1",[c.owner]);
 await purgeAccounts(worker.pool,purger);assert.equal((await h.admin.query("select count(*) from rise_private.deletion_ledger where user_id=$1",[c.owner])).rows[0].count,"0");
});
test("backup deletion replay suppresses a restored synthetic identity before purge and never restores access",async()=>{
 const {execFile}=await import("node:child_process"),{promisify}=await import("node:util"),{writeFile,rm,mkdtemp}=await import("node:fs/promises"),{tmpdir}=await import("node:os"),{join,resolve}=await import("node:path");const exec=promisify(execFile);
 const c=new PersonalClient(h);await c.initialize();const session=await sessionRow(c),snapshots=new Map<string,unknown[]>();
 for(const [table,column]of [["auth.users","id"],["auth.sessions","user_id"],["rise.profiles","owner_id"],["rise_private.auth_contexts","id_hash"],["rise_private.server_sessions","user_id"]]){
   const value=column==="id_hash"?session.context_hash:c.owner;snapshots.set(table,(await h.admin.query(`select to_jsonb(t) as row from ${table} t where ${column}=$1`,[value])).rows.map(r=>r.row));
 }
 assert.equal((await c.browser.request("account/deletion",deletion(c))).statusCode,200);
 const deletedAt=(await h.admin.query("select deleted_at from rise_private.deletion_ledger where user_id=$1",[c.owner])).rows[0].deleted_at.toISOString();
 await purgeAccounts(worker.pool,purger);
 // Simulated older backup for this one synthetic subject, with network access
 // never enabled between restore and authoritative-ledger replay.
 const admin=await h.admin.connect();try{await admin.query("begin");await admin.query("delete from rise_private.deleted_sessions where user_id=$1",[c.owner]);await admin.query("delete from rise_private.deletion_jobs where user_id=$1",[c.owner]);await admin.query("delete from rise_private.deletion_ledger where user_id=$1",[c.owner]);
 for(const [table,rows]of snapshots){const columns=(await admin.query("select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' order by attnum",[table])).rows.map(r=>String(r.attname));assert.ok(columns.every(c=>/^[a-z_]+$/.test(c)));for(const row of rows)await admin.query(`insert into ${table}(${columns.join(",")}) select ${columns.map(c=>`restored.${c}`).join(",")} from jsonb_populate_record(null::${table},$1) restored on conflict do nothing`,[JSON.stringify(row)]);}
 await admin.query("commit");}catch(error){await admin.query("rollback");throw error;}finally{admin.release();}
 const dir=await mkdtemp(join(tmpdir(),"rise-synthetic-deletion-replay-")),file=join(dir,"ledger.json");
 try{await writeFile(file,JSON.stringify({format:"rise.deletion-ledger",version:1,environment:"test",installationId:h.config.installationId,entries:[{id:c.owner,deletedAt}]}),{mode:0o600});
 const result=await exec(process.execPath,["--import","tsx",resolve("scripts/infra/lifecycle.ts"),"replay","test",file]);assert.match(result.stdout,/suppression replayed \(1 entries\)/);
 assert.equal(await active(c.owner,session.provider_session_id),false);assert.equal((await c.browser.read()).json().reason,"deleted");
 assert.ok((await purgeAccounts(worker.pool,purger)).completed>=1);assert.equal((await h.admin.query("select count(*) from auth.users where id=$1",[c.owner])).rows[0].count,"0");
 }finally{await rm(dir,{recursive:true,force:true});}
});
test("lifecycle session-hash access is limited to suppressed subjects and never includes credential columns",async()=>{
 const c=new PersonalClient(h);await c.initialize();assert.equal((await worker.pool.query("select user_id from rise_private.server_sessions where user_id=$1",[c.owner])).rowCount,0);
 await assert.rejects(worker.pool.query("select provider_cipher from rise_private.server_sessions"));assert.equal((await c.browser.request("account/deletion",deletion(c))).statusCode,200);assert.ok((await worker.pool.query("select user_id from rise_private.server_sessions where user_id=$1",[c.owner])).rowCount);
 await purgeAccounts(worker.pool,purger);
});
test("a browser can deliberately sign in after primary purge without reviving its deleted identity",async()=>{
 const c=new PersonalClient(h);await c.initialize();const old=c.owner;assert.equal((await c.browser.request("account/deletion",deletion(c))).statusCode,200);await purgeAccounts(worker.pool,purger);
 assert.equal((await c.browser.read()).json().reason,"deleted");const fresh=await c.browser.login();assert.notEqual(fresh.session.json().account.id,old);assert.equal((await c.browser.request("personal")).json().initialized,false);
});
test("concurrent command and deletion either preserve the new revision for review or reject the revoked writer",async()=>{
 const c=new PersonalClient(h);await c.initialize();await permitSyntheticResend(c.email);const second=new AuthBrowser(h);await second.login(c.email,true);
 const results=await Promise.all([c.browser.request("account/deletion",deletion(c)),second.request("personal/commands",{protocolVersion:1,operationId:randomUUID(),baseRevision:c.revision,command:{kind:"profile.name",name:"Concurrent synthetic change"}})]);
 if(results[0].statusCode===200){assert.equal(results[1].statusCode,401);assert.equal((await second.read()).json().reason,"deleted");await purgeAccounts(worker.pool,purger);}
 else{assert.equal(results[0].statusCode,409);assert.equal(results[1].statusCode,200);assert.equal((await c.read()).records!.profiles[0].name,"Concurrent synthetic change");}
});
test("populated account purge removes historical children, staging, receipts and tokens while preserving another owner",async()=>{
 const{syncGuest}=await import("../support/syncData.ts"),{prepareGuestImport,importPages}=await import("../../src/sync/importModel.ts");
 const c=new PersonalClient(h),other=new PersonalClient(h);await c.login();await other.initialize();const source=syncGuest(),proposal=await prepareGuestImport(source,c.owner,{habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true}),pages=importPages(proposal.entries),importId=randomUUID();
 const request=(path:string,body:object)=>c.browser.request(`sync/${path}`,{accountId:c.owner,...body});
 assert.equal((await request("imports",{importId,baseRevision:0,sourceHash:proposal.sourceHash,provenance:"unverified-legacy",pages:pages.length,consent:true})).statusCode,200);
 for(const[page,entries]of pages.entries())assert.equal((await request("imports/page",{importId,page,entries})).statusCode,200);
 assert.equal((await request("imports/preview",{importId})).statusCode,200);assert.equal((await request("imports/commit",{importId,baseRevision:0,sourceHash:proposal.sourceHash,keepExisting:true})).statusCode,200);
 const records=(await c.read()).records!,date=String(records.prayer_windows[0].date);
 await h.admin.query("insert into rise.saved_work_breaks(owner_id,date,prayer,active,data,revision) values($1,$2,'fajr',false,$3,$4)",[c.owner,date,{stage:"returned",note:"Synthetic historical private note",wrapUsed:true},c.revision]);
 const exported=await parseAccountExport((await c.browser.request("account/export",{accountId:c.owner})).body);assert.equal(exported.records.saved_work_breaks[0].data!==undefined,true);
 const pendingImport=randomUUID();assert.equal((await request("imports",{importId:pendingImport,baseRevision:c.revision,sourceHash:proposal.sourceHash,provenance:"unverified-legacy",pages:pages.length,consent:true})).statusCode,200);
 for(const[page,entries]of pages.entries())assert.equal((await request("imports/page",{importId:pendingImport,page,entries})).statusCode,200);
 assert.ok(Number((await h.admin.query("select count(*) from rise.sync_import_pages where owner_id=$1",[c.owner])).rows[0].count)>0);
 assert.equal((await c.browser.request("account/deletion",deletion(c))).statusCode,200);const purged=await purgeAccounts(worker.pool,purger);assert.equal(purged.failed,0);
 const tables=(await h.admin.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rise' and c.relkind='r' and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='owner_id')")).rows;
 for(const row of tables){const name=String(row.relname);assert.match(name,/^[a-z_]+$/);assert.equal((await h.admin.query(`select count(*) from rise.${name} where owner_id=$1`,[c.owner])).rows[0].count,"0",`owned rows remain in ${name}`);}
 assert.equal((await h.admin.query("select count(*) from auth.sessions where user_id=$1",[c.owner])).rows[0].count,"0");assert.equal((await h.admin.query("select count(*) from rise_private.server_sessions where user_id=$1",[c.owner])).rows[0].count,"0");assert.equal((await other.read()).initialized,true);
});
