# Direct occurrence-column projection

24 October 2026 · QUALITY-03 · NFR-03/NFR-07 · local fixed test installation.

The dense occurrence read now avoids constructing and parsing a whole JSON object per row. It selects the same fixed fields directly, preserving `to_json(t.date)` for civil dates. Owner predicates, aggregate record bounds, runtime validation, RLS, audit/session checks and transaction/replay/cancellation behavior are unchanged. No schema, dependency, process topology, pool, timeout or frontend change.

## Evidence leading to the change

The separate [BFF-thread experiment](../bff-thread-discovery/README.md) improves acceptance but still fails capacity; no production threading architecture is adopted. A subsequent query probe compares the existing JSON-object projection with direct columns, using the same authorized actor, restricted role, active-session claims, forced RLS, ordered 73,000-row history and alternating warm-cache rounds.

| Round | Whole JSON object request | Direct columns request | Whole-object SQL execution | Direct-column SQL execution |
| --- | ---: | ---: | ---: | ---: |
| 1 | 205.3 ms | 96.8 ms | 119.0 ms | 40.4 ms |
| 2 | 174.9 ms | 86.6 ms | 126.3 ms | 39.4 ms |
| 3 | 241.4 ms | 108.0 ms | 119.3 ms | 48.0 ms |

Every returned value and row order matches. Each plan has 3,215 shared buffer hits and zero reads. [Samples](discovery/samples.json), [probe](discovery/probe.mts), [original-code command/replay/history/cleanup result](discovery/cleanup-and-smoke.json). `node --import tsx /tmp/rise-account-direct-columns-probe.mts smoke` exits 0. These are three warm-cache discovery rounds, not p95/staging acceptance.

The direct path is limited to `habit_occurrences`: its other fields are UUID, integer, nullable text and JSONB. Other tables keep their current projection. Ordering is qualified with `t.` so PostgreSQL orders by the stored date, not its JSON alias. The existing 250,000 aggregate row bound and object/hydration/output checks remain.

The driver normally turns SQL dates into process-local JavaScript dates; JSON/JSONB use JSON parsing. [node-postgres type documentation](https://node-postgres.com/features/types). The selected date retains PostgreSQL JSON conversion. [PostgreSQL 17 JSON functions](https://www.postgresql.org/docs/17/functions-json.html). The current Supabase changelog was fetched and reviewed on 24 October; no relevant projection/API breaking change was found. [Changelog](https://supabase.com/changelog).

## Outcome under the full workload

The identical single-thread mixed workload accepts 377/600 first intentions, with 66 HTTP failures and 157 deferred. Accepted personal/shared scheduled p95 is 5,631.2/4,913.1 ms. Of 121 accepted shared updates, 10 observations are late and 23 remain missing. All 223 failed/deferred intentions recover exactly; every history/XP/shared snapshot and cleanup check passes. The capacity/convergence verdict is **FAIL**. QUALITY-03 remains IN PROGRESS.

The comparison baseline is [increment 8](../increment-08/README.md), with 359/600 accepted, 65 HTTP 503, 176 deferred and personal/shared scheduled p95 5,348.9/4,936.7 ms. Personal p95 is worse despite the higher accepted count; this is not an overall capacity improvement. Both runs use the same single BFF thread and five-connection budget, 100 dense accounts, 50 families, 400 personal/200 shared intentions, 15-second refresh and actual shared reader. This is one run per source version, not a repeated controlled capacity study or hosted acceptance.

Observed-only convergence p95 is 16,236.8 ms; maximum 40,867.7 ms. Missing observations count as failures. Recovery has 144 personal and 79 shared exact intentions; it is excluded from first-attempt latency. [All samples](mixed.json), [progress](logs/mixed.log). Seed time 174.9 seconds is excluded; net reused-database size change 31,768,576 bytes is not a footprint claim.

The single-account full/Undo samples are 556.9/494.0 ms, compared with increment 8's 660.9/583.2 ms. [Smoke result](smoke.json), [log](logs/smoke.log). These individual samples do not establish p95 or device acceptance.

## Correctness and verification

- `npm run check`: exit 0, 282 source/tooling cases, lint/types and both frontend builds. [Log](logs/check.log).
- `node --import tsx --test --test-concurrency=1 tests/infra/personal.test.ts tests/infra/sync.test.ts tests/infra/recovery.test.ts tests/infra/lifecycle.test.ts tests/infra/group-export.test.ts`: exit 0, 49 real database cases. [Log](logs/database.log).
- The new focused parity test passes before and after the application change. It compares full projected values and the legacy SQL representation, checks leap-day order, fractional targets, nulls, Unicode/quoted names and unrelated-owner denial under ISO/SQL/German DateStyle and Pacific/Apia SQL timezone. It also proves a malformed stored domain field still yields a closed failure through the public API and that cleanup restores the original view. [Before](logs/parity-before.log), [after](logs/parity-after.log).
- The focused parity command also passes separately with `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland`. [West](logs/timezone-west.log), [east](logs/timezone-east.log). These test process date handling, not browser/device compatibility.
- `node --import tsx scripts/infra/check-account-load.ts smoke`: exit 0. The same command with `mixed`: exit 1; result and correctness scope above.
- `npm run check:docs`: [log](logs/docs.log). Evidence links and hashes are checked separately. [Verification manifest](verification.json).

The initial corruption fixture tried to UPDATE an immutable occurrence snapshot; its trigger correctly rejected the test. The corrected fixture INSERTs only a new synthetic invalid row, verifies rejection and removes only that row/day, without disabling any trigger or constraint. [Initial failure](logs/parity-initial.log). The first source gate also found unnecessary quote escapes in a test template string; those were removed and the full gate rerun. [Initial lint failure](logs/check-initial.log). Neither was an application failure or a reason to weaken policy.

## Preservation and recovery

[Source diff](source-changes.patch), [source hashes](source-hashes.json), [documentation diff](documentation-changes.patch), [document hashes](document-hashes.json), [preservation audit](preservation.json). Only the record reader and its real database regression change application/test source. All 52 increment-5 frontend build files are byte-identical. CSS, artwork, migrations, dependencies, persisted formats and all sealed previous evidence remain. No new browser/visual acceptance is claimed. Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, PostgreSQL 17.11.

Both query-probe and full-workload cleanup pass, with only their exact synthetic owners/groups removed. The saved 4173 profile and unrelated installations are untouched. Rollback restores the prior record reader; no schema/cache migration or data reset is required. Cloud provisioning remains pending. Unmet latency/convergence, local durable/feedback targets, integrated resilience and hosted/physical gates remain open.
