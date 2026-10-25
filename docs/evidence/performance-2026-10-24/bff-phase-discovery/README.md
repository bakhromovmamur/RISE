# BFF request-phase profiling and occurrence-read comparison

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · fixed test installation only.

This investigation follows the failed [HTTP admission experiments](../bff-http-admission-discovery/README.md). It instruments an isolated source copy; the normal application, runtime entry point, schema, policies and browser builds remain unchanged. Cloud provisioning remains pending.

## Profiling boundary

The copy differs only in three existing modules plus a new diagnostic helper. The application hooks attribute a request to an opaque sequential probe ID and a fixed route family. Session transactions measure restricted-pool acquisition and query wall time. Personal commands additionally measure hydration, domain reduction, validation, projection, writes, cancellation and the invoker total check. Parameters, SQL text, cookies, credentials, account/member IDs, free text and profile content are never retained in telemetry. Synchronous spans also record thread CPU time. Query wall time includes driver processing and event-loop delay; it is not pure database execution time. Parent spans overlap child spans and must not be added as independent costs.

Five actual BFF threads retain one restricted connection each, with least-pending per-request HTTP routing over private Unix sockets. The original parent BFF pool closes before measurement. Login/seeding remains injected setup. These diagnostic gateways still lack production trusted peer/IP transport and complete failure supervision; they do not certify authentication quotas or production deployment. The workload keeps 100 accounts, 100 habits and 730 dates per account, 50 families, 600 intentions, the actual shared reader and its 15-second refresh. No timeout, threshold, RLS policy, history or validation check changes.

Worker samples retain event-loop utilization, thread CPU, heap/RSS and aggregate garbage collection. The parent samples only aggregate fixed-test database activity/vacuum/tuple estimates and host load/free-memory context. Host VM counters are global and cannot attribute memory activity exclusively to this application. These are local diagnostics, not hosted/device capacity acceptance.

[Instrumentation diff](probe/instrumentation.patch), [diagnostic helper](probe/diagnostics.ts), [source preparation](probe/prepare-source.py), [driver](probe/run.mts), [HTTP adapter](probe/router.mjs), [gateway](probe/gateway.mjs), [worker](probe/worker.mjs) and [analysis](probe/analyze.py) preserve the method. Restore the diagnostic files to their recorded `/tmp/rise-bff-phase-probe` location and prepare the isolated source from this checkout to reproduce; these absolute-import scripts are not deployment tooling. [Copied-source hashes](probe/copied-source-hashes.json) and [original runtime/workload hashes](probe/source-hashes.json) identify the input. The isolated server type-check and Node syntax checks pass.

## Initial run and capture failure

The initial smoke run accepts both first intentions, with maximum latency 526.0 ms and exact receipt/history/XP/cleanup checks passing. Its phase attribution works for all six routed requests. [Smoke report](smoke/smoke.json), [phase data](smoke/smoke-stats.json).

The first full run accepts 458/600 intentions: 297 personal and 161 shared, with 44 HTTP failures and 98 deferred intentions. Personal/shared scheduled p95 is 5,293.7/4,056.8 ms. Of 161 accepted shared updates, 158 are observed; 40 exceed 15 seconds and three are missing. All 142 failed/deferred intentions subsequently recover exactly. Every receipt, complete original personal history/XP, final shared snapshot and exact fixture cleanup passes. The run exits 1 for the timing gate with no application/cleanup error. [Report](failed-capture/mixed.json), [log](failed-capture/mixed.log).

The large phase report was not received before the child terminated. The old `stats.json` was still byte-identical to the smoke report; it is explicitly retained as [stale smoke data](failed-capture/stats-stale-smoke.json), **not full-run phase evidence**. [Failure record](failed-capture/capture-failure.json). The adapter now writes the report to a unique per-run file before exit. The parent requires that capture ID, zero dropped worker records and matching gateway/worker counts before accepting the current report. The repaired smoke run passes this contract and all original correctness/cleanup checks. [Report](smoke/capture-smoke.json), [captured phases](smoke/capture-smoke-stats.json).

Two host VM snapshots 87.6 seconds apart during measurement record 119,191 swap-in and 134,128 swap-out pages, at 16,384 bytes per page. Swap usage rises from 7,482.0 to 7,729.6 MiB. This is evidence of active host-wide memory pressure, not a causal allocation to RISE or proof that instrumentation alone caused the regression. [Counters and scope](failed-capture/memory-context.json), [first](failed-capture/vm-during.txt) and [later](failed-capture/vm-later.txt) snapshots, [aggregate database/host samples](failed-capture/resources.json). The first full run cannot support request-phase conclusions because its detailed capture is missing.

## Completed full capture

The repaired full run records **3,459 matching gateway/worker requests**, with its current capture UUID and zero dropped worker records. These counts cover setup, measurement, recovery, readback and logout after the adapter switch. All five workers and the public listener terminate. [Capture verification](captured/capture-verification.json), [full phase data](captured/stats.json), [analysis](captured/analysis.json), [load report](captured/mixed.json), [log](captured/mixed.log).

