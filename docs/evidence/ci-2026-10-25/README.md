# CI repair — 25 October 2026

Scope: FND-02 automated verification and GROUP-01/GROUP-04 invitation history; PRD-14 and NFR-03/NFR-06/NFR-07. Cloud provisioning and deployment remain pending. This record does not close QUALITY-03 or RELEASE-01.

## Initial hosted failure

[Run 40207253372](https://github.com/bakhromovmamur/RISE/actions/runs/40207253372), commit `3074f591034f466a926926868d9d7a1709a79701`, failed in all three web jobs before browser testing: four server unit tests required an existing `dist/` directory although `npm test` precedes the builds. The infrastructure job built production output only; its private-file scan also requires `dist-review/`. Its 100,000-row invitation-history case separately returned HTTP 503 during group ownership transfer.

## Clean-checkout correction

The four server unit tests now create and remove their own temporary synthetic production shell through the actual server interface. Authorization, rollback chunk, origin and diagnostic assertions remain intact. No application source or saved browser origin is changed by this fixture correction. The infrastructure workflow explicitly builds review output before its security scan; the web matrix retains tests before builds.

On macOS, Node 24.16.0 and npm 11.13.0, an owned temporary source export of the published commit was installed with `npm ci --offline --no-audit --no-fund`, without pre-existing build directories:

- Original `node --import tsx --test tests/server.test.ts`: four failures with `ENOENT` for `dist/` (the hosted failure reproduced).
- Same command after the fixture correction: **11/11 pass**, before creating either build directory.
- `npm run check` after that correction: toolchain/notices/lint/types pass, **334/334 tests pass**, production and review builds complete.

Private command logs remain under ignored `.rise-infra/ci-20261025/`. They are not publication artifacts. Hosted verification is still in progress; no passing hosted verdict is claimed here yet.

## Invitation transfer/archive correction

The original maximum-history case reproduced HTTP 503 locally. Instrumentation of the actual `change_group` database call recorded PostgreSQL `57014` at **2,010.61 ms**, hitting the unchanged two-second statement deadline. A passing original run took 1,472 ms, confirming timing sensitivity. At transfer the fixture has 99,501 retained rows; the original bulk update rewrote 99,500 unconsumed entries although only one remained usable.

Additive migration `20261025155518_revoke_only_live_group_invitations.sql` changes only the archive/transfer bulk predicates to require unconsumed, unrevoked and unexpired links. It retains the existing function owner, empty search path, grants, session/owner checks, actor/group locks, revision and recent-authentication checks, and explicit individual revocation. Existing indexes are reused. Expired and consumed links already fail acceptance; their retained metadata remains unchanged. No deadline, workload, rate limit or authorization assertion is relaxed.

The expanded real endpoint regression fails deterministically against the original function because it relabels expired history. After the migration, `node --import tsx --test tests/infra/group-invitations.test.ts` passes **3/3**, retaining the 100,000-row setup and adding archive/transfer exact replay, preserved terminal timestamps, live-link rejection and rejection after restore. The actual corrected `change_group` call measured **32.91 ms** in the same traced workload. These local diagnostics are not an NFR-03 capacity guarantee. `npm run typecheck` also passes with the extended regression.

The normal `npm run infra:up -- test` and `npm run infra:up -- local` applied the additive migration. Before/after comparisons of all **46 retained local `rise` tables** (counts and content digests) and installation state were identical. The migration changes a function only; it does not rewrite saved rows or browser storage. Retain the additive migration on application rollback; existing API and cache formats remain compatible. Full infrastructure and hosted regression results follow when complete.

## Review follow-up: expiry after waiting

Independent review identified a concurrency condition before publication: PostgreSQL `now()` is the transaction start time. An accept transaction started before expiry can wait while a later transfer skips a now-expired invitation; evaluating acceptance against the older transaction timestamp would permit that link. Acceptance must check the current database clock after acquiring its group/invitation locks. Both deterministic restricted-transaction regressions (transfer and archive/restore) failed before the correction because acceptance succeeded. Additive migration `20261025155741_recheck_group_invitation_expiry_after_lock.sql` changes only that expiry comparison to `clock_timestamp()` after the existing group and invitation locks. Audit timestamps, function authority, grants and lock order remain intact. The live-only predicate and this acceptance boundary must ship together. The full invitation suite after both migrations passes **5/5**, including both race cases. A second retained-local comparison again matched all 46 table digests and installation state. Independent read-only review verified the exact function differences and existing authority/lock boundaries. Stable-source full infrastructure and hosted validation remain in progress.
