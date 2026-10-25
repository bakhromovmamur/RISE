import {randomUUID} from 'node:crypto';
import type pg from 'pg';
export interface JobLease {id:string;user_id:string;lease_token:string}
/** Durable lease claim uses the database clock; another worker can recover after 30s. */
export async function claimPushJob(pool:pg.Pool,owner?:string):Promise<JobLease|null>{
 await pool.query(`with expired as (select id from rise.push_jobs where status in ('queued','leased') and expires_at<=clock_timestamp()
 order by expires_at,id for update skip locked limit 500)
 update rise.push_jobs j set status='expired',lease_token=null,lease_until=null,completed_at=clock_timestamp() from expired where j.id=expired.id`);
 const token=randomUUID();
 const row=(await pool.query(`with candidate as (
 select id from rise.push_jobs where ($2::uuid is null or user_id=$2) and expires_at>clock_timestamp() and fire_at<=clock_timestamp()
 and ((status='queued' and next_attempt_at<=clock_timestamp()) or (status='leased' and lease_until<=clock_timestamp()))
 order by next_attempt_at,id for update skip locked limit 1)
 update rise.push_jobs j set status='leased',lease_token=$1,lease_until=clock_timestamp()+interval '30 seconds'
 from candidate where j.id=candidate.id returning j.id,j.user_id,j.lease_token`,[token,owner??null])).rows[0];
 return row??null;
}
export interface ScheduledDispatch {event:string;owner:string;installation:string;generation:number;planGeneration:number;eventAt:string;expiresAt:string;ttl:number}
export interface DispatchSubscription {cipher:string;language:string}
/** The owner lock protects the final consent check and provider submission. */
export async function dispatchPushJob(pool:pg.Pool,lease:JobLease,send:(job:ScheduledDispatch,subscription:DispatchSubscription)=>Promise<number>){
 const c=await pool.connect();
 try{await c.query('begin');
 const locked=(await c.query("select pg_try_advisory_xact_lock(hashtextextended($1,0)) as acquired",[`rise-personal:${lease.user_id}`])).rows[0].acquired;
 if(!locked){
  // Other lanes may reach the same owner. Keep consent/cancellation serialized
  // without occupying a connection while that owner's provider call runs.
  await c.query("update rise.push_jobs set status='queued',lease_token=null,lease_until=null,next_attempt_at=clock_timestamp()+interval '1 second' where id=$1 and user_id=$2 and status='leased' and lease_token=$3",[lease.id,lease.user_id,lease.lease_token]);
  await c.query('commit');return 'deferred';
 }
 const job=(await c.query("select *,clock_timestamp() as db_now from rise.push_jobs where id=$1 and user_id=$2 and status='leased' and lease_token=$3 and lease_until>clock_timestamp() for update",[lease.id,lease.user_id,lease.lease_token])).rows[0];
 if(!job){await c.query('commit');return 'lost_lease';}
 const subscription=(await c.query('select id,enabled,version,provider_session_id,subscription_cipher,language from rise.push_subscriptions where id=$1 and user_id=$2',[job.installation_id,job.user_id])).rows[0];
 const plan=(await c.query('select generation from rise.push_plans where user_id=$1',[job.user_id])).rows[0];
 let status='canceled';
 if(!job.presentation_canceled&&subscription?.enabled&&subscription.version===job.installation_version&&plan?.generation===job.generation){
 await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:job.user_id,session_id:subscription.provider_session_id})]);
 if((await c.query('select rise_private.active_session() as active')).rows[0].active){
 const dispatchNow=(await c.query('select clock_timestamp() as now')).rows[0].now as Date;
 const ttl=Math.floor((job.expires_at.getTime()-dispatchNow.getTime())/1000);
 if(ttl<1)status='expired';
 else if(job.attempts>=5)status='failed';
 else {let response=0;try{response=await send({event:job.event_key,owner:job.user_id,installation:job.installation_id,generation:subscription.version,planGeneration:job.generation,eventAt:job.fire_at.toISOString(),expiresAt:job.expires_at.toISOString(),ttl},{cipher:subscription.subscription_cipher,language:subscription.language});}catch{/* Bounded retry; no capability/error payload logging. */}
 status=response>=200&&response<300?'accepted':[404,410].includes(response)?'retired':response===0||response===429||response>=500?'queued':'failed';
 if(status==='retired')await c.query('update rise.push_subscriptions set enabled=false,endpoint_hash=null,subscription_cipher=null,version=version+1,updated_at=now() where id=$1',[subscription.id]);
 const retryNow=(await c.query('select clock_timestamp() as now')).rows[0].now as Date;
 if(status==='queued'&&(job.attempts>=4||job.expires_at.getTime()<=retryNow.getTime()+Math.min(30000,2000*2**job.attempts)))status='failed';
 await c.query('update rise.push_jobs set attempts=attempts+1 where id=$1',[job.id]);
 }
 }
 }
 await c.query("update rise.push_jobs set status=$2,lease_token=null,lease_until=null,next_attempt_at=clock_timestamp()+($3::int*interval '1 millisecond'),completed_at=case when $2='queued' then null else clock_timestamp() end where id=$1",[job.id,status,Math.min(30000,2000*2**job.attempts)]);
 await c.query('commit');return status;
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
export async function prunePushJobs(pool:pg.Pool,limit=500){
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('invalid_batch');
 return pool.query(`with expired as (select id from rise.push_jobs where expires_at<now()-interval '1 day'
 order by expires_at,id for update skip locked limit $1) delete from rise.push_jobs j using expired where j.id=expired.id`,[limit]);
}
/** Bounded scheduler tick; real and synthetic transports share the same checks. */
export async function runPushJobs(pool:pg.Pool,send:(job:ScheduledDispatch,subscription:DispatchSubscription)=>Promise<number>,limit=20,concurrency=1){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('invalid_batch');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('invalid_concurrency');
 const outcomes:Record<string,number>={};
 let remaining=limit;
 const lanes=await Promise.allSettled(Array.from({length:Math.min(concurrency,limit)},async()=>{
  while(remaining-->0){const lease=await claimPushJob(pool);if(!lease)return;const status=await dispatchPushJob(pool,lease,send);outcomes[status]=(outcomes[status]??0)+1;}
 }));
 // Wait for every transaction before propagating a lane failure/shutdown.
 const failed=lanes.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
 await prunePushJobs(pool);return outcomes;
}
