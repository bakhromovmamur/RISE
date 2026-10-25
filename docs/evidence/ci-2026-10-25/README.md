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

## Retained release-test isolation

The stable local infrastructure run passed **182/183**; its only failure was `rollback_compatibility_required` before the sealed-runtime test started. The retained fixed-test release records 35 migrations; the corrected source has 37. The production admission guard correctly refuses that old release as a rollback partner. Git initialization was not the cause.

The release-runtime test now temporarily isolates only its fixed-test deployment-selection metadata, refuses active selection/server locks, and restores original files and modes afterward, including after an injected failure. It checks directory ownership before restoration and preserves a recovery workspace if restoration is unsafe. All retained sealed packages, database rows and browser origins remain untouched. Build and initial selection are inside the restoration boundary. Production compatibility and readiness checks remain unchanged. Two preservation/lock regressions accompany the real sealed runtime, stale-choice and repeated-interrupt test. The focused suite passes **3/3** (15.46 seconds in the final run), with original deployment hashes/modes restored. Scoped lint and server type checks pass. The full combined stable-source `npm run test:infra` passes **185/185**, zero failures/skips, in 138.77 seconds. All **292 original deployment entries** match by SHA-256, mode and link target after the suite. No test isolation guard/workspace, deployment lock, release process or 4191 listener remains. Private snapshots and logs are under `.rise-infra/ci-invitation/`.

## Hosted verification

The correction was committed and pushed as `f7a671ecfd7b3ba292cf3c86187cfe9c4b1e29dc`. [Run 40209551589](https://github.com/bakhromovmamur/RISE/actions/runs/40209551589) passed all three jobs' unit tests and both builds, the full Chromium browser/production/PWA job, and the fresh infrastructure database suite. Firefox subsequently also completed successfully; the run finished with the two WebKit failures described below, so it is not a complete passing CI verdict. The final source also passed `npm run check` in the owned source export: **334/334 tests**, lint/types/toolchain/notices and both builds.

The same hosted run subsequently exposed two WebKit failures beyond the repaired early gates: main journeys **152/153** (the enlarged Uzbek diagnostic control had `scrollWidth=250` and `clientWidth=248`), and backend browser checks **20/21** (the inert-markup test captured its full-state baseline before the normal initial `priorities.ensure` command had saved). The exact layout and full-state preservation assertions remain required; these findings are being corrected before the next hosted run.

## WebKit follow-up corrections

The security test now waits for the exact durable priority state produced by the existing domain function before taking its full reload baseline. The whole-state equality and all injection assertions remain intact. [Security evidence](SECURITY-RELOAD.md): five corrected WebKit repeats and **12/12** security cases across all engines pass, with lint/types and independent review.

The diagnostics title now has a component-scoped `overflow-wrap: anywhere` fallback; ordinary fonts, wording, controls, tokens and other rows are unchanged. A controlled wider-font regression reproduced **251 > 249** under the original CSS without relaxing the hosted assertion. All **18/18** diagnostics cases now pass across Chromium/WebKit/Firefox, retaining download privacy and unchanged saved-state checks. [Layout evidence](DIAGNOSTICS-LAYOUT.md) records widths, text scales, appearances and visual comparison.

## Deferred-screen startup follow-up

Commit `9974c049f45b12a32bb9831f980ed7699e8bfb37` started [run 40210661891](https://github.com/bakhromovmamur/RISE/actions/runs/40210661891). Chromium/Firefox jobs passed; WebKit's complete journeys and the backend security cases passed, confirming both prior corrections on Linux. A later WebKit production test exposed the same early-priority-baseline timing in a separate deferred-screen fixture (**25/26 production cases passed**).

Four equivalent custom-fixture bootstrap sites in deferred-screen and PWA help/interface tests now wait for the existing domain's exact saved initial priorities before taking their full snapshots. The common storage helper, intentional empty-state cases, app behavior and complete equality assertions remain unchanged. Independent audit found no further equivalent immediate custom-fixture snapshot sites in production/PWA tests. [Detailed evidence](DEFERRED-STARTUP.md): **78/78 production cases**, **18/18 affected PWA cases**, scoped lint and all-test type checks pass. The earlier CI run remains failed at this WebKit stage; the next run must verify the correction.

## Complete backend job budget

The infrastructure job budget is increased from **40 to 60 minutes** so it can finish its existing sequential suites. No test timeout, application deadline, performance threshold or assertion changes. The three web job budgets remain 20 minutes. This is based on retained timing evidence, not a claim that a hosted 40-minute timeout already occurred.

Latest local logs total approximately **39.3 minutes for tests alone**: infrastructure 138.8 s, backend 14.9 s, auth 45.2 s, sync 6.6 min, push 3.0 min, groups 20.7 min, rollout 5.7 min. The group run included the three previously recorded failures. Earlier fully green group/rollout/sync/push runs took 19.0/4.5/7.0/3.1 minutes respectively, still leaving insufficient room in 40 minutes for the current setup and other gates. The hosted runs spend additional minutes on checkout/install/build, two stacks and browser dependencies; advisors and cleanup also need time. These are combined local observations, not one end-to-end hosted duration.

Private sources: `.rise-infra/ci-invitation/infra-isolated-final.log`; `.rise-infra/local-completion-20261025/test-{backend,auth,sync,push,groups,rollout}-final.log`; `.rise-infra/signin-browser-followup-20261025/{groups,rollout,sync,push}.log`. Published context is retained in the [local completion report](../local-completion-2026-10-25/README.md) and [earlier all-green browser record](../signin-queue-2026-10-25/README.md).
