import {useEffect,useRef,useState} from 'react';
import {useApp} from '../context';
import {Button} from '../components';
import {AccountError,reauthenticate,verifyReauthentication} from '../auth/client';
import type {CodeChallenge} from '../contracts/auth';
import {lifecycleText} from '../account/text';
import {useGroups} from './GroupProvider';
import {groupText,groupError} from './text';
const useCopy=()=>groupText(useApp().state.life.language);
export function GroupReauthentication({onVerified,help,blocked=false}:{onVerified:()=>void|Promise<unknown>;help:string;blocked?:boolean}){
 const {workspace,state}=useApp(),{session}=useGroups(),t=useCopy(),a=lifecycleText(state.life.language);
 const [challenge,setChallenge]=useState<CodeChallenge|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[seconds,setSeconds]=useState(0);
 const deadline=useRef(0),abort=useRef(new AbortController()),pending=useRef(false),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const controller=new AbortController();abort.current=controller;const timer=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadline.current-Date.now())/1000))),1000);return()=>{controller.abort();clearInterval(timer);};},[]);
 useEffect(()=>{if(challenge)input.current?.focus({preventScroll:true});},[challenge]);
 const run=async(verify:boolean)=>{
  const identity=workspace?.getAccountIdentity(),owner=session?.owner;if(!workspace||!owner||identity?.account?.id!==owner||pending.current||blocked)return;
  pending.current=true;setBusy(true);setError(null);
  try{if(verify&&challenge){await verifyReauthentication(owner,challenge.challenge,code,identity.csrfToken,abort.current.signal);await workspace.refreshIdentity(abort.current.signal);if(!abort.current.signal.aborted&&workspace.scope===owner){setCode('');setChallenge(null);await onVerified();}}
   else{const next=await reauthenticate(owner,identity.csrfToken,abort.current.signal);if(!abort.current.signal.aborted&&workspace.scope===owner){setChallenge(next);setCode('');deadline.current=Date.now()+next.retryAfter*1000;setSeconds(next.retryAfter);}}}
  catch(failure){if(!abort.current.signal.aborted){const fault=failure instanceof AccountError?failure:null;setError(fault?.code??'unavailable');if(fault?.retryAfter){deadline.current=Date.now()+fault.retryAfter*1000;setSeconds(fault.retryAfter);}}}
  finally{pending.current=false;if(!abort.current.signal.aborted)setBusy(false);}
 };
 return <form className="group-reauth" onSubmit={e=>{e.preventDefault();void run(!!challenge);}}><p className="fine-print" role="status">{help}</p>{challenge&&<><p className="fine-print">{a('sent')}</p><label className="field">{a('code')}<input ref={input} value={code} onChange={e=>setCode(e.target.value.replace(/\s/g,''))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} aria-invalid={error==='invalid_code'}/></label></>}
  <Button type="submit" disabled={busy||blocked||!challenge&&seconds>0}>{a(busy?'working':challenge?'verify':'send')}{!challenge&&seconds>0?` (${seconds})`:''}</Button>
  {challenge&&<Button type="button" variant="secondary" disabled={busy||blocked||seconds>0} onClick={()=>void run(false)}>{a('send')}{seconds>0?` (${seconds})`:''}</Button>}
  {error&&<p role="alert" className="field-error">{error==='invalid_code'?a('invalid'):t(groupError(error))}</p>}
 </form>;
}
