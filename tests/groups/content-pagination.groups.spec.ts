import {test,expect} from '../support/browser.ts';
import {seedSyncGuest} from '../support/syncBrowser.ts';
import {syncGuest} from '../support/syncData.ts';
import {prepareGuestImport,recordsFromEntries} from '../../src/sync/importModel.ts';
import {hydrate} from '../../src/contracts/personalRecords.ts';
import {groupText} from '../../src/groups/text.ts';
import {sharedText} from '../../src/groups/sharedText.ts';
import {localDate} from '../../src/model.ts';
import type {AccountGroup} from '../../src/contracts/groups.ts';
import type {SharedTask} from '../../src/contracts/sharedContent.ts';
test.use({serviceWorkers:'block'});

test('an open task stays loading while its later page refreshes and only a complete missing read shows unavailable',async({page})=>{
 const owner='11111111-1111-4111-8111-111111111111',groupId='22222222-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333';
 const proposal=await prepareGuestImport(syncGuest(),owner,{habitIds:['authored-reading'],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),t=sharedText('en'),g=groupText('en'),date=localDate('Asia/Tashkent');
 const group:AccountGroup={id:groupId,kind:'family',name:'Synthetic paged family',timezone:'Asia/Tashkent',revision:1,archived:false,members:[{id:member,name:'Shared member',role:'owner',self:true}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};
 const task:SharedTask={id:'90000000-0000-4000-8000-000000000001',groupId,title:'Task on the second page',notes:'',assignee:member,date,time:null,weekdays:[],archived:false,revision:1};
 const firstPage=Array.from({length:50},(_,i)=>({...task,id:`80000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,title:`Earlier task ${i+1}`,archived:true}));
 let held:Promise<void>|null=null,release=()=>{},missing=false;
 await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/v1/session')return route.fulfill({json:{signedIn:true,csrfToken:'0'.repeat(64),delivery:'email',account:{id:owner,email:'visual-only@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
  if(path==='/api/v1/sync/head')return route.fulfill({json:{accountId:owner,initialized:true,revision:1,xp:20}});
  if(path==='/api/v1/groups')return route.fulfill({json:{accountId:owner,groups:[group]}});
  if(path===`/api/v1/groups/${groupId}/content`){const collection=url.searchParams.get('collection'),next=url.searchParams.has('cursor');if(next&&held)await held;return route.fulfill({json:{accountId:owner,groupId,revision:group.revision,collection,rows:collection==='tasks'?(next?(missing?[]:[task]):firstPage):[],next:collection==='tasks'&&!next?firstPage.at(-1)!.id:null}});}
  return route.abort('blockedbyclient');
 });
 await seedSyncGuest(page);await page.evaluate(async({owner,state,records})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put({format:2,owner,version:0,revision:1,state,queue:[],records},owner);tx.objectStore('preferences').put(owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}sessionStorage.setItem('rise.account-view','1');},{owner,state,records});
 const restored=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/groups');await page.reload();await restored;
 await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Family Tasks & shared lists',exact:true}).click();await page.locator('.people-group').click();await page.getByRole('button',{name:task.title+' You',exact:true}).click();await expect(page.getByRole('button',{name:t('markDone'),exact:true})).toBeEnabled();
 held=new Promise<void>(resolve=>{release=resolve;});group.revision++;const nextPage=page.waitForRequest(r=>new URL(r.url()).pathname.endsWith('/content')&&new URL(r.url()).searchParams.has('cursor'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await nextPage;
 try{await expect(page.getByRole('dialog').getByText(t('loading'),{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText(g('unavailable'),{exact:true})).toHaveCount(0);}finally{held=null;release();}
 await expect(page.getByRole('button',{name:t('markDone'),exact:true})).toBeEnabled();missing=true;group.revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('dialog').getByText(g('unavailable'),{exact:true})).toBeVisible();
});
