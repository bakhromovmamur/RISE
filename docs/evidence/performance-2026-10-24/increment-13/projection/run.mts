import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {project as candidate} from './candidate.ts';
import {project as baseline} from './baseline.ts';
import {capacityProfile} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/capacity.ts';
const state=capacityProfile('2026-10-24'),date=state.habits[0].created;
assert.deepEqual(candidate(state,date),baseline(state,date));
const samples=[];
for(let round=0;round<12;round++)for(const [mode,fn] of round%2?[['candidate',candidate],['baseline',baseline]] as const:[['baseline',baseline],['candidate',candidate]] as const){
 global.gc?.();const before=process.memoryUsage().heapUsed,cpu=process.cpuUsage(),start=performance.now();
 const result=fn(state,date);const elapsed=performance.now()-start,used=process.cpuUsage(cpu),heap=process.memoryUsage().heapUsed-before;
 assert.equal(result.habit_occurrences.length,73000);
 samples.push({round,mode,ms:elapsed,cpuMs:(used.user+used.system)/1000,heapDelta:heap});
}
const report={scope:'isolated pure relational projection, 100 habits × 730 dates; alternating execution order, first two rounds warmup, forced GC before each sample; not API latency or retained allocation proof',equivalent:true,samples};
await writeFile(new URL('./report.json',import.meta.url),JSON.stringify(report,null,2));
