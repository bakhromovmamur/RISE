# BFF execution-thread discovery

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · synthetic fixed-test installation.

**More first attempts succeed, but latency and convergence still fail. No production threading architecture is adopted.** This experiment ran before the occurrence-column optimization in increment 9, on the same application source as increment 8.

## Controlled change and limits

The [reviewed mixed workload](../increment-08/README.md) is unchanged: 100 dense accounts, 50 joined families, four rounds of 400 personal/200 shared intentions, 15-second foreground metadata refresh and the actual `SharedContent` reader. Only the execution adapter differs. Five Node worker threads each load the real BFF app, sessions and restricted runtime configuration from the fixed test installation. Each verifies its runtime role/environment and owns one database connection. The parent's original BFF pool closes before measured requests; the total BFF connection budget remains five. The parent retains administrator access only for fixture setup/cleanup. No administrator configuration is sent to a worker.

A test-only router sends request options to the least-pending thread, using prior request count to break ties. Full database histories stay inside each BFF thread; only ordinary request/response envelopes cross the router. Tokens/cookies stay in memory and are absent from reports. Actor verification, session rechecks, RLS, owner/group locks, audit clock, data/revision/cancellation/receipt transaction, statement/query/acquisition timeouts and exact operation bodies are unchanged.

This is Fastify injection, not HTTP load balancing, a supervised process deployment or a production worker lifecycle. It has no production queue bound, worker replacement or crash-recovery contract. Small request routing is more favorable than full-history transfer, but this does not establish hosted acceptance or justify changing the production entry point.

## Full mixed results

| First measurement | Single-thread baseline | Five BFF threads |
| --- | ---: | ---: |
| Personal accepted / planned | 249 / 400 | 388 / 400 |
| Shared accepted / planned | 110 / 200 | 194 / 200 |
| HTTP 503 | 65 | 16 |
| Deferred intentions | 176 | 2 |
| Accepted personal scheduled p95 | 5,348.9 ms | 4,513.9 ms |
| Accepted shared scheduled p95 | 4,936.7 ms | 3,872.0 ms |
| Maximum scheduling lateness | 673.9 ms | 7.5 ms |

All 18 failed/deferred intentions recover exactly (12 personal, six shared), all receipts replay, every personal history/XP matches, both members' final shared snapshots match, and cleanup passes. The run exits 1 for failed capacity/convergence. Of 194 accepted shared updates, 188 are observed: 25 exceed 15 seconds and six remain unobserved, giving 31 late/missing. Observed-only p95 is 16,610.1 ms, maximum 23,146.1 ms. Missing updates are not excluded from the verdict.

Read results remain in [the full report](mixed.json): group metadata 1,069 successes/35 HTTP 503; tasks 477 successes/two changed-head 409/10 HTTP 503; occurrences 472 successes/three changed-head 409/14 HTTP 503. The real reader handles those failures and invalidations. Seeding takes 176.6 seconds outside measurement. Net reused-database growth of 1,822,507,008 bytes is not a controlled footprint measurement. [Progress log](mixed.log).

The host has 16 GiB RAM and 10 logical CPUs. A single in-run process observation showed 418.9% recent CPU and 1,502,064 KiB RSS; this is not a controlled resource percentile. More parallel execution consumes more cores. Environment remains macOS 26.6.2 arm64, Node 24.16.0, PostgreSQL 17.11. No browser/device claim is added.

## Checks and findings

- `node --import tsx /tmp/rise-bff-thread-probe/run.mts smoke`: exit 0, full/Undo and replay/readback/cleanup pass; accepted maximum 731.6 ms. [Report](smoke.json), [log](smoke.log).
- The same command with `mixed-smoke`: exit 1 for convergence. All eight personal/four shared intentions succeed; personal/shared scheduled maxima 774.3/80.5 ms. Two of four observations exceed 15 seconds, maximum 15,645.3 ms. Readback/replay/cleanup pass. [Report](mixed-smoke.json), [log](mixed-smoke.log).
- The same command with `mixed`: exit 1 for capacity/convergence; complete results above. All worker threads terminate after the run.

Execution parallelism reduces scheduling stalls and improves acceptance but does not solve the whole-profile cost. A 15-second polling interval also leaves no network/content-read headroom for a 15-second convergence target; changing cadence needs load verification, not just a smaller constant. This experiment changes neither the app's cadence nor its runtime. The next measured candidate is direct occurrence-column projection, which avoids constructing and parsing a whole JSON object for each row while retaining JSON civil dates.

[Probe source](run.mts), [router](router.mjs), [worker](worker.mjs) and [measured source hashes](source-hashes.json) preserve the experiment. The workload source differs only in absolute imports, the router import and adapter installation after seeding. Existing private manifests still track exact generated accounts/groups for cleanup. All three reports have empty cleanup errors and `cleaned: true`; no saved browser profile or unrelated installation was touched. Cloud provisioning remains pending; QUALITY-03 remains IN PROGRESS.
