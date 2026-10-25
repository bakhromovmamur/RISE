import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {applyDomainCommand} from '../src/domain/commands.ts';
import {newSharedPriorities,type SharedPriority} from '../src/domain/priorityReferences.ts';
import {priorityKey,type Priority} from '../src/developmentModel.ts';
import {parseAccountOperation} from '../src/contracts/accountCommands.ts';
import {canonical,hydrate,type Records} from '../src/contracts/personalRecords.ts';
import {validateRows,parseSyncOperation} from '../src/contracts/sync.ts';
import {projectForSync,intentView} from '../src/sync/policy.ts';
import {syncOperations,withDeviceState} from '../src/sync/operations.ts';
import {prepareGuestImport,mergeGuestImport,validateImportRecords} from '../src/sync/importModel.ts';
import {accountStore} from '../src/sync/store.ts';
import {createAccountExport,parseAccountExport} from '../src/account/export.ts';
import {addDays,localDate,xpTotal} from '../src/model.ts';
import {syncGuest} from './support/syncData.ts';

const selection={habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true};
async function fixture(){
 const owner=randomUUID(),proposal=await prepareGuestImport(syncGuest(),owner,selection),state=hydrate(proposal.records),date=localDate('UTC');
 state.dailyPriorities[date]=[];
 return{owner,state,date,context:{date,now:Date.now(),timezone:'UTC'},ref:{kind:'task',groupId:randomUUID(),taskId:randomUUID(),date:addDays(date,1)} as SharedPriority};
}
function legacyRows(records:Records){const copy=structuredClone(records);for(const row of copy.daily_priorities){delete row.group_id;delete row.task_id;delete row.task_date;}return copy;}

test('shared priority selection uses separate authority, ordered unique slots and explicit occurrence dates without XP or completion',async()=>{
 const {state,date,context,ref}=await fixture(),command={kind:'priority.pin' as const,date,priority:ref,selected:true},original=structuredClone(state);
 assert.deepEqual(parseAccountOperation({protocolVersion:1,operationId:randomUUID(),baseRevision:1,command}).command,command);
 assert.throws(()=>applyDomainCommand(state,command,context));
 const forgedContext={...context,sharedPriorities:[priorityKey(ref)]};assert.throws(()=>applyDomainCommand(state,command,forgedContext));
 const allowed=new Set([priorityKey(ref)]),pinned=applyDomainCommand(state,command,context,{sharedPriorities:allowed});
 assert.deepEqual(pinned.dailyPriorities[date],[ref]);assert.equal(pinned.dailyPriorities[date][0].kind,'task');assert.equal(xpTotal(pinned),xpTotal(state));
 assert.deepEqual(pinned.life.tasks,state.life.tasks);assert.deepEqual(pinned.goals,state.goals);assert.deepEqual(state,original);
 assert.deepEqual(applyDomainCommand(pinned,command,context).dailyPriorities[date],[ref]);
 assert.deepEqual(newSharedPriorities(pinned,command),[]);
 const second={...ref,taskId:randomUUID()},third={...ref,taskId:randomUUID()},fourth={...ref,taskId:randomUUID()};
 const priorities=[ref,second,third],three=applyDomainCommand(state,{kind:'priorities.set',date,priorities},context,{sharedPriorities:new Set(priorities.map(priorityKey))});
 assert.throws(()=>applyDomainCommand(three,{...command,priority:fourth},context,{sharedPriorities:new Set([priorityKey(fourth)])}));
 assert.throws(()=>applyDomainCommand(three,{kind:'priorities.set',date,priorities:[ref,ref]},context));
 const reordered=applyDomainCommand(three,{kind:'priorities.set',date,priorities:[third,ref]},context);
 assert.deepEqual(reordered.dailyPriorities[date],[third,ref]);
 assert.throws(()=>applyDomainCommand(reordered,{...command,priority:{...ref,date:addDays(ref.date,1)}},context));
 const removed=applyDomainCommand(reordered,{...command,selected:false},context);assert.deepEqual(removed.dailyPriorities[date],[third]);
 assert.throws(()=>applyDomainCommand(removed,command,context));
});

test('sync sends opaque shared references, retains local simulations locally and never resurrects removed shared selections',async()=>{
 const {state,date,context,ref}=await fixture(),command={kind:'priority.pin' as const,date,priority:ref,selected:true};
 const pinned=applyDomainCommand(state,command,context,{sharedPriorities:new Set([priorityKey(ref)])}),ops=syncOperations(state,pinned,command,context,1);
 assert.equal(ops.length,1);assert.deepEqual(ops[0].command,command);assert.deepEqual(hydrate(projectForSync(pinned)).dailyPriorities[date],[ref]);
 const local:Priority={kind:'task',taskId:'legacy-local-task',date};pinned.dailyPriorities[date].push(local);
 assert.deepEqual(hydrate(projectForSync(pinned)).dailyPriorities[date],[ref]);
 const restored=withDeviceState(state,pinned);assert.deepEqual(restored.dailyPriorities[date],[local]);
 const projection=JSON.stringify(projectForSync(pinned));assert.doesNotMatch(projection,/legacy-local-task|Family shopping|sharedTitle|assignedMember/);
});

