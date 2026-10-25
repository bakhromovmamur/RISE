import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SharedContent,emptyContent} from '/tmp/rise-reader-recovery-candidate/isolated-content.ts';
import {GroupClient} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/client.ts';
import {AccountError} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/auth/client.ts';
import type {GroupState} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/groups/session.ts';
import type {SharedPage,SharedQuery,SharedTask} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/sharedContent.ts';
import type {AccountSession} from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/src/contracts/auth.ts';

function setup(){
 const owner=randomUUID(),groupId=randomUUID(),listeners=new Set<()=>void>();let current=true,reads=0;
 let view:GroupState={loaded:true,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null,groups:[{id:groupId,kind:'family',name:'Synthetic family',timezone:'Pacific/Kiritimati',revision:1,archived:false,members:[{id:randomUUID(),name:'Member',self:true,role:'member'}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]}]};
 const groups={getSnapshot:()=>view,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},refresh:async()=>{reads++;return true;}};
 const query={groupId,collection:'tasks' as const},task=(id=randomUUID()):SharedTask=>({id,groupId,revision:1,title:'Shared task text',notes:'Private shared note',assignee:null,date:'2026-10-23',time:null,weekdays:[],archived:false});
 const page=(rows:SharedPage['rows'],next:string|null=null):SharedPage=>({accountId:owner,groupId,revision:1,collection:'tasks',rows,next});
 const client={content:async(_q:SharedQuery,_signal?:AbortSignal)=>page([task()])},content=new SharedContent(owner,groups,client,()=>current);
 return{owner,groupId,query,task,page,client,content,reads:()=>reads,setCurrent:(v:boolean)=>{current=v;},view:()=>view,set:(next:Partial<GroupState>)=>{view={...view,...next};listeners.forEach(fn=>fn());}};
}
test('shared reader combines bounded pages only at one authorized revision and offers pins only for eligible loaded tasks',async()=>{
 const h=setup(),rows=Array.from({length:51},()=>h.task()),seen:SharedQuery[]=[];
 h.client.content=async q=>{seen.push(q);return q.cursor?h.page([rows[50]]):h.page(rows.slice(0,50),rows[49].id);};
 try{
  assert.equal(await h.content.load(h.query),true);assert.equal(h.content.get(h.query).rows.length,50);
  const ref={kind:'task' as const,groupId:h.groupId,taskId:rows[0].id,date:rows[0].date};assert.equal(h.content.allowsPriority(ref),true);assert.equal(h.content.allowsPriority({...ref,date:'2026-10-24'}),false);
  assert.equal(await h.content.load(h.query,true),true);assert.equal(h.content.get(h.query).rows.length,51);assert.equal(h.content.get(h.query).next,null);
  assert.deepEqual(seen,[{...h.query,revision:1},{...h.query,revision:1,cursor:rows[49].id}]);
  h.set({groups:h.view().groups.map(g=>({...g,archived:true}))});assert.equal(h.content.allowsPriority(ref),false);
  h.set({groups:h.view().groups.map(g=>({...g,revision:2}))});assert.equal(h.content.get(h.query),emptyContent);assert.equal(h.content.allowsPriority(ref),false);
 }finally{h.content.close();}
});
test('late content and errors cannot repopulate a removed group, replaced read or switched account',async()=>{
 const h=setup();let resolve!:(value:SharedPage)=>void,reject!:(reason:unknown)=>void;
 h.client.content=async()=>new Promise<SharedPage>((yes,no)=>{resolve=yes;reject=no;});
 try{
  const first=h.content.load(h.query);h.set({groups:[]});resolve(h.page([h.task()]));assert.equal(await first,false);assert.equal(h.content.get(h.query),emptyContent);
  const restored={id:h.groupId,kind:'family' as const,name:'Family',timezone:'UTC',revision:1,archived:false,members:[],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};h.set({groups:[restored]});
  const older=h.content.load(h.query),oldReject=reject;h.client.content=async()=>h.page([h.task()]);assert.equal(await h.content.load(h.query),true);const latest=h.content.get(h.query);oldReject(new AccountError('group_unavailable'));assert.equal(await older,false);assert.equal(h.content.get(h.query),latest);assert.equal(h.reads(),0);
  h.client.content=async()=>new Promise<SharedPage>(yes=>{resolve=yes;});const switching=h.content.load(h.query);h.setCurrent(false);resolve(h.page([h.task()]));assert.equal(await switching,false);assert.equal(h.content.get(h.query),emptyContent);
 }finally{h.content.close();}
});
test('failed or inconsistent continuation clears content, never shows a partial mixed collection and refreshes membership on conflict',async()=>{
 const h=setup(),rows=Array.from({length:50},()=>h.task());h.client.content=async()=>h.page(rows,rows[49].id);
 try{
  await h.content.load(h.query);h.client.content=async()=>h.page([rows[0]]);assert.equal(await h.content.load(h.query,true),false);assert.equal(h.content.get(h.query).rows.length,0);assert.equal(h.content.get(h.query).error,'unavailable');
  h.client.content=async()=>h.page(rows,rows[49].id);await h.content.load(h.query);h.client.content=async()=>{throw new AccountError('group_changed');};assert.equal(await h.content.load(h.query,true),false);assert.equal(h.content.get(h.query).loaded,false);assert.equal(h.reads(),1);
  h.set({loaded:false,groups:[],readError:'unavailable'});assert.equal(h.content.get(h.query),emptyContent);
 }finally{h.content.close();}
});
test('the shared HTTP client binds owner, group, parent, date and revision before accepting server data',async()=>{
 const h=setup(),originalFetch=globalThis.fetch,now=new Date().toISOString();let identity:AccountSession={signedIn:true,csrfToken:'a'.repeat(64),delivery:'email',account:{id:h.owner,email:'synthetic@example.invalid',remembered:true,authenticatedAt:now,expiresAt:now}};
 const client=new GroupClient(h.owner,()=>identity,'http://127.0.0.1:4191'),requests:string[]=[];let result:SharedPage=h.page([h.task()]);
 globalThis.fetch=async(input,init)=>{requests.push(String(input));assert.equal(init?.cache,'no-store');assert.equal(init?.credentials,'same-origin');return Response.json(result);};
 try{
  assert.equal((await client.content({...h.query,revision:1})).rows.length,1);assert.equal(requests[0],`/api/v1/groups/${h.groupId}/content?collection=tasks&revision=1`);
  for(const changed of [{accountId:randomUUID()},{groupId:randomUUID(),rows:[]},{revision:2},{collection:'lists' as const,rows:[]}]){result={...h.page([]),...changed};await assert.rejects(client.content({...h.query,revision:1}));}
  const task=h.task(),parentId=randomUUID();result={...h.page([]),collection:'occurrences',rows:[{taskId:task.id,groupId:h.groupId,date:task.date,completed:false,byMemberId:null,at:null,revision:1,snapshot:{title:task.title,notes:task.notes,assignee:null,time:null,timezone:'UTC',taskRevision:1}}]};
  await assert.rejects(client.content({groupId:h.groupId,collection:'occurrences',parentId}));await assert.rejects(client.content({groupId:h.groupId,collection:'occurrences',parentId:task.id,date:'2026-10-24'}));
  assert.equal((await client.content({groupId:h.groupId,collection:'occurrences',parentId:task.id,date:task.date})).rows.length,1);
  identity={signedIn:false,csrfToken:'a'.repeat(64),delivery:'email'};const count=requests.length;await assert.rejects(client.content(h.query));assert.equal(requests.length,count);
 }finally{globalThis.fetch=originalFetch;h.content.close();}
});

