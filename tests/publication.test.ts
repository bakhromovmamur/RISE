import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const script = resolve("scripts/check-publication.mjs"), ignores = await readFile(".gitignore", "utf8");
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "rise-publication-test-"));
  try { await writeFile(join(root, ".gitignore"), ignores); await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
function check(root: string) {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.equal(result.error, undefined);
  return { code: result.status, output: result.stdout + result.stderr, report: result.stdout ? JSON.parse(result.stdout) : null };
}
function git(root: string, ...args: string[]) { return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }); }

test("publication check works before Git initialization and excludes private/generated data without modifying it", async () => {
  await fixture(async root => {
    for (const path of [".rise-infra/local", ".vite/deps", "dist", "test-results"]) await mkdir(join(root, path), { recursive: true });
    const secret = randomBytes(24).toString("hex"), privateState = JSON.stringify({ passwords: { bff: secret } });
    await writeFile(join(root, ".rise-infra/local/state.json"), privateState);
    for (const path of [".DS_Store", ".vite/deps/cache.json", "dist/private.js", "test-results/private.log", ".env", "signing.key"]) await writeFile(join(root, path), secret);
    await writeFile(join(root, ".env.example"), "EXAMPLE=replace-before-use\n");
    await writeFile(join(root, "app.ts"), "export const message = 'Synthetic source';\n");
    const result = check(root);
    assert.equal(result.code, 0, result.output); assert.equal(result.report.initializedRepository, false);
    assert.equal(result.report.candidateFiles, 3); assert.equal(result.report.knownSecretValues, 1);
    assert.equal(result.output.includes(secret), false);
    assert.equal(await readFile(join(root, ".rise-infra/local/state.json"), "utf8"), privateState);
    await assert.rejects(readFile(join(root, ".git/HEAD")), { code: "ENOENT" });
  });
});

test("publication check catches an ignored file forced into the real index even after worktree deletion", async () => {
  await fixture(async root => {
    git(root, "init", "--quiet"); await writeFile(join(root, ".env"), "PRIVATE=synthetic\n");
    git(root, "add", "-f", ".env"); await rm(join(root, ".env"));
    const index = await readFile(join(root, ".git/index")), result = check(root);
    assert.equal(result.code, 1); assert.ok(result.report.failures.some((failure: { path: string; reason: string }) => failure.path === ".env" && failure.reason === "private_or_generated_path"));
    assert.deepEqual(await readFile(join(root, ".git/index")), index);
  });
});

test("publication check inspects staged bytes when a leaked secret has been removed only from the worktree", async () => {
  await fixture(async root => {
    const secret = randomBytes(24).toString("hex"); await mkdir(join(root, ".rise-infra/local"), { recursive: true });
    await writeFile(join(root, ".rise-infra/local/state.json"), JSON.stringify({ passwords: { bff: secret } }));
    git(root, "init", "--quiet"); await writeFile(join(root, "app.ts"), `export const value = '${secret}';\n`); git(root, "add", "app.ts");
    await writeFile(join(root, "app.ts"), "export const value = 'removed';\n");
    const index = await readFile(join(root, ".git/index")), result = check(root);
    assert.equal(result.code, 1); assert.equal(result.output.includes(secret), false);
    assert.ok(result.report.failures.some((failure: { source: string; reason: string }) => failure.source === "index" && failure.reason === "known_local_secret"));
    assert.deepEqual(await readFile(join(root, ".git/index")), index);
  });
});

test("publication check inspects index secrets hidden by assume-unchanged or skip-worktree flags", async () => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) await fixture(async root => {
    const secret = randomBytes(24).toString("hex"); await mkdir(join(root, ".rise-infra/local"), { recursive: true });
    await writeFile(join(root, ".rise-infra/local/state.json"), JSON.stringify({ passwords: { bff: secret } }));
    git(root, "init", "--quiet"); await writeFile(join(root, "app.ts"), secret); git(root, "add", "app.ts");
    git(root, "update-index", flag, "app.ts"); await writeFile(join(root, "app.ts"), "removed");
    assert.equal(git(root, "diff", "--name-only").toString(), "");
    const index = await readFile(join(root, ".git/index")), result = check(root);
    assert.equal(result.code, 1); assert.equal(result.output.includes(secret), false);
    assert.ok(result.report.failures.some((failure: { source: string; reason: string }) => failure.source === "index" && failure.reason === "known_local_secret"));
    assert.deepEqual(await readFile(join(root, ".git/index")), index);
  });
});

