# Private shared-task priorities and memory reader

23 October 2026 · GROUP-02 / PRD-06 / PRD-13 · local/test Postgres/Auth/BFF on macOS. The wider goal remains active, and GROUP-02 remains IN PROGRESS for real task/list and priority controls. Cloud provisioning remains pending by the user's instruction. All account and group operations used synthetic identities; no external email, invitation or push was sent. The saved preview/profile on 4173 was not accessed.

## Behavior and boundaries

Account priorities now support an opaque group/task/occurrence-date reference. The personal priority date is separate. A newly selected reference must pass current membership, active group/task and recurrence checks inside the personal transaction. The existing ordered three-slot rules and domain reducer remain authoritative. Pinning, replacing and removing a priority never complete a task or award habit XP.

Selected references survive loss of access and group deletion so they can be reordered or removed without erasing other choices. Re-adding a removed selection or changing its group/task/date requires fresh authorization. Shared title, note, assignee and completion data never enter personal rows or exports. A committed personal receipt may acknowledge its owner's private action after group removal, without returning content or granting membership; group-command receipts still require access.

The migration adds three nullable columns and exact reference/uniqueness checks to `daily_priorities`, retaining forced owner/session RLS and the private account-root purge. It deliberately adds no shared-parent cascade. Two BFF-only fixed database functions lock authorized groups and validate new references. The guard cannot read private priorities or journeys. Sync batches acquire sorted shared group locks after their actor lock; membership/content mutations take exclusive group locks. Receipt failure rolls back private records, revision and change rows together.

Old habit/milestone rows, cache formats 1/2, immutable priority fingerprints, export checksums and staged-import hashes remain compatible. Guest import excludes every task reference, rejects direct uploads of those references and preserves existing account selections during append. Portable exports retain only opaque recovery references and cannot recreate membership. Remote removal is not reversed by merging local simulated task state.

`SharedContent` keeps shared pages in memory, binds them to a selected account and group revision, rejects overlapping continuations, clears failed/inaccessible content and fences late success/error responses. `GroupClient` validates account, group, collection, parent, date and revision. The provider registers loaded eligibility with `WorkspaceSession`; refusal of a vanished new selection does not poison account storage. No shared task/list request is made until a consumer explicitly loads a collection. Existing screens are not yet connected to this reader.

## Changed files and migration

`20261023152154_shared_task_priorities.sql` is applied to both retained local/test installations. Earlier migrations were not edited. The domain/contracts, account projection/export/import/recovery and `AccountJourney`/`WorkspaceSession` now carry opaque references. `server/groups/priorities.ts` authorizes them inside existing personal command/review transactions. The client/provider adds the memory reader and eligibility registration. New focused tests live in `tests/shared-priorities.test.ts`, `tests/shared-reader.test.ts` and `tests/infra/shared-priorities.test.ts`.

The [verification manifest](verification.json) records exact source/build/log hashes. The [preservation report](preservation.json) compares this increment with its pre-edit baseline, including existing visual references, assets, dependencies, prior migrations and historical evidence. Current product/security/sync guides are reconciled; older evidence reports retain their original claims and results.

## Verification

- `npm run infra:up -- test` and `npm run infra:up -- local`: migration applied, isolated identities and restricted runtime verified.
- `npm run check`: **239/239** unit/tooling cases, pinned toolchain, lint, app/test/server types and production/review builds passed.
- `npm run test:infra`: **125/125** real database/BFF cases passed.
- `node --import tsx --test --test-concurrency=1 tests/infra/shared-priorities.test.ts`: **9/9** focused real-database cases passed before the complete run.
- `node --import tsx --test tests/shared-reader.test.ts`: **4/4** reader/HTTP-boundary cases passed; all are also included in `npm run check`.
- Local/test `npx supabase db advisors --local --workdir .rise-infra/<environment> --type all --level warn --fail-on warn`: **no issues** on either installation.
- `npm run test:sync`: **69/69** account sync, recovery, lifecycle and layout cases passed across all three engines.
- `npm run test:groups`: **27/27** membership and group-layout regression cases passed across all three engines.
- `npm run check:docs`: **31 documents, 439 links, 57 anchors, 38 tasks and 20 requirements**, with no failures.

The final browser runs used the same completed production bundle, frozen separately on isolated 4191 and run sequentially after code/database checks. No source or build edits occurred between them. Verified engines are Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0 with Playwright 1.64.1. The existing layout tests cover English, Russian and Uzbek Latin, light/dark, 320/375/393/430 px and enlarged text; they verify existing account/group composition, not unfinished shared-content screens. No physical-device or hosted claims are made. Visual reference files were unchanged; no new golden comparison is claimed for this nonvisual increment.

[Code/build log](logs/check.log), [full database log](logs/infra.log), [priority cases](logs/priority-focused.log), [reader cases](logs/reader-focused.log), [account browser log](logs/sync-browser.log), [group browser log](logs/groups-browser.log), [document validation](logs/docs.log), [local advisors](logs/advisors-local.log) and [test advisors](logs/advisors-test.log).

The new cases cover separate civil dates, max-three/duplicate rules, zero XP, retained unavailable selections, new-reference authorization, membership-removal races, exact personal replay, private RLS/grants, transactional rollback, recovery conflicts, old row/outbox compatibility, legacy staged import, export privacy and populated account purge. Reader cases cover coherent paging, eligibility invalidation, overlapping rows, failed continuation, late replies and account changes.

An initial focused typecheck identified an excess-property error in the negative test that deliberately submits authority inside command context. The fixture now uses a named malformed object; runtime rejection remains tested. Application behavior did not need a workaround. All final code checks pass. The existing Vite chunk-size advisory remains; bundle optimization is separate QUALITY work.

## Remaining work and rollback

Connect existing task/list composition and priority controls, localized pending/error states and explicit conflict review. Verify two-browser collaboration, completion/Undo, snapshots, list ordering, unavailable selections and offline/removal recovery before GROUP-02 can move to REVIEW. GROUP-03 exact squad snapshots and GROUP-04/05 notification/lifecycle integration follow. These API/domain tests do not certify those unfinished user flows.

Disable new shared controls or routes to roll back exposure while retaining data, receipts, removal barriers, suppression ledger and compatible readers. A pre-extension personal writer cannot preserve populated task-priority rows: do not downgrade to it, drop columns or rewrite pending operations. Preserve account recovery/outbox and guest sources. Account-root purge removes the deleted owner's private references; group deletion deliberately does not remove another account's selected priorities.
