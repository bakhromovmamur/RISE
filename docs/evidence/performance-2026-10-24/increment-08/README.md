# Mixed personal/shared capacity diagnostic

24 October 2026 · QUALITY-03 · NFR-03/NFR-07 · fixed local test installation.

**Capacity and convergence fail; exact recovery and cleanup pass.** This increment adds diagnostic tooling. It does not change application behavior, SQL, RLS, schema, dependencies, production pool/timeouts or UI. Cloud provisioning remains pending.

## Workload and boundary

`check-account-load.ts mixed` uses 100 authorized synthetic accounts, each with 100 habits and 730 dates (7.3 million occurrences), and 50 explicitly joined synthetic families. Four 30-second rounds schedule 400 personal full/Undo intentions and 200 shared dated completion/Undo intentions. Arrivals are distributed within each round; scheduling lateness remains in the report and accepted scheduled p95. The measured interval is 136.0 seconds, followed by separate sequential recovery/readback.

Every request uses real local Auth, the restricted BFF, verified session and forced RLS. Fastify injection excludes network/browser/hosted latency. The unchanged database pool is five connections. All 100 accounts refresh group metadata every 15 seconds, with staggered phases. The actual `SharedContent` reader handles content caching, invalidation, errors and changed heads; the metadata adapter reproduces version fencing. Actor refresh follows accepted shared mutations. Convergence measures the other member's loaded state after server acknowledgment; this is client-state evidence, not browser paint.

Immutable IDs, bodies and expected revisions are captured before submission. A failed prior intention defers later intentions for that same account/group. Recovery submits the original sequence and verifies exact receipt replay. Full final personal relational values, historical snapshots, XP and revision 6 match; both members see the same final shared Undo row with its original task snapshot. No private history is read through another member.

## Full results

| First measurement | Personal | Shared |
| --- | ---: | ---: |
| Planned intentions | 400 | 200 |
| Accepted | 249 | 110 |
| HTTP 503 | 41 | 24 |
| Deferred after earlier failure | 110 | 66 |
| Accepted p95 request / scheduled latency | 5,348.9 / 5,348.9 ms | 4,936.7 / 4,936.7 ms |
| Maximum request latency | 6,155.6 ms | 5,575.5 ms |
| Maximum scheduling lateness | 673.9 ms | 673.6 ms |

Only 359/600 intentions succeed on their first attempt. All 241 failed/deferred intentions subsequently recover (151 personal, 90 shared), with exact replay. Among 110 accepted shared updates, 94 are observed, 13 of those exceed 15 seconds, and 16 remain unobserved. Observed-only convergence p95 is 18,487.2 ms, maximum 21,820.7 ms; it excludes the missing observations and does not imply all 200 planned shared intentions converged. There are 29 late or missing observations among accepted updates.

Read failures are retained: group metadata returns 914 successes/103 HTTP 503; tasks 262/63; occurrences 261/64. These failures affect the real shared reader's error/cache state. Seed time is 180.1 seconds, outside measurement. Net database size change is −7,004,160 bytes on the reused test database; it is not fixture footprint or a storage optimization result.

[All full samples](full.json), [progress log](logs/full.log). Process exit 1 is the expected failed performance gate. `historyAndXpRestored`, `exactRecoveryAndSharedReadback` and `cleaned` are true; cleanup errors are empty.

## Verification

- `npm run check`: exit 0, 282 source/tooling cases and production/review builds. [Log](logs/check.log). This precedes the final reporting-only scheduled-p95 addition; final `npm run typecheck` and focused Oxlint pass afterward ([types](logs/types.log), [lint](logs/lint.log)). The measured full run uses the final source hashes.
- `node --import tsx scripts/infra/check-account-load.ts mixed-smoke`: two dense accounts/one family, eight personal/four shared intentions all accepted. Personal/shared scheduled p95 is 1,958.4/1,697.3 ms; all four convergence observations are within 15 seconds (maximum 14,994.3 ms). Exact recovery/replay, readback and cleanup pass. Exit 1 for latency; small samples do not establish reliable p95 acceptance. [Report](smoke.json), [log](logs/smoke.log).
- `node --import tsx scripts/infra/check-account-load.ts mixed`: full results above; exit 1 for performance, recovery/readback/cleanup pass.
- Interruption guard: launch `mixed-smoke`, wait for `Mixed setup:`, send SIGTERM before first scheduled requests. The report has zero mutation samples, `error: interrupted`, empty cleanup errors and `cleaned: true`. The process terminated; its private manifest contains two exact synthetic emails and one registered group. [Report](interrupted.json), [log](logs/interrupted.log). This proves handled interruption, not hard-kill cleanup.
- `node --import tsx scripts/infra/check-account-load.ts smoke`: legacy mode exit 0, full/Undo 660.9/583.2 ms, exact replay/history/XP and cleanup pass. [Report](legacy-smoke.json), [log](logs/legacy-smoke.log).
- `npm run check:docs`: [log](logs/docs.log). [Machine-readable verification](verification.json).

The initial type check exposed that the actual shared reader's type graph uses DOM types, plus adapter return/tuple typing issues. Adapter types were corrected. Only the two cross-layer diagnostics moved into the existing DOM-capable tooling type configuration; production server type coverage remains Node-only. No suppression or runtime backend mock was added. The initial failed console output was not retained as a file; final logs are linked above.

## Preservation and recovery

[Source diff](source-changes.patch) and [source hashes](source-hashes.json) cover the two diagnostic files and two TypeScript configurations. [Documentation changes](documentation-changes.patch) and [document hashes](document-hashes.json) cover the current guides/status. [Preservation](preservation.json) rechecks the protected source/assets/migrations/references and sealed earlier evidence. All 52 increment-5 frontend build files remain identical; no browser/visual rerun or new browser compatibility claim is made for tooling-only changes. Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, PostgreSQL 17.11.

The protected `.rise-infra/test/capacity/<run>/fixtures.json` records exact emails plus group IDs/owners before creation. Cleanup verifies generated ownership, removes those groups before their accounts, and checks that groups/users/occurrences are gone. Tokens/credentials stay out of manifests/reports. A hard kill requires exact manifest recovery against the fixed test installation; never sweep other accounts. The saved 4173 profile, guest data and unrelated installations are untouched. Reverting this diagnostic requires no database/cache migration; existing `smoke`/`full` modes remain compatible.

QUALITY-03 remains IN PROGRESS. Whole-profile latency, load/convergence, integrated resilience and later hosted/physical acceptance remain unresolved. No production optimization is selected by this increment alone.
