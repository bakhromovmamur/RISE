// Frozen runtime entry. Only the local release supervisor supplies stdin; no HTTP test controls.
import {loadConfig} from '../../../server/config.ts';
import {database} from '../../../server/database.ts';
import {createApp} from '../../../server/app.ts';
import {Sessions} from '../../../server/auth/sessions.ts';
import {writePrivateJson} from '../../../server/operations/files.ts';
import {resolve} from 'node:path';

try{
  let raw='';for await(const chunk of process.stdin){raw+=String(chunk);if(raw.length>65536)throw new Error('invalid_launch');}
  const input=JSON.parse(raw) as {env:NodeJS.ProcessEnv;probe:boolean;previous?:string};
  const config=loadConfig(input.env);
  if(!['local','test'].includes(config.environment))throw new Error('local_release_only');
  config.previousStaticDirectory=input.previous;
  const store=database(config);
  try{
    await store.verify();
    const app=await createApp(config,store.verify,undefined,new Sessions(config,store.pool));
    await app.listen({host:'127.0.0.1',port:input.probe?0:config.port});
    let writing:Promise<void>|null=null;
    const snapshot=()=>{if(input.probe||writing)return;writing=writePrivateJson(resolve('.rise-infra',config.environment,'operations',`bff-${config.port}.json`),app.operationsSnapshot()).catch(()=>{}).finally(()=>{writing=null;});};
    snapshot();const timer=setInterval(snapshot,5000);timer.unref();
    let stopping=false;
    const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);await writing;await app.close();await store.close();process.disconnect?.();};
    process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());process.once('disconnect',()=>void stop());
    const address=app.server.address();if(!address||typeof address==='string')throw new Error('invalid_listener');
    process.send?.({ready:true,port:address.port});
  }catch{await store.close();throw new Error('release_start_failed');}
}catch{process.exitCode=1;}
