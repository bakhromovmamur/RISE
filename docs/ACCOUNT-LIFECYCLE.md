# Account export, deletion and device cleanup

DATA-04 · local implementation · 22 October 2026. Hosted provisioning remains pending. This guide describes the implemented local/test boundary; it does not certify hosted backup retention, production operations or physical devices. The later sections record implemented local group and Web Push hooks.

## User actions

You → Settings → Your data → Account adds three controls using the existing localized account sheet.

| Action | Result | Preserved |
| --- | --- | --- |
| Download account export | A validated, versioned file of saved private account records, including retained historical rows | Server records, device caches, guest profile |
| Clear account data on this device | Explicit, version-bound removal of the selected owner's cache, pending queue, drafts and recovery source; open tabs leave that account view | Server account, guest database, other cached owners, public offline shell |
| Delete account | Explicit confirmation against the reviewed server revision; immediate suppression of every account session, followed by tracked primary purge | Guest profile and other accounts; downloaded files remain under the user's control |

Export and deletion require authentication within **10 minutes**, checked with database time in the verified actor transaction. A purpose-bound email-code flow reauthenticates the same account, rotates opaque cookies and preserves the account journey/outbox. Reauthentication does not create an Auth user if that identity disappears. Wrong-owner, stale-purpose and replayed challenges cannot authorize another account.

Export covers server-acknowledged records. Pending device work has a separate private recovery download before cleanup/deletion. Clearing or deleting explicitly discards the selected account's pending work; neither action implicitly changes the original guest source. A new cache version or server revision invalidates the corresponding review.

## Private export contract

`POST /api/v1/account/export` requires the verified session, same-origin JSON, CSRF and an expected account assertion. The actor comes from the session, never the submitted ID. A shared owner lock makes the records and revision coherent. Response headers are `no-store`, `Vary: Cookie`, JSON and an attachment filename. The response is sent after the transaction's final authorization check.

The file has format `rise.account-export`, version **1**, domain schema **4**, export time, own account ID/email, canonical revision, derived XP, all **23 known personal table projections**, an explicitly unavailable shared section, and a SHA-256 checksum. It contains retained retired milestones and inactive work notes, not only the current screen projection.

Excluded: provider/opaque session credentials, CSRF, authentication challenges, import staging, operation receipts/fingerprints, push endpoints/keys, invitations, other members' data and device-only coordinates/drafts. Free text remains private user content. The checksum detects corruption; it is not a signature or proof of authorization.

Both download and restore validate the envelope, exact allowed fields, byte/record/depth limits, dates/enums, duplicate/composite keys, references and derived XP. The existing **50 MiB** JSON limit applies. Oversized exports fail explicitly rather than truncating data.

DATA-02 accepts this file through its existing worker/preview/transactional restore path. It restores the **current personal projection into the guest device profile**, preserving dates and habit XP, with the usual replacement comparison, consent and recovery point. The preview explains that retired milestones and older inactive work notes remain in the full original export file. It does not restore account identity, deleted access, credentials or membership. Full relational history round-trips through the account-file validator; there is no live whole-account replacement endpoint.

## Deletion transaction and immediate revocation

`POST /api/v1/account/deletion` accepts only `accountId`, a stable UUID `requestId`, reviewed `revision`, and literal confirmation `delete-account`. It checks Origin/content type/CSRF, current identity, server-clock freshness, owner revision and integration readiness.

The terminal transaction locks the initiating session and the same owner advisory lock used by commands/imports. It inserts:

- `rise_private.deletion_ledger`: subject UUID and original deletion time only; deliberately no Auth foreign key.
- `rise_private.deletion_jobs`: stable request, requested/deadline/completion times and bounded retry metadata; no private content.
- `rise_private.deleted_sessions`: opaque session/context hashes for owner-bound terminal status and lost-reply recovery.

The ledger immediately makes `active_session()` false for every session and already-issued JWT. Available BFF token ciphertext is nulled using `SKIP LOCKED`; another in-flight session cannot deadlock deletion. Ordinary actor work still has its final active-session check, so a stale command cannot commit after suppression. A trigger also rejects new BFF sessions for a suppressed subject.

This terminal operation intentionally commits only after its own session has become inactive. Ordinary commands cannot use this exception. Concurrent personal work either commits first and invalidates the deletion review, or loses access and rolls back. Duplicate deletion requests do not create another job; an exact lost-reply retry returns the existing receipt.

`GET /api/v1/session` returns `reason: deleted` and only the deletion receipt to a matching opaque cookie/context pair. There is no public status lookup by account UUID/request UUID. Reads never clear a session cookie, so a slow old tab cannot erase a newer sign-in. After primary purge an anonymous CSRF context permits a deliberate new sign-in; it restores no deleted identity.

