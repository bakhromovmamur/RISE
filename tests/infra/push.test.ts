import{before,after,test}from"node:test";
import assert from"node:assert/strict";
import{createECDH,randomBytes,randomUUID}from"node:crypto";
import{readFile}from"node:fs/promises";
import{parseEnv}from"node:util";
import{createRequire}from"node:module";
import pg from"pg";
import{authHarness,AuthBrowser}from"../support/auth.ts";
import{PersonalClient}from"../support/personal.ts";
import{pushCrypto}from"../../server/push/crypto.ts";
import{sendPushTests,type PushSenderConfig}from"../../server/push/worker.ts";
import{hash,secrets}from"../../server/auth/crypto.ts";
import{lifecycleDatabase,purgeAccounts,accountPurger}from"../../server/lifecycle/worker.ts";
import{Sessions,AuthError}from"../../server/auth/sessions.ts";
const ece=createRequire(import.meta.url)("http_ece")as{decrypt:(body:Buffer,options:object)=>Buffer};
let h:Awaited<ReturnType<typeof authHarness>>,sender:pg.Pool,config:PushSenderConfig;
before(async()=>{h=await authHarness();const e=parseEnv(await readFile(".rise-infra/test/push.env","utf8"));const url=new URL(e.DATABASE_WORKER_URL!);assert.equal(url.port,"55422");sender=new pg.Pool({connectionString:url.href,max:2});config={installationId:e.INSTALLATION_ID!,dataKey:Buffer.from(e.PUSH_DATA_ENCRYPTION_KEY!,"hex"),vapid:{publicKey:e.VAPID_PUBLIC_KEY!,privateKey:e.VAPID_PRIVATE_KEY!,subject:e.VAPID_SUBJECT!}};});
after(async()=>{await sender?.end();await h?.close();});
function sub(){const ec=createECDH("prime256v1");ec.generateKeys();return{ec,value:{endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}}};}
async function setup(){const b=new AuthBrowser(h),login=await b.login(),owner=login.session.json().account.id;await b.request("push");const subscription=sub();const response=await b.request("push",{accountId:owner,version:0,subscription:subscription.value,details:false,language:"en"});assert.equal(response.statusCode,200,"synthetic_subscription_save");return{b,owner,email:login.email,subscription,view:response.json()};}
const testBody=(s:Awaited<ReturnType<typeof setup>>,id=randomUUID())=>({accountId:s.owner,version:s.view.installation.version,requestId:id});
test("push setup requires verified account, matching installation, Origin and CSRF",async()=>{
 const guest=new AuthBrowser(h);await guest.read();assert.equal((await guest.request("push")).statusCode,401);
 const s=await setup();const payload={accountId:s.owner,version:s.view.installation.version,subscription:s.subscription.value,details:false,language:"en"};
 for(const headers of([{origin:""},{origin:"https://foreign.invalid"},{"x-rise-csrf":""},{"x-rise-csrf":"0".repeat(64)}]as Record<string,string>[]))assert.equal((await s.b.request("push",payload,headers)).statusCode,403);
 assert.equal((await s.b.request("push",{...payload,accountId:randomUUID()})).statusCode,409);
 assert.equal((await s.b.request("push",{...payload,role:"admin"})).statusCode,422);
 const other=new AuthBrowser(h);await other.login();assert.equal((await other.request("push")).json().installation,null);assert.equal((await other.request("push/test",testBody(s))).statusCode,409);
 const before=await s.b.request("personal");assert.equal(before.json().initialized,false,"push_read_never_initializes_personal_profile");
 const serialized=JSON.stringify((await s.b.request("push")).json());assert.ok(!serialized.includes(s.subscription.value.endpoint));assert.ok(!serialized.includes(s.subscription.value.keys.auth));assert.ok(!serialized.includes("csrf"));
 await s.b.request("logout",{});await other.request("logout",{});
});
test("subscriptions are encrypted, replayable, versioned and isolated by owner/session RLS",async()=>{
 const s=await setup(),device=s.view.installation.id,stored=(await h.admin.query("select * from rise.push_subscriptions where id=$1",[device])).rows[0];
 assert.ok(!stored.subscription_cipher.includes(s.subscription.value.endpoint));assert.deepEqual(pushCrypto(config.dataKey,config.installationId).open(stored.subscription_cipher,s.owner,device),s.subscription.value);
 const replay=await s.b.request("push",{accountId:s.owner,version:0,subscription:s.subscription.value,details:false,language:"en"});assert.equal(replay.statusCode,200);assert.equal(replay.json().installation.version,1);
 const changed=await s.b.request("push",{accountId:s.owner,version:1,subscription:s.subscription.value,details:true,language:"ru"});assert.equal(changed.statusCode,200);assert.equal(changed.json().installation.version,2);
 assert.equal((await s.b.request("push/disable",{accountId:s.owner,version:1})).statusCode,409);
 const c=await h.admin.connect();try{await c.query("begin");await c.query("set local role authenticated");await assert.rejects(c.query("select * from rise.push_subscriptions"),{code:"42501"});}finally{await c.query("rollback");c.release();}
 const attacker=new AuthBrowser(h);const identity=await attacker.login();const row=(await h.admin.query("select provider_session_id from rise_private.server_sessions where id_hash=$1",[hash(attacker.cookies.get("rise_test_session")!)])).rows[0];
 const client=await h.store.pool.connect();try{await client.query("begin");await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:identity.session.json().account.id,session_id:row.provider_session_id})]);assert.equal((await client.query("select id from rise.push_subscriptions where id=$1",[device])).rowCount,0);assert.equal((await client.query("update rise.push_subscriptions set details=true where id=$1",[device])).rowCount,0);}finally{await client.query("rollback");client.release();}
 for(const query of["select name from rise.profiles","select provider_cipher from rise_private.server_sessions","select id from auth.users"])await assert.rejects(sender.query(query),{code:"42501"});
 await s.b.request("logout",{});await attacker.request("logout",{});
});
test("test dispatch uses real payload encryption and only explicit bounded requests",async()=>{
 const s=await setup(),id=randomUUID();assert.equal((await s.b.request("push/test",testBody(s,id))).statusCode,200);assert.equal((await s.b.request("push/test",testBody(s,id))).statusCode,200);
 let calls=0;const result=await sendPushTests(sender,config,async details=>{calls++;assert.equal(details.endpoint,s.subscription.value.endpoint);const payload=JSON.parse(ece.decrypt(details.body!,{version:"aes128gcm",privateKey:s.subscription.ec,authSecret:s.subscription.value.keys.auth}).toString());assert.deepEqual(Object.keys(payload).sort(),["version","type","id","owner","installation","generation","expiresAt","language"].sort());assert.equal(payload.id,id);assert.equal(payload.type,"test");assert.ok(Number(details.headers.TTL)<=120);return 201;});assert.equal(result.accepted,1);assert.equal(calls,1);
 await sendPushTests(sender,config,async()=>{throw new Error("duplicate_send");});assert.equal((await s.b.request("push")).json().test.status,"accepted");assert.equal((await s.b.request("push/test",testBody(s))).statusCode,429);
 await s.b.request("logout",{});
});
test("disable cancels queued tests and erases endpoint material; explicit enable can renew",async()=>{
 const s=await setup();await s.b.request("push/test",testBody(s));const disabled=await s.b.request("push/disable",{accountId:s.owner,version:1});assert.equal(disabled.statusCode,200);assert.equal(disabled.json().test.status,"canceled");assert.equal(disabled.json().installation.enabled,false);
 const row=(await h.admin.query("select subscription_cipher,endpoint_hash from rise.push_subscriptions where id=$1",[s.view.installation.id])).rows[0];assert.equal(row.subscription_cipher,null);assert.equal(row.endpoint_hash,null);
 const result=await sendPushTests(sender,config,async()=>{throw new Error("disabled_send");});assert.equal(result.accepted,0);
 assert.equal((await s.b.request("push",{accountId:s.owner,version:disabled.json().installation.version,subscription:s.subscription.value,details:false,language:"uz"})).statusCode,200);
 await s.b.request("logout",{});const retired=(await h.admin.query("select enabled,subscription_cipher from rise.push_subscriptions where id=$1",[s.view.installation.id])).rows[0];assert.equal(retired.enabled,false);assert.equal(retired.subscription_cipher,null);
});
test("expired requests never dispatch and permanent provider failure retires subscription",async()=>{
 const expired=await setup();await expired.b.request("push/test",testBody(expired));await h.admin.query("update rise.push_tests set created_at=now()-interval '4 minutes',expires_at=now()-interval '2 minutes' where user_id=$1",[expired.owner]);let calls=0;await sendPushTests(sender,config,async()=>{calls++;return 201;});assert.equal(calls,0);assert.equal((await expired.b.request("push")).json().test.status,"expired");await expired.b.request("logout",{});
 const s=await setup();await s.b.request("push/test",testBody(s));await sendPushTests(sender,config,async()=>410);const view=(await s.b.request("push")).json();assert.equal(view.installation.enabled,false);assert.equal(view.test.status,"retired");await s.b.request("logout",{});
});
test("revoked provider sessions suppress and retire queued push without outgoing request",async()=>{
 const s=await setup();await s.b.request("push/test",testBody(s));const row=(await h.admin.query("select provider_session_id from rise.push_subscriptions where id=$1",[s.view.installation.id])).rows[0];await h.admin.query("delete from auth.sessions where id=$1",[row.provider_session_id]);let calls=0;await sendPushTests(sender,config,async()=>{calls++;return 201;});assert.equal(calls,0);assert.equal((await h.admin.query("select enabled,subscription_cipher from rise.push_subscriptions where id=$1",[s.view.installation.id])).rows[0].subscription_cipher,null);assert.equal((await s.b.request("push")).statusCode,401);
});
test("two senders and concurrent disable serialize the final dispatch boundary",async()=>{
 const s=await setup();await s.b.request("push/test",testBody(s));let sends=0,release:()=>void=()=>{},started:()=>void=()=>{};const held=new Promise<void>(r=>{release=r;}),entered=new Promise<void>(r=>{started=r;});
 const sending=sendPushTests(sender,config,async()=>{sends++;started();await held;return 201;});await Promise.race([entered,sending.then(()=>{throw new Error("synthetic_sender_did_not_dispatch");})]);
 const disabling=s.b.request("push/disable",{accountId:s.owner,version:1});const second=sendPushTests(sender,config,async()=>{sends++;return 201;});release();await Promise.all([sending,disabling,second]);assert.equal(sends,1);assert.equal((await s.b.request("push")).json().installation.enabled,false);await s.b.request("logout",{});
});
test("account deletion suppresses push, rejects restored backup capabilities and cascades history",async()=>{
 const c=new PersonalClient(h);await c.initialize();await c.browser.request("push");const subscription=sub();const saved=await c.browser.request("push",{accountId:c.owner,version:0,subscription:subscription.value,details:false,language:"en"});assert.equal(saved.statusCode,200);await c.browser.request("push/test",{accountId:c.owner,version:1,requestId:randomUUID()});
 const at=Date.now()+60000;const staged=await c.browser.request("push/plan",{accountId:c.owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:c.revision,takeover:true,allowDuringQuiet:true,timezone:"Asia/Tashkent",events:[{key:randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]});assert.equal(staged.statusCode,200);
 const original=(await h.admin.query("select subscription_cipher,endpoint_hash from rise.push_subscriptions where user_id=$1",[c.owner])).rows[0];
 const sessionHash=hash(c.browser.cookies.get("rise_test_session")!),sessionCipher=(await h.admin.query("select provider_cipher from rise_private.server_sessions where id_hash=$1",[sessionHash])).rows[0].provider_cipher;
 const deletion=await c.browser.request("account/deletion",{accountId:c.owner,requestId:randomUUID(),revision:c.revision,confirm:"delete-account"});assert.equal(deletion.statusCode,200);assert.equal((await h.admin.query("select subscription_cipher from rise.push_subscriptions where user_id=$1",[c.owner])).rows[0].subscription_cipher,null);assert.equal((await c.browser.request("push")).statusCode,401);
 assert.equal((await h.admin.query("select status from rise.push_jobs where user_id=$1",[c.owner])).rows[0].status,"canceled");
 await sendPushTests(sender,config,async()=>{throw new Error("deleted_send");});
 // Simulate replay of stale encrypted installation/session rows while access
 // remains suppressed. The authoritative ledger must win over both restores.
 await h.admin.query("update rise.push_subscriptions set enabled=true,subscription_cipher=$2,endpoint_hash=$3,version=1 where user_id=$1",[c.owner,original.subscription_cipher,original.endpoint_hash]);
 await h.admin.query("update rise.push_tests set status='queued',completed_at=null where user_id=$1",[c.owner]);
 await h.admin.query("update rise_private.server_sessions set revoked_at=null,provider_cipher=$2 where id_hash=$1",[sessionHash,sessionCipher]);
 let replaySends=0;await sendPushTests(sender,config,async()=>{replaySends++;return 201;});assert.equal(replaySends,0);assert.equal((await h.admin.query("select subscription_cipher from rise.push_subscriptions where user_id=$1",[c.owner])).rows[0].subscription_cipher,null);
 const e=parseEnv(await readFile(".rise-infra/test/lifecycle.env","utf8")),worker=lifecycleDatabase({environment:"test",installationId:e.INSTALLATION_ID!,databaseUrl:e.DATABASE_LIFECYCLE_URL!});try{await worker.verify();await purgeAccounts(worker.pool,accountPurger("test",e.SUPABASE_URL!,e.SUPABASE_SECRET_KEY!));}finally{await worker.close();}
 for(const table of["push_subscriptions","push_tests","push_plans","push_plan_receipts","push_jobs"])assert.equal((await h.admin.query(`select count(*)::int as n from rise.${table} where user_id=$1`,[c.owner])).rows[0].n,0);
});
test("same account on a second installation needs fresh consent and first-device logout leaves it intact",async()=>{
 const first=await setup();assert.match(first.email,/^auth-[a-z0-9-]+@example\.invalid$/);
 await h.admin.query("delete from rise_private.auth_limits where subject_hash=$1 and window_seconds=60",[secrets(h.config.sessionKey,h.config.installationId).rate(`send-email:${first.email}`)]);await new Promise(r=>setTimeout(r,1100));
 const second=new AuthBrowser(h);await second.login(first.email);const view=await second.request("push");assert.equal(view.json().installation,null);
 const subscription=sub();const saved=await second.request("push",{accountId:first.owner,version:0,subscription:subscription.value,details:false,language:"uz"});assert.equal(saved.statusCode,200);assert.equal(saved.json().installation.details,false);assert.notEqual(saved.json().installation.id,first.view.installation.id);
 assert.equal((await first.b.request("logout",{})).statusCode,200);assert.equal((await second.request("push")).json().installation.enabled,true);
 // The same browser cookie may later opt into another account, without taking
 // over the former owner's installation or reviving its consent.
 const next=await first.b.login();await first.b.request("push");const other=await first.b.request("push",{accountId:next.session.json().account.id,version:0,subscription:first.subscription.value,details:false,language:"en"});assert.equal(other.statusCode,200);
 assert.equal((await h.admin.query("select enabled from rise.push_subscriptions where id=$1",[first.view.installation.id])).rows[0].enabled,false);
 await first.b.request("logout",{});await second.request("logout",{});
});
test("account export excludes push capabilities and sender cannot restore retired consent",async()=>{
 const c=new PersonalClient(h);await c.initialize();await c.browser.request("push");const subscription=sub();const saved=await c.browser.request("push",{accountId:c.owner,version:0,subscription:subscription.value,details:false,language:"en"});assert.equal(saved.statusCode,200);
 const exported=await c.browser.request("account/export",{accountId:c.owner});assert.equal(exported.statusCode,200);const text=JSON.stringify(exported.json());for(const secret of[subscription.value.endpoint,subscription.value.keys.auth,subscription.value.keys.p256dh])assert.ok(!text.includes(secret),"export_has_no_subscription_material");
 const id=saved.json().installation.id;await c.browser.request("push/disable",{accountId:c.owner,version:1});assert.equal((await sender.query("update rise.push_subscriptions set enabled=true where id=$1",[id])).rowCount,0);
 for(const sql of["select installation_hash from rise.push_subscriptions","update rise.push_subscriptions set details=true","update rise.push_subscriptions set user_id=gen_random_uuid()","update rise.push_tests set expires_at=now()+interval '1 day'"])await assert.rejects(sender.query(sql),{code:"42501"});
 await c.browser.request("logout",{});
});
test("authorization loss wins over a failed command after deletion and partial work rolls back",async()=>{
 const c=new PersonalClient(h);await c.initialize();assert.match(c.email,/^auth-[a-z0-9-]+@example\.invalid$/);await h.admin.query("delete from rise_private.auth_limits where subject_hash=$1 and window_seconds=60",[secrets(h.config.sessionKey,h.config.installationId).rate(`send-email:${c.email}`)]);await new Promise(r=>setTimeout(r,1100));
 const second=new AuthBrowser(h);await second.login(c.email);const sessions=new Sessions(h.config,h.store.pool);
 let release:()=>void=()=>{},started:()=>void=()=>{};const held=new Promise<void>(r=>{release=r;}),entered=new Promise<void>(r=>{started=r;});
 const pending=sessions.asActor({session:second.cookies.get("rise_test_session")!,context:second.cookies.get("rise_test_context")!,csrf:second.csrf,ip:second.ip},true,async(client,actor)=>{await client.query("update rise.profiles set name='Uncommitted synthetic name' where owner_id=$1",[actor]);started();await held;throw new AuthError(409,"revision_conflict");}).catch((error:unknown)=>error);
 await Promise.race([entered,pending.then(()=>{throw new Error("synthetic_actor_did_not_enter");})]);
 let status=0;try{status=(await c.browser.request("account/deletion",{accountId:c.owner,requestId:randomUUID(),revision:c.revision,confirm:"delete-account"})).statusCode;}finally{release();}
 const failure=await pending;assert.equal(status,200);assert.ok(failure instanceof AuthError);assert.equal(failure.status,401);assert.equal((await h.admin.query("select name from rise.profiles where owner_id=$1",[c.owner])).rows[0].name,"Synthetic account");
});
