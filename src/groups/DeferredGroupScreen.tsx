import {useEffect,useState,type ComponentType} from 'react';
import {useApp,type Screen} from '../context';
import {Button} from '../components';

type Body=ComponentType<{screen:Screen}>;
let loaded:Body|null=null;
let pending:Promise<Body>|null=null;
function load(){
  pending??=import('./GroupScreenBody').then(module=>loaded=module.default).catch(error=>{pending=null;throw error;});
  return pending;
}
const copy={
  en:{loading:'Loading this screen…',failed:'This screen could not load. Check your connection and try again.',retry:'Try again'},
  ru:{loading:'Загружаем экран…',failed:'Не удалось загрузить экран. Проверьте подключение и попробуйте ещё раз.',retry:'Попробовать снова'},
  uz:{loading:'Sahifa yuklanmoqda…',failed:'Sahifa yuklanmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.',retry:'Qayta urinish'},
};

/** Only module code is shared. Form state still belongs to the scoped sheet. */
export function DeferredGroupScreen({screen}:{screen:Screen}){
  const {state}=useApp(),t=copy[state.life.language];
  const [Body,setBody]=useState<Body|null>(()=>loaded),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(Body)return;
    let active=true;
    void load().then(component=>{if(active)setBody(()=>component);},()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[Body,attempt]);
  if(Body)return <Body screen={screen}/>;
  return <div className="life-screen">{failed?<><p role="alert" className="field-error">{t.failed}</p><Button variant="secondary" onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>{t.retry}</Button></>:<p role="status" className="fine-print">{t.loading}</p>}</div>;
}
