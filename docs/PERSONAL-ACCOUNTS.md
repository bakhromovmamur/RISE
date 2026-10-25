# Local personal account storage and commands

**Scope:** AUTH-02 · PRD-03–10/12/16/19 · SEC-01  
**Implemented:** 21 October 2026 UTC; verification completed 22 October in Asia/Tashkent.  
**Environment:** separate local/test Postgres and managed Auth stacks. Hosted provisioning remains pending by the product owner's direction.

## Current boundary

The BFF now provides an independent, account-owned personal store with relational ownership constraints, forced row-level security (RLS), validated commands, canonical revisions and transactional replay receipts. It reuses the application's existing domain reducer for habits, goals, rewards, prayers, private pauses, dated Fajr behavior, reflections and saved work notes.

The interface defaults to the separate guest `DeviceSession`. SYNC-01 now connects explicit account use/import through `WorkspaceSession`, with owner-scoped caches/outboxes and a session-only memory adapter. Signing in alone still uploads nothing, and reads never initialize an account. See [the consent, wire and cache contract](ACCOUNT-SYNC.md).

SYNC-01 adds selected import, stable batches and bounded coherent snapshot pull. SYNC-02 implements incremental changes, entity conflicts, tombstones and stale-device recovery. DATA-04 implements local account export/deletion; PUSH-01–04 implement consented local notification jobs. GROUP-01 implements local real membership, and GROUP-02 adds the [family backend and private priority boundary](SHARED-CONTENT.md). Account-selected task/list controls and private priorities now use that boundary. Final task acceptance is recorded in TASKS; hosted delivery remains pending.

## Setup and runtime

Follow [backend environments](BACKEND-ENVIRONMENTS.md) and [email-code sessions](AUTH-SESSIONS.md). Use only synthetic addresses and the local mail sink during development.

~~~sh
npm ci
npm run check
npm run infra:up -- local
npm run infra:up -- test
npm run server:local
~~~

The local browser entry uses `http://127.0.0.1:4192`, retaining the 4190 installation marker/legacy entry; fixture test suites use 4191. Neither origin accesses the existing preview/profile on 4173. Environment and database credentials stay in protected `.rise-infra/` files, never in request examples or browser configuration.

`tsx` remains pinned at 4.23.15 and is now a production dependency. The BFF imports the existing pure TypeScript domain modules, whose extensionless imports and parameter properties require this loader. `npm run server:start`, test entries and the proposed systemd example use `node --import tsx`. Browser and server reuse the same domain reducer; no alternate business-rule implementation is introduced. SYNC-01 adds the browser client and shared per-entity projection. GROUP-02 passes validated shared-reference authority separately from submitted command context.

## Relational records

The original 24 personal-boundary tables in schema `rise` carry `owner_id`, a bounded server revision, and server creation/update timestamps. Later sync, push and group tables have their own documented boundaries. The profile key references the managed Auth user. Personal child foreign keys include the owner, preventing a link to another account's entity even when a UUID is known.

| Tables | Stored behavior and constraints |
| --- | --- |
| `profiles`, `account_preferences` | Name, language, planning timezone, starting civil date, onboarding, bounded settings and selected reward/equipped cosmetic references |
| `habits`, `habit_versions` | Ordered definitions and effective-date targets/schedules; one version per habit/date |
| `habit_days`, `habit_occurrences` | Materialized dates, ordered immutable name/target snapshots and explicit full/tiny/null checks; unique habit/date occurrence |
| `goals`, `goal_milestones`, `goal_habits` | Ordered milestones, completion/status and owner-consistent habit links; removed milestones retained as retired when preserving history |
| `personal_rewards` | Goal or fixed-week condition, previous attempt and earned/enjoyed/corrected/archive dates |
| `priority_days`, `daily_priorities` | At most three ordered unique habit/milestone or authorized opaque family-task references per personal date; deferred uniqueness permits atomic reorder |
| `cosmetic_claims` | Explicit supported XP thresholds; claiming does not award XP |
| `prayer_settings`, `prayer_reminders` | Account prayer/Fajr preferences and per-prayer preparation/due choices; no browser delivery consent |
| `prayer_days`, `prayer_windows`, `prayer_records` | Manual or sanitized calculated dated timetable, timezone, UTC windows and separate self-reported records; no samples or coordinate-bearing calculation keys |
| `prayer_pauses` | Private from/through prayer keys; at most one active pause, no reason/health-detail column |
| `fajr_plans`, `fajr_acknowledgments` | Plan and optional backup choice per date; independent wake acknowledgment with server timestamp |
| `reflections`, `saved_work_breaks` | Bounded saved text and break stage; previous work notes survive as inactive records, at most one active break |
| `personal_receipts` | Owner/operation UUID, SHA-256 request fingerprint, original result and revision; updates denied, expired-owner cleanup follows SYNC-02 |

