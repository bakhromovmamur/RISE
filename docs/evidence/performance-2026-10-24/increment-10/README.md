# Pair unchanged occurrence histories before building key maps

24 October 2026 · QUALITY-03 · NFR-03/NFR-07 · fixed local test installation.

The account writer now pairs occurrence histories when their full lengths and ordered keys match. It compares every row value, then builds canonical key maps only for changed pairs. Any length/key-order mismatch retains the existing general insertion/removal path. SQL writes, correction/removal barriers, canonical identities, receipt behavior and validation are unchanged. No new cache, schema, dependency, pool, timeout, process topology or UI change.

## Why and what changed

Prior CPU profiling identified repeated map/key construction as significant writer work. [The CPU-only probe](discovery/run.mts) compares the actual old writer and candidate on synthetic 73,000-row records with a SQL collector. It checks every emitted statement/parameter and input immutability. Five alternating measured rounds follow warm-up; these are writer CPU measurements, not database, RLS, transaction or p95 acceptance.

| Scenario | Original median | Candidate median |
| --- | ---: | ---: |
| no-op | 110.2 ms | 24.2 ms |
| full | 111.2 ms | 22.9 ms |
| undo | 109.2 ms | 23.1 ms |
| correction | 109.5 ms | 22.9 ms |
| reordered | 117.8 ms | 116.3 ms |
| removed | 93.9 ms | 93.0 ms |

[All final samples](discovery/results.json), [old module](discovery/before.mts), [candidate](discovery/candidate.mts), [run log](discovery/run.log). Command: `node --import tsx /tmp/rise-writer-alignment-probe/run.mts`, exit 0. Every SQL statement/parameter matches and inputs remain unchanged. The applied source matches the measured candidate after resolving its diagnostic absolute imports.

The first exploratory no-op used the same object on both sides. It was changed to a detached clone before the recorded final run to represent an ordinary read/project cycle; the first timing file was not retained. Full, Undo and correction use distinct projected states. Reordering and removal exercise the unchanged fallback. This probe does not stand in for real database verification.

The optimization filters only pairs proven unchanged by the existing validated-JSON comparison. Changed pairs keep both original and desired rows, so old-value correction detection remains available. Other tables retain their existing behavior, including retired milestones, saved work notes and Fajr acknowledgments. The profile revision still advances once for an accepted no-op. Nothing is cached across requests or revisions.

## Real database and load results

The unchanged mixed workload accepts 542/600 first intentions, with 20 HTTP failures and 38 deferred. Accepted personal/shared scheduled p95 is 4,715.8/4,599.1 ms. Of 177 accepted shared updates, 25 observations exceed 15 seconds and 11 remain missing. All 58 failed/deferred intentions recover exactly; complete histories, XP, shared snapshots and cleanup pass. The full diagnostic verdict is **FAIL**. QUALITY-03 remains IN PROGRESS for its broader requirements.

The [increment 9 baseline](../increment-09/README.md) accepts 377/600 first intentions, with 66 HTTP 503 and 157 deferred; personal/shared scheduled p95 is 5,631.2/4,913.1 ms. Both use one BFF thread, five database connections, 100 dense accounts, 50 joined families, 400 personal/200 shared intentions, 15-second foreground metadata refresh and the actual shared-content reader. This is one load run per source version, not a repeated controlled staging study.

Observed-only convergence p95 is 17,335.2 ms, maximum 28,199.9 ms. Missing observations count as failures. Recovery submits 35 personal and 23 shared original intentions after measurement, without renumbering. [Complete report](mixed.json), [progress](logs/mixed.log). Seed time 173.9 seconds is excluded. Net reused-database growth 19,718,144 bytes is not fixture footprint.

Single-account full/Undo samples improve from increment 9's 556.9/494.0 to 470.7/409.5 ms. [Smoke result](smoke.json), [log](logs/smoke.log). These individual samples do not establish p95/device acceptance.

## Verification and corrections

- `npm run check`: exit 0, 282 source/tooling cases, lint/types and both builds. [Log](logs/check.log).
- `node --import tsx --test --test-name-pattern='habit corrections preserve row' tests/infra/personal.test.ts`: passes before and after the source change. [Before](logs/targeted-before.log), [after](logs/targeted-after.log).
- The regression checks full-to-tiny XP correction, unchanged neighboring row versions and snapshots, exact replay, archive retention, explicit Undo removal, intended neighbor position/revision update, removal barriers and replay of an old correction after removal without resurrection or barrier changes.
- `node --import tsx --test --test-concurrency=1 tests/infra/personal.test.ts tests/infra/sync.test.ts tests/infra/recovery.test.ts tests/infra/lifecycle.test.ts tests/infra/group-export.test.ts`: exit 0, 50 real database cases. [Log](logs/database.log).
- `node --import tsx scripts/infra/check-account-load.ts smoke`: exit 0; the same command with `mixed`: exit 1, with result/scope above.
- `node --import tsx --test --test-name-pattern='habit plans validate' tests/infra/push-plans.test.ts`: exit 0, one focused real-database habit completion/archive cancellation check, with an injected synthetic outbound callback. [Log](logs/cancellation.log). No physical delivery claim.
- `npm run check:docs`: [log](logs/docs.log). Evidence links, source/build hashes and prior sealed evidence are checked separately. [Verification manifest](verification.json).

The initial regression expected a surviving neighbor's position/revision to remain unchanged when the preceding occurrence was removed. The existing writer correctly reindexes that row. The assertion was corrected to allow exactly that position/revision/timestamp update while preserving all other values, then verify replay changes nothing. [Initial test failure](logs/targeted-initial.log). No application behavior was changed to satisfy that incorrect expectation.

## Preservation and rollback

[Source diff](source-changes.patch), [source hashes](source-hashes.json), [documentation diff](documentation-changes.patch), [document hashes](document-hashes.json), [preservation audit](preservation.json). Only the record writer and its real database regression change application/test source. All 52 increment-5 frontend build files remain byte-identical. Assets, CSS, migrations, dependencies, saved formats and all previous sealed evidence remain. No browser/visual compatibility claim is added. Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, PostgreSQL 17.11.

The dense run restores every original personal value/XP, verifies both members' final shared snapshots and removes only its exact synthetic accounts/groups. The saved 4173 profile and unrelated installations are untouched. Rollback restores the previous writer without a schema/cache migration or data reset. Cloud provisioning remains pending. Unresolved performance, integrated resilience and hosted/physical evidence remain open.
