import type { PoolConfig } from "pg";

export type Environment = "local" | "test" | "staging" | "production";
export class ConfigurationError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "ConfigurationError"; this.code = code; }
}
export interface ServerConfig {
  environment: Environment;
  origin: string;
  installationOrigin: string;
  release: string;
  installationId: string;
  projectRef: string;
  providerUrl: string;
  publishableKey: string;
  host: string;
  port: number;
  staticDirectory: string;
  writesEnabled?: boolean;
  previousStaticDirectory?: string;
  database: PoolConfig;
  sessionKey: Buffer;
  push?: { dataKey:Buffer; publicKey:string };
}
const fail = (code: string): never => { throw new ConfigurationError(code); };
function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name];
  return value && value.trim() === value && !/replace|change.me|example/i.test(value) ? value : fail(`missing_or_invalid_${name}`);
}
function origin(value: string) {
  try { const url = new URL(value); return url.origin === value && !url.username && !url.password ? url : fail("invalid_origin"); }
  catch { return fail("invalid_origin"); }
}
/** Runtime-only configuration. This module is forbidden in browser builds. Error codes never include values. */
export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  if (env.RISE_WRITES_ENABLED !== undefined && !["true", "false"].includes(env.RISE_WRITES_ENABLED)) fail("invalid_write_capability");
  const environment = required(env, "DEPLOY_ENV");
  if (!["local", "test", "staging", "production"].includes(environment)) fail("invalid_environment");
  const local = environment === "local" || environment === "test";
  const app = origin(required(env, "APP_ORIGIN"));
  // Port 4190 is blocked by WebKit/Firefox. Only local browsing may use this
  // fixed alternate origin; the existing database marker and keys stay intact.
  const browserOrigin = env.LOCAL_BROWSER_ORIGIN;
  if (browserOrigin !== undefined && (environment !== "local" || browserOrigin !== "http://127.0.0.1:4192")) fail("invalid_local_browser_origin");
  const expectedPort = environment === "local" ? 4190 : 4191;
  if (local ? app.origin !== `http://127.0.0.1:${expectedPort}` : app.protocol !== "https:" || app.hostname === "localhost" || app.hostname === "127.0.0.1") fail("origin_environment_mismatch");
  if (environment === "production" && app.origin !== "https://habit.saraftech.com") fail("production_origin_mismatch");
  if (environment === "staging" && app.hostname === "habit.saraftech.com") fail("staging_cannot_use_production_origin");
  if (["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "DATABASE_MIGRATION_URL", "DATABASE_WORKER_URL", "DATABASE_OPS_URL", "DATABASE_LIFECYCLE_URL", "SUPABASE_JWT_SECRET"].some(name => env[name])) fail("privileged_credential_in_bff");
  const release = required(env, "RELEASE_ID"); if (!/^[a-zA-Z0-9._-]{1,80}$/.test(release)) fail("invalid_release");
  const sessionKey = required(env, "SESSION_ENCRYPTION_KEY"); if (!/^[0-9a-f]{64}$/.test(sessionKey)) fail("invalid_session_key");
  if(env.VAPID_PRIVATE_KEY)fail("push_signing_key_in_bff");
  let push:ServerConfig["push"];
  if(env.PUSH_DATA_ENCRYPTION_KEY||env.VAPID_PUBLIC_KEY){
    const key=required(env,"PUSH_DATA_ENCRYPTION_KEY"),pub=required(env,"VAPID_PUBLIC_KEY");
    if(!/^[0-9a-f]{64}$/.test(key)||key===sessionKey||!/^[\w-]{87}$/.test(pub))fail("invalid_push_configuration");
    push={dataKey:Buffer.from(key,"hex"),publicKey:pub};
  }
  const installationId = required(env, "INSTALLATION_ID"); if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(installationId)) fail("invalid_installation_id");
  const projectRef = required(env, "SUPABASE_PROJECT_REF");
  if (local ? projectRef !== `rise-${environment}` : !/^[a-z]{20}$/.test(projectRef)) fail("invalid_project_ref");
  const provider = origin(required(env, "SUPABASE_URL"));
  const apiPort = environment === "local" ? 55321 : 55421;
  if (local ? provider.origin !== `http://127.0.0.1:${apiPort}` : provider.origin !== `https://${projectRef}.supabase.co`) fail("provider_environment_mismatch");
  const publishableKey = required(env, "SUPABASE_PUBLISHABLE_KEY");
  if (!/^sb_publishable_[\w-]{20,200}$/.test(publishableKey)) {
    if (!local) fail("invalid_publishable_key");
    try { if (JSON.parse(Buffer.from(publishableKey.split(".")[1], "base64url").toString()).role !== "anon") fail("invalid_publishable_key"); }
    catch { fail("invalid_publishable_key"); }
  }
  let databaseUrl: URL;
  try { databaseUrl = new URL(required(env, "DATABASE_URL")); } catch { return fail("invalid_database_url"); }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || databaseUrl.hash || databaseUrl.search || databaseUrl.pathname !== "/postgres") fail("invalid_database_url");
  const username = decodeURIComponent(databaseUrl.username);
  if (username !== "rise_bff_login" && username !== `rise_bff_login.${projectRef}`) fail("invalid_runtime_role");
  const password = decodeURIComponent(databaseUrl.password); if (password.length < 24) fail("weak_database_credential");
  if (local) {
    if (databaseUrl.hostname !== "127.0.0.1" || databaseUrl.port !== String(environment === "local" ? 55322 : 55422)) fail("database_environment_mismatch");
  } else {
    const direct = databaseUrl.hostname === `db.${projectRef}.supabase.co` && username === "rise_bff_login";
    const pooled = /^aws-\d+-[\w-]+\.pooler\.supabase\.com$/.test(databaseUrl.hostname) && username === `rise_bff_login.${projectRef}`;
    if (!direct && !pooled) fail("database_project_mismatch");
    if (!["5432", "6543"].includes(databaseUrl.port || "5432")) fail("invalid_database_port");
  }
  const port = Number(env.PORT ?? (local ? expectedPort : 8080));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("invalid_port");
  if (local && port !== expectedPort) fail("port_environment_mismatch");
  const host = env.BIND_HOST ?? "127.0.0.1"; if (!["127.0.0.1", "0.0.0.0"].includes(host)) fail("invalid_bind_host");
  if (local && host !== "127.0.0.1") fail("local_bind_must_be_loopback");
  return { environment: environment as Environment, origin: browserOrigin ?? app.origin, installationOrigin: app.origin, release, installationId, projectRef, providerUrl: provider.origin, publishableKey, host, port: browserOrigin ? 4192 : port, sessionKey: Buffer.from(sessionKey, "hex"), ...(push?{push}:{}),
    staticDirectory: env.STATIC_DIRECTORY ?? "dist", writesEnabled: env.RISE_WRITES_ENABLED !== "false",
    database: { host: databaseUrl.hostname, port: Number(databaseUrl.port || 5432), database: "postgres", user: username, password,
      ssl: local ? false : { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}) },
      max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000, statement_timeout: 2000, query_timeout: 3000,
      application_name: `rise-bff-${environment}-${release}` },
  };
}
