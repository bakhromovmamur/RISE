import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import pg from "pg";
import { paths, localStatus, root, privateFile } from "../../scripts/infra/local.ts";
import { provision } from "../../infra/provision.ts";
import { loadConfig } from "../../server/config.ts";
import { database } from "../../server/database.ts";
import { createApp } from "../../server/app.ts";
import { seedSynthetic } from "../../infra/fixtures.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

async function installation(environment: "local" | "test") {
  const directory = paths(environment).directory;
  const env = parseEnv(await readFile(resolve(directory, "server.env"), "utf8"));
  return { environment, directory, config: loadConfig(env), status: await localStatus(environment), state: JSON.parse(await readFile(resolve(directory, "state.json"), "utf8")) };
}
const setups = Promise.all([installation("local"), installation("test")]);
const code = (expected: string) => (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === expected;

test("both local stacks apply the committed migrations and expose the expected restricted environment", async () => {
  for (const setup of await setups) {
    const store = database(setup.config);
    try { await store.verify(); } finally { await store.close(); }
    const admin = new pg.Client({ connectionString: setup.status.DB_URL }); await admin.connect();
    try {
      const rows = await admin.query("select version from supabase_migrations.schema_migrations order by version");
      const versions = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.*\.sql$/.test(name)).map(name => name.slice(0, 14)).sort();
      assert.deepEqual(rows.rows.map(row => row.version), versions);
      const schemas = await admin.query("select nspname from pg_namespace where nspname in ('rise', 'rise_private') order by nspname");
      assert.equal(schemas.rowCount, 2);
      const tables = await admin.query("select relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'rise_private' and c.relkind = 'r'");
      assert.equal(tables.rowCount, 16); assert.ok(tables.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
      await provision(admin, { environment: setup.environment, origin: setup.config.origin, projectRef: setup.config.projectRef, installationId: setup.config.installationId }, setup.state.passwords);
      await assert.rejects(provision(admin, { environment: setup.environment, origin: setup.config.origin, projectRef: setup.config.projectRef, installationId: randomUUID() }, setup.state.passwords), { message: "installation_identity_mismatch" });
      assert.equal((await admin.query("select installation_id::text from rise_private.environment")).rows[0].installation_id, setup.config.installationId);
    } finally { await admin.end(); }
  }
});
test("each runtime identity can read its environment but cannot administer data, Auth or other roles", async () => {
  for (const setup of await setups) for (const name of ["bff", "worker", "lifecycle"] as const) {
    const url = new URL(setup.status.DB_URL); url.username = `rise_${name}_login`; url.password = setup.state.passwords[name];
    const client = new pg.Client({ connectionString: url.href }); await client.connect();
    try {
      assert.equal((await client.query("select environment from rise_private.environment")).rows[0].environment, setup.environment);
      for (const query of [
        "update rise_private.environment set schema_version = 1", "delete from rise_private.environment", "select * from rise_private.synthetic_fixtures", "select id from auth.users", "select rolpassword from pg_authid", "create table rise.illegal (id integer)", "create table public.illegal (id integer)", "set role postgres", "grant rise_worker to rise_bff_login",
      ]) await assert.rejects(client.query(query), code("42501"));
      for (const other of ["bff", "worker", "lifecycle"].filter(value => value !== name)) assert.equal((await client.query("select pg_has_role(current_user, $1, 'member') as member", [`rise_${other}`])).rows[0].member, false);
    } finally { await client.end(); }
  }
});
test("crossed databases, installation markers and privileged connections fail readiness", async () => {
  const [local, review] = await setups;
  for (const config of [{ ...review.config, database: local.config.database }, { ...review.config, installationId: randomUUID() }, { ...review.config, database: { connectionString: review.status.DB_URL } }]) {
    const store = database(config); try { await assert.rejects(store.verify()); } finally { await store.close(); }
  }
  assert.notEqual(local.state.publishableKey, review.state.publishableKey);
  assert.notEqual(local.state.secretKey, review.state.secretKey);
  assert.equal(local.state.sessionEncryptionKey === review.state.sessionEncryptionKey, false);
  for (const role of ["bff", "worker", "lifecycle", "ops"]) assert.notEqual(local.state.passwords[role], review.state.passwords[role]);
  const wrong = new pg.Client({ ...review.config.database, password: local.state.passwords.bff });
  try { await assert.rejects(wrong.connect(), code("28P01")); } finally { await wrong.end(); }
});
test("private local files are protected and never present in the web build", async () => {
  const secrets: string[] = [];
  for (const setup of await setups) {
    for (const file of ["state.json", "server.env", "push.env", "lifecycle.env", "ops.env", "admin-status.json", "supabase/config.toml", "supabase/signing_keys.json"]) assert.equal((await stat(resolve(setup.directory, file))).mode & 0o077, 0, file);
    secrets.push(...Object.values(setup.state.passwords) as string[], setup.state.secretKey, setup.state.jwtSecret, setup.state.sessionEncryptionKey);
    secrets.push(setup.status.SERVICE_ROLE_KEY);
    assert.ok(typeof setup.state.push?.dataKey === "string" && typeof setup.state.push?.privateKey === "string");
    secrets.push(setup.state.push.dataKey, setup.state.push.privateKey);
    const signingKeys: unknown = JSON.parse(await readFile(resolve(setup.directory, "supabase/signing_keys.json"), "utf8"));
    assert.ok(Array.isArray(signingKeys));
    for (const key of signingKeys) { assert.ok(key && typeof key.d === "string"); secrets.push(key.d); }
  }
  async function scan(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else { const data = await readFile(path, "utf8"); assert.equal(secrets.some(secret => data.includes(secret)), false, `Secret in ${entry.name}`); }
    }
  }
  for (const directory of ["dist", "dist-review", "src", "server", "scripts", "infra", "supabase/migrations", ".github"]) await scan(resolve(root, directory));
});
test("browser-safe local entry verifies the retained marker and rejects crossed installation identity", async () => {
  const [local] = await setups;
  const env = parseEnv(await readFile(resolve(local.directory, "server.env"), "utf8"));
  const config = loadConfig({ ...env, LOCAL_BROWSER_ORIGIN: "http://127.0.0.1:4192" });
  const store = database(config);
  try {
    await store.verify();
    const row = (await store.pool.query("select app_origin, installation_id::text from rise_private.environment")).rows[0];
    assert.equal(row.app_origin, local.config.origin);
    assert.equal(row.installation_id, local.config.installationId);
  } finally { await store.close(); }
  for (const changed of [{ ...config, installationOrigin: config.origin }, { ...config, installationId: randomUUID() }]) {
    const wrong = database(changed);
    try { await assert.rejects(wrong.verify(), { message: "environment_not_ready" }); }
    finally { await wrong.close(); }
  }
});
test("BFF delivers the existing production files byte-for-byte under its own origin", async () => {
  const [, setup] = await setups; const store = database(setup.config);
  const app = await createApp(setup.config, store.verify);
  try {
    for (const file of ["index.html", "manifest.webmanifest", "notifications-sw.js"]) {
      const response = await app.inject({ url: `/${file}`, headers: { host: new URL(setup.config.origin).host } });
      assert.equal(response.statusCode, 200);
      const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
      assert.equal(hash(response.rawPayload), hash(await readFile(resolve(root, "dist", file))));
    }
    assert.equal((await app.inject({ url: "/api/v1/health/ready", headers: { host: new URL(setup.config.origin).host } })).statusCode, 200);
  } finally { await app.close(); await store.close(); }
});
test("synthetic Auth users are isolated; foreign JWTs and administrator tokens are refused", async () => {
  const tokens: string[] = [], configs = await setups;
  for (const setup of configs) {
    let password: string;
    const path = resolve(setup.directory, "fixture-password");
    try { password = await readFile(path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; password = randomBytes(32).toString("hex"); await privateFile(path, password); }
    const client = new pg.Client({ connectionString: setup.status.DB_URL }); await client.connect();
    const context = { environment: setup.environment, origin: setup.config.origin, projectRef: setup.config.projectRef, installationId: setup.config.installationId };
    const credentials = { url: setup.config.providerUrl, publishableKey: setup.config.publishableKey, adminKey: setup.status.SERVICE_ROLE_KEY, password };
    try {
      const first = await seedSynthetic(client, context, credentials);
      assert.equal(Object.keys(first).length, 3);
      assert.deepEqual(await seedSynthetic(client, context, credentials), first);
      await assert.rejects(seedSynthetic(client, { ...context, environment: "production" }, credentials), { message: "production_fixtures_forbidden" });
      const counts = await client.query("select count(*) from rise_private.synthetic_fixtures"); assert.equal(counts.rows[0].count, "3");
      for (const role of ["anon", "authenticated"]) {
        await client.query(`set role ${role}`);
        await assert.rejects(client.query("select * from rise_private.environment"), code("42501"));
        await client.query("reset role");
      }
    } finally { await client.end(); }
    const response = await fetch(`${setup.config.providerUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: setup.config.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: `infra-owner-${setup.config.installationId}@example.invalid`, password }), signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, "Synthetic sign-in failed");
    const body: unknown = await response.json();
    assert.ok(body && typeof body === "object" && "access_token" in body && typeof body.access_token === "string"); tokens.push(body.access_token);
    const inaccessible = await fetch(`${setup.config.providerUrl}/rest/v1/environment?select=*`, { headers: { apikey: setup.config.publishableKey, Authorization: `Bearer ${body.access_token}`, "Accept-Profile": "rise_private" }, signal: AbortSignal.timeout(10000) });
    assert.equal(inaccessible.status, 406);
  }
  for (let i = 0; i < configs.length; i++) {
    const setup = configs[i], other = configs[1 - i];
    const own = await fetch(`${setup.config.providerUrl}/auth/v1/user`, { headers: { apikey: setup.config.publishableKey, Authorization: `Bearer ${tokens[i]}` }, signal: AbortSignal.timeout(5000) });
    assert.equal(own.status, 200);
    const crossed = await fetch(`${setup.config.providerUrl}/auth/v1/user`, { headers: { apikey: setup.config.publishableKey, Authorization: `Bearer ${tokens[1 - i]}` }, signal: AbortSignal.timeout(5000) });
    assert.ok([401, 403].includes(crossed.status), "Foreign JWT must be refused");
    const foreignAdmin = await fetch(`${setup.config.providerUrl}/auth/v1/admin/users`, { headers: { apikey: setup.config.publishableKey, Authorization: `Bearer ${other.status.SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(5000) });
    assert.ok([401, 403].includes(foreignAdmin.status), "Foreign administrator token must be refused");
  }
});
test("startup refuses a mismatched installation before opening its listener", async () => {
  const [, setup] = await setups;
  const env = parseEnv(await readFile(resolve(setup.directory, "server.env"), "utf8"));
  try {
    await promisify(execFile)(process.execPath, ["--import", "tsx", "server/main.ts"], { cwd: root, env: { PATH: process.env.PATH, ...env, INSTALLATION_ID: randomUUID() }, timeout: 10000 });
    assert.fail("Mismatched backend must exit");
  } catch (error) {
    assert.ok(error && typeof error === "object" && "code" in error && error.code === 1 && "stdout" in error);
    assert.equal(String(error.stdout).trim(), '{"event":"startup_failed","code":"backend_not_ready"}');
  }
});
test("rotating a worker login invalidates its old password without changing the BFF identity", async () => {
  const [, setup] = await setups, password = randomBytes(32).toString("hex");
  const admin = new pg.Client({ connectionString: setup.status.DB_URL }); await admin.connect();
  const url = new URL(setup.status.DB_URL); url.username = "rise_worker_login";
  const connect = async (secret: string) => { url.password = secret; const client = new pg.Client({ connectionString: url.href }); try { await client.connect(); } finally { await client.end(); } };
  try {
    await admin.query(`alter role rise_worker_login password '${password}'`);
    await assert.rejects(connect(setup.state.passwords.worker), code("28P01"));
    await connect(password);
    const store = database(setup.config); try { await store.verify(); } finally { await store.close(); }
  } finally { await admin.query(`alter role rise_worker_login password '${setup.state.passwords.worker}'`); await admin.end(); }
});
test("unexpected direct grants on the BFF role fail readiness instead of expanding access", async () => {
  const [, setup] = await setups;
  const admin = new pg.Client({ connectionString: setup.status.DB_URL }); await admin.connect();
  const store = database(setup.config);
  try {
    await admin.query("grant select on auth.users to rise_bff_login");
    await assert.rejects(store.verify(), { message: "environment_not_ready" });
  } finally { await admin.query("revoke select on auth.users from rise_bff_login"); await admin.end(); await store.close(); }
});
