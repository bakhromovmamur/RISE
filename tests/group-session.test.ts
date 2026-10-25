import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GroupSession} from '../src/groups/session.ts';
import {AccountError} from '../src/auth/client.ts';
import {createEmptyState} from '../src/data/initialState.ts';
import {applyDomainCommand} from '../src/domain/commands.ts';
import {projectBackup} from '../src/data/backupProjection.ts';
import type {DomainCommand} from '../src/contracts/commands.ts';
import type {AccountSession} from '../src/contracts/auth.ts';
import type {SessionView} from '../src/data/deviceSession.ts';
import {parsePendingGroupIntent,type AccountGroup,type GroupOperation,type GroupPreview,type GroupReceipt} from '../src/contracts/groups.ts';
import {captureInvitation} from '../src/groups/invitation.ts';
import {GROUP_INTENT_KEY,groupIntentPending} from '../src/groups/intent.ts';
import {taskCommand,type TaskDraft} from '../src/groups/sharedDrafts.ts';
import type {SquadDraft} from '../src/groups/squadDrafts.ts';
function setup(){
 const owner=randomUUID(),groupId=randomUUID(),listeners=new Set<()=>void>();let state=createEmptyState(),saved=true,clearFails=false;
 const identity:AccountSession={signedIn:true,csrfToken:'a'.repeat(64),delivery:'email',account:{id:owner,email:'synthetic@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+100000).toISOString()}};
 const workspace={scope:owner,getAccountIdentity:()=>identity,getSnapshot:():SessionView=>({state,status:'saved',error:null}),subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},dispatch:(command:DomainCommand)=>{if(command.kind==='draft.clear'&&clearFails)return null;state=applyDomainCommand(state,command);listeners.forEach(fn=>fn());return state;},whenSaved:async()=>saved};
 const operations:GroupOperation[]=[],receipts=new Map<string,GroupReceipt>();let fail=false;
 const preview:GroupPreview={id:groupId,name:'Shared space',kind:'family',timezone:'UTC',expiresAt:new Date(Date.now()+100000).toISOString()};
 const client={read:async():Promise<AccountGroup[]>=>[],preview:async()=>preview,apply:async(op:GroupOperation)=>{operations.push(structuredClone(op));const receipt={operationId:op.operationId,groupId:'groupId' in op.command?op.command.groupId:groupId,revision:1};receipts.set(op.operationId,receipt);if(fail)throw new AccountError('unavailable');return receipt;},receipt:async(id:string)=>receipts.get(id)??null};
 const session=new GroupSession(owner,workspace,client),create={kind:'group.create' as const,groupId,groupKind:'family' as const,name:'A family',timezone:'UTC',nickname:'An explicit nickname'};
 return {owner,groupId,workspace,client,session,operations,receipts,preview,create,state:()=>state,setSaved:(v:boolean)=>{saved=v;},setFailure:(v:boolean)=>{fail=v;},setClearFailure:(v:boolean)=>{clearFails=v;}};
}
test('legacy notification preference retries preserve their exact body and cannot erase a newer explicit choice',async()=>{
 const h=setup(),key=`server-group-preferences:${h.groupId}`,draft={muted:false,quietStart:'22:00',quietEnd:'07:00',revision:3};
 h.workspace.dispatch({kind:'draft.save',key,value:draft});h.setFailure(true);await h.session.execute({kind:'group.preferences',groupId:h.groupId,muted:false,quietStart:'22:00',quietEnd:'07:00'},3);
 const original=structuredClone(h.operations[0]),newer={...draft,notifications:true};h.workspace.dispatch({kind:'draft.save',key,value:newer});h.session.close();h.setFailure(false);
 const resumed=new GroupSession(h.owner,h.workspace,h.client);assert.ok(await resumed.retry());assert.deepEqual(h.operations[1],original);assert.equal(Object.hasOwn(h.operations[1].command,'notifications'),false);assert.deepEqual(h.state().life.drafts[key],newer);resumed.close();
});
test('accepted explicit notification preferences clear only the matching durable choice',async()=>{
 for(const change of [false,true]){const h=setup(),key=`server-group-preferences:${h.groupId}`,draft={muted:false,quietStart:'00:00',quietEnd:'00:00',notifications:true,revision:3};
  h.workspace.dispatch({kind:'draft.save',key,value:draft});h.setFailure(true);await h.session.execute({kind:'group.preferences',groupId:h.groupId,muted:draft.muted,quietStart:draft.quietStart,quietEnd:draft.quietEnd,notifications:true},3);
  if(change)h.workspace.dispatch({kind:'draft.save',key,value:{...draft,notifications:false}});h.setFailure(false);assert.ok(await h.session.retry());assert.deepEqual(h.state().life.drafts[key],change?{...draft,notifications:false}:undefined);assert.deepEqual(h.operations[0],h.operations[1]);h.session.close();
 }
});
test('an exact squad publish retry clears its reviewed draft but cannot erase a newer private edit',async()=>{
 for(const newer of [false,true]){
  const h=setup(),postId=randomUUID(),previewId=randomUUID(),key=`server-squad:${h.groupId}:2026-10-19`,draft:SquadDraft={postId,postRevision:0,groupRevision:4,note:'My chosen words',choices:{habits:true,milestones:false,prayers:false},preview:{id:previewId,hash:'a'.repeat(64)}};
  h.workspace.dispatch({kind:'draft.save',key,value:draft});h.setFailure(true);await h.session.execute({kind:'squad.publish',groupId:h.groupId,postId,previewId,hash:draft.preview!.hash},4);
  assert.equal(projectBackup(h.state()).personal.life.drafts[key],undefined);assert.doesNotMatch(JSON.stringify(h.operations[0]),/My chosen words|habits|milestones|prayers/);
  const changed={...draft,note:'Newer private text'};delete changed.preview;if(newer)h.workspace.dispatch({kind:'draft.save',key,value:changed});
  h.session.close();h.setFailure(false);const resumed=new GroupSession(h.owner,h.workspace,h.client);assert.ok(await resumed.retry());assert.deepEqual(h.operations[0],h.operations[1]);assert.deepEqual(h.state().life.drafts[key],newer?changed:undefined);resumed.close();
 }
});
test('group changes persist intent before sending and retry identical operations after a lost reply',async()=>{
 const h=setup();h.setFailure(true);assert.equal(await h.session.execute(h.create,0),null);assert.equal(h.operations.length,1);assert.equal(groupIntentPending(h.state()),1);
 const pending=h.state().life.drafts[GROUP_INTENT_KEY];assert.deepEqual(parsePendingGroupIntent(pending,h.owner),{type:'command',operation:h.operations[0]});
 assert.equal(projectBackup(h.state()).personal.life.drafts[GROUP_INTENT_KEY],undefined);
 assert.equal(await h.session.execute({...h.create,groupId:randomUUID()},0),null);assert.equal(h.operations.length,1);
 h.session.close();const resumed=new GroupSession(h.owner,h.workspace,h.client);h.setFailure(false);
 assert.ok(await resumed.retry());assert.deepEqual(h.operations[1],h.operations[0]);assert.equal(groupIntentPending(h.state()),0);resumed.close();
});
test('unsaved intent never reaches the network and successful server actions retain cleanup recovery',async()=>{
 const h=setup();h.setSaved(false);assert.equal(await h.session.execute(h.create,0),null);assert.equal(h.operations.length,0);assert.equal(h.session.getSnapshot().error,'storage');
 h.setSaved(true);h.setClearFailure(true);assert.equal(await h.session.retry(),null);assert.equal(h.session.getSnapshot().error,'cleanup_pending');assert.equal(groupIntentPending(h.state()),1);
 h.setClearFailure(false);assert.ok(await h.session.retry());assert.deepEqual(h.operations[0],h.operations[1]);assert.equal(groupIntentPending(h.state()),0);h.session.close();
});
test('accepted retries clear only their matching form and preserve an independent or newer draft',async()=>{
 const h=setup();h.workspace.dispatch({kind:'draft.save',key:'server-group-create:family',value:{name:h.create.name,nickname:h.create.nickname,timezone:h.create.timezone}});h.setFailure(true);await h.session.execute(h.create,0);
 h.workspace.dispatch({kind:'draft.save',key:'server-group-create:family',value:{name:'Another proposed family',nickname:h.create.nickname,timezone:h.create.timezone}});h.setFailure(false);assert.ok(await h.session.retry());assert.equal((h.state().life.drafts['server-group-create:family'] as {name:string}).name,'Another proposed family');h.session.close();
 const next=setup();next.workspace.dispatch({kind:'draft.save',key:'server-group-create:family',value:{name:next.create.name,nickname:next.create.nickname,timezone:next.create.timezone}});assert.ok(await next.session.execute(next.create,0));assert.equal(next.state().life.drafts['server-group-create:family'],undefined);next.session.close();
});
test('accepted shared task retries clear the matching durable draft and keep one captured operation',async()=>{
 const h=setup(),draft:TaskDraft={taskId:randomUUID(),revision:4,title:'  A shared task  ',notes:'User authored note',assignee:'',date:'2026-10-23',time:'',weekdays:[1,5]},key=`server-task:${h.groupId}:new`;
 h.workspace.dispatch({kind:'draft.save',key,value:draft});h.setFailure(true);assert.equal(await h.session.execute(taskCommand(h.groupId,draft,false),4),null);const pending=h.state().life.drafts[GROUP_INTENT_KEY];
 assert.deepEqual(h.state().life.drafts[key],draft);assert.equal(projectBackup(h.state()).personal.life.drafts[key],undefined);h.session.close();h.setFailure(false);
 const resumed=new GroupSession(h.owner,h.workspace,h.client);assert.ok(await resumed.retry());assert.deepEqual(h.operations[0],h.operations[1]);assert.equal(h.operations[0].command.kind,'task.create');assert.equal(h.state().life.drafts[key],undefined);assert.equal(h.state().life.drafts[GROUP_INTENT_KEY],undefined);assert.ok(pending);resumed.close();
});
test('shared acceptance cannot clear a newer item draft, another list or an advanced reviewed revision',async()=>{
 for(const change of ['text','revision'] as const){const h=setup(),listId=randomUUID(),key=`server-item:${h.groupId}:${listId}`,otherKey=`server-item:${h.groupId}:${randomUUID()}`,draft={itemId:randomUUID(),revision:6,editing:false,text:' Bread ',quantity:' One loaf '};
  h.workspace.dispatch({kind:'draft.save',key,value:draft});h.workspace.dispatch({kind:'draft.save',key:otherKey,value:draft});h.setFailure(true);await h.session.execute({kind:'item.add',groupId:h.groupId,listId,itemId:draft.itemId,text:'Bread',quantity:'One loaf'},6);
  const newer={...draft,...(change==='text'?{text:'Next item'}:{revision:7})};h.workspace.dispatch({kind:'draft.save',key,value:newer});h.setFailure(false);assert.ok(await h.session.retry());assert.deepEqual(h.state().life.drafts[key],newer);assert.deepEqual(h.state().life.drafts[otherKey],draft);h.session.close();
 }
 const h=setup(),listId=randomUUID(),key=`server-list:${h.groupId}:new`;h.workspace.dispatch({kind:'draft.save',key,value:{name:'  Shopping  ',listId,revision:2}});assert.ok(await h.session.execute({kind:'list.create',name:'Shopping',listId,groupId:h.groupId},2));assert.equal(h.state().life.drafts[key],undefined);h.session.close();
});
test('join secrets never enter durable drafts or exports; a reload checks the original receipt without a token',async()=>{
 const h=setup(),token='x'.repeat(43);h.setFailure(true);assert.equal(await h.session.join(h.preview,token,'Shared nickname'),null);
 assert.doesNotMatch(JSON.stringify(h.state()),new RegExp(token));assert.deepEqual(h.state().life.drafts[GROUP_INTENT_KEY],{type:'join',accountId:h.owner,operationId:h.operations[0].operationId,groupId:h.groupId});
 h.session.close();const resumed=new GroupSession(h.owner,h.workspace,h.client);assert.ok(await resumed.retry());assert.equal(h.operations.length,1);assert.equal(groupIntentPending(h.state()),0);resumed.close();
});
test('a join interrupted before acceptance is retained for explicit review, never automatically recreated',async()=>{
 const h=setup();h.setSaved(false);await h.session.join(h.preview,'x'.repeat(43),'Nickname');h.session.close();h.setSaved(true);
 const resumed=new GroupSession(h.owner,h.workspace,h.client);assert.equal(await resumed.retry(),null);assert.equal(resumed.getSnapshot().error,'invitation_reopen');assert.equal(h.operations.length,0);assert.equal(groupIntentPending(h.state()),1);assert.equal(await resumed.discard(),true);assert.equal(groupIntentPending(h.state()),0);resumed.close();
});
test('account changes fence late server responses and cannot clear another account draft',async()=>{
 const h=setup();let resolve!:(r:GroupReceipt)=>void;h.client.apply=async op=>{h.operations.push(op);return new Promise<GroupReceipt>(r=>{resolve=r;});};
 const pending=h.session.execute(h.create,0);await new Promise(r=>setImmediate(r));h.workspace.scope=randomUUID();resolve({operationId:h.operations[0].operationId,groupId:h.groupId,revision:1});
 assert.equal(await pending,null);assert.equal(groupIntentPending(h.state()),1);assert.equal(h.session.getSnapshot().receipt,null);h.session.close();
});
test('invitation capture removes secrets from navigation history and rejects ambiguous fragments',()=>{
 for(const hash of ['#invite='+'x'.repeat(43),'#invite=bad','#invite='+'x'.repeat(43)+'&invite='+'y'.repeat(43),'#invite='+'x'.repeat(43)+'&next=elsewhere']){
  const calls:unknown[][]=[],history={replaceState:(...args:unknown[])=>{calls.push(args);}};
  const result=captureInvitation({hash,pathname:'/',search:'?view=welcome'},history);assert.equal(calls.length,1);assert.deepEqual(calls[0],[null,'','/?view=welcome']);assert.equal(result,hash==='#invite='+'x'.repeat(43)?'x'.repeat(43):'invalid');
 }
 let changed=false;assert.equal(captureInvitation({hash:'#unrelated',pathname:'/',search:''},{replaceState:()=>{changed=true;}}),null);assert.equal(changed,false);
});
