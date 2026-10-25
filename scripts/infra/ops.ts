import { readFile, open, unlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { paths } from './local.ts';
import { operationsDatabase } from '../../server/operations/database.ts';
import { readPrivateJson, writePrivateJson } from '../../server/operations/files.ts';
import { backupSummary, evaluate, readJournal, requestSummary, transition, type AlertJournal, type Observation } from '../../server/operations/monitor.ts';

async function backupObservation(environment:'local'|'test'){
 const directory=resolve(paths(environment).directory,'backups');
 const [status,latest]=await Promise.allSettled([readPrivateJson(resolve(directory,'status.json')),readPrivateJson(resolve(directory,'latest.json'))]);
 let value=status.status==='fulfilled'?backupSummary(status.value):{checkedAt:0,latestBackupAt:null,purgeFailed:false};
 if(latest.status==='fulfilled'){
  const raw=latest.value;
  if(!raw||typeof raw!=='object'||!('version'in raw)||raw.version!==1||!('capturedAt'in raw)||typeof raw.capturedAt!=='number'||!Number.isSafeInteger(raw.capturedAt)||!('name'in raw)||typeof raw.name!=='string'||!/^[0-9]{13}-[a-f0-9-]{36}\.risebackup$/.test(raw.name))throw new Error('invalid_backup_sample');
  const file=await lstat(resolve(directory,raw.name));
  if(!file.isFile()||file.isSymbolicLink()||(file.mode&0o077)!==0)throw new Error('invalid_backup_file');
  value={...value,latestBackupAt:raw.capturedAt};
 }else value={...value,latestBackupAt:null};
 return value;
}
export async function probe(environment:'local'|'test',sample:()=>Promise<Observation['queue']>):Promise<Observation>{
  const port=environment==='local'?4192:4191,directory=resolve(paths(environment).directory,'operations');
  const [health,backup,queue,requests]=await Promise.allSettled([
    fetch(`http://127.0.0.1:${port}/api/v1/health/ready`,{signal:AbortSignal.timeout(5000),redirect:'error'}).then(async response=>{const body:unknown=await response.json();return response.ok&&!!body&&typeof body==='object'&&'status' in body&&body.status==='ready'&&'release' in body&&typeof body.release==='string'&&'webRelease' in body&&typeof body.webRelease==='string'?{release:body.release,webRelease:body.webRelease}:null;}),
    backupObservation(environment),
    sample(),readPrivateJson(resolve(directory,`bff-${port}.json`)).then(requestSummary),
  ]);
  const current=health.status==='fulfilled'?health.value:null;
  const counters=requests.status==='fulfilled'?requests.value:null;
  return {backup:backup.status==='fulfilled'?backup.value:null,healthy:!!current,queue:queue.status==='fulfilled'?queue.value:null,requests:current&&counters?.release===current.release&&counters.webRelease===current.webRelease?counters:null};
}
export async function routeAlerts(path:string,active:Parameters<typeof transition>[1],now=Date.now()){
  let previous:AlertJournal|null=null;
  try{previous=readJournal(await readPrivateJson(path));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('alert_route_unreadable');}
  const journal=transition(previous,active,now);await writePrivateJson(path,journal);return journal;
}
async function main(){
  const [action,environment,...extra]=process.argv.slice(2);
  if(extra.length||!['check','watch','drill'].includes(action)||environment!=='local'&&environment!=='test')throw new Error('operations_usage');
  const directory=resolve(paths(environment).directory,'operations');
  if(action==='drill'){
    if(environment!=='test')throw new Error('drill_requires_test');
    const path=resolve(directory,'drill.json');
    await routeAlerts(path,[]);await routeAlerts(path,['test_alert']);const raised=readJournal(await readPrivateJson(path));
    if(!raised.active.includes('test_alert'))throw new Error('alert_drill_failed');
    await routeAlerts(path,[]);const resolved=readJournal(await readPrivateJson(path));
    if(resolved.active.length||resolved.events.at(-1)?.state!=='resolved')throw new Error('alert_drill_failed');
    process.stdout.write('Test alert raised and resolved through the private local file route. No message was sent.\n');return;
  }
  const db=operationsDatabase(parseEnv(await readFile(resolve(paths(environment).directory,'ops.env'),'utf8')),environment);
  const lockPath=resolve(paths(environment).directory,'ops.lock');let lock:Awaited<ReturnType<typeof open>>|undefined,stopped=false;
  const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    lock=await open(lockPath,'wx',0o600);await lock.writeFile(String(process.pid));
    do{
      const observation=await probe(environment,db.sample),active=evaluate(observation,Date.now());
      await writePrivateJson(resolve(directory,'status.json'),{version:1,checkedAt:new Date().toISOString(),...observation,ownership:'unassigned',backupMonitoring:'local_file'});
      const journal=await routeAlerts(resolve(directory,'alerts.json'),active);
      process.stdout.write(JSON.stringify({event:'operations_check',at:journal.checkedAt,active:journal.active,route:'private_local_file'})+'\n');
      if(action==='check'){if(active.length)process.exitCode=2;break;}
      for(let i=0;i<10&&!stopped;i++)await new Promise(resolve=>setTimeout(resolve,1000));
    }while(!stopped);
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);if(lock){await lock.close();await unlink(lockPath);}await db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stderr.write('Local operations check failed; configuration or private alert route needs attention. No private details logged.\n');process.exitCode=1;});
