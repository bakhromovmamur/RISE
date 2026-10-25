# PUSH-01 — Local permission, subscriptions and privacy evidence

**Task:** PUSH-01 · **Requirements:** PRD-11, SEC-04 · **Work:** 22–23 October 2026, Asia/Tashkent · **Status:** REVIEW for hosted/physical-device acceptance.

The existing delivery sheet now supports an explicit account-bound browser subscription, installation/permission recovery, generic privacy defaults, explicit detail consent, revocation and bounded background tests. Stored capabilities are encrypted. The separate signer validates/pins destinations and cannot enable or transfer consent. Logout, device cleanup and deletion integrate cancellation and purge. No prayer/Fajr/habit schedule is active, and no domain action is performed by a push or click. Cloud provisioning remains pending.

See [the implementation/setup/recovery guide](../../PUSH-SUBSCRIPTIONS.md), [task register](../../../TASKS.md), [architecture](../../../ARCHITECTURE.md) and [security boundary](../../../SECURITY.md).

## Exact verification

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run check` | 193 passed; lint, app/tools/server types, production and review builds passed | [log](check.log) |
| `npm run test:infra` | 70 real local Auth/Postgres cases passed | [log](database.log), [schema/grants metadata](database-summary.json) |
| `npm run test:push` | 24 passed: 15 real-session flows with synthetic browser permission/provider APIs, 9 visual-only layouts | [log](push-browser.log), [report](push-browser.json) |
| `npm run test:sync` plus targeted recovery confirmation | Full run: 68 passed, one 5-second recovery-display wait failed; corrected test: 3/3 engines passed, two overlaps. All 69 distinct cases accepted. | [full log](sync-browser.log), [unchanged full report](sync-browser.json), [focused report](sync-recovery-final.json), [accepted-case manifest](sync-accepted-cases.json) |
| `npm run test:auth` | 21 passed | [log](auth-browser.log) |
| `npm run test:backend` | 9 passed | [log](backend-browser.log) |
| `npm run test:browser` | 378 existing journeys passed | [log](journeys.log) |
| `npm run test:production` | 39 passed | [log](production.log) |
| `npm run test:pwa` | 42 passed with the real worker | [log](pwa.log) |
| `npm run test:visual` | 48 configurations, 720 unchanged comparisons; no references regenerated | [log](visual.log), [report](visual.json) |
| Supabase advisors, local/test | No issues at warn/fail-on-warn | [local](advisors-local.log), [test](advisors-test.log) |
| Sender one-shot/watch, local/test | Both fixed installations started and stopped gracefully; no live test requests or external push | [runtime evidence](runtime-smoke.json) |

Environment: macOS Darwin 25.6.0 arm64, Node 24.16.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. WebKit automation is not iPhone certification. [Machine-readable acceptance](verification.json).

## Important failure and race outcomes

- Denied permission cannot re-prompt; an explicit browser setting/refresh/gesture can recover. Setup never subscribes on sign-in, reload or restore.
- Unknown endpoints, private/reserved/translated/mapped DNS destinations, invalid keys/expiry/fields and stale versions fail closed. Address classification uses `ipaddr.js` 2.5.0 with an explicit IPv6 global-unicast restriction, checked against the [IANA registry](https://www.iana.org/assignments/iana-ipv6-special-registry/).
- Real generated Web Push encryption decrypts for the synthetic recipient; VAPID signatures/claims verify. No real push-service request was made in these tests.
- Independent installations need separate consent. Other-owner and direct unauthorized access fail. The signer cannot read journey/session tokens or change consent/privacy/owner/expiry.
- Stable test UUID retries do not create another request; expiry, rate limit, disable, permanent failure and concurrent senders are covered. Already submitted messages cannot be recalled.
- Offline disable stops the browser first and retains pending server cancellation. Failed consent storage cannot report success or leave the browser subscribed.
- Deletion suppresses dispatch before purge and cascades both tables. Replayed old subscription/session ciphertext cannot bypass the deletion ledger.
- Failed actor work rolls back to a savepoint before authorization recheck; deletion wins over a misleading domain conflict and partial changes do not commit.

[Corrections and verification history](test-iterations.json) records the initial permission/readback, fixture, navigation-readiness and layout failures. A focused three-engine recovery rerun is preserved in [this report](sync-recovery-focused.json); the final acceptance combines its three passing engine cases with the 68 passing full-run cases (two overlaps). This is explicitly not a claim that a later full run was all green. No profile/database reset, policy weakening or golden regeneration was used to pass checks.

## Design and saved-data preservation

[Hash comparison](preservation.json) confirms unchanged 7 stylesheets, 2 design files, 11 non-JavaScript public assets, 14 domain files, 15 previously applied migrations, 4 guest-storage modules, the Karpathy skill and all 720 golden images. The root worker intentionally changed. Account/guest repository and cache versions remain compatible; push consent lives in its separate version-one store. The 4173 profile was not read, seeded or cleared.

There are 36 new safe synthetic screenshots: three languages, light/dark, privacy/pending scenes, representative phone/large-text/desktop captures. The browser layout matrix covers 324 states at 320/375/393/430 px and a desktop viewport, including 200% text. [Capture manifest](screenshots.json). A general text-input rule initially stretched the checkbox; the final surface reuses the existing settings switch and verifies the label bounds. No stylesheet was changed.

Inspected confirmations:

- [English, 393 px](screens/push-privacy-en-light-393-100.png)
- [Russian dark, 320 px at 200%](screens/push-privacy-ru-dark-320-200.png)
- [Uzbek pending cancellation, desktop](screens/push-pending-uz-light-1440-100.png)

[Source hashes](source-hashes.json), [build hashes](build-hashes.json), [change inventory](changes.json), [local links/anchors](links.json) and [secret scan](secret-scan.json) accompany this record. Authentication flows retain no usable credential traces/video/screenshots. Actual endpoints, keys, tokens and mail contents are excluded.

## Recovery and remaining acceptance

All four additive PUSH migrations remain applied, with owner/current-session RLS and narrow sender projection/retirement grants. Keep the encryption key separate from database backups. Never delete the account suppression ledger, reset storage, regenerate an existing key or leave an incompatible BFF alongside an enabled sender to repair a failure. The guide documents pending cancellation, key/re-subscription recovery and rollback order.

Local/test stacks and sender processes were stopped after verification, preserving their volumes/credentials and unrelated containers. Port 4173 was free at cleanup, so the static production preview was started on loopback for continued review. Its profile was not opened, inspected or seeded. [Cleanup evidence](cleanup.json).

Real-provider acceptance/display, HTTPS staging, physical iPhone Home Screen/Android behavior and sound/wake-up remain unverified. PUSH-02–04 must add scheduling, cancellation/deduplication and habit/readiness integration; PUSH-05 owns device evidence. Sender supervision, hosted key/backup operations and the existing WebKit/Firefox port-4190 entry limitation remain open. The existing production bundle size warning remains QUALITY-03 work. No production release, deployment, cloud provisioning or real-person notification/email is claimed.