The timing gate fails: 192/400 personal and 92/200 shared first intentions succeed, with 83 HTTP failures and 233 deferred intentions. Accepted personal/shared scheduled p95 is 6,319.4/4,941.2 ms. Of 92 accepted shared updates, 82 are observed; 19 exceed 15 seconds and ten are missing. All **316** failed/deferred intentions subsequently recover exactly. Every receipt, complete original personal history/XP, final shared snapshot and exact cleanup passes. Terminal exit is 1, with no application or cleanup error. Seeding takes 202.3 seconds.

The analysis identifies measured mutation attempts by gateway request order and the driver's actual first-attempt counts. Recovery/replay is separate. Other route/resource time windows start at the first personal worker request and use the measured duration, so their boundaries are approximate. Parent spans overlap child spans; the following means are not additive totals:

| Mean phase | 192 measured personal requests reaching domain work | 208 later personal recoveries reaching domain work |
| --- | ---: | ---: |
| Pool acquisition, summed per request | 1,155.5 ms | 0.1 ms |
| Occurrence query, including client/event-loop work | 666.8 ms | 216.1 ms |
| Hydration | 224.8 ms | 109.7 ms |
| Domain reducer | 133.8 ms | 65.9 ms |
| Output validation | 145.0 ms | 74.8 ms |
| Projection | 98.7 ms | 47.5 ms |
| Delta writer | 125.2 ms | 52.6 ms |

For 120 measured shared mutation attempts, summed pool-acquisition p95 is **4,829.9 ms**, versus an overall worker-request p95 of 4,963.6 ms; the owner-lock phase averages 1.8 ms. Metadata reads show pool-acquisition p95 4,364.1 ms versus worker-request p95 4,486.0 ms. These similar percentiles do not refer necessarily to the same request, but the raw per-request spans also show substantial acquisition waits. Median gateway-to-worker start lag is under one millisecond; its p95 is about 257–295 ms for metadata/shared requests, so transport/event-loop arrival delay is not zero.

During the approximate measured window, worker median thread CPU utilization is about 19–29%, and median event-loop utilization about 27–38%. Garbage-collection wall time totals approximately 3.6–5.9 seconds per worker across those intervals. Across the full capture, sampled heap-total maxima are about 420–488 MiB per worker, while sampled heap-used maxima are about 312–414 MiB. These are sampled V8 heaps, not a simultaneous sum, live-set measurement or per-worker RSS attribution.

All 36 database/host resource samples succeed; three see active vacuum, including two during measurement. Host one-minute load averages range up to 13.8 on ten logical CPUs. The retained [resource samples](captured/resources.json) and VM snapshots supply context. This run combines instrumentation and a pressured shared host; it cannot isolate a causal difference from earlier uninstrumented runs or certify production capacity.

**Next decision:** test fewer BFF execution threads while preserving the total five restricted connections and overlapping requests. This directly investigates the observed per-worker pool waits and duplicated heap footprint without adopting the failed one-active-request queue. Record memory/database context and exact correctness again. No production runtime, pool-budget increase, RLS relaxation, timeout change or skipped validation is authorized by these results. The separate 15-second cadence still needs convergence headroom and a higher-read-load check.

## Rejected occurrence-read alternative

A separate read-only comparison runs after the load probe terminates. It keeps the verified session, restricted actor transaction, owner predicate, forced RLS, 250,001-row SQL bound and exact date/position/ID ordering. The current direct-column query is compared with ordered `json_agg` around the same selected rows. Five alternating-order rounds compare all 73,000 occurrence values. Separate `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` timings exclude result transfer. Only scalar plan totals are retained.

| Median | Current direct columns | Ordered JSON aggregate |
| --- | ---: | ---: |
| Query wall time, including client transfer/parsing | 129.5 ms | 232.3 ms |
| Client thread CPU | 63.6 ms | 62.3 ms |
| Separate database execution | 49.0 ms | 122.1 ms |

Every ordered value matches. SQL, German and ISO DateStyle settings with Pacific/Apia database timezone retain the same civil dates. Empty selection returns an empty collection. Subsequent normal full/Undo, exact receipts, complete history/XP readback and exact cleanup pass; terminal exit is 0. **The aggregate query is rejected and is not implemented.** This is an isolated query comparison, not a load or cross-owner authorization certification. [Probe](query/query-comparison.mts), [all samples and correctness result](query/query-comparison.json), [log](query/query-comparison.log).

Node's [performance](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html) and [process](https://nodejs.org/docs/latest-v24.x/api/process.html) documentation, PostgreSQL 17's [aggregate](https://www.postgresql.org/docs/17/functions-aggregate.html) and [JSON](https://www.postgresql.org/docs/17/functions-json.html) documentation, and Supabase's [RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance) were checked on 24 October 2026. The [Supabase changelog](https://supabase.com/changelog) and [17.11 breaking-change note](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) were reviewed; no upgrade, extension, index or security-policy change is made. Execution remains pinned Node 24.16.0 / npm 11.13.0 on macOS 26.6.2 arm64 with 10 logical CPUs and 16 GiB RAM.
