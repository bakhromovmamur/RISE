import {test,expect,stored}from"../support/browser.ts";
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport,accountCache,allowSecondSyntheticSession,expireSyntheticSession,reflection,syncNetwork}from"../support/syncBrowser.ts";
import {accountText}from"../../src/auth/text.ts";
import {syncText}from"../../src/sync/text.ts";
const text=accountText("en"),sync=syncText("en");
// Reset only the synthetic server outage gate, independently of a failed page.
test.beforeEach(async({request})=>{expect((await request.post("/__infra_test__/network?offline=false",{timeout:5000})).ok()).toBe(true);});
test.afterEach(async({request})=>{expect((await request.post("/__infra_test__/network?offline=false",{timeout:5000})).ok()).toBe(true);});

test("sign-in never uploads a guest; reviewed import preserves the device profile and excludes private device fields",async({page})=>{
  const raw=await seedSyncGuest(page),before=await stored(page);let uploads=0;const bodies:string[]=[];
  page.on("request",request=>{if(request.method()==="POST"&&new URL(request.url()).pathname.startsWith("/api/v1/sync/")){uploads++;bodies.push(request.postData()??"");}});
  await accountSheet(page);await browserLogin(page);expect(uploads).toBe(0);expect(await stored(page)).toEqual(before);
  await chooseImport(page);expect(uploads).toBe(0);expect(await(await page.request.get("/api/v1/personal")).json()).toMatchObject({initialized:false});
  await page.getByRole("checkbox",{name:sync("consent"),exact:true}).check();await page.getByRole("button",{name:sync("upload"),exact:true}).click();await expect(page.getByRole("button",{name:sync("confirm"),exact:true})).toBeVisible();
  expect(await(await page.request.get("/api/v1/personal")).json()).toMatchObject({initialized:false});expect(uploads).toBeGreaterThan(1);
  await page.getByRole("button",{name:sync("confirm"),exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
  expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem("rise.local.v1"))).toBe(raw);
  expect(bodies.some(body=>/latitude|longitude|calculationKey|Synthetic unfinished draft/.test(body))).toBe(false);
  const cache=await accountCache(page);expect(cache).toHaveLength(1);expect(cache[0].queue).toHaveLength(0);expect(cache[0].state.name).toBe("Synthetic device profile");
});

test("two independent browser devices converge through real sessions without duplicating habit XP",async({page,browser,baseURL})=>{
  await seedSyncGuest(page);await accountSheet(page);const email=await browserLogin(page);await chooseImport(page);await finishImport(page);
  const context=await browser.newContext({baseURL,viewport:{width:393,height:852},timezoneId:"Asia/Tashkent",reducedMotion:"reduce"});await context.route("**/*",route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort("blockedbyclient"));
  try{const second=await context.newPage();await seedSyncGuest(second);await accountSheet(second);await allowSecondSyntheticSession(email);await browserLogin(second,true,email);await second.getByRole("button",{name:sync("use"),exact:true}).click();await expect(second.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
    await reflection(page,"A change from device one");await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
    await second.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect.poll(async()=> Object.values((await accountCache(second))[0]?.state.reflections??{}).some(r=>r.manageable==="A change from device one")).toBe(true);await second.getByRole("tab",{name:"Progress",exact:true}).click();await second.getByRole("button",{name:/^(A moment to reflect|Read your reflection)/}).click();await expect(second.getByLabel("What felt manageable?",{exact:false})).toHaveValue("A change from device one",{timeout:30000});
    const personal=await(await second.request.get("/api/v1/personal")).json();expect(personal.xp).toBe(20);
  }finally{await context.close();}
});

test("remembered offline changes survive reload and reconnect; sign-out clears only the account cache",async({page,request})=>{
  test.setTimeout(90000);
  // WebKit may surface the deliberately broken same-origin fetch as a page error.
  // Classify only that exact fault until the queued writes have recovered.
  let disconnected=false;const errors:string[]=[];page.on("pageerror",error=>{if(disconnected&&/^(?:Fetch API cannot load http:\/)?\/127\.0\.0\.1:4191\/api\/v1\/sync\/commands due to access control checks\.$/.test(error.message))return;errors.push(error.message);});
  await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:15000}).toBe(true);
  await test.step("Disconnect the isolated test server",async()=>{disconnected=true;expect((await request.post("/__infra_test__/network?offline=true",{timeout:5000})).ok()).toBe(true);});
  try{await test.step("Save an offline account reflection",async()=>{await reflection(page,"A durable offline reflection");await expect.poll(async()=> (await accountCache(page))[0]?.queue.length??0).toBeGreaterThan(0);});
    await test.step("Reload the cached app shell",async()=>{await page.reload({waitUntil:"domcontentloaded",timeout:30000});await expect(page.getByText("Offline · saved on this device",{exact:true}).first()).toBeVisible({timeout:30000});await expect(page.getByRole("tab",{name:"Today",exact:true})).toBeVisible();});
    await test.step("Recover the original queued reflection",async()=>{await page.getByRole("tab",{name:"Progress",exact:true}).click();await page.getByRole("button",{name:/^(A moment to reflect|Read your reflection)/}).click();await expect(page.getByLabel("What felt manageable?",{exact:false})).toHaveValue("A durable offline reflection");});
  }finally{await test.step("Reconnect independently of the navigating browser",async()=>{expect((await request.post("/__infra_test__/network?offline=false",{timeout:5000})).ok()).toBe(true);});}
  await page.evaluate(()=>window.dispatchEvent(new Event("online")));await expect.poll(async()=> (await accountCache(page))[0]?.queue.length??-1,{timeout:30000}).toBe(0);disconnected=false;
  await page.getByRole("button",{name:"Close",exact:true}).click();await accountSheet(page);await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect.poll(async()=> (await accountCache(page)).length).toBe(0);
  await accountSheet(page);await expect(page.getByRole("button",{name:text("send"),exact:true})).toBeVisible();expect(await accountCache(page)).toEqual([]);expect((await stored(page)).habits[0].name).toBe("Synthetic reading");expect(errors).toEqual([]);
});