test("publication check rejects symlinks and private-key material without printing their contents", async () => {
  await fixture(async root => {
    const header = ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ");
    await writeFile(join(root, "unexpected.txt"), `${header}\nsynthetic\n`);
    await symlink("unexpected.txt", join(root, "link.txt"));
    const result = check(root);
    assert.equal(result.code, 1); assert.equal(result.output.includes(header), false);
    assert.ok(result.report.failures.some((failure: { reason: string }) => failure.reason === "non_regular_file"));
    assert.ok(result.report.failures.some((failure: { reason: string }) => failure.reason === "private_key_material"));
  });
});

test("publication check inspects original indexed blobs even when Git replacement refs hide their secret bytes", async () => {
  await fixture(async root => {
    const secret = randomBytes(24).toString("hex"); await mkdir(join(root, ".rise-infra/local"), { recursive: true });
    await writeFile(join(root, ".rise-infra/local/state.json"), JSON.stringify({ passwords: { bff: secret } }));
    git(root, "init", "--quiet"); await writeFile(join(root, "app.ts"), secret); git(root, "add", "app.ts");
    const original = git(root, "rev-parse", ":app.ts").toString().trim();
    await writeFile(join(root, "app.ts"), "Synthetic benign replacement\n");
    const replacement = git(root, "hash-object", "-w", "app.ts").toString().trim();
    git(root, "replace", original, replacement);
    assert.equal(git(root, "cat-file", "blob", original).toString(), "Synthetic benign replacement\n");
    const index = await readFile(join(root, ".git/index")), result = check(root);
    assert.equal(result.code, 1); assert.equal(result.output.includes(secret), false);
    assert.ok(result.report.failures.some((failure: { source: string; reason: string }) => failure.source === "index" && failure.reason === "known_local_secret"));
    assert.deepEqual(await readFile(join(root, ".git/index")), index);
    assert.equal(git(root, "replace", "-l").toString().trim(), original);
  });
});

test("publication check fails closed for broken Git pointers and damaged metadata instead of treating them as uninitialized", async () => {
  for (const kind of ["pointer", "directory", "damaged-indexed-repository", "symlink", "ancestor"] as const) await fixture(async root => {
    await writeFile(join(root, "app.ts"), "Synthetic source\n");
    let directory = root;
    if (kind === "damaged-indexed-repository") {
      git(root, "init", "--quiet"); git(root, "add", "app.ts");
      await writeFile(join(root, ".git/HEAD"), "invalid-head\n");
    } else if (kind === "directory") await mkdir(join(root, ".git"));
    else if (kind === "symlink") await symlink("missing-metadata", join(root, ".git"));
    else await writeFile(join(root, ".git"), "gitdir: missing-metadata\n");
    if (kind === "ancestor") { directory = join(root, "nested"); await mkdir(directory); }
    const index = kind === "damaged-indexed-repository" ? await readFile(join(root, ".git/index")) : undefined;
    const result = check(directory);
    assert.equal(result.code, 1, kind); assert.equal(result.report, null);
    assert.equal(result.output.trim(), "publication_check_failed");
    assert.equal(await readFile(join(root, "app.ts"), "utf8"), "Synthetic source\n");
    if (index) assert.deepEqual(await readFile(join(root, ".git/index")), index);
  });
});

test("publication check streams multiple indexed blobs, including empty and repeated content, without changing the index", async () => {
  await fixture(async root => {
    git(root, "init", "--quiet");
    for (const [path, content] of [["empty.txt", ""], ["first.txt", "Synthetic text\n".repeat(100000)], ["second.txt", "Synthetic text\n".repeat(100000)]]) await writeFile(join(root, path), content);
    git(root, "add", "."); const index = await readFile(join(root, ".git/index"));
    const result = check(root);
    assert.equal(result.code, 0, result.output); assert.equal(result.report.indexEntries, 4);
    assert.deepEqual(await readFile(join(root, ".git/index")), index);
  });
});
