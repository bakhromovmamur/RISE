import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parsePushPlan,validatePlanWindow,PLAN_HORIZON} from '../src/contracts/pushPlan';
const now=Date.parse('2026-10-23T00:00:00.000Z');
const event=(at=now+60000)=>({key:randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()});
const plan=()=>({accountId:randomUUID(),requestId:randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,timezone:'Asia/Tashkent',events:[event()]});
test('plans validate bounded timestamps and reject private or unknown fields',()=>{
 const p=plan();assert.deepEqual(parsePushPlan(p),p);validatePlanWindow(p.events,now);
 for(const patch of [{coordinates:[1,2]},{timezone:'bad/zone'},{sourceRevision:-1},{events:[{...event(),note:'private'}]},{events:Array.from({length:85},()=>event())},{events:[event(),event(now+1)]}])assert.throws(()=>parsePushPlan({...p,...patch}));
 const e=event();assert.throws(()=>parsePushPlan({...p,events:[e,e]}));
});
test('server clock bounds seven-day horizon, expired events and burst frequency',()=>{
 assert.throws(()=>validatePlanWindow([event(now-1)],now));
 assert.throws(()=>validatePlanWindow([event(now+PLAN_HORIZON)],now));
 assert.throws(()=>validatePlanWindow(Array.from({length:13},()=>event()),now));
 validatePlanWindow([],now);
});
import {buildWebPushEvents} from '../src/push/plan';
import {makeFixture} from '../src/review/fixtures';
import {defaultCalculation,useCalculatedPrayers} from '../src/prayerCalculation';
import {buildPrayerSchedule} from '../src/prayerSchedule';
test('web plan reuses prayer eligibility, stable opaque IDs and preserves the profile',async()=>{
 const state=useCalculatedPrayers(makeFixture('fresh'),defaultCalculation(),{fajr:0,dhuhr:0,asr:0,maghrib:0,isha:0},now);
 state.life.delivery={enabled:true,sound:true,acknowledgedFajr:[]};
 const before=JSON.stringify(state),events=await buildWebPushEvents(state,now,true);
 assert.ok(events.length>0);assert.deepEqual(events,await buildWebPushEvents(state,now,true));assert.equal(JSON.stringify(state),before);
 validatePlanWindow(events,now);assert.ok(events.every(e=>Object.keys(e).length===3));
 assert.deepEqual(events.map(e=>Date.parse(e.at)),buildPrayerSchedule(state,now).filter(e=>e.at+1000<now+PLAN_HORIZON).slice(0,84).map(e=>e.at));
 state.life.delivery.enabled=false;assert.deepEqual(await buildWebPushEvents(state,now,true),[]);
});
