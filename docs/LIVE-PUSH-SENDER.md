# Local background sender integration

Implemented 23 October 2026 for PUSH-02/PUSH-04, PRD-05/11/19 and SEC-04. Cloud provisioning remains pending. The local worker now sends consented prayer, Fajr and habit queue entries through the existing encrypted Web Push transport. Verification uses synthetic subscriptions and an injected provider response; physical HTTPS delivery and hosted NFR-05 acceptance are not claimed. The later [bounded processing/retention increment](PUSH-RETENTION.md) adds measured local load evidence.

## Running locally

Apply the additive migration with the existing environment tools, then start the BFF and sender separately:

```sh
npm run infra:up -- local
npm run server:local
# In a separate terminal:
npm run push:watch -- local
```

The BFF’s browser entry uses loopback 4192 while retaining the original 4190 installation marker and legacy Chromium storage. The isolated fixture suites use 4191; the user's frontend preview on 4173 is unaffected. The fixed alternate entry resolves the Firefox/WebKit block on 4190 without moving profiles. No public hostname, HTTPS host or domain configuration is created.

`push:watch` handles at most four concurrent due reminders, followed by up to two concurrent group notices alongside one queued explicit test per tick, refreshing sender liveness between phases. Group notices use the separate [GROUP-04 consent and source boundary](GROUP-NOTIFICATIONS.md). A full reminder batch continues immediately; an idle/deferred batch waits one second. The worker pool has five connections. `push:run -- local` performs one bounded tick and exits; it does not leave an active background service. Multiple processes share recoverable database leases. SIGINT/SIGTERM stop after the current bounded tick and remove only that process's heartbeat. Unexpected failures exit nonzero; an operator must restart. No OS login service or hosted supervisor is installed.

**These commands use the real provider transport.** Run them only for devices explicitly opted into background notifications. Reminders require an explicitly saved account plan; group notices require the recipient’s separate saved group opt-in and an eligible explicit shared action. Opening RISE, signing in, importing a guest profile or granting foreground habit consent never starts a sender or creates a background plan. Development verification replaces the outbound provider boundary; it sends nothing to real devices or people.

Both commands retain fixed local/test database ports, environment/installation checks, restricted worker-role verification, protected key files and VAPID pair validation. Signing keys remain outside the BFF/browser. Hosted targets remain refused. Existing `.rise-infra` key files must be preserved; do not regenerate them to repair data.

## Dispatch and readiness

`server/push/worker.ts` adapts the existing leased-job dispatcher to endpoint decryption, VAPID signing and AES128GCM payload encryption. The existing HTTPS provider allowlist, connection-time DNS/IP validation, TLS pinning, no-redirect rule and bounded transport apply to reminders as well as tests. No new dependency or credentials were introduced.

The final dispatch remains under the account lock. It checks the lease, current generation, installation version/consent, verified active provider session and database-clock expiry. Network errors, 429 and 5xx retry with existing bounded backoff; 404/410 retire and erase the capability; malformed stored capabilities fail closed. Success records provider acceptance, never device display. The payload contains only opaque event/owner/installation IDs, subscription and plan versions, absolute event/expiry instants and language. Even devices allowing detailed copy receive generic copy in this increment.

The new private `rise_private.push_senders` table contains a random process ID and heartbeat only. Forced RLS and grants allow the worker to maintain liveness and the BFF to read it; public/provider API roles have no access, and the BFF cannot write it. GET plan readiness reports `dispatchEnabled` only while a heartbeat is no more than 30 seconds old. Clean stop removes it immediately; crash or sleep expires it. Multiple process records prevent one process's exit from stopping another's readiness. Old heartbeat rows are removed after one day.

The existing renewal coordinator now coalesces refresh requests arriving during an active request and rechecks a changed source afterward. It reads current identity, saved state and consent again; it never replays a stale takeover choice. This prevents a sync-completion event from being lost until the next one-minute poll.

The existing sheet uses its existing staged/scheduled states and actual per-device queued coverage. The sender increment preserved layout, style, navigation and saved-profile formats; the retention increment adds only a localized recovery message/action in the same notification sheet. A POST receipt remains immutable historical evidence; its liveness field can be old on replay. Only a fresh GET determines readiness. Readiness is a recent observation, not an uptime or delivery guarantee. Seven-day receipt cleanup, bounded batches and local p95/load evidence now exist in [the retention contract](PUSH-RETENTION.md). Hosted supervision/load acceptance and physical delivery remain open.

## Receive-time authorization

A receiving installation may be closed when another device renews the plan. Requiring its locally remembered exact plan generation would incorrectly reject all new generations. The root service worker therefore validates the bounded payload and local consent/cancellation metadata, then performs a read-only, same-origin, credentialed, uncached GET to `/api/v1/push/reminder` with the exact opaque event tuple.

The BFF revalidates the current session and installation cookie. Under the owner lock it checks current account plan, matching current subscription version, exact event/expiry instants, an unexpired leased/accepted job and absence of presentation cancellation. Only `{valid: true}` authorizes presentation. It never returns personal data, capabilities or a full plan. Unknown fields and malformed identifiers/timestamps are rejected. Different owners, handles, sessions, old generations and altered event times cannot authorize an alert. The endpoint is local/test only; responses bypass PWA caching. The BFF logs route templates without query strings. Any future proxy/access logger must also omit these queries: opaque identifiers and event times are sensitive routine metadata.

After authorization the worker claims the shared page/worker occurrence ledger and rechecks local consent and expiry. It does not require a page to refresh the locally remembered plan generation. It never modifies habit, prayer, Fajr acknowledgment or XP records. Notification clicks retain the existing root-open/focus behavior. The receiver must have network access and a still-valid signed-in session. Offline, timeout, stale, duplicate or denied delivery produces the existing silent generic settings notice, not a timely prayer/habit alert; this preserves the user-visible push contract. The added network round trip can suppress an otherwise timely notification if verification is unavailable. Physical platform behavior remains unverified.

## Cancellation and audit

Queued/leased jobs continue to cancel transactionally with personal commands and explicit cancellation requests. The additive `presentation_canceled` flag also suppresses already accepted jobs while preserving their `accepted` provider outcome and attempt count. Replacement plans invalidate old generations; disable/logout/deletion invalidate subscription/session authorization. This covers a provider-accepted message arriving after acknowledgment, completion, pause or settings changes have committed.

A provider request already in flight cannot be recalled. A final race remains between successful receive authorization and OS presentation. Local cancellation is rechecked, but a remote change arriving after that check may lose the race. Do not claim exactly-once delivery or guaranteed wake-up. The existing two-minute expiry remains for every locally queued reminder, including habits; the proposed longer habit TTL is still a separate coordinated change.

## Recovery and rollback

The migration is additive: no profile, guest/account cache, outbox, recovery source, subscription capability or historical queue is replaced. Stop the sender before rollback or backup restoration. Preserve the new table/column and migration history; older code ignores them. Remove only sender heartbeat rows or wait at least 30 seconds before reopening readiness after restore, and replay the existing account deletion/revocation ledger before allowing dispatch. Roll back sender, receiver/API and readiness behavior together; an older worker's exact-generation check cannot receive new plan generations on a closed secondary device. Preserve keys and user data throughout.

Evidence: [local integration verification](evidence/live-push-sender-2026-10-23/README.md). Related contracts: [subscriptions](PUSH-SUBSCRIPTIONS.md), [queue](PUSH-PLANS.md), [renewal](PUSH-RENEWAL.md), [habit eligibility](HABIT-REMINDERS.md) and [cancellation](PUSH-CANCELLATION.md).
