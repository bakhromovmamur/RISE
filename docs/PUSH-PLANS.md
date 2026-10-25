# Local durable notification plans — PUSH-02

**Current integration:** [live local sender and receive-time authorization](LIVE-PUSH-SENDER.md) now connect the existing consented queue to the encrypted transport. Cloud provisioning and physical-device acceptance remain pending. Earlier increment evidence retains its original scope.

Implemented 23 October 2026 for PRD-11 and the scheduling substrate of NFR-05. Cloud provisioning remains pending. The queue is local; explicitly starting the sender enables dispatch for consented plans. There are no new screen controls, automatic uploads or changes to guest/account storage formats.

## Plan boundary

`src/push/plan.ts` projects the existing pure `buildPrayerSchedule` result into stable opaque event UUIDs and absolute UTC fire/expiry instants. It retains the existing eligibility decisions and does not write records or XP. The horizon is seven absolute days; each event expires within two minutes. Coordinates, calculation keys, prayer names, notes, titles and drafts do not cross this projection.

Authenticated local/test installations can POST `/api/v1/push/plan` through the existing Origin/CSRF/session boundary. The request includes account assertion, stable request UUID, expected generation, current personal source revision, explicit takeover boolean, IANA timezone and at most 84 sorted events. Unknown fields, duplicate keys, invalid timestamps, elapsed events, beyond-horizon expiry and bursts exceeding 12 events per hour are rejected. Requests are limited to 144 accepted generations per account per rolling day.

The first primary installation and every takeover require explicit `takeover: true`. A different installation cannot silently replace the account plan. Under the owner transaction lock, the server compares generation and current source revision, cancels pending old jobs, records the new plan, fans out to currently opted-in installations and commits the immutable request receipt. Replaying an identical request returns the original receipt; changing its body conflicts. A receipt is historical acknowledgment of staging, not current readiness. GET on the same endpoint exposes current generation, actual last queued fire time, expiry and status counts. The current GET reports sender liveness; POST receipts preserve their original liveness observation.

## Durable jobs

The additive migration creates `push_plans`, `push_plan_receipts` and `push_jobs`. All have forced RLS, verified owner/session policies and Auth-root cascade deletion. Composite subscription references prevent cross-owner destinations. Public/anonymous/provider client roles have no grants. The worker cannot insert plans/jobs, change their owner, destination, timestamps or generation, or read generation receipts/private journey data. It can read bounded scheduling fields and update delivery progress.

`claimPushJob` atomically claims one due job with `FOR UPDATE SKIP LOCKED`, a random lease token and a 30-second database-clock lease. Restarted workers can reclaim elapsed leases; stale holders cannot commit. `dispatchPushJob` rechecks lease, current plan generation, subscription version/consent and current session authorization under the owner lock. Expired jobs never newly dispatch. Success means provider acceptance only. HTTP 404/410 retires endpoint material; transient/network/429/5xx responses use bounded exponential retries, at most five attempts, within expiry. Other errors terminate. The database clock governs horizon, dispatch and retry decisions.

`runPushJobs` remains a bounded tick with an injectable transport. The local `sendPushReminders` adapter now supplies the protected VAPID/encryption path. `push:run` and `push:watch` process due reminders and explicit tests; the root worker performs current-session receive authorization before display. See [the running sender contract](LIVE-PUSH-SENDER.md).

Expired queue records may be pruned after 24 hours by the restricted worker. Generation/cancellation receipts now expire after seven days through bounded restricted cleanup. Generation-bound cancellation and owner retention markers protect old retries; see [retention and rollback](PUSH-RETENTION.md). Logout, device disable and deletion cancel pending/leased jobs through the existing lifecycle boundary. Root cascade removes jobs/plans/receipts on primary account purge.

## Verification and limits

See [dated evidence](evidence/push-plans-2026-10-23/README.md). Tests use isolated local/test databases and synthetic accounts/transport only. No cloud resources, external emails, real provider pushes or user-preview data are used.

PUSH-03 cancellation/quiet hours and PUSH-04 consent/renewal/readiness/live transport are integrated locally. Receiving installation consent does not automatically backfill previously staged jobs; a new explicit generation is required. Current source revision prevents stale submission, and subsequent domain mutations use the transactional cancellation hooks. The local 100-account/200-job load fixture and bounded retention are implemented. Hosted NFR-05 load acceptance, supervision and physical-device evidence remain open. Provider submission followed by a process crash can still be retried; this is not exactly-once delivery.

## Recovery

Apply the additive migration through `npm run infra:up -- local` and `npm run infra:up -- test`; never reset existing volumes. Restarting a scheduler preserves jobs/receipts and permits expired lease recovery. No rollback requires clearing saved profiles or subscriptions. Keep the migration installed when rolling back the application; do not drop queue history to resolve an incident. Retain the live-dispatch gate during backup replay and reapply account-deletion suppression before allowing access.

Database policies follow [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security); claims use [PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE). Current Supabase changelog and installed skills were consulted for this local schema change.
