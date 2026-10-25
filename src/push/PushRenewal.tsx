import {nativeDelivery} from "../prayerDelivery";
import {createContext,useContext,useEffect,useMemo,useState,useSyncExternalStore,type ReactNode} from 'react';
import type {WorkspaceSession} from '../sync/workspace';
import {useApp} from '../context';
import {Button,GroupRow,Toggle} from '../components';
import {accountApi,AccountError} from '../auth/client';
import {PlanRenewal} from './renewal';
import {pushControl,updatePushControl} from './store';
import {flushPushCancellation,pushPermission} from './client';
import {pushText} from './text';
import {formatDisplayDate} from '../i18n';
const RenewalContext=createContext<PlanRenewal|null>(null);
export function PushRenewalProvider({workspace,children}:{workspace?:WorkspaceSession;children:ReactNode}){
 const renewal=useMemo(()=>workspace&&!nativeDelivery?new PlanRenewal({
  source:workspace.pushPlanSource,now:Date.now,online:()=>navigator.onLine,permission:()=>pushPermission()==='granted',control:pushControl,write:updatePushControl,
  read:()=>accountApi('push/plan'),
  post:input=>{const identity=workspace.getAccountIdentity();if(identity?.account?.id!==input.accountId)throw new AccountError('account_changed');return accountApi('push/plan',{body:input,csrf:identity.csrfToken});},
  cancel:()=>flushPushCancellation(workspace.getAccountIdentity)
 }):null,[workspace]);
 useEffect(()=>{
  if(!renewal||!workspace)return;
  let debounce:ReturnType<typeof setTimeout>;
  const update=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(!document.hidden)void renewal.refresh();},250);};
  const unsub=workspace.subscribe(update);update();
  window.addEventListener('focus',update);window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener('rise-push-changed',update);document.addEventListener('visibilitychange',update);
  const timer=setInterval(update,60000);
  return()=>{clearTimeout(debounce);clearInterval(timer);unsub();renewal.close();window.removeEventListener('focus',update);window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('rise-push-changed',update);document.removeEventListener('visibilitychange',update);};
 },[renewal,workspace]);
 return <RenewalContext.Provider value={renewal}>{children}</RenewalContext.Provider>;
}
export function PushPlanSettings({enabled}:{enabled:boolean}){
 const {workspace}=useApp(),renewal=useContext(RenewalContext);
 if(!renewal||!workspace?.pushPlanSource())return null;
 return <PlanSettings renewal={renewal} enabled={enabled}/>;
}
function PlanSettings({renewal,enabled}:{renewal:PlanRenewal;enabled:boolean}){
 const {state,workspace}=useApp(),value=useSyncExternalStore(renewal.subscribe,renewal.getSnapshot),t=pushText(state.life.language);
 const [allow,setAllow]=useState(false),[edited,setEdited]=useState(false);
 useEffect(()=>{if(!edited)setAllow(value.allowDuringQuiet);},[value.allowDuringQuiet,edited]);
 const when=(value:string|null|undefined)=>value?formatDisplayDate(new Date(value),state.life.language,{timeZone:state.timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 const canSave=enabled&&navigator.onLine&&!!workspace?.pushPlanSource()?.ready&&!value.busy;
 return <div className="group life-section" aria-label={t('planTitle')}>
  <h3>{t('planTitle')}</h3><p className="fine-print">{t('planIntro')}</p>
  <p role="status">{t(value.status)}</p>
  {value.view?.plan&&<dl className="life-facts"><div><dt>{t('planThrough')}</dt><dd>{when(value.view.receiver?.queuedThrough)}</dd></div><div><dt>{t('planWake')}</dt><dd>{value.wakeQuiet?t('planQuiet'):when(value.wake)}</dd></div><div><dt>{t('planBackup')}</dt><dd>{when(value.backup)}</dd></div></dl>}
  <GroupRow title={t('quietOverride')} end={<Toggle label={t('quietOverride')} checked={allow} disabled={value.busy} onChange={()=>{setEdited(true);setAllow(!allow);}}/>}/>
  <p className="fine-print">{t('planConsent')}</p>
  <Button variant="secondary" className="wide" disabled={!canSave} onClick={()=>{void renewal.refresh({allowDuringQuiet:allow}).then(()=>setEdited(false));}}>{t(value.view?.plan?'planReplace':'planChoose')}</Button>
  <Button variant="ghost" className="wide" disabled={value.busy||!navigator.onLine} onClick={()=>void renewal.refresh(undefined,true)}>{t('planRefresh')}</Button>
  <p className="fine-print">{t('planLimit')}</p>
 </div>;
}
