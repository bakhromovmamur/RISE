import {mkdirSync,writeFileSync} from "node:fs";
mkdirSync("/tmp/rise-quality02-shared-audit",{recursive:true});
import {test,expect} from '../support/browser.ts';
import {seedSyncGuest} from '../support/syncBrowser.ts';
import {syncGuest} from '../support/syncData.ts';
import {prepareGuestImport,recordsFromEntries} from '../../src/sync/importModel.ts';
import {hydrate} from '../../src/contracts/personalRecords.ts';
import {createTranslator} from '../../src/i18n.ts';
import {groupText} from '../../src/groups/text.ts';
import {sharedText} from '../../src/groups/sharedText.ts';
import {localDate} from '../../src/model.ts';
import type {AccountGroup} from '../../src/contracts/groups.ts';
import type {SharedTask,SharedList,SharedItem,SharedOccurrence} from '../../src/contracts/sharedContent.ts';
test.use({serviceWorkers:'block',actionTimeout:15000});
// Safe visual metadata only. These responses contain no usable session or code;
// real account commands, recurrence and recovery are tested in the adjacent suites.
for(const language of ['en','ru','uz'] as const)test(`shared task, list and priority screens reflow · ${language}`,async({page},info)=>{
 test.setTimeout(150000);const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333',taskId='44444444-4444-4444-8444-444444444444',listId='55555555-5555-4555-8555-555555555555',itemId='66666666-6666-4666-8666-666666666666';
 const guest=syncGuest();guest.life.language=language;const proposal=await prepareGuestImport(guest,owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),t=sharedText(language),g=groupText(language),tr=createTranslator(language),date=localDate('Asia/Tashkent');
 const group:AccountGroup={id,kind:'family',name:'Family plans · Семейные планы · Oilaviy rejalar',timezone:'Asia/Tashkent',revision:1,archived:false,members:[{id:member,name:'SharedAuthorWithALongChosenName',role:'owner',self:true}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};
 const task:SharedTask={id:taskId,groupId:id,title:'LongSharedTaskWithoutSpaces'.repeat(4),notes:'A chosen note. '.repeat(20),assignee:member,date,time:'18:30',weekdays:[0,1,2,3,4,5,6],archived:false,revision:1};
 const firstPage=[task,...Array.from({length:49},(_,i)=>({...task,id:`80000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,title:`Archived task ${i+1}`,archived:true}))],cursor=firstPage.at(-1)!.id;
 const list:SharedList={id:listId,groupId:id,name:'SharedListWithoutSpaces'.repeat(3),archived:false,revision:1};
 const item:SharedItem={id:itemId,listId,groupId:id,text:'AnItemWithALongAuthoredName'.repeat(4),quantity:'Quantity and optional shared note '.repeat(2),checked:false,position:1,revision:1};
 const report:SharedOccurrence={taskId,groupId:id,date,completed:true,byMemberId:member,at:new Date().toISOString(),revision:1,snapshot:{title:task.title,notes:task.notes,assignee:member,time:task.time,timezone:group.timezone,taskRevision:1}};
 let failReads=false,continued=false,heldReports:Promise<void>|null=null;
 await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/v1/session')return route.fulfill({json:{signedIn:true,csrfToken:'0'.repeat(64),delivery:'email',account:{id:owner,email:'visual-only@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
  if(path==='/api/v1/sync/head')return route.fulfill({json:{accountId:owner,initialized:true,revision:1,xp:20}});
  if(path==='/api/v1/groups')return route.fulfill({json:{accountId:owner,groups:[group]}});
  if(path===`/api/v1/groups/${id}/content`){if(failReads)return route.fulfill({status:503,json:{error:{code:'unavailable'}}});const collection=url.searchParams.get('collection'),after=url.searchParams.get('cursor');if(collection==='occurrences'&&heldReports)await heldReports;if(collection==='tasks'&&after)continued=true;const rows=collection==='tasks'?(after?[{...task,id:'90000000-0000-4000-8000-000000000001',title:'A task from the next page',archived:true}]:firstPage):collection==='lists'?[list]:collection==='items'?[item]:url.searchParams.has('date')&&url.searchParams.get('date')!==date?[]:[report];return route.fulfill({json:{accountId:owner,groupId:id,revision:group.revision,collection,rows,next:collection==='tasks'&&!after?cursor:null}});}
  if(path==='/api/v1/groups/commands'){group.revision++;return route.fulfill({status:409,json:{error:{code:'group_changed'}}});}
  return route.abort('blockedbyclient');
 });
 await seedSyncGuest(page,language);await page.evaluate(async({owner,state,records})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put({format:1,owner,version:0,revision:1,state,queue:[],records},owner);tx.objectStore('preferences').put(owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}sessionStorage.setItem('rise.account-view','1');},{owner,state,records});
 const selected=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.reload();await selected;
 const matrix=async(scene:string)=>{const dismiss=page.getByRole('button',{name:tr('Dismiss message'),exact:true});if(await dismiss.isVisible())await dismiss.click();for(const theme of ['light','dark'])for(const width of [320,393,1440])for(const scale of [100,200]){if((width===320)!==(scale===200))continue;
  await page.setViewportSize({width,height:852});await page.evaluate(({theme,scale})=>{document.querySelector('.app-shell')?.setAttribute('data-theme',theme);document.documentElement.style.fontSize=`${scale}%`;},{theme,scale});const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),`${scene} ${theme} ${width}/${scale}`).toBe(false);
  for(const control of await dialog.locator('.life-segments > button').all())expect(await control.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();return text.left>=box.left-1&&text.right<=box.right+1&&text.top>=box.top-1&&text.bottom<=box.bottom+1;}),`${scene} segmented text ${theme} ${width}/${scale}`).toBe(true);
  const headerFits=await dialog.locator('.sheet-header').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('h2')!.getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom&&b.left>=a.left&&b.right<=a.right;});if(!headerFits)await dialog.screenshot({path:info.outputPath(`shared-failing-header-${scene}-${language}-${width}-${scale}.png`)});expect(headerFits,`${scene} header ${theme} ${width}/${scale}`).toBe(true);const last=dialog.locator('button:visible').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();await expect(page.getByRole('button',{name:tr('Close','Yopish'),exact:true})).toBeInViewport();
const variant=`${language}-${theme}-${width}x852-${scale}`,name=scene;
const audit = await page.locator('.app-shell').evaluate(root => {
  const visible = (el: Element) => {
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    for(let p:Element|null=el;p;p=p.parentElement)if(p.matches('details:not([open])')&&!p.querySelector(':scope > summary')?.contains(el))return false;
    return r.width>0&&r.height>0&&s.visibility==='visible'&&!el.closest('[hidden],[inert],[aria-hidden="true"]');
  };
  const identity=(el:Element)=>({tag:el.tagName.toLowerCase(),id:el.id,class:el.getAttribute('class'),text:(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,180)});
  const controls=Array.from(root.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="switch"]')).filter(visible).map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el),before=getComputedStyle(el,'::before');
    const label=el instanceof HTMLInputElement ? el.labels?.[0] : null;
    const lr=label&&visible(label)?label.getBoundingClientRect():null;
    return {...identity(el),width:r.width,height:r.height,labelWidth:lr?.width,labelHeight:lr?.height,labelText:label?.textContent?.trim(),disabled:el.matches(':disabled'),before:{content:before.content,width:before.width,height:before.height,position:before.position},tabIndex:(el as HTMLElement).tabIndex,color:s.color};
  });
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d')!;
  const rgba=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).map((v,i)=>i===3?v/255:v);};
  const blend=(fg:number[],bg:number[])=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3])).concat(1);
  const luminance=(rgb:number[])=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=[];
  for(const el of Array.from(root.querySelectorAll('*')).filter(visible)){
    const text=Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
    if(!text||el.closest(':disabled,svg'))continue;
    let bg=[255,255,255,1],complex=false;const ancestors:Element[]=[];
    for(let parent:Element|null=el;parent;parent=parent.parentElement)ancestors.unshift(parent);
    for(const parent of ancestors){const s=getComputedStyle(parent);if(s.backgroundImage!=='none'||Number(s.opacity)<1)complex=true;bg=blend(rgba(s.backgroundColor),bg);}
    if(complex)continue;
    const s=getComputedStyle(el),fg=blend(rgba(s.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const min=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700)?3:4.5;
    if(ratio<min-.01)contrast.push({...identity(el),text:text.slice(0,180),ratio,min,color:s.color,background:bg,fontSize:s.fontSize,fontWeight:s.fontWeight});
  }
  const images=Array.from(root.querySelectorAll('img')).filter(visible).filter(el=>!el.hasAttribute('alt')).map(identity);
  const motion=Array.from(root.querySelectorAll('*')).filter(visible).filter(el=>{const s=getComputedStyle(el);return s.animationName!=='none'&&s.animationDuration!=='0s';}).map(identity);
  return {controls,contrast,images,motion,htmlLanguage:document.documentElement.lang,shellWidth:root.clientWidth,shellScrollWidth:root.scrollWidth};
});
await page.locator('.app-shell').screenshot({path:`/tmp/rise-quality02-shared-audit/${variant}-${name}.png`,animations:'disabled'});
writeFileSync(`/tmp/rise-quality02-shared-audit/${variant}-${name}.json`,JSON.stringify(audit,null,2));
  if(info.project.name==='chromium'&&(theme==='light'&&width===393&&scale===100||theme==='dark'&&width===320&&scale===200||scene==='priorities'&&language==='en'&&theme==='light'&&width===320&&scale===200)){await dialog.locator('.sheet-content').evaluate(el=>el.scrollTo(0,0));await dialog.screenshot({path:info.outputPath(`shared-${scene}-${language}-${theme}-${width}-${scale}.png`)});}
 }await page.evaluate(()=>document.documentElement.style.fontSize='100%');await page.setViewportSize({width:393,height:852});};
 await page.getByRole('tab',{name:tr('Today','Bugun'),exact:true}).click();await page.getByRole('button',{name:tr('Edit priorities','Ustuvor ishlarni o‘zgartirish'),exact:true}).click();await expect(page.getByRole('checkbox',{name:new RegExp(`^${task.title} `)})).toBeEnabled();await page.getByRole('checkbox',{name:new RegExp(`^${task.title} `)}).check();await matrix('priorities');await page.getByRole('button',{name:tr('Save priorities'),exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('checkbox',{name:t('complete',[task.title]),exact:true})).toBeChecked();
 let releaseReports!:()=>void;heldReports=new Promise(resolve=>{releaseReports=resolve;});group.revision++;const waiting=page.waitForRequest(r=>new URL(r.url()).searchParams.get('collection')==='occurrences');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await waiting;try{await expect(page.getByRole('checkbox',{name:t('complete',[task.title]),exact:true})).toHaveCount(0);await expect(page.locator('.priority-list').getByText(t('loading'),{exact:true})).toBeVisible();}finally{heldReports=null;releaseReports();}await expect(page.getByRole('checkbox',{name:t('complete',[task.title]),exact:true})).toBeChecked();
 await page.getByRole('tab',{name:tr('You','Siz'),exact:true}).click();await page.getByRole('button',{name:`${tr('Family','Oila')} ${tr('Tasks & shared lists','Vazifalar va umumiy ro‘yxatlar')}`,exact:true}).click();await page.locator('.people-group').click();await expect(page.getByRole('checkbox',{name:t('complete',[task.title]),exact:true})).toBeChecked();expect(continued).toBe(true);const archived=page.getByRole('dialog').locator('summary').filter({hasText:t('archivedTasks')});await archived.click();await expect(page.getByRole('button',{name:'A task from the next page',exact:true})).toBeVisible();await archived.click();await matrix('family');
 await page.getByRole('button',{name:t('addTask'),exact:true}).click();await page.getByLabel(t('taskName'),{exact:true}).fill('My new shared task');await matrix('task-create');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:t('addTask'),exact:true})).toBeFocused();
 await page.getByRole('dialog').locator('.family-task .task-copy').click();await expect(page.getByRole('button',{name:t('undo'),exact:true})).toBeEnabled();await matrix('task-detail');await page.getByRole('button',{name:t('editTask'),exact:true}).click();await page.getByLabel(t('taskName'),{exact:true}).fill('My retained task draft');await page.getByRole('button',{name:t('saveTask'),exact:true}).click();await expect(page.getByRole('button',{name:g('retry'),exact:true})).toBeEnabled();await matrix('task-conflict');await page.getByRole('button',{name:g('stop'),exact:true}).click();await page.getByRole('checkbox',{name:g('confirm'),exact:true}).check();await page.locator('.group-confirm').getByRole('button',{name:g('stop'),exact:true}).click();await expect(page.getByRole('button',{name:t('reviewed'),exact:true})).toBeEnabled();await matrix('task-review');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:t('familyLists')+' '+group.name,exact:true}).click();await page.getByRole('button',{name:t('createList'),exact:true}).click();await page.getByLabel(t('listName'),{exact:true}).fill(list.name);await matrix('list-create');await page.keyboard.press('Escape');await page.getByRole('button',{name:list.name,exact:true}).click();await expect(page.getByRole('checkbox',{name:t('check',[item.text]),exact:true})).toBeEnabled();await page.getByRole('button',{name:t('rename'),exact:true}).click();await page.getByRole('button',{name:t('edit',[item.text]),exact:true}).click();await page.getByRole('dialog').locator('summary[aria-label]').click();await matrix('list-edit');
 failReads=true;group.revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('dialog').getByText(t('readFailed'),{exact:true})).toBeVisible();await matrix('read-error');
});
