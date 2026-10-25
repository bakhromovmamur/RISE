import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authHarness, AuthBrowser, syntheticEmail } from "../support/auth.ts";

let harness: Awaited<ReturnType<typeof authHarness>>;
before(async () => { harness = await authHarness(); });
after(async () => { await harness?.close(); });
const group = randomUUID();
const reads = ["personal", "sync/head", "groups", `groups/${group}/invitations`, `groups/${group}/content`, `squads/${group}`, "push", "push/plan", "push/reminder", "push/group"];
const writes = [
  "auth/code", "auth/verify", "auth/reauth/code", "auth/reauth/verify", "logout", "personal/commands",
  ...["review", "changes", "pull", "commands", "imports", "imports/page", "imports/preview", "imports/commit", "imports/cancel"].map(path => `sync/${path}`),
  "account/export", "account/deletion", "groups/commands", "groups/invitations/preview", "groups/receipt", `groups/${group}/export`, "squads/preview",
  "push", "push/disable", "push/test", "push/plan", "push/cancel-plan",
];

test("installed application tables and privileged functions retain forced RLS and narrow capability owners", async () => {
  const tables = await harness.admin.query("select n.nspname||'.'||c.relname as name, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('rise','rise_private') and c.relkind='r'");
  assert.ok(tables.rowCount && tables.rowCount > 40);
  for (const row of tables.rows) assert.ok(row.relrowsecurity && row.relforcerowsecurity, row.name);
  const functions = await harness.admin.query(`select p.oid::regprocedure::text as name, p.proconfig, r.rolsuper, r.rolbypassrls, r.rolcanlogin,
    exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname in ('rise','rise_private') and p.prosecdef`);
  assert.ok(functions.rowCount && functions.rowCount > 0);
  for (const row of functions.rows) {
    assert.equal(row.public_execute, false, row.name);
    assert.equal(row.rolsuper || row.rolbypassrls || row.rolcanlogin, false, row.name);
    assert.ok(row.proconfig?.includes('search_path=""'), row.name);
  }
});

test("every private read denies anonymous and ambiguous cookies without caching or exposing input", async () => {
  const browser = new AuthBrowser(harness);
  for (const path of reads) {
    const response = await browser.request(path);
    assert.equal(response.statusCode, 401, path);
    assert.equal(response.headers["cache-control"], "no-store", path);
    assert.equal(response.headers["vary"], "Cookie", path);
  }
  const email = syntheticEmail();
  try {
    await browser.login(email);
    const session = browser.cookies.get("rise_test_session")!;
    const context = browser.cookies.get("rise_test_context")!;
    for (const suffix of [`rise_test_session=${session}`, `rise_test_context=${context}`]) {
      for (const path of reads) {
        const response = await browser.request(path, undefined, { cookie: `${browser.cookieHeader()}; ${suffix}` });
        assert.equal(response.statusCode, 401, path);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(response.body.includes(session) || response.body.includes(context) || response.body.includes(email), false);
      }
    }
    // Reading a valid empty account does not silently initialize private records.
    const view = await browser.request("personal");
    assert.equal(view.statusCode, 200); assert.equal(view.json().records, null);
    const logs = JSON.stringify(harness.logs);
    assert.equal(logs.includes(session) || logs.includes(context) || logs.includes(email), false);
  } finally { await harness.admin.query("delete from auth.users where email=$1", [email]); }
});

test("every mutation rejects missing or foreign Origin and cross-site requests before domain work", async () => {
  const browser = new AuthBrowser(harness);
  const rejectedHeaders: Record<string, string>[] = [{ origin: "" }, { origin: "https://untrusted.invalid" }, { "sec-fetch-site": "cross-site" }];
  for (const path of writes) {
    for (const headers of rejectedHeaders) {
      const response = await browser.request(path, {}, headers);
      assert.equal(response.statusCode, 403, path);
      assert.equal(response.headers["cache-control"], "no-store", path);
      assert.equal(response.headers["access-control-allow-origin"], undefined, path);
    }
  }
});

test("malformed, oversized and prototype-bearing HTTP inputs fail without leaking private canaries", async () => {
  const canary = "SAFE01_PRIVATE_INPUT_CANARY";
  const payloads = [
    { body: `{"__proto__":{"polluted":"${canary}"}}`, type: "application/json" },
    { body: `{"constructor":{"prototype":{"polluted":"${canary}"}}}`, type: "application/json" },
    { body: `{"email":"${canary}`, type: "application/json" },
    { body: JSON.stringify({ email: canary.repeat(300), remember: false }), type: "application/json" },
    { body: `email=${canary}`, type: "application/x-www-form-urlencoded" },
  ];
  for (const { body, type } of payloads) {
    const response = await harness.app.inject({ method: "POST", url: "/api/v1/auth/code", headers: { host: "127.0.0.1:4191", origin: harness.config.origin, "content-type": type }, payload: body });
    assert.ok([400, 413, 415].includes(response.statusCode));
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.includes(canary), false);
  }
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  assert.equal(JSON.stringify(harness.logs).includes(canary), false);
});
