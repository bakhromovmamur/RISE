import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import { loadConfig } from "../../server/config.ts";
import { createApp } from "../../server/app.ts";
import { database } from "../../server/database.ts";
import { Sessions } from "../../server/auth/sessions.ts";
import { protectedSessionRoute,sessionInput } from "../../server/auth/routes.ts";
import { AuthError } from "../../server/auth/sessions.ts";
import { paths } from "./local.ts";

// Test-only entry, separate from production startup; freezes the build before listening on 4191.
const snapshot = await mkdtemp(join(tmpdir(), "rise-bff-build-"));
const env = parseEnv(await readFile(resolve(paths("test").directory, "server.env"), "utf8"));
const config = loadConfig({ ...env, STATIC_DIRECTORY: snapshot });
if (config.environment !== "test" || config.origin !== "http://127.0.0.1:4191") throw new Error("test_environment_required");
const store = database(config);
let app: Awaited<ReturnType<typeof createApp>> | undefined;
async function cleanup() { await app?.close(); await store.close(); await rm(snapshot, { recursive: true, force: true }); }
try {
  const before = await readFile(resolve("dist/index.html"));
  await cp(resolve("dist"), snapshot, { recursive: true });
  if (!before.equals(await readFile(resolve("dist/index.html"))) || !before.equals(await readFile(join(snapshot, "index.html")))) throw new Error("build_changed_during_snapshot");
  await store.verify();
  const sessions=new Sessions(config,store.pool);
  app = await createApp(config, store.verify, undefined, sessions);
  // Firefox offline emulation bypasses workers on navigation. Disconnect this test server instead.
  let disconnected = false;
  app.addHook("onRequest", async (request, reply) => {
    if (disconnected && !request.url.startsWith("/__infra_test__/network")) { reply.hijack(); request.raw.socket.destroy(); }
  });
  app.post("/__infra_test__/network", async request => {
    disconnected = new URL(request.url, config.origin).searchParams.get("offline") === "true";
    return { disconnected };
  });
  // Faults live in this test-only server: WebKit workers can bypass page routes.
  // Controls require the same real session/Origin/CSRF checks as ordinary writes.
  const faults=new Map<string,{mode:"online"|"offline"|"lost-once";discardedReplies:number}>();
  const ownerOf=(body:unknown)=>body&&typeof body==="object"&&"accountId"in body&&typeof body.accountId==="string"?body.accountId:null;
  const groupFaults=new Map<string,{mode:'online'|'offline'|'lost-once';discardedReplies:number}>();
  app.post('/__infra_test__/group-network',protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),true,async(_client,actor)=>{
    const value=request.body;if(!value||typeof value!=='object'||!('mode'in value)||!['online','offline','lost-once'].includes(String(value.mode))||Object.keys(value).length!==1)throw new AuthError(422,'invalid_command');
    const mode=value.mode as 'online'|'offline'|'lost-once';groupFaults.set(actor,{mode,discardedReplies:0});return {mode};
  }),true,'synthetic-group'));
  const groupRequest=(url:string)=>url==='/api/v1/groups/commands'||/^\/api\/v1\/groups\/[0-9a-f-]{36}\/export$/.test(url);
  app.addHook('preHandler',async(request,reply)=>{if(groupRequest(request.url)&&groupFaults.get(ownerOf(request.body)??'')?.mode==='offline'){reply.hijack();request.raw.socket.destroy();}});
  app.addHook('onSend',async(request,reply,payload)=>{const fault=groupRequest(request.url)?groupFaults.get(ownerOf(request.body)??''):undefined;if(fault?.mode==='lost-once'&&reply.statusCode===200){fault.mode='offline';fault.discardedReplies++;reply.hijack();request.raw.socket.destroy();}return payload;});
  app.post("/__infra_test__/sync-network",protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),true,async(_client,actor)=>{
    const value=request.body;if(!value||typeof value!=="object"||!("mode"in value)||!["online","offline","lost-once"].includes(String(value.mode))||Object.keys(value).length!==1)throw new AuthError(422,"invalid_command");
    const mode=value.mode as "online"|"offline"|"lost-once";faults.set(actor,{mode,discardedReplies:0});return{mode};
  }),true,"synthetic-sync"));
  app.get("/__infra_test__/sync-network",protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),false,async(_client,actor)=>faults.get(actor)??{mode:"online",discardedReplies:0}),false,"synthetic-sync"));
  const pushFaults=new Map<string,{mode:'online'|'offline'|'lost-once';discardedReplies:number}>();
  app.post('/__infra_test__/push-network',protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),true,async(_client,actor)=>{
    const v=request.body;if(!v||typeof v!=='object'||!('mode'in v)||!['online','offline','lost-once'].includes(String(v.mode))||Object.keys(v).length!==1)throw new AuthError(422,'invalid_command');
    const mode=v.mode as 'online'|'offline'|'lost-once';pushFaults.set(actor,{mode,discardedReplies:0});return{mode};
  }),true,'synthetic-push'));
  app.get('/__infra_test__/push-network',protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),false,async(_client,actor)=>pushFaults.get(actor)??{mode:'online',discardedReplies:0}),false,'synthetic-push'));
  app.addHook('preHandler',async(request,reply)=>{if(request.url==='/api/v1/push/cancel-plan'&&pushFaults.get(ownerOf(request.body)??'')?.mode==='offline'){reply.hijack();request.raw.socket.destroy();}});
  app.addHook('onSend',async(request,reply,payload)=>{
    const fault=request.url==='/api/v1/push/cancel-plan'?pushFaults.get(ownerOf(request.body)??''):undefined;
    // Stay disconnected after the lost reply so a test can replace/prune the
    // plan before retrying. Only this verified synthetic owner is affected.
    if(fault?.mode==='lost-once'&&reply.statusCode===200){fault.mode='offline';fault.discardedReplies++;reply.hijack();request.raw.socket.destroy();}
    return payload;
  });
  app.addHook("preHandler",async(request,reply)=>{if(request.url==="/api/v1/sync/commands"&&faults.get(ownerOf(request.body)??"")?.mode==="offline"){reply.hijack();request.raw.socket.destroy();}});
  app.addHook("onSend",async(request,reply,payload)=>{
    const fault=request.url==="/api/v1/sync/commands"?faults.get(ownerOf(request.body)??""):undefined;
    if(fault?.mode==="lost-once"&&reply.statusCode===200){fault.mode="online";fault.discardedReplies++;reply.hijack();request.raw.socket.destroy();}
    return payload;
  });
  const lostDeletionReplies=new Set<string>();
  app.post("/__infra_test__/deletion-lost-reply",protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),true,async(_client,actor)=>{lostDeletionReplies.add(actor);return{armed:true};}),true));
  app.addHook("onSend",async(request,reply,payload)=>{
    const owner=request.url==="/api/v1/account/deletion"?ownerOf(request.body):null;
    if(owner&&lostDeletionReplies.has(owner)&&reply.statusCode===200){lostDeletionReplies.delete(owner);reply.hijack();request.raw.socket.destroy();}
    return payload;
  });
  await app.listen({ host: "127.0.0.1", port: 4191 });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await cleanup(); process.exit(0); };
  process.once("SIGTERM", () => { void stop(); }); process.once("SIGINT", () => { void stop(); });
  process.stdout.write("RISE test backend ready on isolated port 4191.\n");
} catch { await cleanup(); throw new Error("backend_test_start_failed"); }
