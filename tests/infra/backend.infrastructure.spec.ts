import { test, expect, stored } from "../support/browser.ts";
import { xpTotal } from "../../src/model.ts";

test("real backend keeps production entry, chosen habits and durable check-ins intact", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T03:00:00Z") });
  await page.goto("/?review=1&design=1&fixture=daily-life");
  await expect(page.locator('meta[name="rise-build"]')).toHaveAttribute("content", "production");
  await expect(page.locator(".reviewer")).toHaveCount(0);
  await page.getByRole("button", { name: "Choose other habits first", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create my plan", exact: true }).click();
  await stored(page);
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  await expect.poll(async () => xpTotal(await stored(page))).toBe(10);
  await page.reload(); expect(xpTotal(await stored(page))).toBe(10);
  expect((await stored(page)).life.groups).toEqual([]);
});
test("backend serves a working public offline shell without caching health/private endpoints", async ({ page, context, browserName }) => {
  await page.goto("/"); const before = await stored(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await stored(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const health = await page.evaluate(async () => { const response = await fetch("/api/v1/health/ready"); return { status: response.status, cache: response.headers.get("cache-control") }; });
  expect(health).toEqual({ status: 200, cache: "no-store" });
  expect(await page.evaluate(async () => { const keys = await caches.keys(); const urls: string[] = []; for (const key of keys) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname); return urls.filter(url => url.startsWith("/api/") || url.includes(".env")); })).toEqual([]);
  if (browserName === "firefox") await page.request.post("/__infra_test__/network?offline=true");
  else await context.setOffline(true);
  try {
    const response = await page.reload(); expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole("button", { name: "Choose other habits first", exact: true })).toBeVisible();
    expect(await stored(page)).toEqual(before);
  } finally {
    if (browserName === "firefox") await page.request.post("/__infra_test__/network?offline=false");
    else await context.setOffline(false);
  }
});
test("only the production public files and safe health metadata are exposed", async ({ request }) => {
  for (const path of ["/.env", "/server/main.ts", "/supabase/config.toml", "/.rise-infra/test/server.env", "/.rise-infra/test/ops.env", "/.rise-infra/test/operations/status.json", "/assets/pip.prompt.txt", "/api/v1/private"]) expect((await request.get(path)).status()).toBe(404);
  const health = await request.get("/api/v1/health/ready");
  expect(await health.json()).toEqual({ status: "ready", release: "infra-local", webRelease: expect.stringMatching(/^[a-f0-9]{20}$/) });
  expect(health.headers()["cache-control"]).toBe("no-store");
  const worker = await request.get("/notifications-sw.js"); expect(worker.status()).toBe(200);
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
});
