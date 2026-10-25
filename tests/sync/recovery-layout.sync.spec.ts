import {test,expect}from"../support/browser.ts";
import {seedSyncGuest,accountSheet}from"../support/syncBrowser.ts";
import {syncGuest}from"../support/syncData.ts";
import {prepareGuestImport,recordsFromEntries}from"../../src/sync/importModel.ts";
import {hydrate,personalTables}from"../../src/contracts/personalRecords.ts";
import {localDate}from"../../src/model.ts";
import type {SyncOperation}from"../../src/contracts/sync.ts";
import {createTranslator}from"../../src/i18n.ts";
import {syncStatusText}from"../../src/sync/text.ts";
test.use({serviceWorkers:"block"});
for(const language of["en","uz","ru"]as const)test(`recovery review reflows in ${language} using existing components`,async({page},info)=>{
 const owner="11111111-1111-4111-8111-111111111111",guest=syncGuest();guest.life.language=language;const proposal=await prepareGuestImport(guest,owner,{habitIds:["authored-reading"],goals:true,prayers:true,reflections:true,settings:true}),records=recordsFromEntries(proposal.entries),state=hydrate(records),now=Date.now(),date=localDate(state.timezone,new Date(now));
 const names={en:["Review pending changes","Keep account record","Apply my action"],uz:["Kutilayotgan o‘zgarishlarni tekshirish","Hisobdagi qaydni saqlash","Mening amalimni qo‘llash"],ru:["Проверить ожидающие изменения","Оставить запись аккаунта","Применить моё действие"]}[language];
 const operation:SyncOperation={protocolVersion:1,operationId:"22222222-2222-4222-8222-222222222222",baseRevision:1,command:{kind:"reflection.save",date,reflection:{manageable:"Synthetic queued reflection · "+"UzunMatn".repeat(20),smaller:"A small next step"}},context:{now,date,timezone:state.timezone}};
 await page.route("**/api/v1/**",async route=>{const path=new URL(route.request().url()).pathname;
 if(path==="/api/v1/session")return route.fulfill({json:{signedIn:true,csrfToken:"0".repeat(64),delivery:"email",account:{id:owner,email:"visual-only@example.invalid",remembered:true,authenticatedAt:"2026-10-22T00:00:00Z",expiresAt:"2026-10-23T00:00:00Z"}}});
 if(path==="/api/v1/sync/head")return route.fulfill({json:{accountId:owner,initialized:true,revision:2,xp:20}});
 if(path==="/api/v1/sync/commands")return route.fulfill({status:409,json:{error:{code:"intent_conflict"}}});
 if(path==="/api/v1/sync/review")return route.fulfill({json:{accountId:owner,revision:2,operationId:operation.operationId,canReapply:true,reason:"unknown"}});
 if(path==="/api/v1/sync/pull"){const {cursor}=route.request().postDataJSON(),table=personalTables[cursor.table].name;return route.fulfill({json:{accountId:owner,initialized:true,revision:2,xp:20,table,rows:records[table],next:cursor.table+1<personalTables.length?{table:cursor.table+1,offset:0}:null}});}
 return route.abort("blockedbyclient");});
 await seedSyncGuest(page,language);
 await page.evaluate(async({owner,state,operation})=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("rise-accounts",1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction(["accounts","preferences"],"readwrite");tx.objectStore("accounts").put({format:1,owner,version:0,revision:1,state,queue:[{id:operation.operationId,operations:[operation]}]},owner);tx.objectStore("preferences").put(owner,"active");tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error("fixture_write"));});db.close();sessionStorage.setItem("rise.account-view","1");},{owner,state,operation});
 await page.reload({waitUntil:"domcontentloaded"});await expect.poll(async()=>{const texts=await page.getByRole("status").allTextContents();return (["saved-device","syncing","attention"]as const).some(phase=>texts.includes(syncStatusText(language,{phase,pending:1,persistent:true,error:null})));}).toBe(true);await expect(page.getByRole("tab",{name:createTranslator(language)("You","Siz"),exact:true})).toBeVisible();await accountSheet(page,language);await page.getByRole("button",{name:names[0],exact:true}).click();await expect(page.getByRole("button",{name:names[2],exact:true})).toBeVisible();
 for(const appearance of["light","dark"]as const)for(const width of[375,393,430,320,1440])for(const scale of(width===1440?[100]:[100,200])){
  await page.setViewportSize({width,height:width===1440?1000:852});await page.evaluate(({appearance,scale})=>{document.querySelector(".app-shell")?.setAttribute("data-theme",appearance);document.documentElement.style.fontSize=`${scale}%`;},{appearance,scale});const action=page.getByRole("button",{name:names[2],exact:true});
  if(info.project.name==="chromium"&&(width===393&&scale===100||width===320&&scale===200||width===1440)){await page.getByRole("heading",{name:names[0],exact:true}).scrollIntoViewIfNeeded();await page.getByRole("dialog").screenshot({path:info.outputPath(`recovery-top-${language}-${appearance}-${width}-${scale}.png`)});}await action.scrollIntoViewIfNeeded();await expect(action).toBeInViewport();expect(await page.getByRole("dialog").evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
  if(info.project.name==="chromium"&&(width===393&&scale===100||width===320&&scale===200||width===1440))await page.getByRole("dialog").screenshot({path:info.outputPath(`recovery-${language}-${appearance}-${width}-${scale}.png`)});
 }
 await page.getByRole("button",{name:names[1],exact:true}).focus();await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:names[2],exact:true})).toBeFocused();
});
