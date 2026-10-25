# Local email-code sessions

**Scope:** AUTH-01 · PRD-03 · SEC-02 · **Updated:** 22 October 2026.  
Implemented against the separate local/test Postgres and managed Auth stacks. Cloud provisioning, public email delivery and hosted HTTPS acceptance remain pending by the product owner's direction.

## What works now

Open **You → Settings → Your data → Account**. Request a six-digit code, use the latest code from the local inbox, and verify it. Incorrect, expired, consumed and locked challenges have recovery guidance; resend has a server-enforced cooldown. Account controls are available in English, Uzbek Latin and Russian using the existing sheet/form design.

The daily journey defaults to the **separate device-only guest profile**. Signing in alone never uploads, replaces, merges or relabels local records/drafts/receipts/recovery. AUTH-02 supplies [personal records](PERSONAL-ACCOUNTS.md), and SYNC-01 now connects explicit account use, reviewed selected import, separate owner caches and outboxes. The [membership boundary](GROUP-MEMBERSHIP.md) and [family task/list controls](SHARED-CONTENT.md) are locally verified. [Exact squad snapshots](SQUAD-SNAPSHOTS.md) are locally verified; [optional group notices](GROUP-NOTIFICATIONS.md) now use the current session and separate group/device consent locally; physical and hosted delivery acceptance remain pending. Consented [background push now operates locally](LIVE-PUSH-SENDER.md). Never treat the guest repository as an account cache; see [the sync contract](ACCOUNT-SYNC.md).

Email, code, challenge and session metadata stay in component memory. They are not durable drafts or backup fields. Provider access/refresh tokens and opaque session/context cookie values never enter browser application storage. Sign-out clears account identity and returns to guest use while preserving local records and pending saves. Other account sheets recheck through a data-free BroadcastChannel message, focus, visibility or reconnect; stale asynchronous results cannot restore an older identity.

Overlapping identity reads follow the newest result, including a failure that has already settled, so an older Account-sheet read cannot return a superseded null identity. The generation is checked again after asynchronous cache reads. Cancellation, closure and sign-out still fence obsolete work; identity metadata grants no server authority.

