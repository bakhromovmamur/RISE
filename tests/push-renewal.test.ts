import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PlanRenewal,type PlanSource,type RenewalPort} from '../src/push/renewal';
import {parsePushPlanView,type PushPlanView,type PushPlanInput} from '../src/contracts/pushPlan';
import type {PushControl} from '../src/push/store';
import {makeFixture} from '../src/review/fixtures';
import {useCalculatedPrayers,defaultCalculation} from '../src/prayerCalculation';
import {AccountError} from '../src/auth/client';
const now=Date.parse('2026-10-23T00:00:00Z');
function harness(){
 const owner=randomUUID(),installation=randomUUID();let clock=now,online=true;
 const state=useCalculatedPrayers(makeFixture('fresh'),defaultCalculation(),{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},now);state.life.delivery={enabled:true,sound:true,acknowledgedFajr:[]};
 let source:PlanSource|null={owner,revision:1,state,ready:true};
 let control:PushControl={revision:1,owner,installation,generation:1,enabled:true,details:false,language:'en',pending:false,lastTest:null};
 let view:PushPlanView={accountId:owner,serverNow:new Date(now).toISOString(),dispatchEnabled:false,plan:null,receiver:{installation,version:1,nextAt:null,queuedThrough:null,failed:0,events:[]}};
 const sent:PushPlanInput[]=[],receipts=new Map<string,object>();let lose=false;
 const port:RenewalPort={source:()=>source,now:()=>clock,online:()=>online,permission:()=>true,control:async()=>structuredClone(control),write:async(expected,changes)=>{if(expected!==control.revision)throw new Error('cas');control={...control,...structuredClone(changes),revision:expected+1};return structuredClone(control);},read:async()=>({...structuredClone(view),serverNow:new Date(clock).toISOString()}),cancel:async()=>{},post:async input=>{
  sent.push(structuredClone(input));const old=receipts.get(input.requestId);if(old)return old;
  if(input.expectedGeneration!==(view.plan?.generation??0))throw new AccountError('account_changed');
  const generation=input.expectedGeneration+1,through=input.events.at(-1)?.at??null;
  view={...view,plan:{primaryInstallation:installation,generation,sourceRevision:input.sourceRevision,timezone:input.timezone,queuedThrough:through,suppressed:0,allowDuringQuiet:input.allowDuringQuiet??false,coverageExpired:!through,counts:[]},receiver:{installation,version:control.generation,queuedThrough:through,nextAt:input.events[0]?.at??null,failed:0,events:input.events}};
  const receipt={generation,primaryInstallation:installation,queuedThrough:through,jobs:input.events.length,suppressed:0,dispatchEnabled:false};receipts.set(input.requestId,receipt);if(lose){lose=false;throw new Error('lost_reply');}return receipt;
 }};
 return {port,sent,get control(){return control;},get view(){return view;},set view(v:PushPlanView){view=v;},get source(){return source;},set source(v:PlanSource|null){source=v;},advance:(ms:number)=>clock+=ms,offline:()=>online=false,lose:()=>lose=true};
}
test('renewal requires explicit primary choice, preserves data and uses current staging metadata',async()=>{
 const h=harness(),c=new PlanRenewal(h.port),before=JSON.stringify(h.source!.state);await c.refresh();assert.equal(h.sent.length,0);
 await c.refresh({allowDuringQuiet:false});assert.equal(h.sent.length,1);assert.equal(h.sent[0].takeover,true);assert.equal(c.getSnapshot().status,'planQuiet');assert.equal(h.control.planGeneration,undefined);assert.equal(JSON.stringify(h.source!.state),before);
 await c.refresh();assert.equal(h.sent.length,1);h.advance(13*3600000);await c.refresh();assert.equal(h.sent.length,2);assert.equal(h.sent[1].takeover,false);assert.notEqual(h.sent[0].requestId,h.sent[1].requestId);
});
test('lost reply survives coordinator reload and retries the exact immutable request',async()=>{
 const h=harness();h.lose();const c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});assert.equal(c.getSnapshot().status,'planError');assert.ok(h.control.renewal?.pending);c.close();
 const next=new PlanRenewal(h.port);await next.refresh();assert.deepEqual(h.sent[0],h.sent[1]);assert.equal(h.view.plan?.generation,1);assert.equal(next.getSnapshot().status,'planStaged');assert.equal(h.control.renewal?.pending,undefined);
});
test('unsaved, sync-pending, guest, offline and permission-blocked sources never submit',async()=>{
 for(const condition of ['sync','guest','offline','permission'] as const){const h=harness();if(condition==='sync')h.source={...h.source!,ready:false};if(condition==='guest')h.source=null;if(condition==='offline')h.offline();if(condition==='permission')h.port.permission=()=>false;await new PlanRenewal(h.port).refresh({allowDuringQuiet:true});assert.equal(h.sent.length,0);}
});
test('late response cannot restore metadata after disable or account switch',async()=>{
 for(const condition of ['disable','switch'] as const){const h=harness(),post=h.port.post;
 h.port.post=async input=>{const receipt=await post(input);if(condition==='switch')h.source=null;else await h.port.write(h.control.revision,{enabled:false,renewal:undefined});return receipt;};
 await new PlanRenewal(h.port).refresh({allowDuringQuiet:true});assert.equal(h.control.renewal?.confirmed,undefined);assert.equal(h.control.planGeneration,undefined);}
});
test('another primary stops automatic renewal and requires a new explicit choice',async()=>{
 const h=harness(),c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});h.view={...h.view,plan:{...h.view.plan!,generation:2,primaryInstallation:randomUUID()}};await c.refresh();assert.equal(h.sent.length,1);assert.equal(h.control.renewal?.enabled,false);assert.equal(c.getSnapshot().status,'planOther');
 await c.refresh({allowDuringQuiet:false});assert.equal(h.sent.length,2);assert.equal(h.sent[1].expectedGeneration,2);assert.equal(h.sent[1].takeover,true);
});
test('superseded receipts and failed control writes never claim current coverage',async()=>{
 const h=harness(),post=h.port.post;h.port.post=async input=>{const receipt=await post(input);h.view={...h.view,plan:{...h.view.plan!,generation:2}};return receipt;};const c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});assert.equal(c.getSnapshot().status,'planError');assert.equal(h.control.renewal?.confirmed,undefined);
 const quota=harness();quota.port.write=async()=>{throw new Error('quota');};await new PlanRenewal(quota.port).refresh({allowDuringQuiet:true});assert.equal(quota.sent.length,0);
});
test('readiness distinguishes expiry, empty coverage, queue error and clock skew',async()=>{
 const h=harness(),c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});h.view={...h.view,receiver:{...h.view.receiver!,queuedThrough:new Date(now-1).toISOString()}};await c.refresh();assert.equal(c.getSnapshot().status,'planExpired');
 h.view={...h.view,plan:{...h.view.plan!,queuedThrough:null,coverageExpired:true},receiver:{...h.view.receiver!,queuedThrough:null}};await c.refresh();assert.equal(c.getSnapshot().status,'planEmpty');
 h.view={...h.view,receiver:{...h.view.receiver!,failed:1}};await c.refresh();assert.equal(c.getSnapshot().status,'planError');
 h.port.read=async()=>({...h.view,serverNow:new Date(now+300000).toISOString()});await c.refresh();assert.equal(c.getSnapshot().status,'planClock');
});
test('untrusted plan metadata validates nested fields and rejects private extensions',()=>{
 const h=harness();assert.deepEqual(parsePushPlanView(h.view),h.view);for(const patch of [{accountId:'bad'},{serverNow:'bad'},{privateNotes:'secret'},{receiver:{...h.view.receiver,events:[{key:randomUUID(),at:'bad',expiresAt:'bad'}]}}])assert.throws(()=>parsePushPlanView({...h.view,...patch}));
});
test('an older rejection cannot disable a newer explicit renewal choice',async()=>{
 const h=harness();h.port.post=async()=>{await h.port.write(h.control.revision,{renewal:{enabled:true,allowDuringQuiet:false}});throw new AccountError('account_changed');};
 await new PlanRenewal(h.port).refresh({allowDuringQuiet:true});assert.equal(h.control.renewal?.enabled,true);assert.equal(h.control.renewal?.allowDuringQuiet,false);
});
test('receiving another installation plan does not inherit its quiet-hours override',async()=>{
 const h=harness(),c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});assert.equal(c.getSnapshot().allowDuringQuiet,true);
 await h.port.write(h.control.revision,{renewal:undefined});h.view={...h.view,plan:{...h.view.plan!,primaryInstallation:randomUUID()}};
 await c.refresh();assert.equal(c.getSnapshot().allowDuringQuiet,false);assert.equal(h.sent.length,1);
});
test('background-plan consent does not enable or require the foreground switch',async()=>{
 const h=harness();h.source!.state.life.delivery!.enabled=false;const before=JSON.stringify(h.source!.state),c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});assert.ok(h.sent[0].events.length);assert.equal(c.getSnapshot().status,'planStaged');assert.equal(JSON.stringify(h.source!.state),before);
});

