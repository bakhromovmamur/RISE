# Shared-content backend evidence — 23 October 2026

**Task:** GROUP-02, still IN PROGRESS. **Requirements:** PRD-13 and the existing authorization/lifecycle constraints; PRD-06 task-priority integration remains pending. **Environment:** retained local/test loopback Postgres/Auth installations, restricted BFF, synthetic accounts and local inbox only. Cloud provisioning, real invitations and external delivery remain pending.

## Implemented outcome

Active family members can create/edit/assign/archive/restore tasks and manage lists/items through the local/test API. Recurring dates have independent completion/Undo and preserved snapshots. Completion records use the verified member and database time; family actions do not change personal revision or habit XP. Group revision conflicts prevent silent competing edits/reorders. Exact retries retain the original result, and current membership is rechecked even for accepted receipts.

Four forced-RLS content tables, group-inclusive foreign keys, a narrow mutation capability, bounded coherent pages and removal barriers provide the server boundary. Account suppression/purge retains group-owned content through deidentified member IDs; explicit group deletion cascades it. [The contract](../../SHARED-CONTENT.md) documents fields, limits, recovery and rollback.

The real browser still exposes membership controls. Task/list UI, priority references, localized shared-content error/conflict screens, periodic shared refresh and offline pending acceptance are the next GROUP-02 increment. No complete family-product or release claim is made here.

## Verification

| Command | Result |
| --- | --- |
| `npm run check` | Passed: pinned toolchain, lint, all TypeScript projects, 230 unit/tooling tests, production and review builds |
| `npm run infra:up -- test` | Additive migration applied; retained identity, restricted BFF, Auth health and loopback bindings verified |
| `npm run infra:up -- local` | Same migration and verification on the separate retained local installation |
| `npm run test:infra` | Final full run: 116/116 passed, including ten new shared-content scenarios and existing session, isolation, personal, sync, lifecycle and push integration |
| `npm run test:groups` | 27/27 passed, zero retries/flakes/skips: 18 real membership scenarios and nine localized layout cases across three engines |
| `node_modules/.bin/supabase db advisors --local --workdir .rise-infra/local --type all --level warn --fail-on warn` | No issues found |
| `node_modules/.bin/supabase db advisors --local --workdir .rise-infra/test --type all --level warn --fail-on warn` | No issues found |
| `npm run check:docs` | Passed: 31 documents, 433 links, 55 anchors, 38 ordered tasks and 20 requirement mappings |

Browser versions: Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0 with Playwright 1.64.1 on macOS arm64. Node 24.16.0, npm 11.13.0 and Supabase CLI 2.121.0 remain pinned. This is desktop engine evidence, not physical mobile/HTTPS acceptance.

The group browser suite froze the completed production bundle before its run. The final source subsequently tightened shared civil-date and page-cursor validation and expanded backend pagination/Unicode cases; the final check and 116-case database run cover those changes. No membership UI, navigation or visual-token source changed. [Verification metadata](verification.json) records both browser and final build hashes and the exact check results. [Logs](logs/) retain the final command output and the browser report. Existing visual references were not regenerated; the membership regression does not certify the new task/list screens.

## Failure and race coverage

- Verified identity, account assertion, Origin/CSRF and exact input validation; no guest/private import or forged completion actor.
- Same-group assignment; current member/unrelated user/anonymous/direct authenticated and BFF access; worker and guard capability restrictions.
- Recurrence dates, original actor/time preservation, repeated completion, edits after completion, task archive, selected-date Undo and no XP.
- Collaborative list creation/rename, text/quantity/checks, contiguous rank moves, archive/restore, scrubbed removal barriers and refusal to recycle IDs.
- Concurrent task edits and item moves, exact receipt replay after later work, removal racing completion and removed-member receipt/read denial.
- Fifty-row task, item and occurrence pages, revision-fenced continuation, retained-record quotas and bounded Unicode fields.
- Injected receipt failure rolls back rows, ranks and group revision; original-operation retry succeeds afterwards.
- Populated member-account suppression, old-JWT rejection, separate provider purge, deidentified surviving history and group-wide content cascade.

The first broad infrastructure run passed 114/115 cases; its only failure was the schema inventory expecting 12 private tables before `shared_limits` added the thirteenth. The assertion was updated, all ten isolation checks passed, and the final full 116-case run passed after the additional Unicode/archive scenario. The initial log is retained as dated evidence.

Local setup initially refused numbered historical migration copies. All 117 test and 44 local copies were preserved in private `migration-duplicates-20261023-group02` directories, including two test drafts and one local draft differing from canonical files. Only canonical migration files remain active; neither old SQL nor database migration history was rewritten. No database reset, profile reset, volume removal or secret rotation was used to apply this change.

## Files and preservation

The new additive migration is `20261023145156_shared_family_content.sql`. Runtime changes are the shared-content contract, projected content reader, existing group command/router extension and safe shared-error allowlist. New unit/database tests and the lifecycle/isolation fixture updates cover the added boundary. Current product, architecture, security, task and lifecycle documents agree about the remaining UI/priority work.

[The preservation manifest](preservation.json) compares this increment with its start: no baseline file is missing; existing personal/domain/storage/sync code, UI composition/styles, original assets, prior migrations, lockfile and 720 visual reference images remain unchanged. The automatically maintained Impeccable hook cache is identified separately. The user’s 4173 preview was never accessed or loaded with fixtures. Existing visual goldens and historical evidence were not rewritten; generated bundles remain outside the recorded source change set.

Rollback disables family route exposure while preserving schema, receipts, item barriers, deidentified member references and lifecycle hooks. Keep the compatible cleanup implementation: an older readiness hook deliberately refuses deletion when the new tables exist. Never remove the deletion ledger or reset storage to recover.
