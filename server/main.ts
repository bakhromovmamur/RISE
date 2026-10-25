import { localRuntimeRelease } from "./operations/release.ts";
import { resolve } from "node:path";
import { writePrivateJson } from "./operations/files.ts";
import { loadConfig, ConfigurationError } from "./config.ts";
import { database } from "./database.ts";
import { createApp } from "./app.ts";
import { Sessions } from "./auth/sessions.ts";

const log = (entry: object) => process.stdout.write(`${JSON.stringify(entry)}\n`);
try {
  const config = loadConfig(process.env);
  if(config.environment==="local"||config.environment==="test")config.release=await localRuntimeRelease();
  const store = database(config);
  try {
    await store.verify(); // A wrong database/Auth project never starts accepting requests.
    const app = await createApp(config, store.verify, log, new Sessions(config, store.pool));
    await app.listen({ host: config.host, port: config.port });
    let writing:Promise<void>|null=null;
    const snapshot=()=>{
      if(writing||!["local","test"].includes(config.environment))return;
      writing=writePrivateJson(resolve(".rise-infra",config.environment,"operations",`bff-${config.port}.json`),app.operationsSnapshot())
        .catch(()=>{log({event:"diagnostics_unavailable",code:"snapshot_write_failed"});}).finally(()=>{writing=null;});
    };
    snapshot();const monitor=setInterval(snapshot,5000);monitor.unref();
    log({ event: "started", environment: config.environment, release: config.release });
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; clearInterval(monitor); await writing; await app.close(); await store.close(); };
    process.on("SIGTERM", () => { void stop(); }); process.on("SIGINT", () => { void stop(); });
  } catch { await store.close(); throw new Error("backend_not_ready"); }
} catch (error) {
  log({ event: "startup_failed", code: error instanceof ConfigurationError ? error.code : "backend_not_ready" }); process.exitCode = 1;
}