test("a lost command response retries the same operation once and session-only mode stores no private cache",async({page})=>{
  await seedSyncGuest(page);await accountSheet(page);await browserLogin(page,false);await chooseImport(page);await finishImport(page);expect(await accountCache(page)).toEqual([]);
  await syncNetwork(page,"lost-once");await reflection(page,"One accepted response loss");await expect.poll(async()=> (await(await page.request.get("/__infra_test__/sync-network")).json()).discardedReplies).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
  const value=await(await page.request.get("/api/v1/personal")).json();expect(value.xp).toBe(20);expect(value.records.reflections.some((r:{data:{manageable:string}})=>r.data.manageable==="One accepted response loss")).toBe(true);expect(await accountCache(page)).toEqual([]);
});
test("expired remembered work stays locked to its owner through another account and resumes after reauthentication",async({page})=>{
  test.setTimeout(90000);
  await seedSyncGuest(page);await accountSheet(page);const email=await browserLogin(page);await chooseImport(page);await finishImport(page);
  const owner=(await accountCache(page))[0].owner;
  await syncNetwork(page,"offline");await reflection(page,"Remembered owner A pending reflection");await expect.poll(async()=> (await accountCache(page))[0].queue.length).toBeGreaterThan(0);
  await expireSyntheticSession(email);await page.reload();await expect(page.getByText("Saved on this device",{exact:true}).first()).toBeAttached({timeout:10000});
  await accountSheet(page);await browserLogin(page);await page.getByRole("button",{name:sync("empty"),exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
  const other=await(await page.request.get("/api/v1/personal")).json(),otherHead=await(await page.request.get("/api/v1/sync/head")).json();expect(otherHead.accountId).not.toBe(owner);expect(other.records.habits).toEqual([]);expect(other.records.reflections).toEqual([]);expect((await accountCache(page)).find(c=>c.owner===owner)!.queue.length).toBeGreaterThan(0);
  await page.getByRole("button",{name:"Start with salah",exact:true}).click();await page.getByRole("button",{name:"Close",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
  await accountSheet(page);await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect.poll(async()=> (await accountCache(page)).length).toBe(1);
  await accountSheet(page);await allowSecondSyntheticSession(email);await browserLogin(page,true,email);await syncNetwork(page,"online");await page.getByRole("button",{name:sync("use"),exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});
  await expect.poll(async()=> (await accountCache(page)).find(c=>c.owner===owner)?.queue.length??-1).toBe(0);const restored=await(await page.request.get("/api/v1/personal")).json();expect(restored.xp).toBe(20);expect(restored.records.reflections.some((r:{data:{manageable:string}})=>r.data.manageable==="Remembered owner A pending reflection")).toBe(true);
});
test("pending account sign-out offers recovery and requires explicit discard consent",async({page})=>{
  await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);
  await syncNetwork(page,"offline");await reflection(page,"Export this before discarding");await expect.poll(async()=> (await accountCache(page))[0].queue.length).toBeGreaterThan(0);
  await accountSheet(page);await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect(page.getByRole("alert")).toHaveText(text("pending_changes"));
  await page.getByRole("checkbox",{name:sync("discard"),exact:true}).check();await page.getByRole("checkbox",{name:sync("discard"),exact:true}).uncheck();await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect(page.getByRole("alert")).toHaveText(text("pending_changes"));
  await page.getByRole("button",{name:sync("device"),exact:true}).click();await accountSheet(page);await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect(page.getByRole("alert")).toHaveText(text("pending_changes"));
  const download=page.waitForEvent("download");await page.getByRole("button",{name:sync("export"),exact:true}).click();expect((await download).suggestedFilename()).toBe("rise-account-pending.json");
  await page.getByRole("checkbox",{name:sync("discard"),exact:true}).check();await page.getByRole("button",{name:text("signOut"),exact:true}).click();await expect.poll(async()=> (await accountCache(page)).length).toBe(0);expect((await stored(page)).name).toBe("Synthetic device profile");
});
test("a failed account cache transaction commits neither state nor outbox and retries without false success",async({page})=>{
  await seedSyncGuest(page);await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);const before=await accountCache(page);
  await accountSheet(page);await page.getByRole("button",{name:text("continue"),exact:true}).click();
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="accounts")throw new DOMException("Synthetic account storage failure","QuotaExceededError");return put.apply(this,args);};window.addEventListener("sync-test-restore-storage",()=>{IDBObjectStore.prototype.put=put;},{once:true});});
  try{await page.getByLabel("Your name",{exact:true}).fill("Durable account name");await expect(page.getByRole("heading",{name:"Your saved data needs attention"})).toBeVisible();expect(await accountCache(page)).toEqual(before);expect((await(await page.request.get("/api/v1/personal")).json()).records.profiles[0].name).toBe("Synthetic device profile");}
  finally{await page.evaluate(()=>window.dispatchEvent(new Event("sync-test-restore-storage")));}
  await page.getByRole("button",{name:"Retry",exact:true}).click();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});expect((await(await page.request.get("/api/v1/personal")).json()).records.profiles[0].name).toBe("Durable account name");expect((await stored(page)).name).toBe("Synthetic device profile");
});
