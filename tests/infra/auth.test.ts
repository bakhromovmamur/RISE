import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { AuthBrowser, authHarness, localCode, syntheticEmail } from "../support/auth.ts";
import { hash, secrets } from "../../server/auth/crypto.ts";
import { ProviderError } from "../../server/auth/provider.ts";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { AuthError, Sessions, type AuthInput } from "../../server/auth/sessions.ts";

let harness: Awaited<ReturnType<typeof authHarness>>, refreshCalls = 0, refreshFailure = false, requestFailure = false;
before(async () => { harness = await authHarness(real => ({ ...real, request: async email => { if (requestFailure) throw new ProviderError(true); return real.request(email); }, refresh: async token => { refreshCalls++; if (refreshFailure) throw new ProviderError(true); return real.refresh(token); } })); });
after(async () => { await harness?.close(); });
const sid = (browser: AuthBrowser) => browser.cookies.get("rise_test_session")!;
const privateRow = async (browser: AuthBrowser) => (await harness.admin.query("select * from rise_private.server_sessions where id_hash = $1", [hash(sid(browser))])).rows[0];
const rejected = (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "42501";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
const authInput = (browser: AuthBrowser): AuthInput => ({ context: browser.cookies.get("rise_test_context")!, session: sid(browser), csrf: browser.csrf, ip: browser.ip });

for (const operation of ["request", "verify"] as const) test(`slow provider ${operation} does not hold another context's shared-IP quota lock`, async () => {
  const entered = deferred(), hold = deferred(), emailA = syntheticEmail(), emailB = syntheticEmail();
  const isolated = await authHarness();
  const a = new AuthBrowser(isolated), b = new AuthBrowser(isolated);
  const sessions = new Sessions(isolated.config, isolated.store.pool, { ...isolated.real,
    request: async (email, create) => {
      if (operation === "request" && email === emailA) { entered.resolve(); await hold.promise; }
      return isolated.real.request(email, create);
    },
    verify: async (email, code) => {
      if (operation === "verify" && email === emailA) { entered.resolve(); await hold.promise; }
      return isolated.real.verify(email, code);
    },
  });
  let pending: Promise<unknown> | undefined;
  try {
    await a.read(); await b.read();
    const inputA = authInput(a), inputB = { ...authInput(b), ip: a.ip };
    if (operation === "request") {
      pending = sessions.request(inputA, emailA, false); void pending.catch(() => {}); await entered.promise;
      const other = await sessions.request(inputB, emailB, false);
      assert.ok(other.challenge);
    } else {
      // Stage through the real provider before holding only A's verification.
      const sentA = await a.request("auth/code", { email: emailA, remember: false });
      const sentB = await b.request("auth/code", { email: emailB, remember: false });
      const mailA = await localCode(emailA), mailB = await localCode(emailB);
      pending = sessions.verify(inputA, sentA.json().challenge, mailA.code); void pending.catch(() => {}); await entered.promise;
      const other = await sessions.verify(inputB, sentB.json().challenge, mailB.code);
      assert.ok(other.session);
    }
    hold.resolve(); await pending;
  } finally {
    hold.resolve(); if (pending) await Promise.allSettled([pending]);
    await isolated.admin.query("delete from auth.users where email=any($1::text[])", [[emailA, emailB]]);
    await isolated.close();
  }
});

test("same-session waiters leave the restricted pool available to another authorized account", async () => {
  const a = new AuthBrowser(harness), b = new AuthBrowser(harness), emailA = syntheticEmail(), emailB = syntheticEmail();
  const sessions = new Sessions(harness.config, harness.store.pool), entered = deferred(), hold = deferred();
  let first: Promise<unknown> | undefined; const waiting: Promise<unknown>[] = [];
  try {
    await a.login(emailA); await b.login(emailB);
    const ownerA = (await privateRow(a)).user_id, ownerB = (await privateRow(b)).user_id;
    first = sessions.asActor(authInput(a), false, async (_client, actor) => { assert.equal(actor, ownerA); entered.resolve(); await hold.promise; });
    await entered.promise;
    for (let i = 0; i < 6; i++) {
      const pending = i % 2 ? sessions.read(authInput(a)).then(result => { assert.equal(result.view.account?.id, ownerA); })
        : sessions.asActor(authInput(a), false, async (_client, actor) => { assert.equal(actor, ownerA); });
      void pending.catch(() => {}); waiting.push(pending);
    }
    // With database-only session locking, these waiters consume all five connections.
    // This unrelated request must finish while the first actor remains held.
    await sessions.asActor(authInput(b), false, async (_client, actor) => { assert.equal(actor, ownerB); });
    hold.resolve(); await first; await Promise.all(waiting);
  } finally {
    hold.resolve(); await Promise.allSettled([...(first ? [first] : []), ...waiting]);
    await harness.admin.query("delete from auth.users where email=any($1::text[])", [[emailA, emailB]]);
  }
});

test("queued actor work rechecks provider revocation and never runs its callback", async () => {
  const browser = new AuthBrowser(harness), email = syntheticEmail(), sessions = new Sessions(harness.config, harness.store.pool);
  const entered = deferred(), hold = deferred(); let first: Promise<unknown> | undefined, queued: Promise<unknown> | undefined;
  const denied = (error: unknown) => error instanceof AuthError && error.status === 401 && error.code === "sign_in_required";
  try {
    await browser.login(email); const row = await privateRow(browser), input = authInput(browser);
    first = sessions.asActor(input, false, async () => { entered.resolve(); await hold.promise; });
    const firstDenied = assert.rejects(first, denied);
    await entered.promise;
    queued = sessions.asActor(input, false, async () => assert.fail("revoked queued actor ran"));
    const queuedDenied = assert.rejects(queued, denied);
    await harness.admin.query("delete from auth.sessions where id=$1 and user_id=$2", [row.provider_session_id, row.user_id]);
    hold.resolve(); await Promise.all([firstDenied, queuedDenied]);
    assert.equal((await sessions.read(input)).view.signedIn, false);
  } finally {
    hold.resolve(); await Promise.allSettled([...(first ? [first] : []), ...(queued ? [queued] : [])]);
    await harness.admin.query("delete from auth.users where email=$1", [email]);
  }
});

test("managed email codes create opaque HttpOnly sessions without returning provider tokens", async () => {
  const browser = new AuthBrowser(harness), { email, session, verified } = await browser.login();
  assert.equal(session.json().account.email, email); assert.equal(session.json().account.remembered, false);
  const cookie = verified.cookies.find(item => item.name === "rise_test_session");
  assert.ok(cookie?.httpOnly); assert.equal(cookie?.maxAge, undefined);
  assert.equal(session.headers["cache-control"], "no-store"); assert.equal(session.headers["set-cookie"], undefined, "Reads must not overwrite a newer session cookie");
  const row = await privateRow(browser), cipher = row.provider_cipher;
  assert.equal(Buffer.isBuffer(row.id_hash), true); assert.equal(row.id_hash.toString("hex") === sid(browser), false);
  assert.equal(cipher.includes(email) || cipher.includes(sid(browser)), false);
  const tokens = secrets(harness.config.sessionKey, harness.config.installationId).open(cipher, `session:${row.id_hash.toString("hex")}`);
  assert.ok(tokens && typeof tokens === "object" && "accessToken" in tokens && "refreshToken" in tokens);
  assert.equal(session.body.includes(String(tokens.accessToken)) || session.body.includes(String(tokens.refreshToken)), false);
  assert.ok(Math.abs((row.absolute_expires_at - row.authenticated_at) / 1000 - 43200) < 2);
  assert.equal((await harness.admin.query("select count(*) from auth.users where email = $1", [email])).rows[0].count, "1");
});
test("all mutations reject missing/cross-site Origin and absent or stale CSRF before sending email", async () => {
  const browser = new AuthBrowser(harness); await browser.read();
  const forbidden: Record<string, string>[] = [{ origin: "" }, { origin: "https://foreign.invalid" }, { "x-rise-csrf": "" }, { "x-rise-csrf": "0".repeat(64) }];
  for (const headers of forbidden) {
    assert.equal((await browser.request("auth/code", { email: syntheticEmail(), remember: false }, headers)).statusCode, 403);
    assert.equal((await browser.request("logout", {}, headers)).statusCode, 403);
    assert.equal((await browser.request("auth/verify", { challenge: "0".repeat(64), code: "000000" }, headers)).statusCode, 403);
  }
  assert.equal((await browser.request("auth/code", { email: syntheticEmail(), remember: false, ownerId: "somebody-else" })).statusCode, 422);
  assert.equal((await browser.request("auth/code", { email: syntheticEmail(), remember: false, returnTo: "https://foreign.invalid" })).statusCode, 422);
});
test("challenge binding, five-attempt lockout and cooldown resist replay/brute force", async () => {
  const browser = new AuthBrowser(harness), other = new AuthBrowser(harness), email = syntheticEmail();
  const sent = await browser.start(email); assert.equal(sent.statusCode, 202); await other.read();
  const mail = await localCode(email), handle = sent.json().challenge;
  assert.equal((await other.request("auth/verify", { challenge: handle, code: mail.code })).statusCode, 422);
  const wrong = String((Number(mail.code) + 1) % 1000000).padStart(6, "0");
  for (let i = 0; i < 5; i++) assert.equal((await browser.request("auth/verify", { challenge: handle, code: wrong })).statusCode, 422);
  assert.equal((await browser.request("auth/verify", { challenge: handle, code: mail.code })).statusCode, 422);
  const blocked = await browser.request("auth/code", { email, remember: false }); assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
  const context = browser.cookies.get("rise_test_context")!;
  assert.equal((await harness.admin.query("select attempts from rise_private.auth_challenges where context_hash = $1", [hash(context)])).rows[0].attempts, 5);
});
test("remembered sessions use persistent cookies and seven-day idle/thirty-day absolute limits", async () => {
  const browser = new AuthBrowser(harness), { verified } = await browser.login(undefined, true);
  const cookie = verified.cookies.find(item => item.name === "rise_test_session"); assert.equal(cookie?.maxAge, 2592000);
  const row = await privateRow(browser);
  assert.ok(Math.abs((row.absolute_expires_at - row.authenticated_at) / 1000 - 2592000) < 2);
  assert.ok(Math.abs((row.idle_expires_at - row.last_seen_at) / 1000 - 604800) < 2);
});
test("expired challenges cannot authenticate and new codes invalidate the old handle", async () => {
  const browser = new AuthBrowser(harness), email = syntheticEmail(), sent = await browser.start(email), first = await localCode(email);
  await harness.admin.query("update rise_private.auth_challenges set expires_at = now() - interval '1 second' where context_hash = $1", [hash(browser.cookies.get("rise_test_context")!)]);
  assert.equal((await browser.request("auth/verify", { challenge: sent.json().challenge, code: first.code })).statusCode, 422);
  // Advance only this synthetic address's limiter; provider local SMTP allows another code after one second.
  const key = secrets(harness.config.sessionKey, harness.config.installationId).rate(`send-email:${email}`);
  await harness.admin.query("delete from rise_private.auth_limits where subject_hash = $1", [key]);
  await new Promise(resolve => setTimeout(resolve, 1100));
  const resent = await browser.request("auth/code", { email, remember: false }); assert.equal(resent.statusCode, 202);
  const latest = await localCode(email, [first.id]);
  assert.equal((await browser.request("auth/verify", { challenge: sent.json().challenge, code: latest.code })).statusCode, 422);
  assert.equal((await browser.request("auth/verify", { challenge: resent.json().challenge, code: latest.code })).statusCode, 200);
  assert.equal((await harness.admin.query("select count(*) from auth.users where email = $1", [email])).rows[0].count, "1");
  const replay = await browser.request("auth/verify", { challenge: resent.json().challenge, code: latest.code }); assert.equal(replay.statusCode, 403);
});
test("logout revokes its linked provider JWT predicate and clears only account cookies", async () => {
  const browser = new AuthBrowser(harness); await browser.login(); const row = await privateRow(browser), originalCookie = browser.cookieHeader();
  const client = await harness.admin.connect();
  async function allowed(user = row.user_id, session = row.provider_session_id) {
    await client.query("begin");
    try { await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, session_id: session, user_metadata: { role: "admin" } })]); await client.query("set local role authenticated"); return (await client.query("select rise_private.active_session() as active")).rows[0].active; }
    finally { await client.query("rollback"); }
  }
  try {
    assert.equal(await allowed(), true); assert.equal(await allowed("00000000-0000-4000-8000-000000000001"), false);
    assert.equal((await browser.request("logout", {})).statusCode, 200); assert.equal(browser.cookies.has("rise_test_session"), false);
    assert.equal(await allowed(), false);
    assert.equal((await browser.request("session", undefined, { cookie: originalCookie })).json().signedIn, false);
    const closed = (await harness.admin.query("select revoked_at, provider_cipher from rise_private.server_sessions where id_hash = $1", [row.id_hash])).rows[0];
    assert.ok(closed.revoked_at); assert.equal(closed.provider_cipher, null);
  } finally { client.release(); }
});
test("idle/absolute expiry, provider session removal and account bans deny a previously valid session", async () => {
  for (const kind of ["idle", "absolute", "provider", "ban"]) {
    const browser = new AuthBrowser(harness); await browser.login(); const row = await privateRow(browser);
    if (kind === "idle") await harness.admin.query("update rise_private.server_sessions set idle_expires_at = now() - interval '1 second' where id_hash = $1", [row.id_hash]);
    if (kind === "absolute") await harness.admin.query("update rise_private.server_sessions set absolute_expires_at = now() - interval '1 second' where id_hash = $1", [row.id_hash]);
    if (kind === "provider") await harness.admin.query("delete from auth.sessions where id = $1 and user_id = $2", [row.provider_session_id, row.user_id]);
    if (kind === "ban") await harness.admin.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [row.user_id]);
    const read = await browser.read(); assert.equal(read.statusCode, 200); assert.equal(read.json().signedIn, false); assert.equal(read.json().reason, "expired");
  }
});
test("provider email failure is neutral and cannot activate an older code", async () => {
  const browser = new AuthBrowser(harness), email = syntheticEmail();
  await browser.start(email); const original = await localCode(email);
  // Preserve a still-valid managed code while failing only the replacement request.
  const subject = secrets(harness.config.sessionKey, harness.config.installationId).rate(`send-email:${email}`);
  await harness.admin.query("delete from rise_private.auth_limits where subject_hash = $1", [subject]);
  requestFailure = true;
  try {
    const sent = await browser.request("auth/code", { email, remember: false }); assert.equal(sent.statusCode, 202);
    assert.deepEqual(Object.keys(sent.json()).sort(), ["challenge", "expiresAt", "resendAt", "retryAfter"]);
    assert.equal((await browser.request("auth/verify", { challenge: sent.json().challenge, code: original.code })).statusCode, 422);
    assert.equal((await browser.read()).json().signedIn, false);
  } finally { requestFailure = false; }
});
test("a copied session without its context and corrupted stored tokens fail closed", async () => {
  const browser = new AuthBrowser(harness), other = new AuthBrowser(harness); await browser.login(); await other.read();
  other.cookies.set("rise_test_session", sid(browser));
  assert.equal((await other.read()).json().signedIn, false); assert.equal((await browser.read()).json().signedIn, true);
  await harness.admin.query("update rise_private.server_sessions set provider_cipher = 'corrupt' where id_hash = $1", [hash(sid(browser))]);
  assert.equal((await browser.read()).statusCode, 503);
  assert.equal((await browser.request("logout", {})).statusCode, 200);
  assert.equal((await browser.read()).json().signedIn, false);
});
test("concurrent refresh rotates once, and temporary provider failures preserve the session", async () => {
  const browser = new AuthBrowser(harness); await browser.login(); const row = await privateRow(browser);
  await harness.admin.query("update rise_private.server_sessions set access_expires_at = now() - interval '1 second' where id_hash = $1", [row.id_hash]);
  const before = refreshCalls;
  const results = await Promise.all(Array.from({ length: 6 }, () => browser.read()));
  assert.ok(results.every(result => result.statusCode === 200 && result.json().signedIn)); assert.equal(refreshCalls - before, 1);
  const refreshed = await privateRow(browser); assert.equal(refreshed.provider_cipher === row.provider_cipher, false);
  await harness.admin.query("update rise_private.server_sessions set access_expires_at = now() - interval '1 second' where id_hash = $1", [row.id_hash]);
  refreshFailure = true;
  try { assert.equal((await browser.read()).statusCode, 503); assert.equal((await privateRow(browser)).revoked_at, null); }
  finally { refreshFailure = false; }
  assert.equal((await browser.read()).json().signedIn, true);
});
test("private session tables and helper ownership remain closed to anonymous/worker identities", async () => {
  const client = await harness.admin.connect();
  try {
    for (const role of ["anon", "authenticated"]) {
      await client.query("begin");
      try { await client.query(`set local role ${role}`); await assert.rejects(client.query("select * from rise_private.server_sessions"), rejected); }
      finally { await client.query("rollback"); }
    }
    const privateState = JSON.parse(await readFile(".rise-infra/test/state.json", "utf8"));
    for (const role of ["worker", "lifecycle"]) {
      const runtime = new pg.Client({ ...harness.config.database, user: `rise_${role}_login`, password: privateState.passwords[role] });
      await runtime.connect(); try { await assert.rejects(runtime.query("select * from rise_private.server_sessions"), rejected); } finally { await runtime.end(); }
    }
    await client.query("begin"); try { await client.query("set local role anon"); await assert.rejects(client.query("select rise_private.active_session()"), rejected); } finally { await client.query("rollback"); }
    const guard = (await client.query("select rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname = 'rise_session_guard'")).rows[0];
    assert.equal(guard.rolcanlogin || guard.rolbypassrls || guard.rolsuper, false);
    assert.equal((await client.query("select has_column_privilege('rise_session_guard', 'auth.users', 'encrypted_password', 'select') as forbidden")).rows[0].forbidden, false);
    const logs = JSON.stringify(harness.logs); assert.equal(/example\.invalid|Bearer |csrfToken|provider_cipher/.test(logs), false);
  } finally { client.release(); }
});
