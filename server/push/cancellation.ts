import type pg from 'pg';
import type {AccountCommand} from '../../src/contracts/accountCommands.ts';
import {canceledEventKeys} from '../../src/push/policy.ts';
/** Caller holds the owner lock; cancellation commits with the personal receipt. */
export async function cancelForCommand(c:pg.PoolClient,actor:string,command:AccountCommand){
 const keys=await canceledEventKeys(command);if(keys?.length===0)return;
 await cancelJobs(c,actor,keys);
}
export async function cancelJobs(c:pg.PoolClient,actor:string,keys:string[]|null,throughGeneration?:number){
 await c.query("update rise.push_jobs set presentation_canceled=true,status=case when status='accepted' then status else 'canceled' end,lease_token=null,lease_until=null,completed_at=case when status='accepted' then completed_at else clock_timestamp() end where user_id=$1 and status in ('queued','leased','accepted') and ($2::uuid[] is null or event_key=any($2)) and ($3::integer is null or generation<=$3)",[actor,keys,throughGeneration??null]);
 await c.query("update rise.push_plans p set queued_through=(select max(fire_at) from rise.push_jobs j where j.user_id=p.user_id and j.generation=p.generation and j.status in ('queued','leased') and j.expires_at>clock_timestamp()) where p.user_id=$1",[actor]);
}
