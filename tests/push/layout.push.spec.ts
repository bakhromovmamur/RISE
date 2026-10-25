import{test,expect}from"../support/browser.ts";
import{seedSyncGuest}from"../support/syncBrowser.ts";
import{pushSheet,syntheticPushBrowser}from"../support/pushBrowser.ts";
import{pushText}from"../../src/push/text.ts";
test.use({serviceWorkers:"block"});
for(const language of["en","ru","uz"]as const)test(`notification setup, privacy and pending cancellation layout · ${language}`,async({page},info)=>{
 test.setTimeout(90000);const owner="44444444-4444-4444-8444-444444444444",installation="55555555-5555-4555-8555-555555555555",t=pushText(language);
 const synthetic=await syntheticPushBrowser(page,"granted");
 await page.addInitScript(()=>{Object.defineProperty(ServiceWorkerContainer.prototype,"getRegistration",{configurable:true,value:async()=>({pushManager:Object.getOwnPropertyDescriptor(ServiceWorkerRegistration.prototype,"pushManager")!.get!.call({})})});});
 await page.route("**/api/v1/**",async route=>{const path=new URL(route.request().url()).pathname;
  if(path==="/api/v1/session")return route.fulfill({json:{signedIn:true,csrfToken:"0".repeat(64),delivery:"email",account:{id:owner,email:"visual-only@example.invalid",remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
  if(path==="/api/v1/push")return route.fulfill({json:{configured:true,publicKey:synthetic.subscription.keys.p256dh,installation:{id:installation,version:1,enabled:true,details:false,language,needsReview:false},test:null}});
  return route.abort("blockedbyclient");
 });
 await seedSyncGuest(page,language);
 await page.evaluate(async({owner,installation,language})=>{
  localStorage.setItem("__synthetic_push_subscribed","yes");
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("rise-push-device",1);r.onupgradeneeded=()=>r.result.createObjectStore("control");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("control","readwrite");tx.objectStore("control").put({revision:1,owner,installation,generation:1,enabled:true,details:false,language,pending:false,lastTest:null},"current");tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 },{owner,installation,language});
 await pushSheet(page,language);const region=page.getByRole("region",{name:t("title"),exact:true});await expect(region.getByText(t("subscribed"),{exact:true})).toBeVisible();
 for(const scene of["privacy","pending","cancel","review"]){
  if(scene==="pending"){await region.getByRole("button",{name:t("disable"),exact:true}).click();await expect(region.getByText(t("pending"),{exact:true})).toBeVisible();}
  if(scene==="cancel"){await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("rise-push-device",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction("control","readwrite"),store=tx.objectStore("control"),r=store.get("current");r.onsuccess=()=>store.put({...r.result,planBlocked:true,cancelRequest:{id:crypto.randomUUID(),pending:true,keys:null}},"current");tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event("rise-push-changed"));});await expect(region.getByText(t("cancelPending"),{exact:true})).toBeVisible();}
  if(scene==="review"){await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-push-device',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('control','readwrite'),s=tx.objectStore('control'),r=s.get('current');r.onsuccess=()=>s.put({...r.result,revision:r.result.revision+1,cancelRequest:{...r.result.cancelRequest,review:true}},'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event('rise-push-changed'));});await expect(region.getByText(t('cancelReview'),{exact:true})).toBeVisible();}
  for(const appearance of["light","dark"])for(const width of[375,393,430,320,1440])for(const scale of(width===1440?[100]:[100,200])){
   await page.setViewportSize({width,height:width===1440?1000:852});await page.evaluate(({appearance,scale})=>{document.querySelector(".app-shell")?.setAttribute("data-theme",appearance);document.documentElement.style.fontSize=`${scale}%`;},{appearance,scale});
   const target=scene==="privacy"?region.getByRole("switch",{name:t("details"),exact:true}):scene==='review'?region.getByRole('button',{name:t('cancelCurrent'),exact:true}):region.getByText(t(scene==="cancel"?"cancelPending":"pending"),{exact:true});await target.scrollIntoViewIfNeeded();await expect(target).toBeInViewport();expect(await page.getByRole("dialog").evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);if(scene==="privacy")expect(await region.getByText(t("details"),{exact:true}).evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.closest(".sheet-body")?.getBoundingClientRect();return r.left>=0&&r.right<=Math.min(innerWidth,parent?.right??innerWidth)+1;})).toBe(true);
   if(info.project.name==="chromium"&&(width===393&&scale===100||width===320&&scale===200||width===1440))await page.getByRole("dialog").screenshot({path:info.outputPath(`push-${scene}-${language}-${appearance}-${width}-${scale}.png`)});
  }
 }
 await region.getByRole("button",{name:t("disable"),exact:true}).focus();await page.keyboard.press("Tab");await expect(region.getByRole("button",{name:t("refresh"),exact:true})).toBeFocused();
});
