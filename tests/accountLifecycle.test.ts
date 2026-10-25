import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { syncGuest } from "./support/syncData.ts";
import { prepareGuestImport,recordsFromEntries } from "../src/sync/importModel.ts";
import { createAccountExport,parseAccountExport } from "../src/account/export.ts";
import { contentHash,previewRestore } from "../src/data/backup.ts";
import { hydrate } from "../src/contracts/personalRecords.ts";
import { xpTotal } from "../src/model.ts";
import { parseAccountSession } from "../src/auth/client.ts";
async function fixture(){const owner=randomUUID(),p=await prepareGuestImport(syncGuest(),owner,{habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true});return {owner,records:recordsFromEntries(p.entries)};}
test("account export round-trips full records and portable dates/XP without credentials or device secrets",async()=>{
 const {owner,records}=await fixture(),before=structuredClone(records),raw=await createAccountExport(owner,7,records),parsed=await parseAccountExport(raw),state=hydrate(records);
 assert.deepEqual(parsed.records,before);assert.equal(parsed.xp,xpTotal(state));assert.deepEqual(records,before);
 const preview=await previewRestore(raw,{state,archives:[],revision:3});assert.equal(preview.xp,xpTotal(state));assert.deepEqual(preview.content.personal.days,parsed.backup.data.personal.days);
 assert.doesNotMatch(raw,/csrfToken|access_token|refresh_token|provider_cipher|latitude|longitude|calculationKey|push_endpoint|Synthetic unfinished draft/);
 assert.deepEqual(parsed.shared,{available:false,items:[]});
});
test("future, tampered, duplicate and credential-bearing account exports fail before restore",async()=>{
 const {owner,records}=await fixture(),good=JSON.parse(await createAccountExport(owner,1,records)),original=structuredClone(records);
 for(const mutate of [(r:typeof good)=>r.version=2,(r:typeof good)=>r.xp=99999,(r:typeof good)=>r.records.habits.push(r.records.habits[0]),(r:typeof good)=>r.records.profiles[0].access_token="forbidden",(r:typeof good)=>r.records.prayer_settings[0].data.preferences.calculationKey="forbidden"]){
  const bad=structuredClone(good);mutate(bad);const{checksum:_,...payload}=bad;bad.checksum.value=await contentHash(payload);await assert.rejects(parseAccountExport(JSON.stringify(bad)));
 }assert.deepEqual(records,original);
 const bad=structuredClone(good);bad.records.profiles[0].name="tampered";await assert.rejects(parseAccountExport(JSON.stringify(bad)));
});
test("deleted-session metadata must be complete, signed out and cannot carry another account",()=>{
 const deletion={accountId:randomUUID(),requestId:randomUUID(),requestedAt:"2026-10-22T01:00:00Z",purgeBy:"2026-10-29T01:00:00Z",purgedAt:null},base={signedIn:false,csrfToken:"0".repeat(64),delivery:"email",reason:"deleted",deletion};
 assert.deepEqual(parseAccountSession(base).deletion,deletion);assert.throws(()=>parseAccountSession({...base,deletion:undefined}));assert.throws(()=>parseAccountSession({...base,account:{id:randomUUID()}}));assert.throws(()=>parseAccountSession({...base,signedIn:true}));
});

test("account restore rejects oversized files and orphan relational history",async()=>{
 const {owner,records}=await fixture(),file=JSON.parse(await createAccountExport(owner,1,records));
 const orphan=structuredClone(file);orphan.records.habit_versions[0].habit_id=randomUUID();const{checksum:_,...payload}=orphan;orphan.checksum.value=await contentHash(payload);await assert.rejects(parseAccountExport(JSON.stringify(orphan)));
 await assert.rejects(parseAccountExport(" ".repeat(50*1024*1024+1)));
});
test("deletion ledger replay is bounded and tied to the exact environment/installation",async()=>{
 const{parseDeletionLedger}=await import("../src/contracts/deletionLedger.ts"),installationId=randomUUID(),entry={id:randomUUID(),deletedAt:"2026-10-21T00:00:00Z"},value={format:"rise.deletion-ledger",version:1,environment:"test",installationId,entries:[entry]};
 assert.equal(parseDeletionLedger(JSON.stringify(value),"test",installationId).entries.length,1);
 for(const invalid of [{...value,environment:"local"},{...value,installationId:randomUUID()},{...value,entries:[entry,entry]},{...value,entries:[{...entry,deletedAt:"2099-01-01T00:00:00Z"}]},{...value,token:"forbidden"}])assert.throws(()=>parseDeletionLedger(JSON.stringify(invalid),"test",installationId));
});
test("a stale device generation cannot activate an old in-memory account snapshot",async()=>{
 const{accountStore}=await import("../src/sync/store.ts"),{owner,records}=await fixture(),cache={format:2 as const,owner,version:0,revision:1,state:hydrate(records),queue:[]};
 await assert.rejects(accountStore(cache,false,"stale-clear-generation"));const store=await accountStore(cache,false,null);assert.equal((await store.read()).owner,owner);store.close();
});
