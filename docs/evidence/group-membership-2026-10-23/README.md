# GROUP-01 local membership backend verification

23 October 2026 · macOS · retained local/test installations · PRD-14, SEC-01 and DATA-04 integration. Cloud provisioning remains pending by the user's direction. Only synthetic accounts/local inboxes were used; no real-person invitation, message or external push was sent. The personal preview/profile on 4173 was not accessed.

## Result and scope

The local/test BFF now supports current group membership, explicitly shared nicknames, per-member delivery preferences, hashed single-use seven-day invitations, minimal invitation previews, owner administration, atomic recent-auth transfer, archive/restore, leave and explicit group deletion. The database enforces a single active owner, forced current-membership RLS and narrow function/table grants. Group changes, revisions and immutable receipt acknowledgments commit together. Invalid invite attempts retain bounded quota charges; expired operation replay cannot silently recreate intent after receipt retirement.

Account deletion now refuses owned groups, scrubs non-owner membership before suppression and retains deidentified historical member IDs. A restrictive deletion-ledger policy independently prevents unresolved suppression. The isolated lifecycle process commits terminal group cleanup before managed Auth deletion and handles restored pre-transfer ownership under a retained ledger. Future shared-content and notification tables still fail closed until their own hooks exist. The sender can perform bounded expired invitation cleanup without reading group data or obtaining membership authority.

**GROUP-01 remains IN PROGRESS.** The existing browser group screens are still local simulations. Real invitation fragment handling/confirmation, form/cache scope, localized group errors and the complete membership browser journeys remain unfinished. Shared family tasks/lists, squad snapshots, group notification integration and full deletion/export/cache acceptance remain GROUP-02–05. These backend tests do not prove complete real collaboration or a production release.

Changed implementation: `src/contracts/groups.ts`, `server/groups/{repository,routes}.ts`, route registration in `server/app.ts`, the lifecycle repository/worker and sender retention tick. Tests: `tests/group-contract.test.ts`, `tests/infra/groups.test.ts`, updated schema inventory and the future-module fail-closed lifecycle test. Additive migrations, applied to both retained installations:

- `20261023123106_real_group_membership.sql`
- `20261023123911_group_guard_auth_usage.sql`
- `20261023124103_group_session_predicate_grant.sql`

The later two preserve managed Auth's schema ownership and grant only the existing session predicate through its actual owner. No privileged Auth-table grant, private journey read, provider-token access or runtime guard-role membership was added. The capability assertions and direct negative tests verify the effective grants.

## Verification

| Exact command | Result |
| --- | --- |
| `npm run infra:up -- test` and `npm run infra:up -- local` | Additive migrations applied; identity, restricted role, Auth health and loopback binding verified; existing volumes/keys retained |
| `npm run check` | 219 unit/tooling tests, lint/types, production and review builds pass |
| `node --import tsx --test tests/infra/groups.test.ts` | 11 real database/BFF membership tests pass |
| `npm run test:infra` | 105 tests pass on final server changes, including existing auth/sync/lifecycle/push regressions |
| `npm run test:sync -- lifecycle.sync.spec.ts` | 12 checks pass in Chromium, WebKit and Firefox |
| `npm run lint` and `npm run typecheck` | Pass after the final server query/test inventory changes |
| `node_modules/.bin/supabase db advisors --local --workdir .rise-infra/test --type all --level warn --fail-on warn` | No issues |
| Same advisor command with `--workdir .rise-infra/local` | No issues |
| `npm run check:docs` | Current-document links/anchors, task metadata/dependencies and PRD mappings verified; see accompanying log |

Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. Browser evidence covers existing export, recent authentication, failed device cleanup, cross-tab guest preservation and lost deletion replies. No visual change or new membership UI is claimed. No frozen visual reference was regenerated; existing frontend/design/domain sources are unchanged from the preceding milestone apart from the new unused-by-UI contract module. The existing Vite bundle-size advisory remains.

Membership coverage includes verified session/Origin/CSRF, strict unknown/private-field rejection, two-account visibility, minimal previews, concurrent single-use acceptance, exact lost-response retries, revoked/expired/consumed links, removal followed by stale token/receipt access, fresh explicit rejoin, recent-auth transfer, archived restrictions, own-only preferences, no orphaned owner, concurrent revision conflicts, direct role/table denial, receipt-write rollback, failed suppression rollback, transfer-versus-deletion races, deidentified provider purge, suppressed backup ownership replay and bounded retention. Personal XP/revision stay unchanged by group activity.

The initial runs found missing effective grants on managed-owned Auth/schema functions; the narrow binding/grant migrations fixed them without broadening Auth data access. The first full regression then found its expected private-table inventory still listed ten tables; it now includes the two new rate-control tables, while retaining the requirement that every private table forces RLS. The final full regression passes 105/105.

The migration runner initially refused duplicate migration copies in both protected local input directories. All 21 duplicate files per directory matched both their canonical copy and repository source byte-for-byte. They were preserved in dated protected `migration-duplicates-*` directories outside migration input. No migration history, database, credential, volume or saved browser profile was reset or deleted to address this.

## Evidence and remaining gates

[Full check](check.log), [final database regression](infra.log), [browser lifecycle checks](lifecycle-browser.log), [test advisors](advisors-test.log), [local advisors](advisors-local.log), [final lint](lint.log), [final types](types.log), [document validation](documents.log) and [source/preservation manifest](preservation.json).

The [membership guide](../../GROUP-MEMBERSHIP.md) specifies the API, locks, grants, retry/retention policy and rollback constraints. Keep schema/receipts, the restrictive ledger gate and lifecycle cleanup when disabling group route exposure. An older worker must not process restored group ownership without the new terminal hook. The sender must be running for periodic invitation cleanup; hosted supervision/retention deadlines remain unverified. Group notification generation is not enabled by a preference save. Actual browser invitation consent and real shared content remain the next implementation work.

Implementation references: [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [private function permissions](https://supabase.com/docs/guides/database/functions) and [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html). The current [Postgres minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) and [TLS cipher notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) were reviewed; this change adds no affected extension/operator or hosted TLS configuration and does not upgrade the pinned runtime.

## Follow-on browser increment

The subsequent [membership browser report](../group-ui-2026-10-23/README.md) records the real account-selected screens, invitation consent, durable retry recovery, localized layouts and browser verification. This report retains its earlier backend-only scope and original results. The task register records the latest acceptance state; shared-content and hosted gates remain separate.
