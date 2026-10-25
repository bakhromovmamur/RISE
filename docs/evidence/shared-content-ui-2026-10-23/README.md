# Shared family controls and account-cache coordination

23 October 2026 · GROUP-02 / PRD-06 / PRD-13, with PRD-04/17 and SYNC-01/02 regression coverage. Local/test BFF, Auth, Postgres and IndexedDB on macOS. Cloud provisioning remains pending by the user's instruction. All accounts, family content and invitations are synthetic; no external invitation, email or push was sent. The saved preview/profile on 4173 was not accessed.

**GROUP-02 is locally verified and recorded as REVIEW for hosted acceptance.** The wider goal remains active. This report records the browser increment; the [backend](../shared-content-backend-2026-10-23/README.md) and [private-priority/reader](../shared-priorities-2026-10-23/README.md) reports retain their separate earlier results.

## Behavior

Account-selected family screens now create, edit, assign, schedule, complete, correct, archive and restore tasks through the real membership/content boundary. Group-timezone occurrence dates remain separate from private priority dates. Completed dates retain their captured title, notes, assignment and timezone after plan changes. Undo affects only the selected occurrence. Task archive retains correction access; group archive is read-only.

Shared lists support creation, rename, item text/quantity edits, ordering, checks, removal, archive and restore. Coherent 50-row pages use the selected owner and group revision. A changed revision invalidates affected collections; failures and delayed occurrence reads cannot show an available unchecked action. Shared content stays in memory and outside the public PWA cache.

Task detail and the existing ordered priority picker save opaque group/task/date selections through personal commands. A fourth candidate requires an explicit replacement. Unavailable selections remain removable without deleting unrelated choices. Pinning, task/list changes and corrections award no habit XP.

Forms retain stable entity IDs and reviewed revisions in account-scoped durable drafts, or memory in session-only mode. One immutable shared operation is saved before sending. Lost replies retry the exact operation through reload. Acknowledgment clears only matching drafts, preserving newer text and unrelated work. Conflicts require explicit stopping/review before a new operation against the current version. Scope changes and membership loss hide private forms and fence late results. Removed members cannot commit previously queued shared edits.

English, Russian and Uzbek Latin use existing components, typography, colors and artwork. Enlarged account priority headers now grow around their text. Explicit opener focus preserves WebKit focus restoration when closing a new task form. The original review simulations and frozen visual references remain unchanged.

## Race found and fixed

Rapid private-priority changes followed by shared completion exposed a false account-cache conflict in Firefox. Three initial stress runs all reproduced it. A deterministic `AccountJourney` test then reproduced both a draft arriving during receipt commit and a draft arriving during remote snapshot installation. A real intervening writer already failed safely.

The account session now serializes its own local saves, receipt acknowledgments and snapshot installation. Device-only edits retain newly installed personal records; personal actions retain their original operation IDs, conditions and captured context. New pending actions resume after reconciliation. Offline queues do not repeatedly restart the sender. The IndexedDB/memory store's strict owner/version/generation checks are unchanged; a genuine competing write still preserves unsaved intent for explicit recovery.

Six focused tests cover both commit races, real stale-write rejection, a personal action arriving during pull, ordinary local sample setup and offline queue behavior. The first two fail before the fix; all six are included in the passing 247-test code check. No cache format, dependency, migration or server authorization changed in this increment.

An intermediate post-fix browser stress run passed two cases and timed out on one shared-content read while the UI remained loading after an acknowledged save; it did not reproduce the cache error. The next three instrumented runs passed. The following complete 51-case group run passed in all three engines without reproducing that timeout. Temporary timing diagnostics were then removed; the earlier timeout is not represented as a passing check.

A later-page loading regression was also reproduced: after refreshing an open task whose row was on page two, the UI showed “group unavailable” alongside the loading message. Absence is now declared only after the whole required collection finishes successfully. Task/list controls and item ordering use the same complete-collection readiness check. The new browser case holds the second page, verifies loading without an unavailable message, releases it, and separately verifies that a genuinely missing row is reported after the completed read.

## Changes and verification

