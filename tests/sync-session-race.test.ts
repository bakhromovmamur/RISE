import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AccountJourney} from '../src/sync/session.ts';
import {SyncClient} from '../src/sync/client.ts';
import {accountStore,type AccountStore,type AccountCache} from '../src/sync/store.ts';
import {createEmptyState} from '../src/data/initialState.ts';
import {applyDomainCommand} from '../src/domain/commands.ts';
import {syncOperations} from '../src/sync/operations.ts';
import {applySyncIntent,projectForSync} from '../src/sync/policy.ts';
import {localDate,type State} from '../src/model.ts';
import type {SyncOperation} from '../src/contracts/sync.ts';

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
/** Model IndexedDB's transaction ordering while pausing one durable commit. */
function gatedStore(source:AccountStore){
 const entered=deferred(),release=deferred();let tail=Promise.resolve(),first=true;
 const serial=<T>(work:()=>Promise<T>)=>{const result=tail.then(work);tail=result.then(()=>{},()=>{});return result;};
 const store:AccountStore={read:()=>serial(()=>source.read()),close:()=>source.close(),change:(expected,update)=>serial(async()=>{if(first){first=false;entered.resolve();await release.promise;}return source.change(expected,update);})};
 return{store,entered:entered.promise,release:()=>release.resolve()};
}
class Server extends SyncClient{
 readonly sent:SyncOperation[][]=[];
 constructor(owner:string,public state:State,public revision:number){super(owner,()=>null);}
 override async head(){return{accountId:this.owner,initialized:true,revision:this.revision,xp:0};}
 override async pull(){return{head:await this.head(),state:structuredClone(this.state),records:projectForSync(this.state)};}
 override async push(operations:SyncOperation[]){
  this.sent.push(structuredClone(operations));const receipts=operations.map(operation=>{this.state=applySyncIntent(this.state,operation.command,operation.context);return{operationId:operation.operationId,operationRevision:++this.revision,xp:0,replayed:false};});
  return{revision:this.revision,receipts};
 }
}
async function fixture(queued=false){
 const owner=randomUUID(),original=createEmptyState(),now=Date.now(),context={now,date:localDate(original.timezone,new Date(now)),timezone:original.timezone};
 const command={kind:'profile.name' as const,name:'Saved personal choice'},state=queued?applyDomainCommand(original,command,context):original;
 const queue=queued?[{id:randomUUID(),operations:syncOperations(original,state,command,context,1)}]:[];
 const initial:AccountCache={format:2,owner,version:0,revision:1,state,queue};
 const source=await accountStore(initial,false),gate=gatedStore(source),server=new Server(owner,original,1);
 const keys=['window','document','navigator'] as const,descriptors=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:true}});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 const journey=new AccountJourney(gate.store,initial,server,true);
 return{source,gate,server,journey,initial,close(){gate.release();journey.close();for(const[i,key]of keys.entries()){const descriptor=descriptors[i];if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}};
}

test('a draft arriving during receipt commit preserves both the receipt and the private draft',{timeout:5000},async()=>{
 const f=await fixture(true);try{
  const syncing=f.journey.sync();await f.gate.entered;
  assert.ok(f.journey.dispatch({kind:'draft.save',key:'private',value:'Keep this draft'}));const saved=f.journey.whenSaved();f.gate.release();
  assert.equal(await saved,true);await syncing;
  const cache=await f.source.read();assert.equal(f.journey.getSnapshot().error,null);assert.equal(cache.revision,2);assert.equal(cache.queue.length,0);assert.equal(cache.state.name,'Saved personal choice');assert.equal(cache.state.life.drafts.private,'Keep this draft');
  assert.deepEqual(f.server.sent.flat().map(op=>op.operationId),f.initial.queue[0].operations.map(op=>op.operationId));
 }finally{f.close();}
});

test('a private draft arriving during a remote pull retains the new personal state',{timeout:5000},async()=>{
 const f=await fixture();try{
  f.server.state.name='From another device';f.server.revision=2;const syncing=f.journey.sync();await f.gate.entered;
  assert.ok(f.journey.dispatch({kind:'draft.save',key:'private',value:'New local draft'}));const saved=f.journey.whenSaved();f.gate.release();
  assert.equal(await saved,true);await syncing;
  const cache=await f.source.read();assert.equal(f.journey.getSnapshot().error,null);assert.equal(cache.revision,2);assert.equal(cache.state.name,'From another device');assert.equal(cache.state.life.drafts.private,'New local draft');assert.equal(cache.queue.length,0);assert.equal(f.server.sent.length,0);
 }finally{f.close();}
});

test('a real intervening cache writer still rejects a stale local save and retains recovery intent',{timeout:5000},async()=>{
 const f=await fixture();try{
  assert.ok(f.journey.dispatch({kind:'draft.save',key:'private',value:'Unsaved here'}));await f.gate.entered;
  await f.source.change(0,current=>({...current,state:{...current.state,name:'Other tab'}}));f.gate.release();
  assert.equal(await f.journey.whenSaved(),false);assert.equal(f.journey.getSnapshot().error,'conflict');assert.match(f.journey.pendingExport(),/Unsaved here/);
  const cache=await f.source.read();assert.equal(cache.state.name,'Other tab');assert.equal(cache.state.life.drafts.private,undefined);
 }finally{f.close();}
});

test('a personal action arriving during a pull resumes sending with its original identity and context',{timeout:5000},async()=>{
 const f=await fixture();try{
  f.server.state.name='Remote name';f.server.revision=2;const syncing=f.journey.sync();await f.gate.entered;
  const date=f.initial.state.demoDate;assert.ok(f.journey.dispatch({kind:'reflection.save',date,reflection:{manageable:'New personal action',smaller:''}}));
  const intent=f.journey.pendingExport(),done=deferred();const unsubscribe=f.journey.subscribe(()=>{if(f.journey.getSyncSnapshot().phase==='synced'&&!f.journey.getSyncSnapshot().pending)done.resolve();});
  try{f.gate.release();assert.equal(await f.journey.whenSaved(),true);await syncing;await done.promise;}finally{unsubscribe();}
  const cache=await f.source.read();assert.equal(cache.revision,3);assert.equal(cache.queue.length,0);assert.equal(cache.state.name,'Remote name');assert.equal(cache.state.reflections[date].manageable,'New personal action');assert.equal(f.server.sent.length,1);
  for(const op of f.server.sent.flat()){assert.ok(intent.includes(op.operationId));assert.ok(intent.includes(JSON.stringify(op.context)));assert.equal(op.baseRevision,1);assert.equal(op.observedRevision,1);}
 }finally{f.close();}
});

test('ordinary local sample setup remains local and survives its durable save',{timeout:5000},async()=>{
 const f=await fixture();try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});f.gate.release();
  const state=f.journey.dispatch({kind:'prayer.sample-setup',setup:{...f.initial.state.life.setup,configured:true,city:'Synthetic sample'}});assert.ok(state);assert.equal(await f.journey.whenSaved(),true);
  assert.deepEqual((await f.source.read()).state,state);assert.equal(f.journey.cacheSnapshot().queue.length,0);assert.equal(f.server.sent.length,0);
 }finally{f.close();}
});

test('offline queued work stays pending without repeatedly restarting the sender',{timeout:5000},async()=>{
 const f=await fixture(true);try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});await f.journey.sync();await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(f.journey.getSyncSnapshot().phase,'offline');assert.equal(f.journey.getSyncSnapshot().pending,1);assert.equal(f.server.sent.length,0);assert.deepEqual((await f.source.read()).queue,f.initial.queue);
 }finally{f.close();}
});
