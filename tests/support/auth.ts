import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";
import { loadConfig } from "../../server/config.ts";
import { database } from "../../server/database.ts";
import { createApp } from "../../server/app.ts";
import { Sessions } from "../../server/auth/sessions.ts";
import { provider, type AuthProvider } from "../../server/auth/provider.ts";

export const syntheticEmail = () => `auth-${randomUUID()}@example.invalid`;
export async function localCode(email: string, except: string[] = []) {
  if (!/^auth-[a-z0-9-]+@example\.invalid$/.test(email)) throw new Error("synthetic_auth_email_required");
  for (let attempt = 0; attempt < 100; attempt++) {
    const list = await (await fetch("http://127.0.0.1:55424/api/v1/messages", { signal: AbortSignal.timeout(2000) })).json();
    if (list && typeof list === "object" && "messages" in list && Array.isArray(list.messages)) {
      const messages: unknown[] = list.messages;
      const mail = messages.find((item): item is { ID: string } => !!item && typeof item === "object" && "ID" in item && typeof item.ID === "string" && !except.includes(item.ID) && "To" in item && Array.isArray(item.To) && item.To.some((to: unknown) => !!to && typeof to === "object" && "Address" in to && to.Address === email));
      if (mail) {
        const body = await (await fetch(`http://127.0.0.1:55424/api/v1/message/${encodeURIComponent(mail.ID)}`, { signal: AbortSignal.timeout(2000) })).json();
        if (body && typeof body === "object" && "Text" in body && typeof body.Text === "string") {
          const code = body.Text.match(/\b\d{6}\b/)?.[0]; if (code) return { code, id: String(mail.ID) };
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error("synthetic_code_not_received"); // Never include the address, body, token or code in diagnostics.
}
export async function authHarness(adapt?: (real: AuthProvider) => AuthProvider) {
  const env = parseEnv(await readFile(".rise-infra/test/server.env", "utf8")), config = loadConfig(env);
  if (config.environment !== "test") throw new Error("isolated_test_config_required");
  const status = JSON.parse(await readFile(".rise-infra/test/admin-status.json", "utf8")), adminUrl = new URL(status.DB_URL);
  if (adminUrl.hostname !== "127.0.0.1" || adminUrl.port !== "55422") throw new Error("isolated_admin_required");
  const admin = new pg.Pool({ connectionString: adminUrl.href, max: 2 }), store = database(config);
  await store.verify(); const real = provider(config), sessions = new Sessions(config, store.pool, adapt?.(real) ?? real);
  const logs: object[] = [], app = await createApp(config, store.verify, entry => logs.push(entry), sessions);
  return { app, admin, store, config, real, logs, close: async () => { await app.close(); await store.close(); await admin.end(); } };
}
let addresses = 1;
const testSubnet = randomBytes(2);
export class AuthBrowser {
  readonly cookies = new Map<string, string>();
  csrf = "";
  readonly ip = `127.${testSubnet[0]}.${testSubnet[1]}.${addresses++}`;
  readonly harness: Awaited<ReturnType<typeof authHarness>>;
  constructor(harness: Awaited<ReturnType<typeof authHarness>>) { this.harness = harness; }
  async request(path: string, payload?: object, headers: Record<string, string> = {}) {
    const result = await this.harness.app.inject({ method: payload ? "POST" : "GET", url: `/api/v1/${path}`, remoteAddress: this.ip,
      headers: { host: "127.0.0.1:4191", ...(payload ? { origin: this.harness.config.origin, "x-rise-csrf": this.csrf } : {}), cookie: this.cookieHeader(), ...headers }, ...(payload ? { payload } : {}) });
    for (const cookie of result.cookies) { if (cookie.maxAge === 0) this.cookies.delete(cookie.name); else this.cookies.set(cookie.name, cookie.value); }
    return result;
  }
  cookieHeader() { return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "); }
  async read() { const response = await this.request("session"); if (response.statusCode === 200) this.csrf = response.json().csrfToken; return response; }
  async start(email: string, remember = false) { await this.read(); return this.request("auth/code", { email, remember }); }
  async login(email = syntheticEmail(), remember = false) {
    const sent = await this.start(email, remember);
    if (sent.statusCode !== 202) throw new Error("synthetic_request_failed");
    const mail = await localCode(email), verified = await this.request("auth/verify", { challenge: sent.json().challenge, code: mail.code });
    if (verified.statusCode !== 200) throw new Error("synthetic_verify_failed");
    const session = await this.read(); if (session.statusCode !== 200 || !session.json().signedIn) throw new Error("synthetic_session_failed");
    return { email, session, verified };
  }
}
