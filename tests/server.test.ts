import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink, stat, readFile, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, ConfigurationError } from "../server/config.ts";
import { createApp } from "../server/app.ts";
import { validatePublicEnvironment } from "../scripts/build-boundary.ts";
import { backendBoundary } from "../scripts/build-boundary.ts";
import { build } from "vite";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyEmailTemplate } from "../scripts/infra/email-templates.ts";

test("repeated local setup preserves mounted email template identity and updates its content", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rise-email-template-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, "source.html"), target = join(directory, "templates/code.html"), mounted = join(directory, "mounted.html");
  await writeFile(source, "synthetic first code template"); await copyEmailTemplate(source, target);
  await link(target, mounted); const before = await stat(target);
  await copyEmailTemplate(source, target);
  assert.equal((await stat(target)).mtimeMs, before.mtimeMs);
  await writeFile(source, "synthetic replacement code template"); await copyEmailTemplate(source, target);
  assert.equal((await stat(target)).ino, before.ino);
  assert.equal(await readFile(mounted, "utf8"), "synthetic replacement code template");
});

function vars(): NodeJS.ProcessEnv {
  return { DEPLOY_ENV: "test", APP_ORIGIN: "http://127.0.0.1:4191", SUPABASE_PROJECT_REF: "rise-test", SUPABASE_URL: "http://127.0.0.1:55421", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic-0000000000000000", DATABASE_URL: `postgresql://rise_bff_login:${"a".repeat(64)}@127.0.0.1:55422/postgres`, INSTALLATION_ID: "f4f7f748-cffc-40b7-8b01-bb887b6e9ce9", RELEASE_ID: "synthetic-test", SESSION_ENCRYPTION_KEY: "b".repeat(64) };
}
test("server write pause rejects queued mutations without changing read/session/logout authorization", async t => {
  assert.equal(loadConfig(vars()).writesEnabled,true);
  for(const value of ["", "1", "yes"])assert.throws(()=>loadConfig({...vars(),RISE_WRITES_ENABLED:value}),ConfigurationError);
  const config=loadConfig({...vars(),RISE_WRITES_ENABLED:"false"});
  const app=await createApp(config,async()=>{});t.after(()=>app.close());
  const headers={host:"127.0.0.1:4191",origin:"http://127.0.0.1:4191"};
  assert.equal((await app.inject({url:"/api/v1/health/ready",headers})).statusCode,200);
  const paused=await app.inject({method:"POST",url:"/api/v1/sync/commands?retry=1",headers,payload:{synthetic:true}});
  assert.equal(paused.statusCode,503);assert.equal(paused.json().error.retryable,true);
  // No session adapter here: the pause must defer to the ordinary logout route/authorization.
  assert.equal((await app.inject({method:"POST",url:"/api/v1/logout",headers,payload:{}})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:"/api/v1/sync/commands",headers:{...headers,origin:"https://unrelated.invalid"}})).statusCode,403);
});

