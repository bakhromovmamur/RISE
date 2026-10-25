import {useEffect,useRef,useState} from 'react';
import {useApp} from '../context';
import {Button} from '../components';
import type {AccountGroup} from '../contracts/groups';
import {AccountError} from '../auth/client';
import {downloadBackup} from '../data/backupWorker';
import {useGroups} from './GroupProvider';
import {GroupReauthentication} from './GroupReauthentication';
import {archiveText,type ArchiveTextKey} from './archiveText';

export function GroupExport({group,blocked}:{group:AccountGroup;blocked:boolean}){
 const {workspace,state}=useApp(),{session,client}=useGroups(),t=archiveText(state.life.language),owner=session?.owner;
 const [review,setReview]=useState<number|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[needsAuth,setNeedsAuth]=useState(false);
 const [error,setError]=useState<ArchiveTextKey|null>(null),[notice,setNotice]=useState<ArchiveTextKey|null>(null);
 const controller=useRef<AbortController|null>(null),pending=useRef(false),heading=useRef<HTMLHeadingElement>(null),section=useRef<HTMLElement>(null),opened=useRef(false);
 const stale=review!==null&&review!==group.revision;
 useEffect(()=>{if(review!==null)heading.current?.focus({preventScroll:true});else if(opened.current)section.current?.querySelector<HTMLButtonElement>('[data-group-export]')?.focus({preventScroll:true});},[review]);
 useEffect(()=>{pending.current=false;setBusy(false);setNotice(null);return()=>controller.current?.abort();},[owner,group.id,group.revision]);
 const current=(revision:number)=>!!workspace&&!!owner&&workspace.scope===owner&&workspace.getAccountIdentity()?.account?.id===owner&&session?.getSnapshot().groups.some(g=>g.id===group.id&&g.revision===revision);
 const cancel=()=>{controller.current?.abort();pending.current=false;setBusy(false);setReview(null);setConfirmed(false);setNeedsAuth(false);setError(null);setNotice('cancelled');};
 const download=async()=>{
  if(!client||review===null||!confirmed||blocked||pending.current||stale||!current(review))return;
  const revision=review,abort=new AbortController();controller.current=abort;pending.current=true;setBusy(true);setError(null);setNotice(null);
  try{
   const raw=await client.archive(group,abort.signal);if(abort.signal.aborted||!current(revision))return;
   downloadBackup(raw,'rise-group-archive.json');setReview(null);setNotice('started');setConfirmed(false);
  }catch(failure){
   if(abort.signal.aborted||!current(revision))return;
   const code=failure instanceof AccountError?failure.code:'unavailable';
   if(code==='recent_auth_required'){setNeedsAuth(true);setConfirmed(false);}
   else{setError(code==='export_too_large'?'large':code==='group_changed'?'changed':'failed');if(['group_changed','group_unavailable','account_changed','sign_in_required'].includes(code))await session?.refresh();}
  }finally{if(controller.current===abort){pending.current=false;if(!abort.signal.aborted)setBusy(false);}}
 };
 return <section ref={section} className={`group-export${review===null?'':' group-export-review'}`} aria-label={t('title')} aria-busy={busy}>
  {review===null?<Button data-group-export variant="secondary" className="wide" disabled={blocked} onClick={()=>{opened.current=true;setReview(group.revision);setConfirmed(false);setError(null);setNotice(null);}}>{t('title')}</Button>:<>
   <h3 ref={heading} tabIndex={-1}>{t('review')}</h3><p className="fine-print">{group.name} · {group.timezone}</p><p className="fine-print">{t(group.kind)}</p><p className="fine-print">{t('warning')}</p><p className="fine-print">{t('separate')}</p>
   {stale?<><p role="status" className="fine-print">{t('changed')}</p><Button variant="secondary" disabled={blocked} onClick={()=>{setReview(group.revision);setConfirmed(false);setError(null);}}>{t('latest')}</Button></>:<>
    <label className="checkbox-label"><input type="checkbox" checked={confirmed} disabled={busy||blocked||needsAuth} onChange={e=>setConfirmed(e.target.checked)}/><span>{t('confirm')}</span></label>
    <Button className="wide" disabled={busy||blocked||!confirmed||needsAuth} onClick={()=>void download()}>{t('download')}</Button>
   </>}
   {busy&&<p role="status" className="fine-print">{t('working')}</p>}
   {needsAuth&&<GroupReauthentication key={`${owner}:${group.id}`} help={t('recent')} blocked={blocked} onVerified={()=>{setNeedsAuth(false);setConfirmed(false);setNotice('verified');heading.current?.focus({preventScroll:true});}}/>}
   <Button variant="ghost" className="wide" onClick={cancel}>{t('cancel')}</Button>
  </>}
  {error&&<p role="alert" className="field-error">{t(error)}</p>}{notice&&<p role="status" className="fine-print">{t(notice)}</p>}
 </section>;
}
