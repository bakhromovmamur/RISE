import {applyDomainCommand} from "../../src/domain/commands.ts";
import {localDate} from "../../src/model.ts";
import {test,expect} from '../support/browser.ts';
import {seedSyncGuest} from '../support/syncBrowser.ts';
import {syncGuest} from '../support/syncData.ts';
import {prepareGuestImport,recordsFromEntries} from '../../src/sync/importModel.ts';
import {hydrate} from '../../src/contracts/personalRecords.ts';
import {pushSheet,syntheticPushBrowser} from '../support/pushBrowser.ts';
import {syncStatusText} from '../../src/sync/text.ts';
import {pushText} from '../../src/push/text.ts';
test.use({serviceWorkers:'block'});
for(const language of ['en','ru','uz'] as const)test(`renewal readiness layouts · ${language}`,async({page},info)=>{
 test.setTimeout(90000);const owner='11111111-1111-4111-8111-111111111111',installation='22222222-2222-4222-8222-222222222222',guest=applyDomainCommand(applyDomainCommand(syncGuest(),{kind:'calendar.refresh'},{now:Date.now(),date:localDate('UTC'),timezone:'UTC'}),{kind:'priorities.ensure',date:localDate('UTC')},{now:Date.now(),date:localDate('UTC'),timezone:'UTC'});guest.life.language=language;
 const proposal=await prepareGuestImport(guest,owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),t=pushText(language),synthetic=await syntheticPushBrowser(page,'granted');
 let scene='staged';
 await page.addInitScript(()=>{Object.defineProperty(ServiceWorkerContainer.prototype,'getRegistration',{configurable:true,value:async()=>({pushManager:Object.getOwnPropertyDescriptor(ServiceWorkerRegistration.prototype,'pushManager')!.get!.call({})})});});
 await page.route('**/api/v1/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/session')return route.fulfill({json:{signedIn:true,csrfToken:'0'.repeat(64),delivery:'email',account:{id:owner,email:'visual-only@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
  if(path==='/api/v1/sync/head')return route.fulfill({json:{accountId:owner,initialized:true,revision:1,xp:20}});
  if(path==='/api/v1/push')return route.fulfill({json:{configured:true,publicKey:synthetic.subscription.keys.p256dh,installation:{id:installation,version:1,enabled:true,details:false,language,needsReview:false},test:null}});
  if(path==='/api/v1/push/plan'){const at=new Date(Date.now()+(scene==='expired'?-60000:86400000)).toISOString();return route.fulfill({json:{accountId:owner,serverNow:new Date().toISOString(),dispatchEnabled:scene==='live',plan:{primaryInstallation:installation,generation:1,sourceRevision:1,timezone:state.timezone,queuedThrough:at,suppressed:0,allowDuringQuiet:true,coverageExpired:scene==='expired',counts:[]},receiver:{installation,version:1,queuedThrough:at,nextAt:at,failed:scene==='failed'?1:0,events:[]}}});}
  return route.abort('blockedbyclient');
 });
 await seedSyncGuest(page,language);
 await page.evaluate(async({owner,installation,state,records,language})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put({format:1,owner,version:0,revision:1,state,queue:[],records},owner);tx.objectStore('preferences').put(owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();sessionStorage.setItem('rise.account-view','1');localStorage.setItem('__synthetic_push_subscribed','yes');
  const push=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onupgradeneeded=()=>r.result.createObjectStore('control');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=push.transaction('control','readwrite');tx.objectStore('control').put({revision:1,owner,installation,generation:1,enabled:true,details:false,language,pending:false,lastTest:null},'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});push.close();
 },{owner,installation,state,records,language});
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText(syncStatusText(language,{phase:'synced',pending:0,persistent:true,error:null}),{exact:true}).first()).toBeVisible({timeout:30000});await pushSheet(page,language);const panel=page.getByLabel(t('planTitle'),{exact:true});await expect(panel.getByText(t('planStaged'),{exact:true})).toBeVisible({timeout:30000});
 for(const current of ['staged','live','expired','failed']){
  scene=current;await panel.getByRole('button',{name:t('planRefresh'),exact:true}).click();await expect(panel.getByText(t(current==='staged'?'planStaged':current==='live'?'planScheduled':current==='expired'?'planExpired':'planError'),{exact:true})).toBeVisible();
  for(const theme of ['light','dark'])for(const width of [320,375,393,430])for(const scale of [100,200]){
   await page.setViewportSize({width,height:852});await page.evaluate(({theme,scale})=>{document.querySelector('.app-shell')?.setAttribute('data-theme',theme);document.documentElement.style.fontSize=`${scale}%`;},{theme,scale});await panel.getByRole('button',{name:t('planReplace'),exact:true}).scrollIntoViewIfNeeded();expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
   if(info.project.name==='chromium'&&current==='staged'&&(width===393&&scale===100&&theme==='light'||width===320&&scale===200&&theme==='dark'))await page.getByRole('dialog').screenshot({path:info.outputPath(`renewal-${language}-${theme}-${width}-${scale}.png`)});
  }
 }
});
