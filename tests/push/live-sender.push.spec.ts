import {test,expect,stored} from '../support/senderBrowser.ts';
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport} from '../support/syncBrowser.ts';
import {pushSheet,syntheticPushBrowser} from '../support/pushBrowser.ts';
import {pushText} from '../../src/push/text.ts';
import {authHarness} from '../support/auth.ts';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import type {Page,Request} from '@playwright/test';
import {accountText} from '../../src/auth/text.ts';
import {syncText} from '../../src/sync/text.ts';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
import {stopPushSender} from '../../server/push/runtime.ts';
import {claimPushJob} from '../../server/push/jobs.ts';
import {sendPushReminder} from '../../server/push/worker.ts';
const ece=createRequire(import.meta.url)('http_ece') as {decrypt:(body:Buffer,options:object)=>Buffer};
const source=await readFile('public/notifications-sw.js','utf8'),t=pushText('en');
// This credential-bearing case exports only bounded, enumerated metadata on failure.
// Never retain response bodies, request data, headers, raw errors, screenshots or traces.
type SenderEvent={atMs:number;kind:'response'|'request-failed'|'page-error';path?:string;method?:'GET'|'POST'|'other';status?:number;durationMs?:number;outcome?:'ok'|'denied'|'unavailable'|'other';errorName?:string};
const diagnostics=new WeakMap<Page,{started:number;events:SenderEvent[];requests:WeakMap<Request,number>}>();
const diagnosticPaths=new Set(['/api/v1/session','/api/v1/auth/code','/api/v1/auth/verify','/api/v1/sync/head','/api/v1/sync/imports','/api/v1/sync/imports/page','/api/v1/sync/imports/preview','/api/v1/sync/imports/commit']);
test.beforeEach(async({page})=>{
 const data={started:Date.now(),events:[] as SenderEvent[],requests:new WeakMap<Request,number>()};diagnostics.set(page,data);
 const append=(event:SenderEvent)=>{if(data.events.length===100)data.events.shift();data.events.push(event);};
 const path=(request:Request)=>{const url=new URL(request.url());return url.origin==='http://127.0.0.1:4191'&&diagnosticPaths.has(url.pathname)?url.pathname:null;};
 const method=(request:Request):'GET'|'POST'|'other'=>request.method()==='GET'?'GET':request.method()==='POST'?'POST':'other';
 page.on('request',request=>{if(path(request))data.requests.set(request,Date.now());});
 page.on('response',response=>{const request=response.request(),label=path(request);if(!label)return;const status=response.status();append({kind:'response',path:label,method:method(request),status,atMs:Date.now()-data.started,durationMs:Date.now()-(data.requests.get(request)??Date.now()),outcome:status<400?'ok':status===401||status===403?'denied':status===503?'unavailable':'other'});});
 page.on('requestfailed',request=>{const label=path(request);if(label)append({kind:'request-failed',path:label,method:method(request),atMs:Date.now()-data.started});});
 page.on('pageerror',error=>append({kind:'page-error',atMs:Date.now()-data.started,errorName:['Error','TypeError','RangeError','SyntaxError','ReferenceError','DOMException'].includes(error.name)?error.name:'other'}));
 await page.addInitScript(()=>{Reflect.set(window,'__riseSenderFocusCount',0);window.addEventListener('focus',()=>Reflect.set(window,'__riseSenderFocusCount',Math.min(100000,Number(Reflect.get(window,'__riseSenderFocusCount'))+1)));});
});
test.afterEach(async({page},info)=>{
 if(info.status===info.expectedStatus)return;
 const auth=accountText('en'),sync=syncText('en');let deadline:ReturnType<typeof setTimeout>|undefined;
 const dom=await Promise.race([
  page.evaluate(labels=>{
   const text=document.body?.innerText??'',buttons=Array.from(document.querySelectorAll('button')),checkboxes=Array.from(document.querySelectorAll('input[type="checkbox"]'));
   const count=(label:string)=>buttons.filter(button=>button.textContent?.trim()===label).length;
   const rawFocus=Reflect.get(window,'__riseSenderFocusCount');
   return {rootCount:document.querySelectorAll('#root').length,savedCount:document.querySelectorAll('[data-storage-status="saved"]').length,dialogCount:document.querySelectorAll('[role="dialog"]').length,checkboxCount:checkboxes.length,chooseCount:count(labels.choose),prepareCount:count(labels.prepare),syntheticHabitCheckboxCount:checkboxes.filter(box=>box.closest('label')?.textContent?.trim()==='Synthetic reading').length,signedIn:text.includes(labels.signedIn),checking:text.includes(labels.loading),pending:text.includes(labels.pending),busy:document.querySelectorAll('[aria-busy="true"]').length>0,focusCount:typeof rawFocus==='number'&&Number.isSafeInteger(rawFocus)&&rawFocus>=0&&rawFocus<=100000?rawFocus:null};
  },{choose:sync('choose'),prepare:sync('prepare'),signedIn:auth('signedIn'),loading:auth('loading'),pending:sync('pending')}).catch(()=>null),
  new Promise<null>(resolve=>{deadline=setTimeout(()=>resolve(null),2000);}),
 ]);if(deadline)clearTimeout(deadline);
 const browser=['chromium','webkit','firefox'].includes(info.project.name)?info.project.name:'other';
 await mkdir('test-results/infra',{recursive:true});
 await writeFile(`test-results/infra/live-sender-${browser}-repeat${info.repeatEachIndex}-retry${info.retry}.json`,JSON.stringify({format:'rise-test-sender-diagnostics-v1',status:['failed','timedOut','interrupted'].includes(info.status??'')?info.status:'other',browser,elapsedMs:Date.now()-(diagnostics.get(page)?.started??Date.now()),events:diagnostics.get(page)?.events??[],dom},null,2)+'\n');
});

