import {test,expect,stored} from '../support/browser.ts';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {parseEnv} from 'node:util';
import pg from 'pg';
import {seedSyncGuest,accountSheet,browserLogin} from '../support/syncBrowser.ts';
import {pushSheet,syntheticPushBrowser} from '../support/pushBrowser.ts';
import {pushText} from '../../src/push/text.ts';
import {authHarness} from '../support/auth.ts';
const ledgerSource=stripTypeScriptTypes((await readFile('src/push/ledger.ts','utf8')).replace(/export /g,''));
const workerSource=await readFile('public/notifications-sw.js','utf8');
test('page and worker share an atomic display ledger; canceled and stale plans only show generic fallback',async({page})=>{
 // Exercise real IndexedDB without the app's account observer clearing the
 // intentionally synthetic consent while the handler awaits authorization.
 await page.route('**/__push_receiver_fixture__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated push receiver</title>'}));
 await page.goto('/__push_receiver_fixture__');
 const result=await page.evaluate(async({ledgerSource,workerSource})=>{
  const pageLedger=new Function(`${ledgerSource};return {claimReminder,clearReminderLedger};`)() as {claimReminder:(owner:string,event:string,at:number,expiry:number)=>Promise<boolean>;clearReminderLedger:(owner:string)=>Promise<void>};
  const listeners=new Map<string,(e:object)=>void>(),shown:Record<string,unknown>[]=[];
  let authorized=true,reachable=true,checks=0;
  new Function('self','fetch',workerSource)({location:{origin:location.origin},addEventListener:(name:string,fn:(e:object)=>void)=>listeners.set(name,fn),clients:{matchAll:async()=>[]},registration:{showNotification:async(_title:string,options:Record<string,unknown>)=>shown.push(options)}},async()=>{checks++;if(!reachable)throw new Error('offline');return new Response(JSON.stringify({valid:authorized}));});
  const owner=crypto.randomUUID(),installation=crypto.randomUUID(),id=crypto.randomUUID(),at=Date.now()-1000,expiry=Date.now()+60000;
  const control={revision:1,owner,installation,generation:1,enabled:true,details:false,language:'en',pending:false,lastTest:null,planGeneration:99};
  async function setControl(v:object){await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onupgradeneeded=()=>r.result.createObjectStore('control');r.onsuccess=()=>{const db=r.result,tx=db.transaction('control','readwrite');tx.objectStore('control').put(v,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(new Error('write'));};});}
  await setControl(control);
  const payload={version:1,type:'reminder',id,owner,installation,generation:1,planGeneration:1,eventAt:new Date(at).toISOString(),expiresAt:new Date(expiry).toISOString(),language:'en'};
  async function fire(p:object){let wait=Promise.resolve();listeners.get('push')!({data:{json:()=>p},waitUntil:(v:Promise<void>)=>{wait=v;}});await wait;}
  const won=await pageLedger.claimReminder(owner,id,at,expiry);await fire(payload);const pageFirst=shown.pop();
  const second={...payload,id:crypto.randomUUID()};await fire(second);const workerFirst=shown.pop();const pageLost=await pageLedger.claimReminder(owner,second.id,at,expiry);
  await setControl({...control,blockedEvents:[second.id]});await fire(second);const canceled=shown.pop();
  authorized=false;const third={...payload,id:crypto.randomUUID(),planGeneration:2};await fire(third);const stale=shown.pop();
  authorized=true;reachable=false;await fire({...payload,id:crypto.randomUUID()});const offline=shown.pop();
  return {won,pageLost,pageFirst,workerFirst,canceled,stale,offline,checks};
 },{ledgerSource,workerSource});
 expect(result.checks).toBe(4);expect(result.won).toBe(true);expect(result.pageLost).toBe(false);expect(result.workerFirst?.body).toBe('Open RISE to view your reminder.');
 for(const v of [result.pageFirst,result.canceled,result.stale,result.offline]){expect(v?.silent).toBe(true);expect(v?.body).toBe('Open RISE to review notification settings.');}
});

