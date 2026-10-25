# Increment 7 — compare validated records without serialization

24 October 2026 · QUALITY-03 · NFR-03/NFR-07. **Command CPU cost improves; the 100-user burst gate still fails.** Recovery, history preservation and cleanup pass. Cloud provisioning remains pending.

`server/personal/records.ts` now compares validated relational JSON values directly when deciding whether a row changed. Object key order is irrelevant; array order, field presence and scalar types remain significant. Numeric −0/0 retain JSON equivalence. The private helper is not an input validator: existing entry/schema/reference checks remain required. Canonical serialization is unchanged for row keys, import hashes, causal fingerprints and replay identity. Transactions, owner/session checks, cancellation, SQL, timeouts and schema remain unchanged. [Exact source diff](source-changes.patch), [source hashes](source-hashes.json).

The added real API/database regression starts with every personal record family populated, including retained historical records. A no-op account command advances its receipt/profile revision once but preserves every other row's full contents, timestamps/revisions and sync removal barriers. Exact replay adds no revision. A nested preference edit then changes only the preference record while preserving XP and all unrelated rows. Existing import, correction, conflict, rollback and lifecycle tests exercise real mutations across these same boundaries.

## Measurements

Same fixed local test installation, macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0 and PostgreSQL 17.11. The workload, five-connection pool and 2-second statement / 3-second query and connection timeouts are unchanged. Requests use real Auth/BFF/RLS through Fastify inject; network/browser/hosted latency is excluded. Compare with [increment 6](../increment-06/README.md).

| Diagnostic | Before | After |
| --- | --- | --- |
| Single-user full check | 815.2 ms | 657.1 ms |
| Single-user Undo | 716.4 ms | 624.2 ms |
| Two-command profile: canonical serialization, inclusive | 461.1 ms | 52.5 ms |
| Two-command profile: direct JSON comparison, inclusive | — | 41.9 ms |
| Two-command profile: record writer, inclusive | 603.8 ms | 232.9 ms |
| 100-user full burst, first attempts accepted | 5/100 | 10/100 |
| 100-user Undo burst, first attempts accepted | 6/100 | 10/100 |
| Combined first-attempt HTTP 503 responses | 189/200 | 180/200 |
| Accepted first-attempt p95 | 4,335.7 ms | **4,861.0 ms** |

The single-user timings are individual samples, not a statistical acceptance run. Profiling is a separate two-command diagnostic; inclusive times overlap and must not be added to the writer total. Transpilation collapses source line locations, so locate functions by name/file. [Smoke samples](smoke.json), [profile summary](diagnostics/cpu-summary.json), [raw profile](diagnostics/command.cpuprofile), [profiled smoke result](diagnostics/profiled-smoke.json). Profiling used the unchanged [instrumented probe](../increment-06/diagnostics/profile-source.mts) after the server edit.

The repeated full workload retains 100 accounts × 100 habits × 730 dates. All 180 failed first attempts succeed on exact sequential retry; every receipt replay and all 100 full relational readbacks pass. Every account returns to revision 4 and 1,313,990 XP after Undo, with 7.3 million total original occurrences preserved. The read responses again total 1,573,231,800 bytes. Cleanup verifies no remaining fixture accounts or owner occurrences. [Every sample and invariant](full.json), [progress log](logs/full.log).

The accepted population changed, and its p95 worsened; reduced CPU cost is **not** evidence that the capacity target passed. Both full runs intentionally exit 1. The database was not reset: the second fixture setup took 177.21 seconds and recorded a net size change of −24,436,736 bytes while existing space was reusable. That net size change does not measure fixture footprint or establish a storage optimization. Host/cache/database conditions are local diagnostic conditions, not controlled hosted acceptance. Sustained mixed personal/shared load and convergence still need measurement.

## Verification and preservation

| Command | Result |
| --- | --- |
| `npm run check` | 282 source/tooling cases, lint/types and both builds pass; [log](logs/check.log) |
| `node --import tsx --test tests/personal-records.test.ts tests/account-commands.test.ts` | 6 pass; [log](logs/domain.log) |
| `node --import tsx --test --test-name-pattern='no-op account commands retain' tests/infra/personal.test.ts` | Focused real database case passes; [log](logs/targeted-database.log) |
| `node --import tsx --test --test-concurrency=1 tests/infra/personal.test.ts tests/infra/sync.test.ts tests/infra/recovery.test.ts tests/infra/lifecycle.test.ts tests/infra/group-export.test.ts` | 48 real database cases pass; owner/unrelated/revoked access, populated history, staged imports, immutable replay, conflict barriers, receipt rollback, deletion and backup replay; [log](logs/database.log) |
| `node --import tsx scripts/infra/check-account-load.ts smoke` | Pass; [report](smoke.json) |
| `node --import tsx scripts/infra/check-account-load.ts full` | **Burst capacity fails**; exact recovery, readback and cleanup pass; [report](full.json) |
| `npm run check:docs` | Pass; [log](logs/docs.log) |

The [preservation audit](preservation.json) checks 2,924 protected files: only the intended server record writer changed. Prior sealed evidence is intact; all 52 increment-5 frontend build files remain byte-identical. This server-only comparison change does not require new UI screenshots, and no browser suite or physical-device result is claimed. The 4173 profile, assets, styles, dependency pins and applied migrations remain intact. No cloud provisioning, real messages, external push or unrelated stack changes occurred.

Rollback restores the prior comparison implementation without a schema/cache migration or data reset. Keep hashes, receipts, validation and transaction boundaries unchanged. QUALITY-03 remains IN PROGRESS for remaining latency, capacity, mixed/shared load and integrated resilience work; physical and hosted gates remain open.
