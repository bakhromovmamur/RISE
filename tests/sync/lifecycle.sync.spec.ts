import {test,expect,stored} from "../support/browser.ts";
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport,accountCache,reflection,syncNetwork,allowSecondSyntheticSession} from "../support/syncBrowser.ts";
import {lifecycleText} from "../../src/account/text.ts";
import {authHarness,localCode} from "../support/auth.ts";
import {lifecycleDatabase,accountPurger,purgeAccounts} from "../../server/lifecycle/worker.ts";
import {readFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {parseAccountExport} from "../../src/account/export.ts";
const t=lifecycleText("en");
async function purge(){const e=parseEnv(await readFile(".rise-infra/test/lifecycle.env","utf8")),s=lifecycleDatabase({environment:"test",installationId:e.INSTALLATION_ID!,databaseUrl:e.DATABASE_LIFECYCLE_URL!});try{await s.verify();return await purgeAccounts(s.pool,accountPurger("test",e.SUPABASE_URL!,e.SUPABASE_SECRET_KEY!));}finally{await s.close();}}
test("account export and explicit device cleanup preserve the server, guest and other cached owner",async({page})=>{
 await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);
 const cache=(await accountCache(page))[0],other=crypto.randomUUID();await page.evaluate(async({cache,other})=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("rise-accounts",1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction("accounts","readwrite");tx.objectStore("accounts").put({...cache,owner:other,state:{...cache.state,name:"Synthetic other owner"}},other);tx.oncomplete=()=>resolve();});db.close();},{cache,other});
 const otherTab=await page.context().newPage();await otherTab.goto("/");await expect(otherTab.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
 await accountSheet(page);const download=page.waitForEvent("download");await page.getByRole("button",{name:t("export"),exact:true}).click();const file=await download,path=await file.path();if(!path)throw new Error("synthetic_export_missing");const parsed=await parseAccountExport(await readFile(path,"utf8"));expect(parsed.accountId).toBe(cache.owner);expect(parsed.xp).toBe(20);expect(parsed.records.habits).toHaveLength(1);
 await page.getByRole("button",{name:t("clear"),exact:true}).click();await expect(page.getByRole("button",{name:t("clear"),exact:true})).toBeDisabled();await page.getByRole("checkbox",{name:t("confirmClear"),exact:true}).check();await page.getByRole("button",{name:t("clear"),exact:true}).click();
 await expect.poll(async()=> (await accountCache(page)).map(c=>c.owner)).toEqual([other]);expect(await stored(page)).toEqual(guest);
 const remote=await(await page.request.get("/api/v1/personal")).json();expect(remote.initialized).toBe(true);expect(remote.xp).toBe(20);
 await expect(otherTab.getByText("Saved on this device",{exact:true}).first()).toBeVisible({timeout:30000});await otherTab.close();
 await page.reload();await expect(page.getByRole("tab",{name:"Today",exact:true})).toBeVisible();expect((await accountCache(page)).map(c=>c.owner)).toEqual([other]);
});
test("lost deletion reply clears pending private data across tabs and cannot resurrect a deleted account",async({page,context})=>{
 test.setTimeout(90000);const raw=await seedSyncGuest(page),guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);const owner=(await accountCache(page))[0].owner;
 const second=await context.newPage();await second.goto("/");await expect(second.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
 await syncNetwork(page,"offline");await reflection(page,"Synthetic pending deletion data");await expect.poll(async()=>(await accountCache(page))[0].queue.length).toBeGreaterThan(0);
 await page.evaluate(owner=>{localStorage.setItem(`rise.alert.${owner}:synthetic`,"1");localStorage.setItem("rise.alert.guest-synthetic","1");},owner);
 const session=await(await page.request.get("/api/v1/session")).json();expect((await page.request.post("/__infra_test__/deletion-lost-reply",{headers:{Origin:new URL(page.url()).origin,"X-Rise-CSRF":session.csrfToken},data:{}})).ok()).toBe(true);
 await accountSheet(page);await page.getByRole("button",{name:t("remove"),exact:true}).click();await expect(page.getByRole("button",{name:t("confirm"),exact:true})).toBeDisabled();await page.getByRole("checkbox",{name:t("confirmDelete"),exact:true}).check();await page.getByRole("button",{name:t("confirm"),exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await second.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await expect.poll(async()=>(await accountCache(page)).length,{timeout:30000}).toBe(0);await expect(second.getByText("Saved on this device",{exact:true}).first()).toBeVisible({timeout:30000});expect(await stored(page)).toEqual(guest);expect(await page.evaluate(()=>localStorage.getItem("rise.local.v1"))).toBe(raw);
 expect(await page.evaluate(owner=>localStorage.getItem(`rise.alert.${owner}:synthetic`),owner)).toBeNull();expect(await page.evaluate(()=>localStorage.getItem("rise.alert.guest-synthetic"))).toBe("1");
 const stale=await page.evaluate(async({owner,csrf})=>{try{return(await fetch("/api/v1/personal/commands",{method:"POST",headers:{"Content-Type":"application/json","X-Rise-CSRF":csrf},body:JSON.stringify({accountId:owner,operations:[]})})).status;}catch{return 0;}},{owner,csrf:session.csrfToken});expect(stale).toBe(401);
 const h=await authHarness();try{expect((await h.admin.query("select count(*) from rise_private.deletion_jobs where user_id=$1",[owner])).rows[0].count).toBe("1");}finally{await h.close();}
 await purge();await accountSheet(page);await expect(page.getByText(t("purged"),{exact:true})).toBeVisible();await second.close();
});
test("failed device cleanup hides the deleted account and exposes a truthful retry without wiping guest data",async({page})=>{
 test.setTimeout(90000);await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);const owner=(await accountCache(page))[0].owner;
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;Object.assign(window,{restoreLifecyclePut:()=>{IDBObjectStore.prototype.put=original;}});IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore["put"]>){if(this.name==="preferences"&&typeof args[1]==="string"&&(args[1].startsWith("deleted:")||args[1].startsWith("cleared:"))){this.transaction.abort();throw new DOMException("Synthetic cleanup failure","QuotaExceededError");}return original.apply(this,args);};});
 await accountSheet(page);await page.getByRole("button",{name:t("remove"),exact:true}).click();await page.getByRole("checkbox",{name:t("confirmDelete"),exact:true}).check();await page.getByRole("button",{name:t("confirm"),exact:true}).click();await expect(page.getByRole("tab",{name:"Today",exact:true})).toBeVisible();
 await accountSheet(page);await expect(page.getByText(t("cleanupFailed"),{exact:true})).toBeVisible();expect((await accountCache(page)).some(c=>c.owner===owner)).toBe(true);expect(await stored(page)).toEqual(guest);
 await page.evaluate(()=>{(window as unknown as{restoreLifecyclePut:()=>void}).restoreLifecyclePut();});await page.getByRole("button",{name:t("retry"),exact:true}).click();await expect.poll(async()=>(await accountCache(page)).length).toBe(0);await expect(page.getByText(t("cleanupFailed"),{exact:true})).toHaveCount(0);expect(await stored(page)).toEqual(guest);await purge();
});
test("email reauthentication keeps the account and pending store while enabling a recent-auth export",async({page})=>{
 test.setTimeout(90000);await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);const email=await browserLogin(page);await chooseImport(page);await finishImport(page);const before=(await accountCache(page))[0],previous=await localCode(email);
 const h=await authHarness();try{await h.admin.query("update rise_private.server_sessions set authenticated_at=now()-interval '11 minutes' where user_id=$1",[before.owner]);}finally{await h.close();}
 await accountSheet(page);await page.getByRole("button",{name:t("export"),exact:true}).click();await expect(page.getByText(t("recent"),{exact:true})).toBeVisible();await allowSecondSyntheticSession(email);await page.getByRole("button",{name:t("send"),exact:true}).click();
 const mail=await localCode(email,[previous.id]);try{await page.getByLabel(t("code"),{exact:true}).fill(mail.code);await page.getByRole("button",{name:t("verify"),exact:true}).click();await expect(page.getByRole("button",{name:t("export"),exact:true})).toBeEnabled();}finally{const input=page.getByLabel(t("code"),{exact:true});if(await input.count())await input.fill("").catch(()=>{});}
 const download=page.waitForEvent("download");await page.getByRole("button",{name:t("export"),exact:true}).click();const file=await download,path=await file.path();if(!path)throw new Error("synthetic_export_missing");const exported=await parseAccountExport(await readFile(path,"utf8"));expect(exported.accountId).toBe(before.owner);expect(exported.email).toBe(email);expect(exported.xp).toBe(20);expect((await accountCache(page))[0].owner).toBe(before.owner);expect(await stored(page)).toEqual(guest);
});
