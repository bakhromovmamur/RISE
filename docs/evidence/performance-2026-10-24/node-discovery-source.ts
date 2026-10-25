import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createEmptyState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/data/initialState.ts';
import {parseStoredState,validateState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/data/storedState.ts';
import {project,hydrate} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/personalRecords.ts';
import {applyDomainCommand} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/domain/commands.ts';
import {addDays,occurrence,xpTotal} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/model.ts';
const started='2024-10-25',date='2026-10-24',state=createEmptyState();
state.name='Synthetic capacity profile';state.timezone='Asia/Tashkent';state.demoDate=date;state.onboarded=true;state.prayers.started=started;
state.habits=Array.from({length:100},(_,i)=>({id:`capacity-habit-${i}`,name:`Synthetic habit ${i}`,icon:'book',area:'personal',reason:'',type:'count',unit:'pages',created:started,versions:[{effective:started,full:20,tiny:2,days:[0,1,2,3,4,5,6],cue:'',reminder:''}]}));
for(let d=started;d<=date;d=addDays(d,1))state.days[d]=state.habits.map((h,i)=>({...occurrence(h,d),...(d===date&&i===0?{}:{check:i%5===0?'tiny' as const:'full' as const})}));
validateState(state);assert.equal(Object.keys(state.days).length,730);const raw=JSON.stringify(state),records=project(state,started),beforeXp=xpTotal(state),times:Record<string,number[]>={};
function measure<T>(name:string,run:()=>T):T{const start=performance.now(),value=run();(times[name]??=[]).push(performance.now()-start);return value;}
for(let i=0;i<3;i++){
 measure('validateState',()=>validateState(state));
 measure('parseStoredState',()=>parseStoredState(raw));
 measure('project',()=>project(state,started));
 const rebuilt=measure('hydrate',()=>hydrate(records));assert.equal(xpTotal(rebuilt),beforeXp);assert.deepEqual(project(rebuilt,started),records);
 const checked=measure('habit.check',()=>applyDomainCommand(state,{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'},{date,now:Date.parse('2026-10-24T10:00:00Z'),timezone:state.timezone}));assert.equal(xpTotal(checked),beforeXp+20);
}
assert.equal(JSON.stringify(state),raw);
console.log(JSON.stringify({scope:'Node desktop discovery probe, three samples; not NFR/device acceptance',habits:100,dates:730,occurrences:73000,profileBytes:Buffer.byteLength(raw),recordRows:Object.values(records).reduce((n,rows)=>n+rows.length,0),measurementsMs:Object.fromEntries(Object.entries(times).map(([name,values])=>[name,{samples:values,median:[...values].sort((a,b)=>a-b)[1],max:Math.max(...values)}])),invariants:'original state unchanged; 73,000 occurrences project/hydrate without XP change; explicit check adds exactly 20'},null,2));
