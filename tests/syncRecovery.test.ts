import {test}from"node:test";
import assert from"node:assert/strict";
import {randomUUID}from"node:crypto";
import {accountStore,accountPending,recoveryOperations}from"../src/sync/store.ts";
import {syncGuest}from"./support/syncData.ts";
import {parseSyncOperation}from"../src/contracts/sync.ts";
import {recoveryDeviceState}from"../src/sync/operations.ts";
import {intentView,blockedIntent,projectForSync}from"../src/sync/policy.ts";
import {prepareGuestImport,recordsFromEntries}from"../src/sync/importModel.ts";
import {hydrate}from"../src/contracts/personalRecords.ts";
import {localDate}from"../src/model.ts";
async function state(){const owner=randomUUID(),proposal=await prepareGuestImport(syncGuest(),owner,{habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true});return{owner,state:hydrate(recordsFromEntries(proposal.entries))};}
test("format-one cached intent is retained and recovery decisions use strict compare-and-swap",async()=>{
 const initial=await state(),now=Date.now(),context={now,date:localDate(initial.state.timezone,new Date(now)),timezone:initial.state.timezone};const op=parseSyncOperation({protocolVersion:1,operationId:randomUUID(),baseRevision:1,command:{kind:"profile.name",name:"Queued"},context});const queue=[{id:randomUUID(),operations:[op]}];
 const store=await accountStore({format:1,...initial,version:3,revision:1,queue},false),before=await store.read();assert.deepEqual(before.queue,queue);assert.equal(before.format,2);
 const rebased=await store.change(before.version,current=>({...current,queue:[],recovery:{state:current.state,queue:current.queue,index:0,decisions:[]}}));assert.equal(accountPending(rebased),1);assert.deepEqual(recoveryOperations(rebased),[op]);
 await assert.rejects(store.change(before.version,current=>({...current,queue:[]})));assert.deepEqual(await store.read(),rebased);
 const reviewed=await store.change(rebased.version,current=>({...current,recovery:{...current.recovery!,index:1,decisions:["account"]}}));assert.equal(accountPending(reviewed),0);assert.deepEqual(reviewed.recovery!.queue,queue);assert.deepEqual(reviewed.recovery!.state,before.state);
});
test("semantic read sets ignore unrelated records and exclude raw device calculation keys",async()=>{
 const {state:before}=await state(),command={kind:"reflection.save" as const,date:before.demoDate,reflection:{manageable:"A",smaller:""}},now=Date.now(),context={now,date:localDate(before.timezone,new Date(now)),timezone:before.timezone},expected=intentView(before,command,context),other=structuredClone(before);
 other.name="Independent";assert.equal(intentView(other,command,context),expected);other.reflections[command.date]={manageable:"Concurrent",smaller:""};assert.notEqual(intentView(other,command,context),expected);
 assert.doesNotMatch(JSON.stringify(projectForSync(syncGuest())),/calculationKey|latitude|longitude|Synthetic unfinished draft/);
 const h=before.habits[0];h.archivedAt=before.demoDate;assert.equal(blockedIntent(before,{kind:"habit.correct",habitId:h.id,date:before.demoDate,check:"full"}),true);
});
test("hostile causal and stored recovery metadata cannot bypass revision or decision bounds",async()=>{
 const {owner,state:before}=await state(),now=Date.now(),op={protocolVersion:1,operationId:randomUUID(),baseRevision:1,command:{kind:"profile.name",name:"Synthetic"},context:{now,date:localDate(before.timezone,new Date(now)),timezone:before.timezone}};
 assert.throws(()=>parseSyncOperation({...op,observedRevision:2}));assert.throws(()=>parseSyncOperation({...op,predecessor:"untrusted"}));
 await assert.rejects(accountStore({format:2,owner,state:before,version:0,revision:1,queue:[],recovery:{state:before,queue:[],index:1,decisions:["local"]}},false));
});

test("reviewed timezone recovery preserves original setup without reactivating calculations for the old zone",async()=>{
 const {state:local}=await state();local.life.calculation={latitude:41.3,longitude:69.2,timezone:"Asia/Tashkent",label:"Synthetic location",method:"Karachi",madhab:"Hanafi",highLatitude:"MiddleOfTheNight"};local.life.setup.configured=true;const original=structuredClone(local),remote=structuredClone(local);remote.timezone="Asia/Almaty";delete remote.life.calculation;
 const recovered=recoveryDeviceState(remote,local);assert.equal(recovered.timezone,"Asia/Almaty");assert.equal(recovered.life.calculation,undefined);assert.equal(recovered.life.setup.configured,false);assert.deepEqual(local,original);assert.deepEqual(recovered.prayers.days,remote.prayers.days);
});
test("a refreshed or reloaded recovery stays pending and never announces Synced",async()=>{
 const {owner,state:before}=await state(),now=Date.now(),operation=parseSyncOperation({protocolVersion:1,operationId:randomUUID(),baseRevision:1,command:{kind:"profile.name",name:"Pending recovery"},context:{now,date:localDate(before.timezone,new Date(now)),timezone:before.timezone}}),source=[{id:randomUUID(),operations:[operation]}];
 const store=await accountStore({format:2,owner,version:0,revision:1,state:before,queue:[],recovery:{state:before,queue:source,index:0,decisions:[]}},false),cache=await store.read();
 const keys=["window","document","navigator"]as const,descriptors=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
 const events=new EventTarget();Object.defineProperty(globalThis,"window",{configurable:true,value:events});Object.defineProperty(globalThis,"document",{configurable:true,value:{hidden:true}});Object.defineProperty(globalThis,"navigator",{configurable:true,value:{onLine:false}});
 const {AccountJourney}=await import("../src/sync/session.ts"),{SyncClient}=await import("../src/sync/client.ts"),journey=new AccountJourney(store,cache,new SyncClient(owner,()=>null),true),phases:string[]=[];const unsubscribe=journey.subscribe(()=>phases.push(journey.getSyncSnapshot().phase));
 try{await store.change(cache.version,current=>({...current}));await journey.refresh();await journey.reloadSaved();assert.equal(journey.getSyncSnapshot().pending,1);assert.equal(phases.includes("synced"),false);assert.equal(journey.cacheSnapshot().recovery!.queue[0].operations[0].operationId,operation.operationId);}
 finally{unsubscribe();journey.close();for(const[i,key]of keys.entries()){const descriptor=descriptors[i];if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
