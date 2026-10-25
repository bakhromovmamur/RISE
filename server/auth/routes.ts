import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerConfig } from "../config.ts";
import { Sessions, AuthError, type AuthResult } from "./sessions.ts";
import { validOpaque } from "./crypto.ts";

export function cookiePolicy(config: Pick<ServerConfig, "origin" | "environment">) {
  const secure = new URL(config.origin).protocol === "https:";
  if (!secure && config.environment !== "local" && config.environment !== "test") throw new Error("secure_auth_origin_required");
  const prefix = secure ? "__Host-rise" : `rise_${config.environment}`;
  return { session: `${prefix}_session`, context: `${prefix}_context`, secure };
}
function cookieValue(request: FastifyRequest, name: string) {
  const values = (request.headers.cookie ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(`${name}=`)).map(value => value.slice(name.length + 1));
  return values.length === 1 && validOpaque(values[0]) ? values[0] : null;
}
function body(request: FastifyRequest, keys: readonly string[]): Record<string, unknown> {
  const value = request.body;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new AuthError(422, "invalid_input");
  return value as Record<string, unknown>;
}
export const sessionInput = (request: FastifyRequest, config: ServerConfig) => {
  const names = cookiePolicy(config);
  return { context: cookieValue(request, names.context), session: cookieValue(request, names.session), csrf: request.headers["x-rise-csrf"], ip: request.ip };
};
export const protectedSessionRoute = (config: ServerConfig, run: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>, mutation = false, family = "auth") => async (request: FastifyRequest, reply: FastifyReply) => {
  reply.header("Cache-Control", "no-store").header("Vary", "Cookie");
  try {
    if (mutation && (request.headers.origin !== config.origin || request.headers["sec-fetch-site"] === "cross-site" || request.headers["content-type"]?.split(";")[0].trim() !== "application/json")) throw new AuthError(403, "csrf_rejected");
    return await run(request, reply);
  } catch (error) {
    const fault = error instanceof AuthError ? error : new AuthError(503, "unavailable");
    if (fault.retryAfter) reply.header("Retry-After", String(fault.retryAfter));
    return reply.code(fault.status).send({ error: { code: fault.code, messageKey: `${family}.${fault.code}`, retryable: fault.status === 503 || fault.status === 429, requestId: request.id, ...(fault.retryAfter ? { retryAfter: fault.retryAfter } : {}) } });
  }
};
export function authRoutes(app: FastifyInstance, config: ServerConfig, sessions: Sessions) {
  const names = cookiePolicy(config);
  const input = (request: FastifyRequest) => sessionInput(request, config);
  const cookies = (reply: FastifyReply, result: AuthResult, contextOnly = false) => {
    const value = (name: string, data: string, age: number | null) => `${name}=${data}; Path=/; HttpOnly; SameSite=Lax${names.secure ? "; Secure" : ""}${age === null ? "" : `; Max-Age=${age}`}`;
    reply.header("Set-Cookie", [value(names.context, result.context, result.maxAge), ...(contextOnly ? [] : [value(names.session, result.session ?? "", result.session ? result.maxAge : 0)])]);
  };
  const handle = (run: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>, mutation = false) => protectedSessionRoute(config, run, mutation);
  // Reads never overwrite/clear a session cookie: a slow old tab cannot erase a newer sign-in.
  app.get("/api/v1/session", handle(async (request, reply) => { const result = await sessions.read(input(request)); if (result.fresh) cookies(reply, result, true); return result.view; }));
  app.post("/api/v1/auth/code", { bodyLimit: 2048 }, handle(async (request, reply) => {
    const value = body(request, ["email", "remember"]);
    if (typeof value.email !== "string" || value.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.email.trim()) || typeof value.remember !== "boolean") throw new AuthError(422, "invalid_input");
    const result = await sessions.request(input(request), value.email.trim().toLowerCase(), value.remember);
    return reply.code(202).send(result);
  }, true));
  app.post("/api/v1/auth/verify", { bodyLimit: 2048 }, handle(async (request, reply) => {
    const value = body(request, ["challenge", "code"]);
    if (!validOpaque(value.challenge) || typeof value.code !== "string" || !/^\d{6}$/.test(value.code)) throw new AuthError(422, "invalid_input");
    const result = await sessions.verify(input(request), value.challenge, value.code); cookies(reply, result); return { verified: true };
  }, true));
  app.post("/api/v1/auth/reauth/code",{bodyLimit:2048},handle(async(request,reply)=>{
    const value=body(request,["accountId"]);
    if(typeof value.accountId!=="string")throw new AuthError(422,"invalid_input");
    return reply.code(202).send(await sessions.requestReauthentication(input(request),value.accountId));
  },true));
  app.post("/api/v1/auth/reauth/verify",{bodyLimit:2048},handle(async(request,reply)=>{
    const value=body(request,["accountId","challenge","code"]);
    if(typeof value.accountId!=="string"||!validOpaque(value.challenge)||typeof value.code!=="string"||!/^\d{6}$/.test(value.code))throw new AuthError(422,"invalid_input");
    const result=await sessions.verify(input(request),value.challenge,value.code,value.accountId);cookies(reply,result);return {verified:true};
  },true));
  app.post("/api/v1/logout", { bodyLimit: 2048 }, handle(async (request, reply) => { body(request, []); const result = await sessions.logout(input(request)); cookies(reply, result); return { signedOut: true }; }, true));
}
