# Optional group notifications

**24 October 2026 · GROUP-04 / PRD-11, PRD-14–15.** The local/test implementation connects explicit group preferences to the isolated sender and guarded receiving worker. Cloud provisioning remains pending. Verification uses synthetic accounts, subscriptions and provider/display boundaries; it does not establish physical arrival, sound or a hosted service.

Local acceptance is complete and recorded as REVIEW for hosted/device acceptance. [The evidence report](evidence/group-notifications-2026-10-24/README.md) includes exact commands, source/build hashes, unchanged visual comparisons and initial failures/fixes. [GROUP-05](GROUP-LIFECYCLE.md) now verifies combined local shared-export/cache/deletion/server-backup replay; hosted operations and physical-device acceptance remain pending.

## Separate choices

Group settings add **Receive group updates**, initially off. Saving it never requests browser permission or enables an installation. The separate **Background notifications** sheet reuses existing installation permission, enable/disable, privacy and explicit test controls. It does not require a prayer plan. A recipient needs both the saved group choice and an explicitly enabled current installation/session. Opening, logging in, restoring or refreshing never grants either choice.

Legacy preference commands omit `notifications` and preserve the server value; an unmuted legacy group is not consent. Immutable pending commands retain their original body and ID. Old four-field drafts remain readable. An old acknowledgment cannot erase a newer explicit choice; competing revisions retain the draft for review. These device-only drafts use the existing account store and remain excluded from portable backups. There is no cache format change.

Eligible actions are creating/editing a task assigned to another active member and explicitly publishing/republishing a squad update to other active members. Self-notices, list edits, task check-ins/Undo, reactions and private habit/prayer actions do not create group notices. Enabling consent never backfills old actions. Messages expire two minutes after their database-clock creation; quiet hours suppress them rather than deferring them until morning.

Mute and quiet hours always apply in the group's IANA timezone, including when prayer delivery has its own quiet-hours override. The interval includes its start and excludes its end; equal times mean no quiet interval. Saving changed preferences cancels already queued/accepted presentation, and a later unmute does not resurrect it.

All notice copy is generic in English, Russian and Uzbek Latin, including on an installation allowing detailed copy. No group/task/member name, authored note, reflection, private total, prayer status or route is sent. The payload contains only version/type, opaque job/owner/installation IDs, subscription version, absolute event/expiry instants and language. Pushes and clicks never record completion, prayer or Fajr acknowledgment and never award XP.

## Transaction and authorization

`rise.notification_jobs` stores the opaque delivery tuple, stable source/recipient membership references, source task/post revision, accepted operation ID and bounded dispatch metadata. Auth, group, membership, source and installation foreign keys supply cascade cleanup. Jobs have forced RLS. The BFF has no direct table access; the non-login group guard creates jobs after the content and receipt are accepted inside the same transaction/savepoint. Failure rolls back content, revision, receipt and jobs together. Exact receipt replay does not enqueue again, even after expiry, cleanup or quota suppression.

`server/push/groupJobs.ts` uses recoverable 30-second leases. Final dispatch acquires recipient actor, group, then job locks and holds them through the provider request and committed outcome. It rechecks current recipient session, both memberships, source revision/assignment/publication, group archive, preferences, installation version, expiry and retained deletion suppression for **both** recipient and source author. A source account's restored membership/job cannot override its deletion ledger. Shared changes and lifecycle cleanup use the compatible group lock order; dispatch never acquires another account lock while holding a group.

The worker receives only operational job columns and a boolean authorization capability. It cannot read shared text, private journeys or source-author IDs, grant consent, insert jobs or reset presentation cancellation. The group guard receives subscription authority fields but no encrypted endpoint, key material or language column. Existing VAPID/encryption, destination restrictions and protected signing process remain unchanged. The BFF never receives the signing key.

The sender tick processes up to four concurrent reminders, then up to two concurrent group jobs alongside one explicit test, with fresh database-clock heartbeats between phases. Every phase settles before a failure propagates. Network errors, 429 and 5xx retry with bounded backoff, at most five attempts and only inside the original expiry. A 404/410 retires the installation and clears its capability. Provider acceptance remains acceptance; it proves no device display or sound.

`GET /api/v1/push/group` accepts a closed exact tuple and returns only `{valid: boolean}`. The local/test BFF verifies the current session, owner assertion and installation cookie and runs the same current-source authorization. Accepted or currently leased unexpired jobs may authorize; altered times/versions/owners, revoked membership, suppression and stale installations may not. Responses are no-store, private API requests bypass PWA caching, and route logs omit query strings. Future proxy logs must also omit those identifiers and timestamps.

After authorization the root worker atomically claims the existing occurrence ledger and rereads current installation consent and expiry. A prayer plan's generation or cancellation state does not confer or deny group consent. Unknown fields, offline/timeout, duplicates and denied authorization use the existing silent generic settings notice required by the visible-push contract. Notification clicks only open/focus RISE. A remote change after the final authorization check can still race OS presentation; an in-flight provider request cannot be recalled.

## Limits and retention

Only the operator can change `rise_private.group_notification_limits`; browser/provider roles cannot. These are abuse/capacity controls, not paid features.

| Limit | Default | Allowed range |
| --- | --- | --- |
| Jobs per recipient in the past hour, across groups/installations | 30 | 1–1,000 |
| Distinct notifying operations per author in the past hour | 100 | 1–5,000 |
| Jobs from one accepted operation | 500 | 1–2,500 |
| Retained jobs per recipient | 1,000 | 1–100,000 |
| Retained jobs per group | 10,000 | 1–100,000 |
| Retained jobs globally | 100,000 | 1–1,000,000 |

The short enqueue-only capacity lock makes concurrent checks coherent. Canceled and accepted jobs still count until retention cleanup; corrections do not bypass frequency limits. Reaching a limit suppresses optional delivery while accepting the shared content change. The settings explanation states that frequent updates may be limited. Retrying an accepted action never manufactures later delivery. Current active members can still read the shared update normally.

Each claim expires at most 500 stale queued/leased jobs. Each sender pass deletes at most 500 jobs more than one day beyond expiry, enforced by the worker's narrow DELETE policy. A stopped worker leaves retained rows bounded by the creation caps. These bounds and functional capacity checks are local evidence; hosted load and operational alarms remain release gates. Invitation limits and 20-row owner pages have their separate [contract](GROUP-INVITATIONS.md).

## Cancellation, deletion and recovery

Archive, source correction/withdrawal, recipient or author departure/removal, changed preferences, subscription rotation/disable and logout transactionally cancel pending jobs. Accepted jobs retain their outcome and completion time while `presentation_canceled` blocks later presentation. Restoring a group or reenabling consent creates no old jobs.

Account deletion acquires sorted affected-group locks and erases both recipient and source-author jobs before suppression. The terminal purge repeats this cleanup for restored data. Integration readiness requires the installed table and named cleanup hook; a missing hook blocks deletion rather than skipping cleanup. Auth-root cascades provide an additional final boundary. The retained ledger remains authoritative and must never be deleted to repair failed cleanup. [Account lifecycle](ACCOUNT-LIFECYCLE.md) and GROUP-05 cover the wider integrated release gate.

Additive migrations: `20261023200054_optional_group_notifications.sql` and `20261024054131_group_notice_source_suppression.sql`. Rollback keeps these tables/columns/functions, migration history, guest/account caches and installation keys. Stop the sender before rollback/restore, preserve deletion suppression, replay cleanup before resuming, and roll back the optional effect/receiver/UI together. An older sender ignores group jobs; an older preference command preserves the explicit flag. Do not rename/recycle accepted operation IDs or reset a user's origin to recover.
