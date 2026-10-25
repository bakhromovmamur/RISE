import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useApp } from "../context";
import { Button } from "../components";
import { downloadRecovery } from "../data/StorageNotice";
import { importableHabits, type ImportProposal, type ImportSelection } from "./importModel";
import { syncStatusText, syncText } from "./text";
import { SyncRecovery } from "./Recovery";
import { SyncError } from "./client";
import type { WorkspaceSession } from "./workspace";

function Connected({workspace}:{workspace:WorkspaceSession}){
  const {state}=useApp(),t=syncText(state.life.language),status=useSyncExternalStore(workspace.subscribe,workspace.getSyncSnapshot);
  const client=useMemo(()=>workspace.client(),[workspace]);
  const [choosing,setChoosing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[consent,setConsent]=useState(false),[discard,setDiscard]=useState(false);
  const [selection,setSelection]=useState<ImportSelection>({habitIds:[],goals:false,prayers:false,reflections:false,settings:false});
  const [proposal,setProposal]=useState<ImportProposal|null>(null),[preview,setPreview]=useState<Awaited<ReturnType<ReturnType<WorkspaceSession["client"]>["stage"]>>|null>(null);
  const [sourceVersion,setSourceVersion]=useState<number|null>(null),[head,setHead]=useState<number|null>(null),[staged,setStaged]=useState(false);
  const worker=useRef<Worker|null>(null),abort=useRef<AbortController|null>(null),mounted=useRef(true),attempt=useRef(crypto.randomUUID()),generation=useRef(0);
  const guest=workspace.guest.getSnapshot().state,habits=importableHabits(guest);
  useEffect(()=>{mounted.current=true;void client.head().then(result=>{if(mounted.current)setHead(result.revision);}).catch(()=>{if(mounted.current)setError(true);});return()=>{mounted.current=false;generation.current++;abort.current?.abort();worker.current?.terminate();};},[client]);
  const run=async(action:(signal:AbortSignal)=>Promise<unknown>)=>{if(busy)return;const version=++generation.current,controller=new AbortController();abort.current?.abort();abort.current=controller;setBusy(true);setError(false);try{await action(controller.signal);}catch{if(mounted.current&&!controller.signal.aborted&&version===generation.current)setError(true);}finally{if(mounted.current&&version===generation.current)setBusy(false);}};
  const reset=(close:boolean)=>{setProposal(null);setPreview(null);setConsent(false);setStaged(false);if(close)setChoosing(false);attempt.current=crypto.randomUUID();};
  const cancel=()=>{if(staged){void run(async()=>{await client.cancel(attempt.current);reset(true);});return;}generation.current++;abort.current?.abort();worker.current?.terminate();worker.current=null;setBusy(false);reset(true);};
  const review=()=>{if(staged)void run(async()=>{await client.cancel(attempt.current);reset(false);});else reset(false);};
  const prepare=()=>run(async(signal)=>{
    const snapshot=await workspace.guest.snapshot();setSourceVersion(snapshot.revision);setConsent(false);setPreview(null);
    const result=await new Promise<ImportProposal>((resolve,reject)=>{const job=new Worker(new URL("./import.worker.ts",import.meta.url),{type:"module"});worker.current=job;signal.addEventListener("abort",()=>{job.terminate();reject(new Error("cancelled"));},{once:true});job.onmessage=(event:MessageEvent<{ok:boolean;result?:ImportProposal}>)=>{job.terminate();worker.current=null;if(event.data.ok&&event.data.result)resolve(event.data.result);else reject(new Error("import_preview"));};job.onerror=()=>{job.terminate();reject(new Error("import_preview"));};job.postMessage({state:snapshot.state,owner:client.owner,selection});});
    if(mounted.current&&!signal.aborted){setProposal(result);attempt.current=crypto.randomUUID();}
  });
  const stage=()=>run(async(signal)=>{if(!proposal||!consent)return;const snapshot=await workspace.guest.snapshot();if(snapshot.revision!==sourceVersion)throw new SyncError("source_changed");const current=await client.head(signal);setStaged(true);const result=await client.stage(proposal,workspace.guest.summary.provenance,current.revision,attempt.current,signal);if(mounted.current&&!signal.aborted){setPreview(result);setHead(current.revision);}});
  const commit=()=>run(async(signal)=>{if(!preview)return;const snapshot=await workspace.guest.snapshot();if(snapshot.revision!==sourceVersion)throw new SyncError("source_changed");await client.commit(preview,signal);if(mounted.current&&!signal.aborted&&workspace.getAccountIdentity()?.account?.id===client.owner)await workspace.useAccount(selection.prayers?snapshot.state:undefined);});
  return <section aria-label={t("title")}>
    <h3>{t("title")}</h3>
    <p className="fine-print" role="status">{t(status.scope==="guest"?"guest":"account")}</p>
    {status.scope!=="guest"&&<>
      <p className="fine-print" role="status">{syncStatusText(state.life.language,workspace.getSnapshot().status==="saving"?{...status,phase:status.persistent?"saving-device":"saved-device"}:status)}</p><p className="fine-print">{t("drafts")}</p>
      {status.phase==="attention"&&<><p className="field-error" role="alert">{t("conflict")}</p>{workspace.recoveryJourney()&&<SyncRecovery journey={workspace.recoveryJourney()!} language={state.life.language}/>}</>}
      {!status.persistent&&<p className="fine-print">{t("session")}</p>}
      <Button className="wide" variant="secondary" disabled={busy} onClick={()=>void run(workspace.syncNow)}>{t("sync")}</Button>
      <Button className="wide" variant="ghost" disabled={busy} onClick={()=>void run(()=>workspace.useDevice())}>{t("device")}</Button>
    </>}
    {(status.pending>0||workspace.recoveryJourney()?.cacheSnapshot().recovery)&&<><p className="fine-print">{t("pending")}</p><p className="fine-print">{t("exportHelp")}</p>
      <Button className="wide" variant="secondary" onClick={()=>{const raw=workspace.pendingAccountExport();if(raw)downloadRecovery(raw,"rise-account-pending.json");}}>{t("export")}</Button>
      {status.pending>0&&<label className="checkbox-label"><input type="checkbox" checked={discard} onChange={event=>{setDiscard(event.target.checked);workspace.authorizeDiscard(event.target.checked);}}/><span>{t("discard")}</span></label>}
    </>}
    {status.scope==="guest"&&!choosing&&<>
      <p className="fine-print">{t("keep")}</p>
      {head!==null&&head>0&&<Button className="wide" disabled={busy} onClick={()=>void run(()=>workspace.useAccount())}>{t("use")}</Button>}
      {head===0&&<><p className="fine-print">{t("emptyHelp")} {guest.timezone}</p><Button className="wide" variant="secondary" disabled={busy} onClick={()=>void run(()=>workspace.startEmpty())}>{t("empty")}</Button></>}
      <Button className="wide" variant="secondary" disabled={busy} onClick={()=>{setChoosing(true);setError(false);}}>{t("choose")}</Button>
    </>}
    {choosing&&<>
      <h3>{t("choose")}</h3><p className="fine-print">{t("privacy")}</p><p className="fine-print"><strong>{t("profile")}</strong><br/>{guest.name} · {guest.timezone}</p>
      {workspace.guest.summary.provenance!=="new"&&<p className="fine-print">{t("provenance")}</p>}
      {!proposal?<>
        <fieldset disabled={busy}><legend>{t("habits")}</legend>{habits.map(h=><label className="checkbox-label" key={h.id}><input type="checkbox" checked={selection.habitIds.includes(h.id)} onChange={event=>setSelection(s=>({...s,habitIds:event.target.checked?[...s.habitIds,h.id]:s.habitIds.filter(id=>id!==h.id)}))}/><span>{h.name}</span></label>)}</fieldset>
        {(["goals","prayers","reflections","settings"] as const).map(key=><label className="checkbox-label" key={key}><input type="checkbox" disabled={busy} checked={selection[key]} onChange={event=>setSelection(s=>({...s,[key]:event.target.checked}))}/><span>{t(key)}</span></label>)}
        <Button className="wide" disabled={busy} onClick={()=>void prepare()}>{t(busy?"busy":"prepare")}</Button>
      </>:<>
        <p className="fine-print"><strong>{t("dates")}</strong><br/>{proposal.summary.from&&proposal.summary.through?`${proposal.summary.from} – ${proposal.summary.through}`:t("noDates")}</p>
        <p className="fine-print">{t("habits")}: {proposal.summary.habits}<br/>{t("checks")}: {proposal.summary.habitChecks} · {t("xp")}: {proposal.summary.xp}<br/>{t("prayerChecks")}: {proposal.summary.prayerChecks}<br/>{t("goalCount")}: {proposal.summary.goals}<br/>{t("reflections")}: {proposal.summary.reflections}</p>
        <p className="fine-print">{t("excluded")}: {proposal.summary.excludedSamples+proposal.summary.excludedReferences}</p>
        {!preview?<><label className="checkbox-label"><input type="checkbox" disabled={busy} checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>{t("consent")}</span></label><Button className="wide" disabled={busy||!consent} onClick={()=>void stage()}>{t(busy?"busy":"upload")}</Button></>:<>
          <p className="fine-print">{t("added")}: {preview.added} · {t("kept")}: {preview.kept} · {t("xp")}: +{preview.xpAdded}</p><p className="fine-print">{t("keep")}</p>
          <Button className="wide" disabled={busy} onClick={()=>void commit()}>{t(busy?"busy":"confirm")}</Button>
        </>}
        <Button className="wide" variant="secondary" disabled={busy} onClick={review}>{t("review")}</Button>
      </>}
      <Button className="wide" variant="ghost" disabled={busy&&proposal!==null} onClick={cancel}>{t("cancel")}</Button>
    </>}
    {error&&<><p className="field-error" role="alert">{t("failed")}</p><Button className="wide" variant="secondary" disabled={busy} onClick={()=>void run(async(signal)=>setHead((await client.head(signal)).revision))}>{t("sync")}</Button></>}
  </section>;
}
export function AccountSync({owner}:{owner:string}){const {workspace}=useApp();return workspace?.getAccountIdentity()?.account?.id===owner?<Connected key={owner} workspace={workspace}/>:null;}
export function AccountDataBoundary(){const{workspace,state}=useApp(),t=syncText(state.life.language);const[error,setError]=useState(false);return<div className="settings-content"><p className="fine-print">{t("boundary")}</p><Button className="wide" variant="secondary" onClick={()=>{void workspace?.useDevice().catch(()=>setError(true));}}>{t("device")}</Button>{error&&<p className="field-error" role="alert">{t("pending")}</p>}</div>;}
