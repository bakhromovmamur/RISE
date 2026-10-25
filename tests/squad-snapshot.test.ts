import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildSquadSnapshot} from '../src/domain/squadSnapshot';
import {parseSquadPreviewRequest,parseSquadSnapshot,parseSquadPage,parseSquadQuery} from '../src/contracts/squads';
import {parseGroupOperation,parsePendingGroupIntent} from '../src/contracts/groups';
import {syncGuest} from './support/syncData';

const accountId=randomUUID(),groupId=randomUUID(),postId=randomUUID(),week='2026-10-19';
const request={accountId,groupId,postId,groupRevision:3,postRevision:0,personalRevision:2,week,note:'A chosen reflection',choices:{habits:false,milestones:false,prayers:false}};
test('squad input is an exact opt-in contract and publish cannot carry a replacement payload or actor',()=>{
 assert.deepEqual(parseSquadPreviewRequest(request),request);
 for(const fields of [{ownerId:accountId},{habits:10},{pause:true},{snapshot:{week,note:'hidden'}},{choices:{...request.choices,coordinates:true}},{week:'2026-10-20'},{note:'\u0001'},{note:'🌱'.repeat(601)},{note:'',choices:request.choices}])assert.throws(()=>parseSquadPreviewRequest({...request,...fields}));
 const operation={accountId,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:3,command:{kind:'squad.publish',groupId,postId,previewId:randomUUID(),hash:'a'.repeat(64)}};
 assert.deepEqual(parsePendingGroupIntent({type:'command',operation},accountId),{type:'command',operation});
 for(const fields of [{snapshot:{week,note:'Changed'}},{ownerId:accountId},{postId:'old-local-id'},{hash:'bad'}])assert.throws(()=>parseGroupOperation({...operation,command:{...operation.command,...fields}}));
 for(const fields of [{privateHabitNames:['name']},{pause:false},{prayerDates:[]},{milestones:['🌱'.repeat(161)]},{prayers:36},{habits:-1}])assert.throws(()=>parseSquadSnapshot({week,note:'Chosen',...fields}));
});
test('server snapshot contains only chosen totals and titles, preserves source records and stays fixed after corrections',()=>{
 const state=syncGuest('2026-10-23');state.goals[0].milestones[0].completedOn='2026-10-22';const before=structuredClone(state),now=Date.parse('2026-10-23T18:00:00Z');
 assert.deepEqual(buildSquadSnapshot(state,request,now),{week,note:request.note});
 const snapshot=buildSquadSnapshot(state,{...request,choices:{habits:true,milestones:true,prayers:true}},now);
 assert.deepEqual(snapshot,{week,note:request.note,habits:1,milestones:['Synthetic first step'],prayers:1});assert.deepEqual(state,before);
 assert.doesNotMatch(JSON.stringify(snapshot),/private|reading|pause|latitude|longitude|calculation|performedAt|fajr/i);
 delete state.days['2026-10-21'][0].check;delete state.goals[0].milestones[0].completedOn;delete state.prayers.days['2026-10-22'].entries.fajr.check;
 assert.deepEqual(snapshot,{week,note:request.note,habits:1,milestones:['Synthetic first step'],prayers:1});
 assert.deepEqual(buildSquadSnapshot(state,{...request,choices:{habits:true,milestones:true,prayers:true}},now),{week,note:request.note,habits:0,milestones:[],prayers:0});
});
test('the injected instant and selected personal timezone bound elapsed totals, without consulting a demo clock',()=>{
 const state=syncGuest('2026-10-23');state.timezone='Pacific/Kiritimati';state.goals[0].milestones[0].completedOn='2026-10-24';state.mode='demo';state.demoDate='2099-01-01';
 const input={...request,choices:{habits:false,milestones:true,prayers:false}};
 assert.deepEqual(buildSquadSnapshot(state,input,Date.parse('2026-10-23T09:59:00Z')).milestones,[]);
 assert.deepEqual(buildSquadSnapshot(state,input,Date.parse('2026-10-23T10:00:00Z')).milestones,['Synthetic first step']);
 state.goals[0].milestones=Array.from({length:101},(_,i)=>({id:String(i),title:'Chosen title',completedOn:'2026-10-23'}));
 assert.throws(()=>buildSquadSnapshot(state,input,Date.parse('2026-10-23T12:00:00Z'))); // Never silently truncate selected titles.
});
test('squad pages are bounded and match their week, revision and continuation, without hidden owner metadata',()=>{
 const post={id:postId,groupId,authorMemberId:randomUUID(),revision:2,publishedAt:'2026-10-23T12:00:00Z',updatedAt:'2026-10-23T12:00:00Z',snapshot:{week,note:'Chosen'},reactions:{count:1,mine:true}};
 const page={accountId,groupId,week,revision:3,rows:[post],next:null};assert.deepEqual(parseSquadPage(page),page);
 for(const row of [{...post,ownerId:accountId},{...post,revision:4},{...post,groupId:randomUUID()},{...post,snapshot:{week:'2026-10-12',note:'Wrong week'}},{...post,reactions:{count:0,mine:true}}])assert.throws(()=>parseSquadPage({...page,rows:[row]}));
 assert.throws(()=>parseSquadPage({...page,rows:[post,post]}));assert.throws(()=>parseSquadQuery({groupId,week,cursor:postId}));
 assert.deepEqual(parseSquadQuery({groupId,week,revision:3,cursor:postId}),{groupId,week,revision:3,cursor:postId});
 const rows=Array.from({length:20},()=>({...post,id:randomUUID()}));assert.equal(parseSquadPage({...page,rows,next:rows.at(-1)!.id}).rows.length,20);
 assert.throws(()=>parseSquadPage({...page,rows,next:randomUUID()}));assert.throws(()=>parseSquadPage({...page,rows:[...rows,{...post,id:randomUUID()}]}));
});
