# Invitation transfer timeout correction

25 October 2026 · GROUP-01/GROUP-04 · PRD-14, NFR-03/06/07.

## Failure and diagnosis

GitHub run `40207253372` returned HTTP 503 during the real database test `maximum retained invitation history remains owner-only and paged while cleanup is stopped`. The unchanged fixed-test fixture reproduced the failure locally: `rise_private.change_group` took 2010.61 ms and PostgreSQL returned `57014` (the existing two-second statement timeout). Two initial local attempts passed, so an isolated successful rerun did not dismiss the failure.

At transfer the test retained 99,501 rows after its existing bounded cleanup: 99,499 expired, one consumed and one live invitation. The previous transfer/archive UPDATE selected all 99,500 unconsumed rows, including expired history. A rollback-only `EXPLAIN (ANALYZE, BUFFERS)` under the narrow `rise_group_guard` role measured:

| Query | Updated candidates | Execution | Shared-buffer hits |
| --- | ---: | ---: | ---: |
| Existing unconsumed predicate | 99,500 | 1153.978 ms | 2,605,344 |
| Unconsumed, unrevoked, unexpired predicate | 1 | 56.546 ms | 201,666 |

The diagnostic temporarily granted the migration administrator the existing guard role inside the transaction and rolled it back afterward. It introduced no persistent privilege. The filtered trial used an existing group index; no new index or planner setting was required. These are local observations, not hosted latency guarantees. The original complete function also measured 1471.55 ms in a successful run, confirming its limited headroom.

## Change and preserved boundaries

Additive migration `20261025155518_revoke_only_live_group_invitations.sql` changes only the archive and transfer bulk-revocation predicates to include `revoked_at IS NULL AND expires_at > now()`. Acceptance and preview already reject expired, consumed or revoked links. Independent review identified a transaction-clock race after narrowing revocation: a join transaction started before expiry could wait through a transfer that skipped the now-expired link, then accept it using its earlier `now()`. Additive migration `20261025155741_recheck_group_invitation_expiry_after_lock.sql` changes only acceptance's expiry comparison to `clock_timestamp()` after the existing group/invitation locks. Audit timestamps remain transaction-based. The overlapping-transaction regression covers transfer and archive/restoration with synthetic expiry advanced between transaction starts; it uses no sleeps and asserts no membership, consumption, receipt or revision side effects. Explicit single-link revocation is unchanged.

Both migrations preserve function ownership, security-definer/search-path settings, actor/group lock order, session/current-owner/recent-auth checks, revision and receipt transaction, forced RLS and runtime grants. Temporary migration-role membership is revoked at the end. Neither changes any saved rows. Expired and consumed history retains its meaning; already-revoked timestamps remain unchanged. No timeout, density, connection budget, invitation frequency or retention limit was raised.

The existing 100,000-row regression now also verifies transfer and archive success, exact receipt replay, the exact terminal-history counts, unchanged prior revocation timestamps, rejection of the transferred link, and rejection of the archived link after restoration. It retains owner/member/unrelated access, bounded paging, capacity recovery and frequency tests. Before the migration, the added history assertion failed deterministically: 99,500 rows were marked revoked instead of the single live link.

## Local verification

Environment: macOS arm64, pinned repository Node/npm, isolated Supabase test installation on loopback database port 55422; retained local installation port 55322 for additive migration/preservation only. Synthetic accounts and owned fixtures are removed by the test harness. No cloud resources, real invitations, user profiles or browser storage were reset.

- `node --import tsx --test --test-name-pattern='maximum retained invitation history' tests/infra/group-invitations.test.ts`: original intermittent failure reproduced through an equivalent private tracing copy; strengthened assertion failed against the original function.
- `npm run infra:up -- test`: applied the additive migration through the normal isolated migration path.
- `node --import tsx --test tests/infra/group-invitations.test.ts`: **3/3 passed**, 6.7 s, including maximum retained history and 100 accepted invitations followed by rejection/exact replay.
- Same private trace/original test after migration: complete `change_group` **32.91 ms**, success; original maximum-history test passed. This comparison retains the original fixture and runtime limits.
- `npm run infra:up -- local`: applied normally; before/after row counts/content digests for all **46 `rise` tables** plus installation-state SHA-256 matched exactly. The snapshot contained digests only and remains private.
- `node --import tsx --test --test-name-pattern='older transaction clock' tests/infra/group-invitations.test.ts`: **2/2 failed red** against the initial live-only migration (both expired links incorrectly accepted); after the clock correction, complete invitation suite **5/5 passed**, 6.9 s. No wait/time-budget workaround was used.
- Normal `infra:up` applied the second additive migration to both fixed installations. The second before/after preservation snapshot again matched all 46 `rise` table digests and installation state exactly.
- Complete `npm run test:infra`: a run started with only the first migration became invalid when the second migration was added during execution; exact migration/release gates detected the changing source set. Stable source then passed **182/183** in 158 s: all invitation, authorization, lifecycle, backup/restore and retention checks passed. The sole release-runtime failure was the existing `rollback_compatibility_required` guard because the retained fixed-test deployment selected a sealed package with the previous migration set. This is handled by separate test-metadata isolation work; the guard and retained packages remain intact. Final integrated results are recorded in the [CI correction report](README.md). No gate was weakened.

Private diagnostics remain under `.rise-infra/ci-invitation/`: `trace-before.log`, `plans-before.log`, `regression-red.log`, `regression-green.log`, `trace-after.log`, `infra-green.log` (transition run), `race-red.log`, `focused-final.log`, `infra-final.log`, and preservation digests. Published evidence contains no invitation secrets, account identifiers, credentials or exported user content.

## Compatibility and remaining gates

The existing BFF and client work with the additive function replacement; there is no API/cache migration. Keep the corrected database functions when rolling back application code. Sealed release packages also carry an exact migration fingerprint: normal admission can refuse an older package whose migration set differs. Preserve retained packages and the admission guard; use a freshly verified compatible package instead of editing or resealing old artifacts. Reinstalling the old bulk UPDATE can reintroduce the timeout and relabel expired history, so it is not the preferred rollback. Hosted CI must still validate the freshly built stack; no hosted deployment, physical-device acceptance or cloud provisioning is claimed.

Reference checks: [Supabase RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance), [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html), [Supabase changelog](https://supabase.com/changelog). The investigation measured the actual guarded role and retained its policies rather than weakening authorization to improve timings.
