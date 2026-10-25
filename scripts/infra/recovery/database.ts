import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir,mkdir,chmod,open,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {writePrivateJson} from '../../../server/operations/files.ts';
import {paths,root,localStatus} from '../local.ts';
import {backupKey,privateBytes,seal,unseal,validateArchive,type RecoveryArchive} from './archive.ts';
const exec=promisify(execFile);
export async function migrationDigest(){
 const hash=createHash('sha256');for(const name of (await readdir(resolve(root,'supabase/migrations'))).filter(n=>n.endsWith('.sql')).sort())hash.update(name).update(await readFile(resolve(root,'supabase/migrations',name)));return hash.digest('hex');
}
export async function recoverySource(environment:'local'|'test'){
 if(!['local','test'].includes(environment))throw new Error('local_recovery_only');
 const status=await localStatus(environment),url=new URL(status.DB_URL);
 if(url.pathname!=='/postgres'||url.search||url.hash)throw new Error('fixed_source_required');
 const pool=new pg.Pool({connectionString:url.href,max:2,connectionTimeoutMillis:5000,statement_timeout:30000});
 try{
 const marker=(await pool.query('select environment,installation_id from rise_private.environment where singleton')).rows[0];
 const state:unknown=JSON.parse(await readFile(resolve(paths(environment).directory,'state.json'),'utf8'));
 if(!state||typeof state!=='object'||!('installationId'in state)||marker?.environment!==environment||marker.installation_id!==state.installationId)throw new Error('recovery_identity_mismatch');
 const expected=(await readdir(resolve(root,'supabase/migrations'))).filter(n=>n.endsWith('.sql')).map(n=>n.split('_')[0]).sort();
 const applied=(await pool.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>String(r.version));
 if(JSON.stringify(expected)!==JSON.stringify(applied))throw new Error('recovery_migrations_not_applied');
 const container=`supabase_db_${paths(environment).projectId}`;
 const inspected=JSON.parse((await exec('docker',['inspect',container])).stdout)[0];
 if(inspected.Config.Labels['com.supabase.cli.project']!==paths(environment).projectId||!inspected.State.Running)throw new Error('recovery_source_mismatch');
 return {environment,installationId:String(marker.installation_id),pool,container,image:String(inspected.Image),directory:resolve(paths(environment).directory,'backups'),keyPath:resolve(root,'.rise-infra/recovery-keys',`${environment}.key`)};
 }catch(error){await pool.end();throw error;}
}
export type RecoverySource=Awaited<ReturnType<typeof recoverySource>>;
/** Docker commands never receive passwords or private SQL in argv/output. */
export async function dockerInput(args:string[],input:Buffer|string){
 return new Promise<string>((resolveResult,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']}),parts:Buffer[]=[];let size=0,failed=false;
  const timer=setTimeout(()=>{failed=true;child.kill('SIGKILL');},120000);
  child.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>4*1024*1024){failed=true;child.kill('SIGKILL');}else parts.push(b);});
  child.stderr.resume();child.stdin.on('error',(error:NodeJS.ErrnoException)=>{if(error.code!=='EPIPE')failed=true;});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('recovery_process_failed'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0||failed)reject(new Error('recovery_process_failed:'+args.find(a=>['psql','pg_restore'].includes(a))));else resolveResult(Buffer.concat(parts).toString('utf8'));});child.stdin.end(input);
 });
}
export const sql=(container:string,query:string)=>dockerInput(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-h','/tmp','-d','postgres'],query);
export async function createBackup(source:RecoverySource){
 await mkdir(source.directory,{recursive:true,mode:0o700});await chmod(source.directory,0o700);
 const existing=(await readdir(source.directory)).some(n=>n.endsWith('.risebackup'));
 const key=await backupKey(source.keyPath,!existing),client=await source.pool.connect();
 try{
  await client.query('begin isolation level repeatable read read only');
  const {snapshot,at}=(await client.query('select pg_export_snapshot() as snapshot,extract(epoch from clock_timestamp())*1000 as at')).rows[0];
  const roles=(await client.query("select rolname from pg_roles where rolname !~ '^pg_' and rolname<>'postgres' order by rolname")).rows.map(r=>String(r.rolname));
  const dump=await exec('docker',['exec',source.container,'pg_dump','-U','supabase_admin','-d','postgres','-Fc','--schema=auth','--schema=rise','--schema=rise_private',`--snapshot=${snapshot}`],{encoding:'buffer',maxBuffer:64*1024*1024,timeout:120000});
  if(dump.stderr.length)throw new Error('backup_dump_warning');
  const archive:RecoveryArchive={version:1,environment:source.environment,installationId:source.installationId,capturedAt:Math.floor(Number(at)),completedAt:Date.now(),migrations:await migrationDigest(),roles,dump:dump.stdout.toString('base64')};
  validateArchive(archive,source.environment,source.installationId);
  const name=`${archive.capturedAt}-${randomUUID()}.risebackup`,target=resolve(source.directory,name),temporary=`${target}.tmp`,file=await open(temporary,'wx',0o600);
  try{await file.writeFile(seal(archive,key));await file.sync();await file.close();await rename(temporary,target);}catch(error){await file.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  await client.query('commit');await writePrivateJson(resolve(source.directory,'latest.json'),{version:1,name,capturedAt:archive.capturedAt,completedAt:archive.completedAt});return {name,capturedAt:archive.capturedAt,completedAt:archive.completedAt};
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
export interface Authority {at:number; installationId:string; users:string[]; deleted:{id:string;at:string}[];groups:{id:string;revision:number;owner:string;archived:boolean}[]}
export async function currentAuthority(source:RecoverySource):Promise<Authority>{
 const c=await source.pool.connect();try{await c.query('begin isolation level repeatable read read only');
 const users=(await c.query('select id from auth.users where deleted_at is null and (banned_until is null or banned_until<=now()) order by id limit 100001')).rows.map(r=>String(r.id));
 const deleted=(await c.query('select user_id as id,deleted_at as at from rise_private.deletion_ledger order by user_id limit 100001')).rows.map(r=>({id:String(r.id),at:new Date(r.at).toISOString()}));
 const groups=(await c.query('select id,revision,owner_id as owner,archived from rise.groups order by id limit 100001')).rows;
 if(users.length>100000||deleted.length>100000||groups.length>100000)throw new Error('local_recovery_capacity_exceeded');
 const at=Number((await c.query('select extract(epoch from transaction_timestamp())*1000 as at')).rows[0].at);
 await c.query('commit');return {at,installationId:source.installationId,users,deleted,groups};
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
/** Only disposable, networkless containers are targets. No target URL/DB name is accepted. */
export async function restoreDrill(source:RecoverySource,name:string,inspect?:(container:string)=>Promise<void>){
 const started=Date.now();
 if(!/^[0-9]{13}-[a-f0-9-]{36}\.risebackup$/.test(name))throw new Error('backup_name_invalid');
 const archive=validateArchive(unseal(await privateBytes(resolve(source.directory,name)),await backupKey(source.keyPath)),source.environment,source.installationId);
 if(archive.migrations!==await migrationDigest())throw new Error('matching_migrations_required');
 const authority=await currentAuthority(source);
 if(authority.at<archive.capturedAt||Date.now()-authority.at>300000)throw new Error('fresh_authority_required');
 const container=`rise-recovery-${randomUUID()}`;let created=false;
 try{
  await exec('docker',['run','-d','--name',container,'--label','rise.recovery=isolated','--network','none','--user','postgres','--entrypoint','sh',source.image,'-c',"mkdir -p /tmp/rise-recovery && initdb -D /tmp/rise-recovery -A trust --no-locale --encoding=UTF8 >/dev/null && exec postgres -D /tmp/rise-recovery -k /tmp -c listen_addresses=''"],{timeout:30000});created=true;
  const isolated=JSON.parse((await exec('docker',['inspect',container])).stdout)[0];
  if(isolated.HostConfig.NetworkMode!=='none'||isolated.Mounts.length||Object.keys(isolated.HostConfig.PortBindings??{}).length)throw new Error('restore_isolation_failed');
  for(let attempt=0;;attempt++){try{await sql(container,'select 1;');break;}catch{if(attempt>=50)throw new Error('restore_database_unavailable');await new Promise(r=>setTimeout(r,200));}}
  await sql(container,archive.roles.map(r=>`create role "${r}" nologin;`).join('\n')+`\ncreate schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;`);
  await dockerInput(['exec','-i',container,'pg_restore','-U','postgres','-h','/tmp','-d','postgres','--exit-on-error','--single-transaction'],Buffer.from(archive.dump,'base64'));
  // The authenticated dump is trusted local input. JSON reaches SQL only as hex UTF-8.
  const encoded=Buffer.from(JSON.stringify(authority)).toString('hex');
  const result=await sql(container,`begin;
   create temporary table recovery_authority as select convert_from(decode('${encoded}','hex'),'UTF8')::jsonb as value;
   do $$ begin if (select installation_id::text from rise_private.environment)<>(select value->>'installationId' from recovery_authority) then raise exception 'restore_identity_mismatch'; end if; end $$;
   update rise_private.server_sessions set revoked_at=coalesce(revoked_at,now()),provider_cipher=null;
   delete from auth.sessions; delete from auth.refresh_tokens; delete from rise_private.auth_challenges;
   update rise.group_invitations set revoked_at=coalesce(revoked_at,now());
   update rise.push_subscriptions set enabled=false,subscription_cipher=null,endpoint_hash=null,version=version+1;
   update rise.push_jobs set status='canceled',lease_token=null,lease_until=null,completed_at=now() where status in ('queued','leased');
   update rise.notification_jobs set status='canceled',lease_token=null,lease_until=null,completed_at=now() where status in ('queued','leased');
   update rise.push_tests set status='canceled',completed_at=now() where status='queued';
   delete from rise_private.push_senders;
   insert into rise_private.deletion_ledger(user_id,deleted_at) select (v->>'id')::uuid,(v->>'at')::timestamptz from recovery_authority,jsonb_array_elements(value->'deleted') v on conflict(user_id) do update set deleted_at=least(rise_private.deletion_ledger.deleted_at,excluded.deleted_at);
   -- A changed group may contain a withdrawal, removal or ownership transfer.
   -- Quarantine it entirely rather than infer authority from an older revision.
   with removed as (delete from rise.groups g where not exists(select 1 from recovery_authority,jsonb_array_elements(value->'groups') v where v->>'id'=g.id::text and (v->>'revision')::int=g.revision and v->>'owner'=g.owner_id::text and (v->>'archived')::boolean=g.archived) returning id) select 'quarantinedGroups='||count(*) from removed;
   do $$ declare target uuid; begin for target in select id from auth.users u where exists(select 1 from rise_private.deletion_ledger l where l.user_id=u.id) or not exists(select 1 from recovery_authority,jsonb_array_elements_text(value->'users') v where v=u.id::text) loop
    insert into rise_private.deletion_ledger(user_id,deleted_at) values(target,now()) on conflict do nothing;
    perform rise_private.purge_group_identity(target);
    delete from auth.users where id=target;
   end loop; end $$;
   commit;
   select 'enabledPush='||count(*) from rise.push_subscriptions where enabled;
   select 'activeSessions='||count(*) from rise_private.server_sessions where revoked_at is null;
   select 'suppressedUsers='||count(*) from auth.users u join rise_private.deletion_ledger l on l.user_id=u.id;
  `);
  if(!result.includes('enabledPush=0')||!result.includes('activeSessions=0')||!result.includes('suppressedUsers=0'))throw new Error('recovery_gate_failed');
  if(Date.now()-authority.at>300000)throw new Error('recovery_authority_expired');
  if(inspect)await inspect(container);
  const finalAuthority=await currentAuthority(source);
  if(JSON.stringify({...authority,at:0})!==JSON.stringify({...finalAuthority,at:0}))throw new Error('recovery_authority_changed_retry_required');
  return {version:1,environment:source.environment,completedAt:Date.now(),recoveryPointAgeMs:started-archive.capturedAt,recoveryDurationMs:Date.now()-started,pushDisabled:true,networkDisabled:true,accessReopened:false,quarantinedGroups:Number(result.match(/quarantinedGroups=(\d+)/)?.[1]??NaN)};
 }finally{if(created)await exec('docker',['rm','-f',container],{timeout:30000});}
}