test('older priority rows, export checksums and cached immutable intents remain compatible without rewriting their source',async()=>{
 const {owner,state,date,context}=await fixture(),habitId=state.habits[0].id;
 state.dailyPriorities[date]=[{kind:'habit',habitId}];const current=projectForSync(state),legacy=legacyRows(current),original=structuredClone(legacy);
 validateRows('daily_priorities',legacy.daily_priorities);assert.deepEqual(hydrate(legacy).dailyPriorities,state.dailyPriorities);validateImportRecords(legacy);assert.deepEqual(legacy,original);
 const command={kind:'priorities.set' as const,date,priorities:[]},expected=canonical([state.timezone,['daily_priorities',legacy.daily_priorities.filter(r=>r.date===date)],['habits',legacy.habits],['goals',legacy.goals],['goal_milestones',legacy.goal_milestones]]);
 assert.equal(intentView(state,command,context),expected);
 const operation=parseSyncOperation({protocolVersion:1,operationId:randomUUID(),baseRevision:1,command,context,expected});
 for(const format of [1,2] as const){const queue=[{id:randomUUID(),operations:[operation]}],store=await accountStore({format,owner,version:0,revision:1,state,queue},false);assert.deepEqual((await store.read()).queue,queue);}
 const raw=await createAccountExport(owner,1,legacy),file=await parseAccountExport(raw);assert.deepEqual(file.records,legacy);assert.equal(file.checksum.value,JSON.parse(raw).checksum.value);
 const partial={...legacy.daily_priorities[0],group_id:null};assert.throws(()=>validateRows('daily_priorities',[partial]));
 assert.deepEqual(legacy,original);
});

test('exports retain opaque shared selections but guest import cannot create them or overwrite existing account selections',async()=>{
 const {owner,state,date,context,ref}=await fixture(),pinned=applyDomainCommand(state,{kind:'priority.pin',date,priority:ref,selected:true},context,{sharedPriorities:new Set([priorityKey(ref)])});
 const records=projectForSync(pinned),file=await parseAccountExport(await createAccountExport(owner,2,records));
 assert.deepEqual(file.backup.data.personal.dailyPriorities[date],[ref]);assert.deepEqual(file.shared,{available:false,items:[]});
 assert.equal(file.backup.counts.groups,0);assert.equal(file.backup.counts.tasks,0);assert.throws(()=>validateImportRecords(records));
 const imported=await prepareGuestImport(pinned,owner,{...selection,habitIds:pinned.habits.map(h=>h.id)});assert.equal(imported.records.daily_priorities.some(r=>r.kind==='task'),false);
 assert.deepEqual(hydrate(mergeGuestImport(records,imported.records).records).dailyPriorities[date],[ref]);
 const malformed=structuredClone(records);malformed.daily_priorities.find(r=>r.kind==='task')!.group_id='untrusted';
 await assert.rejects(parseAccountExport(await createAccountExport(owner,2,malformed)));
});

test('a vanished shared selection is refused without poisoning account storage and accepted selection queues its exact identity',async()=>{
 const {owner,state,date,ref}=await fixture(),store=await accountStore({format:2,owner,version:0,revision:1,state,queue:[]},false),cache=await store.read();
 const keys=['window','document','navigator'] as const,descriptors=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:true}});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
 const {AccountJourney}=await import('../src/sync/session.ts'),{SyncClient}=await import('../src/sync/client.ts');let available=false;
 const journey=new AccountJourney(store,cache,new SyncClient(owner,()=>null),true,true,p=>available&&priorityKey(p)===priorityKey(ref));
 try{
  const command={kind:'priority.pin' as const,date,priority:ref,selected:true};assert.equal(journey.dispatch(command),null);assert.equal(journey.getSnapshot().error,null);assert.equal(journey.getSyncSnapshot().pending,0);
  available=true;assert.ok(journey.dispatch(command));assert.equal(await journey.whenSaved(),true);const saved=journey.cacheSnapshot();assert.deepEqual(saved.state.dailyPriorities[date],[ref]);assert.deepEqual(saved.queue[0].operations[0].command,command);
  available=false;assert.ok(journey.dispatch({...command,selected:false}));assert.equal(await journey.whenSaved(),true);assert.equal(journey.getSnapshot().error,null);
 }finally{journey.close();for(const[i,key]of keys.entries()){const descriptor=descriptors[i];if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
