import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { paths, privateFile } from "./local.ts";
import { lifecycleDatabase, purgeAccounts,accountPurger } from "../../server/lifecycle/worker.ts";
import { randomUUID } from "node:crypto";
import { parseDeletionLedger } from "../../src/contracts/deletionLedger.ts";
import { setTimeout as delay } from "node:timers/promises";

async function main(){
  const [action,environment,file]=process.argv.slice(2);
  if(!["run","watch","ledger","replay"].includes(action)||!["local","test"].includes(environment)||!["run","watch"].includes(action)&&!file)throw new Error("usage_lifecycle_run_watch_ledger_replay_local_test_optional_file");
  const env=parseEnv(await readFile(resolve(paths(environment as "local"|"test").directory,"lifecycle.env"),"utf8"));
  if(env.DEPLOY_ENV!==environment||!env.DATABASE_LIFECYCLE_URL||!env.INSTALLATION_ID)throw new Error("invalid_lifecycle_environment");
  const store=lifecycleDatabase({environment:environment as "local"|"test",installationId:env.INSTALLATION_ID,databaseUrl:env.DATABASE_LIFECYCLE_URL});
  try{await store.verify();
    if(action==="ledger"){
      const entries=(await store.pool.query("select user_id as id,deleted_at as \"deletedAt\" from rise_private.deletion_ledger order by deleted_at,user_id")).rows;
      const raw=JSON.stringify({format:"rise.deletion-ledger",version:1,environment,installationId:env.INSTALLATION_ID,entries});
      parseDeletionLedger(raw,environment as "local"|"test",env.INSTALLATION_ID);
      await privateFile(resolve(file),raw);
      process.stdout.write(`Deletion ledger saved privately (${entries.length} entries).\n`);
    }else if(action==="replay"){
      const {entries}=parseDeletionLedger(await readFile(resolve(file),"utf8"),environment as "local"|"test",env.INSTALLATION_ID);
      const client=await store.pool.connect();try{await client.query("begin");for(const entry of entries){
        await client.query("insert into rise_private.deletion_ledger(user_id,deleted_at) values($1,$2) on conflict(user_id) do update set deleted_at=least(rise_private.deletion_ledger.deleted_at,excluded.deleted_at)",[entry.id,entry.deletedAt]);
        await client.query("insert into rise_private.deletion_jobs(user_id,request_id,requested_at,purge_by) values($1,$2,$3,$3::timestamptz+interval '7 days') on conflict(user_id) do update set purged_at=null,next_attempt_at=now()",[entry.id,randomUUID(),entry.deletedAt]);
        await client.query("insert into rise_private.deleted_sessions(id_hash,context_hash,user_id,deleted_at) select id_hash,context_hash,user_id,$2 from rise_private.server_sessions where user_id=$1 on conflict(id_hash) do nothing",[entry.id,entry.deletedAt]);
      }await client.query("commit");}catch(error){await client.query("rollback");throw error;}finally{client.release();}
      process.stdout.write(`Deletion suppression replayed (${entries.length} entries). Keep access disabled until purge and recovery checks pass.\n`);
    }else{
      const purge=accountPurger(environment as "local"|"test",env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!);
      let stopping=false;const abort=new AbortController(),stop=()=>{stopping=true;abort.abort();};
      process.once("SIGINT",stop);process.once("SIGTERM",stop);
      try{do{
        const result=await purgeAccounts(store.pool,purge);if(action==="run"||result.completed||result.failed)process.stdout.write(JSON.stringify(result)+"\n");
        if(action!=="watch"||stopping)break;
        await delay(5000,undefined,{signal:abort.signal}).catch(()=>{});
      }while(!stopping);}finally{process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);}
    }
  }finally{await store.close();}
}
main().catch(()=>{process.stderr.write("Lifecycle operation failed. Check private configuration and database readiness; no credentials or records are logged.\n");process.exitCode=1;});
