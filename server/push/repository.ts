import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { ServerConfig } from "../config.ts";
import { AuthError } from "../auth/sessions.ts";
import { hash } from "../auth/crypto.ts";
import { lock } from "../personal/repository.ts";
import { pushCrypto } from "./crypto.ts";
import { pushSubscription } from "./endpoint.ts";
import { pushObject,pushOnly,pushUUID,type PushView,type PushTest } from "../../src/contracts/push.ts";
interface Row {id:string;user_id:string;version:number;enabled:boolean;details:boolean;language:"en"|"ru"|"uz";provider_session_id:string;endpoint_hash:Buffer|null;subscription_cipher:string|null}
const sessionId=async(c:pg.PoolClient):Promise<string>=>(await c.query("select current_setting('request.jwt.claims',true)::jsonb->>'session_id' as id")).rows[0].id;
const select=async(c:pg.PoolClient,actor:string,token:string):Promise<Row|undefined>=>(await c.query<Row>("select * from rise.push_subscriptions where user_id=$1 and installation_hash=$2",[actor,hash(`${actor}:${token}`)])).rows[0];
function input(value:unknown,keys:string[]){if(!pushObject(value)||!pushOnly(value,keys)||!pushUUID(value.accountId))throw new AuthError(422,"invalid_input");return value;}
function owner(value:Record<string,unknown>,actor:string){if(value.accountId!==actor)throw new AuthError(409,"account_changed");}
const version=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<2147483647;
export async function pushView(c:pg.PoolClient,actor:string,token:string,config:ServerConfig):Promise<PushView>{
  const row=await select(c,actor,token),current=await sessionId(c);
  const test=row?(await c.query("select id,status,expires_at from rise.push_tests where user_id=$1 and installation_id=$2 order by created_at desc limit 1",[actor,row.id])).rows[0]:null;
  return {configured:!!config.push,publicKey:config.push?.publicKey??null,installation:row?{id:row.id,version:row.version,enabled:row.enabled&&row.provider_session_id===current,details:row.details,language:row.language,needsReview:row.enabled&&row.provider_session_id!==current}:null,
    test:test?{id:test.id,status:test.status==="queued"&&test.expires_at.getTime()<=Date.now()?"expired":test.status,expiresAt:test.expires_at.toISOString()}:null};
}
export async function savePush(c:pg.PoolClient,actor:string,token:string,config:ServerConfig,value:unknown){
  const v=input(value,["accountId","version","subscription","details","language"]);owner(v,actor);
  if(!config.push)throw new AuthError(503,"unavailable");
  if(!version(v.version)||typeof v.details!=="boolean"||typeof v.language!=="string"||!["en","ru","uz"].includes(v.language))throw new AuthError(422,"invalid_input");
  let subscription;try{subscription=pushSubscription(v.subscription);}catch{throw new AuthError(422,"invalid_input");}
  await lock(c,actor);
  const row=await select(c,actor,token),crypto=pushCrypto(config.push.dataKey,config.installationId),digest=crypto.digest(subscription.endpoint),session=await sessionId(c);
  const same=row?.enabled&&row.provider_session_id===session&&row.details===v.details&&row.language===v.language&&row.endpoint_hash?.equals(digest)&&row.subscription_cipher&&JSON.stringify(crypto.open(row.subscription_cipher,actor,row.id))===JSON.stringify(subscription);
  if(same)return pushView(c,actor,token,config);
  if((row?.version??0)!==v.version)throw new AuthError(409,"account_changed");
  const id=row?.id??randomUUID();
  if(!row&&(await c.query("select count(*)::int as n from rise.push_subscriptions where user_id=$1 and (enabled or created_at>now()-interval '1 day')",[actor])).rows[0].n>=20)throw new AuthError(429,"rate_limited",86400);
  const cipher=crypto.seal(subscription,actor,id);
  try{
    if(row){await c.query("update rise.push_subscriptions set enabled=true,endpoint_hash=$3,subscription_cipher=$4,provider_session_id=$5,details=$6,language=$7,version=version+1,updated_at=now() where user_id=$1 and id=$2",[actor,id,digest,cipher,session,v.details,v.language]);await c.query("update rise.push_tests set status='canceled',completed_at=now() where user_id=$1 and installation_id=$2 and status='queued'",[actor,id]);}
    else await c.query("insert into rise.push_subscriptions(id,user_id,installation_hash,provider_session_id,endpoint_hash,subscription_cipher,enabled,details,language) values($1,$2,$3,$4,$5,$6,true,$7,$8)",[id,actor,hash(`${actor}:${token}`),session,digest,cipher,v.details,v.language]);
  }catch(error){if(error&&typeof error==="object"&&"code"in error&&error.code==="23505")throw new AuthError(409,"account_changed");throw error;}
  return pushView(c,actor,token,config);
}
export async function retirePush(c:pg.PoolClient,actor:string,token:string,config:ServerConfig,value:unknown){
  const v=input(value,["accountId","version"]);owner(v,actor);if(!version(v.version))throw new AuthError(422,"invalid_input");
  await lock(c,actor);const row=await select(c,actor,token);
  if(row?.enabled){if(row.version!==v.version)throw new AuthError(409,"account_changed");await retireOwnerPush(c,actor,row.id);}
  return pushView(c,actor,token,config);
}
/** Called while the verified owner is still active, before logout or deletion suppression. */
export async function retireOwnerPush(c:pg.PoolClient,actor:string,id?:string,providerSession?:string){
  await c.query("update rise.push_jobs set status='canceled',lease_token=null,lease_until=null,completed_at=now() where user_id=$1 and status in ('queued','leased') and installation_id in(select id from rise.push_subscriptions where user_id=$1 and ($2::uuid is null or id=$2) and ($3::uuid is null or provider_session_id=$3))",[actor,id??null,providerSession??null]);
  await c.query("update rise.push_tests set status='canceled',completed_at=now() where user_id=$1 and status='queued' and installation_id in(select id from rise.push_subscriptions where user_id=$1 and ($2::uuid is null or id=$2) and ($3::uuid is null or provider_session_id=$3))",[actor,id??null,providerSession??null]);
  await c.query("update rise.push_subscriptions set enabled=false,subscription_cipher=null,endpoint_hash=null,version=version+1,updated_at=now() where user_id=$1 and enabled and ($2::uuid is null or id=$2) and ($3::uuid is null or provider_session_id=$3)",[actor,id??null,providerSession??null]);
}
export async function queuePushTest(c:pg.PoolClient,actor:string,token:string,config:ServerConfig,value:unknown):Promise<PushView>{
  const v=input(value,["accountId","version","requestId"]);owner(v,actor);if(!version(v.version)||!pushUUID(v.requestId)||!config.push)throw new AuthError(422,"invalid_input");
  await lock(c,actor);const row=await select(c,actor,token),session=await sessionId(c);
  if(!row?.enabled||row.provider_session_id!==session)throw new AuthError(409,"account_changed");
  const existing=(await c.query("select installation_id from rise.push_tests where user_id=$1 and id=$2",[actor,v.requestId])).rows[0];
  if(existing){if(existing.installation_id!==row.id)throw new AuthError(409,"account_changed");return pushView(c,actor,token,config);}
  if(row.version!==v.version)throw new AuthError(409,"account_changed");
  const limited=await c.query("select next_test_at>now() as waiting,(select count(*) from rise.push_tests where user_id=$1 and created_at>now()-interval '1 day')>=5 as daily from rise.push_subscriptions where user_id=$1 and id=$2",[actor,row.id]);
  if(limited.rows[0].waiting||limited.rows[0].daily)throw new AuthError(429,"rate_limited",60);
  await c.query("insert into rise.push_tests(id,user_id,installation_id,installation_version) values($1,$2,$3,$4)",[v.requestId,actor,row.id,row.version]);
  await c.query("update rise.push_subscriptions set next_test_at=now()+interval '1 minute' where user_id=$1 and id=$2",[actor,row.id]);
  return pushView(c,actor,token,config);
}
export type {PushTest};
