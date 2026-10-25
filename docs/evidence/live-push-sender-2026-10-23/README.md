# Live local background sender — verification

**Date:** 23 October 2026. **Scope:** PUSH-02/PUSH-04; PRD-05, PRD-11, PRD-19 and SEC-04. NFR-05 load acceptance is still open. Cloud provisioning remains pending.

## Result

The existing durable queue now reaches the isolated VAPID signer and encrypted Web Push transport. Sender-process heartbeats govern current readiness. A receiving service worker checks the exact event against its verified session, installation cookie, current plan and current subscription before claiming the shared display ledger. This permits closed secondary installations to receive a renewed generation without trusting stale local generation metadata.

Cancellation after provider acceptance suppresses presentation while retaining the accepted status, acceptance timestamp and attempt count. The queue dispatcher also refuses presentation-canceled jobs. Existing primary consent, quiet hours, dated acknowledgment, expiry, retries, endpoint retirement, logout and deletion remain in force. No notification records a prayer, wake acknowledgment, habit completion or XP.

The readiness coordinator coalesces changes arriving during an active request, then reads current source/consent again. A regression covers sync changes that previously could wait for the next one-minute timer. English, Russian and Uzbek Latin copy now distinguishes a saved plan from a running notification service. Layouts, styles, navigation, guest/account/cache formats and recovery sources remain unchanged.

## Changed surfaces

- `server/push/jobs.ts`, `worker.ts`, `runtime.ts`, `readiness.ts`, `receive.ts`, `routes.ts`, `plans.ts`, `cancellation.ts` and `scripts/infra/push.ts`: live adapter, bounded process loop, readiness, authorization and acceptance-preserving cancellation.
- `supabase/migrations/20261023095914_local_push_sender_readiness.sql`: additive private heartbeat table with forced RLS/narrow role grants, plus `push_jobs.presentation_canceled`. No profile or table replacement. Both local/test stacks applied it.
- `public/notifications-sw.js`: bounded same-origin, credentialed, no-store receive authorization; local consent/expiry recheck and existing shared ledger/fallback/click behavior.
- `src/push/renewal.ts`, `src/push/text.ts`, `src/habitText.ts`: coalesced refresh and truthful localized support copy. No CSS, tokens, assets or screen composition changed.
- Infrastructure, worker/browser and renewal tests; root product/task/security/architecture instructions and current push guides. Exact hashes for **33 source/document files** are in [the manifest](source-hashes.json).

## Commands and evidence

Environment: macOS **26.6.2**, arm64, Node **24.16.0**, npm **11.13.0**, Playwright **1.64.1**. Desktop test engines: Chromium **156.0.8078.4**, WebKit **27.2**, Firefox **157.0**. These are not physical mobile-device certifications.

| Command | Observed result |
| --- | --- |
| `npm run infra:up -- local`; `npm run infra:up -- test` | Both installation identities, restricted BFF roles, Auth health and loopback bindings verified; additive migration applied without resets. |
| `npm run check` | **216 passed**, lint and app/test/server types passed; production and review builds passed. Existing large-chunk advisory remains. [Log](check.log). |
| `npm run lint && npm run typecheck` | Passed again after the final backend audit-preservation change and standalone receiver-fixture isolation. |
| `npm run test:infra` | **90 passed** on final backend source. Includes encrypted scheduled fan-out, receiver authorization, accepted-message cancellation/audit, heartbeat freshness/concurrent processes, graceful real CLI shutdown, negative grants/RLS, and existing auth/sync/lifecycle/domain regressions. [Log](infra.log). |
| `npx tsx --test tests/push-renewal.test.ts` | **13 passed**, including an update arriving while the prior request is active. The final complete check also includes this test. [Log](renewal-unit.log). |
| `npm run test:push` | **47 passed, 1 fixture-isolation failure** in the standalone WebKit ledger/worker test. The three real BFF/encryption/receiver integration scenarios and all renewed readiness scenarios passed. [Initial log](push-initial.log). |
| `npm run test:push -- cancellation` | **3 passed** after isolating synthetic consent from the real app's startup account observer; all **48 distinct push scenarios** are covered across this final run and the preceding run. No assertion, timeout or authorization check was relaxed. [Log](cancellation-final.log). |
| `npm run test:push -- layout renewal.push --project=firefox` | **7 passed** after the final support-copy correction. Subsequent full push checks also cover the coordinator change and all languages/engines. [Log](firefox-layout-retry.log). |
| `npm run test:pwa` | **42 passed** across all three engines: real root-worker offline/update lifecycle, private-cache exclusion and data preservation. [Log](pwa.log). |
| `npm run test:production -- habit-reminders` | **15 passed** across all three engines: explicit foreground consent, reload/deduplication, completion cancellation, preview independence and multilingual layout. [Log](habit-reminders.log). |
| `npm run test:visual` | **48 configurations passed; 720 unchanged reference comparisons**. No golden images regenerated. [Log](visual.log). |
| `npm run infra:stop -- local`; `npm run infra:stop -- test` | Both RISE stacks stopped; database volumes and protected credentials retained. Unrelated Docker services remained running. |

All browser suites ran on isolated test origins; the user's 4173 profile was never seeded, cleared or opened for testing. An early infrastructure run accidentally overlapped a browser run and was interrupted; it is not used as final evidence. Subsequent database/BFF suites ran sequentially. Private CLI staging directories contained 21 byte-identical noncanonical migration copies per environment; these were quarantined privately after comparison with canonical source. No migration history was repaired and no database volume was reset.

The receiver integration exercises the real queue, restricted database role, endpoint decryption, VAPID/AES128GCM encryption, BFF authorization, actual worker-handler source and real browser IndexedDB. Only the outbound provider, OS subscription and notification presentation boundaries are synthetic. The standalone handler test now uses a same-origin test-only HTML fixture so app startup cannot clear deliberately synthetic owner consent during an awaited check. Real account cleanup is separately covered by the app journeys.

## Design and privacy

Renewal layouts cover four states (staged, live, expired, failed), three languages, three engines, light/dark, 320/375/393/430 px and 100%/200% text: **576 layout combinations**. Habit settings retain their **144 combinations**. Inspected examples from mock-only sessions:

- [English, 393 px](renewal-en-light-393-100.png)
- [Russian, 320 px at 200% text](renewal-ru-dark-320-200.png)
- [Uzbek Latin, 393 px](renewal-uz-light-393-100.png)

Credential-flow traces, videos and automatic screenshots remain disabled. These screenshots contain no usable identity/code. Source/build/evidence scanning found no protected configuration values; local documentation links and source hashes were checked. No real provider push, real-person email, cloud resource or deployment was used.

## Remaining limits and recovery

PUSH-04 is in **review** for the local implementation. PUSH-02 remains **in progress** for load/latency acceptance, receipt retention and hosted supervision. PUSH-05 still requires actual HTTPS iPhone/Android background/locked/offline/sound evidence. Notification display and wake-up are never guaranteed; the existing two-minute expiry remains for local habit jobs as well.

Receiving reminders now requires an online, authenticated same-origin verification request. Timeout/offline/denial results in the existing generic silent settings notice. Already submitted pushes cannot be recalled, and a final remote-cancellation race remains after verification and before OS display. Provider acceptance is not proof of display.

Stop the sender before rollback/restore; retain additive schema, history, keys, subscriptions and user caches. Restore must replay deletion/revocation suppression before sending. Roll back sender/API/receiver changes together. The sender was deliberately stopped after verification; `push:run` is one bounded pass, while `push:watch` must be explicitly started for ongoing local delivery. See [the setup and recovery contract](../../LIVE-PUSH-SENDER.md).
