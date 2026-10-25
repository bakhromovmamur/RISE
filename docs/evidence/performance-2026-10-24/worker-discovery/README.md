# Pure account worker experiment

24 October 2026 · QUALITY-03 / NFR-03 · diagnostic only; no application change.

The mixed workload fails capacity and shared convergence. The previous command CPU profile identifies substantial hydration, reduction, validation and projection work on the BFF request thread. This experiment tests whether moving that pure portion into a Node worker helps before changing transaction code.

Ranked predictions: CPU isolation should shorten request-thread stalls; full-history copying may erase latency gains; SQL read/parse/write costs may remain limiting even if pure work improves. Only the first two are tested here. Database work is deliberately outside this experiment.

## Method and results

Run from the repository root with `node /tmp/rise-worker-probe/run.mjs`. The three [probe files](run.mjs) load the existing installed `tsx` runtime and real `hydrate`, `applyDomainCommand`, `validateState`, `project` and `xpTotal` functions. The synthetic profile has 100 habits and 730 dates. Its 73,000 occurrence records serialize to 14,334,141 bytes. Each calculation performs a full check, retaining input validation and output validation. Every complete result is compared with the inline reference, XP is 1,314,010, and the original records remain byte-identical. There is no database, private account, network or provider access.

Two workers start in 110.7 ms; startup and one warm-up per variant are excluded from recorded samples. Three rounds alternate variant order and measure one or five concurrent jobs. Five inline jobs execute sequentially on the request thread. Worker variants copy records/results through structured cloning or explicit JSON text; two-worker mode distributes five jobs 3/2. A 10 ms main-thread timer measures maximum observed callback gap. The timer is diagnostic, not UI feedback or server latency. Full-result comparisons occur after timing.

| Jobs | Transport | Workers | Median batch elapsed | Median maximum timer gap |
| --- | --- | ---: | ---: | ---: |
| 1 | inline | 0 | 165.2 ms | 175.3 ms |
| 1 | clone | 1 | 297.8 ms | 40.9 ms |
| 1 | json | 1 | 259.5 ms | 34.7 ms |
| 1 | clone | 2 | 293.3 ms | 45.5 ms |
| 5 | inline | 0 | 871.8 ms | 883.2 ms |
| 5 | clone | 1 | 1315.0 ms | 130.9 ms |
| 5 | json | 1 | 1126.5 ms | 113.6 ms |
| 5 | clone | 2 | 850.1 ms | 135.9 ms |

[All samples](results.json), [progress](progress.log), [pure computation](compute.mjs), [worker](worker.mjs). Process exit 0: all result/input assertions pass. Three samples are discovery, not reliable p95 acceptance. macOS 26.6.2 arm64, Node 24.16.0; no new browser compatibility claim.

Workers shorten main-thread stalls but increase single-job latency substantially. Two workers barely improve the five-job batch. **Do not adopt whole-history pure-worker transfer on this evidence.** The current server remains unchanged. The probe omits SQL decoding, delta comparison/writes, authorization/causal checks, cancellation, receipts and transaction locks. It also implements no production worker restart, bounded queue or failure contract. Its output is not an implementation of the account command API.

A useful next experiment must avoid unnecessary full-history round trips and still preserve verified actor/session authorization, database-clock audit time, current owner locks, immutable receipt identity and atomic data/revision/cancellation/receipt commit. No production module or process architecture is selected here. Cloud provisioning remains pending.

[Source hashes](source-hashes.json) identify the actual pure functions and measured server build. [Preservation](preservation.json) verifies the preceding mixed-load evidence and unchanged application/build files. Temporary workers terminated after the experiment; the 4173 profile was not accessed.

`npm run check:docs` passes ([log](docs-check.log)); all local evidence links were also checked.