import {saveHabit,emptyDraft} from '../src/model';
import {applyDomainCommand} from '../src/domain/commands';
test('consented renewal includes habits and removes completed/disabled occurrences without affecting XP',async()=>{
 const h=harness(),c=new PlanRenewal(h.port),id=randomUUID(),date='2026-10-23';
 let state=saveHabit(h.source!.state,{...emptyDraft(),name:'Private habit',reminder:'12:00'},id,date);state.prefs.reminders=true;state.prefs.quietStart=state.prefs.quietEnd='00:00';h.source={...h.source!,state};
 await c.refresh({allowDuringQuiet:true});assert.ok(h.sent[0].events.some(e=>e.kind==='habit'));const first=h.sent[0].events.filter(e=>e.kind==='habit');
 state=applyDomainCommand(state,{kind:'habit.check',habitId:id,date,check:'full'},{date,now,timezone:state.timezone});h.source={...h.source!,state,revision:2};await c.refresh();assert.equal(h.sent.length,2);assert.equal(h.sent[1].events.filter(e=>e.kind==='habit').length,first.length-1);
 state=applyDomainCommand(state,{kind:'preferences.set',changes:{reminders:false}},{date,now,timezone:state.timezone});h.source={...h.source!,state,revision:3};await c.refresh();assert.equal(h.sent.length,3);assert.ok(!h.sent[2].events.some(e=>e.kind==='habit'));assert.equal(state.days[date][0].check,'full');
});

