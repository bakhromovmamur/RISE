import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useApp} from './context';
import {Button} from './components';
import {buildHabitSchedule,type HabitAlert} from './habitSchedule';
import type {State} from './model';
import {dateInZone} from './domain/zonedTime';
import {deliverHabitAlert} from './habitDelivery';
import {nativeDelivery,requestDeliveryPermission} from './prayerDelivery';
import {pushControl,updatePushControl} from './push/store';
import {habitText} from './habitText';
interface Value {enabled:boolean;error:boolean;busy:boolean;permission:string;choose():Promise<void>}
const Context=createContext<Value|null>(null);
export function HabitDeliveryProvider({children}:{children:ReactNode}){
 const {state,workspace,storage}=useApp(),scope=workspace?.scope??'guest';
 const [enabled,setEnabled]=useState(false),[error,setError]=useState(false),[busy,setBusy]=useState(false),[permission,setPermission]=useState('default');
 const latest=useRef({state,scope,enabled});latest.current={state,scope,enabled};
 useEffect(()=>{
  let alive=true;setEnabled(false);setError(false);setBusy(false);
  const refresh=()=>{void pushControl().then(c=>{if(alive){setEnabled(c.habitForeground===scope);setPermission(typeof Notification==='undefined'?'unavailable':Notification.permission);}}).catch(()=>{if(alive){setEnabled(false);setError(true);}});};
  refresh();window.addEventListener('rise-push-changed',refresh);window.addEventListener('focus',refresh);
  return()=>{alive=false;window.removeEventListener('rise-push-changed',refresh);window.removeEventListener('focus',refresh);};
 },[scope]);
 useEffect(()=>{
  if(nativeDelivery||!enabled||permission!=='granted'||state.mode==='demo')return;
  let alive=true,cursor=Date.now(),planned:State|null=null,day='';let events:HabitAlert[]=[];
  const source=()=>alive&&latest.current.scope===scope&&latest.current.enabled&&storage.getSnapshot().status==='saved'?latest.current.state:null;
  const timer=setInterval(()=>{
   const now=Date.now(),since=Math.max(cursor,now-60000);cursor=now;
   const s=source();if(!s)return;
   const currentDay=dateInZone(now,s.timezone);
   if(s!==planned||day!==currentDay){events=buildHabitSchedule(s,since);planned=s;day=currentDay;}
   for(const event of events.filter(e=>e.at>since&&e.at<=now))void deliverHabitAlert(event,scope,source).catch(()=>{if(alive)setError(true);});
  },1000);
  return()=>{alive=false;clearInterval(timer);};
 },[enabled,permission,scope,storage,state.mode]);
 const choose=async()=>{
  setBusy(true);setError(false);const target=scope;
  try{
   // Permission request stays directly on the user gesture, never on renewal.
   if(!enabled){const p=await requestDeliveryPermission();if(latest.current.scope!==target)return;setPermission(p);if(p!=='granted')return;}
   const c=await pushControl();if(latest.current.scope!==target)return;
   await updatePushControl(c.revision,{habitForeground:enabled?null:target});
  }catch{if(latest.current.scope===target)setError(true);}finally{if(latest.current.scope===target)setBusy(false);}
 };
 return <Context.Provider value={{enabled,error,busy,permission,choose}}>{children}</Context.Provider>;
}
export function HabitDeliverySettings(){
 const {state,storage}=useApp(),v=useContext(Context),t=habitText(state.life.language);
 if(!v||state.mode==='demo'||nativeDelivery)return null;
 return <div className="group life-section">
  <p role="status" className="fine-print">{v.error?t('error'):v.permission==='denied'?t('denied'):v.enabled&&state.prefs.reminders&&v.permission==='granted'?t('active'):t('inactive')}</p>
  <Button variant="secondary" className="wide" disabled={v.busy||storage.getSnapshot().status!=='saved'} onClick={()=>void v.choose()}>{t(v.enabled?'stop':'enable')}</Button>
  <p className="fine-print">{t('limits')}</p>
 </div>;
}
