# BFF execution proposal — measured, not adopted

QUALITY-03 / NFR-03 / NFR-07, 25 October 2026. **The current normal/local and frozen-release entry points retain the existing single-process BFF with its restricted five-connection pool.** The execution-thread candidate showed a low-load benefit, but both compared variants failed the complete latency/convergence gate. The initial full100 attempt stopped at the unchanged disk-headroom guard before fixture creation. After disk cleanup, the archived candidate completed a full100 run but also failed capacity; all exact recoveries and history/XP checks passed. The candidate remains unadopted. Cloud provisioning remains pending.

The [portable candidate patch](evidence/local-completion-2026-10-25/execution/candidate.patch) preserves all runtime changes and tests. It was applied to an isolated baseline and all 13 reconstructed files matched the [recorded source hashes](evidence/local-completion-2026-10-25/execution/source-hashes.json) before the original four files were restored and only the nine new candidate files were removed. [Archive verification](evidence/local-completion-2026-10-25/execution/archive-verification.json). There is no production switch or hidden runtime flag for this experiment. The release cleanup correction remains implemented independently.

## Same-workload HTTP comparison

Both runs used the same current application/domain source, two synthetic accounts with 100 habits and 730 dates each, one family, four rounds, real loopback HTTP on 4191, identical keep-alive routing, five total restricted connections, and unchanged guards, limits and thresholds. Setup used the existing isolated injected harness; it closed its runtime pool before starting either measured server. Both final readbacks verified all 146,000 original occurrences, XP and 31,464,636 response bytes. Exact replay, shared readback and fixture cleanup passed with no cleanup errors.

| Metric | Current serial reference | Archived worker candidate |
| --- | ---: | ---: |
| Personal first intentions accepted | 8/8 | 8/8 |
| Shared first intentions accepted | 4/4 | 4/4 |
| Personal scheduled p95 | 1,943.57 ms | 1,611.61 ms |
| Shared scheduled p95 | 1,424.41 ms | 80.40 ms |
| Shared observations later than 15 seconds | 2/4 | 2/4 |
| Maximum observed convergence | 15,063.69 ms | 16,487.87 ms |
| Complete target verdict | FAIL | FAIL |

[Serial report](evidence/local-completion-2026-10-25/execution/serial-http-smoke.json), [worker report](evidence/local-completion-2026-10-25/execution/worker-http-smoke.json), [comparison and measured harnesses](evidence/local-completion-2026-10-25/execution/README.md). The observed worker improvement is real in these samples; this is not evidence of a low-load regression. One run per variant with eight personal/four shared samples does not establish sustained 100-account capacity or general latency distributions. The guarded full100 attempt had approximately 11.77 GiB free against the unchanged 12 GiB requirement. No saved data, retained release or unrelated temporary file was deleted to bypass that guard.

The later [full100 HTTP result](evidence/local-completion-2026-10-25/candidate-full-summary.json) accepted 265/400 personal and 26/200 shared first intentions, with scheduled p95 5,996.9/5,237.7 ms and four late/missing observations. All 309 exact recoveries, full histories/XP, shared readback and cleanup passed. It remains a failed capacity gate. The earlier full serial baseline used injected transport; those full runs cannot isolate threading causality.

Future adoption requires complete representative HTTP capacity and release/rollback evidence, sufficient host headroom, and review of the additional concurrency lifecycle. QUALITY-03 remains open. The sections below describe the **archived candidate**, not active runtime behavior.

## Archived execution and authority

`createExecutionApp` owns one HTTP/static listener and five Node execution threads. Each thread initializes the existing `createApp`, `Sessions` and a restricted database pool with **one** connection. The coordinator has no database pool: the total budget is **five per running BFF instance**, retaining the existing connection, query and statement timeouts. These threads are request executors, not the separate scheduled-push or deletion workers.

The complete database read, runtime validation, domain reduction, projection, owner/session RLS, revision, cancellation and immutable receipt transaction stay inside a thread. Database reconstruction and domain processing stay inside the thread instead of handing a reconstructed state to a separate CPU task. Ordinary request/response envelopes cross the coordinator, including complete personal-read/export response bodies and their buffer copies. No partial-state reducer, XP approximation, history truncation, schema migration or authorization cache is introduced. Direct `createApp` remains available to existing integration tests.

Threads receive only the validated BFF configuration, with dedicated backing arrays for its encryption keys. They inherit no environment variables. Their stdout/stderr are not forwarded; generic unavailable responses and parent-side coarse metrics expose no credentials, body, URL query or provider error. The runtime source fingerprint includes the `.mjs` loader, and the existing sealed-package server allowlist includes the complete executor.

## Routing and bounds

The coordinator selects the ready thread with the fewest outstanding jobs, breaking ties by previous dispatch count. Requests overlap while awaiting I/O; there is no one-request-at-a-time FIFO for each thread. All threads must be ready before normal admission.

