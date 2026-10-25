import {PushPlanSettings} from "./PushRenewal";
import { useEffect,useRef,useState,useSyncExternalStore } from "react";
import { Button,SectionTitle,GroupRow,Toggle } from "../components";
import { useApp } from "../context";
import type { PushView } from "../contracts/push";
import { browserPushCapability,hasBrowserPush,disablePush,enablePush,privacyPush,pushPermission,readPush,testPush,reviewPushCancellation } from "./client";
import { pushControl,type PushControl } from "./store";
import { pushText,type PushText } from "./text";
import { AccountError } from "../auth/client";
const noSubscribe=()=>()=>{},noSnapshot=()=>null;
export function PushSettings({showReminderPlan=true}:{showReminderPlan?:boolean}={}){
 const {workspace}=useApp();
 useSyncExternalStore(workspace?.subscribe??noSubscribe,workspace?.getSyncSnapshot??noSnapshot);
 const identity=workspace?.getAccountIdentity();
 // An unavailable optional BFF does not replace the existing foreground flow.
 if(!identity)return null;
 return <PushInstallationSettings key={`${identity.account?.id??"guest"}:${identity.account?.authenticatedAt??""}`} showReminderPlan={showReminderPlan}/>;
}
export function BackgroundNotifications(){return <div className="life-screen background-notifications"><PushSettings showReminderPlan={false}/></div>;}
function PushInstallationSettings({showReminderPlan}:{showReminderPlan:boolean}){
 const {state,workspace,open}=useApp(),identity=()=>workspace?.getAccountIdentity()??null,owner=identity()?.account?.id,t=pushText(state.life.language);
 const [view,setView]=useState<PushView|null>(null),[control,setControl]=useState<PushControl|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState<PushText|null>(null),[error,setError]=useState<PushText|null>(null),[details,setDetails]=useState(false),[online,setOnline]=useState(navigator.onLine),[permission,setPermission]=useState(pushPermission()),[browserSubscribed,setBrowserSubscribed]=useState(false);
 const pending=useRef(false),mounted=useRef(true),abort=useRef<AbortController|null>(null),requestId=useRef<string|null>(null),refreshVersion=useRef(0),privacyEdited=useRef(false);
 const current=()=>mounted.current&&identity()?.account?.id===owner;
 const capability=browserPushCapability();
 async function refresh(){const version=++refreshVersion.current;setPermission(pushPermission());setOnline(navigator.onLine);
  if(!owner||pending.current)return;
  try{const local=await pushControl();if(!current()||version!==refreshVersion.current)return;setControl(local.owner===owner?local:null);const [next,browser]=await Promise.all([readPush(),hasBrowserPush()]);if(!current()||version!==refreshVersion.current)return;setView(next);setBrowserSubscribed(browser);if(!privacyEdited.current)setDetails(next.installation?.details??false);setError(null);
   if(next.test?.id===requestId.current&&next.test.status!=="queued")requestId.current=null;
  }catch{if(current()&&version===refreshVersion.current)setError("failed");}
 }
 useEffect(()=>{mounted.current=true;void refresh();const listener=()=>{if(!pending.current)void refresh();};window.addEventListener("focus",listener);window.addEventListener("online",listener);window.addEventListener("offline",listener);window.addEventListener("rise-push-changed",listener);navigator.serviceWorker?.addEventListener("message",listener);const timer=setInterval(listener,5000);return()=>{mounted.current=false;refreshVersion.current++;abort.current?.abort();clearInterval(timer);window.removeEventListener("focus",listener);window.removeEventListener("online",listener);window.removeEventListener("offline",listener);window.removeEventListener("rise-push-changed",listener);navigator.serviceWorker?.removeEventListener("message",listener);};},[owner]);
 async function run(action:(signal:AbortSignal)=>Promise<PushView>,success?:PushText){if(!owner||!current()||pending.current)return;pending.current=true;refreshVersion.current++;setBusy(true);setError(null);setNotice(null);const controller=new AbortController();abort.current=controller;
  try{const next=await action(controller.signal),local=await pushControl(),browser=await hasBrowserPush();if(current()){setView(next);setBrowserSubscribed(browser);setControl(local.owner===owner?local:null);privacyEdited.current=false;setDetails(next.installation?.details??false);setPermission(pushPermission());if(success)setNotice(success);}}
  catch(cause){if(current()&&!controller.signal.aborted){setPermission(pushPermission());setError(cause instanceof AccountError&&cause.code==="rate_limited"?"rate":"failed");const local=await pushControl().catch(()=>null);if(current())setControl(local?.owner===owner?local:null);}}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const enabled=browserSubscribed&&!!view?.installation?.enabled&&!!control?.enabled&&control.installation===view?.installation?.id&&control.generation===view?.installation?.version&&permission==="granted",waiting=control?.pending;
 const status:PushText=waiting?"pending":capability!=="supported"?capability:permission==="denied"?"denied":view&&!view.configured?"unavailable":view?.installation?.needsReview||view?.installation?.enabled&&!enabled?"review":enabled?"subscribed":"missing";
 const testStatus=view?.test,displayed=!!testStatus&&control?.lastTest?.id===testStatus.id;
 return <section aria-label={t("title")} className="life-section">
  <SectionTitle title={t("title")} /><p className="fine-print">{t("intro")}</p>
  {!owner?<><p>{t("account")}</p><Button variant="secondary" className="wide" onClick={()=>open({type:"account"})}>{t("signIn")}</Button></>:<>
   <p role="status">{busy?t("busy"):t(status)}</p>{!online&&<p className="fine-print">{t("offline")}</p>}
   {error&&<p role="alert" className="live-error">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
   {!enabled&&!waiting&&<Button className="wide" disabled={busy||!online||!view?.configured||capability!=="supported"||permission==="denied"} onClick={()=>view&&void run(s=>enablePush(identity,owner,view,state.life.language,s))}>{t("enable")}</Button>}
   {(enabled||waiting||view?.installation?.enabled||control?.enabled)&&<Button variant="secondary" className="wide" disabled={busy} onClick={()=>void run(s=>disablePush(identity,owner,s))}>{t("disable")}</Button>}
   {enabled&&<><GroupRow title={t("details")} end={<Toggle label={t("details")} checked={details} disabled={busy} onChange={()=>{privacyEdited.current=true;setDetails(!details);}} />} /><p className="fine-print">{t("privacy")}</p><Button variant="secondary" className="wide" disabled={busy||!online||details===view?.installation?.details&&state.life.language===view?.installation?.language} onClick={()=>view&&void run(s=>privacyPush(identity,owner,view,details,state.life.language,s),"saved")}>{t("save")}</Button>
   <Button variant="secondary" className="wide" disabled={busy||!online||testStatus?.status==="queued"} onClick={()=>{if(!view)return;requestId.current??=crypto.randomUUID();void run(s=>testPush(identity,owner,view,requestId.current!,s));}}>{t("test")}</Button></>}
   {testStatus&&<p role="status">{t(displayed?"displayed":testStatus.status==="queued"?"queued":testStatus.status==="accepted"?"accepted":"testFailed")}</p>}
   <Button variant="ghost" className="wide" disabled={busy} onClick={()=>void refresh()}>{t("refresh")}</Button>
   {showReminderPlan&&<><PushPlanSettings enabled={enabled&&capability==="supported"}/><p className="fine-print" role="status">{t(control?.cancelRequest?.review?"cancelReview":control?.cancelRequest?.pending?"cancelPending":control?.planBlocked?"planBlocked":"schedule")}</p>
   {control?.cancelRequest?.review&&<Button variant="secondary" className="wide" disabled={busy||!online} onClick={()=>void run(s=>reviewPushCancellation(identity,owner,s))}>{t("cancelCurrent")}</Button>}</>}
  </>}
 </section>;
}
