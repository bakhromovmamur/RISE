# QUALITY-03 — local browser and domain performance, 25 October 2026

This increment removes redundant full-history work and fixes a confirmed IndexedDB acknowledgment race. **QUALITY-03 / PRD NFR-02 remain open:** dense-profile save latency still exceeds the 250 ms target, and these desktop diagnostics do not establish mobile feedback or physical-device acceptance. Cloud provisioning remains pending.

## Scope and compatibility

The implementation changes only `src/data/storedState.ts`, `src/data/indexedDb.ts` and `src/domain/personalCommands.ts`. Regression coverage is in `tests/state-envelope.test.ts`, `tests/personal-command-isolation.test.ts` and `tests/storage.browser.spec.ts`. Exact final SHA-256 values are in [source-hashes.json](source-hashes.json).

- `validateStateEnvelope` performs one complete envelope JSON-safety walk and the same state shape/reference checks. It retains unknown-field, nonenumerable-field, accessor, array, depth and object-count checks. There is no exposed unchecked validator or skip-validation switch. If both state and envelope metadata are malformed, state validation now fails first; startup still enters the same generic recovery screen. The browser regression preserves and exports the exact damaged envelope and original legacy source.
- Habit/goal/reward save, reward retry and timer completion use the owned result already returned by their pure helpers. The redundant outer clone is removed. Timer completion checks the same materialized result instead of separately materializing and discarding another full-history copy. Other reducer paths retain their existing cloning. Unknown fields, dated history, drafts, XP and reward reconciliation remain intact.
- The strict IndexedDB transaction now clones the validated callback result synchronously before `put` and before yielding, then returns that owned snapshot only after commit. Previously, a callback-retained object mutated in a queued microtask could change the acknowledgment after the database had already serialized a different value. No schema, migration, receipt, durability or recovery format changes were made.

No UI/design assets, saved profiles, account databases or cloud services were modified by this work. Tests use synthetic profiles and isolated port 4180; the user's 4173/4190 profiles are untouched. The copy remains native `structuredClone`; independent snapshots are preserved. Rollback needs no data migration, though reverting the acknowledgment fix would restore the demonstrated race.

## Environment and evidence

Local macOS arm64, Node 24.16.0. Browser versions: Chromium **156.0.8078.4**, WebKit **27.2**, Firefox **157.0**. Timing runs were sequential in an exclusive CPU/browser window, with builds and database suites paused. Dense fixtures contain 100 habits across 730 days (73,000 occurrences). Private originals, full logs, synthetic traces, scripts and samples remain under `.rise-infra/local-completion-20261025/browser-agent/`; that directory is not a publication artifact. Public JSON below contains only source hashes and numerical diagnostic summaries.

| Check | Outcome |
| --- | --- |
| Focused domain/command/envelope unit execution | 23 passed, 0 failed |
| Differential old/new reducers, 6 commands × 9 fixture variants | 54 exact value/error comparisons; input unchanged |
| Retained-callback acknowledgment regression before fix | Expected RED in all 3 engines; returned name differed from durable name |
| Selected real IndexedDB regressions after fix | 18 passed, 0 failed; all 3 engines |
| Dense real DeviceSession discovery before fix | 3 passed; exact history/XP/draft/revision/reopen checks |
| Same DeviceSession discovery after fix | 3 passed; same checks |
| Strict IDB copy mechanism A/B | 3 passed; candidate rejected for Firefox regression |
| Review build after final runtime change | Passed; existing bundle-size advisory remains |

The 23-test focused run preceded the additional direct `envelope.state` accessor assertion. That assertion is included in the final source hash and type-checked by the review build; execution of the final full unit/browser gates is recorded by the parent integration report, not claimed here. The 18 browser cases cover callback mutation, independent adapter/repository/replay snapshots, outbox rollback and exact retry, migration/reopen/idempotency, two-year history retention and dual-invalid-envelope recovery.

## Measured domain and validation changes

[Pure comparison summaries](pure-comparison-summary.json). These are Node microbenchmarks, **not** end-to-end latency acceptance. Alternating old/candidate order, explicit GC outside timed sections; 12 rounds minus 2 warmups for reducers/clones, 14 minus 2 for envelopes. Before-images were archived before editing; old reducer imports point at the same unchanged helper implementations.

| Pure operation | Before median ms | After median ms |
| --- | ---: | ---: |
| New habit save | 84.24 | 40.80 |
| Existing habit save | 84.49 | 41.32 |
| Goal save | 83.53 | 40.52 |
| Reward save | 83.54 | 40.77 |
| Reward retry | 83.75 | 40.88 |
| Timer complete | 134.16 | 44.63 |
| Envelope JSON safety + state validation | 48.67 | 33.21 |

The envelope comparison excludes IndexedDB I/O, other envelope metadata validation and domain reduction. No safety or reference check was removed. Differential fixtures include missing/empty current dates, absent/incomplete/wrong-date timers, earned/enjoyed rewards, archived habits and retained drafts. Permanent tests additionally verify frozen input, invalid commands, no-op independence, output mutation isolation, exact timer XP and unknown extension preservation.

## Browser measurements and remaining target failures

