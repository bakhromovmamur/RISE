import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GroupInvitations,emptyInvitations} from '../src/groups/invitations.ts';
import {parseGroupInvitationPage,parseGroupInvitationQuery,type GroupInvitationPage,type GroupInvitationQuery} from '../src/contracts/groupInvitations.ts';
import {parseGroups,type AccountGroup} from '../src/contracts/groups.ts';
import type {GroupState} from '../src/groups/session.ts';
import {AccountError} from '../src/auth/client.ts';
const owner='11111111-1111-4111-8111-111111111111',groupId='22222222-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333';
const invitation=(n:number)=>({id:`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,expiresAt:'2026-10-30T00:00:00.000Z',revoked:false,consumed:false});
const first=Array.from({length:20},(_,i)=>invitation(i+1)),second=Array.from({length:20},(_,i)=>invitation(i+21));
function setup(read:(query:GroupInvitationQuery,signal?:AbortSignal)=>Promise<GroupInvitationPage>){
 const group:AccountGroup={id:groupId,kind:'family',name:'Synthetic group',timezone:'UTC',revision:1,archived:false,members:[{id:member,name:'Owner',role:'owner',self:true}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:first,invitationNext:first.at(-1)!.id};
 const view:GroupState={groups:[group],loaded:true,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null},listeners=new Set<()=>void>();let current=true,refreshes=0;
 const reader=new GroupInvitations(owner,{getSnapshot:()=>view,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},refresh:async()=>{refreshes++;return true;}},{invitations:read},()=>current);
 return {reader,group,view,emit:()=>listeners.forEach(listener=>listener()),switchOwner:()=>{current=false;},refreshes:()=>refreshes};
}
const page=(rows=second,next:string|null=null,revision=1):GroupInvitationPage=>({accountId:owner,groupId,revision,rows,next});

test('invitation pages reject secret fields, oversized or duplicate rows and unversioned cursors',()=>{
 assert.deepEqual(parseGroupInvitationPage(page()),page());
 assert.deepEqual(parseGroupInvitationQuery({groupId,revision:1,cursor:first[19].id}),{groupId,revision:1,cursor:first[19].id});
 for(const value of [{groupId,cursor:first[0].id},{groupId,revision:1,token:'private'},{groupId,revision:0}])assert.throws(()=>parseGroupInvitationQuery(value));
 for(const value of [{...page(),token:'private'},page([...second,invitation(41)]),page([second[0],second[0]]),page(second,first[19].id),{...page(),rows:[{...second[0],tokenHash:'private'}]}])assert.throws(()=>parseGroupInvitationPage(value));
});

test('owner navigation keeps one bounded page and returns through stored cursors',async()=>{
 const calls:GroupInvitationQuery[]=[],h=setup(async query=>{calls.push(query);return query.cursor?page(second,second[19].id):page(first,first[19].id);});
 try{assert.deepEqual(h.reader.get(groupId).rows,first);assert.equal(await h.reader.load(groupId,'next'),true);assert.deepEqual(h.reader.get(groupId).rows,second);assert.equal(h.reader.get(groupId).rows.length,20);assert.equal(h.reader.get(groupId).previous,true);
  assert.equal(await h.reader.load(groupId,'previous'),true);assert.deepEqual(h.reader.get(groupId).rows,first);assert.equal(h.reader.get(groupId).previous,false);
  assert.deepEqual(calls,[{groupId,revision:1,cursor:first[19].id},{groupId,revision:1}]);
 }finally{h.reader.close();}
});

test('a changed revision, owner role or selected account discards a held invitation page',async()=>{
 let resolve!:(value:GroupInvitationPage)=>void,signal:AbortSignal|undefined;const h=setup((_query,abort)=>{signal=abort;return new Promise(done=>{resolve=done;});});
 try{const waiting=h.reader.load(groupId,'next');h.group.revision=2;h.group.invitations=[invitation(99)];h.group.invitationNext=null;h.emit();assert.equal(signal?.aborted,true);resolve(page());assert.equal(await waiting,false);assert.deepEqual(h.reader.get(groupId).rows,[invitation(99)]);
  h.group.members[0].role='member';h.emit();assert.deepEqual(h.reader.get(groupId),emptyInvitations);h.group.members[0].role='owner';h.switchOwner();assert.deepEqual(h.reader.get(groupId),emptyInvitations);
 }finally{h.reader.close();}
});

test('failed or unauthorized continuation hides stale actions and explicit reload starts from the first page',async()=>{
 const calls:GroupInvitationQuery[]=[],h=setup(async query=>{calls.push(query);if(query.cursor)throw new AccountError('group_changed');return page(first,first[19].id);});
 try{assert.equal(await h.reader.load(groupId,'next'),false);assert.equal(h.refreshes(),1);assert.deepEqual(h.reader.get(groupId).rows,[]);assert.equal(h.reader.get(groupId).loaded,false);assert.equal(h.reader.get(groupId).error,'group_changed');
  assert.equal(await h.reader.load(groupId,'first'),true);assert.deepEqual(h.reader.get(groupId).rows,first);assert.deepEqual(calls[1],{groupId,revision:1});
 }finally{h.reader.close();}
});


test('initial group reads enforce the same bounded owner-only invitation projection',()=>{
 const h=setup(async()=>page());
 try{const parse=(group:AccountGroup)=>parseGroups({accountId:owner,groups:[group]});assert.equal(parse(h.group).groups[0].invitations.length,20);
  assert.throws(()=>parse({...h.group,invitations:[...first,invitation(21)]}));
  assert.throws(()=>parse({...h.group,invitationNext:invitation(90).id}));
  const members=[{...h.group.members[0],role:'member' as const},{id:'55555555-5555-4555-8555-555555555555',name:'Current owner',self:false,role:'owner' as const}];
  assert.throws(()=>parse({...h.group,members}));assert.deepEqual(parse({...h.group,members,invitations:[],invitationNext:null}).groups[0].invitations,[]);
 }finally{h.reader.close();}
});

test('fresh owner metadata recovers an unavailable invitation page without retrying on busy state',async()=>{
 let attempts=0;const h=setup(async()=>{attempts++;throw new AccountError('unavailable');});
 try{
  assert.equal(await h.reader.load(groupId,'next'),false);const failed=h.reader.get(groupId);
  h.view.busy=true;h.emit();h.view.busy=false;h.emit();assert.equal(h.reader.get(groupId),failed);assert.equal(attempts,1);assert.equal(h.refreshes(),0);
  h.view.groups=h.view.groups.map(g=>({...g}));h.emit();const restored=h.reader.get(groupId);assert.equal(restored.error,null);assert.equal(restored.loaded,true);assert.deepEqual(restored.rows,first);assert.equal(restored.previous,false);assert.equal(attempts,1);
  await h.reader.load(groupId,'next');assert.equal(attempts,2);assert.equal(h.reader.get(groupId).error,'unavailable');h.emit();assert.equal(h.reader.get(groupId).error,'unavailable');
  h.switchOwner();h.view.groups=h.view.groups.map(g=>({...g}));h.emit();assert.equal(h.reader.get(groupId),emptyInvitations);assert.equal(await h.reader.load(groupId),false);assert.equal(attempts,2);
 }finally{h.reader.close();}
});
test('fresh invitation metadata does not clear an authorization error or retain actions after ownership loss',async()=>{
 const h=setup(async()=>{throw new AccountError('sign_in_required');});
 try{
  await h.reader.load(groupId,'next');const denied=h.reader.get(groupId);
  h.view.groups=h.view.groups.map(g=>({...g}));h.emit();assert.equal(h.reader.get(groupId),denied);
  h.view.groups=h.view.groups.map(g=>({...g,members:g.members.map(m=>({...m,role:'member' as const}))}));h.emit();assert.equal(h.reader.get(groupId),emptyInvitations);
 }finally{h.reader.close();}
});
