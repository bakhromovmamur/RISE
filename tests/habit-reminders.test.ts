import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createEmptyState} from '../src/data/initialState';
import {saveHabit,emptyDraft,ensureDays,xpTotal,draftOf} from '../src/model';
import {applyDomainCommand} from '../src/domain/commands';
import {buildHabitSchedule,habitEventKey,habitReminderCopy} from '../src/habitSchedule';
import {buildWebPushEvents} from '../src/push/plan';
import {canceledEventKeys,pushEventKey,affectsPush} from '../src/push/policy';
import {parsePushPlan} from '../src/contracts/pushPlan';
const now=Date.parse('2026-10-23T00:00:00Z'),date='2026-10-23';
function fixture(){let s=createEmptyState();s.timezone='Asia/Tashkent';s.prefs.reminders=true;s.prefs.quietStart='22:00';s.prefs.quietEnd='07:00';s=saveHabit(s,{...emptyDraft(),name:'Private authored habit',tiny:1,days:[0,1,2,3,4,5,6],reminder:'09:00'},randomUUID(),date);return s;}
test('habit dates use the selected zone, preserve history, skip elapsed dates and never change XP',()=>{
 const s=fixture(),before=JSON.stringify(s),events=buildHabitSchedule(s,now);
 assert.equal(events.length,7);assert.equal(events[0].at,Date.parse('2026-10-23T04:00:00Z'));assert.equal(events[0].key,habitEventKey(date,s.habits[0].id));
 assert.equal(JSON.stringify(s),before);assert.equal(xpTotal(s),0);assert.ok(buildHabitSchedule(s,events[0].at).every(e=>e.date>date));
 s.timezone='Asia/Almaty';assert.equal(buildHabitSchedule(s,now)[0].at,events[0].at);
 s.timezone='UTC';assert.equal(buildHabitSchedule(s,now)[0].at,Date.parse('2026-10-23T09:00:00Z'));
});
test('schedule and reminder edits start tomorrow, existing snapshots stay authoritative',()=>{
 const s=fixture(),id=s.habits[0].id;
 const updated=saveHabit(s,{...draftOf(s.habits[0],date),days:[6],reminder:'10:00'},id,date);
 assert.equal(buildHabitSchedule(updated,now)[0].at,Date.parse('2026-10-23T04:00:00Z'));
 assert.equal(buildHabitSchedule(updated,now)[1].at,Date.parse('2026-10-24T05:00:00Z'));
 assert.equal(buildHabitSchedule(updated,now).length,2);
 updated.days[date]=[];assert.equal(buildHabitSchedule(updated,now)[0].date,'2026-10-24');
});
test('tiny/full completion, undo, archive and reminder off reconcile dated reminders without extra XP',async()=>{
 let s=ensureDays(fixture(),date);const id=s.habits[0].id,context={date,now,timezone:s.timezone};
 s=applyDomainCommand(s,{kind:'habit.check',habitId:id,date,check:'tiny'},context);assert.equal(xpTotal(s),10);assert.ok(buildHabitSchedule(s,now).every(e=>e.date!==date));
 s=applyDomainCommand(s,{kind:'habit.check',habitId:id,date,check:'full'},context);
 assert.equal(xpTotal(s),20);assert.ok(buildHabitSchedule(s,now).every(e=>e.date!==date));
 assert.deepEqual(await canceledEventKeys({kind:'habit.check',habitId:id,date,check:'full'}),[await pushEventKey(habitEventKey(date,id))]);
 s=applyDomainCommand(s,{kind:'habit.correct',habitId:id,date,check:null},context);
 assert.equal(xpTotal(s),0);assert.equal(buildHabitSchedule(s,now)[0].date,date);
 s=applyDomainCommand(s,{kind:'habit.archive',habitId:id},context);assert.deepEqual(buildHabitSchedule(s,now),[]);
 const off=fixture();off.prefs.reminders=false;assert.deepEqual(buildHabitSchedule(off,now),[]);off.prefs.reminders=true;off.mode='demo';assert.deepEqual(buildHabitSchedule(off,now),[]);
 assert.deepEqual(await canceledEventKeys({kind:'timer.complete',habitId:id,date}),[await pushEventKey(habitEventKey(date,id))]);assert.equal(affectsPush({kind:'preferences.set',changes:{reminders:false}}),true);assert.equal(await canceledEventKeys({kind:'habit.archive',habitId:id}),null);
});
test('quiet hours always suppress habits even with prayer override; no names enter plan or notification',async()=>{
 const s=fixture();s.habits[0].versions[0].reminder='06:00';assert.deepEqual(buildHabitSchedule(s,now),[]);assert.deepEqual(await buildWebPushEvents(s,now,true),[]);
 s.habits[0].versions[0].reminder='09:00';const events=await buildWebPushEvents(s,now,true);assert.equal(events.length,7);assert.ok(events.every(e=>e.kind==='habit'));assert.ok(!JSON.stringify(events).includes('Private'));
 const input={accountId:randomUUID(),requestId:randomUUID(),expectedGeneration:0,sourceRevision:1,takeover:true,timezone:s.timezone,events};assert.deepEqual(parsePushPlan(input),input);assert.throws(()=>parsePushPlan({...input,events:[{...events[0],kind:'other'}]}));
 for(const lang of ['en','ru','uz'] as const){const copy=habitReminderCopy(lang);assert.equal(copy.title,'RISE');assert.ok(copy.body);assert.ok(!copy.body.includes(s.habits[0].name));}
});
test('DST gaps are omitted and repeated clocks fire only once; invalid legacy times are unavailable',()=>{
 const s=fixture();s.timezone='Europe/London';s.habits[0].created='2026-01-01';s.habits[0].versions[0].effective='2026-01-01';s.habits[0].versions[0].reminder='01:30';s.days={};s.prefs.quietStart=s.prefs.quietEnd='00:00';
 assert.ok(!buildHabitSchedule(s,Date.parse('2026-03-29T00:00:00Z')).some(e=>e.date==='2026-03-29'));
 assert.equal(buildHabitSchedule(s,Date.parse('2026-10-25T00:00:00Z'))[0].at,Date.parse('2026-10-25T00:30:00Z'));
 assert.ok(!buildHabitSchedule(s,Date.parse('2026-10-25T00:45:00Z')).some(e=>e.date==='2026-10-25'));
 s.habits[0].versions[0].reminder='bad';assert.deepEqual(buildHabitSchedule(s,now),[]);
});
