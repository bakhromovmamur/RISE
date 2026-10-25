# Per-installation Web Push setup

**Current integration:** [live local sender and receive-time authorization](LIVE-PUSH-SENDER.md) now connect the existing consented queue to the encrypted transport. Cloud provisioning and physical-device acceptance remain pending. Earlier increment evidence retains its original scope.

**Task:** PUSH-01 · **Requirements:** PRD-11, SEC-04 · **Scope:** local/test only, 22–23 October 2026.

RISE now implements account-bound browser permission, subscription, privacy, revocation and an explicit background-test path. Cloud provisioning remains pending. Prayer, Fajr and habit scheduling is **not enabled** by subscribing; PUSH-02–04 now connect separately consented plans and a running local sender. Physical HTTPS iPhone/Android acceptance remains PUSH-05. The original foreground reminders, domain rules and saved profiles remain intact.

## User flow

Open **You → Prayer preferences → Alarm readiness → Background notifications** on the BFF origin. Sign-in is required; it does not import guest data. A static frontend with no available BFF retains its existing foreground flow.

1. Capability detection distinguishes insecure context, unsupported API and iPhone/iPad installation required. On iPhone/iPad, use Share → Add to Home Screen and reopen that icon. Supported Android browsers can subscribe without a separate native app.
2. **Enable background notifications** is the only permission/subscription action. Permission is requested directly from that gesture. Denied permission is never requested again until the browser/device setting changes; Refresh rechecks it.
3. Successful setup reports **Subscribed · no reminder schedule yet**. A subscription is not a confirmed prayer/Fajr schedule.
4. Generic lock-screen copy is the default. Detailed copy requires a separate switch and **Save notification privacy** on this installation. Tests always remain generic. Changing the interface language does not rewrite authored text; the notification language can be saved explicitly.
5. **Send a background test** creates one bounded request. The interface distinguishes queued, provider accepted, failed/retired/expired/canceled and a browser-reported display observation. Display reporting is not evidence of audible sound, timely delivery or wake-up.
6. Turning off first writes disabled local consent and unsubscribes the browser, then retires the server endpoint. An offline/failed server acknowledgment leaves cancellation visibly pending and retryable. Reconnecting can finish revocation; it cannot enable or replace a subscription automatically.

Use a separate phone alarm for Fajr. A provider-accepted message can arrive after cancellation. The worker shows only a generic settings notice for stale, expired, malformed or no-longer-authorized test messages; it never presents them as timely prayer alerts.

## Local operation

Use the pinned toolchain and retained isolated environments:

```sh
npm ci
npm run build
npm run infra:up -- local
npm run server:local
```

In a second terminal, start the separate sender (explicit tests and consented reminder plans):

```sh
npm run push:watch -- local
```

`npm run push:run -- local` performs one pass. Substitute `test` only for the fixed isolated test installation. These commands refuse staging/production targets and do not provision cloud resources. No background sender runs merely because the frontend is open. A stopped sender leaves the request queued until its two-minute expiry; acceptance is never simulated.

The local browser entry uses `http://127.0.0.1:4192`; fixture browser tests use 4191. The fixed alias resolves the WebKit/Firefox block on 4190 while retaining that installation marker and old browser storage. See [current local-entry evidence](evidence/product-review-2026-10-23/README.md). HTTPS staging and real devices are still required before release. The personal preview on 4173 is separate and was not opened or modified for this task.

### Protected configuration

`infra:up` adds a version-one push key record to each existing protected installation state, preserving all prior credentials and database volumes. Partial/invalid key records fail rather than being replaced. Local/test keys differ.

| File | Contents | Runtime |
| --- | --- | --- |
| `.rise-infra/<environment>/server.env` | Restricted BFF login, separate `PUSH_DATA_ENCRYPTION_KEY`, VAPID public key and existing session config | BFF |
| `.rise-infra/<environment>/push.env` | Restricted worker login, push data key, VAPID public/private pair and subject | Isolated sender |
| `.rise-infra/<environment>/lifecycle.env` | Existing restricted lifecycle login and provider administration secret | Account purge only |

Files stay mode 0600 inside private directories. Never print them, source their contents into screenshots, upload status/log files or place private keys in `VITE_*`. The BFF rejects a VAPID signing key or provider administrative credentials. The sender needs no provider administration key, session encryption key or private journey access. The local VAPID subject is the intended HTTPS product URL; it does not configure that domain.

There is no online multi-key rotation. Preserve the versioned data key separately from database backups. A lost data key cannot recover encrypted subscriptions. Rotate/re-consent through an explicit reviewed operation; never clear personal storage or regenerate an existing key to repair it. A changed VAPID public key requires explicit browser re-subscription.

## Server contract and storage

