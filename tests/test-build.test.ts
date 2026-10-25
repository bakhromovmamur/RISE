import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("the isolated test server retains its build when the source output is replaced", { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "rise-test-source-"));
  const output = join(directory, "dist");
  await mkdir(output);
  await writeFile(join(output, "index.html"), "<!doctype html><title>Frozen test build</title>");
  const child = spawn(process.execPath, [resolve("scripts/serve-test-build.mjs"), "4181"], {
    cwd: directory, stdio: ["ignore", "pipe", "pipe"],
  });
  const stopped = once(child, "exit");
  let logs = "";
  child.stderr.on("data", chunk => { logs += chunk; });
  try {
    await new Promise<void>((ready, reject) => {
      const timer = setTimeout(() => reject(new Error(`Test server did not become ready: ${logs}`)), 10000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Test server exited ${code}: ${logs}`)); });
      child.stdout.on("data", chunk => {
        logs += chunk;
        if (logs.includes("RISE isolated build ready")) { clearTimeout(timer); ready(); }
      });
    });
    const url = "http://127.0.0.1:4181/";
    assert.match(await (await fetch(url)).text(), /Frozen test build/);
    await rm(output, { recursive: true });
    const duringBuild = await fetch(url);
    assert.equal(duringBuild.status, 200);
    assert.match(await duringBuild.text(), /Frozen test build/);
    await mkdir(output);
    await writeFile(join(output, "index.html"), "<!doctype html><title>Replacement build</title>");
    assert.match(await (await fetch(url)).text(), /Frozen test build/);
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});