[Full session summaries](session-comparison-summary.json). These before/after measurements isolate **only the acknowledgment clone-order fix**: both builds already contain the envelope and reducer improvements. Three observations per action/engine are diagnostic samples, not a credible p95 acceptance study. `dispatchMs` is synchronous command processing; `nextFrameMs` is an opportunity to paint, not observed completed-card feedback. Neither is relabeled as the NFR-02 UI-feedback measurement.

| Engine | Action | Median dispatch ms, before → after | Median durable ms, before → after | After durable max ms |
| --- | --- | ---: | ---: | ---: |
| chromium | habit.check | 99.5 → 100.8 | 273.3 → 271.8 | 283.7 |
| chromium | habit.correct | 123.9 → 120.9 | 311.9 → 298.3 | 322.7 |
| chromium | habit.draft | 95.0 → 94.7 | 268.1 → 265.0 | 265.8 |
| webkit | habit.check | 89.0 → 90.0 | 303.0 → 302.0 | 319.0 |
| webkit | habit.correct | 87.0 → 89.0 | 331.0 → 301.0 | 307.0 |
| webkit | habit.draft | 87.0 → 87.0 | 297.0 → 295.0 | 308.0 |
| firefox | habit.check | 152.0 → 159.0 | 555.0 → 557.0 | 558.0 |
| firefox | habit.correct | 147.0 → 149.0 | 560.0 → 555.0 | 560.0 |
| firefox | habit.draft | 145.0 → 155.0 | 535.0 → 546.0 | 618.0 |

The clone-order correctness fix has no demonstrated material speed improvement. All after-fix action/engine durable medians exceed 250 ms; Firefox remains roughly 546–557 ms. Chromium check/Undo and all Firefox dispatch medians already exceed 100 ms before paint, so feedback acceptance is not established. No threshold, fixture density, measurement criterion or saved-state success condition was weakened. NFR-01 mobile metrics, production UI feedback and physical-device evidence require their own runs; this report does not supersede earlier measured failures.

## Rejected candidates

- A descriptor-aware generic plain-graph clone took **62.81 ms** median versus native structured clone **39.45 ms**. It was not adopted.
- Same-transaction IndexedDB `put` plus `get` could return an owned committed copy and passed mutation/readback checks. Alternating 12 rounds minus 2 warmups produced clone → readback median **49.05 → 40.60 ms Chromium**, **82.50 → 55.00 ms WebKit**, **151.00 → 178.00 ms Firefox**. This isolated mechanism excludes validation/reduction and is not whole-command timing. It was rejected because it slowed Firefox. [Numerical summary](idb-comparison-summary.json).
- A candidate-specific second-read abort test was retained only privately after the readback design was rejected. Existing real transaction failure/retry coverage and the new callback race test exercise the adopted clone-before-write implementation. The expected-red assertion was not weakened.
- Removing DeviceSession's validated JSON roundtrip or publishing a state before validation would change normalization/ownership guarantees. Neither was implemented. Showing an earlier Saving label alone would not prove the existing completed-card feedback target; UI/measurement semantics remain unchanged.

## Exact executed commands

All commands run from the repository root. Private report/output paths were distinct for before/after runs to preserve evidence. The three microbenchmarks below are retained local diagnostic scripts, not committed runtime tools.

```sh
node --import tsx --test tests/state-envelope.test.ts tests/personal-command-isolation.test.ts tests/personal-commands.test.ts tests/commands.test.ts
node --expose-gc --import tsx .rise-infra/local-completion-20261025/browser-agent/domain-comparison.ts
node --expose-gc --import tsx .rise-infra/local-completion-20261025/browser-agent/envelope-bench.ts
node --expose-gc --import tsx .rise-infra/local-completion-20261025/browser-agent/clone-bench.ts
PLAYWRIGHT_JSON_OUTPUT_NAME=.rise-infra/local-completion-20261025/browser-agent/readback-red.json npx playwright test tests/storage.browser.spec.ts --grep 'transaction acknowledgment matches durable data' --workers=1 --reporter=list,json --output=.rise-infra/local-completion-20261025/browser-agent/readback-red-output
npx playwright test -c .rise-infra/local-completion-20261025/browser-agent/playwright.idb.config.ts
PLAYWRIGHT_JSON_OUTPUT_NAME=.rise-infra/local-completion-20261025/browser-agent/session-before.json npx playwright test -c playwright.performance.config.ts local.performance.spec.ts --reporter=list,json --output=.rise-infra/local-completion-20261025/browser-agent/session-before-output
npm run build:review
PLAYWRIGHT_JSON_OUTPUT_NAME=.rise-infra/local-completion-20261025/browser-agent/readback-green.json npx playwright test tests/storage.browser.spec.ts --grep 'transaction acknowledgment|adapter and repository|outbox failure|damaged envelope|IndexedDB migration|two-year profile' --workers=1 --reporter=list,json --output=.rise-infra/local-completion-20261025/browser-agent/readback-green-output
PLAYWRIGHT_JSON_OUTPUT_NAME=.rise-infra/local-completion-20261025/browser-agent/session-after.json npx playwright test -c playwright.performance.config.ts local.performance.spec.ts --reporter=list,json --output=.rise-infra/local-completion-20261025/browser-agent/session-after-output
```

Shell output redirection saved the matching private `.log` files. `readback-red` and `readback-green` are retained diagnostic filenames; the final implementation uses a clone before write, not the rejected extra-read design. Full release verification and task status remain the responsibility of the parent local-completion report.