New UI modules: `src/groups/SharedScreens.tsx`, `sharedHooks.ts`, `sharedDrafts.ts` and `sharedText.ts`. Existing group entry points, Today/priorities, screen context, draft cleanup, memory reader subscriptions and scoped styles connect those modules. `src/sync/session.ts` owns cache coordination. New browser scenarios cover shared content, recovery, priority replacement, cache overlap and layout; the existing group-session tests now cover matching draft cleanup. The [verification manifest](verification.json) records exact files/build/log hashes and browser report counts. The [preservation audit](preservation.json) compares all 2,272 baseline files: none are missing, and all 1,693 protected design/asset/migration/server/dependency/historical-evidence files remain unchanged.

Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. Real account scenarios use the actual restricted BFF/Auth/database and service worker on isolated 4191, with traces, video and automatic credential screenshots disabled. Layout captures use unusable account metadata with blocked service workers. Database/BFF suites run sequentially.

| Command | Observed result |
| --- | --- |
| `npm run check` | 247 unit/tooling tests, pinned toolchain, lint, app/test/server types and production/review builds pass |
| `node --import tsx --test tests/sync-session-race.test.ts` | Controlled red reproduction: two failed, one passed; the final six cases pass within the complete code check |
| `npm run test:groups -- tests/groups/cache-race.groups.spec.ts --project=firefox --repeat-each=3` | Initial cache reproduction: 3 failed; final instrumented repeat: 3 passed |
| `npm run test:groups` | Final run: 54 passed across three engines; zero failed, skipped or flaky |
| `npm run test:sync` | 69 passed across three engines; zero failed, skipped or flaky |
| `npm run test:groups -- tests/groups/content-pagination.groups.spec.ts` | Three engines pass the held-page and genuine-absence regression |
| `npm run check:docs` | 31 current documents, 449 links, 58 anchors, 38 tasks and 20 requirements; no failures |

Earlier checks in this browser increment passed: `npm run test:visual` — 48 scenarios / 720 frozen-image comparisons; `npm run test:production -- tests/production/entry.production.spec.ts` — 24; `npm run test:browser -- tests/journey.browser.spec.ts tests/navigation.browser.spec.ts` — 27. These precede the final account cache, task-opener focus and later-page readiness adjustments. They are retained as scoped earlier evidence, not represented as final-build reruns. No golden image was regenerated. The existing Vite bundle-size advisory remains assigned to quality work.

The shared layout matrix covers nine scenes × three languages × two appearances × five widths (320/375/393/430/1440) × two text sizes (100/200%) × three engines: 1,620 states. Together with the existing membership matrix this is 3,060 states. Checks inspect header bounds, horizontal reflow, reachable actions, nested focus, delayed-read state and pagination. The final full run has 33 real account/group cases and 21 safe metadata cases, including the three focused pagination cases. The [visual manifest](visual-manifest.json) records 55 Chromium captures with fixture/build provenance. Transient toast messages are dismissed before matrix capture. [Before](screens/before-priorities-en-light-320-200.png) and [after](screens/shared-priorities-en-light-320-200.png) use equivalent priority data, theme, width and text size. Inspected examples also include [family](screens/shared-family-en-light-393-100.png), [Russian task creation](screens/shared-task-create-ru-dark-320-200.png) and [Uzbek list editing](screens/shared-list-edit-uz-dark-320-200.png).

[Final code/build check](logs/check.log), [final group acceptance](logs/groups.log), [account regression](logs/sync.log), [pagination reproduction](logs/pagination-before.log), [pagination confirmation](logs/pagination-after.log), [cache-race reproduction](logs/cache-race-before.log), [controlled unit reproduction](logs/cache-race-unit-before.log), [cache stress confirmation](logs/cache-race-after.log), [earlier refresh timeout](logs/intermediate-read-timeout.log), [earlier complete group run](logs/groups-before-pagination.log), [earlier visual comparison](logs/visual-earlier.log), [earlier production entry](logs/production-earlier.log), [earlier navigation](logs/navigation-earlier.log) and [document validation](logs/docs.log).

## Limits and rollback

GROUP-03 exact squad snapshots, GROUP-04 group notifications/limits and GROUP-05 integrated lifecycle acceptance follow this task. Hosted operation, physical mobile/HTTPS delivery, production load/security/retention and release approval remain open. A browser-emulated engine or accepted notification job is not physical delivery evidence.

Disable new shared controls/routes to roll back exposure while retaining the compatible account reader, pending drafts/outbox, receipts, removal barriers, migration history and suppression ledger. Do not drop task-priority columns or deploy a pre-extension writer against populated accounts. Preserve guest sources and account recovery before intentional cleanup. The cache fix changes coordination, not stored formats; it never retries foreign-version writes by changing their expected version.
