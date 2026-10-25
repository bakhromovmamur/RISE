# Increment 11 — recover unavailable shared reads

24 October 2026 · QUALITY-03 · PRD-13/14/15/17 · NFR-03/NFR-07.

**Transient shared-read recovery is implemented and verified. Capacity and convergence under the dense workload still fail.** No production server-concurrency change is adopted, and cloud provisioning remains pending.

## Behavior and scope

An unavailable family or squad read previously remained unavailable after successful group metadata refreshes at the same revision. The existing hook would not issue another content read until a revision changed or the user clicked Retry. A real-browser regression reproduces that failure: after restoring the API, the task still did not return within the 20-second assertion window. [Original failure](logs/browser-before.log), [report](reports/browser-before.json).

The family, squad and invitation readers now capture the group-result array current when a read fails. A newer successful metadata result invalidates only an `unavailable` entry, even at the same group revision. Existing hooks can then reload a coherent first page; invitation recovery uses the newly authorized first page already present in group metadata and resets old navigation. Busy/receipt updates do not permit retries, including when metadata arrived before the failed request finished. Successful and in-flight reads stay intact. Authority errors are not automatically cleared by this rule. Account/role/membership changes, revision fencing, late-response rejection, pagination validation, explicit Retry and close cleanup remain.

Only reads are retried. No command, acknowledgment, invitation, publication, habit completion or XP change is created. Failed entries and their metadata references remain in memory and are discarded on invalidation/close. Durable intents, authored drafts, guest/account caches and persisted formats are unchanged. There is no new user-facing string or design change. The existing 15-second polling interval is unchanged and does not guarantee end-to-end convergence within 15 seconds.

[Source diff](source-changes.patch) covers the three readers, eight new unit cases, one browser regression and deterministic visible timestamps in two existing visual fixtures. No server/domain/schema/policy/dependency/asset/CSS change is made. [Source hashes](source-hashes.json), [build hashes](build-hashes.json), [measured-workload hashes](workload-source-hashes.json).

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Isolated pre-change reader cases | 16 pass / three expected recovery failures | [Log](discovery/reader/before.log) |
| Final reader cases | 21 pass, including metadata/error ordering and owner fences | [Log](logs/readers.log) |
| `npm run check` | 290 source cases, lint/types and both builds pass | [Log](logs/check.log) |
| Affected real-browser journeys | 33 pass across Chromium, WebKit and Firefox | [Log](logs/browser.log), [report](reports/browser.json) |
| Equivalent-state visual/reflow comparison | Three before and three after cases pass; 96/96 captures pixel-identical | [Before](reports/layout-fixed-before.json), [after](reports/layout-fixed-after.json), [comparison](visual-comparison.json) |
| Final fixture types/lint | Pass after timestamp stabilization | [Types](logs/typecheck-final.log), [lint](logs/lint-final.log) |
| Standard full mixed workload | Performance FAIL; exact replay/history/XP/shared readback/cleanup PASS | [Report](mixed.json), [log](logs/mixed.log) |

The 33 browser cases cover the new timer-only recovery, held pagination, lost task/Undo/publication replies, two-member convergence, competing edits, revoked access, invitation navigation, exact publication previews, draft retention and late-preview fencing. Authentication uses synthetic fixed-test accounts; traces/video/automatic screenshots are disabled. The new regression passes in all three engines without a focus/online event, another edit, reload or Retry click after failure. It asserts unchanged group revision, guest data and personal XP. Its total test duration includes setup; it is not a latency percentile or NFR acceptance measurement.

Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, PostgreSQL 17.11. [Observed browser versions](browser-versions.json): Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. These are local desktop engines, not physical-phone acceptance.

### Equivalent visual data

The first three before/after layout cases passed, but only 87/96 initial captures matched because completion and invitation timestamps used the live clock. The [initial comparison](visual-initial-comparison.json), [original images](visual-initial/) and [changed after images](visual-after-differences/) are retained. Inspected examples show changed timestamps, not a styling change. This initial comparison is not presented as complete parity.

The two visual fixtures now use stable visible completion/expiry instants while keeping authentication and fault clocks real. A temporary build plugin substitutes only the three original reader sources into a separate `/tmp` output. **All 24 files of that reconstructed production bundle match the pre-change production hashes**, including its worker and assets; current application sources and `dist/` are never reverted. [Parity proof](baseline-build-parity.json), [build plugin](discovery/vite-baseline.config.mts), [frozen test entry](discovery/serve-baseline.mts), [comparison configuration](discovery/playwright-baseline.config.mts).

Using the same fixed fixture data, all 96 before/after captures are pixel-identical. The three English synthetic-account matrices check light/dark, 320/375/393/430/1440 px and 100%/200% text, capturing representative 393-light and 320-dark states plus control details. The [final images](visual/) represent both builds. No frozen reference was regenerated; all 720 original visual references remain unchanged. Production/review entries are `index-DzU-cmmr.js` / `index-DUDsJjbX.js`; CSS stays `index-DM2hzASY.css`, SHA-256 `8bc52d0cffb8a961a11ca90cacff0fb6106f7f145da73d20bf4b5ffd89b4d897`.

