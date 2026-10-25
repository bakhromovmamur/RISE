import { beginPrivateRequest } from "../pwa/requestHold";
import type { AccountSession, CodeChallenge } from "../contracts/auth.ts";
import { parseDeletionStatus } from "../contracts/accountLifecycle";

export class AccountError extends Error {
  readonly code: string;
  readonly retryAfter: number;
  constructor(code: string, retryAfter = 0) { super(code); this.code = code; this.retryAfter = retryAfter; }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const token = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const instant = (value: unknown): value is string => typeof value === "string" && value.length < 40 && Number.isFinite(Date.parse(value));
export function parseAccountSession(value: unknown): AccountSession {
  if (!record(value) || !only(value, ["signedIn", "csrfToken", "delivery", "localInbox", "reason", "account", "deletion"]) || typeof value.signedIn !== "boolean" || !token(value.csrfToken)
    || !["email", "local-inbox"].includes(String(value.delivery)) || value.reason !== undefined && !["expired","deleted"].includes(String(value.reason))) throw new AccountError("unavailable");
  if (value.delivery === "local-inbox" && !["http://127.0.0.1:55324", "http://127.0.0.1:55424"].includes(String(value.localInbox))) throw new AccountError("unavailable");
  const account = value.account;
  if (value.signedIn) {
    if(value.reason!==undefined||value.deletion!==undefined)throw new AccountError("unavailable");
    if (!record(account) || !only(account, ["id", "email", "remembered", "authenticatedAt", "expiresAt"]) || typeof account.id !== "string" || !/^[0-9a-f-]{36}$/.test(account.id)
      || typeof account.email !== "string" || account.email.length > 254 || typeof account.remembered !== "boolean" || !instant(account.authenticatedAt) || !instant(account.expiresAt)) throw new AccountError("unavailable");
    return { signedIn: true, csrfToken: value.csrfToken, delivery: value.delivery === "email" ? "email" : "local-inbox", ...(value.delivery === "local-inbox" ? { localInbox: String(value.localInbox) } : {}), account: { id: account.id, email: account.email, remembered: account.remembered, authenticatedAt: account.authenticatedAt, expiresAt: account.expiresAt } };
  }
  if (account !== undefined) throw new AccountError("unavailable");
  if(value.reason==="deleted"){
    try{return {...parseAccountSession({...value,reason:undefined,deletion:undefined}),reason:"deleted",deletion:parseDeletionStatus(value.deletion)};}
    catch{throw new AccountError("unavailable");}
  }
  if(value.deletion!==undefined)throw new AccountError("unavailable");
  return { signedIn: false, csrfToken: value.csrfToken, delivery: value.delivery === "email" ? "email" : "local-inbox", ...(value.delivery === "local-inbox" ? { localInbox: String(value.localInbox) } : {}), ...(value.reason === "expired" ? { reason: "expired" } : {}) };
}
export async function accountApi(path: string, options: { body?: object; csrf?: string; signal?: AbortSignal } = {}): Promise<unknown> {
  if(options.signal?.aborted)throw new AccountError("unavailable");
  const finish = beginPrivateRequest();
  if (!finish) throw new AccountError("unavailable");
  try { return await sendAccountRequest(path, options); } finally { finish(); }
}
async function sendAccountRequest(path: string, options: { body?: object; csrf?: string; signal?: AbortSignal }): Promise<unknown> {
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);options.signal?.addEventListener("abort",abort,{once:true});
  let response: Response;
  try { response = await fetch(`/api/v1/${path}`, { method: options.body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: options.body ? { "Content-Type": "application/json", "X-Rise-CSRF": options.csrf ?? "" } : {}, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }); }
  catch (error) { if (options.signal?.aborted) throw error; throw new AccountError("unavailable"); }
  finally{clearTimeout(timer);options.signal?.removeEventListener("abort",abort);}
  if (!response.headers.get("Content-Type")?.includes("application/json")) throw new AccountError("unavailable");
  let data: unknown;
  try { data = await response.json(); } catch { throw new AccountError("unavailable"); }
  if (!response.ok) {
    const code = record(data) && record(data.error) && typeof data.error.code === "string" ? data.error.code : "unavailable";
    const allowed = ["invalid_input", "invalid_code", "csrf_rejected", "sign_out_first", "rate_limited", "unavailable", "recent_auth_required", "sign_in_required", "account_changed", "ownership_resolution_required", "initialize_required", "export_too_large", "cancellation_review_required", "group_unavailable", "group_changed", "group_archived", "owner_required", "member_unavailable", "invitation_unavailable", "invitation_limit", "already_member", "group_limit", "operation_reused", "operation_expired", "account_mismatch", "revision_limit", "shared_unavailable", "shared_archived", "shared_limit", "occurrence_unavailable"];
    allowed.push('squad_unavailable','squad_changed','squad_preview_expired','squad_preview_limit','squad_snapshot_limit','squad_limit','author_required','squad_source_changed');
    const retry = Number(response.headers.get("Retry-After"));
    throw new AccountError(allowed.includes(code) ? code : "unavailable", Number.isInteger(retry) && retry > 0 && retry <= 86400 ? retry : 0);
  }
  return data;
}
const api=accountApi;
export const getAccountSession = async (signal?: AbortSignal) => parseAccountSession(await api("session", { signal }));
export async function requestCode(email: string, remember: boolean, csrf: string, signal?: AbortSignal): Promise<CodeChallenge> {
  const value = await api("auth/code", { body: { email, remember }, csrf, signal });
  if (!record(value) || !only(value, ["challenge", "resendAt", "expiresAt", "retryAfter"]) || !token(value.challenge) || !instant(value.resendAt) || !instant(value.expiresAt) || value.retryAfter !== 60) throw new AccountError("unavailable");
  return { challenge: value.challenge, resendAt: value.resendAt, expiresAt: value.expiresAt, retryAfter: 60 };
}
export const verifyCode = (challenge: string, code: string, csrf: string, signal?: AbortSignal) => api("auth/verify", { body: { challenge, code }, csrf, signal });
export const signOut = (csrf: string, signal?: AbortSignal) => api("logout", { body: {}, csrf, signal });
export async function reauthenticate(owner:string,csrf:string,signal?:AbortSignal):Promise<CodeChallenge>{
  const value=await api("auth/reauth/code",{body:{accountId:owner},csrf,signal});
  if(!record(value)||!only(value,["challenge","resendAt","expiresAt","retryAfter"])||!token(value.challenge)||!instant(value.resendAt)||!instant(value.expiresAt)||value.retryAfter!==60)throw new AccountError("unavailable");
  return {challenge:value.challenge,resendAt:value.resendAt,expiresAt:value.expiresAt,retryAfter:60};
}
export const verifyReauthentication=(owner:string,challenge:string,code:string,csrf:string,signal?:AbortSignal)=>api("auth/reauth/verify",{body:{accountId:owner,challenge,code},csrf,signal});
