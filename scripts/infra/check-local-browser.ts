import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { chromium, firefox, webkit } from "@playwright/test";
import { loadConfig } from "../../server/config.ts";
import { database } from "../../server/database.ts";
import { createApp } from "../../server/app.ts";
import { Sessions } from "../../server/auth/sessions.ts";

// Read-only browser smoke, never a fixture loader. Every context is ephemeral;
// no existing browser origin/profile, account, subscription or journey is edited.
const directory = await mkdtemp(join(tmpdir(), "rise-local-browser-"));
const env = parseEnv(await readFile(resolve(".rise-infra/local/server.env"), "utf8"));
const config = loadConfig({ ...env, LOCAL_BROWSER_ORIGIN: "http://127.0.0.1:4192", STATIC_DIRECTORY: directory });
const store = database(config);
let app: Awaited<ReturnType<typeof createApp>> | undefined;
try {
  const before = await readFile(resolve("dist/index.html"));
  await cp(resolve("dist"), directory, { recursive: true });
  assert.ok(before.equals(await readFile(resolve("dist/index.html"))) && before.equals(await readFile(join(directory, "index.html"))), "build_changed_during_snapshot");
  await store.verify();
  app = await createApp(config, store.verify, undefined, new Sessions(config, store.pool));
  await app.listen({ host: config.host, port: config.port }); // Never reuse an existing listener.
  for (const [name, type] of Object.entries({ chromium, webkit, firefox })) {
    const browser = await type.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: "Asia/Tashkent", reducedMotion: "reduce" });
      const external: string[] = [];
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin !== config.origin) { external.push("blocked_external_request"); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      const response = await page.goto(config.origin, { waitUntil: "domcontentloaded", timeout: 10000 });
      assert.equal(response?.status(), 200);
      await page.locator('[data-storage-status="saved"]').waitFor({ timeout: 10000 });
      assert.equal(await page.locator('meta[name="rise-build"]').getAttribute("content"), "production");
      assert.equal(await page.locator(".reviewer").count(), 0);
      const health = await page.request.get(`${config.origin}/api/v1/health/ready`);
      assert.equal(health.status(), 200); assert.equal(health.headers()["cache-control"], "no-store");
      assert.equal((await page.request.get(`${config.origin}/api/v1/sync/head`)).status(), 401);
      await page.evaluate("Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((_, reject) => setTimeout(() => reject(new Error('worker_ready_timeout')), 15000))])");
      await page.reload();
      await page.locator('[data-storage-status="saved"]').waitFor({ timeout: 10000 });
      await page.waitForFunction("Boolean(navigator.serviceWorker.controller)", undefined, { timeout: 10000 });
      assert.deepEqual(external, []);
      console.log(JSON.stringify({ browser: name, version: browser.version(), origin: config.origin, entry: true, health: 200, anonymousSync: 401, controlledReload: true }));
      await context.close();
    } finally { await browser.close(); }
  }
  await store.verify();
} finally {
  await app?.close(); await store.close(); await rm(directory, { recursive: true, force: true });
}