Bounded JSON belongs to one entity or historical snapshot. A legacy whole-profile `State` is never accepted or stored as the canonical account record. The adapter reconstructs a validated transient domain model to run the existing reducer, projects explicit known fields, and writes only changed relational rows.

`habit_occurrences.xp` is a generated column: full 20, tiny 10, otherwise zero. `rise.personal_totals` is an invoker-security view over those occurrences and the profile. There is no writable XP total or increment endpoint. The BFF verifies SQL totals against the shared domain result before committing. Habit snapshot data cannot be changed by an update; explicit check correction changes its separate check field.

## Actor and authorization boundary

1. The existing session service validates opaque context/session cookies, refreshes through managed Auth when necessary, and checks the current account/provider session. A submitted owner, role, editable user metadata or client clock cannot establish identity.
2. `Sessions.asActor` opens a restricted BFF transaction, checks CSRF for mutations, locks the matching stored session and verifies it remains active.
3. It sets transaction-local `sub` and `session_id` claims from that verified session and passes the actor internally to the command repository.
4. Every personal table's RLS requires both `owner_id = auth.uid()` and the existing no-argument `rise_private.active_session()` predicate. Update policies check old and proposed ownership. The predicate checks linked BFF/provider revocation, expiry and ban/deletion state.
5. The session is checked again before commit. Claims disappear at transaction end; they do not leak to another pooled connection user.

The database trusts the BFF to establish verified claims on its restricted connection. PostgreSQL does **not** independently verify a JWT signature when `set_config` is used. Compromise of BFF credentials/process is therefore inside this trust boundary. Normal requests use neither a provider service key nor a migration administrator, and the login cannot bypass RLS, administer Auth, or assume elevated roles.

| Identity | Personal privileges |
| --- | --- |
| `rise_bff_login` → `rise_bff` | Owner/session-filtered reads/writes; no profile deletion or receipt updates; only current-owner receipts older than 90 days may be deleted by SYNC-02 |
| Provider `authenticated` | SELECT only, subject to the same owner/session predicate; no direct table writes |
| Anonymous, worker and lifecycle roles | No personal table/view access |
| Migration administrator | Explicit administrative maintenance authority, outside ordinary requests |

RLS is enabled and forced on every personal table. The `rise` schema remains excluded from exposed Data API schemas; the normal public entry is the BFF. The totals view uses `security_invoker` and `security_barrier`. New JSON validation and snapshot-trigger functions use invoker security, an empty search path and revoked public execution. The existing narrowly privileged active-session predicate is the only session-check definer boundary; it grants no general Auth-table access to application roles.

## HTTP contract

Both routes are under `/api/v1`, return `Cache-Control: no-store` and `Vary: Cookie`, and require a current session. Mutation also requires exact same-origin JSON and the current session-bound `X-Rise-CSRF` token obtained from `/session`.

| Route | Result |
| --- | --- |
| `GET /personal` | `{ initialized, revision, xp, records }`; an uninitialized account returns revision/XP zero and `records: null`, without inserting rows |
| `POST /personal/commands` | Validates one intent and returns `{ operationId, operationRevision, xp, replayed }` after commit |

Command envelope:

~~~ts
{
  protocolVersion: 1,
  operationId: "<stable lowercase UUID>",
  baseRevision: 0,
  command: {
    kind: "account.initialize",
    name: "Synthetic account",
    timezone: "Asia/Tashkent",
    language: "en"
  }
}
~~~

For later operations, use the last committed/read account revision and one of the allowed discriminated domain intents in `src/contracts/accountCommands.ts`. Generate an operation UUID once and retain the entire envelope for retry. Entity identifiers are also UUIDs; legacy device IDs are not silently rewritten. SYNC-01 maps legacy IDs only through the reviewed consented projection.

`records` contains separate projected arrays for the 23 personal data tables, excluding receipts and credentials. It is an authorized bootstrap read, not an incremental change feed or a portable backup. Row revisions and timestamps remain internal; the returned canonical revision covers the complete account snapshot. The adapter refuses more than 250,000 records without truncating or deleting them. SYNC-01 supplies revision-consistent bounded pagination at `/sync/pull`; production capacity/query tuning remains a release gate.

### Accepted and excluded intents

Account commands cover initialization, profile/language/settings, explicit onboarding, habit save/check/correction/archive, calendar materialization, personal priorities, goal save/milestone/status, reward save/retry/select/archive/enjoy, cosmetic claim/equip, reflection save, prayer preferences/reminder/manual timetable/record/pause/resume, dated Fajr plan/acknowledgment, and saved work begin/note/stage.

