import type pg from "pg";
import type { RequestDetails } from "web-push";
import { pushCrypto } from "./crypto.ts";
import { pushSubscription } from "./endpoint.ts";
import { encryptedPush,sendEncryptedPush,type Vapid } from "./transport.ts";
import {runPushJobs,dispatchPushJob,type JobLease,type ScheduledDispatch,type DispatchSubscription} from "./jobs.ts";
import { lock } from "../personal/repository.ts";
export interface PushSenderConfig {installationId:string;dataKey:Buffer;vapid:Vapid}
/** Explicit two-minute tests use the same isolated signer as reminders. */
export async function sendPushTests(pool:pg.Pool,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush,limit=20){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("invalid_batch");
  const rows=(await pool.query("select s.id,s.user_id from rise.push_subscriptions s where s.enabled and exists(select 1 from rise.push_tests t where t.installation_id=s.id and t.status='queued') order by s.id limit $1",[limit])).rows;
  const result={accepted:0,failed:0,retired:0};
  for(const candidate of rows){const c=await pool.connect();
    try{await c.query("begin");await lock(c,candidate.user_id);
      const s=(await c.query("select id,user_id,provider_session_id,enabled,version,language,subscription_cipher from rise.push_subscriptions where id=$1 and enabled for update",[candidate.id])).rows[0];
      if(!s){await c.query("commit");continue;}
      await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:s.user_id,session_id:s.provider_session_id})]);
      const active=(await c.query("select rise_private.active_session() as active")).rows[0].active;
      if(!active){await c.query("update rise.push_tests set status='canceled',completed_at=now() where installation_id=$1 and status='queued'",[s.id]);await c.query("update rise.push_subscriptions set enabled=false,endpoint_hash=null,subscription_cipher=null,version=version+1,updated_at=now() where id=$1",[s.id]);result.retired++;await c.query("commit");continue;}
      await c.query("update rise.push_tests set status='expired',completed_at=now() where installation_id=$1 and status='queued' and expires_at<=clock_timestamp()",[s.id]);
      const t=(await c.query("select * from rise.push_tests where installation_id=$1 and status='queued' order by created_at limit 1 for update skip locked",[s.id])).rows[0];
      if(t){let status="failed";
        if(t.installation_version!==s.version)status="canceled";
        else try{
          const subscription=pushSubscription(pushCrypto(config.dataKey,config.installationId).open(s.subscription_cipher,s.user_id,s.id));
          const ttl=Math.floor((t.expires_at.getTime()-Date.now())/1000);
          if(ttl<1)status="expired";
          else {const details=encryptedPush(subscription,{version:1,type:"test",id:t.id,owner:s.user_id,installation:s.id,generation:s.version,expiresAt:t.expires_at.toISOString(),language:s.language},config.vapid,ttl);
            // Owner lock serializes disable/deletion against this final dispatch.
            const response=await send(details);
            status=response>=200&&response<300?"accepted":[404,410].includes(response)?"retired":"failed";
          }
        }catch{status="failed";}
        await c.query("update rise.push_tests set status=$2,completed_at=now() where id=$1",[t.id,status]);
        if(status==="retired"){await c.query("update rise.push_subscriptions set enabled=false,endpoint_hash=null,subscription_cipher=null,version=version+1,updated_at=now() where id=$1",[s.id]);result.retired++;}
        else if(status==="accepted")result.accepted++;else if(status==="failed")result.failed++;
      }
      await c.query("commit");
    }catch{await c.query("rollback");result.failed++;}finally{c.release();}
  }
  await pool.query(`with expired as (select id from rise.push_tests where created_at<now()-interval '1 day' order by created_at,id for update skip locked limit 500)
   delete from rise.push_tests t using expired where t.id=expired.id`);
  return result;
}

/** Endpoint decryption and RFC Web Push encryption happen only inside the
 * checked dispatch transaction. No private journey fields enter the payload. */
async function encryptReminder(job:ScheduledDispatch,device:DispatchSubscription,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>){
  let details:RequestDetails;
  try{
   const subscription=pushSubscription(pushCrypto(config.dataKey,config.installationId).open(device.cipher,job.owner,job.installation));
   details=encryptedPush(subscription,{version:1,type:"reminder",id:job.event,owner:job.owner,installation:job.installation,generation:job.generation,planGeneration:job.planGeneration,eventAt:job.eventAt,expiresAt:job.expiresAt,language:device.language},config.vapid,job.ttl);
  }catch{return 400;} // Invalid stored capability/key fails closed, without logging it.
  return send(details);
}
export async function sendPushReminder(pool:pg.Pool,lease:JobLease,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush){
 return dispatchPushJob(pool,lease,(job,device)=>encryptReminder(job,device,config,send));
}
export async function sendPushReminders(pool:pg.Pool,config:PushSenderConfig,send:(details:RequestDetails)=>Promise<number>=sendEncryptedPush,limit=20,concurrency=1){
 return runPushJobs(pool,(job,device)=>encryptReminder(job,device,config,send),limit,concurrency);
}
