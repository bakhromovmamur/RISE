import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseGroupOperation,parsePendingGroupIntent} from '../src/contracts/groups';
import {parseSharedQuery,parseSharedPage,sharedTaskOccurs,type SharedTask} from '../src/contracts/sharedContent';
import {dateInZone} from '../src/domain/zonedTime';

const groupId=randomUUID(),taskId=randomUUID(),owner=randomUUID();
const task:SharedTask={id:taskId,groupId,title:'Shared task',notes:'Only shared notes',assignee:null,date:'2026-10-23',time:'09:30',weekdays:[5],archived:false,revision:2};
test('shared commands validate identities, dates, recurrence and fields before durable pending storage',()=>{
 const operation={accountId:owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:2,command:{kind:'task.create',groupId,taskId,title:task.title,notes:task.notes,assignee:null,date:task.date,time:task.time,weekdays:task.weekdays}};
 assert.deepEqual(parsePendingGroupIntent({type:'command',operation},owner),{type:'command',operation});
 for(const changes of [{ownerId:owner},{assignee:'self'},{weekdays:[5,5]},{weekdays:[7]},{date:'2026-02-30'},{date:'0000-01-01'},{time:'25:00'},{title:'\n'},{notes:'\u0001'},{taskId:'legacy-id'}])assert.throws(()=>parseGroupOperation({...operation,command:{...operation.command,...changes}}));
 assert.throws(()=>parsePendingGroupIntent({type:'command',operation},randomUUID()));
 assert.throws(()=>parseGroupOperation({...operation,command:{...operation.command,byMemberId:owner}}));
});
test('shared civil recurrence follows group date across viewer zones and DST without shifting stored history',()=>{
 const instant=Date.parse('2026-10-23T23:30:00Z');
 assert.equal(dateInZone(instant,'America/Los_Angeles'),'2026-10-23');assert.equal(dateInZone(instant,'Asia/Tashkent'),'2026-10-24');
 assert.equal(sharedTaskOccurs(task,dateInZone(instant,'America/Los_Angeles')),true);assert.equal(sharedTaskOccurs(task,dateInZone(instant,'Asia/Tashkent')),false);
 assert.equal(sharedTaskOccurs(task,'2026-10-16'),false);assert.equal(sharedTaskOccurs({...task,archived:true},task.date),false);
 assert.equal(sharedTaskOccurs({...task,date:'2026-11-01',weekdays:[0]},dateInZone(Date.parse('2026-11-01T06:30:00Z'),'America/New_York')),true);
});
test('shared pages require a matching revision cursor, bounded rows and one group projection',()=>{
 assert.deepEqual(parseSharedQuery({groupId,collection:'occurrences',date:'2026-10-23'}),{groupId,collection:'occurrences',date:'2026-10-23'});
 for(const q of [{collection:'occurrences'},{collection:'tasks',cursor:taskId},{collection:'items'},{collection:'items',parentId:taskId,cursor:'0',revision:2},{collection:'tasks',date:task.date},{collection:'lists',ownerId:owner}])assert.throws(()=>parseSharedQuery({groupId,...q}));
 const page={accountId:owner,groupId,revision:2,collection:'tasks',rows:[task],next:null};assert.deepEqual(parseSharedPage(page),page);
 for(const rows of [[task,task],[{...task,groupId:randomUUID()}],[{...task,revision:3}],Array.from({length:51},()=>({...task,id:randomUUID()}))])assert.throws(()=>parseSharedPage({...page,rows}));
 assert.throws(()=>parseSharedPage({...page,next:taskId}));
 const full=Array.from({length:50},()=>({...task,id:randomUUID()}));assert.throws(()=>parseSharedPage({...page,rows:full,next:randomUUID()}));assert.equal(parseSharedPage({...page,rows:full,next:full.at(-1)!.id}).rows.length,50);
});
