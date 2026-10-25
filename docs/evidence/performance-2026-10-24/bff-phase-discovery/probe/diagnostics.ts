// Fixed-test discovery only. Never retain parameters, identities, headers or SQL.
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import type { FastifyRequest } from 'fastify';

type Measure = { count:number; ms:number; cpuMs:number };
type RequestProfile = { id:number; family:string; started:number; phases:Record<string,Measure> };
const storage=new AsyncLocalStorage<RequestProfile>(),requests=new WeakMap<FastifyRequest,RequestProfile>();
const completed:object[]=[],resources:object[]=[];let dropped=0,gcCount=0,gcMs=0,gcMaxMs=0;
let lastCpu=process.threadCpuUsage(),lastElu=performance.eventLoopUtilization(),lastSample=performance.now();
const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){gcCount++;gcMs+=entry.duration;gcMaxMs=Math.max(gcMaxMs,entry.duration);}});
observer.observe({entryTypes:['gc']});
function sample(){
 const cpu=process.threadCpuUsage(),elu=performance.eventLoopUtilization(),now=performance.now(),memory=process.memoryUsage();
 if(resources.length<1000)resources.push({at:performance.timeOrigin+now,intervalMs:now-lastSample,threadCpuMs:(cpu.user+cpu.system-lastCpu.user-lastCpu.system)/1000,eventLoop:performance.eventLoopUtilization(elu,lastElu),heapUsed:memory.heapUsed,heapTotal:memory.heapTotal,rssProcess:memory.rss,gc:{count:gcCount,totalMs:gcMs,maxMs:gcMaxMs}});
 lastCpu=cpu;lastElu=elu;lastSample=now;
}
const timer=setInterval(sample,5000);timer.unref();
function record(profile:RequestProfile|undefined,name:string,ms:number,cpuMs=0){
 if(!profile)return;
 const item=profile.phases[name]??{count:0,ms:0,cpuMs:0};item.count++;item.ms+=ms;item.cpuMs+=cpuMs;profile.phases[name]=item;
}
export function syncPhase<T>(name:string,run:()=>T):T{
 const profile=storage.getStore(),at=performance.now(),cpu=process.threadCpuUsage();
 try{return run();}finally{const usage=process.threadCpuUsage(cpu);record(profile,name,performance.now()-at,(usage.user+usage.system)/1000);}
}
export async function phase<T>(name:string,run:()=>Promise<T>):Promise<T>{
 const profile=storage.getStore(),at=performance.now();
 try{return await run();}finally{record(profile,name,performance.now()-at);}
}
function category(value:unknown){
 const sql=typeof value==='string'?value:'';
 if(sql.includes('from rise.habit_occurrences'))return 'db.occurrenceRead';
 if(sql.includes('from rise.personal_totals'))return 'db.total';
 if(sql.includes('pg_advisory_xact_lock'))return 'db.ownerLock';
 if(sql.includes('rise_private.active_session'))return 'db.activeSession';
 if(sql.includes('rise_private.server_sessions')||sql.includes('rise_private.auth_contexts'))return 'db.auth';
 if(sql.includes('rise_private.change_shared_content'))return 'db.sharedChange';
 if(/^(begin|commit|rollback|savepoint|release savepoint)\b/.test(sql))return 'db.transaction';
 if(/^\s*select\b/.test(sql))return 'db.otherRead';
 return 'db.otherWrite';
}
export function instrumentClient<T extends object>(client:T):T{
 return new Proxy(client,{get(target,key,receiver){
  if(key!=='query')return Reflect.get(target,key,receiver);
  const query=Reflect.get(target,key);
  if(typeof query!=='function')throw new Error('diagnostic_query_missing');
  return (...args:unknown[])=>phase(category(args[0]),()=>{
   const result:unknown=Reflect.apply(query,target,args);
   if(!(result instanceof Promise))throw new Error('diagnostic_promise_query_required');
   return result;
  });
 }});
}
export function beginRequest(request:FastifyRequest,done:()=>void){
 const supplied=request.headers['x-rise-probe-id'];
 if(typeof supplied!=='string'||!/^\d{1,7}$/.test(supplied))throw new Error('diagnostic_request_id_required');
 const url=request.raw.url??'',family=url==='/api/v1/personal/commands'?'personalCommand':url==='/api/v1/groups/commands'?'sharedCommand':url==='/api/v1/personal'?'personalRead':url==='/api/v1/groups'?'groupsRead':url.includes('/content?')?'contentRead':'other';
 const profile:RequestProfile={id:Number(supplied),family,started:performance.timeOrigin+performance.now(),phases:{}};
 requests.set(request,profile);storage.run(profile,done);
}
export function endRequest(request:FastifyRequest,status:number){
 const profile=requests.get(request);if(!profile)return;
 if(completed.length<20000)completed.push({...profile,status,ms:performance.timeOrigin+performance.now()-profile.started});else dropped++;
 requests.delete(request);
}
export function diagnosticSnapshot(){sample();clearInterval(timer);observer.disconnect();return{scope:'Fixed-test aggregate phases only; async spans overlap parent spans; query wall time includes client/event-loop work, not pure database CPU',completed,resources,dropped};}
