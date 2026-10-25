# PUSH-03 local evidence — 23 October 2026

Scope: PRD-10/11 and SEC-04 cancellation, dated acknowledgment and quiet-hour rules. Local implementation is in **REVIEW**. Cloud provisioning and live reminder dispatch remain pending; PUSH-02 integration, PUSH-04 readiness/renewal and PUSH-05 physical-device acceptance are still required. See the [implementation contract](../../PUSH-CANCELLATION.md).

## Implemented behavior

- Personal commands and selected import cancel affected queued/leased jobs inside the existing owner transaction. Dated Fajr acknowledgment cancels wake/backup only, without recording prayer or awarding XP. Preview commands have no effect.
- Current-state plan filtering prevents known recorded/paused/acknowledged events from returning. Quiet hours use the selected timezone, midnight wrapping and explicit per-plan override; receipts report actual coverage and suppression.
- Authenticated cancellation works without a subscription. Immutable request receipts preserve replay results and prevent a lost-response retry from canceling newer coverage. Guest, forged-owner, CSRF and malformed-key requests fail.
- Installation-local blocked event keys and pending cancellation survive offline operation; matching retries clear only the current request. Existing notification settings show English, Russian and Uzbek Latin pending/stopped text. Reopening the sheet reads local status before waiting for the server.
- Page and worker share atomic occurrence claims in an owner-scoped IndexedDB ledger. Scheduled worker envelopes require an explicit matching plan generation and current consent. Production installs no such generation yet. Clicks never report prayer or acknowledgment.

The additive migration is `20261022203413_push_quiet_policy.sql`. Changes are concentrated in `src/push/`, `server/push/`, personal command/import transaction hooks, workspace invalidation, prayer delivery and the existing service worker. [Source hashes](source-hashes.json) identify implementation, tests and updated project documents. No dependencies, CSS, assets or domain reducer rules changed.

## Verification

macOS Darwin arm64, Node 24.16.0, npm 11.13.0 and Playwright 1.64.1. Exact automated [browser versions](browser-versions.json) accompany this report. All accounts, mail flows, subscriptions and transport responses were synthetic. Database/Auth/BFF and browser IndexedDB were real isolated local/test components; browser permission/provider adapters were synthetic.

| Command | Result and evidence |
| --- | --- |
| `npm run check` | 198 unit/tooling tests; lint, app/server/test types and production/review builds pass. [Log](check.log). Existing bundle-size warning remains. |
| `npm run test:infra` | 80 tests pass across the database suite. [Log](infra.log). |
| `node --import tsx --test tests/infra/push-cancellation.test.ts` | One additional endpoint authorization/replay test passes after the full database run. [Log](cancellation-api.log). This is separate evidence, not a claim of one full 81-test run. |
| `npm run test:push` | 30 pass across Chromium, WebKit and Firefox, including offline cancellation/reconnect and shared page/worker claims. [Log](push-browser.log). |
| `npm run test:pwa` | 42 pass with real workers and isolated lifecycle/update controls. [Log](pwa.log). |
| `npm run test:browser -- --grep 'prayer\|Fajr\|wake\|pause'` | 162 pass across all three engines. [Log](prayer-journeys.log). |
| `npm run test:visual` | 48 configurations, 720 unchanged comparisons. No golden regeneration. [Log](visual.log). |
| `supabase db advisors --local --workdir .rise-infra/{local,test} --level warn --fail-on warn` | No issues on either installation. [Local](advisors-local.log), [test](advisors-test.log). |

Pure and database cases cover quiet boundaries/DST, dated acknowledgment, no prayer/XP side effects, pause/resume, state-filtered resubmission, cancellation replay, lease invalidation and both cancellation/provider-submission race orders. These do not demonstrate a real provider or device displaying a scheduled alert. Worker source tests execute its actual handlers against real browser IndexedDB; the separate PWA suite exercises registered worker lifecycle behavior.

Notification layout checks cover 486 combinations of scene, language, engine, width, theme and text scale, including 320/375/393/430 px, 200% text and desktop. Samples: [English 393/light](push-cancel-en-light-393-100.png), [Russian 320/dark/200%](push-cancel-ru-dark-320-200.png), [Uzbek 393/light](push-cancel-uz-light-393-100.png). English/Russian samples were visually inspected; status text fits and the existing composition is preserved. The one scoped design detector run returned no findings.

## Findings and preservation

The offline test exposed a real local-status rendering defect: server failure prevented reopening the sheet with its saved pending message. Local-first refresh fixes it; the final three-engine test passes. Earlier interrupted/failing iterations remain in [initial log](browser-initial-interrupted.log) and [offline regression log](browser-offline-status-regression.log); they are not acceptance evidence. Fixture corrections used stable transaction timestamps and valid prayer coverage. Owner-scoped test claims avoid consuming another synthetic account's job; no account/database reset was used.

The local runtime migration directory contained duplicate filenames with byte-identical canonical contents. Only verified duplicates were moved into a private quarantine under `.rise-infra/local/`; canonical migrations and database history were retained. Bringing up local then succeeded, and both environments had the additive migration for final verification. Protected runtime files/logs are not included here.

[Preservation checks](preservation.json) confirm 40 prior CSS/design/domain/migration/assets hashes unchanged, plus the PUSH-02 migration unchanged. Guest/account cache formats and original recovery sources are retained. The user's preview/profile on port 4173 was not accessed, seeded or cleared. No Git repository, deployment, cloud resources, external mail or provider push was involved. Final evidence link/secret checks are recorded in [artifact verification](artifact-verification.json).

## Limits and recovery

Cancellation cannot retract a provider submission that wins the owner lock first. Offline local metadata writing is asynchronous relative to a journey save; interruption/storage failure requires reconciliation before live activation. Ledger claims precede display and may lose an occurrence on failure; they are not proof of display or an exactly-once guarantee. Stale/canceled/duplicate worker envelopes use silent generic settings fallback under the visible-push contract, rather than timely reminder copy.

Live schedule generation/renewal, explicit override controls, supervisor/transport integration, measured operational latency and HTTPS/physical-device behavior remain gated. Existing foreground/native quiet preferences are unchanged. Real iPhone/Android wake-up or notification delivery is not certified.

Rollback should retain additive columns, existing profile/cache data and the opaque ledger. Do not roll back by clearing user storage. After verification, only RISE's local/test stacks were stopped, retaining volumes and protected credentials; unrelated Docker stacks and the user preview were left intact. [Cleanup record](cleanup.json).
