import { execFileSync, spawn } from "node:child_process";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

// Inspect the publication candidate set without changing this checkout/index.
// Before the first git init, disposable Git metadata supplies the same ignore rules.
const root = process.cwd(), failures = [], secrets = new Set();
// Inspect the actual indexed objects, never alternate bytes from refs/replace.
const gitEnv = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" };
const git = (...args) => execFileSync("git", args, { cwd: root, env: gitEnv, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024 });
async function requireAbsentRepository() {
  // Exit 128 also covers damaged/inaccessible metadata and unsafe ownership.
  // Only a checkout with genuinely absent metadata may use a temporary index.
  if (["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"].some(key => process.env[key] !== undefined)) throw new Error("repository_unreadable");
  try { git("rev-parse", "--git-dir"); }
  catch (error) {
    if (error.status !== 128) throw error;
    for (let directory = root; ; directory = dirname(directory)) {
      let exists = true;
      try { await lstat(join(directory, ".git")); }
      catch (failure) { if (failure.code !== "ENOENT") throw new Error("repository_unreadable"); exists = false; }
      if (exists) throw new Error("repository_unreadable");
      if (dirname(directory) === directory) return;
    }
  }
  throw new Error("repository_unreadable");
}
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const privateKeyHeader = new RegExp("-----BEGIN (?:[A-Z ]+ )?" + "PRIVATE KEY-----");
const addSecret = value => { if (typeof value === "string" && value.length >= 16) secrets.add(value); };
async function privateJson(path) {
  try { return JSON.parse(await readFile(join(root, path), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("private_configuration_unreadable"); // No file contents/errors in output.
  }
}
for (const environment of ["local", "test"]) {
  const base = `.rise-infra/${environment}`, state = await privateJson(`${base}/state.json`);
  if (state) {
    for (const value of Object.values(state.passwords ?? {})) addSecret(value);
    for (const value of [state.jwtSecret, state.secretKey, state.sessionEncryptionKey, state.push?.dataKey, state.push?.privateKey]) addSecret(value);
  }
  const status = await privateJson(`${base}/admin-status.json`); addSecret(status?.SERVICE_ROLE_KEY);
  const keys = await privateJson(`${base}/supabase/signing_keys.json`);
  if (keys) { if (!Array.isArray(keys)) throw new Error("private_configuration_unreadable"); for (const key of keys) addSecret(key?.d); }
}
function prohibited(path) {
  const parts = path.split("/"), name = basename(path);
  if (parts.some(part => [".rise-infra", "node_modules", "dist", "dist-review", "test-results", "playwright-report", ".vite", ".DS_Store"].includes(part))) return true;
  if ((name === ".env" || name.startsWith(".env.") || name.endsWith(".env")) && !name.endsWith(".env.example")) return true;
  if (/\.(?:jks|keystore|p12|pfx|key|pem|tsbuildinfo)$/.test(name)) return true;
  return /^(?:supabase\/(?:\.temp|\.branches|signing_keys\.json)(?:\/|$)|android\/app\/src\/main\/assets\/(?:public(?:\/|$)|capacitor\.(?:config|plugins)\.json$)|ios\/App\/App\/(?:public(?:\/|$)|capacitor\.config\.json$))/.test(path);
}
function inspect(path, bytes, source) {
  if ([...secrets].some(value => bytes.includes(Buffer.from(value)))) failures.push({ path, source, reason: "known_local_secret" });
  if (privateKeyHeader.test(bytes.toString("utf8"))) failures.push({ path, source, reason: "private_key_material" });
}
async function inspectIndex(entries) {
  const objects = new Map();
  for (const entry of entries) {
    const paths = objects.get(entry.oid) ?? []; paths.push(entry.path); objects.set(entry.oid, paths);
  }
  if (!objects.size) return;
  const oids = [...objects.keys()], input = oids.join("\n") + "\n";
  const sizes = execFileSync("git", ["cat-file", "--batch-check"], { cwd: root, env: gitEnv, input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024 }).toString().trimEnd().split("\n");
  if (sizes.length !== oids.length) throw new Error("invalid_index_metadata");
  const accepted = [];
  for (let i = 0; i < sizes.length; i++) {
    const [oid, type, value] = sizes[i].split(" "), size = Number(value);
    if (oid !== oids[i] || type !== "blob" || !Number.isSafeInteger(size) || size < 0) throw new Error("invalid_index_metadata");
    if (size >= MAX_FILE_BYTES) for (const path of objects.get(oid)) failures.push({ path, source: "index", reason: "file_size_limit" });
    else accepted.push({ oid, size });
  }
  if (!accepted.length) return;
  const child = spawn("git", ["cat-file", "--batch"], { cwd: root, env: gitEnv, stdio: ["pipe", "pipe", "pipe"] });
  const finished = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  finished.catch(() => {}); child.stderr.resume(); child.stdin.on("error", () => {});
  child.stdin.end(accepted.map(entry => entry.oid).join("\n") + "\n");
  const stream = child.stdout[Symbol.asyncIterator](); let pending = Buffer.alloc(0);
  async function available() {
    if (!pending.length) { const next = await stream.next(); if (next.done) throw new Error("truncated_index_stream"); pending = next.value; }
  }
  async function line() {
    let result = "";
    while (true) {
      await available(); const end = pending.indexOf(10);
      if (end !== -1) { result += pending.subarray(0, end).toString(); pending = pending.subarray(end + 1); return result; }
      result += pending.toString(); pending = Buffer.alloc(0);
      if (result.length > 160) throw new Error("invalid_index_header");
    }
  }
  async function take(size) {
    const parts = []; let left = size;
    while (left) { await available(); const count = Math.min(left, pending.length); parts.push(pending.subarray(0, count)); pending = pending.subarray(count); left -= count; }
    return Buffer.concat(parts, size);
  }
  try {
    for (const { oid, size } of accepted) {
      if (await line() !== `${oid} blob ${size}`) throw new Error("invalid_index_header");
      const bytes = await take(size);
      if (!(await take(1)).equals(Buffer.from("\n"))) throw new Error("invalid_index_delimiter");
      for (const path of objects.get(oid)) inspect(path, bytes, "index");
    }
    if (pending.length || !(await stream.next()).done || await finished !== 0) throw new Error("invalid_index_completion");
  } finally { if (child.exitCode === null) child.kill(); }
}
let temporary, initialized = true, args = [], staged = [];
try {
  let top;
  try { top = git("rev-parse", "--show-toplevel").toString().trim(); }
  catch (error) { if (error.status !== 128) throw error; await requireAbsentRepository(); initialized = false; }
  if (initialized) {
    if (resolve(top) !== resolve(root)) throw new Error("run_from_repository_root");
    staged = git("ls-files", "--stage", "-z").toString().split("\0").filter(Boolean).map(line => {
      const tab = line.indexOf("\t"), [mode, oid, stage] = line.slice(0, tab).split(" ");
      return { path: line.slice(tab + 1), mode, oid, stage };
    });
  } else {
    temporary = await mkdtemp(join(tmpdir(), "rise-publication-"));
    const metadata = join(temporary, "git"); git("init", "--bare", "--quiet", metadata);
    args = ["--git-dir", metadata, "--work-tree", root];
  }
  const paths = [...new Set(git(...args, "ls-files", "--cached", "--others", "--exclude-standard", "-z").toString().split("\0").filter(Boolean))];
  let files = 0, bytes = 0;
  for (const path of paths) {
    if (prohibited(path)) { failures.push({ path, source: "candidate", reason: "private_or_generated_path" }); continue; }
    let info;
    try { info = await lstat(join(root, path)); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!info.isFile()) { failures.push({ path, source: "worktree", reason: "non_regular_file" }); continue; }
    if (info.size >= MAX_FILE_BYTES) { failures.push({ path, source: "worktree", reason: "file_size_limit" }); continue; }
    inspect(path, await readFile(join(root, path)), "worktree"); files++; bytes += info.size;
  }
  // Ignored files already staged remain publishable; inspect index blobs as well
  // as the current worktree so editing a staged secret afterward cannot hide it.
  const indexEntries = [];
  for (const entry of staged) {
    if (prohibited(entry.path)) continue; // Already recorded above, including deleted worktree files.
    if (entry.stage !== "0" || !["100644", "100755"].includes(entry.mode)) { failures.push({ path: entry.path, source: "index", reason: "unsupported_index_entry" }); continue; }
    indexEntries.push(entry);
  }
  await inspectIndex(indexEntries);
  console.log(JSON.stringify({ initializedRepository: initialized, candidateFiles: files, candidateBytes: bytes, indexEntries: staged.length,
    knownSecretValues: secrets.size, failures, scope: "Read-only candidate/index path and known-secret byte checks; not a complete secret, archive or personal-data audit." }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch {
  console.error("publication_check_failed"); process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
