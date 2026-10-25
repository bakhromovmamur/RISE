import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";
import { createECDH,randomUUID } from "node:crypto";
import { tickPushSender,stopPushSender } from "../../server/push/runtime.ts";
import { pushUUID } from "../../src/contracts/push.ts";
async function main(){
  const [action,environment]=process.argv.slice(2);
  if(!["run","watch"].includes(action)||!["local","test"].includes(environment))throw new Error("usage_push_run_watch_local_or_test");
  const raw=parseEnv(await readFile(`.rise-infra/${environment}/push.env`,"utf8"));
  if(Object.keys(raw).some(key=>!["DEPLOY_ENV","INSTALLATION_ID","DATABASE_WORKER_URL","PUSH_DATA_ENCRYPTION_KEY","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","VAPID_SUBJECT"].includes(key))||["SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","DATABASE_LIFECYCLE_URL","SESSION_ENCRYPTION_KEY"].some(key=>process.env[key]))throw new Error("isolated_push_configuration_required");
  const required=(key:string)=>{const value=raw[key];if(!value)throw new Error("missing_push_configuration");return value;};
  const installationId=required("INSTALLATION_ID"),dataKey=required("PUSH_DATA_ENCRYPTION_KEY"),publicKey=required("VAPID_PUBLIC_KEY"),privateKey=required("VAPID_PRIVATE_KEY"),subject=required("VAPID_SUBJECT"),url=new URL(required("DATABASE_WORKER_URL"));
  if(required("DEPLOY_ENV")!==environment||url.hostname!=="127.0.0.1"||url.port!==String(environment==="local"?55322:55422)||url.username!=="rise_worker_login"||url.pathname!=="/postgres"||url.search||url.hash||!pushUUID(installationId)||!/^[0-9a-f]{64}$/.test(dataKey)||!/^[\w-]{43}$/.test(privateKey)||!/^[\w-]{87}$/.test(publicKey)||subject!=="https://habit.saraftech.com"||raw.SUPABASE_SECRET_KEY||raw.SUPABASE_SERVICE_ROLE_KEY)throw new Error("isolated_push_configuration_required");
  const ec=createECDH("prime256v1");ec.setPrivateKey(Buffer.from(privateKey,"base64url"));if(ec.getPublicKey().toString("base64url")!==publicKey)throw new Error("push_key_pair_mismatch");
  const pool=new pg.Pool({connectionString:url.href,max:5,connectionTimeoutMillis:3000,statement_timeout:3000});
  const senderId=randomUUID();
  let stopped=false,verified=false;const stop=()=>{stopped=true;};process.once("SIGTERM",stop);process.once("SIGINT",stop);
  try{const role=(await pool.query(`select rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,
    pg_has_role(current_user,'rise_worker','member') as member,
    (select count(*) from pg_auth_members where member=(select oid from pg_roles where rolname=current_user))::int as memberships,
    has_table_privilege(current_user,'rise.profiles','select') as profiles,
    has_column_privilege(current_user,'rise_private.server_sessions','provider_cipher','select') as tokens,
    has_column_privilege(current_user,'rise.push_subscriptions','details','update') as consent,
    has_table_privilege(current_user,'rise.push_subscriptions','insert') as insert
    from pg_roles where rolname=current_user`)).rows[0];
    if(!role?.member||role.memberships!==1||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||role.rolreplication||role.profiles||role.tokens||role.consent||role.insert)throw new Error("unsafe_push_role");
    const id=(await pool.query("select environment,installation_id from rise_private.environment where singleton")).rows[0];if(id?.environment!==environment||id.installation_id!==installationId)throw new Error("push_installation_mismatch");
    verified=true;
    do{const result=await tickPushSender(pool,senderId,{installationId:installationId,dataKey:Buffer.from(dataKey,"hex"),vapid:{publicKey:publicKey,privateKey:privateKey,subject:subject}});if(action==="run"||[...Object.values(result.reminders),...Object.values(result.tests),...Object.values(result.groups)].some(Boolean))process.stdout.write(`${JSON.stringify({event:"push_tick",...result})}\n`);
      const attempted=Object.entries(result.reminders).filter(([status])=>status!=='deferred').reduce((n,[,count])=>n+count,0);
      if(action==="watch"&&!stopped&&attempted<4)await new Promise(r=>setTimeout(r,1000));
    }while(action==="watch"&&!stopped);
  }finally{try{if(verified)await stopPushSender(pool,senderId);}finally{await pool.end();}}
}
main().catch(()=>{process.stderr.write("Local push sender failed; inspect configuration without publishing secrets.\n");process.exitCode=1;});