Drafts, running timers, simulated readiness/alarms/sample setup, calculated location setup, timezone observation, delivery consent, wrap-up timers and local simulated task references are rejected at the account boundary. These require device scope or dedicated capabilities. GROUP-02 permits only opaque real family-task references with current membership/schedule authorization for new selections; unavailable existing selections remain removable/reorderable. An account timetable cannot upload a sample, calculation key or manufactured prayer report; the existing reducer resolves manual clocks/date/timezone into UTC windows and preserves recorded snapshots. Prayer records use their own explicit command; the single-command API uses server time, while sync validates captured action context and keeps database audit time. Legacy imported unknown report times are not fabricated. No geolocation or background calculation occurs on the server.

The request limit is 64 KiB. Runtime schemas reject unknown fields, unsupported commands, malformed UUIDs/dates/timezones, non-finite numbers, prototype keys, accessors, cycles and excessive nesting before storage access. Existing Unicode field limits remain intact; additive SQL byte bounds account for multi-byte characters without truncation.

### Transactions, concurrency and retry

An account-scoped transaction advisory lock serializes personal mutations across sessions. Reads take its shared counterpart so their multi-table snapshot cannot overlap a command commit. Each write checks its base revision, runs the shared reducer with the stored planning timezone and database transaction time, writes relational deltas, advances the profile revision, verifies XP and inserts the minimal replay receipt in **one transaction**.

An accepted no-op advances the canonical revision once. An exact operation replay returns the original revision/XP with `replayed: true`, even after later operations. Reusing its UUID with changed content returns 409. Two different operations on the same base yield one commit and one 409, including when they concern different entities. This conservative single-command API remains separate from the finer entity merge policy implemented by SYNC-02’s sync API. The caller must read/review current state before creating a new operation; never silently renumber and resend a conflicting intent.

Failure anywhere, including receipt insertion or the final session check, rolls back records and revision. A lost successful response is retried with the same envelope. A stored receipt is runtime-validated, including numeric fields and its canonical revision; malformed results fail closed without changing records. Provider/database unavailability returns a generic retryable 503; it never invents an acknowledgment or resets a profile.

| Status/code | Meaning |
| --- | --- |
| 401 `sign_in_required` | Missing, expired, revoked or otherwise invalid identity |
| 403 `csrf_rejected` | Wrong/missing origin, content type, context or CSRF token |
| 404 `missing_record` | Referenced personal entity/window is unavailable to this actor |
| 409 `initialize_required` / `already_initialized` | Wrong account initialization state |
| 409 `revision_conflict` / `operation_reused` / `revision_limit` | Stale base, changed replay payload or exhausted safe revision range |
| 422 `invalid_command` | Invalid envelope, excluded scope or failed domain validation |
| 503 `unavailable` | Safe retryable infrastructure/internal failure, without SQL or private content |

Transport parsing/body-limit failures also use the existing safe BFF error handler. Errors expose no other account's records, submitted text or underlying SQL. API logging retains only generated request ID, method, route pattern and status.

## Migrations, recovery and remaining gates

The pinned CLI generated these additive migrations; both isolated stacks applied them without reset:

1. `20261021184458_personal_schema.sql`: relational records, keys/indexes, grants/RLS, derived totals and snapshot protection.
2. `20261021185411_personal_unicode_limits.sql`: widen habit entity JSON byte allowance to preserve existing Unicode limits.
3. `20261021185824_personal_unicode_snapshots.sql`: widen corresponding version/occurrence/goal/prayer/Fajr snapshot bounds, retaining all other checks.

No existing migration, installation identity, session key, browser database version or guest profile format was rewritten. Stop/up preserves volumes and credentials. Roll back compatible server/assets while retaining the additive schema and data; never drop account tables or reset a database to undo this increment. Retain a server capable of reading these records and current sync commands on rollback. SYNC-01 adds `20261021201759_consented_personal_sync.sql` for private staging and prayer-history compatibility; do not rewrite applied migrations.

SYNC-02 prunes expired owner receipts opportunistically with its 90-day rebase floor. DATA-04 supplies local account export/deletion and ledger replay. Scheduled all-account retention, full backup restore, production load/query-plan measurement and hosted security acceptance remain OPS, QUALITY and SAFE gates. Do not claim a production audit from local advisor output.

Verification commands and detailed outcomes are in [AUTH-02 evidence](evidence/personal-backend-2026-10-21/README.md). The existing signed-in/guest browser suites remain relevant because account metadata and this independent backend must never mutate guest data.

Primary references reviewed: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [invoker-security views](https://supabase.com/docs/guides/database/views), [Postgres maintenance notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) and [TLS cipher retirement](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). Standard Postgres 17.11 and the existing supported Node TLS path are retained; no preview database engine or legacy cipher dependency is introduced.
