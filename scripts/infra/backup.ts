import {readFile,readdir,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {parseEnv} from 'node:util';
import {paths} from './local.ts';
import {createBackup,recoverySource,restoreDrill} from './recovery/database.ts';
import {backupKey,expireBackups,privateBytes,unseal,validateArchive,DAY} from './recovery/archive.ts';
import {maintainRecords} from './recovery/maintenance.ts';
import {writePrivateJson} from '../../server/operations/files.ts';
import {lifecycleDatabase,purgeAccounts,accountPurger} from '../../server/lifecycle/worker.ts';
async function main(){
 const [action,environment,name,...extra]=process.argv.slice(2);
 if(!['create','drill','maintain','watch'].includes(action)||!['local','test'].includes(environment)||extra.length||action!=='drill'&&name||action==='drill'&&!name)throw new Error('backup_usage');
 const env=environment as 'local'|'test',source=await recoverySource(env),lock=resolve(paths(env).directory,'backup.lock');let held=false;
 try{
 const file=await open(lock,'wx',0o600);held=true;await file.writeFile(String(process.pid));await file.close();
 if(action==='create'){const result=await createBackup(source);process.stdout.write(JSON.stringify(result)+'\n');return;}
 if(action==='drill'){const result=await restoreDrill(source,name!);await writePrivateJson(resolve(source.directory,'last-drill.json'),result);process.stdout.write(JSON.stringify(result)+'\n');return;}
 const e=parseEnv(await readFile(resolve(paths(env).directory,'lifecycle.env'),'utf8'));
 const lifecycle=lifecycleDatabase({environment:env,installationId:source.installationId,databaseUrl:e.DATABASE_LIFECYCLE_URL!});
 const stop=new AbortController();const stopNow=()=>stop.abort();process.once('SIGINT',stopNow);process.once('SIGTERM',stopNow);
 try{await lifecycle.verify();do{
  await mkdir(source.directory,{recursive:true,mode:0o700});
  const names=(await readdir(source.directory)).filter(n=>n.endsWith('.risebackup'));
  const key=await backupKey(source.keyPath,names.length===0);let latest=0,latestName:string|null=null,latestCompleted=0;
  // Expiry authenticates each archive; unreadable/corrupt files stop housekeeping.
  const expired=await expireBackups(source.directory,key,env,source.installationId);
  for(const name of (await readdir(source.directory)).filter(n=>n.endsWith('.risebackup'))){
   const a=validateArchive(unseal(await privateBytes(resolve(source.directory,name)),key),env,source.installationId);if(a.capturedAt>latest){latest=a.capturedAt;latestName=name;latestCompleted=a.completedAt;}
  }
  if(latestName)await writePrivateJson(resolve(source.directory,'latest.json'),{version:1,name:latestName,capturedAt:latest,completedAt:latestCompleted});
  if(action==='watch'&&Date.now()-latest>=DAY-3600000){latest=(await createBackup(source)).capturedAt;}
  const retention=await maintainRecords(source),purge=await purgeAccounts(lifecycle.pool,accountPurger(env,e.SUPABASE_URL!,e.SUPABASE_SECRET_KEY!));
  const result={version:1,checkedAt:Date.now(),latestBackupAt:latest||null,backupFresh:latest>0&&Date.now()-latest<DAY,expired,retention,purge};
  await writePrivateJson(resolve(source.directory,'status.json'),result);process.stdout.write(JSON.stringify(result)+'\n');
  if(action!=='watch'){if(!result.backupFresh||purge.failed)process.exitCode=2;break;}
  await delay(60000,undefined,{signal:stop.signal}).catch(()=>{});
 }while(!stop.signal.aborted);
 }finally{process.removeListener('SIGINT',stopNow);process.removeListener('SIGTERM',stopNow);await lifecycle.close();}
 }finally{if(held)await unlink(lock);await source.pool.end();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stderr.write('Local backup operation failed; access remains closed. Check protected configuration, key, archive, clock and isolated database readiness. No private records are logged.\n');process.exitCode=1;});