- `GET /api/v1/push` returns public VAPID configuration, current installation metadata and its latest test result. It creates no profile, subscription or test. An HttpOnly, SameSite cookie establishes an opaque installation handle; the database stores an owner-inclusive hash. The cookie is separate from the auth cookie and carries no account records.
- `POST /api/v1/push` validates a browser subscription and explicit privacy/language choices. It requires Origin, JSON, CSRF, a verified session, expected account and installation version. An identical retry returns the same version; a competing edit requires review. Another account can subsequently opt in on this browser without taking ownership of the former account's row. New installations are limited to 20 active/recently created entries per account over a rolling day; a retired older row does not permanently consume a slot.
- `POST /api/v1/push/disable` cancels queued tests and erases endpoint ciphertext/hash atomically. It is idempotent when already off. It cannot change another installation.
- `POST /api/v1/push/test` accepts a stable request UUID and current version, one test per minute and five per account per rolling day. Replaying the same request does not send another test. The request expires after two minutes. It contains no personal journey data.

`rise.push_subscriptions` and `rise.push_tests` use forced owner/current-session RLS and Auth-root cascade foreign keys. Direct `anon`/`authenticated` access is denied. The BFF obtains actor and provider session from the verified server session, never submitted identity claims. Owner locks serialize setup, test, disable, logout and account deletion against the final sender check. These changes do not advance personal sync revisions or modify journey records.

Endpoint/key JSON is AES-256-GCM encrypted with a dedicated 32-byte key. Associated data binds environment installation, owner and device ID. A keyed endpoint digest enforces uniqueness without plaintext capability URLs. Neither endpoint nor encryption keys return in API metadata, backups, account exports, sync records, logs or public caches.

The restricted sender can read the bounded subscription projection and test rows, finish/delete old test receipts and retire subscriptions. Its column grants/RLS deny enabling, transfer, privacy edits, endpoint replacement, test expiry changes and private-profile/session-token reads. It evaluates the existing narrow session predicate using identity from the stored subscription. Expiry, provider-session revocation, ban or deletion prevents dispatch and destroys endpoint material when the sender observes it.

The explicit-test path serializes each owner, rechecks consent/session/version/expiry and generates RFC Web Push encryption/VAPID with pinned `web-push`. HTTP 2xx means provider acceptance; 404/410 retires the endpoint. Other failures are recorded without endless retries. A failed domain action rolls back to a savepoint before its authorization recheck, so concurrent deletion wins over a stale-data conflict without committing partial work. A crash after provider submission can still duplicate a delivery; stable test tags limit duplicate presentation. The separate PUSH-02 reminder path now supplies scheduled-job leases/retries; both run through the local sender. Test receipts older than one day are pruned by the running sender.

### Additive migrations

The original 15 migrations are unchanged. Apply all four PUSH-01 migrations in order:

1. `20261022182349_device_push_subscriptions.sql` — schema, owner RLS, cancellation/purge integration.
2. `20261022183509_push_sender_session_authorization.sql` — grant the existing boolean predicate through its actual narrow owner.
3. `20261022183957_push_sender_least_privilege.sql` — restrict sender mutation to retirement/test results.
4. `20261022184137_push_sender_retirement_readback.sql` — allow UPDATE's disabled-row readback while narrowing visible columns.

Do not cherry-pick the initial migration or edit an applied migration. The staged permission fixes were found with real restricted-role tests, not bypassed with administrative request credentials.

## Endpoint and transport boundary

Supported endpoint hosts/path families are deliberately limited to:

- `fcm.googleapis.com/fcm/send/<token>`
- `updates.push.services.mozilla.com/wpush/v2/<token>`
- `web.push.apple.com/<token>`

Unknown providers fail closed and require a reviewed allowlist update. Validation requires canonical HTTPS/443 URLs, no credentials, query, fragment or alternate host, bounded lengths, a valid uncompressed P-256 key and a canonical 16-byte auth secret. Browser API support alone does not prove that a new provider URL is supported.

Address classification uses pinned `ipaddr.js` 2.5.0 plus an explicit IPv6 global-unicast boundary. Local-use translation, documentation, dummy, mapped and scoped addresses fail closed. The [IANA special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/) is the maintenance reference.

Immediately before connection, resolve all addresses and reject any non-public/reserved/private/metadata/mapped answer. Pin TLS lookup to a checked address while retaining the provider hostname for SNI and certificate verification. Native HTTPS follows no redirect, uses no proxy/pooled socket, bounds DNS to three seconds, connection/request lifetime to five seconds and response consumption to 16 KiB. Provider response bodies and authorization headers are never logged. DNS rebinding cannot replace the checked destination through a second lookup.

## Device consent and worker boundary

`rise-push-device`, IndexedDB version one, stores one revisioned `control/current` record: owner/device IDs, accepted server generation, enable/privacy/language flags, pending cancellation and an optional last displayed test ID/instant. It contains no endpoints, browser encryption keys, auth credentials or journey records. Guest/account database versions and cache formats are unchanged.