The existing session-cookie parser selects only a valid unique opaque session cookie. A digest enters the same `SessionAdmission` policy **before dispatch**, preserving the global 256-operation, 16-per-session and 3,000 ms wait limits across threads. A digest is a scheduling key, never an authenticated actor. The worker still verifies the current session, provider/account state, Origin/CSRF and database authorization.

The coordinator admits at most 256 request envelopes and retains at most **32 MiB of admitted input bytes**, including body, URL and headers. This is not a process-memory bound: ingress parsing, decoded objects, database histories, response buffers/clones and slow-client socket queues are separate. No new response-size cap truncates legitimate history or export. Full-size output and actual HTTP capacity require their own measurements; hostile slow-client memory behavior is not certified by the focused tests.

Every worker reports the API route/method/body-limit descriptors from its real Fastify route registrations. All five manifests must agree. The listener installs those same limits before collecting raw bytes: ordinary commands retain 64 KiB, authentication retains 2 KiB, and existing sync review/batch/import-page limits remain 256/512 KiB. The worker repeats its normal JSON/poison-key and route validation. HEAD routes are registered once. Actual socket IP is forwarded; client forwarding headers cannot select the rate-limit address. Response status, headers, repeated Set-Cookie values and binary bytes are preserved.

The 15-second execution deadline includes session-admission time. A response observed after its deadline cannot defeat an overdue timer. This does not increase the underlying 2-second SQL or 3-second query/connection timeout. Overflow, expiry or executor loss returns retryable unavailability; it never manufactures a successful save.

## Failure, readiness and shutdown

Startup verifies the fixed installation, restricted role and provider health in every thread before listening. `/api/v1/health/ready` actively repeats database/provider verification through all five threads; it is not merely an alive-thread flag. Concurrent readiness checks share one verification request set.

A failed or overdue thread is fenced and terminated before replacement, preventing an old thread from answering a newer request or overlapping its replacement connection. Its outstanding requests fail without automatic replay. At most three replacements per slot within 60 seconds are attempted; failed replacement startup or an exhausted budget leaves readiness unavailable until process restart. This is a bounded local failure mechanism, not a hosted process supervisor.

A worker may die after a transaction committed and before its response arrived. The client must retry the **same operation ID and body** through the existing exact-receipt path. A changed retry remains a conflict. A lost response is not proof that a command failed to commit. No worker queues or private bodies are persisted.

Shutdown stops admission, drains already-dispatched work for at most 15 seconds, closes worker apps/pools and then terminates any remaining threads. Waiting session work is rejected rather than newly dispatched during shutdown. The parent records one end-to-end metric per HTTP response using its actual API area and the trusted worker response request ID; it does not double-count worker request logs.

The existing local release supervisor retains its shorter 10-second child-stop escalation. It can therefore force process termination before the standalone drain budget expires. Preserve pending operations and recover uncertain outcomes with exact retries; a forced stop is not a graceful-drain claim. Neither deadline has been increased to pass a capacity check.

## Local rollout and rollback

The candidate changed the normal, browser-compatible local and frozen-release entry points to use the same coordinator; those entry changes are now restored to their originals. The experiment changed no ports, installation identity, cookie names, APIs, personal records, cache formats or release compatibility contracts. Existing rollback still requires an identical migration/compatibility set and preserves pending immutable operations.

The release supervisor's candidate preflight can coexist briefly with the serving process. Each has its own five-connection budget, so this interval can use up to ten restricted connections. Preflight shutdown must complete before the replacement serving runtime begins. This preserves the existing rule that a failed preflight leaves the current release running; it is not a zero-downtime or single-global-pool deployment claim.

## Focused evidence

`node --import tsx --test tests/execution.test.ts`: **7/7 pass**. Real thread protocol checks cover overlapping routing, same-session serialization, raw bytes/IP/cookies/binary, count/byte admission, deadline/crash/startup/readiness failure, bounded restart cycles, draining close, ingress limits, metric correlation and the bootstrap fingerprint.

`node --import tsx --test tests/infra/execution.test.ts`: **2/2 pass**, on the fixed test installation. Real BFF/Auth/database tests cover per-route ingress limits, wrong-installation startup, unauthorized/Origin denial, process loss before handler dispatch with unchanged revision/receipt, process loss after an actual commit, verified replacement, exact replay and changed-retry rejection, no duplicated receipts, at most five restricted connections and none after close. Only synthetic accounts are created and removed. The process-fault peer lives under `tests/support/` and is excluded from release packages.

Server TypeScript and focused Oxlint checks passed for the candidate. [Verification record](evidence/local-completion-2026-10-25/execution/verification.json). The named candidate tests are now in the patch, not the active test tree. These focused checks do not replace the complete application, operations, rollout and real-HTTP capacity gates.
