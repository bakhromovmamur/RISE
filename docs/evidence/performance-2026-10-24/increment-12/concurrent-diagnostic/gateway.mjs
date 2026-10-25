import {Worker} from 'node:worker_threads';
import {createServer,request,Agent} from 'node:http';
import {mkdtemp,rm,chmod,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=process.env.RISE_PROBE_ROOT,directory=await mkdtemp(join(tmpdir(),'rise-balanced-'));
await chmod(directory,0o700);
const timing=[];let serial=0;const workers=[];let stopping=false,failed=false,server,total=0,maximum=0,rejected=0;
async function stop(){
 if(stopping)return;stopping=true;
 if(server?.listening)await new Promise(resolve=>server.close(resolve));
 for(const e of workers)e.agent.destroy();
 await Promise.all(workers.map(e=>e.exited?Promise.resolve():new Promise(resolve=>{e.worker.once('exit',resolve);e.worker.postMessage({stop:true});})));
 const stats={captureId:process.env.RISE_PROBE_CAPTURE_ID,scope:'All requests after fixture seeding, including group setup, measurement, recovery, replay, readback and logout',maximumPending:maximum,rejected,timing,workers:workers.map(e=>({requests:e.count,maximumPending:e.maximum,counts:e.counts,metrics:e.metrics}))};
 await writeFile(new URL(`./stats-${process.env.RISE_PROBE_CAPTURE_ID}.json`,import.meta.url),JSON.stringify(stats,null,2));
 await rm(directory,{recursive:true,force:true});process.exitCode=failed?1:0;process.disconnect?.();
}
process.on('message',m=>{if(m.stop)void stop();});process.on('SIGTERM',()=>{void stop();});process.on('SIGINT',()=>{void stop();});process.on('disconnect',()=>{void stop();});
try{
 for(let i=0;i<1;i++){
  const socket=join(directory,`bff-${i}.sock`),worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{root,socket},execArgv:[]});
  const entry={worker,socket,agent:new Agent({keepAlive:true}),pending:0,count:0,maximum:0,exited:false,counts:{personal:0,shared:0,other:0}};workers.push(entry);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('test_worker_start_timeout')),30000);
   worker.on('message',m=>{if(m.metrics)entry.metrics=m.metrics;if(m.ready){clearTimeout(timer);resolve();}});
   worker.on('error',()=>{clearTimeout(timer);failed=true;reject(new Error('test_worker_failed'));if(server)void stop();});
   worker.on('exit',code=>{entry.exited=true;if(!stopping||code!==0){failed=true;clearTimeout(timer);reject(new Error('test_worker_exit'));if(server)void stop();}});
  });
 }
 server=createServer({requestTimeout:15000,headersTimeout:10000,keepAliveTimeout:72000},(incoming,outgoing)=>{
  if(stopping||failed||total>=256){rejected++;incoming.resume();outgoing.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});outgoing.end('{"error":{"code":"unavailable"}}');return;}
  const entry=[...workers].sort((a,b)=>a.pending-b.pending||a.count-b.count)[0];entry.pending++;entry.count++;total++;entry.maximum=Math.max(entry.maximum,entry.pending);maximum=Math.max(maximum,total);
  entry.counts[incoming.url==='/api/v1/personal/commands'?'personal':incoming.url==='/api/v1/groups/commands'?'shared':'other']++;
  const id=++serial,started=performance.timeOrigin+performance.now();let headersAt=null;
  let finished=false;const finish=()=>{if(finished)return;finished=true;entry.pending--;total--;timing.push({id,started,ms:performance.timeOrigin+performance.now()-started,headersMs:headersAt===null?null:headersAt-started});};
  const upstream=request({socketPath:entry.socket,path:incoming.url,method:incoming.method,headers:{...incoming.headers,"x-rise-probe-id":String(id)},agent:entry.agent},response=>{
   headersAt=performance.timeOrigin+performance.now();outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);response.once('end',finish);response.once('error',()=>{outgoing.destroy();finish();});
  });
  upstream.once('error',()=>{if(!outgoing.headersSent){outgoing.writeHead(502,{'content-type':'application/json','cache-control':'no-store'});outgoing.end('{"error":{"code":"unavailable"}}');}else outgoing.destroy();finish();});
  incoming.once('aborted',()=>upstream.destroy());incoming.once('error',()=>upstream.destroy());
  incoming.pipe(upstream);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4191,'127.0.0.1',resolve);});process.send?.({ready:true});
}catch{failed=true;process.send?.({error:'test_gateway_start_failed'});await stop();}
