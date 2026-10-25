# BFF thread and pool partition discovery

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · fixed test installation only.

This investigation follows [request-phase profiling](../bff-phase-discovery/README.md). It keeps the identical instrumented source copy, five total restricted BFF connections, least-pending HTTP routing, concurrent requests, original timeouts and 100-account mixed workload. The pool partition changes from five threads with one connection each to two threads with three and two connections. Routing still uses raw pending counts; it does not give the larger pool an explicit weight. Thread count and per-thread pool width change together, so the comparison cannot independently attribute their effects.

The ordinary application entry, browser builds, schema, RLS, credentials boundary, design and persisted formats are unchanged. The diagnostic gateway lacks production source-IP forwarding and complete supervision; login and seeding are injected setup. It cannot certify authentication quotas, hosted capacity, browser paint or physical-device behavior. Cloud provisioning remains pending.

The hypothesis is that wider per-thread pools and fewer duplicated V8 heaps reduce the acquisition waits and memory overhead observed in the five-thread profile. Higher per-thread CPU contention is a competing outcome. The test retains all failed/deferred intentions and requires exact replay, complete personal history/XP, shared readback and exact fixture cleanup.

[Comparison patch](probe/comparison.patch) records the small adapter change. The worker deliberately uses the previous instrumented copy at `/tmp/rise-bff-phase-probe/source`; reconstruct that source using the prior report before reproducing this probe in `/tmp/rise-bff-two-thread-probe`. The current source hash manifest and prior copied-source manifest identify the application inputs.

The smoke run exits 0: both full/Undo intentions pass, maximum 531.1 ms, with exact replay, complete histories/XP and cleanup. Its six gateway requests match all six worker records, with pool partition 3+2 and no drops. [Smoke report](smoke/smoke.json), [capture](smoke/smoke-stats.json).

## Full result and interpretation

The full run terminates with exit 1 for the capacity gate. Its **3,578 gateway records match all worker records**, with the current capture UUID, zero drops and a 3+2 pool partition. Both workers receive 1,789 requests across setup, measurement, recovery and readback; that does not imply equal costly work. The gateway reaches 96 pending requests and rejects none. The listener and both workers terminate. [Capture verification](full/capture-verification.json), [raw load report](full/mixed.json), [phases](full/stats.json), [analysis](full/analysis.json), [log](full/mixed.log).

| First intentions | Personal | Shared |
| --- | ---: | ---: |
| Planned | 400 | 200 |
| Accepted | 237 | 100 |
| HTTP failures | 48 | 28 |
| Deferred after an earlier failure | 115 | 72 |
| Accepted scheduled p95 | 6,201.6 ms | 4,950.8 ms |

Of 100 accepted shared updates, 89 are observed; 33 exceed 15 seconds and 11 are missing. Observed p95 is 29,456.5 ms and maximum 60,613.7 ms. All **263** failed/deferred intentions subsequently recover using their original IDs/bodies/revisions. Every receipt replay, complete original personal history/XP, final shared snapshot and exact fixture cleanup passes. No application or cleanup error is recorded. Seeding takes 211.1 seconds.

The previous five-thread instrumented run accepted 284 first intentions; this run accepts 337. Neither meets capacity. Shared convergence is worse in this run. Different host/database conditions and the combined thread/pool partition prevent attributing that difference solely to fewer threads.

For the 237 measured personal requests that reach domain work, mean summed pool acquisition is 1,792.7 ms, occurrence-query wall time 473.5 ms, hydration 135.5 ms, domain work 97.4 ms, output validation 108.4 ms and projection 71.7 ms. These overlap parent spans and are not additive totals. During 163 later personal recoveries reaching domain work, mean acquisition is 0.02 ms and worker-request p95 is 609.0 ms. Sequential recovery is not loaded capacity acceptance.

For 128 measured shared mutation attempts, summed pool-acquisition p95 remains 4,812.5 ms versus overall worker-request p95 5,039.0 ms; owner-lock time averages 1.0 ms. Metadata pool-acquisition p95 is 4,223.7 ms versus request p95 4,351.1 ms. Percentile comparisons do not necessarily describe the same individual request. The wider pools therefore do not resolve the observed wait problem in this topology.

Median worker thread CPU rises to approximately 56.5–59.5% and event-loop utilization to 65.9–71.7%, compared with about 19–29% and 27–38% in the preceding five-thread run. Across this full capture, sampled heap-used maxima are 579.2/676.5 MiB and heap-total maxima 676.4/756.8 MiB; these are neither simultaneous totals nor retained live-set measurements. GC wall time totals about 6.4/6.7 seconds per worker in the approximate measurement window. Two workers reduce duplication but allow more concurrent profile work within each heap; these observations do not establish an overall memory improvement.

All 27 aggregate database/host samples succeed and none catches active vacuum. Host one-minute load reaches 17.35 on ten logical CPUs. VM snapshots 129.3 seconds apart show 59,947 swap-in and 95,132 swap-out pages at 16,384 bytes each; swap usage rises from 5,917.5 to 6,467.8 MiB. These global counters document substantial shared-host memory activity, not exclusive RISE causality. [Resource samples](full/resources.json), [VM context](full/memory-context.json).

## Decision and remaining local work

**Do not adopt the two-thread partition as a capacity fix.** It retains high pool waits and fails both latency and convergence. Preserve the ordinary runtime, five-connection budget, timeouts, complete validation, actor/session checks and RLS. Any further runtime experiment needs a smaller diagnostic that separates pool hold time, same-session waiting and per-request allocation cost before another full 100-account run. Existing full-run evidence is already sufficient to reject this candidate.

QUALITY-03 remains IN PROGRESS. Dense-profile feedback/durability, integrated fault coverage and representative hosted/physical acceptance remain open. A faster polling cadence still needs a separate increased-read-load check. No migration or application rollback is needed because the probe only changes isolated adapter files; removing the temporary probe leaves the current application unchanged. The user's 4173 profile was not accessed.

Commands: `node --check` on the three adapter modules; `node --import tsx /tmp/rise-bff-two-thread-probe/run.mts smoke` (exit 0); the same command with `mixed` (exit 1, correctness/cleanup pass); `python3 /tmp/rise-bff-two-thread-probe/analyze.py` (exit 0). Source/build preservation and document verification are recorded separately. Runtime is pinned Node 24.16.0 / npm 11.13.0, macOS 26.6.2 arm64, ten logical CPUs / 16 GiB RAM. No browser or device compatibility claim is made.
