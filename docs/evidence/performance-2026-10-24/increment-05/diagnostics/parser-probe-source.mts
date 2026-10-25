import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {capacityProfile} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/capacity.ts';
import {parseStoredState as original} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/data/storedState.ts';
import {parseStoredState as candidate} from '/tmp/rise-quality03-parsed-json-experiment/src/data/storedState.ts';
import {parseJson as oldJson} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/data/validation.ts';
import {parseJson as newJson} from '/tmp/rise-quality03-parsed-json-experiment/src/data/validation.ts';
const raw=JSON.stringify(capacityProfile('2026-10-24')),samples=[];
for(let i=0;i<5;i++)for(const [label,parse] of [['original',original],['candidate',candidate]] as const){const start=performance.now(),value=parse(raw),ms=performance.now()-start;assert.equal(JSON.stringify(value),raw);samples.push({label,ms});}
const values=['null','true','1e400','{"__proto__":{}}','{"constructor":0}','{"prototype":0}','{"safe":{"constructor":0}}','[null,1,"hello"]','{','"unterminated'];
for(let depth=0;depth<25;depth++){values.push('['.repeat(depth)+'0'+']'.repeat(depth));values.push('{"x":'.repeat(depth)+'{}'+'}'.repeat(depth));}
values.push(JSON.stringify(Array.from({length:250000},()=>({}))));values.push(JSON.stringify(Array.from({length:250001},()=>({}))));
const outcome=(parse:(raw:string)=>unknown,raw:string)=>{try{return{ok:true,value:parse(raw)};}catch(error){return{ok:false,name:error instanceof Error?error.name:'unknown',path:typeof error==='object'&&error&&'path'in error?error.path:null};}};
for(const value of values)assert.deepEqual(outcome(oldJson,value),outcome(newJson,value));
writeFileSync('/tmp/rise-quality03-parsed-json-experiment.json',JSON.stringify({scope:'Unapplied isolated Node experiment, not browser/device acceptance. Application source remains unchanged.',samples,differentialCases:values.length},null,2));
console.log('Isolated parser experiment passed equivalent output/rejection checks.');