Page operations use an installation lock where available and strict revision CAS. A delayed enable cannot overwrite a later disable/logout. A missing/changed browser subscription or generation requires explicit review. Rotation/`pushsubscriptionchange` disables local consent and marks cancellation pending; it never uploads a replacement silently.

The existing root `/notifications-sw.js` keeps its public PWA cache/update protocol. The test branch accepts only a bounded envelope matching local owner, installation, subscription version, consent and expiry. The later reminder branch also requires current server receive authorization; a cached plan generation is not authority. It ignores arbitrary titles, bodies, URLs and domain commands. A valid test uses localized generic copy. A stale/invalid message uses generic, silent settings copy to preserve the user-visible push contract without disclosing account activity. Clicking opens/focuses the app root; it cannot record prayer, acknowledge Fajr, award XP or follow a supplied URL.

## Logout, cleanup and deletion

Logout retires subscriptions associated with that verified browser session before revoking it. Other devices' separately authorized subscriptions remain intact. The page observes identity changes even while showing the guest journey, dismisses stale private controls and clears only that owner's local consent/subscription/test notifications. Permission itself remains a browser setting; logging in again is not permission to subscribe again.

Subscription observation and cleanup enter the platform push service only while notification permission is granted. RISE creates only permission-bound, user-visible subscriptions; the [Push API permission contract](https://w3c.github.io/push-api/#security-and-privacy-considerations) requires the browser to deactivate affected subscriptions when permission is revoked. This avoids a stalled `getSubscription()` lookup in the pinned desktop WebKit test port for an account that has only cancellation metadata and never enabled push. Granted subscriptions still receive explicit unsubscribe, and server retirement, notification closing, local cleanup and retry behavior remain required. This is a local browser regression fix, not a physical Safari/device delivery claim.

Explicit account device cleanup also disables its subscription before removing the cache. Account deletion cancels tests and erases endpoint material before inserting the suppression ledger. Auth-root cascades purge both push tables. Restored old subscriptions cannot pass the existing deletion-ledger/session predicate. Guest alert deduplication and the public PWA cache are not cleared.

`deletion_integrations_ready()` now accepts this implemented subscription/test boundary. [GROUP-01 membership](GROUP-MEMBERSHIP.md) now adds locked ownership resolution and identity scrubbing. GROUP-02/03 now integrate retained family history and authored squad erasure. [GROUP-04](GROUP-NOTIFICATIONS.md) supplies recipient/source notification-job erasure before suppression and during terminal replay; readiness fails closed if that installed cleanup hook is missing. PUSH-02/03 now integrate the existing `push_plans`, `push_jobs` and receipt tables with transactional cancellation and Auth-root ownership/cascade hooks. Do not remove the deletion ledger or relax authorization to repair a purge.

## Verification and remaining gates

Run `npm run check` before browser suites; 4181 is briefly used by a tooling test. With the isolated stacks up, run database and 4191 suites sequentially:

```sh
npm run test:infra
npm run test:backend
npm run test:auth
npm run test:sync
npm run test:push
npm run test:browser
npm run test:production
npm run test:pwa
npm run test:visual
```

The [dated evidence](evidence/push-subscriptions-2026-10-22/README.md) records exact final commands/results, versions, unchanged goldens, failure cases, migration/grant metadata and secret scans. Real credential flows have no traces, video or automatic screenshots. Layout captures use unusable synthetic auth metadata.

The local tests combine real Postgres/Auth/BFF/IDB/worker registration with a synthetic browser permission/subscription adapter. Cryptographic tests decrypt a real encrypted Web Push payload and verify VAPID signatures for generated recipients. Worker-handler tests exercise the actual worker source. These are not evidence of a real push provider or physical OS displaying a notification. No notification or email was sent to a real person during development.

Before release, verify the allowlist and sender with actual HTTPS staging, iPhone Home Screen and Android installations; record denied/revoked permission, background/locked/offline behavior and provider/device outcomes. Hosted secret management, sender supervision/monitoring, load/retention acceptance and physical-device delivery claims remain gated. Keep cloud provisioning pending until separately authorized.

## Recovery and rollback

A failed save or server acknowledgment must not be repaired by clearing a profile. Keep the disabled/pending local marker, reconnect and use Refresh/Turn off before explicitly enabling again. Missing permission requires a browser/device setting change; a missing browser subscription requires a new user gesture. An endpoint rejected as unsupported needs a reviewed allowlist change, not a relaxed SSRF rule.

For an application rollback, stop the sender first and retire active installations while the cancellation-aware BFF remains available. Preserve all subscription/sender migrations, forced RLS, account suppression ledger and cascade links. Do not run a BFF without these cancellation hooks alongside an enabled sender. Retain `rise-push-device` version-one/revision compatibility, the guest repository and account cache formats; never delete databases or regenerate an existing encryption key to force an older client to open. Resume only with a compatible sender/client and explicit per-installation consent. No deployment or rollback was performed for this local task.
