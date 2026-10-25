import type pg from "pg";
import type { ServerConfig } from "../config.ts";
import type { AccountSession, CodeChallenge } from "../../src/contracts/auth.ts";
import { hash, opaque, secrets, validOpaque } from "./crypto.ts";
import { provider, ProviderError, readTokens, type AuthProvider, type ProviderSession } from "./provider.ts";
import { deletionStatus, queueDeletion } from "../lifecycle/repository.ts";
import type { DeletionStatus } from "../../src/contracts/accountLifecycle.ts";
import { retireOwnerPush } from "../push/repository.ts";
import { lock } from "../personal/repository.ts";

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number;
  constructor(status: number, code: string, retryAfter = 0) { super(code); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}
export interface AuthInput { context: string | null; session: string | null; csrf?: unknown; ip: string }
export interface AuthResult { view: AccountSession; context: string; session: string | null; maxAge: number | null; fresh?: boolean }
interface Failure { failure: AuthError }
interface SessionRow {
  user_id: string; provider_session_id: string; provider_cipher: string | null; remembered: boolean;
  authenticated_at: Date; idle_expires_at: Date; absolute_expires_at: Date; revoked_at: Date | null; access_expires_at: Date;
}
const failed = (status: number, code: string, retryAfter = 0): Failure => ({ failure: new AuthError(status, code, retryAfter) });
function outcome<T extends object>(result: T | Failure): T { if ("failure" in result) throw result.failure; return result; }
const sessionSeconds = (remembered: boolean) => ({ idle: remembered ? 7 * 86400 : 1800, absolute: remembered ? 30 * 86400 : 12 * 3600 });

