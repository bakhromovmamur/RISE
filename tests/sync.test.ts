import {test}from"node:test";
import assert from"node:assert/strict";
import {randomUUID}from"node:crypto";
import {syncGuest}from"./support/syncData.ts";
import {prepareGuestImport,mergeGuestImport,validateImportRecords,importableHabits,importPages}from"../src/sync/importModel.ts";
import {hydrate,project}from"../src/contracts/personalRecords.ts";
import {syncOperations,withDeviceState,personalProjection,importedPrayerSetup}from"../src/sync/operations.ts";
import {parseSyncBatch,parseEntries}from"../src/contracts/sync.ts";
import {balancedFixture}from"../src/demo.ts";
import {localDate,xpTotal,addDays}from"../src/model.ts";
import {applyDomainCommand}from"../src/domain/commands.ts";
import {parseStoredState}from"../src/data/storedState.ts";
import {createEmptyState}from"../src/data/initialState.ts";

const selection={habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true};
test("consented projection preserves authored dates, XP, snapshots and prayer start while excluding device secrets",async()=>{
  const source=syncGuest(),before=structuredClone(source),owner=randomUUID();Reflect.set(source,"credentials",{refreshToken:"NEVER-UPLOAD"});Reflect.set(source.habits[0],"accessToken","NEVER-UPLOAD");
  const proposal=await prepareGuestImport(source,owner,selection),state=hydrate(proposal.records),serialized=JSON.stringify(proposal);
  assert.equal(xpTotal(state),xpTotal(source));assert.equal(state.prayers.started,source.prayers.started);assert.equal(state.habits[0].created,source.habits[0].created);assert.equal(state.days[source.habits[0].created][0].name,source.days[source.habits[0].created][0].name);
  assert.equal(state.prayers.days[source.prayers.started].entries.fajr.check,"on_time");assert.equal(state.prayers.days[source.prayers.started].entries.fajr.recordedAt,undefined);
  assert.doesNotMatch(serialized,/latitude|longitude|calculationKey|NEVER-UPLOAD|Synthetic unfinished draft/);assert.deepEqual(state.life.drafts,{});assert.equal(state.timer,null);
  assert.deepEqual(source.prayers,before.prayers);assert.equal((await prepareGuestImport(source,owner,selection)).sourceHash,proposal.sourceHash);
  const different=await prepareGuestImport(source,randomUUID(),selection);assert.notEqual(different.records.habits[0].id,proposal.records.habits[0].id);
  const roundTrip=await prepareGuestImport(state,owner,{...selection,habitIds:state.habits.map(h=>h.id)});assert.equal(roundTrip.records.habits[0].id,proposal.records.habits[0].id);
});
test("known fixture activity is withheld and unchecked categories never enter an import",async()=>{
  const source=parseStoredState(JSON.stringify(balancedFixture())),owner=randomUUID();const proposal=await prepareGuestImport(source,owner,{habitIds:importableHabits(source).map(h=>h.id),goals:true,prayers:true,reflections:false,settings:false});
  assert.equal(proposal.summary.habitChecks,0);assert.equal(proposal.summary.prayerChecks,0);assert.equal(proposal.summary.goals,0);assert.ok(proposal.summary.excludedSamples>0);
  const empty=await prepareGuestImport(syncGuest(),owner,{habitIds:[],goals:false,prayers:false,reflections:false,settings:false});assert.deepEqual(empty.records.habit_occurrences,[]);assert.deepEqual(empty.records.reflections,[]);assert.deepEqual(empty.records.prayer_days,[]);
});
test("import is append-only and repeat import cannot duplicate activity or overwrite a changed account",async()=>{
  const proposal=await prepareGuestImport(syncGuest(),randomUUID(),selection),once=mergeGuestImport({},proposal.records),before=structuredClone(once.records);
  before.habits[0].data={...before.habits[0].data as object,name:"Account name wins"};before.reflections[0].data={manageable:"Account reflection wins",smaller:"Small"};
  const twice=mergeGuestImport(before,proposal.records);assert.equal(twice.xpAdded,0);assert.equal(xpTotal(hydrate(twice.records)),20);assert.equal(hydrate(twice.records).habits[0].name,"Account name wins");assert.equal(twice.records.habit_occurrences.length,1);
  assert.equal(hydrate(twice.records).reflections[String(before.reflections[0].date)].manageable,"Account reflection wins");assert.ok(twice.kept>0);
});
test("malformed import rows, duplicate keys and hidden payload fields cannot pass the account boundary",async()=>{
  const proposal=await prepareGuestImport(syncGuest(),randomUUID(),selection);
  const extra=structuredClone(proposal.records);extra.habits[0].data={...extra.habits[0].data as object,sessionToken:"forged"};assert.throws(()=>validateImportRecords(extra));
  const duplicate=structuredClone(proposal.records);duplicate.habits.push(duplicate.habits[0]);assert.throws(()=>validateImportRecords(duplicate));
  assert.throws(()=>parseEntries([{table:"profiles",row:{...proposal.records.profiles[0],owner_id:randomUUID()}}]));
  for(const page of importPages(proposal.entries))assert.ok(page.length<=200&&Buffer.byteLength(JSON.stringify(page))<512*1024);
});
test("outbound intents keep captured dates and omit device setup, drafts and running timer fields",()=>{
  const before=syncGuest(),now=Date.now(),context={now,date:localDate("UTC",new Date(now)),timezone:"UTC"};
  const command={kind:"reflection.save" as const,date:context.date,reflection:{manageable:"Authored change",smaller:"Small"}},after=applyDomainCommand(before,command,context);
  const operations=syncOperations(before,after,command,context,8);assert.equal(operations.length,1);assert.equal(operations[0].baseRevision,8);assert.deepEqual(operations[0].context,context);assert.doesNotMatch(JSON.stringify(operations),/latitude|longitude|calculationKey/);
  const draft={kind:"draft.save" as const,key:"private",value:"Do not upload"},drafted=applyDomainCommand(before,draft,context);assert.deepEqual(syncOperations(before,drafted,draft,context,8),[]);
  const timerCommand={kind:"timer.complete" as const,habitId:randomUUID(),date:addDays(context.date,-1)};assert.equal(syncOperations(before,before,timerCommand,context,8)[0].command.kind,"habit.correct");
  const invalid={accountId:randomUUID(),operations:[{...operations[0],ownerId:randomUUID()}]};assert.throws(()=>parseSyncBatch(invalid));
});
test("remote refresh preserves only this account device's drafts, timer and coordinate settings",async()=>{
  const local=syncGuest(),proposal=await prepareGuestImport(local,randomUUID(),selection),remote=hydrate(proposal.records);remote.name="Name from another device";
  const combined=withDeviceState(remote,local);assert.equal(combined.name,remote.name);assert.deepEqual(combined.life.drafts,local.life.drafts);assert.deepEqual(combined.life.calculation,local.life.calculation);
  const records=project(remote,remote.demoDate);assert.doesNotMatch(JSON.stringify(records),/latitude|longitude|calculationKey/);
});
test("local calendar observations and simulation edits do not advance a personal revision",async()=>{
  const source=syncGuest(),proposal=await prepareGuestImport(source,randomUUID(),selection),before=hydrate(proposal.records);
  const now=Date.now(),context={now,date:localDate(before.timezone,new Date(now)),timezone:before.timezone};
  const current=applyDomainCommand(before,{kind:"calendar.refresh"},context),observed=applyDomainCommand(current,{kind:"calendar.refresh",deviceTimezone:"Asia/Tashkent"},context);
  assert.deepEqual(syncOperations(current,observed,{kind:"calendar.refresh",deviceTimezone:"Asia/Tashkent"},context,8),[]);
  const local=importedPrayerSetup(current,source);assert.deepEqual(personalProjection(current),personalProjection(local));assert.deepEqual(local.life.calculation,source.life.calculation);assert.deepEqual(local.life.drafts,{});
  local.life.setup.city="Local simulation edit";assert.deepEqual(personalProjection(current),personalProjection(local));
});
test("append imports preserve existing occurrence order and separate prayer tracking start",async()=>{
  const source=syncGuest(),owner=randomUUID(),proposal=await prepareGuestImport(source,owner,selection),before=structuredClone(proposal.records);
  const oldStart=String(before.profiles[0].started_on);delete (before.prayer_settings[0].data as Record<string,unknown>).started;
  const next=syncGuest();next.habits[0].id="other-authored-habit";for(const rows of Object.values(next.days))for(const row of rows)row.habitId="other-authored-habit";next.goals=[];next.personalRewards=[];next.selectedRewardId=null;
  next.habits[0].created=addDays(oldStart,-4);const incoming=await prepareGuestImport(next,owner,{...selection,habitIds:["other-authored-habit"],prayers:false,goals:false});
  const merged=mergeGuestImport(before,incoming.records),state=hydrate(merged.records);assert.equal(state.prayers.started,oldStart);
  const occurrences=Object.values(state.days).find(rows=>rows.length===2)!;assert.equal(occurrences[0].habitId,before.habits[0].id);assert.equal(occurrences[1].habitId,incoming.records.habits[0].id);
});
test("two years of 100 habits preserve every check and private reflection through bounded sync import pages",async()=>{
  const source=createEmptyState(),template=syncGuest().habits[0];source.timezone="UTC";
  source.habits=Array.from({length:100},(_,i)=>({...structuredClone(template),id:`authored-long-${i}`,created:"2024-10-19"}));
  for(let i=0;i<731;i++){const date=addDays("2024-10-19",i);source.days[date]=source.habits.map(h=>({habitId:h.id,name:h.name,icon:h.icon,type:h.type,unit:h.unit,full:10,tiny:1,cue:"After breakfast",check:i%2?"full":"tiny"}));source.reflections[date]={manageable:"Synthetic private note",smaller:"Synthetic next step"};}
  const proposal=await prepareGuestImport(source,randomUUID(),{habitIds:source.habits.map(h=>h.id),goals:false,prayers:false,reflections:true,settings:false}),pages=importPages(proposal.entries);
  assert.equal(proposal.summary.habitChecks,73100);assert.equal(proposal.summary.xp,xpTotal(source));assert.equal(Object.keys(hydrate(proposal.records).reflections).length,731);
  assert.equal(pages.flat().length,proposal.entries.length);assert.ok(pages.length>350);for(const page of pages)assert.ok(page.length<=200&&Buffer.byteLength(JSON.stringify(page))<512*1024);
});
