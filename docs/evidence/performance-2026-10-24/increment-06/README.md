# Increment 6 — local account capacity baseline

24 October 2026 · QUALITY-03 · NFR-03/NFR-07. **The local burst gate fails; recovery and cleanup pass.** No application, server, schema, permission, timeout, dependency, UI or saved-profile format changed. Cloud provisioning remains pending.

The new opt-in [workload](workload-source.ts) creates 100 real synthetic test accounts, each with 100 daily habits and 730 dates: 7,300,000 occurrences. Administrative batch insertion is fixture setup, not import-API performance. Measured requests use real Auth, the restricted BFF, current-session RLS and the existing five-connection pool, 2-second statement timeout and 3-second query/connection timeouts. Fastify inject excludes HTTP network/browser latency. Each synthetic client has a separate loopback address. No hosted or physical-device acceptance is claimed.

The workload sends 100 simultaneous full checks, retries failed requests sequentially with identical operation IDs/bodies, verifies exact replay results, then repeats with Undo. It finally reads each complete account, compares every relational value after sorting by record identity, and checks restored XP/revision. Setup took 180.17 seconds; database size grew by 3,315,474,432 bytes. This is logical database growth, not a bound on WAL or host disk usage.

| First-attempt wave | Accepted | HTTP 503 | Accepted response times |
| --- | --- | --- | --- |
| Full check | 5/100 | 95 | 3,924–3,936 ms |
| Undo | 6/100 | 94 | 2,979–4,336 ms |
| Combined | 11/200 | 189 | Accepted p95 4,335.7 ms |

[Every sample](full.json) is retained, including failures and separate retry timings. All 189 exact retries returned 200. Receipt replay produced no additional revision; all 100 accounts reached revision 4 and returned to 1,313,990 XP. Full readback compared all original history/records; the 100 responses totaled 1,573,231,800 bytes. Cleanup removed this run's exact synthetic accounts and verified zero remaining owner occurrences. The command deliberately exited 1 for the latency/failure result even though recovery and cleanup passed. This two-wave burst is not the complete mixed/steady NFR-03 workload or shared-convergence check.

## Discovery and diagnostic corrections

The initial one-account probe completed six mutations in 742–794 ms and preserved all history/XP ([results](diagnostics/single-owner-discovery.json), [source](diagnostics/single-owner-probe.mts)). The reusable tool's final [smoke run](smoke.json) passes both mutations, exact replay, full relational readback and cleanup; its two samples are not p95 acceptance.

Three earlier fixture/assertion failures are preserved. Guest habit IDs were rejected by the account UUID schema ([log](diagnostics/guest-id-fixture-failure.log), [cleanup result](diagnostics/guest-id-fixture-failure.json)); the fixture now maps IDs to deterministic UUIDs consistently across habits/history. Replay responses correctly change only `replayed` to true ([failed assertion](diagnostics/replay-assertion-failure.json)); the assertion now checks that documented marker and exact receipt values. Database ordering differed from domain prayer ordering ([failed assertion](diagnostics/row-order-assertion-failure.json)); readback now sorts row identities before comparing all fields. Each failed run completed cleanup. These are test corrections, not changes to production behavior.

After the full run, a separate single-account V8 profile measured two commands and their receipt replays, excluding fixture setup and final readback. Of about 1,749.8 ms sampled, canonical serialization accounted for approximately 461.1 ms inclusive; the record-writing path accounted for 603.8 ms inclusive, overlapping that serialization cost. These are approximate samples, not additive phases. The profile identifies repeated record/key serialization as a candidate for optimization; it does not prove the cause of every HTTP 503. [Summary](diagnostics/cpu-summary.json), [raw profile](diagnostics/command.cpuprofile), [instrumented source](diagnostics/profile-source.mts), [profiled smoke result](diagnostics/profiled-smoke.json). Transpilation collapses source line locations; use function names and source files, not the recorded line 1, to locate the code.

## Verification and boundaries

Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, PostgreSQL 17.11 in the existing fixed test installation; Docker VM memory approximately 7.75 GiB. No browser was opened. The production/review bundles remain exactly those verified in increment 5.

| Command/check | Result |
| --- | --- |
| `node --import tsx scripts/infra/check-account-load.ts smoke` | Pass; [report](smoke.json) |
| `node --import tsx scripts/infra/check-account-load.ts full` | **Capacity fail**, exact recovery/readback/cleanup pass; [report](full.json), [progress log](logs/full.log) |
| Second smoke while full holds the advisory lock | Expected rejection before fixture creation; [report](overlap-rejected.json) |
| Smoke sent SIGTERM during setup | Expected interrupted exit, no measured requests, cleanup pass; [report](interrupted.json) |
| `node --import tsx scripts/infra/check-account-load.ts invalid` | Expected argument rejection before loading environment; [log](logs/invalid-mode.log) |
| `npx tsc --noEmit -p tsconfig.server.json` | Pass, including the new tool; [log](logs/server-types.log) |
| `npx oxlint scripts/infra/check-account-load.ts --deny-warnings` | Pass; [log](logs/tool-lint.log) |
| `npm run check:docs` | Pass; [log](logs/docs.log) |

The [preservation audit](preservation.json) rechecks 2,924 protected files, prior sealed evidence and increment 5 source/build hashes. No unrelated stack was stopped. The saved 4173 browser profile was not accessed. Protected run manifests stay under `.rise-infra/test/capacity/`; they contain synthetic identity references, never credentials, and are not copied into evidence. Exact-email cleanup cannot run after a hard kill; follow [the recovery instructions](../../../PERFORMANCE.md#account-burst-diagnostic) rather than sweeping test accounts. Deleted tuples may retain reusable database disk space; cleanup does not promise a shrinking host file.

Before fixture work, current official [Supabase release notes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance) and [PostgreSQL JSON recordset documentation](https://www.postgresql.org/docs/current/functions-json.html) were consulted. Local PostgreSQL was already 17.11. No upgrade, policy relaxation, new privilege or migration was needed. The [Supabase hosted TLS change](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) did not require a change to this fixed loopback fixture.

QUALITY-03 remains IN PROGRESS. Next work must reduce demonstrated command cost, rerun the same burst, define and measure the sustained/mixed personal/shared workload, and complete the integrated fault matrix. Physical mobile Web Vitals, hosted staging, availability and operational restore acceptance remain open. Removing this diagnostic requires no data/schema migration; keep the application and original recovery sources intact.