/** Owns challenges, serialized refresh, revocation and session policy. Never owns guest journey state. */
export class Sessions {
  private readonly crypto;
  private readonly auth: AuthProvider;
  private readonly config: ServerConfig;
  private readonly pool: pg.Pool;
  constructor(config: ServerConfig, pool: pg.Pool, auth?: AuthProvider) { this.config = config; this.pool = pool; this.crypto = secrets(config.sessionKey, config.installationId); this.auth = auth ?? provider(config); }
  private async transaction<T>(run: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query("begin"); const result = await run(client); await client.query("commit"); return result; }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  }
  private async limit(client: pg.PoolClient, subject: string, seconds: number, maximum: number) {
    const key = this.crypto.rate(subject);
    await client.query("select pg_advisory_xact_lock($1::bigint)", [this.crypto.rate(`${subject}:${seconds}`).readBigInt64BE().toString()]);
    const { rows } = await client.query(`select coalesce(sum(attempts), 0)::int as attempts,
      greatest(1, ceil(extract(epoch from min(window_start) + $2 * interval '1 second' - clock_timestamp())))::int as retry
      from rise_private.auth_limits where subject_hash = $1 and window_seconds = $2 and window_start > clock_timestamp() - $2 * interval '1 second'`, [key, seconds]);
    if (rows[0].attempts >= maximum) return failed(429, "rate_limited", rows[0].retry ?? seconds);
    await client.query(`insert into rise_private.auth_limits (subject_hash, window_seconds, window_start, attempts) values ($1, $2, clock_timestamp(), 1)
      on conflict (subject_hash, window_seconds, window_start) do update set attempts = rise_private.auth_limits.attempts + 1`, [key, seconds]);
    return null;
  }
  private async freshContext(client: pg.PoolClient, seconds = 1200) {
    const value = opaque(); await client.query("insert into rise_private.auth_contexts (id_hash, expires_at) values ($1, now() + $2 * interval '1 second')", [hash(value), seconds]); return value;
  }
  private metadata(context: string, session: string | null): AccountSession {
    const local = this.config.environment === "local" || this.config.environment === "test";
    return { signedIn: false, csrfToken: this.crypto.csrf(context, session), delivery: local ? "local-inbox" : "email", ...(local ? { localInbox: `http://127.0.0.1:${this.config.environment === "local" ? 55324 : 55424}` } : {}) };
  }
  private async csrf(client: pg.PoolClient, input: AuthInput) {
    if (!validOpaque(input.context) || !this.crypto.equal(this.crypto.csrf(input.context, input.session), input.csrf)) throw new AuthError(403, "csrf_rejected");
    const row = await client.query("select 1 from rise_private.auth_contexts where id_hash = $1 and expires_at > now() for update", [hash(input.context)]);
    if (!row.rowCount) throw new AuthError(403, "csrf_rejected");
    return input.context;
  }
  private async signedIn(client: pg.PoolClient, input: AuthInput) {
    if (!input.session || !input.context) return false;
    return !!(await client.query("select 1 from rise_private.server_sessions where id_hash = $1 and context_hash = $2 and revoked_at is null and idle_expires_at > now() and absolute_expires_at > now()", [hash(input.session), hash(input.context)])).rowCount;
  }
  private async active(client: pg.PoolClient, row: SessionRow) {
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: row.user_id, session_id: row.provider_session_id })]);
    return (await client.query("select rise_private.active_session() as active")).rows[0].active === true;
  }
  private async revoke(client: pg.PoolClient, value: string) { await client.query("update rise_private.server_sessions set revoked_at = coalesce(revoked_at, now()), provider_cipher = null where id_hash = $1", [hash(value)]); }
  private async terminalReceipt(client:pg.PoolClient,input:AuthInput,deletion:DeletionStatus):Promise<AuthResult>{
    const context=input.context!;
    // This anonymous CSRF context grants no account access; it permits a later
    // deliberate sign-in even after the old account's contexts were purged.
    await client.query("insert into rise_private.auth_contexts(id_hash,expires_at) values($1,now()+interval '20 minutes') on conflict(id_hash) do update set expires_at=greatest(rise_private.auth_contexts.expires_at,excluded.expires_at)",[hash(context)]);
    return {context,session:null,maxAge:1200,view:{...this.metadata(context,input.session),reason:"deleted",deletion}};
  }
  async read(input: AuthInput): Promise<AuthResult> {
    return outcome(await this.transaction<AuthResult | Failure>(async client => {
      const deleted=await this.deleted(client,input);
      if(deleted&&input.context)return this.terminalReceipt(client,input,deleted);
      // Bounded opportunistic cleanup. No private journey tables or browser records are touched.
      await client.query("delete from rise_private.auth_challenges where context_hash in (select context_hash from rise_private.auth_challenges where expires_at < now() limit 100)");
      await client.query("delete from rise_private.auth_contexts where id_hash in (select id_hash from rise_private.auth_contexts where expires_at < now() limit 100)");
      await client.query("delete from rise_private.auth_limits where (subject_hash, window_seconds, window_start) in (select subject_hash, window_seconds, window_start from rise_private.auth_limits where window_start < now() - interval '2 days' limit 100)");
      let context = input.context;
      const existing = context ? await client.query("select 1 from rise_private.auth_contexts where id_hash = $1 and expires_at > now()", [hash(context)]) : null;
      const fresh = !existing?.rowCount;
      if (!existing?.rowCount) {
        const limit = await this.limit(client, `context:${input.ip}`, 60, 30); if (limit) return limit;
        context = await this.freshContext(client);
      }
      if (!context) throw new AuthError(503, "unavailable");
      const base = { context, session: null, maxAge: 1200, fresh, view: this.metadata(context, input.session) };
      if (!input.session) return base;
      const result = await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash = $1 and context_hash = $2 for update", [hash(input.session), hash(context)]);
      const row = result.rows[0];
      if (!row || row.revoked_at || !row.provider_cipher || !await this.active(client, row)) {
        if (row) await this.revoke(client, input.session);
        const terminal=await this.deleted(client,input);if(terminal)return this.terminalReceipt(client,input,terminal);
        return { ...base, view: { ...base.view, reason: "expired" } };
      }
      let tokens = readTokens(this.crypto.open(row.provider_cipher, `session:${hash(input.session).toString("hex")}`));
      if (tokens.userId !== row.user_id || tokens.sessionId !== row.provider_session_id) throw new AuthError(503, "unavailable");
      if (row.access_expires_at.getTime() < Date.now() + 60000) {
        try {
          const refreshed = await this.auth.refresh(tokens.refreshToken);
          if (refreshed.userId !== row.user_id || refreshed.sessionId !== row.provider_session_id) throw new ProviderError(false);
          tokens = refreshed;
          await client.query("update rise_private.server_sessions set provider_cipher = $2, access_expires_at = $3 where id_hash = $1", [hash(input.session), this.crypto.seal(tokens, `session:${hash(input.session).toString("hex")}`), new Date(tokens.expiresAt)]);
        } catch (error) {
          if (!(error instanceof ProviderError) || error.temporary) throw new AuthError(503, "unavailable");
          await this.revoke(client, input.session); return { ...base, view: { ...base.view, reason: "expired" } };
        }
      }
      const updated = await client.query<SessionRow>("update rise_private.server_sessions set last_seen_at = now(), idle_expires_at = least(absolute_expires_at, now() + $2 * interval '1 second') where id_hash = $1 returning *", [hash(input.session), sessionSeconds(row.remembered).idle]);
      const current = updated.rows[0];
      if(!await this.active(client,current)){
        await this.revoke(client,input.session);const deleted=await this.deleted(client,input);
        return deleted?this.terminalReceipt(client,input,deleted):{...base,view:{...base.view,reason:"expired"}};
      }
      return { context, session: input.session, maxAge: row.remembered ? Math.max(1, Math.floor((current.absolute_expires_at.getTime() - Date.now()) / 1000)) : null,
        view: { ...this.metadata(context, input.session), signedIn: true, account: { id: row.user_id, email: tokens.email, remembered: row.remembered, authenticatedAt: current.authenticated_at.toISOString(), expiresAt: current.idle_expires_at.toISOString() } } };
    }));
  }
  private async deleted(client:pg.PoolClient,input:AuthInput):Promise<DeletionStatus|null>{
    if(!validOpaque(input.context)||!validOpaque(input.session))return null;
    const result=await client.query(`select j.* from rise_private.deleted_sessions s join rise_private.deletion_jobs j using(user_id) where s.id_hash=$1 and s.context_hash=$2`,[hash(input.session),hash(input.context)]);
    return result.rowCount?deletionStatus(result.rows[0]):null;
  }
  async requestReauthentication(input:AuthInput,owner:string):Promise<CodeChallenge>{
    const current=await this.read(input),account=current.view.account;
    if(!account||account.id!==owner)throw new AuthError(401,"sign_in_required");
    return this.request(input,account.email.toLowerCase(),account.remembered,owner);
  }
  async request(input: AuthInput, email: string, remembered: boolean, reauthOwner?:string): Promise<CodeChallenge> {
    return outcome(await this.transaction<CodeChallenge | Failure>(async client => {
      const context = await this.csrf(client, input);
      if(reauthOwner){
        const row=(await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash=$1 and context_hash=$2 for update",[hash(input.session!),hash(context)])).rows[0];
        if(!row||row.user_id!==reauthOwner||!await this.active(client,row))return failed(401,"sign_in_required");
      }else if (await this.signedIn(client, input)) return failed(409, "sign_out_first");
      for (const [subject, seconds, maximum] of [[`send-ip:${input.ip}`, 3600, 100], [`send-email:${email}`, 60, 1], [`send-email:${email}`, 3600, 5], [`send-context:${context}`, 3600, 10]] as const) {
        const limit = await this.limit(client, subject, seconds, maximum); if (limit) return limit;
      }
      const challenge = opaque(), binding = `challenge:${hash(context).toString("hex")}:${hash(challenge).toString("hex")}`;
      const dates = await client.query("select now() + interval '60 seconds' as resend, now() + interval '10 minutes' as expires");
      await client.query(`insert into rise_private.auth_challenges (context_hash, challenge_hash, encrypted_email, remembered, attempts, provider_ready, expires_at,purpose,bound_user_id,bound_session_hash)
        values ($1, $2, $3, $4, 0, false, $5,$6,$7,$8) on conflict (context_hash) do update set challenge_hash = excluded.challenge_hash, encrypted_email = excluded.encrypted_email, remembered = excluded.remembered, attempts = 0, provider_ready = false, expires_at = excluded.expires_at,purpose=excluded.purpose,bound_user_id=excluded.bound_user_id,bound_session_hash=excluded.bound_session_hash`, [hash(context), hash(challenge), this.crypto.seal(email, binding), remembered, dates.rows[0].expires,reauthOwner?"reauth":"signin",reauthOwner??null,reauthOwner?hash(input.session!):null]);
      // Never reveal whether an account exists, whether it was created, or the provider's error.
      try { await this.auth.request(email,!reauthOwner); await client.query("update rise_private.auth_challenges set provider_ready = true where context_hash = $1", [hash(context)]); } catch { /* Neutral response; verification/resend remains available. */ }
      return { challenge, resendAt: dates.rows[0].resend.toISOString(), expiresAt: dates.rows[0].expires.toISOString(), retryAfter: 60 };
    }));
  }
  async verify(input: AuthInput, challenge: string, code: string, reauthOwner?:string): Promise<AuthResult> {
    return outcome(await this.transaction<AuthResult | Failure>(async client => {
      const context = await this.csrf(client, input);
      if(reauthOwner){
        if(!validOpaque(input.session))return failed(401,"sign_in_required");
        const row=(await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash=$1 and context_hash=$2 for update",[hash(input.session),hash(context)])).rows[0];
        if(!row||row.user_id!==reauthOwner||!await this.active(client,row))return failed(401,"sign_in_required");
      }else if (await this.signedIn(client, input)) return failed(409, "sign_out_first");
      for (const [subject, seconds, maximum] of [[`verify-ip:${input.ip}`, 900, 60], [`verify-context:${context}`, 900, 20]] as const) {
        const limit = await this.limit(client, subject, seconds, maximum); if (limit) return limit;
      }
      const result = await client.query("select *, expires_at > now() as live from rise_private.auth_challenges where context_hash = $1 and challenge_hash = $2 for update", [hash(context), hash(challenge)]);
      const row = result.rows[0];
      if (!row || !row.live || row.attempts >= 5 || row.purpose!==(reauthOwner?"reauth":"signin") || reauthOwner&&(row.bound_user_id!==reauthOwner||!Buffer.isBuffer(row.bound_session_hash)||!row.bound_session_hash.equals(hash(input.session!)))) return failed(422, "invalid_code");
      await client.query("update rise_private.auth_challenges set attempts = attempts + 1 where context_hash = $1", [hash(context)]);
      if (!row.provider_ready) return failed(422, "invalid_code");
      const email = this.crypto.open(row.encrypted_email, `challenge:${hash(context).toString("hex")}:${hash(challenge).toString("hex")}`);
      if (typeof email !== "string") throw new AuthError(503, "unavailable");
      let tokens: ProviderSession;
      try { tokens = await this.auth.verify(email, code); }
      catch (error) { return failed(error instanceof ProviderError && error.temporary ? 503 : 422, error instanceof ProviderError && error.temporary ? "unavailable" : "invalid_code"); }
      if (tokens.email.toLowerCase() !== email) return failed(422, "invalid_code");
      if(reauthOwner&&tokens.userId!==reauthOwner)return failed(422,"invalid_code");
      if((await client.query("select 1 from rise_private.deletion_ledger where user_id=$1",[tokens.userId])).rowCount)return failed(401,"sign_in_required");
      const value = opaque(), lifetime = sessionSeconds(row.remembered), nextContext = await this.freshContext(client, lifetime.absolute);
      await client.query(`insert into rise_private.server_sessions (id_hash, context_hash, user_id, provider_session_id, provider_cipher, access_expires_at, remembered, idle_expires_at, absolute_expires_at)
        values ($1, $2, $3, $4, $5, $6, $7, now() + $8 * interval '1 second', now() + $9 * interval '1 second')`, [hash(value), hash(nextContext), tokens.userId, tokens.sessionId, this.crypto.seal(tokens, `session:${hash(value).toString("hex")}`), new Date(tokens.expiresAt), row.remembered, lifetime.idle, lifetime.absolute]);
      await client.query("delete from rise_private.auth_contexts where id_hash = $1", [hash(context)]);
      return { context: nextContext, session: value, maxAge: row.remembered ? lifetime.absolute : null, view: this.metadata(nextContext, value) };
    }));
  }
  /** Intentional terminal transaction: unlike ordinary actor work, this commits
   * only after suppression has made this and every other session inactive. */
  async deleteAccount(input:AuthInput,owner:string,requestId:string,expectedRevision:number):Promise<DeletionStatus>{
    if(!validOpaque(input.context)||!validOpaque(input.session))throw new AuthError(401,"sign_in_required");
    const current=await this.read(input);
    if(current.view.reason==="deleted"&&current.view.deletion?.accountId===owner){
      if(!this.crypto.equal(this.crypto.csrf(input.context,input.session),input.csrf))throw new AuthError(403,"csrf_rejected");
      if(current.view.deletion.requestId!==requestId)throw new AuthError(409,"account_changed");
      return current.view.deletion;
    }
    if(current.view.account?.id!==owner)throw new AuthError(401,"sign_in_required");
    return this.transaction(async client=>{
      await this.csrf(client,input);
      const row=(await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash=$1 and context_hash=$2 for update",[hash(input.session!),hash(input.context!)])).rows[0];
      if(!row||row.user_id!==owner||!await this.active(client,row))throw new AuthError(401,"sign_in_required");
      const result=await queueDeletion(client,owner,requestId,expectedRevision);
      if(await this.active(client,row))throw new AuthError(503,"unavailable");
      return result;
    });
  }
  async logout(input: AuthInput): Promise<AuthResult> {
    const result = await this.transaction(async client => {
      await this.csrf(client, input);
      let token: string | null = null;
      if (input.session && input.context) {
        const rows = await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash = $1 and context_hash = $2 for update", [hash(input.session), hash(input.context)]);
        const row = rows.rows[0];
        if (row?.provider_cipher) { try { token = readTokens(this.crypto.open(row.provider_cipher, `session:${hash(input.session).toString("hex")}`)).accessToken; } catch { /* Revoke locally even if stored credentials are damaged. */ } }
        if(row){if(await this.active(client,row)){await lock(client,row.user_id);await retireOwnerPush(client,row.user_id,undefined,row.provider_session_id);}await this.revoke(client,input.session);}
      }
      const context = await this.freshContext(client);
      return { token, cookies: { context, session: null, maxAge: 1200, view: this.metadata(context, null) } };
    });
    if (result.token) { try { await this.auth.logout(result.token); } catch { /* The database predicate already revokes this session, including its old JWT. */ } }
    return result.cookies;
  }
  /** A restricted database transaction with identity taken only from this verified BFF session. */
  async asActor<T>(input: AuthInput, mutation: boolean, run: (client: pg.PoolClient, actor: string, metadata:NonNullable<AccountSession["account"]>) => Promise<T>): Promise<T> {
    if (!validOpaque(input.session) || !validOpaque(input.context)) throw new AuthError(401, "sign_in_required");
    const current = await this.read(input); // Includes refresh and current provider/account checks.
    if (!current.view.signedIn) throw new AuthError(401, "sign_in_required");
    return this.transaction(async client => {
      if (mutation) await this.csrf(client, input);
      const result = await client.query<SessionRow>("select * from rise_private.server_sessions where id_hash = $1 and context_hash = $2 for update", [hash(input.session!), hash(input.context!)]);
      const row = result.rows[0];
      if (!row || row.revoked_at || !row.provider_cipher || !await this.active(client, row)) throw new AuthError(401, "sign_in_required");
      // active() sets transaction-local claims from the verified stored subject/session.
      // An action waiting on an owner lock may see owner RLS disappear after
      // deletion. Roll back failed work before probing authorization, including
      // SQL errors that otherwise leave the transaction aborted. Revocation must
      // win over a misleading domain conflict from the now-hidden profile.
      await client.query("savepoint rise_actor_action");
      let value:T;
      try{value=await run(client,row.user_id,current.view.account!);}
      catch(error){
        await client.query("rollback to savepoint rise_actor_action");
        if(!await this.active(client,row))throw new AuthError(401,"sign_in_required");
        throw error;
      }
      await client.query("release savepoint rise_actor_action");
      if (!await this.active(client, row)) throw new AuthError(401, "sign_in_required");
      return value;
    });
  }
}