## Isolated purge process

The BFF still uses `rise_bff_login` and a publishable provider key. Startup rejects lifecycle/admin credentials in its environment. The separate cleanup process uses `rise_lifecycle_login` for private job/ledger metadata and a provider secret **only in its protected environment/process memory**. It cannot read personal journeys, provider token ciphertext or arbitrary live session hashes. Its session-hash projection is limited by RLS to already-suppressed owners.

Managed Auth does not delegate its user DELETE privilege to the migration role. The supported admin endpoint performs hard deletion, and the worker confirms that the user is absent. It never substitutes an administrative database connection for the BFF. Configuration accepts only the fixed local/test loopback API/database and exact installation identity; hosted configuration is intentionally not implemented.

~~~sh
npm run infra:up -- local
npm run server:local
# In a separate terminal:
npm run lifecycle:watch -- local
~~~

`server:local` loads the protected runtime file and serves browser-compatible loopback 4192. See [the environment guide](BACKEND-ENVIRONMENTS.md) for the retained installation identity and same-origin checks.

The watcher checks the queue every five seconds, processing at most 20 jobs per pass; it exits cleanly on SIGINT/SIGTERM. A bounded one-shot is available for local operations/tests:

~~~sh
npm run lifecycle:run -- local
~~~

Each job holds a database row lock, with concurrent workers using `SKIP LOCKED`. Provider deletion and job completion cannot share a database transaction: a crash or lost completion after provider success safely retries the same subject and recognizes `user_not_found`. Failures keep suppression active, record only `purge_failed`/`integration_pending`, and retry with bounded backoff. No account payloads, codes, cookie values or provider error bodies are logged.

Primary deletion cascades through Auth sessions/refresh tokens, personal records, receipts, sync metadata and import staging. Eight new direct profile-owner foreign keys supply the missing root cleanup path for historical child tables while retaining their owner-consistent composite references. No migration deletes existing records. The worker also clears the deleted subject's BFF contexts/challenges, then marks primary purge complete. A later status read can recreate an anonymous context for sign-in.

Local deletion remains queued when this cleanup service is stopped, as the confirmation screen explains. OPS-04 now labels seven days as an unguaranteed local target and ties 30-day local backup expiry to capture time and running maintenance. A supervised hosted worker, queue-age/deadline alarms and the seven-day service target remain OPS-02 acceptance work.

## Retention and backup replay

Access is blocked at the deletion commit; the primary purge target is **seven days**, contingent on a running cleanup service. OPS-02 now provides [local encrypted backups and authenticated expiry](SERVER-BACKUP-RECOVERY.md): backups expire **30 days after capture** when maintenance runs. Hosted encrypted backups retain a policy maximum of **30 rolling days**; hosted provisioning and continuous enforcement remain pending.

The minimal ledger and terminal metadata are retained for **35 days after confirmed primary purge**. Counting only from the request could let a delayed purge leave a still-retained backup outside suppression coverage. Pending/failed jobs never expire their ledger. Cleanup removes expired receipts/jobs/ledger together; ordinary BFF users cannot remove suppression.

Keep an authoritative deletion ledger outside a database recovery snapshot. Local tooling writes a mode-0600 artifact containing environment, installation and only subject/deletion-time pairs:

~~~sh
npm run lifecycle:ledger -- local .rise-infra/local/deletion-ledger.json
# Recovery only: keep app access and all delivery disabled first.
npm run lifecycle:replay -- local .rise-infra/local/deletion-ledger.json
npm run lifecycle:run -- local
~~~

Replay validates the complete file before a single transaction, including exact environment/installation, bounded size, unique UUIDs and timestamps. It reapplies suppression and captures restored opaque session handles before purging. It cannot be used as an app backup, credential import or account restoration flow. Treat the authoritative ledger as trusted, restricted operational data; it is not a user-upload endpoint.

Before reopening access after a real restore: replay deletions and session revocations newer than the backup, finish purges, verify owner/negative authorization, and confirm all delivery stays disabled until its own checks pass. The synthetic local drill restores one subject's old Auth/profile/session rows only; it is not a full physical backup/RPO/RTO certification. OPS-02 now supplies [encrypted local server backup expiry and full-schema isolated replay](SERVER-BACKUP-RECOVERY.md); hosted recovery, off-site/lost-source authority and service reopening remain pending.

## Device cleanup and offline limits

`rise-accounts` stays IndexedDB version **1** and accepts cache formats **1/2**. Cleanup uses the existing accounts/preferences transaction with strict durability. An owner-specific clear generation invalidates old stores across tabs. Deletion additionally persists a minimal owner tombstone; an old tab cannot recreate that cache after the transaction. Session-only memories, pending queues/recovery sources and account views are closed on recognized deletion. The guest `rise-device` database, legacy `rise.local.v1` and other owners are untouched.

