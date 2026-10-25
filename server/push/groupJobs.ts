import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import type {RequestDetails} from 'web-push';
import {pushCrypto} from './crypto.ts';
import {pushSubscription} from './endpoint.ts';
import {encryptedPush,sendEncryptedPush} from './transport.ts';
import type {PushSenderConfig} from './worker.ts';
import type {JobLease,DispatchSubscription} from './jobs.ts';

export interface GroupDispatch {id:string;owner:string;installation:string;generation:number;eventAt:string;expiresAt:string;ttl:number}
interface GroupJob {id:string;user_id:string;installation_id:string;installation_version:number;fire_at:Date;expires_at:Date;attempts:number}
export async function claimGroupNotice(pool:pg.Pool,owner?:string):Promise<JobLease|null>{
 await pool.query(`with expired as (select id from rise.notification_jobs where status in ('queued','leased') and expires_at<=clock_timestamp()
 order by expires_at,id for update skip locked limit 500)
 update rise.notification_jobs j set status='expired',lease_token=null,lease_until=null,completed_at=clock_timestamp() from expired where j.id=expired.id`);
 const token=randomUUID();
 return(await pool.query<JobLease>(`with candidate as (select id from rise.notification_jobs
 where ($2::uuid is null or user_id=$2) and fire_at<=clock_timestamp() and expires_at>clock_timestamp()
 and ((status='queued' and next_attempt_at<=clock_timestamp()) or (status='leased' and lease_until<=clock_timestamp()))
 order by next_attempt_at,id for update skip locked limit 1)
 update rise.notification_jobs j set status='leased',lease_token=$1,lease_until=clock_timestamp()+interval '30 seconds'
 from candidate where j.id=candidate.id returning j.id,j.user_id,j.lease_token`,[token,owner??null])).rows[0]??null;
}

/** Recipient actor → group → job. The fixed database capability rechecks source,
 * consent and quiet hours; those locks cover the final encrypted submission. */
export async function dispatchGroupNotice(pool:pg.Pool,lease:JobLease,send:(job:GroupDispatch,device:DispatchSubscription)=>Promise<number>){
 const c=await pool.connect();
 try{await c.query('begin');
  const acquired=(await c.query("select pg_try_advisory_xact_lock(hashtextextended($1,0)) as acquired",[`rise-personal:${lease.user_id}`])).rows[0].acquired;
  if(!acquired){await c.query("update rise.notification_jobs set status='queued',lease_token=null,lease_until=null,next_attempt_at=clock_timestamp()+interval '1 second' where id=$1 and user_id=$2 and status='leased' and lease_token=$3",[lease.id,lease.user_id,lease.lease_token]);await c.query('commit');return 'deferred';}
  const allowed=(await c.query('select rise_private.lock_group_notice($1,$2,$3) as allowed',[lease.id,lease.user_id,lease.lease_token])).rows[0].allowed;
  const job=(await c.query<GroupJob>(`select id,user_id,installation_id,installation_version,fire_at,expires_at,attempts from rise.notification_jobs
   where id=$1 and user_id=$2 and status='leased' and lease_token=$3 and lease_until>clock_timestamp() for update`,[lease.id,lease.user_id,lease.lease_token])).rows[0];
  if(!job){await c.query('commit');return 'lost_lease';}
  let status='canceled';
  const now=(await c.query<{now:Date}>('select clock_timestamp() as now')).rows[0].now,ttl=Math.floor((job.expires_at.getTime()-now.getTime())/1000);
  if(ttl<1)status='expired';
  else if(allowed){
   if(job.attempts>=5)status='failed';
   else {
    const device=(await c.query<{subscription_cipher:string;language:string}>('select subscription_cipher,language from rise.push_subscriptions where id=$1 and user_id=$2 and enabled and version=$3',[job.installation_id,job.user_id,job.installation_version])).rows[0];
    if(device){let response=0;try{response=await send({id:job.id,owner:job.user_id,installation:job.installation_id,generation:job.installation_version,eventAt:job.fire_at.toISOString(),expiresAt:job.expires_at.toISOString(),ttl},{cipher:device.subscription_cipher,language:device.language});}catch{/* No transport capability or private error is logged. */}
     status=response>=200&&response<300?'accepted':[404,410].includes(response)?'retired':response===0||response===429||response>=500?'queued':'failed';
     if(status==='retired')await c.query('update rise.push_subscriptions set enabled=false,endpoint_hash=null,subscription_cipher=null,version=version+1,updated_at=now() where id=$1',[job.installation_id]);
     const retryNow=(await c.query<{now:Date}>('select clock_timestamp() as now')).rows[0].now;
     if(status==='queued'&&(job.attempts>=4||job.expires_at.getTime()<=retryNow.getTime()+Math.min(30000,2000*2**job.attempts)))status='failed';
     await c.query('update rise.notification_jobs set attempts=attempts+1 where id=$1',[job.id]);
    }
   }
  }
  await c.query("update rise.notification_jobs set status=$2,lease_token=null,lease_until=null,next_attempt_at=clock_timestamp()+($3::int*interval '1 millisecond'),completed_at=case when $2='queued' then null else clock_timestamp() end where id=$1",[job.id,status,Math.min(30000,2000*2**job.attempts)]);
  await c.query('commit');return status;
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
export async function pruneGroupNotices(pool:pg.Pool,limit=500){
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('invalid_batch');
 return pool.query(`with expired as (select id from rise.notification_jobs where expires_at<now()-interval '1 day'
 order by expires_at,id for update skip locked limit $1) delete from rise.notification_jobs j using expired where j.id=expired.id`,[limit]);
}
/** Encrypt and dispatch one claimed lease; the scheduler and scoped
 * integration checks share this exact transport/authorization path. */
export async function sendGroupNotice(pool:pg.Pool,lease:JobLease,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush){
 return dispatchGroupNotice(pool,lease,async(job,device)=>{
    let details:RequestDetails;try{const subscription=pushSubscription(pushCrypto(config.dataKey,config.installationId).open(device.cipher,job.owner,job.installation));
     details=encryptedPush(subscription,{version:1,type:'group',id:job.id,owner:job.owner,installation:job.installation,generation:job.generation,eventAt:job.eventAt,expiresAt:job.expiresAt,language:device.language},config.vapid,job.ttl);
    }catch{return 400;}return send(details);
   });
}
export async function sendGroupNotices(pool:pg.Pool,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush,limit=20,concurrency=1){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('invalid_batch');
 const outcomes:Record<string,number>={};let remaining=limit;
 const lanes=await Promise.allSettled(Array.from({length:Math.min(limit,concurrency)},async()=>{
  while(remaining-->0){const lease=await claimGroupNotice(pool);if(!lease)return;
   const status=await sendGroupNotice(pool,lease,config,send);outcomes[status]=(outcomes[status]??0)+1;
  }
 }));
 const failed=lanes.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
 await pruneGroupNotices(pool);return outcomes;
}
