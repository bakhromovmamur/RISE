import type { ServerConfig } from "../config.ts";

export class ProviderError extends Error {
  readonly temporary: boolean;
  constructor(temporary: boolean) { super(temporary ? "auth_provider_unavailable" : "auth_provider_rejected"); this.temporary = temporary; }
}
export interface ProviderSession { accessToken: string; refreshToken: string; expiresAt: number; userId: string; sessionId: string; email: string }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
export function readTokens(value: unknown): ProviderSession {
  if (!object(value) || typeof value.accessToken !== "string" || typeof value.refreshToken !== "string" || typeof value.email !== "string"
    || value.email.length > 254 || !uuid(value.userId) || !uuid(value.sessionId) || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)) throw new ProviderError(true);
  return { accessToken: value.accessToken, refreshToken: value.refreshToken, email: value.email, userId: value.userId, sessionId: value.sessionId, expiresAt: value.expiresAt };
}
export function provider(config: ServerConfig) {
  async function call(path: string, body?: object, token?: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${config.providerUrl}/auth/v1/${path}`, { method: body ? "POST" : "GET", headers: { apikey: config.publishableKey, ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(5000) });
    } catch { throw new ProviderError(true); }
    if (!response.ok) throw new ProviderError(response.status >= 500 || response.status === 429);
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw new ProviderError(true); }
  }
  async function verified(value: unknown): Promise<ProviderSession> {
    if (!object(value) || typeof value.access_token !== "string" || typeof value.refresh_token !== "string" || value.access_token.length > 16384 || value.refresh_token.length > 4096) throw new ProviderError(true);
    // getUser verifies the provider signature; decoded claims below are never used without it.
    const user = await call("user", undefined, value.access_token);
    if (!object(user) || !uuid(user.id) || typeof user.email !== "string" || !user.email_confirmed_at) throw new ProviderError(false);
    let claims: unknown;
    try { claims = JSON.parse(Buffer.from(value.access_token.split(".")[1], "base64url").toString()); } catch { throw new ProviderError(false); }
    if (!object(claims) || claims.sub !== user.id || !uuid(claims.session_id) || claims.iss !== `${config.providerUrl}/auth/v1`
      || claims.role !== "authenticated" || typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) throw new ProviderError(false);
    return readTokens({ accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: claims.exp * 1000, userId: user.id, sessionId: claims.session_id, email: user.email });
  }
  return {
    request: (email: string,createUser=true) => call("otp", { email, create_user: createUser }),
    verify: async (email: string, code: string) => verified(await call("verify", { email, token: code, type: "email" })),
    refresh: async (token: string) => verified(await call("token?grant_type=refresh_token", { refresh_token: token })),
    logout: (token: string) => call("logout?scope=local", {}, token),
  };
}
export type AuthProvider = ReturnType<typeof provider>;
