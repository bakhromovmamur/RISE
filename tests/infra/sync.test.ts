import {before,after,test}from"node:test";
import assert from"node:assert/strict";
import {randomUUID}from"node:crypto";
import {authHarness,AuthBrowser}from"../support/auth.ts";
import {PersonalClient}from"../support/personal.ts";
import {syncGuest}from"../support/syncData.ts";
import {prepareGuestImport,importPages}from"../../src/sync/importModel.ts";
import {hydrate,personalTables}from"../../src/contracts/personalRecords.ts";
import {emptyRecords,type PageCursor}from"../../src/contracts/sync.ts";
import {addDays,emptyDraft,localDate}from"../../src/model.ts";
import {hash}from"../../server/auth/crypto.ts";

let harness:Awaited<ReturnType<typeof authHarness>>;
before(async()=>{harness=await authHarness();});after(async()=>{await harness?.close();});
const selection={habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true};
const request=(client:PersonalClient,path:string,body:object)=>client.browser.request(`sync/${path}`,{accountId:client.owner,...body});
async function stage(client:PersonalClient,source=syncGuest(),picked=selection){
  const proposal=await prepareGuestImport(source,client.owner,picked),pages=importPages(proposal.entries),importId=randomUUID(),head=(await client.browser.request("sync/head")).json();
  const begin={importId,baseRevision:head.revision,sourceHash:proposal.sourceHash,provenance:"unverified-legacy",pages:pages.length,consent:true};
  assert.equal((await request(client,"imports",begin)).statusCode,200);
  for(const[page,entries]of pages.entries())assert.equal((await request(client,"imports/page",{importId,page,entries})).statusCode,200);
  const preview=await request(client,"imports/preview",{importId});assert.equal(preview.statusCode,200);
  return{proposal,importId,begin,pages,preview:preview.json(),commit:{importId,baseRevision:head.revision,sourceHash:proposal.sourceHash,keepExisting:true}};
}
test("sync requires a current session, CSRF, expected account and explicit consent before staging",async()=>{
  const anonymous=new AuthBrowser(harness);assert.equal((await anonymous.request("sync/head")).statusCode,401);
  const client=new PersonalClient(harness);await client.login();const before=await client.read();assert.equal(before.initialized,false);
  const value={importId:randomUUID(),baseRevision:0,sourceHash:"0".repeat(64),provenance:"unverified-legacy",pages:1,consent:false};
  assert.equal((await request(client,"imports",value)).statusCode,422);
  assert.equal((await request(client,"imports",{...value,consent:true,accountId:randomUUID()})).statusCode,409);
  assert.equal((await client.browser.request("sync/imports",{accountId:client.owner,...value,consent:true},{"x-rise-csrf":""})).statusCode,403);
  assert.equal((await harness.admin.query("select count(*) from rise.sync_imports where owner_id=$1",[client.owner])).rows[0].count,"0");assert.deepEqual(await client.read(),before);
});
test("consented guest import preserves dates and XP, stays private until commit, and replays once",async()=>{
  const client=new PersonalClient(harness);await client.login();const source=syncGuest(),original=structuredClone(source),plan=await stage(client,source);
  assert.equal((await client.read()).initialized,false);
  assert.equal((await request(client,"imports/page",{importId:plan.importId,page:0,entries:plan.pages[0]})).statusCode,200);
  const first=await request(client,"imports/commit",plan.commit);assert.equal(first.statusCode,200);assert.equal(first.json().xp,20);
  const retry=await request(client,"imports/commit",plan.commit);assert.equal(retry.statusCode,200);assert.equal(retry.json().replayed,true);assert.equal(retry.json().operationRevision,1);
  const view=await client.read(),state=hydrate(view.records!);assert.equal(view.xp,20);assert.equal(state.prayers.started,source.prayers.started);assert.equal(state.prayers.days[source.prayers.started].entries.fajr.recordedAt,undefined);
  assert.equal(state.habits[0].created,source.habits[0].created);assert.deepEqual(state.life.drafts,{});assert.equal(state.life.calculation,undefined);assert.deepEqual(source,original);
  assert.equal((await harness.admin.query("select count(*) from rise.sync_import_pages where owner_id=$1",[client.owner])).rows[0].count,"0");
  assert.equal((await request(client,"imports/commit",{...plan.commit,sourceHash:"1".repeat(64)})).statusCode,409);
});
test("existing account records win an explicit append import and repeated activity never duplicates",async()=>{
  const client=new PersonalClient(harness);await client.login();const one=await stage(client);assert.equal((await request(client,"imports/commit",one.commit)).statusCode,200);await client.read();
  const state=hydrate((await client.read()).records!),habit=state.habits[0],version=habit.versions.at(-1)!;
  await client.command({kind:"habit.save",newId:randomUUID(),draft:{id:habit.id,name:"Account edit survives",icon:habit.icon,area:habit.area,reason:habit.reason,type:habit.type,unit:habit.unit,full:version.full,tiny:version.tiny,days:version.days,cue:version.cue,reminder:version.reminder}});
  const repeated=await stage(client);assert.ok(repeated.preview.kept>0);assert.equal(repeated.preview.xpAdded,0);
  assert.equal((await request(client,"imports/commit",repeated.commit)).statusCode,200);
  const view=await client.read();assert.equal(view.xp,20);assert.equal(view.records!.habits.length,1);assert.equal(hydrate(view.records!).habits[0].name,"Account edit survives");
});
test("captured offline dates and whole command batches commit atomically with stable replay",async()=>{
  const client=new PersonalClient(harness);await client.initialize();const date=addDays(localDate("UTC"),-1),context={date,now:Date.parse(`${date}T12:00:00Z`),timezone:"UTC"},habit=randomUUID();
  const operations=[{protocolVersion:1,operationId:randomUUID(),baseRevision:1,command:{kind:"habit.save",newId:habit,draft:{...emptyDraft(),name:"Offline authored habit",days:[0,1,2,3,4,5,6]}},context},{protocolVersion:1,operationId:randomUUID(),baseRevision:2,command:{kind:"habit.check",habitId:habit,date,check:"full"},context}];
  const first=await request(client,"commands",{operations});assert.equal(first.statusCode,200);const repeat=await request(client,"commands",{operations});assert.equal(repeat.statusCode,200);assert.ok(repeat.json().receipts.every((r:{replayed:boolean})=>r.replayed));
  const view=await client.read();assert.equal(view.revision,3);assert.equal(view.xp,20);assert.equal(hydrate(view.records!).days[date][0].check,"full");
  const failed=[{...operations[0],operationId:randomUUID(),baseRevision:3,command:{kind:"profile.name",name:"Must roll back"}},{...operations[1],operationId:randomUUID(),baseRevision:4,command:{kind:"habit.check",habitId:randomUUID(),date,check:"full"}}];
  assert.equal((await request(client,"commands",{operations:failed})).statusCode,404);assert.deepEqual(await client.read(),view);
  assert.equal((await request(client,"commands",{operations:[{...operations[0],operationId:randomUUID(),baseRevision:3,context:{...context,timezone:"Asia/Tashkent"}}]})).statusCode,409);
});
test("authorized pagination has bounded pages and refuses stale or cross-account cursors",async()=>{
  const client=new PersonalClient(harness);await client.login();const source=syncGuest();for(let i=0;i<205;i++)source.habits.push({...structuredClone(source.habits[0]),id:`authored-extra-${i}`,name:`Synthetic habit ${i}`});
  const plan=await stage(client,source,{...selection,habitIds:source.habits.map(h=>h.id)});assert.ok(plan.pages.length>1);assert.equal((await request(client,"imports/commit",plan.commit)).statusCode,200);
  const head=(await client.browser.request("sync/head")).json(),records=emptyRecords();let cursor:PageCursor|null={table:0,offset:0},pages=0;
  while(cursor){const response=await request(client,"pull",{revision:head.revision,cursor});assert.equal(response.statusCode,200);const page=response.json();assert.ok(page.rows.length<=200);assert.ok(Buffer.byteLength(response.body)<512*1024);records[page.table].push(...page.rows);cursor=page.next;pages++;}
  assert.equal(hydrate(records).habits.length,206);assert.ok(pages>personalTables.length);
  const other=new PersonalClient(harness);await other.initialize();assert.equal((await request(other,"pull",{accountId:client.owner,revision:head.revision,cursor:{table:0,offset:0}})).statusCode,409);
  await client.read();await client.command({kind:"profile.name",name:"Canonical change"});assert.equal((await request(client,"pull",{revision:head.revision,cursor:{table:0,offset:0}})).statusCode,409);
});
test("import receipt failure rolls back all live rows, retaining staged data for a safe retry",async()=>{
  const client=new PersonalClient(harness);await client.login();const plan=await stage(client);
  await harness.admin.query("create function rise_private.sync_test_failure() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'synthetic_failure'; end $$");
  try{await harness.admin.query(`create trigger sync_test_failure before insert on rise.personal_receipts for each row when (new.operation_id='${plan.importId}'::uuid) execute function rise_private.sync_test_failure()`);
    assert.equal((await request(client,"imports/commit",plan.commit)).statusCode,503);assert.equal((await client.read()).initialized,false);
    for(const t of personalTables)assert.equal((await harness.admin.query(`select count(*) from rise.${t.name} where owner_id=$1`,[client.owner])).rows[0].count,"0");
  }finally{await harness.admin.query("drop trigger if exists sync_test_failure on rise.personal_receipts");await harness.admin.query("drop function rise_private.sync_test_failure()");}
  assert.equal((await request(client,"imports/commit",plan.commit)).statusCode,200);assert.equal((await client.read()).xp,20);
});
test("staged imports enforce owner/session RLS and expire without granting ordinary table writes",async()=>{
  const client=new PersonalClient(harness);await client.login();const staged=await stage(client),other=new PersonalClient(harness);await other.login();
  const session=(await harness.admin.query("select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1",[hash(client.browser.cookies.get("rise_test_session")!)])).rows[0],otherSession=(await harness.admin.query("select user_id,provider_session_id from rise_private.server_sessions where id_hash=$1",[hash(other.browser.cookies.get("rise_test_session")!)])).rows[0];
  const runtime=await harness.store.pool.connect();
  try{
    for(const actor of [session,otherSession]){await runtime.query("begin");try{await runtime.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.user_id,session_id:actor.provider_session_id})]);assert.equal((await runtime.query("select id from rise.sync_imports where owner_id=$1",[client.owner])).rowCount,actor.user_id===client.owner?1:0);assert.equal((await runtime.query("select page from rise.sync_import_pages where owner_id=$1",[client.owner])).rowCount,actor.user_id===client.owner?staged.pages.length:0);}finally{await runtime.query("rollback");}}
    await runtime.query("begin");try{await runtime.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:client.owner,session_id:session.provider_session_id})]);await assert.rejects(runtime.query("update rise.sync_imports set owner_id=$1 where owner_id=$2 and id=$3",[other.owner,client.owner,staged.importId]),(error:{code?:string})=>error.code==="42501");}finally{await runtime.query("rollback");}
    await runtime.query("begin");try{await runtime.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:other.owner,session_id:otherSession.provider_session_id})]);await assert.rejects(runtime.query("insert into rise.sync_import_pages(owner_id,import_id,page,data) values($1,$2,0,$3)",[other.owner,staged.importId,JSON.stringify(staged.pages[0])]),(error:{code?:string})=>error.code==="23503");}finally{await runtime.query("rollback");}
  }finally{runtime.release();}
  await harness.admin.query("update rise.sync_imports set expires_at=now()-interval '1 second' where owner_id=$1 and id=$2",[client.owner,staged.importId]);
  assert.equal((await request(client,"imports/commit",staged.commit)).statusCode,409);assert.equal((await client.read()).initialized,false);
  await client.browser.request("logout",{});assert.equal((await request(client,"imports/preview",{importId:staged.importId})).statusCode,401);
});
test("cancel removes only the owner's uncommitted staging and does not undo a committed import",async()=>{
  const client=new PersonalClient(harness);await client.login();const plan=await stage(client),other=new PersonalClient(harness);await other.login();
  assert.equal((await request(other,"imports/cancel",{importId:plan.importId})).statusCode,200);assert.equal((await request(client,"imports/preview",{importId:plan.importId})).statusCode,200);
  assert.equal((await request(client,"imports/cancel",{importId:plan.importId})).statusCode,200);assert.equal((await request(client,"imports/cancel",{importId:plan.importId})).statusCode,200);assert.equal((await request(client,"imports/commit",plan.commit)).statusCode,409);assert.equal((await client.read()).initialized,false);
  assert.equal((await harness.admin.query("select count(*) from rise.sync_import_pages where owner_id=$1",[client.owner])).rows[0].count,"0");
  const committed=await stage(client);assert.equal((await request(client,"imports/commit",committed.commit)).statusCode,200);assert.equal((await request(client,"imports/cancel",{importId:committed.importId})).statusCode,200);assert.equal((await request(client,"imports/commit",committed.commit)).json().replayed,true);assert.equal((await client.read()).xp,20);
});
