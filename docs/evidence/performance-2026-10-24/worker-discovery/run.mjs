import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {setTimeout as delay,setImmediate as immediate} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {load} from './compute.mjs';
const root=process.cwd(),compute=await load(root),{capacityProfile}=await import(pathToFileURL(`${root}/tests/support/capacity.ts`)),{project}=await import(pathToFileURL(`${root}/src/contracts/personalRecords.ts`));
const date='2026-10-24',context={date,timezone:'UTC',now:Date.parse(date+'T12:00:00Z')},state=capacityProfile(date),records=project(state,date),original=JSON.stringify(records),expected=compute(records,context);
assert.equal(expected.xp,1314010);
const workers=[],pending=new Map();let id=0;
const startup=performance.now();
try{
 for(let i=0;i<2;i++){
  const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{root}});workers.push(worker);
  await new Promise((resolve,reject)=>{
   worker.on('error',reject);worker.on('message',result=>{
    if(result.ready){resolve();return;}const job=pending.get(result.id);pending.delete(result.id);
    if(result.error)job.reject(new Error(result.error));else job.resolve(result);
   });
  });
 }
 const startupMs=performance.now()-startup,samples=[];
 function invoke(mode,slot){
  if(mode==='inline')return {output:compute(records,context)};
  return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});workers[slot].postMessage({id:key,records:mode==='json'?JSON.stringify(records):records,context,mode});});
 }
 // Warm each implementation once, separately from recorded samples.
 for(const [mode,slot] of [['inline',0],['clone',0],['clone',1],['json',0]]){const r=await invoke(mode,slot);assert.deepEqual(mode==='json'?JSON.parse(r.output):r.output,expected);}
 for(let round=0;round<3;round++)for(const count of [1,5]){
  const variants=[['inline',0],['clone',1],['json',1],['clone',2]];
  if(round%2)variants.reverse();
  for(const [mode,size]of variants){
   const completions=[],workerTimes=[],ticks=[];let last=performance.now();
   const timer=setInterval(()=>{const now=performance.now();ticks.push(now-last);last=now;},10);
   await delay(20);const start=performance.now();
   const outputs=await Promise.all(Array.from({length:count},(_,i)=>(async()=>{const r=await invoke(mode,size?i%size:0);const output=mode==='json'?JSON.parse(r.output):r.output;completions.push(performance.now()-start);if(r.workerMs!==undefined)workerTimes.push(r.workerMs);return output;})()));
   const elapsedMs=performance.now()-start;await immediate();await delay(20);clearInterval(timer);
   const result={round,count,mode,workers:size,elapsedMs,completionMs:completions,workerTimesMs:workerTimes,maxMainTimerGapMs:Math.max(...ticks)};samples.push(result);
   for(const output of outputs)assert.deepEqual(output,expected);assert.equal(JSON.stringify(records),original);
   process.stderr.write(`${mode}/${size} x${count}: ${elapsedMs.toFixed(1)}ms, main gap ${result.maxMainTimerGapMs.toFixed(1)}ms\n`);
  }
 }
 const report={scope:'Synthetic pure hydrate/reduce/validate/project/XP experiment; no DB/auth/transaction/network; warm workers; not an integrated server or capacity acceptance',startupMs,recordsBytes:Buffer.byteLength(original),occurrences:73000,samples,parity:'Every full result equals inline reference; input records unchanged',limitations:['No SQL read/parse or row-delta/write cost','No causal/priority authorization or receipts/cancellation','No worker crash/restart/queue production contract']};
 await writeFile('/tmp/rise-worker-probe/results.json',JSON.stringify(report,null,2));
}finally{await Promise.all(workers.map(w=>w.terminate()));}
