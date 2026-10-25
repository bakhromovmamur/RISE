# QUALITY-03 — Stored ID validation and renewed local measurements

25 October 2026 · QUALITY-03 / NFR-02, NFR-03, NFR-07. **IN PROGRESS. Cloud provisioning remains pending.**

## Scope and change

A fresh five-account diagnostic reproduced the dense-profile latency shortfall. Each synthetic account retains 100 habits and 730 dates (73,000 occurrences); two concurrent check/Undo waves use real local Auth, the restricted BFF and Postgres through Fastify injection. The initial unprofiled run accepted 10/10 operations but missed the one-second gate at 1,486.4 ms p95. A CPU-profiled repeat accepted 10/10 at 1,491.8 ms. Both verified exact receipt replay, complete history/XP restoration and fixture cleanup. The profile includes setup/readback as well as mutations; it identifies validation and structured cloning as CPU costs, not a complete attribution of request latency. [Initial run](diagnostic/baseline.log), [profiled repeat](diagnostic/profile.log), [CPU summary](diagnostic/cpu-summary.json).

The only runtime change is in `src/data/validation.ts`: stored identifiers now use one pattern for the existing ECMAScript whitespace and U+0000–U+001F exclusions instead of a whitespace pattern followed by a JavaScript character loop. The existing code-point length check, exact error paths and accepted Unicode values remain. JSON safety, hidden-field/accessor checks, all schema/reference validation, unknown safe extensions and persisted formats are unchanged. No validation cache, new dependency, SQL/schema/security-policy change or UI change is introduced. The intentional control-character rejection has one documented line-level lint exception. [Application/test patch](implementation.patch), [source hashes](source-hashes.json).

## Measured outcome

Two alternating-order experiments validate the entire synthetic dense state with UUID habit IDs. Each uses 22 rounds, discards two warmups and explicitly collects garbage before each sample. The first experiment’s upper-middle summary changes from **38.8 → 33.5 ms**; the repeat’s median changes from **38.1 → 33.7 ms** (about 12–14%). These are local pure-function measurements. The first experiment retains its command-output summary; the repeat retains all samples and uses the arithmetic mean of its two middle samples. [First summary](validation/initial-summary.json), [repeat samples](validation/validation-comparison.json).

The unchanged five-account API diagnostic after the change accepts 10/10 at **1,498.7 ms p95**. It preserves complete history/XP, exact replay and cleanup, but still fails the latency target. **No end-to-end speedup or capacity acceptance is established.** This two-wave sample is not the PRD's sustained 100-account mixed workload. [After run](diagnostic/candidate.log).

