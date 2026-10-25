# BFF concurrency and HTTP discovery

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · fixed test installation only.

**The optimized execution-thread experiment passes the local mixed gate. The real-HTTP cluster experiment fails it. Neither changes the production runtime.** Both preserve complete data, exact receipt replay and fixture cleanup. Cloud provisioning remains pending.

## Controlled workload

Both experiments use the unchanged increment-10 application and increment-8 mixed workload: 100 synthetic accounts, each with 100 habits and 730 dates; 50 joined families; four rounds of 400 personal and 200 shared intentions; the actual `SharedContent` reader; and 15-second metadata polling. Full/Undo alternate. The gate requires all first intentions accepted, accepted personal/shared scheduled p95 at most one second, and every accepted shared update observed within 15 seconds. Deferred intentions and missing observations remain failures. No threshold, pool budget, timeout, validation, authorization or data-retention rule changes.

Five BFF executors each own one restricted connection. The original parent BFF pool closes before measurement; the total remains five. Each executor loads and verifies only the fixed-test runtime configuration. Administrator access stays in the parent for exact synthetic setup/cleanup. Session/CSRF checks, forced RLS, owner/group locks, cancellation, transaction/receipt boundaries and operation identities remain intact. Credentials and cookies stay in memory and are absent from evidence.

The thread adapter is byte-identical to the [earlier pre-optimization probe](../bff-thread-discovery/README.md). It routes injected request envelopes to the least-pending thread, with prior count breaking ties. The HTTP adapter instead starts five Node cluster processes on **127.0.0.1:4191**, using round-robin connection distribution and a separate keep-alive agent for each synthetic browser. Actual measured API requests and readbacks cross HTTP; login and seeding remain injected setup. No forwarding header fabricates a client address. The listener and all child processes close after cleanup. Ports 4173 and 4190 are untouched.

These adapters differ in transport, worker kind and routing granularity. The comparison does **not** isolate connection affinity as the cause of the HTTP regression. That is a candidate for a controlled follow-up, not an established diagnosis. Neither adapter is a production supervisor: bounded admission, startup/shutdown failure, worker replacement, cancellation and lost-response behavior need explicit acceptance before adopting a runtime design.

## Full results

| Metric | Current single-process injected baseline | Five injected BFF threads | Five HTTP cluster processes |
| --- | ---: | ---: | ---: |
| Personal accepted / planned | 365 / 400 | 400 / 400 | 373 / 400 |
| Shared accepted / planned | 177 / 200 | 200 / 200 | 192 / 200 |
| HTTP failures | 20 | 0 | 31 |
| Deferred intentions | 38 | 0 | 4 |
| Personal scheduled p95 | 4,715.8 ms | 583.4 ms | 4,763.2 ms |
| Shared scheduled p95 | 4,599.1 ms | 520.7 ms | 4,030.5 ms |
| Shared observations / accepted | 166 / 177 | 200 / 200 | 184 / 192 |
| Observed after 15 seconds | 25 | 0 | 29 |
| Missing observations | 11 | 0 | 8 |
| Observed-only convergence p95 | 17,335.2 ms | 14,110.4 ms | 20,688.2 ms |
| Maximum observed convergence | 28,199.9 ms | 14,893.9 ms | 29,813.7 ms |
| Exact recovered intentions | 58 | 0 needed | 35 |
| Local mixed gate | FAIL | PASS | FAIL |

The baseline is [increment 10](../increment-10/README.md). The thread run exits 0 and the HTTP run exits 1. Every accepted receipt replays exactly, every original personal record and XP matches after full readback, both family members' final dated snapshots agree, and all exact generated fixtures are removed. No cleanup errors occur. The HTTP recoveries comprise 27 personal and eight shared intentions; failed requests are not reissued with new IDs or excluded from the original latency/acceptance verdict.

The thread run records 1,109 successful metadata reads, 499 successful task reads and 499 successful occurrence reads, plus one changed-head 409 for each content collection. The HTTP run records metadata 1,042 successes/57 HTTP 503, tasks 485 successes/10 HTTP 503, and occurrences 479 successes/15 HTTP 503/one changed-head 409. All samples remain in the reports. Setup takes 175.1/183.4 seconds respectively and is excluded from latency; database growth on the reused installation is not a controlled footprint measurement.

The thread pass has only 106 ms of observed worst-case convergence margin. It does not prove that a 15-second polling interval always satisfies a 15-second end-to-end target. More headroom and transient-read recovery still need verification.

## Commands, scope and preservation

| Command | Exit / result | Evidence |
| --- | --- | --- |
| `node --import tsx /tmp/rise-bff-thread-probe-optimized/run.mts smoke` | 0; both first attempts accepted; max 470.4 ms | [Report](threads/smoke.json), [log](threads/smoke.log) |
| Same command with `mixed` | 0; local mixed gate passes | [Report](threads/mixed.json), [log](threads/mixed.log) |
| `node --import tsx /tmp/rise-bff-http-probe/run.mts smoke` | 0; both first attempts accepted; max 575.3 ms | [Report](http/smoke.json), [log](http/smoke.log) |
| Same command with `mixed` | 1; latency, first acceptance and convergence fail; exact recovery passes | [Report](http/mixed.json), [log](http/mixed.log) |
| `node --check /tmp/rise-bff-http-probe/router.mjs` and `cluster.mjs` | 0 | Sources below |
| `node --import tsx --test --test-name-pattern='transient content failure' /tmp/rise-shared-error-repro.test.ts` | 1; focused known recovery failure reproduced; no source fix yet | [Probe](reader-recovery-repro/repro.test.ts), [log](reader-recovery-repro/repro.log) |
| `npm run check:docs` | See verification manifest | [Log](docs.log) |

The reader reproduction makes a content read fail once, emits unrelated group busy state, then supplies fresh authorized metadata at the same revision. The unavailable entry remains, so the existing hook cannot retry automatically. This isolates a recovery gap without modifying the application or influencing the measured phase. It is not evidence of a completed fix.

Probe sources: [thread driver](threads/run.mts), [thread router](threads/router.mjs), [thread worker](threads/worker.mjs), [HTTP driver](http/run.mts), [HTTP client adapter](http/router.mjs), [HTTP cluster entry](http/cluster.mjs). The drivers retain the existing fixed-test/disk/advisory-lock guards and exact-owner crash manifest. They use absolute imports to this reviewed checkout; they are archived diagnostic sources, not general deployment scripts. HTTP responses are bounded to 32 MiB, above the measured full-profile response, and use the installed cookie parser also used by the injected test transport.

Node's [cluster documentation](https://nodejs.org/docs/latest-v24.x/api/cluster.html) and [HTTP agent documentation](https://nodejs.org/docs/latest-v24.x/api/http.html) were checked on 24 October 2026. Those pages describe v24.22.1; execution remains on pinned Node **24.16.0**, npm **11.13.0**, macOS **26.6.2 arm64**, PostgreSQL **17.11**, with 16 GiB RAM and 10 logical CPUs. No runtime/dependency upgrade, browser or device claim is made.

[Source hashes](source-hashes.json) cover the same 52 runtime/workload files before and after both experiments. [Preservation](preservation.json) verifies prior sealed evidence and unchanged frontend builds. No application, schema, policy, dependency, CSS, asset, visual-reference or saved-profile change is made. A full application regression rerun would not add evidence for these diagnostic-only files. QUALITY-03 remains IN PROGRESS; real runtime/load resilience, dense local latency, hosted and physical acceptance remain open.
