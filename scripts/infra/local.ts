import { execFile } from "node:child_process";
import { promisify, parseEnv } from "node:util";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { chmod, cp, mkdir, readFile, writeFile, access, realpath, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { provision, newPasswords, type RuntimePasswords } from "../../infra/provision.ts";
import webpush from "web-push";
import { loadConfig } from "../../server/config.ts";
import { database } from "../../server/database.ts";
import { copyEmailTemplate } from "./email-templates.ts";

const exec = promisify(execFile);
export const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const binary = resolve(root, "node_modules/.bin/supabase");
type LocalEnvironment = "local" | "test";
interface State { installationId: string; passwords: RuntimePasswords; jwtSecret: string; publishableKey: string; secretKey: string; authKeyVersion?: number; sessionEncryptionKey?: string; push?:{version:1;dataKey:string;publicKey:string;privateKey:string} }
export const paths = (environment: LocalEnvironment) => {
  const directory = resolve(root, ".rise-infra", environment);
  const suffix = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return { directory, projectId: `rise-${environment}-${suffix}`, network: `rise-${environment}-${suffix}`, apiPort: environment === "local" ? 55321 : 55421, dbPort: environment === "local" ? 55322 : 55422, port: environment === "local" ? 4190 : 4191 };
};
export async function privateFile(path: string, value: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { mode: 0o600 }); await chmod(temporary, 0o600); await rename(temporary, path);
}
export async function localStatus(environment: LocalEnvironment): Promise<Record<string, string>> {
  const { directory } = paths(environment);
  let status: Record<string, string>;
  try {
    const result = await exec(binary, ["status", "--workdir", directory, "--output", "json"], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    status = JSON.parse(result.stdout);
  } catch { throw new Error("local_status_unavailable"); }
  const { apiPort, dbPort } = paths(environment);
  if (new URL(status.API_URL).origin !== `http://127.0.0.1:${apiPort}` || new URL(status.DB_URL).hostname !== "127.0.0.1" || new URL(status.DB_URL).port !== String(dbPort)) throw new Error("local_status_mismatch");
  return status;
}
async function command(environment: LocalEnvironment, args: string[]) {
  const { directory, projectId } = paths(environment);
  const docker = await exec("which", ["docker"]);
  const shimDirectory = resolve(directory, "bin"); await mkdir(shimDirectory, { recursive: true, mode: 0o700 });
  await cp(resolve(root, "scripts/infra/docker-loopback.mjs"), resolve(shimDirectory, "docker"));
  await chmod(resolve(shimDirectory, "docker"), 0o700);
  const env = { ...process.env, PATH: `${shimDirectory}:${process.env.PATH}`, RISE_DOCKER_BINARY: await realpath(docker.stdout.trim()), RISE_DOCKER_PROJECT: projectId };
  try { return await exec(binary, [...args, "--workdir", directory], { cwd: root, env, maxBuffer: 32 * 1024 * 1024 }); }
  catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    await privateFile(resolve(directory, "last-cli-error.log"), `${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    throw new Error("local_command_failed_see_private_log");
  }
}
async function prepare(environment: LocalEnvironment) {
  const { directory, projectId, apiPort, dbPort, port } = paths(environment);
  await mkdir(resolve(root, ".rise-infra"), { recursive: true, mode: 0o700 });
  await chmod(resolve(root, ".rise-infra"), 0o700);
  await mkdir(resolve(directory, "supabase"), { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700); await chmod(resolve(directory, "supabase"), 0o700);
  let state: State;
  try { state = JSON.parse(await readFile(resolve(directory, "state.json"), "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("local_state_unreadable_do_not_recreate");
    state = { installationId: randomUUID(), passwords: newPasswords(), jwtSecret: randomBytes(48).toString("hex"), publishableKey: `sb_publishable_${randomBytes(32).toString("base64url")}`, secretKey: `sb_secret_${randomBytes(32).toString("base64url")}` };
    await privateFile(resolve(directory, "state.json"), JSON.stringify(state));
  }
  // Refuse partial/corrupt state rather than replacing credentials for existing volumes.
  if (!/^[0-9a-f-]{36}$/.test(state.installationId) || !/^[0-9a-f]{96}$/.test(state.jwtSecret) || !/^sb_publishable_[\w-]{43}$/.test(state.publishableKey) || !/^sb_secret_[\w-]{43}$/.test(state.secretKey)) throw new Error("local_state_invalid");
  // Add only the new monitor credential; preserve every existing identity/key.
  if (state.passwords.ops === undefined) {
    state.passwords.ops = randomBytes(32).toString("hex");
    await privateFile(resolve(directory, "state.json"), JSON.stringify(state));
  }
  if (!/^[0-9a-f]{64}$/.test(state.passwords.ops)) throw new Error("local_ops_key_invalid_do_not_recreate");
  if (state.authKeyVersion === undefined && state.sessionEncryptionKey === undefined) {
    state.authKeyVersion = 1; state.sessionEncryptionKey = randomBytes(32).toString("hex");
    await privateFile(resolve(directory, "state.json"), JSON.stringify(state));
  }
  if (state.authKeyVersion !== 1 || !state.sessionEncryptionKey || !/^[0-9a-f]{64}$/.test(state.sessionEncryptionKey)) throw new Error("local_session_key_invalid_do_not_recreate");
  if(state.push===undefined){const pair=webpush.generateVAPIDKeys();state.push={version:1,dataKey:randomBytes(32).toString("hex"),...pair};await privateFile(resolve(directory,"state.json"),JSON.stringify(state));}
  if(state.push.version!==1||!/^[0-9a-f]{64}$/.test(state.push.dataKey)||!/^[\w-]{87}$/.test(state.push.publicKey)||!/^[\w-]{43}$/.test(state.push.privateKey)||state.push.dataKey===state.sessionEncryptionKey)throw new Error("local_push_key_invalid_do_not_recreate");
  const source = await readFile(resolve(root, "supabase/config.toml"), "utf8");
  const config = source.replace('project_id = "rise-local"', `project_id = "${projectId}"`)
    .replaceAll("55321", String(apiPort)).replaceAll("55322", String(dbPort)).replaceAll("55320", String(dbPort - 2)).replaceAll("55323", String(dbPort + 1)).replaceAll("55324", String(dbPort + 2)).replaceAll("4190", String(port))
    .replace("[auth]\n", `[auth]\njwt_secret = "${state.jwtSecret}"\npublishable_key = "${state.publishableKey}"\nsecret_key = "${state.secretKey}"\n`);
  await privateFile(resolve(directory, "supabase/config.toml"), config);
  await cp(resolve(root, "supabase/migrations"), resolve(directory, "supabase/migrations"), { recursive: true });
  await copyEmailTemplate(resolve(root, "supabase/templates/code.html"), resolve(directory, "supabase/templates/code.html"));
  const keyPath = resolve(directory, "supabase/signing_keys.json");
  try { await access(keyPath); }
  catch {
    await privateFile(keyPath, "[]\n");
    await command(environment, ["gen", "signing-key", "--algorithm", "ES256"]);
    await chmod(keyPath, 0o600);
  }
  const signingKeys = JSON.parse(await readFile(keyPath, "utf8"));
  if (!Array.isArray(signingKeys) || !signingKeys.length || signingKeys.some(key => key.alg !== "ES256" || !key.d)) throw new Error("local_signing_keys_invalid");
  return state;
}
async function checkBindings(environment: LocalEnvironment) {
  const { projectId } = paths(environment);
  const list = await exec("docker", ["ps", "--filter", `label=com.supabase.cli.project=${projectId}`, "--format", "{{.ID}}"]);
  const ids = list.stdout.trim().split("\n").filter(Boolean);
  if (!ids.length) throw new Error("local_containers_missing");
  const { stdout } = await exec("docker", ["inspect", ...ids]);
  const containers = JSON.parse(stdout) as { NetworkSettings: { Ports: Record<string, { HostIp: string }[] | null> } }[];
  if (containers.some(container => Object.values(container.NetworkSettings.Ports).some(bindings => bindings?.some(binding => binding.HostIp !== "127.0.0.1")))) throw new Error("local_ports_not_loopback");
}
async function up(environment: LocalEnvironment) {
  const state = await prepare(environment);
  const { directory, projectId, network, port } = paths(environment);
  try { await exec("docker", ["network", "inspect", network]); }
  catch { await exec("docker", ["network", "create", "--label", `rise.infrastructure=${projectId}`, "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", network]); }
  process.stdout.write(`Starting isolated ${environment} database/Auth (first run downloads pinned images)…\n`);
  await command(environment, ["start", "--network-id", network]);
  try { await checkBindings(environment); } catch (error) { await command(environment, ["stop"]); throw error; }
  await command(environment, ["db", "push", "--local"]);
  const status = await localStatus(environment);
  await privateFile(resolve(directory, "admin-status.json"), JSON.stringify(status));
  const client = new pg.Client({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try { await provision(client, { environment, origin: `http://127.0.0.1:${port}`, projectRef: `rise-${environment}`, installationId: state.installationId }, state.passwords); }
  finally { await client.end(); }
  const runtime = new URL(status.DB_URL); runtime.username = "rise_bff_login"; runtime.password = state.passwords.bff;
  const vars = { DEPLOY_ENV: environment, APP_ORIGIN: `http://127.0.0.1:${port}`, RELEASE_ID: "infra-local", INSTALLATION_ID: state.installationId, SUPABASE_PROJECT_REF: `rise-${environment}`, SUPABASE_URL: status.API_URL, SUPABASE_PUBLISHABLE_KEY: state.publishableKey, DATABASE_URL: runtime.href, SESSION_ENCRYPTION_KEY: state.sessionEncryptionKey, BIND_HOST: "127.0.0.1", PORT: String(port), STATIC_DIRECTORY: resolve(root, "dist") };
  await privateFile(resolve(directory,"server.env"),Object.entries({...vars,PUSH_DATA_ENCRYPTION_KEY:state.push!.dataKey,VAPID_PUBLIC_KEY:state.push!.publicKey}).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join("\n")+"\n");
  const sender=new URL(status.DB_URL);sender.username="rise_worker_login";sender.password=state.passwords.worker;
  await privateFile(resolve(directory,"push.env"),Object.entries({DEPLOY_ENV:environment,INSTALLATION_ID:state.installationId,DATABASE_WORKER_URL:sender.href,PUSH_DATA_ENCRYPTION_KEY:state.push!.dataKey,VAPID_PUBLIC_KEY:state.push!.publicKey,VAPID_PRIVATE_KEY:state.push!.privateKey,VAPID_SUBJECT:"https://habit.saraftech.com"}).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join("\n")+"\n");
  const lifecycle=new URL(status.DB_URL);lifecycle.username="rise_lifecycle_login";lifecycle.password=state.passwords.lifecycle;
  await privateFile(resolve(directory,"lifecycle.env"),Object.entries({DEPLOY_ENV:environment,INSTALLATION_ID:state.installationId,DATABASE_LIFECYCLE_URL:lifecycle.href,SUPABASE_URL:status.API_URL,SUPABASE_SECRET_KEY:state.secretKey}).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join("\n")+"\n");
  const ops=new URL(status.DB_URL);ops.username="rise_ops_login";ops.password=state.passwords.ops;
  await privateFile(resolve(directory,"ops.env"),Object.entries({DEPLOY_ENV:environment,INSTALLATION_ID:state.installationId,DATABASE_OPS_URL:ops.href}).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join("\n")+"\n");
  await verify(environment);
}
export async function verify(environment: LocalEnvironment) {
  const { directory } = paths(environment);
  const config = loadConfig(parseEnv(await readFile(resolve(directory, "server.env"), "utf8")));
  const store = database(config);
  try { await store.verify(); await checkBindings(environment); }
  finally { await store.close(); }
  const template = await readFile(resolve(root, "supabase/templates/code.html"), "utf8");
  for (const name of ["confirmation", "magic_link"]) {
    try {
      const result = await exec("docker", ["exec", `supabase_kong_${paths(environment).projectId}`, "wget", "-qO-", `http://127.0.0.1:8088/email/${name}.html`], { maxBuffer: 65536, timeout: 5000 });
      if (result.stdout !== template) throw new Error("template_mismatch");
    } catch { throw new Error("local_email_template_unavailable_restart_project_gateway"); }
  }
  process.stdout.write(`${environment}: database identity, restricted BFF role, Auth health, email templates and loopback bindings verified.\n`);
}
async function main() {
  const [action, environment] = process.argv.slice(2);
  if (!["up", "stop", "verify"].includes(action) || !["local", "test"].includes(environment)) throw new Error("usage_infra_up_stop_verify_local_or_test");
  const selected = environment as LocalEnvironment;
  if (action === "up") await up(selected);
  if (action === "verify") await verify(selected);
  if (action === "stop") { await command(selected, ["stop"]); process.stdout.write(`${selected}: stopped; database volumes and credentials retained.\n`); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`Infrastructure failed: ${error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "operation_failed"}. No credentials printed.\n`); process.exitCode = 1; });
}
