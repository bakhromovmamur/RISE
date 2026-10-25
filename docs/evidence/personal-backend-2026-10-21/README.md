# AUTH-02 — Local personal schema, RLS and commands

**Implementation:** 21 October 2026 UTC · **Completed verification:** 22 October, Asia/Tashkent  
**Scope:** AUTH-02 / SEC-01 personal backend, following the project Karpathy guidelines. Cloud provisioning remains pending by explicit user direction.

## Result

An independent account store now has 24 forced-RLS relational tables, owner-inclusive foreign keys, invoker-derived XP, explicit initialization, authorized reads, validated commands, canonical account revisions and atomic replay receipts. Normal requests use the existing restricted BFF login; actor/session claims come from the verified session, never the request. The same domain reducer preserves current habit, reward, prayer, private-pause and dated Fajr semantics.

This is local backend completion, recorded as **REVIEW** in TASKS. The existing interface still saves to its separate device-only guest repository. No guest import, account client/cache, sync sender, shared membership, account export/deletion, notification worker or cloud deployment is implied. See [the complete API and recovery contract](../../PERSONAL-ACCOUNTS.md).

## Verification

| Check | Observed outcome | Evidence |
| --- | --- | --- |
| `npm run check` | **160 passed**, toolchain/lint/types and both builds passed | [check.log](check.log) |
| Final lint/type check after integration assertions | Passed | [lint.log](lint.log), [types.log](types.log) |
| `npm run test:infra` | **28 passed** against real local/test Postgres/Auth; no mocks substituted for the database | [integration.log](integration.log) |
| `npm run test:auth` | **21 passed** across Chromium/WebKit/Firefox, including identity switching, pending guest saves and localized mobile forms | [auth-browser.log](auth-browser.log) |
| `npm run test:backend` | **9 passed** across three engines, including current onboarding/check-in/reload and public offline entry | [backend-browser.log](backend-browser.log) |
| Supabase local/test advisors | All categories, warning threshold, fail-on-warning: **no issues found** in either stack | [local](advisors-local.log), [test](advisors-test.log) |
| Actual database metadata | Each standard Postgres 17.11 stack has six committed migrations, six forced-RLS private tables and 24 forced-RLS personal tables; totals view is invoker-security | [database-summary.json](database-summary.json) |
| Documented production server entry | `node --import tsx --env-file=.rise-infra/local/server.env server/main.ts` started; local readiness returned 200; process stopped gracefully afterward | [verification.json](verification.json), [runtime.log](runtime.log) |
| Production dependency classification | `tsx@4.23.15` present under `npm ls tsx --omit=dev`; no version upgrade | [runtime.log](runtime.log) |
| Browser build preservation | **43 production/review files byte-identical** to the previous tested AUTH-01 build, including CSS, JS, workers and icons | [tested-builds.json](tested-builds.json) |
| Source/data preservation | Zero removed baseline files; all 90 pre-existing `src/`/`public/` files unchanged; user preview on 4173 never accessed | [preservation.json](preservation.json), [before.json](before.json) |
| Documentation | Current-document local links/anchors and task counts checked | [documentation-check.json](documentation-check.json) |
| Secret inspection | No protected runtime credentials/signing material or authenticated-JWT/session-cookie patterns found in source, builds, evidence and test artifacts | [secret-scan.json](secret-scan.json) |

[Machine-readable verification](verification.json) records run times, browser versions and explicit limits. Environment: Darwin 25.6.0 arm64, Node 24.16.0, npm 11.13.0, Playwright 1.64.1. These are desktop browser engines, not physical phone/HTTPS certification. The existing bundle-size advisory remains; performance/load acceptance is a separate task.

### Important observed cases

