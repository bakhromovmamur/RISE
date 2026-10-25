import {test,expect} from '../support/browser.ts';
import {seedSyncGuest} from '../support/syncBrowser.ts';
import {syncGuest} from '../support/syncData.ts';
import {prepareGuestImport,recordsFromEntries} from '../../src/sync/importModel.ts';
import {hydrate} from '../../src/contracts/personalRecords.ts';
import {createTranslator} from '../../src/i18n.ts';
import {groupText} from '../../src/groups/text.ts';
import {squadText} from '../../src/groups/squadText.ts';
import {localDate,weekStart} from '../../src/model.ts';
import {applyDomainCommand} from '../../src/domain/commands.ts';
import type {AccountGroup} from '../../src/contracts/groups.ts';
import type {SquadPost,SquadPreviewRequest} from '../../src/contracts/squads.ts';

test.use({serviceWorkers:'block',actionTimeout:15000});
// Visual-only metadata has no usable credentials. Real database permission,
// exact publication and recovery tests live in squads.groups.spec.ts.
for(const language of ['en','ru','uz'] as const)test(`squad preview, moderation and recovery reflow · ${language}`,async({page},info)=>{
 test.setTimeout(150000);
 const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333',postId='44444444-4444-4444-8444-444444444444';
 let guest=syncGuest();guest.life.language=language;
 guest=applyDomainCommand(guest,{kind:'calendar.refresh'},{now:Date.now(),date:localDate(guest.timezone),timezone:guest.timezone});
 guest=applyDomainCommand(guest,{kind:'priorities.ensure',date:localDate(guest.timezone)},{now:Date.now(),date:localDate(guest.timezone),timezone:guest.timezone});
 const proposal=await prepareGuestImport(guest,owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),t=squadText(language),g=groupText(language),tr=createTranslator(language),week=weekStart(localDate('Asia/Tashkent'));
 const group:AccountGroup={id,kind:'squad',name:'Our weekly circle · Наши итоги недели · Haftalik guruhimiz',timezone:'Asia/Tashkent',revision:1,archived:false,members:[{id:member,name:'SharedAuthorWithALongChosenName'.repeat(2),role:'owner',self:true}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};
 const post:SquadPost={id:postId,groupId:id,authorMemberId:member,revision:1,publishedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:{week,note:'AChosenReflectionWithoutSpaces'.repeat(15),habits:123,milestones:['CompletedMilestoneWithoutSpaces'.repeat(5),'A chosen title · Выбранное название · Tanlangan nom'],prayers:25},reactions:{count:19,mine:true}};
 let failReads=false,commandFailure='squad_preview_expired';
 await page.route('**/api/v1/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/v1/session')return route.fulfill({json:{signedIn:true,csrfToken:'0'.repeat(64),delivery:'email',account:{id:owner,email:'visual-only@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
  if(path==='/api/v1/sync/head')return route.fulfill({json:{accountId:owner,initialized:true,revision:1,xp:20}});
  if(path==='/api/v1/groups')return route.fulfill({json:{accountId:owner,groups:[group]}});
  if(path===`/api/v1/squads/${id}`)return failReads?route.fulfill({status:503,json:{error:{code:'unavailable'}}}):route.fulfill({json:{accountId:owner,groupId:id,revision:group.revision,week:url.searchParams.get('week'),rows:url.searchParams.get('week')===week?[post]:[],next:null}});
  if(path==='/api/v1/squads/preview'){
   const input:SquadPreviewRequest=route.request().postDataJSON();
   return route.fulfill({json:{accountId:owner,groupId:id,postId:input.postId,previewId:crypto.randomUUID(),groupRevision:group.revision,postRevision:input.postRevision,sourceRevision:input.personalRevision,expiresAt:new Date(Date.now()+600000).toISOString(),hash:'a'.repeat(64),snapshot:{week:input.week,note:input.note,...(input.choices.habits?{habits:123}:{}),...(input.choices.milestones?{milestones:post.snapshot.milestones}:{}),...(input.choices.prayers?{prayers:25}:{})}}});
  }
  if(path==='/api/v1/groups/commands'){
   if(commandFailure==='group_changed'){group.revision++;post.revision=group.revision;post.snapshot.note='A different accepted update · Другая запись · Boshqa yangilik';}
   return route.fulfill({status:409,json:{error:{code:commandFailure}}});
  }
  return route.abort('blockedbyclient');
 });
 await seedSyncGuest(page,language);
 await page.evaluate(async({owner,state,records})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put({format:1,owner,version:0,revision:1,state,queue:[],records},owner);tx.objectStore('preferences').put(owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  sessionStorage.setItem('rise.account-view','1');
 },{owner,state,records});
 const selected=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.reload();await selected;
 const matrix=async(scene:string)=>{
  const dismiss=page.getByRole('button',{name:tr('Dismiss message'),exact:true});if(await dismiss.isVisible())await dismiss.click();
  for(const theme of ['light','dark'])for(const width of [320,375,393,430,1440])for(const scale of [100,200]){
   await page.setViewportSize({width,height:852});await page.evaluate(({theme,scale})=>{document.querySelector('.app-shell')?.setAttribute('data-theme',theme);document.documentElement.style.fontSize=`${scale}%`;},{theme,scale});
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
   const overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1);if(overflow)await dialog.screenshot({path:info.outputPath(`squad-failing-${scene}-${language}-${width}-${scale}.png`)});expect(overflow,`${scene} ${theme} ${width}/${scale}`).toBe(false);
   expect(await dialog.locator('.sheet-header').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('h2')!.getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom&&b.left>=a.left&&b.right<=a.right;}),`${scene} header ${width}/${scale}`).toBe(true);
   // A fresh metadata read can replace the error/retry control mid-scroll.
   // Re-resolve it while preserving the intended scene and reachability checks.
   await expect(async()=>{if(scene==='read-error')await expect(dialog.getByText(t('readFailed'),{exact:true}).first()).toBeVisible();const last=dialog.locator('button:visible').last();await last.scrollIntoViewIfNeeded({timeout:2000});await expect(last).toBeInViewport();await expect(page.getByRole('button',{name:tr('Close','Yopish'),exact:true})).toBeInViewport();}).toPass({timeout:5000});
   if(info.project.name==='chromium'&&(theme==='light'&&width===393&&scale===100||theme==='dark'&&width===320&&scale===200)){await dialog.locator('.sheet-content').evaluate(el=>el.scrollTo(0,0));await dialog.screenshot({path:info.outputPath(`squad-${scene}-${language}-${theme}-${width}-${scale}.png`)});}
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:393,height:852});
 };
 const preview=async()=>{await page.getByRole('button',{name:t('preview'),exact:true}).click();await expect(page.getByRole('heading',{name:t('previewTitle'),exact:true})).toBeFocused();};
 const stop=async()=>{await page.getByRole('dialog').getByRole('button',{name:g('stop'),exact:true}).click();await page.getByRole('dialog').locator('.group-pending').getByRole('checkbox',{name:g('confirm'),exact:true}).check();await page.getByRole('dialog').locator('.group-pending .group-confirm').getByRole('button',{name:g('stop'),exact:true}).click();};
 await page.getByRole('tab',{name:tr('You','Siz'),exact:true}).click();await page.getByRole('button',{name:`${tr('Family','Oila')} ${tr('Tasks & shared lists','Vazifalar va umumiy ro‘yxatlar')}`,exact:true}).click();await page.getByRole('button',{name:g('squad'),exact:true}).click();await page.locator('.people-group').click();await expect(page.getByRole('button',{name:t('edit'),exact:true})).toBeEnabled();await matrix('feed');
 await page.getByRole('button',{name:`${t('remove')} · ${group.members[0].name}`,exact:true}).click();await expect(page.getByRole('dialog').locator('.group-confirm h2')).toBeFocused();await matrix('remove');await page.getByRole('button',{name:g('cancel'),exact:true}).click();
 await page.getByRole('button',{name:t('edit'),exact:true}).click();await page.getByRole('textbox',{name:t('reflection'),exact:true}).fill('MyRetainedPrivateDraftWithoutSpaces'.repeat(15));await matrix('edit');
 await preview();await matrix('preview');await page.getByRole('button',{name:t('publish'),exact:true}).click();await expect(page.getByRole('dialog').getByText(t('expired'),{exact:true})).toBeVisible();await matrix('expired');await stop();await page.getByRole('button',{name:t('editAgain'),exact:true}).click();await expect(page.getByRole('button',{name:t('preview'),exact:true})).toBeFocused();
 commandFailure='group_changed';await preview();await page.getByRole('button',{name:t('publish'),exact:true}).click();await expect(page.getByRole('dialog').getByRole('button',{name:g('retry'),exact:true})).toBeEnabled();await matrix('conflict');await stop();await expect(page.getByRole('button',{name:t('reviewed'),exact:true})).toBeEnabled();await matrix('review');
 await page.getByRole('button',{name:t('reviewed'),exact:true}).click();await expect(page.getByRole('textbox',{name:t('reflection'),exact:true})).toHaveValue('MyRetainedPrivateDraftWithoutSpaces'.repeat(15));await page.getByRole('button',{name:t('withdraw'),exact:true}).click();await expect(page.getByRole('dialog').locator('.group-confirm h2')).toBeFocused();await matrix('withdraw');await page.keyboard.press('Escape');
 failReads=true;group.revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('dialog').getByText(t('readFailed'),{exact:true}).first()).toBeVisible();await matrix('read-error');
});
