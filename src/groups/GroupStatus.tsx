import {useEffect,useRef,useState} from 'react';
import {useApp} from '../context';
import {Button} from '../components';
import {useGroups} from './GroupProvider';
import {groupText,groupError} from './text';
import {sharedText} from './sharedText';
import {squadText,squadError} from './squadText';
import {GroupReauthentication} from './GroupReauthentication';
const useCopy=()=>groupText(useApp().state.life.language);

export function Confirm({title,help,busy,onConfirm,onCancel}:{title:string;help:string;busy:boolean;onConfirm:()=>void;onCancel:()=>void}){
 const t=useCopy(),heading=useRef<HTMLHeadingElement>(null),[checked,setChecked]=useState(false);
 useEffect(()=>{const from=document.activeElement;heading.current?.focus({preventScroll:true});return()=>{if(from instanceof HTMLElement&&from.isConnected)from.focus({preventScroll:true});};},[]);
 return <section className="group-confirm"><h2 ref={heading} tabIndex={-1}>{title}</h2><p className="fine-print">{help}</p><label className="checkbox-label"><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/><span>{t('confirm')}</span></label><Button type="button" variant="danger" disabled={!checked||busy} onClick={onConfirm}>{title}</Button><Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>{t('cancel')}</Button></section>;
}
function useGroupRetry(){
 const {view,session,clearInvitation}=useGroups(),t=useCopy(),{close,open,toast}=useApp();
 return async()=>{const intent=view.pending,receipt=await session?.retry();if(!receipt)return;
  // Recovery can finish after its original form has gone away. Replace that
  // stack so a completed confirmation cannot be submitted again on Back.
  close();
  if(intent?.type==='join'){clearInvitation();open({type:'group',id:receipt.groupId});}
  else if(intent?.type==='command'){const command=intent.operation.command,kind=command.kind;
   if('taskId'in command)open({type:'task',id:command.taskId,groupId:receipt.groupId,...('date'in command?{date:command.date}:{})});
   else if('listId'in command)open({type:'sharedList',id:command.listId,groupId:receipt.groupId});
   else open(kind==='group.leave'||kind==='group.delete'?{type:'groups'}:{type:kind==='group.invite'?'invite':'group',id:receipt.groupId});}
  toast(t('saved'));
 };
}
export function Pending(){
 const {view,session}=useGroups(),t=useCopy(),retry=useGroupRetry(),[stopping,setStopping]=useState(false),pending=!!view.pending||view.invalidPending;
 const language=useApp().state.life.language,shared=sharedText(language),squad=squadError(view.error??''),error=squad?squadText(language)(squad):view.error==='shared_limit'?shared('limit'):view.error==='shared_archived'?shared('archived'):view.error==='shared_unavailable'?shared('unavailable'):view.error==='occurrence_unavailable'?shared('notScheduled'):t(groupError(view.error??''));
 return <>{pending&&<section className="group-pending" aria-label={t('pending')}><p role="status" className="fine-print">{t(view.invalidPending?'invalidPending':'pending')}</p>
  {!view.invalidPending&&<Button type="button" variant="secondary" disabled={view.busy} onClick={()=>void retry()}>{t(view.busy?'working':'retry')}</Button>}
  <Button type="button" variant="ghost" disabled={view.busy} onClick={()=>setStopping(true)}>{t('stop')}</Button>
  {stopping&&<Confirm title={t('stop')} help={t('stopHelp')} busy={view.busy} onCancel={()=>setStopping(false)} onConfirm={()=>void session?.discard().then(ok=>{if(ok)setStopping(false);})}/>}
 </section>}{view.error&&view.error!=='recent_auth_required'&&<p className="field-error" role="alert">{error}</p>}{view.error==='recent_auth_required'&&<GroupReauthentication help={t('verifyHelp')} blocked={view.busy} onVerified={retry}/>}</>;
}
