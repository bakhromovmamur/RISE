import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {writeRecords as original} from './before.mts';
import {writeRecords as candidate} from './candidate.mts';
const root=process.cwd(),{capacityProfile}=await import(pathToFileURL(`${root}/tests/support/capacity.ts`).href),{project}=await import(pathToFileURL(`${root}/src/contracts/personalRecords.ts`).href),{applyDomainCommand}=await import(pathToFileURL(`${root}/src/domain/commands.ts`).href);
const date='2026-10-24',state=capacityProfile(date),context={date,now:Date.parse(date+'T12:00:00Z'),timezone:'UTC'};
const checked=applyDomainCommand(state,{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'},context);
const tiny=applyDomainCommand(checked,{kind:'habit.correct',habitId:state.habits[0].id,date,check:'tiny'},context);
const before=project(state,date),full=project(checked,date),partial=project(tiny,date);
const cases=[['no-op',before,structuredClone(before)],['full',before,full],['undo',full,before],['correction',full,partial],['reordered',before,{...full,habit_occurrences:[...full.habit_occurrences].reverse()}],['removed',before,{...before,habit_occurrences:before.habit_occurrences.slice(1)}]] as const;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),inputHash=digest(cases),samples=[];
for(let round=-1;round<5;round++)for(const [name,from,to]of cases){
 let reference:unknown;
 for(const [variant,run]of (round%2?[['candidate',candidate],['original',original]]:[['original',original],['candidate',candidate]]) as const){
  const queries:unknown[]=[],client={query:async(sql:string,values:unknown[])=>{queries.push({sql,values:structuredClone(values)});return{};}},at=performance.now();
  await run(client as Parameters<typeof run>[0],'11111111-1111-4111-8111-111111111111',3,from,to,'22222222-2222-4222-8222-222222222222');
  const ms=performance.now()-at;if(reference)assert.deepEqual(queries,reference,`${name}:exact SQL/parameters`);else reference=queries;
  if(round>=0)samples.push({round,name,variant,ms,queryCount:queries.length,traceHash:digest(queries)});
 }
}
assert.equal(digest(cases),inputHash,'inputs_unchanged');
await writeFile('/tmp/rise-writer-alignment-probe/results.json',JSON.stringify({scope:'CPU-only writer probe; synthetic 73000-row profile; injected SQL collector compares every statement and parameter; no database/RLS/transaction acceptance',samples,parity:'All SQL statements/parameters identical; inputs unchanged'},null,2));
