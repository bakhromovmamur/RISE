import { test, expect, stored } from "../support/browser.ts";
import { makeFixture } from "../../src/review/fixtures.ts";
import { ensurePriorities } from "../../src/developmentModel.ts";

test("security policy preserves onboarding, deferred screens, backup workers and offline reload", async ({ page, context, browserName }) => {
  await page.clock.install({ time: new Date("2026-10-21T03:00:00Z") });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", event => {
      // Test diagnostics contain directive names only, never private URLs or samples.
      const root = document.documentElement;
      root.dataset.policyViolations = `${root.dataset.policyViolations ?? ""}${event.effectiveDirective};`;
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Choose other habits first", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create my plan", exact: true }).click();
  await stored(page);
  await page.getByRole("button", { name: /Log tiny Read a little/ }).click();
  const before = await stored(page);
  for (const tab of ["Journey", "Progress", "You"]) await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.locator(".you-destinations").getByRole("button").filter({ hasText: "Family" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Choose your account", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Settings Appearance/ }).click();
  await page.getByRole("dialog").locator("summary").filter({ hasText: "Your data" }).click();
  const diagnosticDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:/^Download diagnostics/}).click();
  const diagnosticStream=await (await diagnosticDownload).createReadStream(),diagnosticChunks:Buffer[]=[];
  if(!diagnosticStream)throw new Error("synthetic_diagnostics_missing");
  for await(const chunk of diagnosticStream)diagnosticChunks.push(Buffer.from(chunk));
  const diagnostic=JSON.parse(Buffer.concat(diagnosticChunks).toString());
  expect(diagnostic.format).toBe("rise-diagnostics");expect(diagnostic.release).toBe(await page.locator('meta[name="rise-release"]').getAttribute('content'));
  expect(diagnostic.storageStatus).toBe("saved");expect(await stored(page)).toEqual(before);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Export local data/ }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = [];
  if (!stream) throw new Error("synthetic_download_missing");
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);
  expect(JSON.parse(raw.toString()).format).toBe("rise.private-backup");
  await page.getByRole("button", { name: "Restore a backup", exact: true }).click();
  await page.getByLabel("Choose a JSON backup").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: raw });
  await expect(page.getByRole("heading", { name: "Review before replacing" })).toBeVisible();
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByText("Backup restored on this device.")).toBeVisible();
  expect((await stored(page)).days).toEqual(before.days);
  expect(await page.evaluate(() => document.documentElement.dataset.policyViolations ?? "")).toBe("");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await stored(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const response = await page.request.get("/");
  const policy = response.headers()["content-security-policy"] ?? response.headers()["content-security-policy-report-only"];
  expect(policy).toContain("script-src 'self'");
  if (browserName === "firefox") await page.request.post("/__infra_test__/network?offline=true");
  else await context.setOffline(true);
  try {
    const offline = await page.reload();
    expect(offline?.fromServiceWorker()).toBe(true);
    const headers = await offline!.allHeaders();
    expect(headers["content-security-policy"] ?? headers["content-security-policy-report-only"]).toBe(policy);
    expect((await stored(page)).days).toEqual(before.days);
    expect(await page.evaluate(() => document.documentElement.dataset.policyViolations ?? "")).toBe("");
  } finally {
    if (browserName === "firefox") await page.request.post("/__infra_test__/network?offline=false");
    else await context.setOffline(false);
  }
});

test.describe("policy attack probes", () => {
test.use({ serviceWorkers: "block" });
test("browser policy blocks injected script, handlers, evaluation and base replacement", async ({ page }) => {
  // Evaluation from Playwright itself bypasses CSP. Run this probe as an
  // ordinary allowed same-origin script so the browser applies its real policy.
  await page.route("**/__safe01_eval.js", route => route.fulfill({ contentType: "text/javascript", body: `
    try { new Function("document.documentElement.dataset.safe01Executed = 'eval'")(); }
    catch (error) { document.documentElement.dataset.safe01EvalBlocked = String(error instanceof EvalError); }
  ` }));
  await page.goto("/"); await stored(page);
  const before = await stored(page);
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", event => violations.push(event.effectiveDirective));
    const marker = "safe01Executed";
    const script = document.createElement("script");
    script.textContent = `document.documentElement.dataset.${marker} = 'inline'`;
    document.head.append(script);
    const button = document.createElement("button");
    button.setAttribute("onclick", `document.documentElement.dataset.${marker} = 'handler'`);
    document.body.append(button); button.click();
    const evaluation = document.createElement("script"); evaluation.src = "/__safe01_eval.js";
    await new Promise<void>((resolve, reject) => { evaluation.onload = () => resolve(); evaluation.onerror = () => reject(new Error("synthetic_script_failed")); document.head.append(evaluation); });
    const base = document.createElement("base"); base.href = "https://invalid.example/"; document.head.append(base);
    const baseUnchanged = document.baseURI === location.href;
    await new Promise(resolve => setTimeout(resolve, 100));
    script.remove(); button.remove(); base.remove(); evaluation.remove();
    return { executed: document.documentElement.dataset[marker] ?? null, evaluationBlocked: document.documentElement.dataset.safe01EvalBlocked === "true", baseUnchanged, violations };
  });
  expect(result.executed).toBeNull();
  expect(result.evaluationBlocked).toBe(true); expect(result.baseUnchanged).toBe(true);
  expect(result.violations.some(name => name.startsWith("script-src"))).toBe(true);
  expect(result.violations).toContain("base-uri");
  expect(await stored(page)).toEqual(before);
});

test("the application refuses embedding even by a same-origin page", async ({ page }) => {
  await page.route("**/__safe01_frame.html", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Synthetic parent</title><iframe src="/"></iframe>' }));
  const framed = page.waitForResponse(response => new URL(response.url()).pathname === "/");
  await page.goto("/__safe01_frame.html");
  expect((await framed).headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(await page.locator("iframe").evaluate((element: HTMLIFrameElement) => element.contentDocument?.querySelector("#root") !== null && !!element.contentDocument)).toBe(false);
});
});

test("authored markup stays inert plain text through legacy migration and reload", async ({ page }) => {
  const state = makeFixture(), payload = '<img src="/api/v1/session" onerror="alert(1)">';
  state.habits[0].name = payload;
  for (const rows of Object.values(state.days)) for (const row of rows) if (row.habitId === state.habits[0].id) row.name = payload;
  await page.addInitScript(raw => { if (!localStorage.getItem("rise.local.v1")) localStorage.setItem("rise.local.v1", raw); }, JSON.stringify(state));
  let dialogs = 0; page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
  await page.goto("/");
  // Migration is saved before Today mounts and durably ensures its priorities.
  // Capture the reload baseline only after that expected startup command settles.
  await expect.poll(async () => (await stored(page)).dailyPriorities).toEqual(ensurePriorities(state).dailyPriorities);
  const before = await stored(page);
  await expect(page.getByText(payload, { exact: true }).first()).toBeVisible();
  expect(await page.locator('img[src="/api/v1/session"]').count()).toBe(0);
  await page.reload(); expect(await stored(page)).toEqual(before);
  await expect(page.getByText(payload, { exact: true }).first()).toBeVisible();
  expect(dialogs).toBe(0);
});