`node --import tsx scripts/infra/check-account-load.ts mixed` stops at `insufficient_host_disk_headroom` before Auth setup or fixture creation. The preceding read-only disk measurement was 11.61 GiB available, below the unchanged strict greater-than-12-GiB requirement. The guard remains; no retained releases, saved profiles or unrelated files were removed to force a run. The last full mixed-workload failure remains [increment 12](../performance-2026-10-24/increment-12/README.md#normal-server-capacity-result). [Disk-guard log](diagnostic/full-capacity.log).

## Current desktop browser measurements

All six real IndexedDB/repository probes and three production feedback probes pass their correctness assertions. Their measurements still exceed the relevant targets:

| Engine | Durable check median | Undo median | Draft median | Production DOM feedback (one sample) |
| --- | ---: | ---: | ---: | ---: |
| Chromium 156.0.8078.4 | 283.2 ms | 319.3 ms | 277.0 ms | 122.6 ms |
| WebKit 27.2 | 327.0 ms | 360.0 ms | 329.0 ms | 114.0 ms |
| Firefox 157.0 | 566.0 ms | 572.0 ms | 557.0 ms | 193.0 ms |

Each durable median uses three action samples from the real adapter; feedback is one production Today sample at 393×852. Neither is physical-device or p95 acceptance. The 250 ms durable and 100 ms feedback targets remain unmet in these diagnostics. No claim of a causal browser improvement is made from historical comparisons. Complete history, +20 XP on check/Undo reconciliation, durable drafts, exact replay, source recovery and reopening are asserted. [Adapter/phase samples](verification/performance-measurements.json), [production feedback samples](verification/feedback-measurements.json).

## Verification

The compatibility experiment compares every Unicode code point at the start, middle and end of an ID, plus type/length boundaries: **3,342,349 comparisons** match accepted values and exact errors. The expanded repository test covers all control characters, ECMAScript whitespace, accepted non-whitespace characters, lone surrogates, multilingual IDs, code-point limits and nested error paths. It passes against both the old implementation and the change. Existing hidden-accessor, unsafe-key, byte/depth/record-limit and full-history round-trip tests also pass. [Parity result](validation/id-parity.json), [before tests](verification/validation-before.log), [focused tests](verification/focused.log).

The initial source check stopped at the control-regex lint rule. After documenting the intentional exclusion on that line, `npm run check` passes **317/317** tests, lint, types, pinned toolchain checks and both builds. Existing bundle-size/dynamic-import notices remain. [Initial lint result](verification/check-initial-lint.log), [completed check](verification/check.log).

The sequential real-database command passes **39/39** cases:

```sh
node --import tsx --test --test-concurrency=1 tests/infra/personal.test.ts tests/infra/sync.test.ts tests/infra/recovery.test.ts tests/infra/shared-priorities.test.ts tests/infra/push-cancellation.test.ts
```

It covers owner/session/RLS isolation, explicit import, two-device conflicts, exact replay, receipt-failure rollback, historical corrections, shared priority authorization and cancellation. [Database log](verification/database.log).

Browser correctness commands:

```sh
npx playwright test --config playwright.performance.config.ts
npx playwright test --config playwright.performance-production.config.ts
npx playwright test tests/storage.browser.spec.ts tests/recovery.browser.spec.ts tests/backup.browser.spec.ts --workers=1
npm run test:sync
npm run test:pwa
```

The 6 adapter/repository, 3 production feedback and **84 storage/backup/recovery** cases pass in Chromium, WebKit and Firefox. Storage coverage includes real worker validation, quota failures, unchanged legacy recovery sources, stale-tab conflicts, failed-save retry and portable restore/rollback. All **69 sync cases pass** with zero retries, failures or skips, including offline reload, lost replies, cache failure, owner switching/deletion and legacy/conflict recovery. [Sync report](verification/sync-report.json), [sync log](verification/sync.log). [Storage report](verification/storage-report.json), [storage log](verification/storage.log).

The real service-worker suite passes **63/63** cases: delayed activation, repeated updates/rollback, warm/cold offline entry, failed asset installation, incompatible storage contracts, blocked/failed durable saves and private-cache exclusions. [PWA report](verification/pwa-report.json), [PWA log](verification/pwa.log). Across all five browser suites, **225/225 cases pass with zero failures, retries, flakes, skips or runner errors**. These correctness results do not convert the recorded performance misses into passes. [Exact sequential commands, times and result counts](verification.json).

The read-only preservation comparison confirms all **62 local tables** and **five protected configuration files** unchanged. File hashes also preserve **44 UI sources, eight stylesheets, 12 public assets, 35 migrations, 799 frozen visual references and 3,085 existing evidence files**. Saved-profile origins 4173/4190/4192 were not loaded or seeded. The test suites use disposable contexts on 4180/4181/4191 and exact synthetic-owner cleanup. [Preservation](preservation.json), [environment and browser versions](environment.json).


## Reproduction and rollback

The diagnostic source copies are evidence, not shipped runtime code. Copy `validation/` to a new directory directly under `.rise-infra/`, retaining the copied modules, and update the two drivers' output paths from `.rise-infra/quality03-20261025/` to that new directory. Run `node --expose-gc --import tsx <directory>/validation-bench.ts` and `node --import tsx <directory>/id-parity.ts` from the repository root. Type-only imports in the copied state modules are erased by tsx; their runtime validation imports select the archived old/new module. Verify source hashes first. Do not run a writer inside this sealed evidence directory.

To repeat the five-account diagnostic, copy [five-account.ts](diagnostic/five-account.ts) into a new directory directly under `.rise-infra/` and run `node --import tsx <directory>/five-account.ts smoke` alone against the fixed test stack. It is the existing driver with only smoke account count 1 → 5 and its mixed-driver import adjusted for the copy. The existing synthetic identity manifest, capacity lock, date/disk guards, original deadlines, exact retries and owned-fixture cleanup remain. Exit 1 means its latency gate failed even when correctness/cleanup passed. Do not run it in the evidence directory.

Rollback restores the previous ID validator from the patch or archived module. No migration, cache rewrite, receipt replacement, data deletion or recovery action is needed. Physical mobile Web Vitals/durable latency, the full mixed workload, integrated production resilience and hosted availability/recovery acceptance remain open. A faster validator alone cannot close QUALITY-03 or RELEASE-01.

Final checks: current-document links/anchors, task dependencies and PRD mappings pass; the new evidence links resolve. The known-secret scan finds no matches in source, evidence, tests or builds. All test ports are released. [Documentation check](verification/docs.log), [evidence-link check](verification/evidence-links.json), [secret scan](secret-scan.json).
