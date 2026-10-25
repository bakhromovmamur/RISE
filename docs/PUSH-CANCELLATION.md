# Cancellation, acknowledgment and quiet hours — local PUSH-03

23 October 2026. Implements the local cancellation boundary for PRD-10/11 and SEC-04 on the staged PUSH-02 queue. Cloud provisioning remains pending; [live reminder dispatch and receive authorization](LIVE-PUSH-SENDER.md) are now integrated locally. No screen redesign, profile migration, native delivery change or automatic subscription is introduced.

## Transactional server behavior

The existing personal command transaction invokes `cancelForCommand` after validated domain reduction and record writes, before the operation receipt commits. Both command and dispatcher use the same owner advisory lock. Replayed commands return their existing receipts without repeating effects. A failed transaction cannot leave only its cancellation committed.

| Accepted action | Pending/leased jobs canceled |
| --- | --- |
| Prayer record or correction | Matching date/prayer preparation, due and wake events |
| Dated “I'm up” or Fajr plan edit | Only that date's wake and backup; prayer reminders remain |
| Dated timetable/coverage replacement | Events for that date |
| Pause/resume, prayer preference/rule, timezone or quiet-hours change | Remaining plan coverage; a new generation is required |
| Consented account import | Remaining old coverage before imported state commits |
| Subscription disable, logout or account deletion | Existing owner/device lifecycle cancellation |
| Wake preview, preview acknowledgment, navigation, appearance | No queue effect |

Cancellation clears lease tokens and recomputes actual remaining coverage. It never creates a prayer record or adds XP. A current-revision plan is filtered against recorded prayers, private pause exclusions and dated Fajr acknowledgments, so resubmission cannot revive those known event keys. Event IDs are derived by the shared opaque-key function; sensitive source content is not placed in jobs.

The local/test `/api/v1/push/cancel-plan` endpoint takes an owner assertion, stable request UUID, bounded event-key selection (null means all selected generations) and, for new requests, an immutable `throughGeneration`. The bound is durably captured from an authorized head before the first POST. Verified session, Origin, CSRF and the owner lock apply. Immutable receipts make a lost-response retry return the original result without canceling a later generation. Altered bodies conflict. Cancellation receipts have an account-level rolling limit; local stop metadata remains pending on failure. Receipts expire after seven days. Bound requests still cannot affect later generations; unverifiable legacy requests require an explicit current-plan choice in the existing sheet. See [retention, compatibility and rollback](PUSH-RETENTION.md).

## Offline behavior

A successful account command starts installation-local invalidation in the separate revisioned push-control database. The local record keeps opaque blocked event keys, an all-plan stop when necessary, and the cancellation request pending bit. It contains no coordinates, authored notes or credentials. Reconnection retries the same request and clears only its matching pending bit. Newer edits cannot be cleared by an older response. Subscription consent is retained; this is not implicit unsubscribe/re-enable.

The existing background-notification section displays localized pending cancellation and stopped-plan text in English, Russian and Uzbek Latin. The page also rechecks current prayer eligibility before foreground display. Preview-only commands never create cancellation intent. Account switching clears owner-bound cancellation metadata with the existing push cleanup.

There is no claim that offline cancellation recalls an already submitted push. Local metadata writing is asynchronous relative to the journey save; a metadata failure or interrupted page requires reconciliation before renewal. PUSH-04 blocks renewal until cancellation metadata settles and uses a fresh server plan read after confirmation. Receive-time authorization and local cancellation checks remain mandatory.

## Quiet hours

The pure plan projection and server staging filter use the selected IANA timezone and existing quiet-start/end settings. Midnight-spanning ranges are supported; start is inclusive, end exclusive, and equal clocks represent an empty interval. Repeated DST civil times receive the same rule. Prayer/Fajr suppression is the default. A plan may opt out only through explicit `allowDuringQuiet: true`; this is recorded per accepted plan and never inferred from previous subscription permission.

Receipts and current metadata report suppressed counts and the actual last queued eligible time. An entirely suppressed plan has no coverage timestamp. Existing foreground/native settings remain unchanged; PUSH-04 implements local scheduling/override controls and full readiness. Habit quiet hours always apply; group scheduling remains GROUP work.

## Page/worker display coordination

The `rise-alert-ledger` IndexedDB database, version 1, holds only owner/event/instant keys and expiry. Atomic readwrite claims serialize page and worker display attempts. The existing guest localStorage ledger is preserved. Account cleanup deletes only the matching owner's ledger entries and visible alerts; it does not clear public PWA caches or guest history. Old event metadata is pruned after expiry plus one day.

A scheduled worker envelope requires matching owner, installation, subscription version, an unexpired two-minute window and no local cancellation marker. The local sender integration additionally requires fresh same-origin server authorization for the exact event tuple; a locally cached plan generation does not authorize delivery. This supports closed secondary installations across renewed generations. The receiver uses generic localized copy and never turns a click into a prayer record or Fajr acknowledgment. Stale, canceled or duplicate pushes receive silent generic settings copy to respect user-visible push constraints; they do not appear as timely alarms. The page and worker use the same occurrence tag.

A claim precedes display. A crash or display failure can lose that occurrence; the ledger is not proof of display and does not promise exactly-once provider delivery. Tests of worker source with real IndexedDB are local logic evidence, not physical device notification evidence.

## Dispatch race and recovery

If cancellation commits before dispatch acquires the owner lock, the stale lease cannot send. If provider submission wins, cancellation cannot retract that accepted submission. Remaining jobs still stop. The test suite controls both orders without contacting a real provider.

The additive migration adds quiet-policy/suppressed-count columns to existing plans. Existing plans default to no quiet-hours override. Keep the schema when rolling back application code; preserve all original guest/account caches and migration sources. Cancellation, renewal and readiness are integrated locally. Hosted deployment remains gated on supervision, operational acceptance and physical-device evidence.

See [PUSH-02 contract](PUSH-PLANS.md), [subscription security](PUSH-SUBSCRIPTIONS.md) and [dated evidence](evidence/push-cancellation-2026-10-23/README.md).