test('sync changes arriving during renewal are rechecked without waiting for another timer',async()=>{
 const h=harness(),c=new PlanRenewal(h.port);await c.refresh({allowDuringQuiet:true});
 const read=h.port.read;let release:()=>void=()=>{},entered:()=>void=()=>{};
 const held=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});let block=true;
 h.port.read=async()=>{const result=await read();if(block){block=false;entered();await held;}return result;};
 const pending=c.refresh();await started;
 h.source={...h.source!,revision:2,state:{...h.source!.state,prefs:{...h.source!.state.prefs,quietStart:h.source!.state.prefs.quietStart==='22:00'?'21:00':'22:00'}}};
 await c.refresh();await c.refresh();
 let timer:ReturnType<typeof setTimeout>;let unsubscribe=()=>{};
 const settled=new Promise<void>((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('renewal_update_was_lost')),2000);unsubscribe=c.subscribe(()=>{if(c.getSnapshot().view?.plan?.sourceRevision===2&&!c.getSnapshot().busy)resolve();});});
 try{release();await pending;await settled;assert.equal(h.sent.length,2);assert.equal(h.sent[1].takeover,false);assert.equal(h.sent[1].sourceRevision,2);assert.equal(c.getSnapshot().status,'planStaged');}
 finally{clearTimeout(timer!);unsubscribe();c.close();}
});
