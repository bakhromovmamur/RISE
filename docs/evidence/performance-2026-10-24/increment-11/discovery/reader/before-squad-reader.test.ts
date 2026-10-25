import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SquadContent,emptySquad} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/squads.ts';
import {GroupClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/client';
import {AccountError} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/auth/client';
import type {GroupState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/session';
import type {SquadPage,SquadPost,SquadQuery,SquadPreview} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/squads';
import type {AccountSession} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/auth';

function setup(){
 const owner=randomUUID(),groupId=randomUUID(),member=randomUUID(),listeners=new Set<()=>void>();let current=true,reads=0;
 let view:GroupState={loaded:true,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null,groups:[{id:groupId,kind:'squad',name:'Synthetic squad',timezone:'UTC',revision:1,archived:false,members:[{id:member,name:'Chosen nickname',self:true,role:'member'}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]}]};
 const groups={getSnapshot:()=>view,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},refresh:async()=>{reads++;return true;}};
 const query={groupId,week:'2026-10-19'},post=(id=randomUUID()):SquadPost=>({id,groupId,authorMemberId:member,revision:1,publishedAt:'2026-10-23T12:00:00Z',updatedAt:'2026-10-23T12:00:00Z',snapshot:{week:query.week,note:'Chosen shared text'},reactions:{count:0,mine:false}});
 const page=(rows:SquadPost[],next:string|null=null):SquadPage=>({accountId:owner,groupId,revision:1,week:query.week,rows,next});
 const client={squad:async(_q:SquadQuery,_signal?:AbortSignal)=>page([post()])},content=new SquadContent(owner,groups,client,()=>current);
 return{owner,groupId,member,query,post,page,client,content,reads:()=>reads,setCurrent:(v:boolean)=>{current=v;},view:()=>view,set:(next:Partial<GroupState>)=>{view={...view,...next};listeners.forEach(fn=>fn());}};
}
test('squad pages and author lookups remain separate and reaction revisions invalidate every old view',async()=>{
 const h=setup(),rows=Array.from({length:21},()=>h.post()),requests:SquadQuery[]=[];
 h.client.squad=async q=>{requests.push(q);return q.authorMemberId?h.page([rows[20]]):q.cursor?h.page([rows[20]]):h.page(rows.slice(0,20),rows[19].id);};
 try{
  await h.content.load(h.query);assert.equal(h.content.get(h.query).rows.length,20);
  const own={...h.query,authorMemberId:h.member};await h.content.load(own);assert.equal(h.content.get(own).rows[0].id,rows[20].id);assert.equal(h.content.get(h.query).rows.length,20);
  await h.content.load(h.query,true);assert.equal(h.content.get(h.query).rows.length,21);assert.deepEqual(requests[2],{...h.query,revision:1,cursor:rows[19].id});
  h.set({groups:h.view().groups.map(g=>({...g,revision:2}))});assert.equal(h.content.get(h.query),emptySquad);assert.equal(h.content.get(own),emptySquad);
 }finally{h.content.close();}
});
test('late squad replies and failures cannot revive removed membership, replaced reads or another account',async()=>{
 const h=setup();let resolve!:(value:SquadPage)=>void,reject!:(reason:unknown)=>void;
 h.client.squad=async()=>new Promise<SquadPage>((yes,no)=>{resolve=yes;reject=no;});
 try{
  const original=h.view().groups,first=h.content.load(h.query);h.set({groups:[]});resolve(h.page([h.post()]));assert.equal(await first,false);assert.equal(h.content.get(h.query),emptySquad);
  h.set({groups:original});const older=h.content.load(h.query),oldReject=reject;h.client.squad=async()=>h.page([h.post()]);await h.content.load(h.query);const latest=h.content.get(h.query);oldReject(new AccountError('group_unavailable'));assert.equal(await older,false);assert.equal(h.content.get(h.query),latest);assert.equal(h.reads(),0);
  h.client.squad=async()=>new Promise<SquadPage>(yes=>{resolve=yes;});const switching=h.content.load(h.query);h.setCurrent(false);resolve(h.page([h.post()]));assert.equal(await switching,false);assert.equal(h.content.get(h.query),emptySquad);
 }finally{h.content.close();}
});
test('inconsistent or failed squad continuation clears the entire view and requests current authority after conflict',async()=>{
 const h=setup(),rows=Array.from({length:20},()=>h.post());h.client.squad=async()=>h.page(rows,rows[19].id);
 try{await h.content.load(h.query);h.client.squad=async()=>h.page([rows[0]]);assert.equal(await h.content.load(h.query,true),false);assert.equal(h.content.get(h.query).rows.length,0);
  h.client.squad=async()=>h.page(rows,rows[19].id);await h.content.load(h.query);h.client.squad=async()=>{throw new AccountError('group_changed');};assert.equal(await h.content.load(h.query,true),false);assert.equal(h.reads(),1);assert.equal(h.content.get(h.query).loaded,false);
 }finally{h.content.close();}
});
test('the squad HTTP boundary rejects mismatched owner/week/author and mismatched preview choices or source metadata',async()=>{
 const h=setup(),originalFetch=globalThis.fetch,now=new Date().toISOString();let identity:AccountSession={signedIn:true,csrfToken:'a'.repeat(64),delivery:'email',account:{id:h.owner,email:'synthetic@example.invalid',remembered:true,authenticatedAt:now,expiresAt:now}};
 const client=new GroupClient(h.owner,()=>identity,'http://127.0.0.1:4191'),requests:string[]=[];let result:unknown=h.page([h.post()]);
 globalThis.fetch=async(input,init)=>{requests.push(String(input));assert.equal(init?.cache,'no-store');assert.equal(init?.credentials,'same-origin');return Response.json(result);};
 try{
  await client.squad({...h.query,revision:1,authorMemberId:h.member});
  for(const fields of [{accountId:randomUUID()},{groupId:randomUUID(),rows:[]},{revision:2},{week:'2026-10-12',rows:[]},{rows:[{...h.post(),authorMemberId:randomUUID()}]}]){result={...h.page([]),...fields};await assert.rejects(client.squad({...h.query,revision:1,authorMemberId:h.member}));}
  const input={groupId:h.groupId,postId:randomUUID(),groupRevision:1,postRevision:0,personalRevision:3,week:h.query.week,note:'  Chosen words  ',choices:{habits:false,milestones:false,prayers:false}};
  const preview:SquadPreview={accountId:h.owner,groupId:h.groupId,postId:input.postId,previewId:randomUUID(),groupRevision:1,postRevision:0,sourceRevision:3,expiresAt:now,hash:'b'.repeat(64),snapshot:{week:h.query.week,note:'Chosen words'}};
  result=preview;assert.deepEqual(await client.squadPreview(input),preview);
  for(const fields of [{accountId:randomUUID()},{postId:randomUUID()},{sourceRevision:4},{groupRevision:2},{snapshot:{...preview.snapshot,prayers:0}},{snapshot:{...preview.snapshot,note:'Changed words'}}]){result={...preview,...fields};await assert.rejects(client.squadPreview(input));}
  identity={signedIn:false,csrfToken:'a'.repeat(64),delivery:'email'};const count=requests.length;await assert.rejects(client.squad(h.query));await assert.rejects(client.squadPreview(input));assert.equal(requests.length,count);
 }finally{globalThis.fetch=originalFetch;h.content.close();}
});

test('a transient read waits for fresh authorized metadata, then retries without a revision change or a retry loop',async()=>{
 const h=setup();let attempts=0;
 h.client.squad=async()=>{attempts++;throw new AccountError('unavailable');};
 try{
  await h.content.load(h.query);const failed=h.content.get(h.query);
  for(const busy of [true,false,true,false])h.set({busy});
  assert.equal(h.content.get(h.query),failed);assert.equal(attempts,1);assert.equal(h.reads(),0);
  h.set({groups:h.view().groups.map(g=>({...g})),readError:null});assert.equal(h.content.get(h.query),emptySquad);
  await h.content.load(h.query);assert.equal(attempts,2);assert.equal(h.content.get(h.query).error,'unavailable');
  h.set({busy:false});assert.equal(h.content.get(h.query).error,'unavailable');assert.equal(h.reads(),0);
  h.client.squad=async()=>{attempts++;return h.page([h.post()]);};
  h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(await h.content.load(h.query),true);assert.equal(attempts,3);
  const saved=h.content.get(h.query);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),saved);
 }finally{h.content.close();}
});
test('fresh metadata cannot clear authority failures or revive a transient read after account switching',async()=>{
 const h=setup();let attempts=0;
 try{
  h.client.squad=async()=>{attempts++;throw new AccountError('sign_in_required');};await h.content.load(h.query);
  const denied=h.content.get(h.query);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),denied);
  h.client.squad=async()=>{attempts++;throw new AccountError('unavailable');};await h.content.load(h.query);
  h.setCurrent(false);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),emptySquad);assert.equal(await h.content.load(h.query),false);assert.equal(attempts,2);
 }finally{h.content.close();}
});
