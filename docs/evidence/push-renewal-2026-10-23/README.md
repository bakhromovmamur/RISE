# PUSH-04 local renewal/readiness evidence — 23 October 2026

Scope: the requested renewal/readiness increment for PRD-11 and PRD-19. The broader PUSH-04 task remains **IN PROGRESS** because habit delivery and live dispatch integration are not implemented by this increment. Cloud provisioning remains pending. See [the implemented contract](../../PUSH-RENEWAL.md).

## Behavior and boundaries

- Explicit primary-device selection is separate from subscription permission. Background-plan consent neither requires nor changes the saved foreground/native switch; prayer/Fajr eligibility remains in the existing domain schedule.
- Renewal waits for durable saves, verified account scope, sync completion and cancellation work. Relevant changes or a twelve-hour deadline trigger renewal while the selected device is open/online. No service-worker timer or implicit permission request is added.
- Immutable pending request IDs/bodies survive reload and lost replies. Owner/source checks and control CAS prevent late responses, including rejections, from replacing a newer choice or restoring disabled delivery. Another primary requires explicit takeover.
- Current plan GET metadata is scoped to the verified actor and receiving installation/version. New subscriptions have no backfilled coverage; old versions do not count. Receipt replay alone cannot establish readiness.
- Existing readiness composition now shows current queued coverage, dated Fajr wake/backup, quiet-hour suppression, missing/expired plans, sync/offline/clock errors and staged status in English, Russian and Uzbek Latin. Another installation's quiet override is not inherited.

The server still reports `dispatchEnabled: false`. No live worker generation is installed and no scheduled provider push was sent. The UI explicitly distinguishes a staged plan from active sending. Tests and receipts do not certify display, sound or wake-up.

Implementation changes are recorded in [source hashes](source-hashes.json): renewal coordinator/provider, existing push settings/control/client, validated plan-read contracts, owner-locked installation metadata query, workspace readiness/cancellation barrier and a read-only account revision getter. No schema migration, dependency, CSS, asset, domain reducer or service-worker source change was made.

## Verification

Local macOS arm64, Node 24.16.0, npm 11.13.0 and Playwright 1.64.1. [Browser versions](browser-versions.json): Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. All accounts/subscriptions and transport responses were synthetic. Real local/test Postgres/Auth/BFF and browser IndexedDB were used for integration; browser permissions/provider capabilities were synthetic. Visual-only account routes had no usable credentials and blocked real requests.

| Command | Actual result |
| --- | --- |
| `npm run check` | **209 tests pass**, with lint, all TypeScript checks and production/review builds. [Log](check.log). Existing large-bundle warning remains. |
| `node --import tsx --test tests/push-renewal.test.ts` | **11 focused tests pass**; also included in the full check. [Log](renewal-unit.log). |
| `npm run test:infra` | **82 tests pass**, including installation-scoped readiness, new receivers, version replacement, owner isolation and existing lifecycle/cancellation cases. [Log](infra.log). |
| `npm run test:push -- --project chromium --grep 'explicit primary\|renewal readiness'` | **4 pass**: three language layout scenarios and the real-BFF renewal/reload/offline-cancellation flow. [Log](new-chromium.log). |
| `npm run test:push` | **42 pass** across Chromium, WebKit and Firefox, including renewal/reload/offline recovery. [Log](push-browser.log). |
| `npm run test:browser -- --grep 'prayer\|Fajr\|wake\|pause'` | **162 pass** across three engines. [Log](prayer-journeys.log). |
| `npm run test:pwa` | **42 pass** with real worker lifecycle/offline/update checks. [Log](pwa.log). |
| `npm run test:production` | **39 pass**, including real entry, saved-profile preservation, travel and production review-tool exclusion. [Log](production.log). |
| `npm run test:visual` | **48 configurations / 720 unchanged comparisons**. No references regenerated. [Log](visual.log). |
| `supabase db advisors --local --workdir .rise-infra/{local,test} --level warn --fail-on warn` | No issues on either installation. [Local](advisors-local.log), [test](advisors-test.log). |
| `npm run lint` / `npm run typecheck` | Pass again after the visual fixture corrections. [Lint](lint.log), [types](types.log). |

The new layout matrix covers **432 combinations** of staged, expired and error states in each language at 320/375/393/430 px, both themes and 100%/200% text. Existing subscription/cancellation layout coverage also remains in the push suite. English and Russian screenshot samples were inspected: [English 393/light](renewal-en-light-393-100.png), [Russian 320/dark/200%](renewal-ru-dark-320-200.png), [Uzbek 393/light](renewal-uz-light-393-100.png). These capture the scrolled control section; they are not full-sheet screenshots. Text wraps and controls remain reachable without horizontal overflow. The existing large-text sheet header is unchanged.

Pure tests cover explicit consent, independently enabled background projection, immutable lost-response replay after coordinator recreation, no submission for unsaved/guest/offline/denied sources, late disable/account-switch responses, competing primary, old-rejection/new-choice races, quota failure, quiet-override isolation, expired/empty/failed/clock-skew states and malformed responses. The browser flow verifies a real persisted plan, no automatic first upload, retained foreground preference, reload readback, aged renewal deadline, offline cancellation and recovery, with the guest source retained.

## Findings and preservation

The first navigation test clicked before account restoration finished; it now waits for the synced account. Display-only fixtures initially omitted today's calendar and priorities records, causing correct startup writes to hit their blocked network. Both are now prepared with domain commands. After background and foreground consent were separated, the old staged fixture correctly produced a quiet-hours warning; its explicit server override now matches the intended staged scene. None of these corrections weakens production sync, permission or quiet-hour checks. [Initial navigation failure](initial-navigation-failure.log), [initial layout failure](initial-layout-failure.log) and [diagnostic fixture log](layout-diagnosis.log) are retained as iteration evidence, not passing acceptance.

The test runtime migration directory contained 39 byte-identical duplicate filenames. Only those verified copies were quarantined privately under `.rise-infra/test/`; canonical sources and database history were retained. Both isolated environments then verified. No reset, migration-history repair or credential disclosure was used.

[Preservation checks](preservation.json) compare 43 pre-change style/design/domain/migration/asset/worker files: zero differences. Guest/account storage formats and original recovery sources remain unchanged. The user's port-4173 preview/profile was never accessed, seeded or cleared. [Artifact checks](artifact-verification.json) record local links and secret scanning; [cleanup](cleanup.json) records the isolated stacks' final state. No Git repository, deployment, cloud resources or external messages were involved.

Current [Supabase security documentation](https://supabase.com/docs/guides/database/postgres/column-level-security) and [changelog](https://supabase.com/changelog) were consulted. Existing forced RLS, narrow grants, verified session/actor handling and owner locking are retained; no provider administrator credential is used by the BFF.

## Release and rollback limits

Live transport/supervision, operational latency/receipt retention, habit reminders and their occurrence cancellation, and physical HTTPS iPhone/Android acceptance remain open. WebKit automation is not iPhone certification. Existing foreground/native behavior remains unchanged. Already submitted pushes cannot be recalled, and neither queued coverage nor a test guarantees waking the user.

Retain additive push schema and compatible optional control fields on rollback. Disable/owner cleanup removes renewal metadata without deleting guest or other-owner profiles. No saved-data reset is necessary. Local/test stacks are stopped after verification with volumes and protected credentials retained; unrelated Docker stacks and the user preview remain intact.
