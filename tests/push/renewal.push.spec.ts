import {test,expect,stored} from '../support/browser.ts';
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport} from '../support/syncBrowser.ts';
import {pushSheet,syntheticPushBrowser} from '../support/pushBrowser.ts';
import {pushText} from '../../src/push/text.ts';
const t=pushText('en');
test.afterEach(async({request})=>{await request.post('/__infra_test__/network?offline=false',{timeout:5000}).catch(()=>{});});
test('explicit primary consent stages a plan, renews after reload and recovers after offline cancellation',async({page,request})=>{
 test.setTimeout(120000);await syntheticPushBrowser(page);await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);await pushSheet(page);
 const region=page.getByRole('region',{name:t('title'),exact:true});await region.getByRole('button',{name:t('enable'),exact:true}).click();await expect(region.getByText(t('subscribed'),{exact:true})).toBeVisible();
 // Background planning must not require or modify the foreground preference.
 await expect(page.getByRole('button',{name:'Enable notifications',exact:true})).toBeVisible();
 const plan=page.getByLabel(t('planTitle'),{exact:true});await expect(plan.getByRole('button',{name:t('planChoose'),exact:true})).toBeEnabled({timeout:30000});
 expect(await page.evaluate(async()=>{const v=await(await fetch('/api/v1/push/plan')).json();return v.plan;})).toBe(null);
 await plan.getByRole('switch',{name:t('quietOverride'),exact:true}).click();await plan.getByRole('button',{name:t('planChoose'),exact:true}).click();await expect(plan.getByText(t('planStaged'),{exact:true})).toBeVisible({timeout:30000});
 const first=await page.evaluate(async()=>{const v=await(await fetch('/api/v1/push/plan')).json();return{generation:v.plan.generation,events:v.receiver.events.length,live:v.dispatchEnabled};});expect(first.events).toBeGreaterThan(0);expect(first.live).toBe(false);await expect(page.getByRole('button',{name:'Enable notifications',exact:true})).toBeVisible();
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText('Synced',{exact:true}).first()).toBeVisible({timeout:30000});await pushSheet(page);await expect(plan.getByText(t('planStaged'),{exact:true})).toBeVisible({timeout:30000});await expect(plan.getByRole('switch',{name:t('quietOverride'),exact:true})).toHaveAttribute('aria-checked','true');
 // Synthetic metadata ages the renewal deadline; profile/timetable data stays intact.
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite'),s=tx.objectStore('control'),r=s.get('current');r.onsuccess=()=>{const c=r.result;s.put({...c,revision:c.revision+1,renewal:{...c.renewal,confirmed:{...c.renewal.confirmed,renewAt:0}}},'current');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event('focus'));});
 await expect.poll(()=>page.evaluate(async()=>{const v=await(await fetch('/api/v1/push/plan')).json();return v.plan.generation;}),{timeout:30000}).toBeGreaterThan(first.generation);
 for(let n=0;n<5&&await page.getByRole('dialog').count();n++)await page.keyboard.press('Escape');await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Settings Appearance, language, habits & data',exact:true}).click();await page.locator('summary').filter({hasText:'Habit reminders'}).click();
 await request.post('/__infra_test__/network?offline=true',{timeout:5000});await page.getByLabel('Quiet hours start',{exact:true}).fill('23:00');await pushSheet(page);await expect(region.getByText(t('cancelPending'),{exact:true})).toBeVisible({timeout:20000});
 await request.post('/__infra_test__/network?offline=false',{timeout:5000});await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(plan.getByText(t('planStaged'),{exact:true})).toBeVisible({timeout:30000});await expect(region.getByText(t('cancelPending'),{exact:true})).toHaveCount(0);
 expect((await stored(page)).habits).toEqual(guest.habits);
 // All language strings retain composition at mobile widths/large text; no live credentials captured.
 for(const width of [320,375,393,430])for(const scale of [100,200]){await page.setViewportSize({width,height:852});await page.evaluate(scale=>document.documentElement.style.fontSize=`${scale}%`,scale);await plan.getByRole('button',{name:t('planReplace'),exact:true}).scrollIntoViewIfNeeded();expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);}
});