test('an expired legacy cancellation preserves its original intent until explicit current-plan review',async({page})=>{
 test.setTimeout(90000);const t=pushText('en');await syntheticPushBrowser(page);await seedSyncGuest(page);const guest=await stored(page);
 await accountSheet(page);await browserLogin(page);await pushSheet(page);const region=page.getByRole('region',{name:t('title'),exact:true});
 await region.getByRole('button',{name:t('enable'),exact:true}).click();await expect(region.getByText(t('subscribed'),{exact:true})).toBeVisible();
 const prepared=await page.evaluate(async()=>{
  const session=await(await fetch('/api/v1/session')).json(),owner=session.account.id;
  const post=async(path:string,body:object)=>{const r=await fetch(`/api/v1/${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-Rise-CSRF':session.csrfToken},body:JSON.stringify(body)});if(!r.ok)throw new Error('synthetic_setup_failed');return r.json();};
  const at=Date.now()+60000,p={accountId:owner,requestId:crypto.randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'UTC',events:[{key:crypto.randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]};
  await post('push/plan',p);const request={accountId:owner,requestId:crypto.randomUUID(),keys:null};await post('push/cancel-plan',request);await post('push/plan',{...p,requestId:crypto.randomUUID(),expectedGeneration:1});return request;
 });
 const h=await authHarness(),env=parseEnv(await readFile('.rise-infra/test/push.env','utf8')),url=new URL(env.DATABASE_WORKER_URL!);expect(url.port).toBe('55422');const worker=new pg.Pool({connectionString:url.href,max:1});
 try{
  await h.admin.query("update rise.push_plan_receipts set created_at=now()-interval '8 days' where user_id=$1 and id=$2",[prepared.accountId,prepared.requestId]);await worker.query('select rise_private.prune_push_receipts(500)');
  await page.evaluate(async request=>{
   const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite'),s=tx.objectStore('control'),r=s.get('current');r.onsuccess=()=>s.put({...r.result,revision:r.result.revision+1,planBlocked:true,cancelRequest:{id:request.requestId,pending:true,keys:request.keys}},'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event('focus'));
  },prepared);
  await expect(region.getByText(t('cancelReview'),{exact:true})).toBeVisible({timeout:30000});
  expect((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and generation=2 and status='queued'",[prepared.accountId])).rows[0].n).toBe(1);
  const readControl=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise<{cancelRequest:{id:string;pending:boolean;throughGeneration?:number};renewal?:unknown}>((resolve,reject)=>{const r=db.transaction('control').objectStore('control').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}});
  expect((await readControl()).cancelRequest.id).toBe(prepared.requestId);
  await region.getByRole('button',{name:t('cancelCurrent'),exact:true}).click();await expect(region.getByText(t('cancelReview'),{exact:true})).toHaveCount(0);await expect(region.getByText(t('planBlocked'),{exact:true})).toBeVisible();
  const local=await readControl();expect(local.cancelRequest.id).not.toBe(prepared.requestId);expect(local.cancelRequest.pending).toBe(false);expect(local.cancelRequest.throughGeneration).toBe(2);expect(local.renewal).toBeUndefined();
  expect((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and status='queued'",[prepared.accountId])).rows[0].n).toBe(0);expect((await stored(page)).habits).toEqual(guest.habits);
 }finally{await worker.end();await h.close();await page.evaluate(async()=>{const s=await(await fetch('/api/v1/session')).json();await fetch('/api/v1/logout',{method:'POST',headers:{'Content-Type':'application/json','X-Rise-CSRF':s.csrfToken},body:'{}'});});}
});

test('a lost cancellation reply replays the durable generation after cleanup and plan replacement',async({page})=>{
 test.setTimeout(90000);const t=pushText('en');await syntheticPushBrowser(page);await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await pushSheet(page);
 const region=page.getByRole('region',{name:t('title'),exact:true});await region.getByRole('button',{name:t('enable'),exact:true}).click();await expect(region.getByText(t('subscribed'),{exact:true})).toBeVisible();
 const initial=await page.evaluate(async()=>{
  const s=await(await fetch('/api/v1/session')).json(),at=Date.now()+60000;
  const input={accountId:s.account.id,requestId:crypto.randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'UTC',events:[{key:crypto.randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]};
  const headers={'Content-Type':'application/json','X-Rise-CSRF':s.csrfToken};
  if(!(await fetch('/api/v1/push/plan',{method:'POST',headers,body:JSON.stringify(input)})).ok)throw new Error('synthetic_plan_failed');
  if(!(await fetch('/__infra_test__/push-network',{method:'POST',headers,body:JSON.stringify({mode:'lost-once'})})).ok)throw new Error('synthetic_fault_failed');
  const id=crypto.randomUUID(),db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite'),store=tx.objectStore('control'),r=store.get('current');r.onsuccess=()=>store.put({...r.result,revision:r.result.revision+1,planBlocked:true,cancelRequest:{protocol:2,id,pending:true,keys:null}},'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event('focus'));return{input,id};
 });
 await expect.poll(()=>page.evaluate(async()=>(await(await fetch('/__infra_test__/push-network')).json()).discardedReplies),{timeout:30000}).toBe(1);
 const read=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise<{id:string;pending:boolean;throughGeneration?:number}>((resolve,reject)=>{const r=db.transaction('control').objectStore('control').get('current');r.onsuccess=()=>resolve(r.result.cancelRequest);r.onerror=()=>reject(r.error);});}finally{db.close();}});
 const pending=await read();expect(pending).toMatchObject({id:initial.id,pending:true,throughGeneration:1});
 const h=await authHarness(),env=parseEnv(await readFile('.rise-infra/test/push.env','utf8')),url=new URL(env.DATABASE_WORKER_URL!);expect(url.port).toBe('55422');const worker=new pg.Pool({connectionString:url.href,max:1});
 try{
  await h.admin.query("update rise.push_plan_receipts set created_at=now()-interval '8 days' where user_id=$1 and id=$2",[initial.input.accountId,initial.id]);await worker.query('select rise_private.prune_push_receipts(500)');
  await page.evaluate(async initial=>{const s=await(await fetch('/api/v1/session')).json(),headers={'Content-Type':'application/json','X-Rise-CSRF':s.csrfToken};
   if(!(await fetch('/api/v1/push/plan',{method:'POST',headers,body:JSON.stringify({...initial.input,requestId:crypto.randomUUID(),expectedGeneration:1})})).ok)throw new Error('synthetic_replacement_failed');
   if(!(await fetch('/__infra_test__/push-network',{method:'POST',headers,body:JSON.stringify({mode:'online'})})).ok)throw new Error('synthetic_fault_failed');
  },initial);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(async()=>(await read()).pending,{timeout:30000}).toBe(false);expect(await read()).toMatchObject({id:initial.id,throughGeneration:1});
  expect((await h.admin.query("select count(*)::int as n from rise.push_jobs where user_id=$1 and generation=2 and status='queued'",[initial.input.accountId])).rows[0].n).toBe(1);
 }finally{await worker.end();await h.close();await page.evaluate(async()=>{const s=await(await fetch('/api/v1/session')).json();await fetch('/api/v1/logout',{method:'POST',headers:{'Content-Type':'application/json','X-Rise-CSRF':s.csrfToken},body:'{}'});});}
});
