# Exact squad snapshot acceptance

24 October 2026 · GROUP-03 / PRD-15, with PRD-04/17/18 regression coverage. Retained local/test BFF, Auth, Postgres and IndexedDB on macOS. Cloud provisioning remains pending by the user's direction. Accounts, content and subscriptions used for tests are synthetic; no external message, invitation or push was sent. The saved preview/profile on 4173 was not accessed.

**GROUP-03 is locally verified and recorded as REVIEW for hosted acceptance.** Group notification integration follows in GROUP-04, then integrated lifecycle acceptance in GROUP-05. The wider goal remains active.

## Behavior and boundary

Account-selected squad controls now use the real local/test backend for exact preview, publication, author editing, encouragement, withdrawal and owner abuse removal. New sharing choices start off. The server builds only explicitly selected aggregates or milestone titles plus the authored note, using committed personal records and the saved account timezone. Reads never initialize an account or import a guest journey. Sharing awards no XP.

The owner-private preview expires after ten database-clock minutes. Publication submits only its opaque ID and hash, then stores the reviewed payload unchanged in the same transaction as the immutable receipt. Later private records never recompute a preview or publication. Authors edit through another explicit preview; members control only their own encouragement; owners can remove abusive content. Withdrawal removes payload/reactions/previews and retains an opaque ID barrier against stale resurrection.

Current membership is checked on reads, commands and replay. Forced RLS, narrow grants, actor-before-group locks and stable composite member references protect the boundary. Pre-suppression cleanup erases authored squad content, including former memberships; terminal backup replay repeats that erasure before provider deletion. Failed receipt/suppression transactions roll back. Notification jobs remain a fail-closed lifecycle gate until GROUP-04.

Memory-only reads fence account changes, revisions, pagination and late responses. Private durable drafts retain authored text and choices. Pending publication stores IDs/hash, not shared text or source records. Lost replies replay the exact operation; matching acknowledgment cannot clear newer draft text. Conflicts, expired previews and delayed responses require explicit review. Reopening a draft does not restore a publishable in-memory preview. The original review simulations, guest data and portable-file boundaries remain.

See [the complete contract and rollback rules](../../SQUAD-SNAPSHOTS.md). The [verification manifest](verification.json) records changed/new source, builds, logs and browser reports; the [preservation audit](preservation.json) records baseline hashes and unchanged protected files.

## Changes and checks

New modules own the strict squad contract, pure snapshot calculation, authorized server preview/feed, memory feed reader, durable draft matching, localized copy and real screens. The existing group receipt boundary, routes, provider, workspace source readiness and group entry connect them. Two additive migrations were created with the pinned CLI and applied to both retained local/test installations: `20261023184555_exact_squad_snapshots.sql` and `20261023185202_squad_group_cascade.sql`. Earlier migrations were not edited. No CSS, artwork, dependency, guest/account cache format or visual reference changed.

Node 24.16.0, npm 11.13.0, Playwright 1.64.1, Supabase CLI 2.121.0; Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. Real credential flows disable traces/video/automatic screenshots. One held-response race uses a real BFF response with service workers blocked so the response can be released deterministically. Layout captures use unusable metadata and blocked service workers. Database/BFF suites run sequentially on 4191.

| Command | Observed result |
| --- | --- |
| `npm run check` | Final 256 unit/tooling tests, pinned toolchain, lint, app/test/server types and production/review builds pass |
| `npm run test:infra` | Final 139 real database/BFF integration tests pass, including 14 squad cases |
| `npm run test:groups` | Final 81 pass across three engines; zero failed, skipped or flaky |
| `npm run test:sync` | 69 account sync/recovery/lifecycle cases pass across three engines; zero failed, skipped or flaky |
| `npm run test:visual` | 48 scenarios / 720 frozen-image comparisons pass; no reference regenerated |
| `npm run test:browser -- tests/journey.browser.spec.ts tests/navigation.browser.spec.ts` | 27 pass across three engines |
| `npm run test:production -- tests/production/entry.production.spec.ts` | Initial 23 pass; one Firefox initial device-save wait times out |
| `npm run test:production -- tests/production/entry.production.spec.ts --project=firefox --grep 'migration summary'` | The unchanged-build focused case passes; 24 unique production-entry cases verified across the two runs |
| `npm run infra:up -- local` and `npm run infra:up -- test` | Both retained installations accept both additive migrations |
| `npx supabase db advisors --local --workdir .rise-infra/local --type all --level warn --fail-on warn` and equivalent `test` workdir | Both report no issues |
| `npm run check:docs` | Current document links/anchors, 38 task metadata/dependencies and 20 requirement mappings pass; exact counts in the log |

