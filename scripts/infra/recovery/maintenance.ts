import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {paths} from '../local.ts';
import type {RecoverySource} from './database.ts';
import {retention} from '../../../server/personal/recovery.ts';
import {prunePushJobs} from '../../../server/push/jobs.ts';
import {pruneGroupNotices} from '../../../server/push/groupJobs.ts';
/** Separate from dispatch: housekeeping must work even when sending is stopped.
 * Administrative local tooling only, never imported by BFF/browser. */
export async function maintainRecords(source:RecoverySource){
 const pool=source.pool,client=await pool.connect();let owners=0;
 try{await client.query('begin');
 // Select only owners with expired records, preventing starvation on later passes.
 const candidates=(await client.query(`select distinct owner_id from (
 select owner_id from rise.personal_receipts where created_at<now()-interval '90 days'
 union select owner_id from rise.sync_changes where changed_at<now()-interval '90 days') expired order by owner_id limit 20`)).rows;
 for(const {owner_id:owner} of candidates){
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`rise-personal:${owner}`]);
  // Share the same atomic monotonic floor/deletion boundary used by sync.
  await retention(client,owner);owners++;
 }
 await client.query("delete from rise.group_receipts where (user_id,id) in(select user_id,id from rise.group_receipts where created_at<now()-interval '90 days' order by created_at limit 200)");
 await client.query("delete from rise.sync_imports where (owner_id,id) in(select owner_id,id from rise.sync_imports where committed_revision is null and expires_at<now() limit 200)");
 await client.query("delete from rise_private.auth_challenges where context_hash in(select context_hash from rise_private.auth_challenges where expires_at<now() limit 200)");
 await client.query("delete from rise_private.auth_contexts where id_hash in(select id_hash from rise_private.auth_contexts where expires_at<now() limit 200)");
 await client.query("delete from rise_private.auth_limits where (subject_hash,window_seconds,window_start) in(select subject_hash,window_seconds,window_start from rise_private.auth_limits where window_start<now()-interval '2 days' limit 200)");
 await client.query("delete from rise_private.group_attempts where id in(select id from rise_private.group_attempts where created_at<now()-interval '30 days' order by created_at limit 200)");
 await client.query('commit');
 }catch(error){await client.query('rollback');throw error;}finally{client.release();}
 const env=parseEnv(await readFile(resolve(paths(source.environment).directory,'push.env'),'utf8')),url=new URL(env.DATABASE_WORKER_URL!);
 if(env.DEPLOY_ENV!==source.environment||env.INSTALLATION_ID!==source.installationId||url.hostname!=='127.0.0.1'||url.port!==String(paths(source.environment).dbPort)||url.username!=='rise_worker_login'||url.pathname!=='/postgres'||url.search||url.hash)throw new Error('maintenance_worker_identity_mismatch');
 const worker=new pg.Pool({connectionString:url.href,max:1,connectionTimeoutMillis:3000,statement_timeout:30000});
 try{
 const marker=(await worker.query('select environment,installation_id from rise_private.environment where singleton')).rows[0];
 if(marker?.environment!==source.environment||marker.installation_id!==source.installationId)throw new Error('maintenance_worker_identity_mismatch');
 await worker.query('select rise_private.prune_push_receipts(200)');
 await worker.query('select rise_private.prune_group_invitations(200)');
 await worker.query('select rise_private.prune_squad_previews(200)');
 const jobs=await prunePushJobs(worker),notices=await pruneGroupNotices(worker);
 const tests=await worker.query("delete from rise.push_tests where id in(select id from rise.push_tests where expires_at<now()-interval '7 days' limit 500)");
 return {owners,expiredJobs:jobs.rowCount,expiredNotices:notices.rowCount,expiredTests:tests.rowCount};
 }finally{await worker.end();}
}
