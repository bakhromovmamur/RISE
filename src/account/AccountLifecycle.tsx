import { useEffect, useRef, useState } from "react";
import { useApp } from "../context";
import { Button } from "../components";
import type { AccountSession,CodeChallenge } from "../contracts/auth";
import { parseDeletionStatus } from "../contracts/accountLifecycle";
import { AccountError,accountApi,reauthenticate,verifyReauthentication } from "../auth/client";
import { downloadRecovery } from "../data/StorageNotice";
import { parseAccountExport } from "./export";
import { lifecycleText,type LifecycleTextKey } from "./text";
import {groupText} from '../groups/text';

export function AccountLifecycle({session,onChanged,onBusy,blocked=false}:{session:AccountSession;onChanged:()=>Promise<void>;onBusy:(busy:boolean)=>void;blocked?:boolean}){
  const {state,workspace,open}=useApp(),t=lifecycleText(state.life.language),owner=session.account?.id;
  const [mode,setMode]=useState<"clear"|"delete"|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState<LifecycleTextKey|null>(null),[notice,setNotice]=useState<LifecycleTextKey|null>(null),[needsAuth,setNeedsAuth]=useState(false);
  const [challenge,setChallenge]=useState<CodeChallenge|null>(null),[code,setCode]=useState(""),[seconds,setSeconds]=useState(0);
  const controller=useRef<AbortController|null>(null),mounted=useRef(true),pending=useRef(false),deadline=useRef(0),input=useRef<HTMLInputElement>(null);
  const review=useRef<{revision:number;version:string;requestId:string}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null),section=useRef<HTMLElement>(null),launch=useRef<"clear"|"delete"|null>(null);
  useEffect(()=>{if(mode)heading.current?.focus({preventScroll:true});else if(launch.current)section.current?.querySelector<HTMLButtonElement>(`[data-account-action="${launch.current}"]`)?.focus({preventScroll:true});},[mode]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{if(challenge)input.current?.focus({preventScroll:true});},[challenge]);
  useEffect(()=>{const timer=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadline.current-performance.now())/1000))),1000);return()=>clearInterval(timer);},[]);
  const current=()=>!!owner&&workspace?.getAccountIdentity()?.account?.id===owner;
  async function run(action:(signal:AbortSignal)=>Promise<void>){
    if(!current()||pending.current||blocked)return;pending.current=true;setBusy(true);onBusy(true);setError(null);setNotice(null);
    const abort=new AbortController();controller.current=abort;
    try{await action(abort.signal);}catch(failure){if(!mounted.current||abort.signal.aborted)return;
      const fault=failure instanceof AccountError?failure:null;
      if(fault?.retryAfter){deadline.current=performance.now()+fault.retryAfter*1000;setSeconds(fault.retryAfter);}
      if(fault?.code==="recent_auth_required")setNeedsAuth(true);
      else{setError(fault?.code==="invalid_code"?"invalid":fault?.code==="rate_limited"?"rate":fault?.code==="account_changed"?"changed":fault?.code==="ownership_resolution_required"?"ownership":fault?.code==="initialize_required"?"empty":"failed");if(fault?.code==="invalid_code")input.current?.focus({preventScroll:true});}
    }finally{pending.current=false;onBusy(false);if(mounted.current)setBusy(false);}
  }
  async function sendCode(signal:AbortSignal){
    if(!owner)return;const next=await reauthenticate(owner,session.csrfToken,signal);
    if(current()&&!signal.aborted){setChallenge(next);setCode("");deadline.current=performance.now()+next.retryAfter*1000;setSeconds(next.retryAfter);}
  }
  async function begin(next:"clear"|"delete",signal:AbortSignal){
    if(!workspace||!owner)return;const version=await workspace.cleanupVersion(owner);
    const head=next==="delete"?await workspace.client().head(signal):{revision:0};
    if(!current()||signal.aborted)return;review.current={version,revision:head.revision,requestId:crypto.randomUUID()};setMode(next);setConfirmed(false);
  }
  async function finish(signal:AbortSignal){
    const intent=review.current;if(!intent||!confirmed||!workspace||!owner)return;
    if(await workspace.cleanupVersion(owner)!==intent.version){setConfirmed(false);setMode(null);review.current=null;throw new AccountError("account_changed");}
    if(mode==="clear"){await workspace.clearAccountDevice(owner,intent.version);if(mounted.current){setMode(null);setConfirmed(false);setNotice("ready");}return;}
    const result=parseDeletionStatus(await accountApi("account/deletion",{body:{accountId:owner,requestId:intent.requestId,revision:intent.revision,confirm:"delete-account"},csrf:session.csrfToken,signal}));
    if(result.accountId!==owner||result.requestId!==intent.requestId)throw new AccountError("unavailable");
    await workspace.deletedAccount(owner).catch(()=>{});await onChanged();
  }
  if(!owner||!workspace||!current())return null;
  const locked=busy||blocked;
  return <section ref={section} className="backup-screen" aria-label={t("title")} aria-busy={busy}>
    <h3>{t("title")}</h3><p className="fine-print">{t("body")}</p>
    {!mode&&<><Button className="wide" variant="secondary" disabled={locked} onClick={()=>void run(async signal=>{
      const data=await accountApi("account/export",{body:{accountId:owner},csrf:session.csrfToken,signal});
      const raw=JSON.stringify(data),parsed=await parseAccountExport(raw);if(!current()||signal.aborted||parsed.accountId!==owner)throw new AccountError("account_changed");
      downloadRecovery(raw,"rise-account-export.json");
    })}>{t("export")}</Button>
    <Button className="wide" variant="secondary" disabled={locked} data-account-action="clear" onClick={()=>{launch.current="clear";void run(signal=>begin("clear",signal));}}>{t("clear")}</Button>
    <Button className="wide" variant="ghost" disabled={locked} data-account-action="delete" onClick={()=>{launch.current="delete";void run(signal=>begin("delete",signal));}}>{t("remove")}</Button></>}
    {mode&&<>
      <h3 ref={heading} tabIndex={-1}>{t(mode==="clear"?"clear":"review")}</h3><p className="fine-print">{t(mode==="clear"?"deviceHelp":"deleteHelp")}</p>
      {mode==="delete"&&session.delivery==="local-inbox"&&<p className="fine-print">{t("localPurge")}</p>}
      {workspace.hasAccountRecovery()&&<Button className="wide" variant="secondary" disabled={locked} onClick={()=>{const raw=workspace.pendingAccountExport();if(raw)downloadRecovery(raw,"rise-account-pending.json");else setError("failed");}}>{t("pending")}</Button>}
      <label className="checkbox-label"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>{t(mode==="clear"?"confirmClear":"confirmDelete")}</span></label>
      <Button className="wide" variant={mode==="delete"?"danger":"secondary"} disabled={locked||!confirmed} onClick={()=>void run(finish)}>{t(busy?"working":mode==="clear"?"clear":"confirm")}</Button>
      <Button className="wide" variant="ghost" disabled={busy} onClick={()=>{setMode(null);setConfirmed(false);review.current=null;setError(null);}}>{t("cancel")}</Button>
    </>}
    {needsAuth&&<form onSubmit={event=>{event.preventDefault();void run(async signal=>{
      if(!challenge){await sendCode(signal);return;}
      await verifyReauthentication(owner,challenge.challenge,code,session.csrfToken,signal);setCode("");setChallenge(null);await onChanged();
    });}}>
      <p className="fine-print" role="status">{t("recent")}</p>
      {challenge&&<><p className="fine-print">{t("sent")}</p><label className="field">{t("code")}<input ref={input} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} disabled={locked} aria-invalid={error==="invalid"} aria-describedby={error?"account-lifecycle-error":undefined} required onChange={e=>setCode(e.target.value.replace(/\s/g,""))}/></label></>}
      <Button className="wide" type="submit" disabled={busy||!challenge&&seconds>0}>{t(busy?"working":challenge?"verify":"send")}{!challenge&&seconds>0?` (${seconds})`:""}</Button>
      {challenge&&<Button type="button" className="wide" variant="secondary" disabled={locked||seconds>0} onClick={()=>void run(sendCode)}>{t("send")}{seconds>0?` (${seconds})`:""}</Button>}
    </form>}
    {notice&&<p className="fine-print" role="status">{t(notice)}</p>}
    {error&&<p className="field-error" role="alert" id="account-lifecycle-error">{t(error)}</p>}
    {error==='ownership'&&<Button variant="secondary" onClick={()=>open({type:'groups'})}>{groupText(state.life.language)('people')}</Button>}
  </section>;
}
export function AccountDeletionNotice({session,onChanged}:{session:AccountSession;onChanged:()=>Promise<void>}){
  const {workspace,state}=useApp(),t=lifecycleText(state.life.language),[failed,setFailed]=useState(!!workspace?.accountCleanupError()),[busy,setBusy]=useState(false);
  const deletion=session.deletion;if(session.reason!=="deleted"||!deletion)return null;
  return <section className="backup-screen" aria-label={t("title")}>
    <p className="fine-print" role="status">{t(deletion.purgedAt?"purged":"deleted")}</p><p className="fine-print">{t("backups")}</p>
    {(failed||workspace?.accountCleanupError())&&<><p className="field-error" role="alert">{t("cleanupFailed")}</p><Button className="wide" variant="secondary" disabled={busy} onClick={()=>{setBusy(true);void workspace?.deletedAccount(deletion.accountId).then(()=>setFailed(false)).catch(()=>setFailed(true)).finally(()=>setBusy(false));}}>{t("retry")}</Button></>}
    <Button className="wide" variant="secondary" disabled={busy} onClick={()=>void onChanged()}>{t("status")}</Button>
  </section>;
}
