import pg from "pg";

export interface LifecycleIdentity { environment:"local"|"test"; installationId:string; databaseUrl:string }
/** Restricted job/ledger connection, never a BFF or journey reader. */
export function lifecycleDatabase(identity:LifecycleIdentity){
  const url=new URL(identity.databaseUrl),port=identity.environment==="local"?55322:55422;
  if(!["local","test"].includes(identity.environment)||url.hostname!=="127.0.0.1"||url.port!==String(port)||url.username!=="rise_lifecycle_login"||url.pathname!=="/postgres"||url.search||url.hash||decodeURIComponent(url.password).length<24||!/^[a-f0-9-]{36}$/.test(identity.installationId))throw new Error("isolated_lifecycle_configuration_required");
  const pool=new pg.Pool({connectionString:url.href,max:2,connectionTimeoutMillis:3000,statement_timeout:10000,query_timeout:12000,application_name:`rise-lifecycle-${identity.environment}`});
  pool.on("error",()=>{});
  async function verify(){
    const {rows}=await pool.query(`select e.environment,e.installation_id::text,e.provider_project_ref,current_user as role,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
      (select count(*) from pg_auth_members m where m.member=r.oid) as memberships,
      pg_has_role(current_user,'rise_lifecycle','member') as lifecycle,pg_has_role(current_user,'rise_bff','member') as bff,pg_has_role(current_user,'rise_worker','member') as worker,
      has_schema_privilege(current_user,'rise_private','create') as schema_writer,
      has_table_privilege(current_user,'rise.profiles','SELECT') as journey_reader
      from rise_private.environment e cross join pg_roles r where e.singleton and r.rolname=current_user`);
    const r=rows[0];if(rows.length!==1||r.environment!==identity.environment||r.installation_id!==identity.installationId||r.provider_project_ref!==`rise-${identity.environment}`||r.role!=="rise_lifecycle_login"||!r.lifecycle||r.bff||r.worker||r.memberships!=="1"||r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolreplication||r.schema_writer||r.journey_reader)throw new Error("lifecycle_identity_mismatch");
  }
  return {pool,verify,close:()=>pool.end()};
}
/** Each job holds a transaction lock. Provider purge is idempotent; a crash after
 * deletion but before completion retries the same subject and confirms absence. */
export async function purgeAccounts(pool:pg.Pool,purge:(subject:string)=>Promise<void>,maximum=20){
  if(!Number.isInteger(maximum)||maximum<1||maximum>100)throw new Error("invalid_purge_limit");
  let completed=0,failed=0;
  for(let i=0;i<maximum;i++){
    const client=await pool.connect();let owner:string|null=null;
    try{
      await client.query("begin");
      const result=await client.query("select user_id from rise_private.deletion_jobs where purged_at is null and next_attempt_at<=now() order by next_attempt_at,user_id limit 1 for update skip locked");
      if(!result.rowCount){await client.query("commit");break;}
      owner=result.rows[0].user_id;
      const ready=(await client.query("select rise_private.deletion_integrations_ready() as ready")).rows[0].ready;
      if(!ready){await client.query("update rise_private.deletion_jobs set attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',last_error='integration_pending' where user_id=$1",[owner]);failed++;}
      else{
        // Commit terminal group cleanup before calling managed Auth: holding its
        // row locks across the provider's separate DELETE connection deadlocks.
        // The retained ledger already denies all new owner/session writes.
        await pool.query('select rise_private.purge_group_identity($1)',[owner]);
        await purge(owner!);
        await client.query("delete from rise_private.auth_contexts where id_hash in(select context_hash from rise_private.deleted_sessions where user_id=$1)",[owner]);
        await client.query("update rise_private.deletion_jobs set purged_at=now(),attempts=attempts+1,last_error=null where user_id=$1",[owner]);completed++;
      }
      await client.query("commit");
    }catch{
      await client.query("rollback");failed++;
      if(owner)await client.query("update rise_private.deletion_jobs set attempts=attempts+1,last_error='purge_failed',next_attempt_at=now()+least(3600,30*(attempts+1))*interval '1 second' where user_id=$1 and purged_at is null",[owner]);
    }finally{client.release();}
  }
  const client=await pool.connect();
  try{await client.query("begin");
    await client.query("delete from rise_private.deleted_sessions where user_id in (select j.user_id from rise_private.deletion_jobs j join rise_private.deletion_ledger l using(user_id) where j.purged_at<now()-interval '35 days')");
    await client.query("with expired as (delete from rise_private.deletion_jobs where purged_at<now()-interval '35 days' returning user_id) delete from rise_private.deletion_ledger where user_id in(select user_id from expired)");
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  return {completed,failed};
}

/** The only provider-administration boundary. Local loopback only; the secret is
 * process memory/protected configuration and never enters the BFF or browser. */
export function accountPurger(environment:"local"|"test",providerUrl:string,secret:string){
  const expected=`http://127.0.0.1:${environment==="local"?55321:55421}`;
  if(!["local","test"].includes(environment)||providerUrl!==expected||!/^sb_secret_[\w-]{43}$/.test(secret))throw new Error("isolated_account_purger_required");
  return async(subject:string)=>{
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(subject))throw new Error("invalid_purge_subject");
    const response=await fetch(`${expected}/auth/v1/admin/users/${subject}`,{method:"DELETE",redirect:"error",headers:{apikey:secret,"Content-Type":"application/json"},body:JSON.stringify({should_soft_delete:false}),signal:AbortSignal.timeout(5000)});
    const raw=await response.text();if(raw.length>65536)throw new Error("purge_failed");
    let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error("purge_failed");}
    if(!value||typeof value!=="object")throw new Error("purge_failed");
    const absent=(status:number,body:object)=>status===404&&("error_code"in body&&body.error_code==="user_not_found"||"code"in body&&body.code==="user_not_found");
    if(absent(response.status,value))return;
    if(response.ok){
      const check=await fetch(`${expected}/auth/v1/admin/users/${subject}`,{headers:{apikey:secret},redirect:"error",signal:AbortSignal.timeout(5000)});
      const body:unknown=await check.json();if(body&&typeof body==="object"&&absent(check.status,body))return;
    }
    throw new Error("purge_failed");
  };
}