Two temporary comparison-entry startup failures are retained: the first lacked the repository working directory for loader resolution, and the second needed an `.mts` extension outside the package's ESM scope. Explicit cwd and ESM corrected the test setup; application/server policy was unchanged. [Loader log](logs/layout-fixed-before-initial.log), [module log](logs/layout-fixed-before-module.log). An isolated candidate test initially imported the original squad module because its extensionless import was not rewritten; the corrected candidate passes all 21 cases. [Initial log](discovery/reader/candidate-initial.log), [final log](discovery/reader/final-candidate.log).

## Full mixed workload after the fix

`node --import tsx scripts/infra/check-account-load.ts mixed` uses the normal single-process BFF and unchanged fixed-test workload: 100 accounts with 7.3 million occurrences, 50 families, 400 personal and 200 shared intentions, five connections and unchanged acquisition/query/statement limits. The actual updated shared reader handles failures; no transport adapter or polling change is used. Setup takes 180.4 seconds outside measurement. Requests are injected, so this is neither real HTTP nor hosted acceptance.

| Metric | Result |
| --- | ---: |
| Personal accepted / planned | 328 / 400 |
| Shared accepted / planned | 153 / 200 |
| HTTP failures / deferred intentions | 36 / 83 |
| Accepted personal scheduled p95 | 5,501.1 ms |
| Accepted shared scheduled p95 | 5,347.8 ms |
| Shared observed / accepted | 144 / 153 |
| Observed after 15 seconds / missing | 18 / 9 |
| Observed-only convergence p95 / maximum | 18,100.0 / 42,500.3 ms |
| Exact recovered intentions | 119 — 72 personal, 47 shared |

Every recovery and immutable receipt replay succeeds. Every original personal record and XP total matches, both members' final shared snapshots agree, and exact synthetic fixture cleanup passes with no errors. The run exits 1 for failed acceptance/latency/convergence, with no root correctness error. Read statuses include metadata 1,020 successes/54 HTTP 503; tasks 394 successes/28 HTTP 503/seven changed-head 409; occurrences 394 successes/30 HTTP 503/seven changed-head 409.

The prior increment-10 normal run accepted 542/600 with personal/shared scheduled p95 4,715.8/4,599.1 ms. This run accepts 481/600 and has worse latency. **No performance improvement is claimed.** These single local runs do not isolate all variability or the cost of additional retries. The deterministic failure/browser tests prove the recovery fix; the dense run shows that the current server still cannot meet the required combined workload. Correct recovery does not close NFR-03.

## Controlled HTTP connection-reuse experiment

Before changing the readers, a separate experiment copied the preceding [real-HTTP cluster probe](../bff-concurrency-discovery/README.md) and changed only each synthetic browser agent's `keepAlive` value from true to false, plus its descriptive report text. Application/workload hashes matched before and after that run. Five cluster processes still shared five total restricted database connections. Configuration, credentials, thresholds, operation bodies, metadata polling and real HTTP remained unchanged. No production runtime setting is changed.

The smoke command passes both attempts with maximum 514.7 ms. The full command accepts 546/600: personal 360/400, shared 186/200, 15 HTTP failures and 39 deferred intentions. Personal/shared scheduled p95 is 4,181.5/3,056.2 ms. Of 186 accepted shared updates, 180 are observed, 25 after 15 seconds and six missing; observed-only p95 is 17,032.3 ms. All 54 exact recoveries, receipt/history/XP/shared checks and cleanup pass. Full mode exits 1. [Smoke](discovery/http-no-reuse/smoke.json), [full report](discovery/http-no-reuse/mixed.json), [source and logs](discovery/http-no-reuse/).

This rules out disabling connection reuse as a sufficient fix. It does not establish the cause of the gap between least-pending injected threads and round-robin HTTP processes. Actual HTTP balancing, bounded request admission, worker lifecycle and failure handling remain necessary evidence before adopting a concurrent server runtime.

## Preservation and remaining work

[Preservation](preservation.json) verifies 2,924 protected baseline files, 281 previously sealed evidence files and the unchanged increment-10 server writer. The known writer difference from increment 3 remains exactly the previously accepted increment-10 change. The new source/build/workload hashes stay fixed during the final load. Synthetic contexts/accounts only; 4173, saved profiles and unrelated installations are untouched. Test listeners/children terminate and the fixed test port is released.

The fix needs no migration or data rollback. Reverting its three reader source files restores the old manual-retry behavior without changing stored data. Full capacity, local dense-profile latency, remaining resilience, hosted operations and physical acceptance stay open. QUALITY-03 remains IN PROGRESS. Exact commands and terminal results are in [the verification manifest](verification.json).