Quota/blocked-storage failure is not reported as cleanup success: account access/view is hidden, original local data remains inaccessible, and the account sheet offers a retry. Minimal local clear/deleted-owner markers contain no records, email, credentials or prayer content and remain until browser-origin storage is removed.

Foreground alert work captures its account scope; delayed work and callbacks are ignored after the scope changes. Cleanup closes that owner's displayed alerts and removes only its delivery-deduplication keys. Guest alerts and public offline caches remain. Current notification API responses are never in the public cache. A downloaded export cannot be remotely erased.

A disconnected device cannot be remotely wiped. On its next recognized deletion response or shared-device marker refresh, it hides and clears the owner cache. Terminal cookie recognition is bounded by retained deletion metadata; a much later disconnected device may instead see an expired session and retain locked pending data for manual device cleanup. It can never use that cache to restore the deleted server identity. Do not promise remote erasure while offline.

## Group and push integration hooks

`rise_private.deletion_integrations_ready()` is checked before both request and purge. PUSH-01 now implements subscription/test cancellation before suppression and Auth-root cascading purge for its two tables. PUSH-02/03 extend cancellation and Auth-root cascade to the implemented `push_plans`, `push_jobs` and `push_plan_receipts`. The later minimal `push_receipt_floors` marker also cascades from the account root; its cleanup transaction shares the owner lock. GROUP-01 now integrates locked last-owner resolution and immediate membership identity scrubbing before suppression. GROUP-02 adds [retained family content](SHARED-CONTENT.md) through stable group/member references, so member identity scrubbing and group cascade cover task snapshots, lists and items. Private opaque task priorities retain the personal account-root cascade; deleting the account purges its selections, while group deletion or member removal leaves other accounts' selections available for explicit removal. Private exports contain only those opaque references, without shared content or access. GROUP-03 now erases authored squad posts, reactions and private previews before suppression, includes former memberships and repeats cleanup during terminal backup replay. GROUP-04 now erases recipient/source-author `notification_jobs` under sorted affected-group locks before suppression and during terminal replay. Readiness requires the table and named cleanup hook; absence blocks deletion. Dispatch/receive also check retained recipient/author suppression after a restored job or membership. See [group notification recovery](GROUP-NOTIFICATIONS.md). Real membership controls now resolve last-owner actions in the browser; family task/list controls and real squad content now use their local/test boundaries; squad acceptance is locally verified. See [exact snapshots](SQUAD-SNAPSHOTS.md). Non-secret group operation drafts share the account cache and its cleanup/departure safeguards; group views and invitation tokens are transient. See [the subscription lifecycle](PUSH-SUBSCRIPTIONS.md) and [receipt retention](PUSH-RETENTION.md).

[GROUP-01 membership](GROUP-MEMBERSHIP.md) now supplies locked last-owner resolution (transfer or explicit group deletion), a restrictive ledger guard and deidentified member rows. The lifecycle worker commits terminal group cleanup on a separate connection before provider deletion to avoid holding group locks across the provider connection. It requires the retained ledger and also removes restored pre-transfer ownership. GROUP-02 now retains family history through deidentified stable member IDs. GROUP-03 extends the seam with erasure of authored squad content/reactions/previews, sorted affected-group locks and transactional revision changes. PUSH-01–03 supply current subscription/test/plan/job cleanup and dispatch-race handling. Do not enable those modules while leaving this readiness hook as a placeholder. Component cancellation and dispatch-race tests exist. [GROUP-05](GROUP-LIFECYCLE.md) now verifies the combined local last-owner, current-member export, deletion, cross-tab cache and server-backup replay boundary. [Dated evidence](evidence/group-lifecycle-2026-10-24/README.md). Hosted backup operations and device acceptance remain pending.

## Verification, recovery and release status

See [DATA-04 evidence](evidence/account-lifecycle-2026-10-22/README.md) for actual passing commands, synthetic-only browser captures, hashes, isolation checks and limitations. Unit tests cover private-file validation, restore projection and cross-environment ledger rejection. Real Auth/Postgres tests cover recent authentication, RLS, all-session revocation, races, populated cascading purge, retry, retention and old-backup replay. Browser checks exercise real email-code flows without traces/video/screenshots containing usable codes.

Do not roll a suppressed account back into active use to recover a failed purge. Fix the cleanup service and retry the stable job. Do not delete the ledger, remove the new cascade links, reset a retained stack or auto-import a recovery file. Rollbacks must preserve suppression and either keep DATA-04-compatible authorization or disable account access. Cloud provisioning and production/physical-device acceptance stay pending.