Database evidence covers exact consent, rejected private-field injection, source revision, no initialization, CSRF, unrelated/cross-group denial, immutable payloads after private changes, no XP, author/owner/reactor limits, expiry/hash mismatches, exact retries, receipt rollback, withdrawal barriers, archive rules, bounded pagination and independent author lookup. It also covers quotas/Unicode/expired cleanup, publication versus account suppression, former-member erasure, failed suppression rollback, populated terminal backup replay, provider purge and complete group cascade.

The final group suite contains 51 real account/group cases and 30 safe metadata cases. The new nine-scene layout matrix covers three languages, two appearances, 320/375/393/430/1440 px, 100/200% text and three engines: 1,620 new states, 4,680 total group states. The [visual manifest](visual-manifest.json) records 54 new Chromium captures and fixture provenance. Inspected examples include [English feed](screens/squad-feed-en-light-393-100.png), [Russian enlarged preview](screens/squad-preview-ru-dark-320-200.png) and [Uzbek editing](screens/squad-edit-uz-light-393-100.png). Existing tokens, controls, visible focus and natural text reflow remain; no layout/CSS adjustment was needed.

## Failures retained and resolved

The initial database run exposed a real cascade-order defect: deleting a group could check a composite member reference before dependent posts/reactions were removed. The second additive migration defers only those references until transaction end, preserving final integrity. A separate historical backup fixture converted a Postgres civil date through JavaScript UTC serialization; it now reads row JSON so civil dates remain exact. The focused backend rerun passed, followed by the final complete 139-test suite.

Initial browser failures were test setup/selectors: assertions included the private Today background instead of the open sharing dialog; multiple Retry/confirmation/expired messages required dialog scoping; textarea lookup needed its semantic textbox role; and safe metadata fixtures needed a completed dated priorities setup. These were corrected without weakening product assertions. A delayed real preview response now has explicit coverage proving that it cannot replace a newer reviewed draft.

The first full code check timed out in an existing two-second push-renewal wait. Its isolated 13-case file passed, then two full 256-test checks passed. The first complete group run passed 76 cases; the final five Firefox scenarios could not start because all three engines exhausted the same synthetic loopback sign-in quota. The browser fixture now resets only the existing three test-only HMAC quota subjects per sequential worker after verifying the isolated installation, and rejects parallel backend workers. Production rate limits, runtime endpoints, accounts and guest data are unchanged. Subsequent tool/test types and lint pass; the complete 81-case run then passes. The initial production-entry Firefox failure remained at “Saving on this device” during concurrent browser work; the unchanged-build focused rerun passed in 4.1 seconds. These initial failures are preserved, not reported as clean initial runs. The existing bundle-size advisory remains assigned to quality work.

[Final code/build](logs/check.log), [database integration](logs/infra.log), [group acceptance](logs/groups.log), [account regression](logs/sync.log), [frozen visual comparison](logs/visual.log), [navigation](logs/navigation.log), [production initial](logs/production-initial.log), [production recheck](logs/production-recheck.log), [database initial](logs/backend-initial.log), [cascade confirmation](logs/backend-cascade-fixed.log), [initial code check](logs/check-initial.log), [renewal recheck](logs/renewal-recheck.log), [initial browser](logs/browser-initial.log), [shared quota failure](logs/groups-quota-initial.log), [final test types](logs/types-quota.log), [final lint](logs/lint-quota.log), [layout confirmation](logs/layout-confirmed.log) and [document validation](logs/docs.log).

## Limits and recovery

This is local acceptance, not a hosted release or physical-device delivery certification. Cloud provisioning, hosted supervision/load/retention, actual HTTPS mobile acceptance and operating-owner release gates remain pending. GROUP-04 must integrate optional group notifications, bounded invitation metadata and notification-job lifecycle hooks; GROUP-05 verifies the complete shared deletion/restore boundary.

Roll back exposure by disabling squad routes/controls while retaining data, receipts, removed-ID barriers, compatible lifecycle cleanup and private draft recovery. Never edit applied migrations, remove the suppression ledger or deploy pre-squad cleanup against populated data. An older sender may omit preview pruning, but database expiry still prevents publication. No saved user journey, original guest source, other owner's data, public PWA cache or unrelated infrastructure was reset.
