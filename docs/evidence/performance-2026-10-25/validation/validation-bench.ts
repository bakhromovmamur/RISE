import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {capacityProfile} from '../../tests/support/capacity.ts';
import {validateState as before} from './state-before.ts';
import {validateState as candidate} from './state-candidate.ts';
const state=capacityProfile('2026-10-25');
for(let i=0;i<state.habits.length;i++) {
 const old=state.habits[i].id,id=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
 state.habits[i].id=id;
 for(const rows of Object.values(state.days)) for(const row of rows) if(row.habitId===old)row.habitId=id;
}
const raw=JSON.stringify(state),samples=[];
for(let round=0;round<22;round++) for(const name of round%2?['candidate','before']:['before','candidate']) {
 global.gc?.();const cpu=process.cpuUsage(),start=performance.now();
 (name==='before'?before:candidate)(state);
 const ms=performance.now()-start,used=process.cpuUsage(cpu);
 if(round>=2)samples.push({round,name,ms,cpuMs:(used.user+used.system)/1000});
}
assert.equal(JSON.stringify(state),raw);
const summary=Object.fromEntries(['before','candidate'].map(name=>{const rows=samples.filter(s=>s.name===name).sort((a,b)=>a.ms-b.ms);return [name,{medianMs:(rows[9].ms+rows[10].ms)/2,p95Ms:rows[18].ms}]}));
const report={scope:'100 habits, 730 days, UUID IDs; complete state validation, alternating order; not API capacity',summary,samples};
await writeFile('.rise-infra/quality03-20261025/validation-comparison.json',JSON.stringify(report,null,2));console.log(summary);
