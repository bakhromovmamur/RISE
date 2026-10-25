import{test,expect,stored}from"../support/browser.ts";
import{seedSyncGuest,accountSheet,browserLogin}from"../support/syncBrowser.ts";
import{pushSheet,syntheticPushBrowser}from"../support/pushBrowser.ts";
import{pushText}from"../../src/push/text.ts";
import{authHarness}from"../support/auth.ts";
import{accountText}from"../../src/auth/text.ts";
const t=pushText("en");
test.afterEach(async({request})=>{await request.post("/__infra_test__/network?offline=false",{timeout:5000}).catch(()=>{});});
test("explicit device setup, private copy, reload, revoke and re-enable preserve guest data",async({page})=>{
 await syntheticPushBrowser(page);await seedSyncGuest(page);const original=await stored(page);await accountSheet(page);await browserLogin(page);await pushSheet(page);
 const region=page.getByRole("region",{name:t("title"),exact:true});await expect(region.getByRole("button",{name:t("enable"),exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>{const v=(window as unknown as{__risePushTest:{asked:number;subscribed:number}}).__risePushTest;return[v.asked,v.subscribed];})).toEqual([0,0]);
 await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as{__risePushTest:{asked:number}}).__risePushTest.asked)).toBe(1);
 await expect(region.getByRole("switch",{name:t("details"),exact:true})).toHaveAttribute("aria-checked","false");await region.getByRole("switch",{name:t("details"),exact:true}).click();
 // A background status refresh cannot erase an unsaved privacy choice.
 await page.waitForTimeout(5200);await expect(region.getByRole("switch",{name:t("details"),exact:true})).toHaveAttribute("aria-checked","true");
 await region.getByRole("button",{name:t("save"),exact:true}).click();await expect(region.getByText(t("saved"),{exact:true})).toBeVisible();
 await page.reload({waitUntil:"domcontentloaded"});await expect(page.getByRole("tab",{name:"You",exact:true})).toBeVisible();await pushSheet(page);await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();await expect(region.getByRole("switch",{name:t("details"),exact:true})).toHaveAttribute("aria-checked","true");
 await region.getByRole("button",{name:t("test"),exact:true}).click();await expect(region.getByText(t("queued"),{exact:true})).toBeVisible();
 await region.getByRole("button",{name:t("disable"),exact:true}).click();await expect(region.getByText(t("missing"),{exact:true})).toBeVisible();
 await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();await expect(region.getByRole("switch",{name:t("details"),exact:true})).toHaveAttribute("aria-checked","false");
 expect((await stored(page)).habits).toEqual(original.habits);expect((await stored(page)).name).toEqual(original.name);
 // Logout is a real protected server transaction, then the normal page observer clears device consent.
 const result=await page.evaluate(async()=>{const s=await(await fetch("/api/v1/session",{cache:"no-store"})).json();return(await fetch("/api/v1/logout",{method:"POST",headers:{"Content-Type":"application/json","X-Rise-CSRF":s.csrfToken},body:"{}"})).status;});expect(result).toBe(200);await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(region.getByText(t("account"),{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem("__synthetic_push_subscribed"))).toBe(null);expect((await stored(page)).habits).toEqual(original.habits);
});
test("denied permission never re-prompts; explicit refresh and enable recover",async({page})=>{
 await syntheticPushBrowser(page,"denied");await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await pushSheet(page);const region=page.getByRole("region",{name:t("title"),exact:true});await expect(region.getByText(t("denied"),{exact:true})).toBeVisible();await expect(region.getByRole("button",{name:t("enable"),exact:true})).toBeDisabled();
 await page.evaluate(()=>{(window as unknown as{__risePushTest:{permission:string}}).__risePushTest.permission="default";});await region.getByRole("button",{name:t("refresh"),exact:true}).click();await expect(region.getByRole("button",{name:t("enable"),exact:true})).toBeEnabled();await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();
 await page.evaluate(()=>{(window as unknown as{__risePushTest:{permission:string}}).__risePushTest.permission="denied";window.dispatchEvent(new Event("focus"));});await expect(region.getByText(t("denied"),{exact:true})).toBeVisible({timeout:20000});await expect.poll(()=>page.evaluate(()=>localStorage.getItem("__synthetic_push_subscribed"))).toBe(null);
 expect(await page.evaluate(()=>(window as unknown as{__risePushTest:{asked:number}}).__risePushTest.asked)).toBe(1);
});
test("offline disable stops the installation first and retries remote cancellation on reconnect",async({page,request})=>{
 await syntheticPushBrowser(page);await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await pushSheet(page);const region=page.getByRole("region",{name:t("title"),exact:true});await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();
 await request.post("/__infra_test__/network?offline=true",{timeout:5000});await region.getByRole("button",{name:t("disable"),exact:true}).click();await expect(region.getByText(t("pending"),{exact:true})).toBeVisible({timeout:20000});expect(await page.evaluate(()=>localStorage.getItem("__synthetic_push_subscribed"))).toBe(null);
 await request.post("/__infra_test__/network?offline=false",{timeout:5000});await page.evaluate(()=>window.dispatchEvent(new Event("online")));await expect(region.getByText(t("missing"),{exact:true})).toBeVisible({timeout:20000});
});
test("another device and signed-out view never inherit subscription or detailed-copy consent",async({page,browser})=>{
 const email=await(async()=>{await syntheticPushBrowser(page);await seedSyncGuest(page);await accountSheet(page);return browserLogin(page);})();await pushSheet(page);const region=page.getByRole("region",{name:t("title"),exact:true});await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();
 // A distinct synthetic account avoids email resend/provider quota manipulation.
 const second=await browser.newContext({baseURL:"http://127.0.0.1:4191",serviceWorkers:"block"});try{await second.route("**/*",route=>new URL(route.request().url()).origin==="http://127.0.0.1:4191"?route.continue():route.abort());const other=await second.newPage();await seedSyncGuest(other);await pushSheet(other);await expect(other.getByRole("region",{name:t("title"),exact:true}).getByText(t("account"),{exact:true})).toBeVisible();}finally{await second.close();}
 const h=await authHarness();try{const row=(await h.admin.query("select id from auth.users where email=$1",[email])).rows[0];expect((await h.admin.query("select count(*)::int as n from rise.push_subscriptions where user_id=$1 and enabled",[row.id])).rows[0].n).toBe(1);}finally{await h.close();}
 // Normal account sheet remains usable; saved guest source is untouched.
 for(let n=0;n<5&&await page.getByRole("dialog").count();n++)await page.keyboard.press("Escape");await page.getByRole("button",{name:/^Settings /}).click();await page.locator("summary").filter({hasText:"Your data"}).click();await page.getByRole("button",{name:new RegExp(`^${accountText("en")("account")} `)}).click();await expect(page.getByText(accountText("en")("signedIn"),{exact:true})).toBeVisible();
});
test("failed consent storage cannot report success or leave a browser subscription active",async({page})=>{
 await syntheticPushBrowser(page);await page.addInitScript(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore["put"]>){if(this.transaction.db.name==="rise-push-device"&&(window as unknown as{__failPushStorage?:boolean}).__failPushStorage)throw new DOMException("Synthetic quota","QuotaExceededError");return original.apply(this,args);};});
 await seedSyncGuest(page);const original=await stored(page);await accountSheet(page);await browserLogin(page);await pushSheet(page);const region=page.getByRole("region",{name:t("title"),exact:true});await expect(region.getByRole("button",{name:t("enable"),exact:true})).toBeEnabled();
 await page.evaluate(()=>{(window as unknown as{__failPushStorage:boolean}).__failPushStorage=true;});await region.getByRole("button",{name:t("enable"),exact:true}).click();await expect(region.getByRole("alert")).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem("__synthetic_push_subscribed"))).toBe(null);await expect(region.getByText(t("subscribed"),{exact:true})).toHaveCount(0);
 await page.evaluate(()=>{(window as unknown as{__failPushStorage:boolean}).__failPushStorage=false;});await region.getByRole("button",{name:t("refresh"),exact:true}).click();await expect(region.getByRole("button",{name:t("disable"),exact:true})).toBeVisible();await region.getByRole("button",{name:t("disable"),exact:true}).click();await expect(region.getByText(t("missing"),{exact:true})).toBeVisible();expect((await stored(page)).habits).toEqual(original.habits);
});
import {syncText} from '../../src/sync/text.ts';
test('offline quiet-hours edit keeps cancellation pending and retries without enabling a plan',async({page,request})=>{
 await syntheticPushBrowser(page);await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await page.getByRole('button',{name:syncText('en')('empty'),exact:true}).click();await expect(page.getByText('Synced',{exact:true}).first()).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Start with salah',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
 await pushSheet(page);const region=page.getByRole('region',{name:t('title'),exact:true});await region.getByRole('button',{name:t('enable'),exact:true}).click();await expect(region.getByText(t('subscribed'),{exact:true})).toBeVisible();
 for(let n=0;n<5&&await page.getByRole('dialog').count();n++)await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Settings Appearance, language, habits & data',exact:true}).click();
 await page.locator('summary').filter({hasText:'Habit reminders'}).click();
 await request.post('/__infra_test__/network?offline=true',{timeout:5000});await page.getByLabel('Quiet hours start',{exact:true}).fill('23:00');
 await pushSheet(page);await expect(region.getByText(t('cancelPending'),{exact:true})).toBeVisible({timeout:20000});
 await request.post('/__infra_test__/network?offline=false',{timeout:5000});await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(region.getByText(t('planBlocked'),{exact:true})).toBeVisible({timeout:30000});
 expect(await page.evaluate(async()=>{const v=await(await fetch('/api/v1/push/plan')).json();return v.dispatchEnabled;})).toBe(false);
});
