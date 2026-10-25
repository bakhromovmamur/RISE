import {AccountError} from '../auth/client';
import type {GroupArchiveJob,GroupArchiveReply} from './archive.worker';
/** Parse and hash large shared files away from mobile navigation. Termination
 * releases the memory-only file and cancels the fetch on close/scope change. */
export function runGroupArchive(job:GroupArchiveJob,signal:AbortSignal):Promise<string>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Canceled','AbortError'));return;}
  const worker=new Worker(new URL('./archive.worker.ts',import.meta.url),{type:'module'});
  const finish=()=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',cancel);};
  const cancel=()=>{finish();reject(new DOMException('Canceled','AbortError'));};
  const timer=setTimeout(()=>{finish();reject(new AccountError('unavailable'));},60000);
  signal.addEventListener('abort',cancel,{once:true});
  worker.onmessage=(event:MessageEvent<GroupArchiveReply>)=>{finish();const reply=event.data;if('raw'in reply)resolve(reply.raw);else reject(new AccountError(reply.error,reply.retryAfter));};
  worker.onerror=()=>{finish();reject(new AccountError('unavailable'));};
  try{worker.postMessage(job);}catch(error){finish();reject(error);}
 });
}
