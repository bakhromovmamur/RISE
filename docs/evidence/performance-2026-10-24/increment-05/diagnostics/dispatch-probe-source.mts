import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {capacityProfile} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/tests/support/capacity.ts';
import {parseOperation} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/commands.ts';
import {applyDomainCommand} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/domain/commands.ts';
import {parseStoredState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/data/storedState.ts';

const date='2026-10-24',state=capacityProfile(date),samples=[];
for(let i=0;i<5;i++){
 const start=performance.now();
 const operation=parseOperation({protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:0,context:{date,now:Date.parse(date+'T12:00:00Z'),timezone:'UTC'},command:{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'}});
 const parsedCommand=performance.now();
 const next=applyDomainCommand(state,operation.command,operation.context),reduced=performance.now();
 const raw=JSON.stringify(next),serialized=performance.now();
 const parsed=parseStoredState(raw),validated=performance.now();
 const again=JSON.stringify(parsed),reserialized=performance.now();
 const original=JSON.stringify(state),compared=performance.now();
 assert.equal(raw,again);assert.notEqual(again,original);
 samples.push({commandMs:parsedCommand-start,reducerMs:reduced-parsedCommand,serializeNextMs:serialized-reduced,parseValidateMs:validated-serialized,reserializeMs:reserialized-validated,serializeCurrentMs:compared-reserialized,totalMs:compared-start});
}
writeFileSync('/tmp/rise-quality03-dispatch-phases.json',JSON.stringify({scope:'Node discovery only; unchanged application source; does not measure rendering or durable storage.',habits:100,dates:730,samples},null,2));
console.log(JSON.stringify(samples));
