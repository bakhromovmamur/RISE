import type { AccountSession } from "../contracts/auth";
import { accountApi,AccountError } from "../auth/client";
import { parsePushView,type PushView } from "../contracts/push";
import { registerAppWorker } from "../pwa/registration";
import { pushControl,updatePushControl } from "./store";
import {parsePushPlanView} from '../contracts/pushPlan';
export type PushCapability="supported"|"install"|"unsupported"|"insecure";
export function pushCapability(environment:{secure:boolean;notification:boolean;worker:boolean;push:boolean;userAgent:string;touch:number;standalone:boolean}):PushCapability{
  if(!environment.secure)return "insecure";
  const ios=/iPhone|iPad|iPod/.test(environment.userAgent)||/Macintosh/.test(environment.userAgent)&&environment.touch>1;
  if(ios&&!environment.standalone)return "install";
  return environment.notification&&environment.worker&&environment.push?"supported":"unsupported";
}
export const browserPushCapability=()=>pushCapability({secure:window.isSecureContext,notification:"Notification"in window,worker:"serviceWorker"in navigator,push:"PushManager"in window,userAgent:navigator.userAgent,touch:navigator.maxTouchPoints,standalone:matchMedia("(display-mode: standalone)").matches||"standalone"in navigator&&navigator.standalone===true});
export const pushPermission=()=>"Notification"in window?Notification.permission:"denied";
export async function hasBrowserPush(){if(!navigator.serviceWorker||pushPermission()!=="granted")return false;const reg=await navigator.serviceWorker.getRegistration("/");return !!await reg?.pushManager?.getSubscription();}
export const readPush=async(signal?:AbortSignal)=>parsePushView(await accountApi("push",{signal}));
type Identity=()=>AccountSession|null;
const current=(identity:Identity,owner:string)=>identity()?.account?.id===owner;
async function mutate(identity:Identity,owner:string,path:string,body:object,signal?:AbortSignal):Promise<PushView>{const s=identity();if(s?.account?.id!==owner)throw new AccountError("account_changed");return parsePushView(await accountApi(path,{body:{...body,accountId:owner},csrf:s.csrfToken,signal}));}
async function registration(){const reg=await registerAppWorker();if(reg.active)return reg;await new Promise<void>((resolve,reject)=>{const w=reg.installing??reg.waiting;if(!w){reject(new Error("push_worker_unavailable"));return;}const timer=setTimeout(()=>{w.removeEventListener("statechange",change);reject(new Error("push_worker_unavailable"));},8000);function change(){if(w?.state==="activated"){clearTimeout(timer);w.removeEventListener("statechange",change);resolve();}else if(w?.state==="redundant"){clearTimeout(timer);w.removeEventListener("statechange",change);reject(new Error("push_worker_unavailable"));}}w.addEventListener("statechange",change);change();});return reg;}
function publicKey(value:string){return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
let pushQueue:Promise<unknown>=Promise.resolve();
function withPushLock<T>(run:()=>Promise<T>):Promise<T>{
  if(navigator.locks)return navigator.locks.request("rise-web-push-control",run);
  const next=pushQueue.then(run,run);pushQueue=next.catch(()=>{});return next;
}
async function unsubscribe(){
  if(!navigator.serviceWorker)return;const reg=await navigator.serviceWorker.getRegistration("/");
  // RISE only subscribes after notification permission. Revocation deactivates
  // those subscriptions in the browser (Push API security/privacy contract).
  // Do not enter a platform push service without permission just to clean up
  // cancellation-only metadata: that lookup can stall unsupported WebKit ports.
  const sub=pushPermission()==="granted"?await reg?.pushManager?.getSubscription():null;
  if(sub&&!await sub.unsubscribe())throw new Error("push_unsubscribe_failed");
  if(reg?.getNotifications)for(const n of await reg.getNotifications())if(n.data?.pushTest||n.data?.pushReminder)n.close();
}
export async function clearOwnerPush(owner:string){return withPushLock(async()=>{
  if(typeof indexedDB==="undefined")return;
  let old=await pushControl();
  if(old.habitForeground===owner)old=await updatePushControl(old.revision,{habitForeground:null});
  if(old.owner!==owner)return;
  // Keep the disabled marker if unsubscribe fails, so cleanup is visible/retryable.
  const disabled=await updatePushControl(old.revision,{enabled:false,details:false,pending:true,lastTest:null});
  await unsubscribe();const latest=await pushControl();if(latest.revision===disabled.revision)await updatePushControl(latest.revision,{owner:null,installation:null,generation:0,pending:false,planBlocked:true,blockedEvents:[],cancelRequest:undefined,planGeneration:undefined,renewal:undefined});
});}
export async function enablePush(identity:Identity,owner:string,view:PushView,language:"en"|"ru"|"uz",signal?:AbortSignal){
  if(!current(identity,owner)||browserPushCapability()!=="supported"||!view.configured||!view.publicKey)throw new AccountError("unavailable");
  const applicationKey=view.publicKey;
  // Invoked directly by the button gesture, before the first await.
  const permission=Notification.permission==="default"?Notification.requestPermission():Promise.resolve(Notification.permission);
  if(await permission!=="granted")throw new Error("push_permission_needed");
  return withPushLock(async()=>{
  const before=await pushControl();if(!current(identity,owner)||signal?.aborted)throw new AccountError("account_changed");
  const reg=await registration();let subscription=await reg.pushManager.getSubscription();
  if(subscription){const key=subscription.options.applicationServerKey;if(!key||btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")!==view.publicKey){await subscription.unsubscribe();subscription=null;}}
  subscription??=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(applicationKey)});
  try{if(!current(identity,owner)||signal?.aborted)throw new AccountError("account_changed");
    const next=await mutate(identity,owner,"push",{version:view.installation?.version??0,subscription:{...subscription.toJSON(),expirationTime:subscription.expirationTime??null},details:false,language},signal);
    if(!current(identity,owner)||signal?.aborted||!next.installation?.enabled)throw new AccountError("account_changed");
    await updatePushControl(before.revision,{...(before.owner!==owner?{planBlocked:true,blockedEvents:[],cancelRequest:undefined,planGeneration:undefined,renewal:undefined}:{}),owner,installation:next.installation.id,generation:next.installation.version,enabled:true,details:false,language,pending:false,lastTest:null});return next;
  }catch(error){await subscription.unsubscribe().catch(()=>false);const latest=await pushControl();if(current(identity,owner)&&latest.revision===before.revision)await updatePushControl(latest.revision,{owner,enabled:false,pending:true,lastTest:null});throw error;}
});}
export async function disablePush(identity:Identity,owner:string,signal?:AbortSignal){return withPushLock(async()=>{
  if(!current(identity,owner)||signal?.aborted)throw new AccountError("account_changed");
  const before=await pushControl();if(before.owner!==null&&before.owner!==owner)throw new AccountError("account_changed");
  await updatePushControl(before.revision,{owner,enabled:false,details:false,pending:true,lastTest:null,renewal:undefined,planGeneration:undefined});
  await unsubscribe();const view=await readPush(signal);
  const next=await mutate(identity,owner,"push/disable",{version:view.installation?.version??0},signal);
  const latest=await pushControl();if(current(identity,owner)&&latest.owner===owner&&!latest.enabled)await updatePushControl(latest.revision,{pending:false,generation:next.installation?.version??0});return next;
});}
export async function privacyPush(identity:Identity,owner:string,view:PushView,details:boolean,language:"en"|"ru"|"uz",signal?:AbortSignal){return withPushLock(async()=>{
  const before=await pushControl(),reg=await registration(),subscription=await reg.pushManager.getSubscription();
  if(!subscription||before.owner!==owner||!before.enabled)throw new AccountError("account_changed");
  const next=await mutate(identity,owner,"push",{version:view.installation?.version??0,subscription:{...subscription.toJSON(),expirationTime:subscription.expirationTime??null},details,language},signal);
  if(!current(identity,owner)||signal?.aborted||!next.installation?.enabled)throw new AccountError("account_changed");
  await updatePushControl(before.revision,{details:next.installation.details,generation:next.installation.version,language,pending:false,lastTest:null});return next;
});}
export const testPush=(identity:Identity,owner:string,view:PushView,requestId:string,signal?:AbortSignal)=>mutate(identity,owner,"push/test",{version:view.installation?.version??0,requestId},signal);
/** Identity observation can only revoke. It never requests permission or subscribes. */
export async function reconcilePushSession(session:AccountSession,currentIdentity:Identity){
  if(typeof indexedDB==="undefined")return;
  await flushPushCancellation(currentIdentity);
  const control=await pushControl();if(currentIdentity()!==session||!control.owner)return;
  if(control.owner!==session.account?.id){await clearOwnerPush(control.owner);return;}
  if((control.pending||control.enabled&&pushPermission()!=="granted")&&current(currentIdentity,control.owner))await disablePush(currentIdentity,control.owner);
}

/** Persist a local stop before retrying remote cancellation. Never re-enable a plan. */
export async function blockPushPlan(identity:Identity,owner:string,keys:string[]|null,replaceReviewed=false){return withPushLock(async()=>{
 const old=await pushControl();if(!current(identity,owner)||old.owner!==null&&old.owner!==owner)return;
 const merged=keys===null||old.cancelRequest?.pending&&old.cancelRequest.keys===null?null:[...new Set([...(old.cancelRequest?.pending?old.cancelRequest.keys??[]:[]),...(keys??[])])];
 const blocked=[...new Set([...(old.blockedEvents??[]),...(keys??[])])];
 if(old.cancelRequest?.review&&!replaceReviewed){
  await updatePushControl(old.revision,{planBlocked:old.planBlocked||keys===null||blocked.length>84,blockedEvents:blocked.slice(-84)});return;
 }
 await updatePushControl(old.revision,{owner,planBlocked:old.planBlocked||keys===null||blocked.length>84,blockedEvents:blocked.slice(-84),cancelRequest:{protocol:2,id:crypto.randomUUID(),pending:true,keys:merged&&merged.length<=84?merged:null}});
});}
export async function flushPushCancellation(identity:Identity){
 const old=await pushControl(),owner=old.owner;let request=old.cancelRequest;if(!owner||!request?.pending||!current(identity,owner))return;
 if(request.review)throw new AccountError('cancellation_review_required');
 const session=identity();if(!session?.csrfToken)return;
 if(request.protocol===2&&request.throughGeneration===undefined){
  const head=parsePushPlanView(await accountApi('push/plan'));
  if(!current(identity,owner)||head.accountId!==owner)throw new AccountError('account_changed');
  // Persist once before sending. Retries never re-read/rebind to a later plan.
  request={...request,throughGeneration:head.plan?.generation??0};
  await updatePushControl(old.revision,{cancelRequest:request});
 }
 if(!current(identity,owner))throw new AccountError('account_changed');
 let result:unknown;
 try{result=await accountApi("push/cancel-plan",{body:{accountId:owner,requestId:request.id,keys:request.keys??null,...(request.throughGeneration!==undefined?{throughGeneration:request.throughGeneration}:{})},csrf:session.csrfToken});}
 catch(error){
  if(error instanceof AccountError&&error.code==='cancellation_review_required'){
   const latest=await pushControl();if(current(identity,owner)&&latest.owner===owner&&latest.cancelRequest?.id===request.id&&latest.cancelRequest.pending)await updatePushControl(latest.revision,{cancelRequest:{...latest.cancelRequest,review:true}});
  }
  throw error;
 }
 if(!result||typeof result!=="object"||!("canceled"in result)||result.canceled!==true||!("requestId"in result)||result.requestId!==request.id)throw new Error("push_cancel_failed");
 const latest=await pushControl();if(current(identity,owner)&&latest.owner===owner&&latest.cancelRequest?.id===request.id)await updatePushControl(latest.revision,{cancelRequest:{...request,pending:false}});
}

/** A new explicit stop choice resolves an unverifiable legacy request. */
export async function reviewPushCancellation(identity:Identity,owner:string,signal?:AbortSignal){
 if(signal?.aborted||!current(identity,owner))throw new AccountError('account_changed');
 const before=await pushControl();if(before.owner!==owner||!before.cancelRequest?.review)throw new AccountError('account_changed');
 // Stop automatic renewal before the user's all-current-reminders choice.
 await updatePushControl(before.revision,{renewal:undefined});
 if(signal?.aborted||!current(identity,owner))throw new AccountError('account_changed');
 await blockPushPlan(identity,owner,null,true);
 if(signal?.aborted||!current(identity,owner))throw new AccountError('account_changed');
 await flushPushCancellation(identity);
 if(signal?.aborted||!current(identity,owner))throw new AccountError('account_changed');
 return readPush(signal);
}
