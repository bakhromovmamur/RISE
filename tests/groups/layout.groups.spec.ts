import {test,expect} from '../support/browser.ts';
import {seedSyncGuest} from '../support/syncBrowser.ts';
import {syncGuest} from '../support/syncData.ts';
import {prepareGuestImport,recordsFromEntries} from '../../src/sync/importModel.ts';
import {hydrate} from '../../src/contracts/personalRecords.ts';
import {createTranslator} from '../../src/i18n.ts';
import {groupText} from '../../src/groups/text.ts';
import {lifecycleText} from '../../src/account/text.ts';
import {pushText} from '../../src/push/text.ts';
import {archiveText} from '../../src/groups/archiveText.ts';
import {syntheticPushBrowser} from '../support/pushBrowser.ts';
import type {AccountGroup} from '../../src/contracts/groups.ts';
test.use({serviceWorkers:'block'});
// Unverified visual metadata only. Real membership is exercised separately.
for(const language of ['en','ru','uz'] as const)test(`group screens reflow with long names and recoverable errors · ${language}`,async({page},info)=>{
 test.setTimeout(120000);const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',invitation='33333333-3333-4333-8333-333333333333';
 const guest=syncGuest();guest.life.language=language;
 // Stable visible expiry; authentication/fault clocks remain real.
 const invitationExpiry=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T12:00:00.000Z';
 const installation='77777777-7777-4777-8777-777777777777',authenticatedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+3600000).toISOString(),p=pushText(language),synthetic=await syntheticPushBrowser(page,'denied');let pushEnabled=false;
 await page.addInitScript(()=>{Object.defineProperty(ServiceWorkerContainer.prototype,'getRegistration',{configurable:true,value:async()=>({pushManager:Object.getOwnPropertyDescriptor(ServiceWorkerRegistration.prototype,'pushManager')!.get!.call({})})});});
 const proposal=await prepareGuestImport(guest,owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),t=groupText(language),tr=createTranslator(language),a=lifecycleText(language),archive=archiveText(language);
 const group:AccountGroup={id,kind:'family',name:'Our family · Очень длинное название · Oila rejalarimiz',timezone:'Asia/Tashkent',revision:1,archived:false,members:[{id:'44444444-4444-4444-8444-444444444444',name:'Owner chosen name',role:'owner',self:true},{id:'55555555-5555-4555-8555-555555555555',name:'ОченьДлинноеВыбранноеИмяБезПробелов'.repeat(2),role:'member',self:false}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};
 let invitationPageError:'rate_limited'|'unavailable'|null=null;
 await page.route('**/api/v1/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/session')return route.fulfill({json:{signedIn:true,csrfToken:'0'.repeat(64),delivery:'email',account:{id:owner,email:'visual-only@example.invalid',remembered:true,authenticatedAt,expiresAt}}});
  if(path==='/api/v1/sync/head')return route.fulfill({json:{accountId:owner,initialized:true,revision:1,xp:20}});
  if(path==='/api/v1/groups')return route.fulfill({json:{accountId:owner,groups:[group]}});
  if(path==='/api/v1/push')return route.fulfill({json:{configured:pushEnabled,publicKey:pushEnabled?synthetic.subscription.keys.p256dh:null,installation:pushEnabled?{id:installation,version:1,enabled:true,details:false,language,needsReview:false}:null,test:null}});
  if(path===`/api/v1/groups/${id}/invitations`){if(invitationPageError)return route.fulfill({status:invitationPageError==='rate_limited'?429:503,json:{error:{code:invitationPageError}}});const cursor=new URL(route.request().url()).searchParams.get('cursor');return route.fulfill({json:{accountId:owner,groupId:id,revision:group.revision,rows:cursor?[{id:invitation,expiresAt:'2099-10-30T00:00:00.000Z',revoked:false,consumed:false}]:group.invitations,next:cursor?null:group.invitationNext}});}
  if(path==='/api/v1/groups/commands'){const op=route.request().postDataJSON();if(op.command.kind==='group.invite'){const expiresAt=invitationExpiry;group.invitations=[{id:invitation,expiresAt,revoked:false,consumed:false}];return route.fulfill({json:{operationId:op.operationId,groupId:id,revision:1,invitation:{id:invitation,expiresAt,link:'http://127.0.0.1:4191/#invite='+'x'.repeat(43)}}});}return route.fulfill({status:403,json:{error:{code:'recent_auth_required'}}});}
  if(path==='/api/v1/auth/reauth/code')return route.fulfill({status:202,json:{challenge:'1'.repeat(64),resendAt:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),retryAfter:60}});
  if(path==='/api/v1/groups/invitations/preview')return route.fulfill({json:{id,name:group.name,kind:group.kind,timezone:group.timezone,expiresAt:invitationExpiry}});
  return route.abort('blockedbyclient');
 });
 await seedSyncGuest(page,language);
 await page.evaluate(async({owner,state,records})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put({format:1,owner,version:0,revision:1,state,queue:[],records},owner);tx.objectStore('preferences').put(owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}sessionStorage.setItem('rise.account-view','1');},{owner,state,records});
 const selectedAccount=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.reload();await selectedAccount;
 await page.getByRole('tab',{name:tr('You','Siz'),exact:true}).click();await page.getByRole('button',{name:`${tr('Family','Oila')} ${tr('Tasks & shared lists','Vazifalar va umumiy ro‘yxatlar')}`,exact:true}).click();await expect(page.getByRole('button',{name:t('createFamily'),exact:true})).toBeEnabled();
 const matrix=async(scene:string)=>{
  for(const theme of ['light','dark'])for(const width of [320,375,393,430,1440])for(const scale of [100,200]){
   await page.setViewportSize({width,height:852});await page.evaluate(({theme,scale})=>{document.querySelector('.app-shell')?.setAttribute('data-theme',theme);document.documentElement.style.fontSize=`${scale}%`;},{theme,scale});
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
   if(scene==='invite-error'){await expect(dialog.getByText(t('invitationsFailed'),{exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:t('invitationsReload'),exact:true})).toBeEnabled();await expect(dialog.getByRole('button',{name:t('revoke'),exact:true})).toHaveCount(0);}
   expect(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
   const header=await dialog.locator('.sheet-header').evaluate(el=>{const h=el.getBoundingClientRect(),t=el.querySelector('h2')!.getBoundingClientRect();return {within:t.top>=h.top&&t.bottom<=h.bottom&&t.left>=h.left&&t.right<=h.right,header:h.toJSON(),title:t.toJSON()};});
   if(!header.within)await dialog.screenshot({path:info.outputPath(`groups-failed-header-${scene}-${language}-${theme}-${width}-${scale}.png`)}); // Unverified visual fixture only; no credentials.
   expect(header.within,JSON.stringify({scene,theme,width,scale,...header})).toBe(true);
   if(scene==='notification-privacy')expect(await page.getByRole('region',{name:p('title'),exact:true}).getByText(p('details'),{exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})).toBe(true);
   if(scene==='export-family'||scene==='export-squad')expect(await page.locator('.group-export .checkbox-label').evaluate(label=>{const box=label.getBoundingClientRect(),text=label.querySelector('span')!.getBoundingClientRect();return text.left>=box.left&&text.right<=box.right+1&&label.scrollWidth<=label.clientWidth+1;}),'Shared archive sensitivity consent must remain inside its readable label').toBe(true);
   const last=dialog.locator('button:visible').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();await expect(page.getByRole('button',{name:tr('Close','Yopish'),exact:true})).toBeInViewport();
   if(info.project.name==='chromium'&&(theme==='light'&&width===393&&scale===100||theme==='dark'&&width===320&&scale===200||scene==='notification-device'&&theme==='light'&&width===320&&scale===200)){if(['invite-page','invite-older','invite-error'].includes(scene))await dialog.screenshot({path:info.outputPath(`groups-${scene}-controls-${language}-${theme}-${width}-${scale}.png`)});if(['settings-enabled','notification-privacy'].includes(scene)){await page.getByRole('switch',{name:scene==='settings-enabled'?t('notifications'):p('details'),exact:true}).scrollIntoViewIfNeeded();await dialog.screenshot({path:info.outputPath(`groups-${scene}-controls-${language}-${theme}-${width}-${scale}.png`)});}if(scene.startsWith('export-')){await page.getByRole('heading',{name:archive('review'),exact:true}).scrollIntoViewIfNeeded();await dialog.screenshot({path:info.outputPath(`groups-${scene}-review-${language}-${theme}-${width}-${scale}.png`)});await page.getByRole('button',{name:archive('cancel'),exact:true}).scrollIntoViewIfNeeded();await dialog.screenshot({path:info.outputPath(`groups-${scene}-controls-${language}-${theme}-${width}-${scale}.png`)});}await dialog.locator('.sheet-content').evaluate(el=>el.scrollTo(0,0)).catch(()=>{});await dialog.screenshot({path:info.outputPath(`groups-${scene}-${language}-${theme}-${width}-${scale}.png`)});}
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:393,height:852});
 };
 await matrix('hub');await page.getByRole('button',{name:t('createFamily'),exact:true}).click();await page.getByLabel(t('name'),{exact:true}).fill('LongAuthoredGroupNameWithoutSpaces'.repeat(2));await page.getByLabel(t('nickname'),{exact:true}).fill('UzunTaxallus'.repeat(4));await matrix('create');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:t('createFamily'),exact:true})).toBeFocused();await page.getByRole('button',{name:new RegExp('^Our family')}).click();await matrix('members');await page.getByRole('button',{name:t('invite'),exact:true}).click();await page.getByRole('button',{name:t('makeLink'),exact:true}).click();await expect(page.getByRole('button',{name:t('copy'),exact:true})).toBeVisible();await matrix('invite');
 group.invitations=Array.from({length:20},(_,n)=>({id:`60000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`,expiresAt:'2099-10-30T00:00:00.000Z',revoked:false,consumed:false}));group.invitationNext=group.invitations.at(-1)!.id;group.revision++;
 const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;await expect(page.getByRole('button',{name:t('invitationsOlder'),exact:true})).toBeEnabled();
 if(language==='uz'){const dates=page.locator('.server-groups .group-row small');await expect(dates).toHaveCount(20);for(const date of await dates.allTextContents()){expect(date).toMatch(/30 okt 2099/);expect(date).toContain('05:00');expect(date).not.toMatch(/\bM10\b/);}}
 await matrix('invite-page');
 await page.getByRole('button',{name:t('invitationsOlder'),exact:true}).click();await expect(page.getByRole('heading',{name:t('invitations'),exact:true})).toBeFocused();await matrix('invite-older');
 // A synthetic rate-limit error keeps this visual scene stable across fresh owner reads.
 // Transient unavailable errors intentionally recover automatically, checked below.
 invitationPageError='rate_limited';await page.getByRole('button',{name:t('invitationsPrevious'),exact:true}).click();await expect(page.getByText(t('invitationsFailed'),{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:t('revoke'),exact:true})).toHaveCount(0);
 const errorRefresh=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await errorRefresh;
 await expect(page.getByText(t('invitationsFailed'),{exact:true})).toBeVisible();await matrix('invite-error');
 invitationPageError=null;await page.getByRole('button',{name:t('invitationsReload'),exact:true}).click();await expect(page.getByRole('heading',{name:t('invitations'),exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:t('revoke'),exact:true})).toHaveCount(20);await expect(page.getByRole('button',{name:t('invitationsPrevious'),exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:t('invitationsOlder'),exact:true})).toBeEnabled();
 // Keep the paging endpoint unavailable: a fresh authorized group head itself restores page one.
 invitationPageError='unavailable';const unavailable=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/groups/${id}/invitations`&&r.status()===503);
 await page.getByRole('button',{name:t('invitationsOlder'),exact:true}).click();await (await unavailable).finished();
 const recovered=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await recovered;
 await expect(page.getByText(t('invitationsFailed'),{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:t('invitationsReload'),exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:t('revoke'),exact:true})).toHaveCount(20);await expect(page.getByRole('button',{name:t('invitationsPrevious'),exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:t('invitationsOlder'),exact:true})).toBeEnabled();invitationPageError=null;
 await page.keyboard.press('Escape');await page.getByRole('button',{name:t('settings'),exact:true}).click();await matrix('settings');
 await page.getByRole('button',{name:archive('title'),exact:true}).click();await matrix('export-family');await page.getByRole('button',{name:archive('cancel'),exact:true}).click();await expect(page.getByRole('button',{name:archive('title'),exact:true})).toBeFocused();
 group.kind='squad';group.revision++;let exportRefresh=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await exportRefresh;
 await page.getByRole('button',{name:archive('title'),exact:true}).click();await expect(page.getByText(archive('squad'),{exact:true})).toBeVisible();await matrix('export-squad');
 group.revision++;exportRefresh=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await exportRefresh;await expect(page.getByRole('button',{name:archive('latest'),exact:true})).toBeVisible();await matrix('export-stale');
 await page.getByRole('button',{name:archive('latest'),exact:true}).click();await expect(page.getByRole('heading',{name:archive('review'),exact:true})).toBeFocused();await page.getByRole('button',{name:archive('cancel'),exact:true}).click();group.kind='family';group.revision++;exportRefresh=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await exportRefresh;
 await page.getByRole('switch',{name:t('notifications'),exact:true}).click();await matrix('settings-enabled');await page.getByRole('button',{name:t('notificationDevice'),exact:true}).click();const region=page.getByRole('region',{name:p('title'),exact:true});await expect(region.getByText(p('denied'),{exact:true})).toBeVisible();await matrix('notification-device');
 pushEnabled=true;
 await page.evaluate(async({owner,installation,language})=>{
  (window as unknown as {__risePushTest:{permission:string}}).__risePushTest.permission='granted';localStorage.setItem('__synthetic_push_subscribed','yes');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onupgradeneeded=()=>r.result.createObjectStore('control');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite');tx.objectStore('control').put({revision:1,owner,installation,generation:1,enabled:true,details:false,language,pending:false,lastTest:null},'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 },{owner,installation,language});
 await region.getByRole('button',{name:p('refresh'),exact:true}).click();await expect(region.getByText(p('subscribed'),{exact:true})).toBeVisible();await matrix('notification-privacy');
 await region.getByRole('button',{name:p('disable'),exact:true}).click();await expect(region.getByText(p('pending'),{exact:true})).toBeVisible();await matrix('notification-pending');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:t('notificationDevice'),exact:true})).toBeFocused();await page.getByRole('button',{name:t('delete'),exact:true}).click();await matrix('confirm');await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.locator('.group-confirm').getByRole('button',{name:t('delete'),exact:true}).click();await page.getByRole('button',{name:a('send'),exact:true}).click();await expect(page.getByLabel(a('code'),{exact:true})).toBeVisible();await matrix('reauth');
 await page.getByLabel(a('code'),{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:a('verify'),exact:true})).toBeFocused();
 // Remove only this synthetic pending operation before the independent join scene.
 await page.getByRole('button',{name:t('stop'),exact:true}).click();await page.locator('.group-pending').getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.locator('.group-pending .group-confirm').getByRole('button',{name:t('stop'),exact:true}).click();
 await page.goto('/#invite='+'x'.repeat(43));await expect(page.getByRole('heading',{name:t('joinTitle'),exact:true,level:1})).toBeVisible();await page.getByLabel(t('nickname'),{exact:true}).fill('My chosen name');await matrix('join');
});
