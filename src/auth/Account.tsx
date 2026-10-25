import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context.tsx";
import { Button } from "../components.tsx";
import type { AccountSession, CodeChallenge } from "../contracts/auth.ts";
import { AccountError, getAccountSession, requestCode, signOut, verifyCode } from "./client.ts";
import { accountText, resendText, type AccountTextKey } from "./text.ts";
import { AccountSync } from "../sync/AccountSync.tsx";
import { SyncError } from "../sync/client.ts";
import { AccountLifecycle,AccountDeletionNotice } from "../account/AccountLifecycle";

export function Account() {
  const { state, back, workspace } = useApp(), text = accountText(state.life.language);
  const [session, setSession] = useState<AccountSession | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""), [remember, setRemember] = useState(false), [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null), [error, setError] = useState<AccountTextKey | null>(null), [seconds, setSeconds] = useState(0);
  const deadline = useRef(0), generation = useRef(0), controller = useRef<AbortController | null>(null), mounted = useRef(true), pending = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null), codeInput = useRef<HTMLInputElement>(null);
  const previousCsrf = useRef<string | null>(null);
  const lifecyclePending=useRef(false);
  const lifecycleBusy=useCallback((value:boolean)=>{lifecyclePending.current=value;setBusy(value);},[]);
  const operation = useRef<"send" | "verify" | "logout" | null>(null);
  const refresh = useCallback(async () => {
    const version = ++generation.current; controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setLoading(true); setSession(null);
    try {
      const next = workspace ? await workspace.refreshIdentity(abort.signal) : await getAccountSession(abort.signal);
      if (mounted.current && version === generation.current) {
        setSession(next); setError(null);
        if (next&&(next.signedIn || previousCsrf.current && previousCsrf.current !== next.csrfToken)) { setEmail(""); setCode(""); setChallenge(null); deadline.current = 0; setSeconds(0); }
        if(next)previousCsrf.current = next.csrfToken;
      }
    } catch { if (mounted.current && version === generation.current && !abort.signal.aborted) setError("unavailable"); }
    finally { if (mounted.current && version === generation.current) setLoading(false); }
  }, [workspace]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const changed = () => { if (!document.hidden && !pending.current&&!lifecyclePending.current) void refresh(); };
    const offline = () => { generation.current++; controller.current?.abort(); setSession(null); setLoading(false); setError(operation.current === "logout" ? "logoutFailed" : "unavailable"); };
    if (typeof BroadcastChannel !== "undefined") { channel.current = new BroadcastChannel("rise-account-session"); channel.current.onmessage = changed; }
    window.addEventListener("focus", changed); window.addEventListener("online", changed); window.addEventListener("offline", offline); document.addEventListener("visibilitychange", changed);
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); channel.current?.close(); window.removeEventListener("focus", changed); window.removeEventListener("online", changed); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", changed); };
  }, [refresh]);
  useEffect(() => { if (challenge && !loading) codeInput.current?.focus({ preventScroll: true }); }, [challenge, loading]);
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000))); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const wait = (value: number) => { deadline.current = performance.now() + value * 1000; setSeconds(value); };
  async function run(kind: "send" | "verify" | "logout") {
    if (!session || pending.current) return;
    pending.current = true; operation.current = kind; setBusy(true); setError(null);
    const version = ++generation.current, abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    try {
      if (kind === "send") {
        const next = await requestCode(email, remember, session.csrfToken, abort.signal);
        if (mounted.current && version === generation.current) { setChallenge(next); setCode(""); wait(next.retryAfter); }
      } else {
        if (kind === "verify" && challenge) await verifyCode(challenge.challenge, code, session.csrfToken, abort.signal);
        if (kind === "logout") { await workspace?.prepareSignOut(); await signOut(session.csrfToken, abort.signal); await workspace?.signedOut(); }
        if (mounted.current && version === generation.current) { setEmail(""); setCode(""); setChallenge(null); await refresh(); channel.current?.postMessage({ changed: true }); }
      }
    } catch (failure) {
      if (!mounted.current || version !== generation.current || abort.signal.aborted) return;
      if(failure instanceof SyncError&&failure.code==="pending_changes"){setError("pending_changes");return;}
      const fault = failure instanceof AccountError ? failure : new AccountError("unavailable");
      if (fault.retryAfter) wait(fault.retryAfter);
      if (fault.code === "csrf_rejected" || fault.code === "sign_out_first") { setChallenge(null); setCode(""); await refresh(); setError("changed"); }
      else { setError(kind === "logout" ? "logoutFailed" : fault.code === "invalid_code" || fault.code === "invalid_input" || fault.code === "rate_limited" ? fault.code : "unavailable"); if (kind === "verify") codeInput.current?.focus({ preventScroll: true }); }
    } finally { pending.current = false; operation.current = null; if (mounted.current) setBusy(false); }
  }
  return <div className="settings-content">
    <p className="fine-print"><strong>{text("localTitle")}</strong></p>
    <p className="fine-print">{text("localBody")}</p>
    {loading && <p className="fine-print" role="status">{text("loading")}</p>}
    {error && <p className="field-error" role="alert" id="account-error">{text(error)}</p>}
    {!loading && !session && <Button variant="secondary" className="wide" onClick={() => { setError(null); void refresh(); }}>{text("retry")}</Button>}
    {session?.reason === "expired" && <p className="fine-print" role="status">{text("expired")}</p>}
    {session?.reason==="deleted"&&<AccountDeletionNotice session={session} onChanged={refresh}/>}
    {session?.account ? <>
      <p className="fine-print" role="status"><strong>{text("signedIn")}</strong></p>
      <label className="field">{text("email")}<input readOnly value={session.account.email} /></label>
      <p className="fine-print">{text(session.account.remembered ? "persistent" : "temporary")}</p>
      <p className="fine-print">{text("future")}</p><p className="fine-print">{text("keepGuest")}</p>
      <AccountSync owner={session.account.id}/>
      <AccountLifecycle key={session.account.id} session={session} onChanged={refresh} onBusy={lifecycleBusy} blocked={busy}/>
      <Button variant="secondary" className="wide" disabled={busy} onClick={() => void run("logout")}>{text(busy ? "working" : "signOut")}</Button>
    </> : session && <form aria-busy={busy} onSubmit={event => { event.preventDefault(); void run(challenge ? "verify" : "send"); }}>
      <label className="field">{text("email")}<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required value={email} readOnly={!!challenge} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      {challenge ? <>
        <p className="fine-print" role="status">{text("neutral")}</p>
        <label className="field">{text("code")}<input ref={codeInput} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} disabled={busy} aria-invalid={error === "invalid_code"} aria-describedby={error ? "account-error" : undefined} onChange={event => { setCode(event.target.value.replace(/\s/g, "")); setError(null); }} /></label>
        <Button type="submit" className="wide" disabled={busy}>{text(busy ? "working" : "verify")}</Button>
        <Button type="button" className="wide" variant="secondary" disabled={busy || seconds > 0} onClick={() => void run("send")}>{seconds ? resendText(state.life.language, seconds) : text("resend")}</Button>
        <Button type="button" className="wide" variant="ghost" disabled={busy} onClick={() => { setChallenge(null); setCode(""); setError(null); }}>{text("change")}</Button>
      </> : <>
        <label className="checkbox-label"><input type="checkbox" checked={remember} disabled={busy} onChange={event => setRemember(event.target.checked)} /><span><strong>{text("remember")}</strong><small>{text("shared")}</small></span></label>
        <Button type="submit" className="wide" disabled={busy || seconds > 0}>{busy ? text("working") : seconds ? resendText(state.life.language, seconds) : text("send")}</Button>
      </>}
      {session.delivery === "local-inbox" && <p className="fine-print">{text("development")} <a href={session.localInbox} target="_blank" rel="noopener noreferrer">{text("inbox")}</a></p>}
    </form>}
    <Button variant="ghost" className="wide" onClick={back}>{text("continue")}</Button>
  </div>;
}