test("rollback serves previous fingerprinted chunks but never previous HTML or private files",async t=>{
  const directory=await mkdtemp(join(tmpdir(),"rise-previous-assets-"));t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,"assets"));await writeFile(join(directory,"assets/old-abcdefgh.js"),"old chunk");
  await writeFile(join(directory,"index.html"),"old HTML");await writeFile(join(directory,"favicon.svg"),"old icon");
  const config=loadConfig(vars());config.previousStaticDirectory=directory;
  const app=await createApp(config,async()=>{});t.after(()=>app.close());const headers={host:"127.0.0.1:4191"};
  assert.equal((await app.inject({url:"/assets/old-abcdefgh.js",headers})).body,"old chunk");
  assert.notEqual((await app.inject({url:"/",headers})).body,"old HTML");
  assert.equal((await app.inject({url:"/server/config.ts",headers})).statusCode,404);
});
test("backend config accepts only matching environment/provider/database origins and restricted identities", () => {
  const config = loadConfig(vars()); assert.equal(config.database.ssl, false); assert.equal(config.database.max, 5);
  const changes = [
    { DEPLOY_ENV: "review" }, { APP_ORIGIN: "http://127.0.0.1:4173" }, { APP_ORIGIN: "http://127.0.0.1:4190" },
    { SUPABASE_URL: "http://127.0.0.1:55321" }, { SUPABASE_PROJECT_REF: "rise-local" }, { SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-log-this-secret" },
    { DATABASE_URL: `postgresql://postgres:${"a".repeat(64)}@127.0.0.1:55422/postgres` },
    { DATABASE_URL: `postgresql://rise_bff_login:${"a".repeat(64)}@127.0.0.1:55322/postgres` },
    { DATABASE_URL: `postgresql://rise_bff_login:${"a".repeat(64)}@127.0.0.1:55422/postgres?sslmode=disable` },
    { INSTALLATION_ID: "" }, { PORT: "0" }, { PORT: "4190" }, { BIND_HOST: "192.168.1.1" }, { BIND_HOST: "0.0.0.0" },
    { SESSION_ENCRYPTION_KEY: "" }, { SESSION_ENCRYPTION_KEY: "short" }, { SESSION_ENCRYPTION_KEY: "G".repeat(64) },
    ...["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "DATABASE_MIGRATION_URL", "DATABASE_WORKER_URL", "DATABASE_LIFECYCLE_URL", "DATABASE_OPS_URL", "SUPABASE_JWT_SECRET"].map(name => ({ [name]: "do-not-log-this-secret" })),
  ];
  for (const change of changes) assert.throws(() => loadConfig({ ...vars(), ...change }), error => error instanceof ConfigurationError && !error.message.includes("do-not-log"));
});
test("production TLS and project binding cannot be disabled by connection string options", () => {
  const project = "abcdefghijklmnopqrst";
  const env = { ...vars(), DEPLOY_ENV: "production", APP_ORIGIN: "https://habit.saraftech.com", SUPABASE_PROJECT_REF: project, SUPABASE_URL: `https://${project}.supabase.co`, DATABASE_URL: `postgresql://rise_bff_login.${project}:${"a".repeat(64)}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres` };
  assert.deepEqual(loadConfig(env).database.ssl, { rejectUnauthorized: true });
  for (const change of [{ APP_ORIGIN: "https://staging.saraftech.com" }, { SUPABASE_URL: "https://wrong-project.supabase.co" }, { DATABASE_URL: env.DATABASE_URL.replace(project, "uvwxyzabcdefghijklmn") }, { DEPLOY_ENV: "staging" }]) assert.throws(() => loadConfig({ ...env, ...change }));
});
test("local browser entry keeps installation identity and rejects arbitrary origin aliases", async t => {
  const env = { ...vars(), DEPLOY_ENV: "local", APP_ORIGIN: "http://127.0.0.1:4190", PORT: "4190", SUPABASE_PROJECT_REF: "rise-local", SUPABASE_URL: "http://127.0.0.1:55321", DATABASE_URL: vars().DATABASE_URL!.replace("55422", "55322") };
  const original = loadConfig(env);
  const config = loadConfig({ ...env, LOCAL_BROWSER_ORIGIN: "http://127.0.0.1:4192" });
  assert.equal(config.origin, "http://127.0.0.1:4192");
  assert.equal(config.port, 4192);
  assert.equal(config.installationOrigin, original.origin);
  assert.equal(config.installationId, original.installationId);
  assert.deepEqual(config.database, original.database);
  assert.deepEqual(config.sessionKey, original.sessionKey);
  for (const alias of ["http://127.0.0.1:4191", "http://127.0.0.1:4173", "http://localhost:4192", "https://habit.saraftech.com", "http://127.0.0.1:4192/path", ""]) {
    assert.throws(() => loadConfig({ ...env, LOCAL_BROWSER_ORIGIN: alias }), ConfigurationError);
  }
  assert.throws(() => loadConfig({ ...vars(), LOCAL_BROWSER_ORIGIN: config.origin }), ConfigurationError);
  const app = await createApp(config, async () => {});
  t.after(() => app.close());
  assert.equal((await app.inject({ url: "/api/v1/health/live", headers: { host: "127.0.0.1:4192" } })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/v1/health/live", headers: { host: "127.0.0.1:4190" } })).statusCode, 403);
  assert.equal((await app.inject({ url: "/api/v1/health/live", headers: { host: "127.0.0.1:4192", origin: original.origin } })).statusCode, 403);
});
test("public build variables use an allowlist and errors contain no values", () => {
  validatePublicEnvironment({ VITE_API_BASE: "/api/v1", VITE_BUILD_MODE: "production" }, "production");
  for (const name of ["VITE_DATABASE_URL", "VITE_SUPABASE_SECRET_KEY", "VITE_NEW_KEY", "VITE_API_BASE"]) assert.throws(() => validatePublicEnvironment({ [name]: "sensitive-value" }, "production"), { message: "unapproved_public_build_variable" });
});
test("local Docker adapter binds only its labeled infrastructure containers to loopback", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rise-docker-adapter-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fake = join(directory, "docker");
  await writeFile(fake, '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\n', { mode: 0o700 });
  const exec = promisify(execFile), adapter = "scripts/infra/docker-loopback.mjs";
  const options = { env: { ...process.env, RISE_DOCKER_BINARY: fake, RISE_DOCKER_PROJECT: "rise-test-synthetic" } };
  const args = ["create", "--label", "com.supabase.cli.project=rise-test-synthetic", "-p", "55422:5432", "synthetic"];
  const bound = JSON.parse((await exec(process.execPath, [adapter, ...args], options)).stdout);
  assert.equal(bound[4], "127.0.0.1:55422:5432");
  const unrelated = args.map(value => value.replace("rise-test-synthetic", "unrelated"));
  assert.deepEqual(JSON.parse((await exec(process.execPath, [adapter, ...unrelated], options)).stdout), unrelated);
  await assert.rejects(exec(process.execPath, [adapter, ...args.map(value => value === "55422:5432" ? "0.0.0.0:55422:5432" : value)], options));
});
test("real browser builds reject backend imports and exposed credentials", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rise-build-boundary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = join(directory, "entry.ts");
  await writeFile(entry, `import { loadConfig } from ${JSON.stringify(resolve("server/config.ts"))}; console.log(loadConfig({}));`);
  await assert.rejects(build({ root: directory, configFile: false, logLevel: "silent", plugins: [backendBoundary()], build: { write: false, lib: { entry, formats: ["es"] } } }), /Backend\/private configuration cannot enter/);
  const canary = "private-canary-never-printed";
  try {
    await promisify(execFile)(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { env: { ...process.env, VITE_DATABASE_URL: canary }, timeout: 20000 });
    assert.fail("Build accepted a privileged public environment variable");
  } catch (error) {
    assert.ok(error && typeof error === "object" && "stderr" in error && "code" in error && error.code === 1);
    assert.ok(String(error.stderr).includes("unapproved_public_build_variable"));
    assert.equal(String(error.stderr).includes(canary), false);
  }
});
test("BFF serves a production shell with a narrow public-file boundary and safe health/log responses", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rise-bff-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const html = '<html><head><meta name="rise-build" content="production"></head><body>RISE</body></html>';
  await writeFile(join(directory, "index.html"), html); await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "assets/app-abcdefgh.js"), "console.log('synthetic');");
  await writeFile(join(directory, ".env"), "PRIVATE=do-not-log");
  await symlink(join(directory, ".env"), join(directory, "assets/leak-abcdefgh.js"));
  await writeFile(join(directory, "notifications-sw.js"), "// worker");
  let ready = true; const logs: object[] = [];
  const app = await createApp({ ...loadConfig(vars()), staticDirectory: directory }, async () => { if (!ready) throw new Error("postgres password do-not-log"); }, entry => logs.push(entry));
  t.after(() => app.close());
  const request = (url: string, headers = { host: "127.0.0.1:4191" }) => app.inject({ url, headers });
  assert.equal((await request("/")).body, html);
  for (const url of ["/", "/notifications-sw.js", "/api/v1/health/live", "/missing"]) {
    const response = await request(url);
    const policy = String(response.headers["content-security-policy"] ?? "");
    for (const directive of ["default-src 'none'", "script-src 'self'", "worker-src 'self'", "connect-src 'self'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"]) assert.ok(policy.split("; ").includes(directive), `${url}: ${directive}`);
    assert.equal(policy.includes("unsafe-eval"), false);
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["permissions-policy"], "geolocation=(self), camera=(), microphone=(), display-capture=(), payment=(), usb=()");
    assert.equal(response.headers["strict-transport-security"], undefined, "Local HTTP must not claim verified HTTPS deployment");
  }
  assert.equal((await request("/api/v1/health/live")).json().status, "ok");
  assert.equal((await request("/api/v1/health/ready")).statusCode, 200);
  ready = false; const unavailable = await request("/api/v1/health/ready"); assert.equal(unavailable.statusCode, 503); assert.deepEqual(unavailable.json(), { status: "unavailable" });
  for (const url of ["/.env", "/server/main.ts", "/supabase/config.toml", "/assets/leak-abcdefgh.js", "/assets/%2e%2e/.env", "/prompt.txt", "/api/v1/unknown?token=do-not-log"]) assert.equal((await request(url)).statusCode, 404, url);
  assert.equal((await request("/", { host: "habit.saraftech.com" })).statusCode, 403);
  assert.equal((await app.inject({ url: "/", headers: { host: "127.0.0.1:4191", origin: "https://elsewhere.invalid" } })).statusCode, 403);
  const asset = await request("/assets/app-abcdefgh.js"); assert.equal(asset.headers["cache-control"], "public, max-age=31536000, immutable");
  assert.equal((await request("/notifications-sw.js")).headers["service-worker-allowed"], "/");
  assert.equal(JSON.stringify(logs).includes("do-not-log"), false);
  await writeFile(join(directory, "index.html"), html.replace("production", "review"));
  await assert.rejects(createApp({ ...loadConfig(vars()), staticDirectory: directory }, async () => {}), { message: "production_static_build_required" });
});

test("diagnostic sink failure cannot change a completed action or expose an error payload", async t => {
  const app=await createApp(loadConfig(vars()),async()=>{},()=>{throw new Error('synthetic_sink_failure');});t.after(()=>app.close());
  let completed=0;
  app.post('/diagnostic-action',async()=>{completed++;return {saved:true};});
  app.get('/diagnostic-error',async()=>{throw new Error('PRIVATE_ERROR_CANARY');});
  const headers={host:'127.0.0.1:4191'};
  const saved=await app.inject({method:'POST',url:'/diagnostic-action',headers});assert.equal(saved.statusCode,200);assert.deepEqual(saved.json(),{saved:true});assert.equal(completed,1);
  const failed=await app.inject({url:'/diagnostic-error',headers});assert.equal(failed.statusCode,500);assert.deepEqual(failed.json(),{error:'request_failed'});assert.equal(app.operationsSnapshot().serverErrors,1);
});
