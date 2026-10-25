import { useState } from 'react';
import { Download } from 'lucide-react';
import { GroupRow } from '../components';
import { useApp } from '../context';
import { diagnosticReport } from './report';
import { diagnosticsText } from './text';

export function Diagnostics(){
  const {state,storage,workspace}=useApp(),t=diagnosticsText(state.life.language);
  const [failed,setFailed]=useState(false);
  function download(){
    setFailed(false);
    let url:string|undefined,link:HTMLAnchorElement|undefined;
    try{
      const saved=storage.getSnapshot(),sync=workspace?.accountStatus();
      const report=diagnosticReport({release:document.querySelector('meta[name="rise-release"]')?.getAttribute('content'),storageStatus:saved.status,storageError:saved.error,syncPhase:sync?.phase??'guest',syncError:sync?.error??null,pending:(workspace?.getSyncSnapshot().pending??0)>0,persistent:sync?.persistent??true,online:navigator.onLine,worker:!!navigator.serviceWorker?.controller});
      url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
      link=document.createElement('a');link.href=url;link.download='rise-diagnostics.json';document.body.append(link);link.click();
    }catch{setFailed(true);}
    finally{link?.remove();if(url){const downloadUrl=url;setTimeout(()=>URL.revokeObjectURL(downloadUrl),30000);}}
  }
  return <><div className="group diagnostics-group"><GroupRow icon={<Download size={20}/>} title={t('download')} detail={t('detail')} onClick={download}/></div><p className="fine-print">{t('help')}</p>{failed&&<p role="alert" className="form-error">{t('failed')}</p>}</>;
}
