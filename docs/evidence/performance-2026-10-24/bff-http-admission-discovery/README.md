# HTTP request distribution and admission discovery

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · fixed test installation only.

**The least-pending HTTP gateway accepts every first intention and preserves all data, but fails the latency/convergence gate.** This diagnostic does not change the application runtime. Cloud provisioning remains pending.

## Workload and boundaries

The current increment-11 application and unchanged mixed diagnostic exercise 100 synthetic accounts, each with 100 habits and 730 dates, 50 joined families, 400 personal and 200 shared intentions, and the actual shared reader at its 15-second metadata cadence. Login/seeding use the existing injected setup. All measured API requests, exact receipt replays and final readbacks use real HTTP at **127.0.0.1:4191**, with one keep-alive client agent per synthetic browser. Each worker loads the actual BFF and verifies the fixed-test restricted role, installation and provider.

The gateway routes individual HTTP requests over private Unix sockets to five BFF execution threads. Each owns one database connection; the original parent BFF pool closes before routing starts. The total remains five. Host/Origin, session/CSRF, forced owner/session RLS, transactional owner/group locks, cancellation and immutable receipts remain active. The private temporary socket directory has mode 0700 and is removed after shutdown. Test fixtures use the existing exact-owner manifest and cleanup guards. The public listener, all workers and their pools close before terminal completion. The user's port-4173 profile is untouched.

This diagnostic gateway does **not** forward physical client IP to its Unix-socket backends. Login/seed occurs before the adapter switch, so this run does not certify authentication IP quotas. It is not a production gateway: trusted peer transport, complete hop-by-hop/header/body handling, deadlines, admission under overload, worker failure, shutdown and restart need explicit acceptance. No broad proxy trust, privileged runtime credential, timeout relaxation or database policy change is introduced.

## Least-pending request routing

Each incoming request is assigned to the worker with the fewest pending requests; request count breaks ties. This changes the routing granularity from the earlier connection-based cluster. It still allows multiple active requests per worker. Requests rejected at the 256-pending bound would remain failures; none reaches it in this run.

| Metric | Result |
| --- | ---: |
| Personal / shared first intentions accepted | 400/400 · 200/200 |
| HTTP failures / deferred intentions | 0 · 0 |
| Personal / shared scheduled p95 | 1,637.4 / 1,204.6 ms |
| Shared updates observed | 200/200 |
| Observed after 15 seconds / missing | 1 · 0 |
| Observed convergence p95 / maximum | 14,072.3 / 15,424.3 ms |
| Maximum concurrent gateway requests | 27 |
| Maximum active requests on an individual worker | 6 |
| Exact receipts, complete history/XP, shared snapshots | PASS |
| Exact fixture cleanup | PASS |
| Local mixed gate | FAIL |

All 1,107 metadata reads, 500 task reads and 500 occurrence reads succeed. The four personal rounds have request p95 835.5, 818.1, 2,018.5 and 1,745.3 ms. This late-run increase is observed; it does not establish its cause. One shared observation exceeds the unchanged 15-second bound by 424.3 ms. No failed or deferred intention needs recovery, and all accepted receipts still undergo exact replay. The full 100-account readback compares every original record and XP.

[Raw report](balanced/mixed.json), [phase log](balanced/mixed.log), [aggregate routing counts](balanced/stats.json) and [compact summary](balanced/summary.json) retain every sample and failure. The smoke run exits 0 and the full run exits 1. The full run takes 177.5 seconds to seed. Database growth on the reused installation is not a controlled footprint measurement.

## Controlled admission follow-up

A second test-only gateway keeps the same five BFF threads, real HTTP/private-socket transport and connection budget, while admitting only one active request per worker and retaining a bounded FIFO queue. This isolates a scheduling choice; it does not weaken the API, omit requests, expand timeouts or reduce the history. **The full run fails and has substantially worse timing.** All 400 personal and 200 shared first intentions succeed, with no HTTP failure or deferred intention. Personal/shared scheduled p95 is **7,123.1 / 6,627.9 ms**. All 200 shared updates are observed, but **26 exceed 15 seconds**; observed convergence p95 is 18,478.4 ms and the maximum is 22,079.9 ms. All exact receipts, complete original personal histories/XP, both members’ final shared snapshots and exact fixture cleanup pass. Terminal exit is 1 for the timing gate, with no root/cleanup error.

The queue reaches 138 waiting requests, 143 total pending, and exactly one active request per worker; no admission is rejected. These aggregate maxima cover all requests after seeding, including recovery/readback/logout. Successful metadata/task/occurrence reads number 1,109/499/499, with one changed-head 409 per content collection and no 503. Seeding takes 174.3 seconds. The smoke run accepts both first intentions and has maximum latency 483.9 ms, with full history/replay/cleanup passing.

[Raw report](serial/mixed.json), [log](serial/mixed.log), [routing counts](serial/stats.json), [summary](serial/summary.json) and [the exact admission-only gateway diff](admission-changes.patch) preserve the comparison. The worker and HTTP-client behavior are otherwise unchanged; driver/client description text identifies the routing variant. These are single local runs, not a repeatability distribution. The observed regression is sufficient to reject adopting this one-active-request rule; it does not by itself identify the dominant request phase.

## Decision and next check

Neither experiment justifies a production entry-point change. Per-request routing is more promising than the earlier connection-affinity experiments, but the current least-pending variant still misses the gate. Serial admission removes request overlap within each worker and produces a worse queue in this run. Do not infer that simply expanding the pool, relaxing timeouts or excluding queued latency would solve the requirement.

The next diagnostic should separate gateway waiting, worker request time, restricted-pool acquisition/query time, domain CPU work and response transport using bounded aggregate timings without private content. It should also retain database/host resource context before attributing variation between separate runs. Do this before another full routing experiment. A 15-second polling interval also leaves insufficient general headroom for a 15-second end-to-end bound; a shorter foreground cadence needs an explicit higher-read-load check, not a relaxed convergence threshold.

QUALITY-03 remains IN PROGRESS. Trusted peer/IP handling, overload/deadlines, worker failure/restart, shutdown, lost replies, real-runtime adoption, dense local feedback/commit timing, hosted workload and physical-device gates remain open.

## Source and preservation

The archived drivers retain fixed-test/disk/advisory-lock guards and exact-owner crash recovery. They use absolute imports to this reviewed checkout and are not deployment scripts. [Runtime/workload hashes](source-hashes.json) cover the 52 unchanged source files. The current frontend remains increment 11; schema, policies, dependencies, CSS, assets, visual references and saved profiles are unchanged.

The official Node [HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html) and [worker-thread](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) documentation was checked on 24 October 2026; those pages describe 24.22.1. Execution remains on pinned Node 24.16.0 / npm 11.13.0, macOS 26.6.2 arm64, with 10 logical CPUs and 16 GiB RAM. This is local API/client-state evidence, not browser paint, mobile, hosted or production-runtime acceptance.

[Verification commands](verification.json), [preservation checks](preservation.json) and [document checks](docs.log) record the final diagnostic scope. No full application regression rerun is claimed for these source-unchanged experiments.
