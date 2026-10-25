import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {Agent,request} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
export async function install(h){
 assert.equal(h.config.environment,'test');assert.equal(h.config.database.max,5);
 const require=createRequire(`${process.cwd()}/package.json`),parse=require('set-cookie-parser').parse;
 await h.store.close();
 const child=fork(fileURLToPath(new URL('./gateway.mjs',import.meta.url)),[],{execArgv:[],env:{PATH:process.env.PATH,RISE_PROBE_ROOT:process.cwd()},stdio:['ignore','ignore','ignore','ipc']});
 let closed=false,failed=false,pending=0,stats;
 const exited=new Promise(resolve=>child.once('exit',code=>{if(!closed)failed=true;resolve(code);}));
 child.on('error',()=>{failed=true;});child.on('message',m=>{if(m.stats)stats=m.stats;});
 try{await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('test_http_start_timeout')),35000);
  const done=(error)=>{clearTimeout(timer);if(error)reject(error);else resolve();};
  child.once('exit',()=>done(new Error('test_http_start_failed')));child.once('error',()=>done(new Error('test_http_start_failed')));
  child.on('message',m=>{if(m.ready)done();if(m.error){failed=true;done(new Error(m.error));}});
 });}catch(error){if(child.connected)child.send({stop:true});await exited;throw error;}
 const agents=new Map();
 Object.defineProperty(h.app,'inject',{value:options=>new Promise((resolve,reject)=>{
  if(closed||failed){reject(new Error('test_http_not_ready'));return;}
  assert.match(options.url,/^\/api\/v1\//);
  let agent=agents.get(options.remoteAddress);if(!agent){agent=new Agent({keepAlive:true});agents.set(options.remoteAddress,agent);}
  const payload=options.payload===undefined?undefined:JSON.stringify(options.payload);
  const headers={...options.headers,...(payload===undefined?{}:{'content-type':'application/json','content-length':Buffer.byteLength(payload)})};
  pending++;let finished=false;
  const finish=(error,result)=>{if(finished)return;finished=true;pending--;if(error)reject(new Error('test_http_request_failed'));else resolve(result);};
  const req=request({hostname:'127.0.0.1',port:4191,path:options.url,method:options.method,headers,agent},res=>{
   const chunks=[];let bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>32*1024*1024){req.destroy();finish(true);}else chunks.push(chunk);});
   res.on('error',()=>finish(true));
   res.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');finish(false,{statusCode:res.statusCode,body,headers:res.headers,cookies:parse(res),json:()=>JSON.parse(body)});});
  });
  req.on('error',()=>finish(true));req.setTimeout(15000,()=>req.destroy());req.end(payload);
 })});
 h.close=async()=>{
  assert.equal(pending,0,'test_http_requests_must_drain');closed=true;for(const agent of agents.values())agent.destroy();
  if(child.connected)child.send({stop:true});const code=await exited;
  await h.app.close();await h.admin.end();if(stats)await writeFile(new URL('./stats.json',import.meta.url),JSON.stringify(stats,null,2));assert.equal(code,0,'test_http_gateway_close_failed');
 };
 return{workers:5,poolPerWorker:1,totalBffConnections:5,parentBffPoolClosed:true,transport:'HTTP 127.0.0.1:4191; per-browser keep-alive agent; least-pending HTTP requests over private Unix sockets',scope:'Test-only gateway/threads; injected login/seed; client IP not forwarded to Unix-socket backends; not authentication-rate-limit or production-runtime acceptance'};
}
