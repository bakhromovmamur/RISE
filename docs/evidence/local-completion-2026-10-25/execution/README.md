# Execution proposal and controlled HTTP comparison

25 October 2026 · QUALITY-03 / NFR-03 / NFR-07. **Not adopted.** The active normal/local and frozen-release entries are restored to their original single-process implementation. The failed-release-stage cleanup fix is separate and remains implemented.

The candidate showed a low-load improvement, especially for shared requests, but did not pass the complete target. A 100-account attempt stopped before fixtures at the unchanged 12 GiB disk guard (approximately 11.77 GiB available). No capacity threshold, timeout, validation, connection budget or cleanup guard was weakened. Cloud provisioning remains pending.

| Actual loopback HTTP result | Serial reference | Worker candidate |
| --- | ---: | ---: |
| Personal accepted/planned | 8/8 | 8/8 |
| Shared accepted/planned | 4/4 | 4/4 |
| Personal scheduled p95 | 1,943.57 ms | 1,611.61 ms |
| Shared scheduled p95 | 1,424.41 ms | 80.40 ms |
| Late observations (>15 s) | 2/4 | 2/4 |
| Maximum convergence | 15,063.69 ms | 16,487.87 ms |
| Full history/XP and exact replay | PASS | PASS |
| Cleanup | PASS | PASS |
| Complete target / command exit | FAIL / 1 | FAIL / 1 |

Two accounts each had 100 habits × 730 dates; the same current app/domain source, four-round schedule, 15-second polling, actual SharedContent reader, HTTP transport/keep-alive behavior and total restricted connection budget 5 were retained. Only execution placement differed. Both verified 146,000 occurrences and 31,464,636 bytes of final readback, with no cleanup errors. This small sequential comparison does not establish full-scale capacity, memory bounds, or a statistically general latency distribution.

- [Serial report](serial-http-smoke.json), [serial log](serial-http-smoke.log).
- [Worker report](worker-http-smoke.json), [worker log](worker-http-smoke.log).
- [Candidate implementation/test patch](candidate.patch), [source hashes](source-hashes.json), [isolated reconstruction verification](archive-verification.json).
- [Focused candidate test/type/lint results](verification.json): 7 pure protocol tests and 2 real-worker database tests passed before archival.
- Measured harness snapshots: [worker driver](http-run.mts.txt), [worker HTTP adapter](http-router.mjs.txt); [serial driver](http-serial-run.mts.txt), [serial adapter](http-serial-router.mjs.txt), [serial reference entry](http-serial-main.ts.txt).

Measured commands were `node --import tsx .rise-infra/local-completion-20261025/http/run.mts mixed-smoke` and `node --import tsx .rise-infra/local-completion-20261025/http-serial/run.mts mixed-smoke`. The archived harnesses contain their measured checkout paths; they are diagnostic source snapshots, not deployment entry points. Synthetic fixtures were tracked by exact run/owner identity and removed through the unchanged fixture cleanup. No saved profile or retained release was deleted.

The portable patch was applied to a fresh isolated copy of its original four-file baseline, and every resulting candidate file matched its recorded bytes. Only after that verification were the four active files restored and the nine newly introduced candidate runtime/test/fixture files removed. The patch retains all tests, exact-route registration, cross-thread session admission, bounded input/deadline/restart behavior and release-entry changes for future review. Applying it is an explicit future code change, not an existing runtime feature. See [the full proposal and limits](../../../BFF-EXECUTION.md).

## Full100 follow-up after restored disk headroom

The isolated archived candidate completed its actual-HTTP workload with 17.51 GiB initially free. [Result](../candidate-full-summary.json): 265/400 personal and 26/200 shared first intentions accepted; scheduled p95 5,996.9/5,237.7 ms; four late/missing shared observations. All 309 exact recoveries, complete history/XP/shared readbacks and fixture cleanup passed. The active runtime was never switched. The full serial baseline used injected transport, so these full runs do not isolate the effect of threading. The failed complete capacity gate confirms the candidate remains unadopted.

Exact measured [isolated driver](candidate-full-driver.mts.txt) and [HTTP adapter/source guard](candidate-full-router.mjs.txt) preserve the diagnostic paths and command semantics; they are evidence snapshots, not deployment scripts. The source guards checked the archived candidate and current domain/harness before fixtures and before starting the candidate. No production switch, threshold relaxation, data truncation or extra BFF connection was introduced.