“Remember this device” defaults off. It permits session persistence and, after explicit account use/import, durable owner-scoped account state/outbox. Session-only private data stays in memory and successful saves need server acknowledgment. Offline remembered work is retained for same-owner reauthentication; confirmed logout protects pending work and clears the selected cache without touching guests. A disconnected/failed sign-out never claims revocation. [Cache lifecycle details](ACCOUNT-SYNC.md#client-storage-and-ownership).

## Try it without sending real email

Prerequisites and isolation are in [backend environments](BACKEND-ENVIRONMENTS.md). Use only synthetic addresses, such as a new `auth-<random-id>@example.invalid` address. The local SMTP sink captures all mail; it sends nothing externally.

~~~sh
npm run build
npm run infra:up -- local
npm run server:local
~~~

Open the local app at `http://127.0.0.1:4192`. Its Account sheet links to the local inbox at `http://127.0.0.1:55324`. This is a separate origin from the existing personal preview on 4173; no profile transfer is performed. Opening a new backend origin does not migrate the old origin's data. The original preview can continue to run unchanged; without a BFF its Account sheet explains that sign-in is unavailable and offers continued device use.

After changes to Auth configuration, stop/up **only the selected RISE stack** so its container reads the new configuration. Keep `.rise-infra/` and database volumes. The additive controller upgrade generates a session-encryption key once for an older INFRA-01 installation without replacing its installation UUID, database credentials or signing keys. A partial or unsupported key record fails closed.

## Session contract

All endpoints are same-origin, under `/api/v1`, with `Cache-Control: no-store` and `Vary: Cookie`. Public service-worker caches exclude these paths.

| Endpoint | Contract |
| --- | --- |
| `GET /session` | Authoritative guest/account status, memory-only CSRF token and minimal account metadata; no provider tokens. Expired sessions return guest status with an expiry reason. Temporary backend/provider faults return generic 503. |
| `POST /auth/code` | Strict `{email, remember}`; neutral 202 with bound challenge/cooldown/expiry even if provider delivery is refused. No user-existence or provider-error disclosure. |
| `POST /auth/verify` | Strict `{challenge, code}`; managed Auth verifies the six-digit code. Success rotates context and opaque session ID. The client reads `/session` before showing account identity. |
| `POST /logout` | Empty JSON object; revoke the matching BFF session and erase encrypted provider material before clearing its cookie. Managed logout is best effort after the local revocation commits. |

All mutations require exact configured Origin, JSON content type and a CSRF token bound to both the HttpOnly browser context and current session cookie. Cross-site fetches, extra submitted identity/redirect fields and duplicate/malformed cookies fail closed. Request bodies are limited to 2 KiB. Safe error envelopes contain code, message key, retryability, request ID and optional retry delay; they contain no credentials, email, SQL or provider response.

The BFF delegates OTP generation/verification to managed Auth. It validates the returned token using Auth's user endpoint before accepting issuer, subject, role, session ID and expiry. Editable user metadata is never authorization. There is no password implementation or browser Auth SDK/token cache.

### Lifetimes and limits

| Mode | Cookie lifetime | Idle expiry | Absolute expiry |
| --- | --- | --- | --- |
| Default | Browser session | 30 minutes | 12 hours |
| Explicit remembered device | At most 30 days | Seven days | 30 days |

Refresh and idle extension require an active, unbanned, undeleted managed account and linked provider session. Idle expiry never extends absolute expiry. Browser session restoration may retain session cookies according to browser policy; explicit sign-out is the reliable shared-device action.

Codes/challenges expire after ten minutes and allow at most five verification attempts. Resend replaces the challenge and invalidates the old handle. Provider request failure leaves the replacement challenge unusable, so an older code cannot silently activate it. Failed verification attempts commit their counters.

Rolling database limits serialize per subject with transaction advisory locks: code requests 100/IP/hour, one/email/minute, five/email/hour and ten/browser-context/hour; verification 60/IP/15 minutes and 20/context/15 minutes; new contexts 30/IP/minute. Email/context/IP limiter subjects use purpose-specific HMACs. No raw address is stored in the limiter. Expired challenges/contexts and old limiter events are removed in bounded batches. Production proxy/IP attribution, capacity and abuse controls still need hosted review; the current loopback server does not trust forwarded IP headers.

Request/verification quotas are committed in a short reservation transaction before provider I/O. CSRF, context and applicable current-session/reauthentication authority are checked before reservation and again in the challenge transaction. Provider latency therefore cannot retain the shared IP/email quota locks. A failed or interrupted attempt remains charged, including a failure after reservation but before challenge creation; reservations are internal and cannot be supplied or reused by clients. Challenge locks, five-attempt counters, neutral delivery responses and `provider_ready` enforcement remain unchanged. No database timeout or quota was increased.

Local managed Auth has higher email/verification/refresh test limits and a one-second provider email frequency so all BFF tests can share a development provider IP. The stricter BFF rolling limits remain enforced. These local settings are **not production sender/abuse configuration**.

### Bounded session admission

`Sessions.read` and `Sessions.asActor` serialize work for the same opaque session within one BFF instance before acquiring a database connection. The in-memory key is a digest of the cookie, not a verified actor or cached authorization result. Each admitted operation still refreshes/checks the current provider/account/session, and actor transactions retain CSRF, row locks, transaction-local claims, final authorization and immutable receipt behavior. Database locks remain authoritative across instances and different sessions for one owner.

The scheduler permits at most 256 running/waiting operations in total and 16 per session, including the running operation. Waiting expires after 3,000 ms; the deadline is checked again at admission in case an event-loop delay postpones its timer. A full or expired wait returns the existing generic retryable `503 unavailable` before its operation starts. It holds no database connection while waiting. Existing database/query/body limits remain unchanged; the admission wait is a separate bounded phase. Anonymous context creation and OTP/IP quotas retain their existing database enforcement.

Scheduling entries are transient, never logged, exported or stored in browser data. No authorization or profile result is cached. Ordinary pending request context stays in server memory until admission/rejection; there is no additional credential cache. Logout and terminal deletion retain their existing database authorization/revocation paths. Expired waiting work cannot execute later; once admitted, the ordinary transaction and exact-replay contract applies, including a lost response. A process restart drops unstarted waits, so the client retries the same captured operation identity/body. No schema, cache-format or migration change is needed to roll back this scheduler.

### Cookies and local HTTP

Hosted HTTPS uses `__Host-rise_session` and `__Host-rise_context`: **Secure, HttpOnly, SameSite=Lax, Path=/, no Domain**. HTTP hosted origins are rejected at startup.

The fixed local/test HTTP origins deliberately use `rise_local_*` and `rise_test_*` names, HttpOnly/Lax/Path=/ without Secure. WebKit rejects Secure `__Host-` cookies on HTTP loopback. This development exception is restricted by configuration to local 127.0.0.1:4190/4192 and test 127.0.0.1:4191 and is not a production transport-security claim. Hosted cookie behavior, TLS, mobile Safari and real delivery still require HTTPS evidence.

Session reads never overwrite or clear the session cookie, preventing a slow response from an old tab from erasing a newer sign-in. An expired cookie can remain present but grants no identity; explicit sign-out or another verified sign-in replaces it. State-changing requests still require the current context/CSRF binding.

## Private storage and authorization

The two AUTH-01 migrations add only server-side authentication metadata. They do not change the device database or domain schema:

- `20261021175616_email_code_sessions.sql`: forced-RLS private contexts, encrypted challenges, hashed sessions and HMAC limiter events, with BFF-only CRUD policies.
- `20261021180445_bound_session_predicate.sql`: catalog-bound definition of the narrow linked-session predicate.

Opaque identifiers contain 256 random bits; only SHA-256 hashes are stored. Provider credentials and challenge email use AES-256-GCM with fresh nonces, installation/session/challenge-bound associated data and purpose-separated keys derived from the server key. Concurrent refreshes lock the session row; one refresh commits before the next request can reuse the old token. Temporary provider faults preserve the row for retry; invalid refresh/revocation denies access.

`rise_private.active_session()` accepts no user arguments and returns only a boolean. It checks verified request claims against nonrevoked/unexpired BFF session metadata, the linked `auth.sessions` row and the current `auth.users` ban/deletion state. The dedicated `rise_session_guard` owner cannot log in, create roles/databases, bypass RLS or read token/password columns. Its bounded column grants and owner-filtered policies permit only the predicate's lookup. The BFF itself gains no direct Auth-table access, privileged API key or bypass-RLS role.

The SQL-standard `BEGIN ATOMIC` function body binds referenced catalog objects at migration time. This avoids requiring broad schema lookup privileges for the runtime guard on Supabase's managed Auth schema. The fixed empty search path, narrow owner, explicit grants and RLS remain required. Do not replace this helper with a broad administrator-owned function to bypass a permission error. AUTH-02 personal policies require **both** current ownership and this active-session predicate; future group policies must also require current membership. The helper alone grants no personal-data access. Private schemas are not exposed by the Data API.

The BFF sets transaction-local claims only from its verified stored actor/session, never a request's `ownerId` or editable metadata. Direct authenticated SQL tests verify that a different subject and a revoked linked session return false. AUTH-02 adds `Sessions.asActor`: current provider/session verification, CSRF for mutations, a locked actor transaction, and a final active-session check before commit. The restricted database connection trusts this BFF-established identity; it does not independently verify a JWT signature from `set_config`. Every personal table and the invoker totals view have direct hostile-access tests. Group authorization remains GROUP work. See [personal storage authorization](PERSONAL-ACCOUNTS.md#actor-and-authorization-boundary).

## Key custody, recovery and rollback

`SESSION_ENCRYPTION_KEY` is a server-only 32-byte random key encoded as 64 lowercase hexadecimal characters. Local protected state records key format version 1; generated runtime files use mode 0600 inside 0700 directories and atomic replacement. Hosted examples contain invalid placeholders until separately configured. Never put this key in `VITE_*`, argv literals, source, test fixtures, exports or logs. Back it up separately from the database and do not replace it as a troubleshooting shortcut.

The current format has one active key, not a multi-key online rotation service. For a planned rotation, stop/drain the affected BFF, revoke its BFF sessions and clear encrypted challenges through a reviewed administrative operation, install a new environment-specific key, then restart and require a fresh code. Keep the old key privately until the maintenance result and rollback policy are verified. Losing/replacing it without maintenance makes old ciphertext unreadable; sign-in failure must never trigger a guest-data reset. A compromise requires revoking affected managed Auth sessions too. Hosted rotation and recovery drills remain pending.

A managed verification can consume its code before a later database commit fails. The safe recovery is another code after cooldown, not inventing success or reusing a consumed OTP. The guest repository and pending work remain available independently.

Roll back compatible server/assets while retaining additive tables, protected keys and existing device storage. If an old release lacks the account UI, explicitly revoke its still-active account sessions before considering rollback complete; merely hiding controls is not logout. Never drop tables, reset volumes or downgrade browser storage as a rollback shortcut.

## Verification and remaining gates

~~~sh
npm run check
npm run infra:up -- local
npm run infra:up -- test
npm run test:infra
npm run test:auth
npm run test:backend
~~~

Run these integration/browser suites sequentially: test infrastructure briefly changes only synthetic credentials/grants, and both browser suites reserve 4191. Auth browser tests disable traces, videos and automatic screenshots. They read only synthetic test mail in Node memory, never export an inbox or provider credential, and capture only unverified forms with empty code inputs for layout evidence. Each sequential browser worker enforces the isolated test installation, then resets only its three HMAC quota subjects for the shared loopback browser IP so engines and repeat runs do not consume each other's abuse budgets. Parallel backend browser workers are rejected. It does not clear users, sessions, other rate subjects or guest storage and adds no runtime reset API. Integration injectors use a per-run synthetic loopback subnet. Do not upload auth failure artifacts without checking them for codes/cookies. Existing personal preview/profile storage is never used by tests.

[Dated evidence](evidence/auth-2026-10-21/README.md) records exact results and limits. Local implementation does not complete production authentication acceptance. Hosted project/region/host capability, verified SMTP sender, HTTPS cookie/header/origin behavior, physical mobile browser checks, abuse/capacity review and key/backup recovery remain release gates. Local account deletion/recent authentication, entity-conflict/stale-client recovery and subscription/job cleanup are now implemented in DATA-04, SYNC-02 and PUSH-01–04. Real membership remains GROUP work. Local selected import/cache/sync is recorded in [SYNC-01 evidence](evidence/sync-2026-10-22/README.md). Cloud provisioning stays pending.

Primary references: [managed email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [local email templates](https://supabase.com/docs/guides/local-development/customizing-email-templates), [managed sessions](https://supabase.com/docs/guides/auth/sessions), and [PostgreSQL SQL function bodies and security-definer precautions](https://www.postgresql.org/docs/17/sql-createfunction.html).
