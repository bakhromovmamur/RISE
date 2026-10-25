import {test,expect,stored,type Page}from"../support/browser.ts";
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport,accountCache,reflection,syncNetwork}from"../support/syncBrowser.ts";
import {syncText}from"../../src/sync/text.ts";
const sync=syncText("en");
async function remoteReflection(page:Page,value:string){
 const session=await(await page.request.get("/api/v1/session")).json(),head=await(await page.request.get("/api/v1/sync/head")).json(),view=await(await page.request.get("/api/v1/personal")).json();
 const cache=(await accountCache(page))[0],command=[...cache.queue,...(cache.recovery?.queue??[])].flatMap(batch=>batch.operations).map(op=>op.command).find(command=>command.kind==="reflection.save");
 const date=command?.date??new Date().toISOString().slice(0,10);
 const response=await page.request.post("/api/v1/personal/commands",{headers:{Origin:new URL(page.url()).origin,"X-Rise-CSRF":session.csrfToken},data:{protocolVersion:1,operationId:crypto.randomUUID(),baseRevision:head.revision,command:{kind:"reflection.save",date,reflection:{manageable:value,smaller:""}}}});
 expect(view.initialized).toBe(true);expect(response.status()).toBe(200);
}
async function setup(page:Page){await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);return guest;}
async function conflict(page:Page,local:string,remote:string){await syncNetwork(page,"offline");await reflection(page,local);await expect.poll(async()=>(await accountCache(page))[0].queue.length).toBeGreaterThan(0);await remoteReflection(page,remote);await syncNetwork(page,"online");await accountSheet(page);await page.getByRole("button",{name:sync("sync"),exact:true}).click();await expect(page.getByRole("button",{name:"Review pending changes",exact:true})).toBeVisible();}
const review=(page:Page)=>page.getByRole("button",{name:"Review pending changes",exact:true}).click();
test("a conflict offers explicit account/local choices and retains the original actions in durable recovery",async({page})=>{
 const guest=await setup(page);await conflict(page,"Queued personal reflection","Newer account reflection");const old=await accountCache(page);await review(page);
 await expect(page.getByText(/Newer account reflection/).last()).toBeVisible();await expect(page.getByText(/Queued personal reflection/).last()).toBeVisible();
 await page.getByRole("button",{name:"Keep account record",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible();
 let cache=(await accountCache(page))[0];expect(Object.values(cache.state.reflections).some(r=>r.manageable==="Newer account reflection")).toBe(true);expect(JSON.stringify(cache)).toContain("Queued personal reflection");expect(cache.recovery!.queue).toEqual(old[0].queue);
 await page.keyboard.press("Escape");await page.keyboard.press("Escape");await conflict(page,"Reviewed local reflection","Another account reflection");await review(page);
 await page.getByRole("button",{name:"Apply my action",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible();cache=(await accountCache(page))[0];expect(Object.values(cache.state.reflections).some(r=>r.manageable==="Reviewed local reflection")).toBe(true);expect(cache.queue).toHaveLength(0);expect(await stored(page)).toEqual(guest);
 const result=await(await page.request.get("/api/v1/personal")).json();expect(result.records.reflections.some((r:{data:{manageable:string}})=>r.data.manageable==="Reviewed local reflection")).toBe(true);
});
test("legacy format-one queues older than 90 days survive reload and require a fresh reviewed operation",async({page})=>{
 await setup(page);await syncNetwork(page,"offline");await reflection(page,"Stale device intent");await expect.poll(async()=>(await accountCache(page))[0].queue.length).toBeGreaterThan(0);
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("rise-accounts",1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction("accounts","readwrite"),store=tx.objectStore("accounts"),r=store.getAll();r.onsuccess=()=>{for(const cache of r.result){cache.format=1;delete cache.records;for(const batch of cache.queue)for(const op of batch.operations){delete op.expected;delete op.observedRevision;delete op.predecessor;op.context.now=Date.now()-91*86400000;op.context.date=new Date(op.context.now).toISOString().slice(0,10);}store.put(cache,cache.owner);}};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error("fixture_write"));});db.close();});
 const old=(await accountCache(page))[0].queue;await page.reload({waitUntil:"domcontentloaded"});await expect(page.getByText("Offline · saved on this device",{exact:true}).first()).toBeVisible({timeout:30000});await expect(page.getByRole("tab",{name:"You",exact:true})).toBeVisible();await syncNetwork(page,"online");await accountSheet(page);await page.getByRole("button",{name:sync("sync"),exact:true}).click();await review(page);
 await expect(page.getByText(/Stale device intent/).last()).toBeVisible({timeout:15000});await page.getByRole("button",{name:"Apply my action",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible();
 const cache=(await accountCache(page))[0];expect(cache.recovery!.queue).toEqual(old);expect(cache.queue).toHaveLength(0);expect((await(await page.request.get("/api/v1/personal")).json()).records.reflections.some((r:{data:{manageable:string}})=>r.data.manageable==="Stale device intent")).toBe(true);
});
test("failed recovery storage and a stale review cannot drop intent or replace newer account records",async({page})=>{
 await setup(page);await conflict(page,"Retain through failures","Server before preview");const before=await accountCache(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="accounts")throw new DOMException("Synthetic recovery quota","QuotaExceededError");return original.apply(this,args);};window.addEventListener("recovery-test-restore",()=>{IDBObjectStore.prototype.put=original;},{once:true});});
 try{await review(page);await expect(page.getByRole("alert").last()).toContainText("Review could not finish");expect(await accountCache(page)).toEqual(before);}finally{await page.evaluate(()=>window.dispatchEvent(new Event("recovery-test-restore")));}
 await review(page);await expect(page.getByRole("button",{name:"Apply my action",exact:true})).toBeVisible();await remoteReflection(page,"Server after preview");await page.getByRole("button",{name:"Apply my action",exact:true}).click();await expect(page.getByRole("alert").last()).toContainText("Review could not finish");expect(JSON.stringify(await accountCache(page))).toContain("Retain through failures");
 await review(page);await expect(page.getByText(/Server after preview/).last()).toBeVisible();await page.getByRole("button",{name:"Keep account record",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible();expect(Object.values((await accountCache(page))[0].state.reflections).some(r=>r.manageable==="Server after preview")).toBe(true);
});
