import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { pwaBuild } from "../scripts/pwa-build.ts";
import { browserSecurityHeaders } from "../server/browserPolicy.ts";

test("a policy-only change produces a new PWA release while identical builds remain stable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rise-policy-build-"));
  const original = browserSecurityHeaders["Content-Security-Policy"];
  try {
    await mkdir(join(directory, "public"));
    await writeFile(join(directory, "index.html"), '<html><head><title>Synthetic shell</title></head><body>Same interface</body></html>');
    await writeFile(join(directory, "public/notifications-sw.js"), "const BUILD = /* RISE_BUILD */ null;");
    const compile = async () => {
      await build({ root: directory, configFile: false, logLevel: "silent", plugins: [pwaBuild(true)] });
      return { index: await readFile(join(directory, "dist/index.html"), "utf8"), worker: await readFile(join(directory, "dist/notifications-sw.js"), "utf8") };
    };
    const before = await compile();
    browserSecurityHeaders["Content-Security-Policy"] = `${original}; media-src 'none'`;
    const after = await compile();
    assert.notEqual(after.worker, before.worker);
    assert.notEqual(after.index.match(/name="rise-release" content="([^"]+)"/)?.[1], before.index.match(/name="rise-release" content="([^"]+)"/)?.[1]);
    assert.equal(after.index.replace(/<meta name="rise-release"[^>]+>/, ""), before.index.replace(/<meta name="rise-release"[^>]+>/, ""));
    browserSecurityHeaders["Content-Security-Policy"] = original;
    assert.deepEqual(await compile(), before);
  } finally { browserSecurityHeaders["Content-Security-Policy"] = original; await rm(directory, { recursive: true, force: true }); }
});
