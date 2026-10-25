# Increment 12 — Bounded session admission before database acquisition

24 October 2026 · QUALITY-03 / NFR-03/NFR-07 · SEC-01/SEC-02 preservation · local/test only. Cloud provisioning remains pending.

## Problem and implemented behavior

A dense personal command holds its verified session row while reducing and persisting the profile. Concurrent metadata requests for that session previously acquired other restricted connections before waiting on the same row. Those waits could exhaust the five-connection pool and delay an unrelated authorized account. The [prior partition experiment](../bff-pool-partition-discovery/README.md) did not solve the pool waits.

`server/auth/admission.ts` now owns a bounded FIFO for each session digest. `Sessions.read` and `Sessions.asActor` enter it before their database work. At most 256 operations may run/wait in one instance and 16 for one session, including the active operation. A queued operation has a 3,000 ms deadline, checked both by a timer and at admission. A full/expired wait returns the existing retryable `503 unavailable`; expired work never runs later. Errors release the lane, and unrelated sessions can proceed independently.

The opaque-cookie digest is a scheduling key, not an actor or authorization cache. The queued callback performs the original provider/account/session checks after admission. Actor transactions retain CSRF, row locks, transaction-local claims, savepoint rollback, final authorization and exact receipts. Different sessions/instances still rely on database locks and forced RLS. Logout and terminal deletion retain their existing database paths. Pending request context remains in process memory; no credentials, keys, private payloads or scheduling entries are added to logs, exports or persistent caches. Request/database limits remain unchanged; the admission wait is a separate bounded phase. [Exact contract and recovery](../../../AUTH-SESSIONS.md#bounded-session-admission), [implementation diff](implementation.patch).

No pool-budget, runtime topology, schema, policy, dependency, browser-storage or UI change is made. The ordinary entry remains a single BFF with five restricted connections. Process restart drops unstarted waits; clients retry the same captured IDs/bodies. Once admitted, existing transaction/receipt recovery applies, including lost replies. Rollback requires no migration or data conversion.

## Smaller real-HTTP diagnostic

The diagnostic seeds two synthetic accounts with 100 habits and 730 dates each, then runs four alternating-order rounds of two scenarios. Each scenario performs full and Undo commands on the first account. After 25 ms, twelve metadata reads are launched: either six for the busy session plus six for the other account, or all twelve for the other account. It verifies every mutation/replay, all 192 read identities/empty group projections, and complete original history/XP for both accounts before exact fixture cleanup.

Three runs use the same one-thread/five-connection HTTP adapter and passive phase instrumentation: original sessions, an isolated request-hook admission counterfactual, and the actual bounded session implementation. Each exits 0 and captures all **228** unique gateway/worker requests without drops. The hook-only counterfactual is not application code and lacks the production queue's deadline/capacity contract.

| Scenario / measurement | Original | Hook counterfactual | Bounded implementation |
| --- | ---: | ---: | ---: |
| Busy-session plus other-account reads: other-account median | 425.4 ms | 35.0 ms | 34.7 ms |
| Same case: other-account p95 | 679.3 ms | 119.5 ms | 341.0 ms |
| Same case: mutation median | 415.8 ms | 429.4 ms | 413.6 ms |
| Other-account reads only: read median | 352.3 ms | 127.7 ms | 131.4 ms |
| Other-account reads only: read p95 | 393.3 ms | 411.7 ms | 395.0 ms |

In the mixed-session case, metadata mean summed pool-acquisition time falls from 285.0 to 0.2 ms and session-row lock wall time from 143.5 to 1.1 ms. Work now waits before pool acquisition instead. Dense-command duration and the tail of the other-only case remain substantial; this is not a general CPU or capacity solution. Parent/query spans overlap, and query wall time includes driver/event-loop delay. These small sequential runs on a shared host do not establish statistical production latency, hosted capacity, browser paint or physical-device acceptance.

[Comparison and capture validation](diagnostic/comparison.json), [analysis](diagnostic/analyze.py), [baseline](diagnostic/baseline/report.json), [counterfactual](diagnostic/counterfactual/report.json), [actual implementation](diagnostic/implementation/report.json). The test-only gateway still lacks production trusted peer/IP forwarding and complete supervision; login/seeding is injected setup and cannot certify authentication quotas.

Reproduction: copy the archived driver/router/gateway/worker to `/tmp/rise-bff-session-wait-probe`, then run `python3 <this-folder>/diagnostic/prepare-source.py baseline|counterfactual|implementation` from the repository root with a fresh isolated source directory. It checks the recorded application hashes and refuses to overwrite a source copy. Run `node --import tsx /tmp/rise-bff-session-wait-probe/run.mts`. Preserve each run before preparing another mode. The implementation preparation was independently regenerated and matches all 192 recorded instrumented source files. The [passive instrumentation diff](diagnostic/instrumentation.patch) and [source hashes](diagnostic/instrumented-source-hashes.json) identify the measured code.

## Correctness and regression evidence

The new real-database regression holds one verified actor operation, starts same-session metadata/actor waiters, and requires a different authorized account to finish before releasing the first. It fails against the original session class with a database statement timeout and passes with bounded admission. A second database test revokes the provider session while actor work waits; neither queued work nor the previously active callback may retain authorization. Four module tests cover FIFO/independent sessions, global/per-session limits, failure release, timed expiry and an overdue timer whose callback has not yet run.

- `npm run check`: 294 source/tooling tests pass; lint/types and both builds pass. All 52 frontend build files remain byte-identical to increment 11.
- `node --import tsx --test --test-concurrency=1 tests/infra/auth.test.ts tests/infra/personal.test.ts`: 24 real database cases pass.
- Original-class regression: one expected failure, retained in [the red run](validation/red-regression.log); no application source was reverted for this check.
- Initial `npm run test:infra`: 168/169 pass. The sequential 100,000-invitation ownership-transfer case returns 503. Its focused recheck passes.
- Complete database recheck with a temporary fixed-query timing hook: 169/169 pass. The large invitation transfer statement takes 1,494.7 ms against the unchanged 2,000 ms statement limit. No queue/SQL/fixture/time-limit change is made between these runs. The original 503's exact cause was not captured; it is retained as a timing-sensitive unresolved observation, not silently relabeled as a queue failure or removed from evidence. The hook records only a fixed operation category, elapsed time and success/timeout/failure, never arguments or identities. [Initial run](validation/infra.log), [focused recheck](validation/invitations-recheck.log), [complete recheck](validation/infra-recheck.log), [hook](validation/sql-timing.mjs).
- `npm run test:auth`: 21 Chromium/WebKit/Firefox cases pass with no retries/flakes. Real codes/cookies are excluded from traces, video and screenshots. [Report](validation/auth-browser-report.json).
- `npm run test:sync`: 69 Chromium/WebKit/Firefox cases pass with no retries/flakes, covering real account sync, offline reload/reconnect, exact lost-response retry, identity switching, cache failure, deletion and stale/legacy recovery. [Report](validation/sync-browser-report.json).

Supabase's [session documentation](https://supabase.com/docs/guides/auth/sessions), [changelog](https://supabase.com/changelog) and [TLS deprecation note](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) were checked on 24 October 2026. Current session authorization still checks the linked provider session; no provider API, TLS configuration, database release or schema change is introduced.

## Normal-server capacity result

`node --import tsx scripts/infra/check-account-load.ts smoke` exits 0: both first intentions succeed, with maximum/p95 561.6 ms; exact replay, full history/XP and cleanup pass. The full `mixed` command exits 1 after verified recovery and cleanup. It uses the unchanged normal single-process Fastify-inject adapter and five restricted connections, without diagnostic phase hooks or the HTTP gateway.

The required 100 synthetic accounts each hold 100 habits and 730 dates, with 50 families. Only **130/600** first intentions succeed (120 personal, 10 shared); 124 return 503 and 346 are deferred by the workload's pending-intent rules. Accepted personal/shared scheduled p95 is **9,359.1/6,121.3 ms**. Eight of ten accepted shared changes are observed during measurement, with five late and two missing. All **470** failed/deferred intentions then recover with the original operation IDs/bodies. Every exact receipt, complete history/XP and final shared readback passes, as does exact fixture cleanup.

This is worse observed acceptance and latency than the preceding normal run, so the session fix is not accepted as a capacity improvement. Heavy host-wide swapping is observed, but the runs do not isolate its contribution or prove that admission caused the difference. The narrower verified outcome is preventing same-session row-lock waiters from occupying the entire pool; dense-command service time and saturated concurrent work remain unresolved. No timeout, connection budget, security check or capacity target is relaxed.

[Full report](validation/mixed.json), [summary](validation/mixed-summary.json), [progress log](validation/mixed.log), [smoke](validation/smoke.json). VM/swap snapshots in `validation/` are machine-wide context, not process attribution; the after snapshot was taken after cleanup and after the next smaller probe began. QUALITY-03 stays IN PROGRESS. Hosted capacity, physical-device latency, runtime supervision and the other release gates remain pending.

## Concurrent dense-command follow-up

A second isolated diagnostic seeds five dense accounts and runs eight waves, each with five concurrent full/Undo commands followed 25 ms later by ten metadata reads. Successful commands are replayed exactly; complete history/XP is checked after the final Undo. The original session class and bounded implementation each complete 40/40 mutations, all exact replays, full history/XP readback and cleanup, with 170 matching gateway/worker records and no capture drops. The original completes 80/80 metadata reads; bounded admission completes 70/80, returning retryable 503 for ten reads behind a command lasting beyond the 3,000 ms wait. This is a visible overload limit, not a successful metadata result.

Original/implemented command median is 1,956.4/1,900.5 ms and p95 2,897.5/3,272.6 ms. The dense command's median record-read span is 1,196.0/1,085.4 ms; these asynchronous spans include driver and event-loop contention. Hydration, domain reduction, validation and projection each consume material synchronous time. The experiment does not establish a latency win.

A repeat of the original class then aborts after four completed waves when an exact retry returns 503. All 106 gateway/worker records match without drops, and exact fixture cleanup passes, but full history/XP and replay verification are **not completed for this aborted repeat**. This observed baseline instability limits comparative conclusions; it does not excuse the failed capacity gate. All results are retained. No further full load rerun is justified until a focused per-command allocation/CPU change has evidence.

[Comparison](concurrent-diagnostic/comparison.json), [baseline](concurrent-diagnostic/baseline/report.json), [implementation](concurrent-diagnostic/implementation/report.json), [aborted repeat](concurrent-diagnostic/baseline-repeat/summary.json), [analysis](concurrent-diagnostic/analyze.py). Reproduce by copying the archived driver/router/gateway/worker and preparation script to `/tmp/rise-bff-concurrent-session-probe`, preparing a fresh `source` with the sibling `diagnostic/prepare-source.py` logic using that stage path, then running `node --import tsx /tmp/rise-bff-concurrent-session-probe/run.mts`. The archived `concurrent-diagnostic/prepare-source.py` already selects that stage path and locates the original instrumentation beside it in this evidence folder; run it in place. Preserve run outputs before another mode. The same gateway/authentication-quota limitations apply.

## Environment and decision

macOS 26.6.2; Node 24.16.0; npm 11.13.0; the fixed local test Auth/Postgres installation. Browser regression versions are Chromium 156.0.8078.4 (revision 1248), Firefox 157.0 (1555) and WebKit 27.2 (2370), as recorded in [the installed browser manifest](validation/browser-versions.json).

Retain bounded session admission for its demonstrated isolation and bounded resource behavior, with current authorization preserved. It remains subject to the open capacity gate and is not a release verdict. The four application/test changes are limited to the admission module, session integration and outcome-based regressions. The seven document updates record actual behavior and failed/limited evidence. Original source plus the exact patch permits a source rollback without any data migration; pending in-memory waits are retryable after restart. UI/build output, stored formats, guest data, other owners and the saved preview remain unchanged. Cloud and physical-device acceptance remain pending.

[Command results](verification.json), [preservation checks](preservation.json), [document changes](documentation.patch), [runtime/workload hashes](source-hashes.json), [frontend hashes](build-hashes.json). The evidence manifest records the archived files independently of future work.
