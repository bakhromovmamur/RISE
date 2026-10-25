import type pg from 'pg';
import {sendPushReminders,sendPushTests,type PushSenderConfig} from './worker.ts';
import {sendEncryptedPush} from './transport.ts';
import type {RequestDetails} from 'web-push';
import {sendGroupNotices} from './groupJobs.ts';

export async function stopPushSender(pool:pg.Pool,id:string){await pool.query('delete from rise_private.push_senders where id=$1',[id]);}
/** Four reminders, then two group notices and one explicit test bound delay.
 * Database-clock expiry also handles crashes and machines waking from sleep. */
export async function tickPushSender(pool:pg.Pool,id:string,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush){
 const pulse=()=>pool.query('insert into rise_private.push_senders(id) values($1) on conflict(id) do update set heartbeat_at=clock_timestamp()',[id]);
 await pulse();
 const reminders=await sendPushReminders(pool,config,send,4,4);
 await pulse();
 const phase=await Promise.allSettled([sendPushTests(pool,config,send,1),sendGroupNotices(pool,config,send,2,2)]);
 // Let every transaction finish before propagating a failure or shutdown.
 const failed=phase.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
 const [testResult,groupResult]=phase;if(testResult.status!=='fulfilled'||groupResult.status!=='fulfilled')throw new Error('sender_phase_failed');
 const tests=testResult.value,groups=groupResult.value;
 await pulse();
 await pool.query(`with expired as (select id from rise_private.push_senders where heartbeat_at<now()-interval '1 day' order by heartbeat_at,id for update skip locked limit 500)
  delete from rise_private.push_senders s using expired where s.id=expired.id`);
 await pool.query('select rise_private.prune_push_receipts(200)');
 await pool.query('select rise_private.prune_group_invitations(200)');
 await pool.query('select rise_private.prune_squad_previews(200)');
 return {reminders,tests,groups};
}
