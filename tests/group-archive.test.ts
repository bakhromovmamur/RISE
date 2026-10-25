import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGroupArchive,parseGroupArchive,parseGroupArchiveRequest,type GroupArchivePayload} from '../src/contracts/groupArchive.ts';
import {contentHash,previewRestore} from '../src/data/backup.ts';
import {createEmptyState} from '../src/data/initialState.ts';
import {MAX_BYTES} from '../src/data/validation.ts';

function fixture():GroupArchivePayload{
 const groupId=randomUUID(),member=randomUUID(),former=randomUUID(),taskId=randomUUID(),listId=randomUUID();
 return {format:'rise.group-archive',version:1,exportedAt:'2026-10-24T00:00:00.000Z',group:{id:groupId,kind:'family',name:'Chosen family',timezone:'Asia/Tashkent',revision:10,archived:true,members:[{id:member,name:'Chosen name',role:'owner',self:true}]},content:{kind:'family',
  tasks:[{id:taskId,groupId,revision:9,title:'Edited task',notes:'<script>plain text</script> · Русский · O‘zbek',assignee:null,date:'2026-10-24',time:null,weekdays:[],archived:true}],
  lists:[{id:listId,groupId,revision:2,name:'Groceries',archived:true}],items:[{id:randomUUID(),listId,groupId,revision:3,text:'Milk',quantity:'2',checked:true,position:1}],
  occurrences:[{groupId,taskId,date:'2026-10-23',completed:true,byMemberId:former,at:'2026-10-23T12:00:00.000Z',revision:5,snapshot:{title:'Original task',notes:'Retained shared history',assignee:former,time:'10:30',timezone:'Pacific/Kiritimati',taskRevision:2}}],
 }};
}
test('shared archive preserves exact current fields and historical snapshots with opaque former-member references',async()=>{
 const source=fixture(),before=structuredClone(source),raw=await createGroupArchive(source),{checksum,...parsed}=await parseGroupArchive(raw);
 assert.deepEqual(parsed,source);assert.equal(checksum.value,await contentHash(source));assert.deepEqual(source,before);
 const current={state:createEmptyState(),archives:[],revision:7},original=structuredClone(current);
 await assert.rejects(previewRestore(raw,current));assert.deepEqual(current,original,'shared archive cannot restore membership or personal state');
});
test('squad archive preserves exact published snapshots and only aggregate/current-viewer encouragement',async()=>{
 const source=fixture();source.group.kind='squad';source.content={kind:'squad',posts:[{id:randomUUID(),groupId:source.group.id,authorMemberId:randomUUID(),revision:4,publishedAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-21T00:00:00Z',snapshot:{week:'2026-10-19',note:'Only what I shared',habits:0},reactions:{count:1,mine:true}}]};
 assert.deepEqual((await parseGroupArchive(await createGroupArchive(source))).content,source.content);
});
test('archive rejects future versions, unknown private fields, broken references, duplicate records and invalid chronology before restore',async()=>{
 const original=fixture();if(original.content.kind!=='family')throw new Error('fixture');
 const edits:((x:GroupArchivePayload)=>void)[]=[
  x=>Reflect.set(x,'version',2),x=>Reflect.set(x.group,'ownerId',randomUUID()),x=>Reflect.set(x.group,'preferences',{notifications:true}),x=>Reflect.set(x.group.members[0],'email','private@example.invalid'),
  x=>{x.group.members.push({...x.group.members[0]});},x=>{x.group.members[0].self=false;},x=>{x.group.kind='squad';},
  x=>{if(x.content.kind==='family')x.content.tasks=[];},x=>{if(x.content.kind==='family')x.content.lists=[];},
  x=>{if(x.content.kind==='family')x.content.items.push({...x.content.items[0],id:randomUUID()});},
  x=>{if(x.content.kind==='family')x.content.occurrences[0].completed=false;},x=>{if(x.content.kind==='family')x.content.occurrences[0].snapshot.taskRevision=10;},
  x=>{if(x.content.kind==='family')x.content.tasks[0].groupId=randomUUID();},x=>{if(x.content.kind==='family')x.content.tasks[0].date='2026-02-30';},
 ];
 for(const edit of edits){const bad=structuredClone(original);edit(bad);await assert.rejects(createGroupArchive(bad));}
 const raw=await createGroupArchive(original);await assert.rejects(parseGroupArchive(raw.replace('Edited task','Tampered task')));
 await assert.rejects(parseGroupArchive(raw.replace('"version":1','"__proto__":{},"version":1')));
 const squad=structuredClone(original);squad.group.kind='squad';squad.content={kind:'squad',posts:[{id:randomUUID(),groupId:squad.group.id,authorMemberId:randomUUID(),revision:4,publishedAt:'2026-10-21T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z',snapshot:{week:'2026-10-19',note:'Shared'},reactions:{count:0,mine:true}}]};
 await assert.rejects(createGroupArchive(squad));
});
test('archive request and whole-file bounds reject malformed, oversized and excessively nested input',async()=>{
 const accountId=randomUUID();assert.deepEqual(parseGroupArchiveRequest({accountId,revision:1}),{accountId,revision:1});
 for(const request of [{accountId,revision:0},{accountId,revision:1,owner:true},{accountId:'bad',revision:1},null])assert.throws(()=>parseGroupArchiveRequest(request));
 await assert.rejects(parseGroupArchive(' '.repeat(MAX_BYTES+1)));
 const deep:Record<string,unknown>={};let node=deep;for(let i=0;i<22;i++){const child={};node.next=child;node=child;}await assert.rejects(createGroupArchive(deep));
 const many=fixture();Reflect.set(many,'extra',Array.from({length:250001},()=>({})));await assert.rejects(createGroupArchive(many));
});
