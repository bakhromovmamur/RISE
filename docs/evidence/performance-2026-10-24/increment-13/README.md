# Increment 13 — Lower-allocation account projection

24 October 2026 · QUALITY-03 / NFR-02/NFR-03/NFR-07 · local/test only. Cloud provisioning remains pending.

## Change

The fixed-field account projection previously created filter/map/pair arrays for every projected object, including every dated habit occurrence. Its private `pick` helper now copies the same own, defined, allowlisted fields directly into a row. Explicit false, zero and empty text remain; inherited/undefined/device-only fields remain excluded. Table structure, order, canonical encoding, validation, timestamps, IDs and transaction behavior are unchanged. No new cache, schema, data format or user interface is introduced. The complete original source and small patch support rollback without migration.

The preceding [concurrent command diagnostic](../increment-12/README.md#concurrent-dense-command-follow-up) found material projection CPU time, alongside larger record-read and other domain costs. This increment addresses only projection; it is not a proposed solution to every observed latency failure.

## Isolated experiment

The synthetic 100-habit/730-date profile projects to exactly the same rows in both implementations. Twelve alternating-order rounds compare old and candidate code, with the first two treated as warmup and an explicit GC before each sample. In the first experiment’s ten retained rounds, median wall time is 30.2 → 13.0 ms and sampled process CPU time is 40.9 → 17.8 ms. Immediate heap-used delta is about 20.7 → 15.2 MB. That heap delta is not a retained-memory or total-allocation measurement; GC and runtime state affect it.

An independent repeat using archived old/new modules confirms median wall time of 30.7 → 13.7 ms and CPU time of 41.7 → 18.3 ms. [Both comparisons](projection/comparison.json), [first samples](projection/initial-report.json), [repeat samples](projection/report.json).

This pure projection test has no database, network or browser paint. It does not establish online mutation p95, shared convergence or hosted/device capacity. [Raw samples](projection/report.json), [driver](projection/run.mts), [old projection module](projection/baseline.ts), [candidate module](projection/candidate.ts), [application/test patch](implementation.patch).

## Verification

The existing public round-trip tests retain all 73,000 historical snapshots, XP, prayer reports, priorities and source rows. A focused projection boundary test additionally checks false/zero/empty values, undefined and inherited omission, device-only privacy exclusions and no input mutation. `npm run check` passes 295 source/tooling tests, lint/type checks and production/review builds. The focused real-database command passes all 39 cases:

```sh
node --import tsx --test --test-concurrency=1 tests/infra/personal.test.ts tests/infra/sync.test.ts tests/infra/recovery.test.ts tests/infra/shared-priorities.test.ts tests/infra/push-cancellation.test.ts
```

These cover exact replay, import/rollback, offline batches, conflict/recovery, correction, owner/session/RLS denial, shared references and cancellation. `npm run test:sync` passes all 69 Chromium/WebKit/Firefox cases with zero retries/flakes, including consented import, cross-device XP, offline reload, exact lost-response replay, identity switching, deletion and stale/legacy recovery. [Browser report](validation/sync-browser-report.json), [database log](validation/database.log), [check log](validation/check.log).

Environment: macOS 26.6.2, Node 24.16.0, npm 11.13.0; fixed local test Auth/Postgres. Browser versions: Chromium 156.0.8078.4 (1248), Firefox 157.0 (1555), WebKit 27.2 (2370). Both CSS outputs are byte-identical to increment 12; no screen, design, golden image, storage format, schema, dependency or policy changes. The saved preview on 4173 was not accessed.

## Reproduction and limits

Copy `projection/` into a fresh temporary directory and run `node --expose-gc --import tsx /absolute/temporary/directory/run.mts` from this repository. The driver writes its new report beside itself; do not run it in the sealed evidence directory. It uses the recorded synthetic fixture and archived old/new projection modules, with absolute imports into this workspace. Verify [source hashes](source-hashes.json) before reproducing. Both variants are tested in one process with alternating order; this remains a small local experiment, not statistical production acceptance.

No further 100-account load run is claimed for this increment. The [last normal-server capacity gate](../increment-12/README.md#normal-server-capacity-result) remains failed. Current scope is a verified reduction in one measured CPU/allocation source. Full concurrency, hosted/physical performance and other QUALITY-03 gates remain open. Rollback restores the original helper without changing stored data, pending operation IDs, receipts or cache versions.

[Command results](verification.json), [preservation checks](preservation.json), [document changes](documentation.patch), [frontend hashes](build-hashes.json). The independent next local verification task is SAFE-01; this does not close QUALITY-03.
