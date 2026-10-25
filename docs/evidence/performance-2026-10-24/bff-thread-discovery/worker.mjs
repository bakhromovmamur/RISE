import { parentPort,workerData } from 'node:worker_threads';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const root=workerData.root,require=createRequire(`${root}/package.json`),{register}=await import(pathToFileURL(require.resolve('tsx/esm/api')));register();
const [{loadConfig},{database},{createApp},{Sessions}]=await Promise.all(['config','database','app','auth/sessions'].map(p=>import(pathToFileURL(`${root}/server/${p}.ts`))));
const config=loadConfig(parseEnv(await readFile(`${root}/.rise-infra/test/server.env`,'utf8')));
if(config.environment!=='test'||config.database.max!==5)throw new Error('fixed_test_pool_required');
// Test only: divide the existing five-connection budget across five BFF threads.
config.database.max=1;
const store=database(config);let app;
try{await store.verify();app=await createApp(config,store.verify,()=>{},new Sessions(config,store.pool));await app.ready();}
catch{await store.close();throw new Error('test_thread_start_failed');}
parentPort.on('message',async message=>{
 if(message.close){await app.close();await store.close();parentPort.postMessage({closed:true});parentPort.close();return;}
 try{
  const result=await app.inject(message.options);
  parentPort.postMessage({id:message.id,response:{statusCode:result.statusCode,body:result.body,headers:result.headers,cookies:result.cookies}});
 }catch{parentPort.postMessage({id:message.id,error:'test_thread_request_failed'});}
});
parentPort.postMessage({ready:true,pool:1});