test('encrypted queue delivery reaches the guarded receiver; cancellation suppresses display',async({page,unrelatedPushWork})=>{
 expect(unrelatedPushWork).toBeTruthy();
 test.setTimeout(120000);const synthetic=await syntheticPushBrowser(page);await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);await pushSheet(page);
 const region=page.getByRole('region',{name:t('title'),exact:true});await region.getByRole('button',{name:t('enable'),exact:true}).click();await expect(region.getByText(t('subscribed'),{exact:true})).toBeVisible();const plan=page.getByLabel(t('planTitle'),{exact:true});await plan.getByRole('switch',{name:t('quietOverride'),exact:true}).click();await plan.getByRole('button',{name:t('planChoose'),exact:true}).click();await expect(plan.getByText(t('planStaged'),{exact:true})).toBeVisible({timeout:30000});
 const owner=await page.evaluate(async()=>{const s=await(await fetch('/api/v1/session')).json();return s.account.id as string;});
 const h=await authHarness(),e=parseEnv(await readFile('.rise-infra/test/push.env','utf8')),url=new URL(e.DATABASE_WORKER_URL!);expect(url.port).toBe('55422');expect(url.hostname).toBe('127.0.0.1');const pool=new pg.Pool({connectionString:url.href,max:2}),id=randomUUID();
 try{
  // Scoped leases exercise the real encrypted dispatch without consuming another
  // case's due work. The infrastructure suite verifies the full scheduler tick.
  await h.admin.query("update rise.push_jobs set fire_at=date_trunc('milliseconds',clock_timestamp())-interval '1 second',expires_at=date_trunc('milliseconds',clock_timestamp())+interval '90 seconds',next_attempt_at=clock_timestamp()-interval '1 second' where id=(select id from rise.push_jobs where user_id=$1 and status='queued' order by fire_at limit 1)",[owner]);
  const payloads:Record<string,unknown>[]=[];
  // A simultaneous authorized page read can hold the owner lock. The sender
  // deliberately defers that account; its next tick must still submit once.
  let accepted=0;
  await expect.poll(async()=>{
   await pool.query('insert into rise_private.push_senders(id) values($1) on conflict(id) do update set heartbeat_at=clock_timestamp()',[id]);
   const lease=await claimPushJob(pool,owner);
   if(lease){const result=await sendPushReminder(pool,lease,{installationId:e.INSTALLATION_ID!,dataKey:Buffer.from(e.PUSH_DATA_ENCRYPTION_KEY!,'hex'),vapid:{publicKey:e.VAPID_PUBLIC_KEY!,privateKey:e.VAPID_PRIVATE_KEY!,subject:e.VAPID_SUBJECT!}},async details=>{expect(details.endpoint).toBe(synthetic.subscription.endpoint);payloads.push(JSON.parse(ece.decrypt(details.body!,{version:'aes128gcm',privateKey:synthetic.ec,authSecret:synthetic.subscription.keys.auth}).toString()));return 201;});if(result==='accepted')accepted++;}return accepted;
  },{timeout:10000,intervals:[1000]}).toBe(1);
  expect(payloads).toHaveLength(1);const payload=payloads[0];expect(payload).toBeDefined();
  await plan.getByRole('button',{name:t('planRefresh'),exact:true}).click();await expect(plan.getByText(t('planScheduled'),{exact:true})).toBeVisible();
  const shown=await page.evaluate(async({source,payload})=>{
   const listeners=new Map<string,(e:object)=>void>(),shown:Record<string,unknown>[]=[];
   new Function('self',source)({location:{origin:location.origin},addEventListener:(name:string,fn:(e:object)=>void)=>listeners.set(name,fn),clients:{matchAll:async()=>[]},registration:{showNotification:async(_title:string,options:Record<string,unknown>)=>shown.push(options)}});
   const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite'),s=tx.objectStore('control'),r=s.get('current');r.onsuccess=()=>s.put({...r.result,planGeneration:undefined},'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
   async function fire(){let waiting=Promise.resolve();listeners.get('push')!({data:{json:()=>payload},waitUntil:(p:Promise<void>)=>{waiting=p;}});await waiting;}
   await fire();await fire();
   const session=await(await fetch('/api/v1/session')).json();const canceled=await fetch('/api/v1/push/cancel-plan',{method:'POST',headers:{'Content-Type':'application/json','X-Rise-CSRF':session.csrfToken},body:JSON.stringify({accountId:session.account.id,requestId:crypto.randomUUID(),keys:[payload!.id]})});if(!canceled.ok)throw new Error('synthetic_cancel_failed');
   await fire();return shown;
  },{source,payload});
  expect(shown[0].body).toBe('Open RISE to view your reminder.');expect(shown[0].silent).toBe(false);for(const notification of shown.slice(1)){expect(notification.silent).toBe(true);expect(notification.body).toBe('Open RISE to review notification settings.');}
  await stopPushSender(pool,id);await plan.getByRole('button',{name:t('planRefresh'),exact:true}).click();await expect(plan.getByText(t('planStaged'),{exact:true})).toBeVisible();expect((await stored(page)).habits).toEqual(guest.habits);
 }finally{await stopPushSender(pool,id);await pool.end();await h.close();await page.evaluate(async()=>{const s=await(await fetch('/api/v1/session')).json();await fetch('/api/v1/logout',{method:'POST',headers:{'Content-Type':'application/json','X-Rise-CSRF':s.csrfToken},body:'{}'});});}
});
