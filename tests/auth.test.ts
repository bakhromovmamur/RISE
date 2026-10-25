import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { secrets, hash } from "../server/auth/crypto.ts";
import { parseAccountSession } from "../src/auth/client.ts";
import { cookiePolicy } from "../server/auth/routes.ts";
import type { ServerConfig } from "../server/config.ts";

test("provider token encryption authenticates environment, session and ciphertext", () => {
  const secret = randomBytes(32), crypto = secrets(secret, "synthetic-installation"), value = { token: "synthetic-token", note: "synthetic-email@example.invalid" };
  const cipher = crypto.seal(value, "session:first"); assert.equal(cipher.includes(value.token), false);
  assert.deepEqual(crypto.open(cipher, "session:first"), value);
  assert.throws(() => crypto.open(cipher, "session:other"));
  assert.throws(() => secrets(secret, "other-installation").open(cipher, "session:first"));
  assert.throws(() => secrets(randomBytes(32), "synthetic-installation").open(cipher, "session:first"));
  const parts = cipher.split("."); parts[3] = (parts[3][0] === "a" ? "b" : "a") + parts[3].slice(1);
  assert.throws(() => crypto.open(parts.join("."), "session:first"));
  assert.equal(hash("synthetic-cookie").length, 32);
});
test("CSRF tokens bind the browser context to the current session and use a separate purpose key", () => {
  const crypto = secrets(randomBytes(32), "synthetic-installation");
  assert.equal(crypto.equal(crypto.csrf("browser", null), crypto.csrf("browser", null)), true);
  assert.equal(crypto.equal(crypto.csrf("browser", null), crypto.csrf("another", null)), false);
  assert.equal(crypto.equal(crypto.csrf("browser", null), crypto.csrf("browser", "signed-in")), false);
  assert.equal(crypto.equal(crypto.csrf("browser", null), "malformed"), false);
  assert.equal(crypto.rate("browser").toString("hex") === crypto.csrf("browser", null), false);
});
test("hosted cookie policy always uses Secure Host names; local HTTP uses separate explicit development names", () => {
  const config = (environment: ServerConfig["environment"], origin: string) => ({ environment, origin });
  assert.deepEqual(cookiePolicy(config("production", "https://habit.saraftech.com")), { context: "__Host-rise_context", session: "__Host-rise_session", secure: true });
  assert.throws(() => cookiePolicy(config("production", "http://habit.saraftech.com")));
  assert.equal(cookiePolicy(config("test", "http://127.0.0.1:4191")).session, "rise_test_session");
  assert.equal(cookiePolicy(config("local", "http://127.0.0.1:4190")).session, "rise_local_session");
});
test("browser session metadata validates identity shape and refuses credential-bearing provider responses", () => {
  const guest = { signedIn: false, csrfToken: "a".repeat(64), delivery: "email" };
  assert.equal(parseAccountSession(guest).signedIn, false);
  const account = { id: "00000000-0000-4000-8000-000000000001", email: "synthetic@example.invalid", remembered: false, authenticatedAt: "2026-10-21T12:00:00Z", expiresAt: "2026-10-21T12:30:00Z" };
  assert.equal(parseAccountSession({ ...guest, signedIn: true, account }).account?.email, account.email);
  for (const value of [{ ...guest, account }, { ...guest, access_token: "synthetic" }, { ...guest, csrfToken: "bad" }, { ...guest, signedIn: true }, { ...guest, delivery: "local-inbox", localInbox: "https://foreign.invalid" }]) assert.throws(() => parseAccountSession(value));
});
