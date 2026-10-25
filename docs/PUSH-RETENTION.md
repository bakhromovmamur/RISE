# Bounded local push processing and receipt retention

Implemented 23 October 2026 for PUSH-02/PUSH-03, PRD-11/19 and SEC-04/05. Cloud provisioning remains pending. This extends the [sender](LIVE-PUSH-SENDER.md) and [cancellation](PUSH-CANCELLATION.md) contracts without changing personal records, consent or browser-storage versions.

## Processing bounds

The isolated sender has five database connections and at most four concurrent reminder submissions per tick, plus one explicit notification test. A full reminder batch continues immediately; an idle or deferred batch waits one second. Database-clock leases, expiry and final active-session/installation/generation checks still apply. A busy owner's reminder releases its lease for a one-second retry without consuming a provider attempt. The owner lock remains held across the final provider call, so cancellation and dispatch retain their existing ordering.

All in-flight lanes settle before a failure exits the process. The existing DNS and HTTPS transport timeouts bound a provider attempt. Heartbeats refresh before and after the bounded tick; stop removes only the current process's heartbeat. This is a local process, not an installed supervisor or an availability guarantee.

Expired queue updates and job/test/heartbeat deletions select bounded batches, with `SKIP LOCKED` where rows are locked. Jobs and explicit tests retain their previous one-day cleanup thresholds; heartbeat cleanup also uses one day. The sender retires at most 200 plan/cancellation receipts per tick. The maintenance function accepts 1–500 and returns only a count. Expiry/cleanup indexes support these scans. A stopped sender does not perform scheduled cleanup; hosted scheduling and monitoring remain OPS-01/02.

## Receipt expiry and retry safety

Plan and cancellation receipts expire after seven days. While retained, their digest and result remain immutable and exact retries return the original result. Plan replacement still compares `expectedGeneration`; a forgotten old plan request cannot recreate its earlier generation.

New cancellation intent is marked protocol 2 in `rise-push-device` version 1. Before its first POST, the client reads an authorized plan head and durably captures `throughGeneration` using the existing revision CAS. No POST occurs if that write fails. The request ID, keys and generation then remain fixed across lost replies, reloads and retries. The server can cancel only jobs at or below that generation. A repeated cancellation after receipt expiry remains harmless to later generations and returns the same minimal acknowledgment. A future bound is rejected.

Existing unversioned pending requests remain readable and keep their original ID/body. Cleanup records a minimal owner-scoped `push_receipt_floors` marker in the same transaction that removes receipts. Once that marker exists, an unknown legacy cancellation cannot safely be distinguished from an old lost reply, so the server returns `cancellation_review_required` without changing jobs. A retained legacy receipt can still replay exactly.

The current notification sheet explains the unresolved cancellation in English, Russian and Uzbek Latin. Local blocked events and original intent remain. **Cancel current reminders** is a new explicit choice: it stops renewal on this device and creates a new bounded cancellation against the current authorized plan. Observing identity, retrying, refreshing or making an unrelated edit never silently rebinds a request marked for review. Automatic plan renewal stays blocked until cancellation is resolved. No new permission request or subscription is created.

## Authorization and deletion

`push_receipt_floors` forces RLS, requires the verified current owner/session for BFF reads and cascades from `auth.users`. It contains the owner ID and cleanup cutoff only; no event keys, scheduled instants, source text or credentials. The BFF cannot insert/change markers or delete/update receipts. Other owners and public/provider API roles cannot read the markers.

The non-login `rise_push_retention` role owns the fixed private cleanup function. It can read only receipt owner/ID/creation time, delete only receipts older than seven days and maintain minimal markers. It has no receipt-body, subscription, personal-data or provider-token access. Only the isolated worker can call the function; ordinary account routes cannot. Each candidate uses the same owner advisory lock as requests, cancellation and deletion; busy owners are skipped. Floor advancement and deletion commit or roll back together. Primary account purge removes both receipts and the marker through owner-root foreign keys.

## Local capacity evidence

`npm run check:push-load` runs only against the fixed test installation. It creates 100 synthetic accounts, two installations each and 200 simultaneously due jobs through the real BFF. The real restricted queue, session checks and encrypted signer run with an injected provider boundary that waits 100 ms and accepts each request. No external push is sent. Other imminent work prevents the run; it removes only the synthetic accounts it created.

The recorded run submitted all 200, with four concurrent submissions, p50 **3,269 ms**, p95 **7,322 ms** and maximum **7,716 ms** from database due time. This meets NFR-05's 30-second threshold for this explicit local fixture. It does not establish hosted capacity, a provider latency distribution or end-device delivery. Hosted load agreement, supervision and physical HTTPS-device evidence remain open.

## Migration and rollback

Apply `20261023115410_bounded_push_queue_retention.sql` through `npm run infra:up -- local` and `npm run infra:up -- test`; retain existing volumes and protected configuration. No guest/account journey cache or original recovery source is migrated or removed. Optional cancellation fields preserve push-control database version 1 compatibility. Account exports continue to exclude operational receipts and markers.

Receipt removal is intentional and cannot be undone by rolling back code. **After cleanup has run, retain the generation/floor-aware cancellation API.** Older code that ignores markers could repeat an old cancellation against a newer plan. Stop the sender before operational rollback or backup restoration, preserve the migration and markers, and keep dispatch disabled until receipt/generation and account-deletion replay have been reconciled. An old backup is not authority to recycle plan generations or regain consent. Hosted restore acceptance remains OPS-02.

Verification commands: `npm run check`, `npm run test:infra`, `npm run test:push`, `npm run check:push-load`, `npm run test:visual`, and the local/test database advisors. See [dated evidence](evidence/push-retention-2026-10-23/README.md) for exact results and limits.