test('a transient read waits for fresh authorized metadata, then retries without a revision change or a retry loop',async()=>{
 const h=setup();let attempts=0;
 h.client.content=async()=>{attempts++;throw new AccountError('unavailable');};
 try{
  await h.content.load(h.query);const failed=h.content.get(h.query);
  for(const busy of [true,false,true,false])h.set({busy});
  assert.equal(h.content.get(h.query),failed);assert.equal(attempts,1);assert.equal(h.reads(),0);
  h.set({groups:h.view().groups.map(g=>({...g})),readError:null});assert.equal(h.content.get(h.query),emptyContent);
  await h.content.load(h.query);assert.equal(attempts,2);assert.equal(h.content.get(h.query).error,'unavailable');
  h.set({busy:false});assert.equal(h.content.get(h.query).error,'unavailable');assert.equal(h.reads(),0);
  h.client.content=async()=>{attempts++;return h.page([h.task()]);};
  h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(await h.content.load(h.query),true);assert.equal(attempts,3);
  const saved=h.content.get(h.query);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),saved);
 }finally{h.content.close();}
});
test('fresh metadata cannot clear authority failures or revive a transient read after account switching',async()=>{
 const h=setup();let attempts=0;
 try{
  h.client.content=async()=>{attempts++;throw new AccountError('sign_in_required');};await h.content.load(h.query);
  const denied=h.content.get(h.query);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),denied);
  h.client.content=async()=>{attempts++;throw new AccountError('unavailable');};await h.content.load(h.query);
  h.setCurrent(false);h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),emptyContent);assert.equal(await h.content.load(h.query),false);assert.equal(attempts,2);
 }finally{h.content.close();}
});

test('metadata received before a read failure cannot authorize retries from later busy updates',async()=>{
 const h=setup();let reject!:(reason:unknown)=>void;
 h.client.content=async()=>new Promise<SharedPage>((_,no)=>{reject=no;});
 try{
  const pending=h.content.load(h.query);h.set({groups:h.view().groups.map(g=>({...g}))});
  assert.equal(h.content.get(h.query).loading,true);reject(new AccountError('unavailable'));assert.equal(await pending,false);
  const failed=h.content.get(h.query);h.set({busy:true});h.set({busy:false});assert.equal(h.content.get(h.query),failed);
  h.set({groups:h.view().groups.map(g=>({...g}))});assert.equal(h.content.get(h.query),emptyContent);
 }finally{h.content.close();}
});