- Reading an uninitialized signed-in account creates no profile. Anonymous requests, missing/foreign Origin, missing/stale CSRF and submitted identity/clock/XP/role fields fail. Initialization is explicit and runs once.
- Every personal data table round-trips through actual commands, including immutable historical habit targets, future versions, ordered mixed priorities, retired referenced milestones, fixed-week/goal rewards, private pauses, manual UTC prayer windows, separate prayer reports, dated Fajr backup choices/acknowledgments, reflections and previous saved work notes.
- Direct authenticated SQL checks all 24 tables and the invoker totals view under owner, unrelated, wrong-session and forged editable-metadata claims. Unrelated/wrong-session claims see no owner's rows. Revoked linked claims lose every table. Anonymous schema/table/view access is denied. Direct Data API access to schema `rise` returns 406/PGRST106 because it is not exposed.
- The actual restricted BFF connection cannot replace ownership on any table, cross-owner foreign keys fail, provider `authenticated` cannot write, and worker/lifecycle logins cannot read personal data. Direct modification of a stored habit snapshot fails. Generated XP cannot be assigned.
- Two real managed sessions race edits across habit records/versions, milestones, rewards, priority order, cosmetics, timetable/report/pause, Fajr plan/acknowledgment, reflection, work note, language and preferences. Every pair yields one accepted revision and one 409, with one receipt. This deliberately conservative account-wide policy is not yet independent-entity merging.
- Three concurrent copies of one operation commit one effect and return the same original receipt. Changed content cannot reuse its ID. A lost-response replay still returns its original revision after another operation commits.
- Malformed stored receipt results, including boolean/null XP and invalid/inconsistent revisions, return a safe 503 without changing personal records. The synthetic administrative fault is restored afterward; the BFF itself cannot update receipts.
- A test-only failing receipt trigger forces the real command transaction to roll back its entity write and canonical revision. The API returns a safe 503 without SQL or submitted text. The trigger/function are removed in `finally`; no database reset occurs.
- Logout prevents both reads and replay; a managed-account ban prevents reads. Existing AUTH-01 tests also cover idle/absolute expiry, provider-session removal, corrupt encrypted material and serialized managed refresh.
- Maximum documented Unicode habit text and Fajr messages survive without truncation. Unit boundaries reject samples, coordinate-bearing calculation keys, fabricated timetable reports, unknown fields, prototype keys, accessors, cycles and oversized input.
- API logs exclude private command content, email, credentials and CSRF values. Real-code browser flows retain no trace/video/automatic screenshot. Only synthetic `@example.invalid` accounts/local mail are used.

## Changes and preservation

New implementation: `src/contracts/accountCommands.ts`, `server/personal/{records,repository,routes}.ts`, focused contract/database tests and fixtures. Existing server changes add the guarded actor transaction and share existing auth route protection; the app registers the personal routes only when session services are supplied. Runtime/configuration edits add the `tsx` loader and move that same pinned dependency into production installation.

The pinned CLI generated three additive migrations: `20261021184458_personal_schema.sql`, `20261021185411_personal_unicode_limits.sql`, `20261021185824_personal_unicode_snapshots.sql`. No existing migration was rewritten, and neither database was reset. The initial timestamp bridge needed integer millisecond precision for the shared context validator; it was corrected before the passing integration run. Unicode byte allowances were expanded additively after verifying the existing 5,000-code-point limits. Final review made the concurrency test independent of whether Fajr's window had ended and tightened stored receipt validation; the database suite was rerun afterward. See [source hashes](source-hashes.json) for the implementation reviewed here.

[Before hashes](before.json) cover 917 pre-existing code/configuration/root-document/reference files. No pre-existing application component, domain model, device command/store, CSS, public asset or worker changed. The new account contract is not imported by the browser entry. Exact build equality substantiates visual/behavior preservation without regenerating screenshots or goldens. Existing guest profiles, local receipts, drafts, backups and the original recovery source were not read, migrated, cleared or uploaded by this work.

The backend reconstructs a transient validated domain model; canonical storage remains separate entity rows. There is no generic legacy-profile upload. The trusted BFF establishes session claims on its restricted connection; SQL settings do not independently verify a provider JWT signature. The explicit administrator maintenance policy is separate from ordinary application identity. These boundaries are documented in [architecture](../../../ARCHITECTURE.md) and [security](../../../SECURITY.md).

Private `.rise-infra/` files, mail contents, tokens/cookies, provider logs and administrative CLI diagnostics are excluded from this report. The evidence contains metadata and synthetic test outcomes only. No Git repository was initialized, and no cloud project, DNS, deployment, paid service or real email delivery was created.

After verification, only RISE's named stacks are stopped with their database volumes and credentials retained ([local](stop-local.log), [test](stop-test.log)). Unrelated running Docker containers are preserved. Use the documented local startup command to try the backend again.

## Remaining gates and rollback

SYNC-01 must add explicit import review/consent and an account-scoped UI/cache/sender. SYNC-02 must add incremental reads, finer entity conflicts, tombstones and stale-client/receipt-retention handling. Current receipts remain unpruned; do not implement the target 90-day expiry without that protocol. Legacy IDs require a reviewed import mapping rather than silent reassignment.

Calculated-location setup/drafts/timers/delivery consent remain device-only; manual account timetable commands exist independently. Account export/deletion and operational purge/backup/deletion replay remain DATA-04/OPS. Hosted projects, region/Hetzner capability, SMTP/HTTPS, load/query-plan measurement, integrated security and physical devices retain their gates. No local advisor result completes those requirements.

Roll back compatible application/server releases while retaining additive tables, keys and data. Do not drop schema, reset volumes, downgrade browser storage or regenerate installation credentials to repair a failed request. A failed/lost command response is retried with the same envelope; a stale-base conflict requires a read and explicit intent review. No recovery action here requires changing the user's guest profile.
