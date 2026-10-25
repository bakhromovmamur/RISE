import type pg from 'pg';

export async function senderReady(c:pg.PoolClient){
 return (await c.query("select exists(select 1 from rise_private.push_senders where heartbeat_at>clock_timestamp()-interval '30 seconds' and heartbeat_at<=clock_timestamp()) as ready")).rows[0].ready as boolean;
}
