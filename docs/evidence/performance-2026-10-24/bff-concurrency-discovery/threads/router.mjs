import {Worker} from 'node:worker_threads';
import assert from 'node:assert/strict';
export async function install(h){
 assert.equal(h.config.environment,'test');assert.equal(h.config.database.max,5);
 const threads=[],jobs=new Map();let serial=0,closed=false;
 const fail=()=>{for(const job of jobs.values())job.reject(new Error('test_thread_failed'));jobs.clear();};
 try{
  for(let i=0;i<5;i++){
   const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{root:process.cwd()},execArgv:[]});
   const entry={worker,pending:0,count:0};threads.push(entry);
   await new Promise((resolve,reject)=>{
    worker.on('error',()=>{fail();reject(new Error('test_thread_start_failed'));});
    worker.on('exit',code=>{if(!closed&&code!==0)fail();});
    worker.on('message',message=>{
     if(message.ready){assert.equal(message.pool,1);resolve();return;}
     if(message.closed)return;
     const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);entry.pending--;
     if(message.error){job.reject(new Error(message.error));return;}
     const r=message.response;job.resolve({...r,json:()=>JSON.parse(r.body)});
    });
   });
  }
  // Setup's BFF pool is closed before any measured request. Workers use only
  // the restricted runtime configuration; the parent owns admin fixture cleanup.
  await h.store.close();
  Object.defineProperty(h.app,'inject',{value:options=>new Promise((resolve,reject)=>{
   if(closed){reject(new Error('test_thread_router_closed'));return;}
   const id=++serial,entry=[...threads].sort((a,b)=>a.pending-b.pending||a.count-b.count)[0];entry.pending++;entry.count++;
   jobs.set(id,{resolve,reject});entry.worker.postMessage({id,options});
  })});
  h.close=async()=>{
   assert.equal(jobs.size,0,'test_requests_must_drain');closed=true;
   await Promise.all(threads.map(({worker})=>new Promise((resolve,reject)=>{worker.once('exit',code=>code===0?resolve():reject(new Error('test_thread_close_failed')));worker.postMessage({close:true});})));
   await h.app.close();await h.admin.end();
  };
  return {threads:5,poolPerThread:1,totalBffConnections:5,parentBffPoolClosed:true,scope:'Test-only in-process routing to real BFF execution threads; no production topology change'};
 }catch(error){closed=true;await Promise.all(threads.map(t=>t.worker.terminate()));throw error;}
}
