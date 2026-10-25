import{createECDH,randomBytes,randomUUID}from"node:crypto";
import{expect,type Page}from"./browser.ts";
import{createTranslator,type Language}from"../../src/i18n.ts";
import{pushText}from"../../src/push/text.ts";
export async function pushSheet(page:Page,language:Language="en"){
 for(let n=0;n<5&&await page.getByRole("dialog").count();n++)await page.keyboard.press("Escape");
 const t=createTranslator(language);
 await page.getByRole("tab",{name:t("You","Siz"),exact:true}).click();
 await page.getByRole("button",{name:new RegExp(`^${t("Prayer preferences","Namoz sozlamalari")} `)}).click();
 await page.getByRole("button",{name:new RegExp(`^${t("Alarm readiness","Signal tayyorligi")} `)}).click();
 await expect(page.getByRole("region",{name:pushText(language)("title"),exact:true})).toBeVisible();
}
/** Browser OS/provider seam only. The page, worker registration, IDB, session,
 * CSRF, database and subscription API remain real. No external push is sent. */
export async function syntheticPushBrowser(page:Page,permission:"default"|"denied"|"granted"="default"){
 const ec=createECDH("prime256v1");ec.generateKeys();const subscription={endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-browser-${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}};
 await page.addInitScript(({subscription,permission})=>{
  let observedPermission=(localStorage.getItem("__synthetic_permission")??permission) as typeof permission;
  const state={get permission(){return observedPermission;},set permission(value:typeof permission){observedPermission=value;if(value!=="granted")localStorage.removeItem("__synthetic_push_subscribed");},asked:0,subscribed:0,unsubscribed:0};Object.defineProperty(window,"__risePushTest",{value:state});
  class SyntheticNotification{static get permission(){return state.permission;}static async requestPermission(){state.asked++;state.permission="granted";localStorage.setItem("__synthetic_permission","granted");return"granted";}close(){}}
  Object.defineProperty(window,"Notification",{value:SyntheticNotification,configurable:true});
  Object.defineProperty(window,"PushManager",{value:class{},configurable:true});
  const active=()=>localStorage.getItem("__synthetic_push_subscribed")==="yes";
  const sub=()=>({endpoint:subscription.endpoint,expirationTime:null,options:{applicationServerKey:new Uint8Array(JSON.parse(localStorage.getItem("__synthetic_push_public")??"[]")).buffer},toJSON:()=>subscription,unsubscribe:async()=>{state.unsubscribed++;localStorage.removeItem("__synthetic_push_subscribed");return true;}});
  Object.defineProperty(ServiceWorkerRegistration.prototype,"pushManager",{configurable:true,get:()=>({getSubscription:async()=>active()?sub():null,subscribe:async(options:{applicationServerKey:ArrayBufferView;userVisibleOnly:boolean})=>{if(!options.userVisibleOnly||state.permission!=="granted")throw new Error("synthetic_push_permission");state.subscribed++;localStorage.setItem("__synthetic_push_subscribed","yes");localStorage.setItem("__synthetic_push_public",JSON.stringify(Array.from(new Uint8Array(options.applicationServerKey.buffer))));return sub();}})});
 },{subscription,permission});
 return{subscription,ec};
}
