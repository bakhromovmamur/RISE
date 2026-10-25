import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {get} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {loadConfig} from '../../../server/config.ts';
import {writePrivateJson} from '../../../server/operations/files.ts';
import {privateBytes} from '../recovery/archive.ts';
import {recoverySource} from '../recovery/database.ts';
import {paths,root} from '../local.ts';
import {compatible,migrations,releaseDirectory,verifyRelease,type ReleaseManifest} from './package.ts';

export type LocalEnvironment='local'|'test';
interface Selection {request:string;id:string;writes:boolean;environment:LocalEnvironment;installationId:string}
interface State {active:Selection;previous:Selection|null;at:string;outcome:'started'|'activated'|'restored'}
export function deploymentDirectory(environment:LocalEnvironment){if(!['local','test'].includes(environment))throw new Error('local_release_only');return resolve(paths(environment).directory,'deployment');}
async function config(environment:LocalEnvironment,id:string,writes:boolean){
  const env=parseEnv((await privateBytes(resolve(paths(environment).directory,'server.env'))).toString());
  const values={...env,RELEASE_ID:id,STATIC_DIRECTORY:join(releaseDirectory(id),'dist'),RISE_WRITES_ENABLED:String(writes),...(environment==='local'?{LOCAL_BROWSER_ORIGIN:'http://127.0.0.1:4192'}:{})};
  const result=loadConfig(values);if(result.environment!==environment)throw new Error('release_installation_mismatch');return {values,result};
}
async function readState(environment:LocalEnvironment):Promise<State|null>{
  try {const state=JSON.parse((await privateBytes(join(deploymentDirectory(environment),'state.json'))).toString()) as State;await validateSelection(environment,state.active);if(state.previous)await validateSelection(environment,state.previous);return state;}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
async function validateSelection(environment:LocalEnvironment,value:Selection){
  if(!value||value.environment!==environment||typeof value.writes!=='boolean'||typeof value.request!=='string'||!/^[a-f0-9-]{36}$/.test(value.request))throw new Error('invalid_release_selection');
  const loaded=await config(environment,value.id,value.writes);if(loaded.result.installationId!==value.installationId)throw new Error('release_installation_mismatch');
  return loaded;
}
async function preflight(environment:LocalEnvironment,id:string,current:Selection|null){
  const candidate=await verifyRelease(id),previous=current?await verifyRelease(current.id):null;
  const source=await recoverySource(environment);
  try{const applied=(await source.pool.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>String(r.version));compatible(candidate,previous,await migrations(),applied);}
  finally{await source.pool.end();}
  return candidate;
}
async function stop(child:ChildProcess){
  if(child.exitCode!==null||child.signalCode!==null)return;
  await new Promise<void>(resolveStop=>{const timer=setTimeout(()=>child.kill('SIGKILL'),10000);child.once('exit',()=>{clearTimeout(timer);resolveStop();});child.kill('SIGTERM');});
}
async function launch(environment:LocalEnvironment,selection:Selection,previous:Selection|null,probe=false){
  const {values,result}=await validateSelection(environment,selection),directory=releaseDirectory(selection.id);
  const child=spawn(process.execPath,['--import',join(directory,'node_modules/tsx/dist/loader.mjs'),join(directory,'scripts/infra/release/entry.ts')],{cwd:root,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NODE_ENV:'production'},stdio:['pipe','ignore','ignore','ipc']});
  try{
    const ready=new Promise<number>((resolveReady,reject)=>{
      const timer=setTimeout(()=>reject(new Error('release_start_timeout')),20000);
      child.once('error',()=>{clearTimeout(timer);reject(new Error('release_start_failed'));});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('release_start_failed'));});
      child.once('message',value=>{clearTimeout(timer);if(!value||typeof value!=='object'||!('ready'in value)||value.ready!==true||!('port'in value)||typeof value.port!=='number')reject(new Error('invalid_release_health'));else resolveReady(value.port);});
    });
    child.stdin!.on('error',()=>{});
    child.stdin!.end(JSON.stringify({env:values,probe,previous:previous?join(releaseDirectory(previous.id),'dist'):undefined}));
    const port=await ready;
    // Node fetch ignores Host overrides; a probe must retain the installation's real origin guard.
    const health=await new Promise<unknown>((resolveHealth,reject)=>{
      const request=get({hostname:'127.0.0.1',port,path:'/api/v1/health/ready',headers:{Host:new URL(result.origin).host},signal:AbortSignal.timeout(5000)},response=>{
        let body='';response.on('data',chunk=>{body+=String(chunk);if(body.length>2048)request.destroy(new Error('invalid_release_health'));});
        response.on('end',()=>{try{if(response.statusCode!==200)throw new Error('release_health_failed');resolveHealth(JSON.parse(body));}catch{reject(new Error('release_health_failed'));}});
        response.on('error',()=>reject(new Error('release_health_failed')));
      });request.on('error',()=>reject(new Error('release_health_failed')));
    });
    if(!health||typeof health!=='object'||!('release'in health)||health.release!==selection.id)throw new Error('release_health_failed');
    return child;
  }catch(error){await stop(child);throw error;}
}
async function locked<T>(environment:LocalEnvironment,name:string,run:()=>Promise<T>){
  const directory=deploymentDirectory(environment);await mkdir(directory,{recursive:true,mode:0o700});
  const path=join(directory,`${name}.lock`),file=await open(path,'wx',0o600);
  try{return await run();}finally{await file.close();await unlink(path);}
}
export async function selectRelease(environment:LocalEnvironment,id:string,writes=true,expectedRequest?:string){
  return locked(environment,'selection',async()=>{
    const current=await readState(environment);
    if(expectedRequest){
      const desired:unknown=JSON.parse((await privateBytes(join(deploymentDirectory(environment),'desired.json'))).toString());
      if(current?.active.request!==expectedRequest||!desired||typeof desired!=='object'||!('request'in desired)||desired.request!==expectedRequest)throw new Error('release_changed_review_required');
    }
    await preflight(environment,id,current?.active??null);
    const {result}=await config(environment,id,writes);
    const selection:Selection={request:randomUUID(),id,writes,environment,installationId:result.installationId};
    const probe=await launch(environment,selection,current?.active??null,true);await stop(probe);
    await writePrivateJson(join(deploymentDirectory(environment),'desired.json'),selection);
    return selection;
  });
}
export async function rollbackRelease(environment:LocalEnvironment){const state=await readState(environment);if(!state?.previous)throw new Error('previous_release_unavailable');return selectRelease(environment,state.previous.id,state.active.writes,state.active.request);}
export async function serveReleases(environment:LocalEnvironment){
  // npm/terminals can forward the same signal twice. Cover lock acquisition through final cleanup.
  let stopping=false;
  const abort=new AbortController(),requestStop=()=>{stopping=true;abort.abort();};process.on('SIGINT',requestStop);process.on('SIGTERM',requestStop);
  try{return await locked(environment,'server',async()=>{
    let state=await readState(environment),child:ChildProcess|null=null,seen='';
    const record=async(outcome:string,selection:Selection,manifest:ReleaseManifest|null)=>{
      await writePrivateJson(join(deploymentDirectory(environment),`record-${selection.request}-${outcome}.json`),{at:new Date().toISOString(),outcome,environment,release:selection.id,previous:state?.active.id??null,webRelease:manifest?.webRelease??null,writes:selection.writes,senderStarted:false});
    };
    try{
      while(!stopping){
        let desired:Selection;
        try{
          desired=JSON.parse((await privateBytes(join(deploymentDirectory(environment),'desired.json'))).toString()) as Selection;
          if(!desired||typeof desired.request!=='string'||!/^[a-f0-9-]{36}$/.test(desired.request))throw new Error('invalid_release_selection');
        }catch{
          if(!child)throw new Error('release_selection_unavailable');
          await delay(500,undefined,{signal:abort.signal}).catch(()=>{});continue;
        }
        if(desired.request!==seen){
          seen=desired.request;
          try{
            await validateSelection(environment,desired);
            const manifest=await preflight(environment,desired.id,state?.active??null);
            const probe=await launch(environment,desired,state?.active??null,true);await stop(probe);
            if(stopping)break;
            if(child){await stop(child);child=null;}
            try{child=await launch(environment,desired,state?.active??null);}
            catch(error){
              if(state){await preflight(environment,state.active.id,null);child=await launch(environment,state.active,state.previous);await record('restored',desired,manifest);}
              throw error;
            }
            await record(state?'activated':'started',desired,manifest);
            // A flag-only restart must not erase the useful previous release.
            state={active:desired,previous:state?.active.id!==desired.id?state?.active??null:state.previous,at:new Date().toISOString(),outcome:state?'activated':'started'};
            await writePrivateJson(join(deploymentDirectory(environment),'state.json'),state);
            process.stdout.write(JSON.stringify({event:'release_active',release:desired.id,writes:desired.writes})+'\n');
          }catch{
            await record('rejected',desired,null);
            if(!child)throw new Error('release_unavailable');
            process.stdout.write(JSON.stringify({event:'release_rejected',release:desired.id})+'\n');
          }
        }
        if(child&&(child.exitCode!==null||child.signalCode!==null))throw new Error('release_process_stopped');
        await delay(500,undefined,{signal:abort.signal}).catch(()=>{});
      }
    }finally{if(child)await stop(child);}
  });}finally{process.removeListener('SIGINT',requestStop);process.removeListener('SIGTERM',requestStop);}
}
