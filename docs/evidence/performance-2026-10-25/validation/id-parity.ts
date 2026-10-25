import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {id as before} from './validation-before.ts';
import {id as candidate} from './validation-candidate.ts';
function outcome(check:typeof before,value:unknown) {
 try {check(value,'profile.days[0].habitId');return {accepted:true};}
 catch(error) {assert.ok(error instanceof Error && 'path' in error);return {accepted:false,path:error.path,message:error.message};}
}
let comparisons=0;
function compare(value:unknown) {assert.deepEqual(outcome(before,value),outcome(candidate,value));comparisons++;}
for(let code=0;code<=0x10ffff;code++) {
 const char=String.fromCodePoint(code);
 for(const value of [char+'id','i'+char+'d','id'+char])compare(value);
}
for(const value of ['',null,undefined,0,false,{},[], '🌱'.repeat(160),'🌱'.repeat(161),'a'.repeat(160),'a'.repeat(161),'e\u0301'.repeat(80),'e\u0301'.repeat(81)])compare(value);
const result={comparisons,allCodePoints:1114112,positions:['start','middle','end'],acceptedValuesAndExactErrorsMatch:true};
await writeFile('.rise-infra/quality03-20261025/id-parity.json',JSON.stringify(result,null,2));console.log(result);
