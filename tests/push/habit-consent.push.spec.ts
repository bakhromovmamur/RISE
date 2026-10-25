import {test,expect,stored,type Page} from '../support/browser';
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport} from '../support/syncBrowser';
import {syntheticPushBrowser} from '../support/pushBrowser';
import {habitText} from '../../src/habitText';
const ht=habitText('en');
async function close(page:Page){for(let n=0;n<5&&await page.getByRole('dialog').count();n++)await page.keyboard.press('Escape');}
async function controls(page:Page){await close(page);await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Settings Appearance, language, habits & data',exact:true}).click();await page.locator('summary').filter({hasText:'Habit reminders'}).click();}
async function consent(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise<{foreground:string|null;owner:string|null}>((resolve,reject)=>{const r=db.transaction('control').objectStore('control').get('current');r.onsuccess=()=>resolve({foreground:r.result?.habitForeground??null,owner:r.result?.owner??null});r.onerror=()=>reject(r.error);});}finally{db.close();}});}
test('foreground habit consent stays scoped and logout clears it without a background subscription',async({page})=>{
 await syntheticPushBrowser(page);await seedSyncGuest(page);const guest=await stored(page);await controls(page);
 await page.getByRole('button',{name:ht('enable'),exact:true}).click();await expect(page.getByRole('button',{name:ht('stop'),exact:true})).toBeVisible();expect((await consent(page)).foreground).toBe('guest');
 await close(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);await controls(page);
 await expect(page.getByRole('button',{name:ht('enable'),exact:true})).toBeVisible();await page.getByRole('button',{name:ht('enable'),exact:true}).click();await expect(page.getByRole('button',{name:ht('stop'),exact:true})).toBeVisible();
 const before=await consent(page);expect(before.foreground).toMatch(/^[a-f0-9-]{36}$/);expect(before.owner).toBeNull();
 await close(page);await accountSheet(page);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect.poll(async()=>(await consent(page)).foreground).toBeNull();
 expect((await stored(page)).habits).toEqual(guest.habits);
});
