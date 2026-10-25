# Backend and database environments

**Task:** INFRA-01 · **Updated:** 24 October 2026  
**Implemented:** local/test Fastify BFF, standard Supabase Postgres/Auth, additive migration, restricted runtime identities and integration checks.  
**Pending by product-owner direction:** hosted staging/production provisioning. Hetzner is the existing provider; its plan and Node/process capabilities are unknown. No cloud project, DNS record, production service or billable resource was created.

This foundation serves the production web bundle with [local email-code sessions](AUTH-SESSIONS.md), [relational personal records/RLS](PERSONAL-ACCOUNTS.md) and [selected import/account sync](ACCOUNT-SYNC.md). Guest storage and its recovery source remain separate and unchanged. Membership UI/API, family task/list controls and private priority integration exist locally. Exact squad preview/publication is locally verified; [optional generic group notices](GROUP-NOTIFICATIONS.md) now connect separate group/device consent and current receiving authorization. Hosted provisioning remains pending. See [the squad boundary](SQUAD-SNAPSHOTS.md). PUSH-01–04 add [local subscriptions](PUSH-SUBSCRIPTIONS.md) and the [consented scheduled sender](LIVE-PUSH-SENDER.md).

## Environment map

| Environment | Web/BFF origin | Database | Auth/Data API | Local mail sink |
| --- | --- | --- | --- | --- |
| Local | `http://127.0.0.1:4192` for browsing; retained installation entry 4190 | `127.0.0.1:55322` | `127.0.0.1:55321` | `127.0.0.1:55324` |
| Test | `http://127.0.0.1:4191` | `127.0.0.1:55422` | `127.0.0.1:55421` | `127.0.0.1:55424` |
| Staging | Separate HTTPS hostname, not yet chosen | Separate project, not created | Separate project, not created | Verified sender pending |
| Production | Intended `https://habit.saraftech.com` | Separate project, not created | Separate project, not created | Verified sender pending |

Each local environment has a distinct Docker network, volumes, installation UUID, ES256 Auth signing key, legacy signing secret, publishable/secret API key and four separate runtime passwords (BFF, sender, lifecycle and aggregate-only operations). Resource names include the environment and a hash of the checkout path. The controller only operates on its named stack. It never stops all Docker projects or removes volumes.

The pinned Supabase CLI uses its standard **development-only Postgres administrator password**. This is not a hardened multi-user database installation. All published ports must bind to `127.0.0.1`; a scoped Docker command adapter supplies that bind because CLI 2.121.0 publishes unqualified ports. The controller inspects the actual Docker bindings and stops its stack if any published address differs. Use these stacks only on a trusted development machine, never as public staging/production.

The existing personal preview on **4173** is separate. Do not point fixture tools at it. New backend browser checks use fresh contexts on **4191**; the established review/production/PWA/visual suites keep 4180/4181/4182.

## Reproducible local setup

Prerequisites: pinned Node 24.16.0/npm 11.13.0, a working Docker daemon and enough free memory/disk for two standard Postgres/Auth stacks. First startup downloads the CLI's versioned container images. No Supabase cloud login is needed.

~~~sh
npm ci
npm run build
npm run infra:up -- local
npm run infra:up -- test
npm run infra:verify -- local
npm run infra:verify -- test
npm run test:infra
npm run test:backend
~~~

Start the local BFF using its protected runtime file:

~~~sh
npm run server:local
~~~

Open `http://127.0.0.1:4192`. This browser origin has separate device storage; it does not move or import saved profiles from 4173 or 4190. The old 4190 entry remains available to Chromium through `node --import tsx --env-file=.rise-infra/local/server.env server/main.ts`. Export/reviewed restore is explicit when a user chooses to transfer guest data; no automatic transfer occurs.

The [original 4190 observation](evidence/sync-2026-10-22/runtime-health.json) is resolved: WebKit and Firefox block that port. `server:local` selects only the fixed local browser origin 4192 through `LOCAL_BROWSER_ORIGIN`; `APP_ORIGIN` and the database marker remain 4190. Database verification compares `installationOrigin`, while Host and CSRF checks use the exact serving `origin`. No arbitrary alias, test/hosted override, credential rotation or data migration is allowed. Host-only local cookies can be shared across ports; use one local entry at a time in a browser profile. The separate test installation retains its own cookie prefix. `npm run check:local-browser` freezes the completed build, refuses an occupied 4192 listener and uses fresh contexts without fixtures/account writes. [Current evidence](evidence/product-review-2026-10-23/README.md).

Stop only these environments, preserving their database volumes and credentials:

~~~sh
npm run infra:stop -- local
npm run infra:stop -- test
~~~

`infra:up` reapplies pending committed migrations and verifies the existing installation; it does not reset a database or replace its identity. Configuration changes to an already running container require stop/up. A damaged state file, existing identity mismatch or unreadable credential fails closed. Preserve `.rise-infra/` privately if the development databases need to survive a workstation move. Do not delete it to repair an error while its volumes still exist.

The public email-code template is copied without replacing its file identity because the CLI mounts it directly into the gateway. Unchanged templates are not rewritten. `infra:verify` now checks the exact confirmation and magic-link template responses as well as database/Auth health and loopback bindings. An older setup may have a stale mount and report `local_email_template_unavailable_restart_project_gateway`; restart only that installation's labeled `supabase_kong_<projectId>` container, then rerun verification. Do not reset Auth or remove database volumes. The two existing local/test gateway mounts were repaired on 25 October 2026; [evidence](evidence/signin-queue-2026-10-25/README.md).

## Administrative migration and runtime boundaries

`supabase/migrations/20261021161440_infrastructure_foundation.sql` was created with the pinned CLI's `migration new` command. Both local stacks were initialized from it. It adds only:

- Empty `rise` and private `rise_private` schemas.
- Non-login capability roles `rise_bff`, `rise_worker` and `rise_lifecycle`.
- One installation marker recording environment, canonical app origin, provider project reference, installation UUID and schema contract version.
- A private registry of synthetic Auth fixture IDs; no habit, prayer, pause, note, membership or sharing tables.

Both foundation private tables enable and force RLS. That migration adds no definer function or bypass-RLS application role. Private schemas are excluded from the exposed Data API, with default table/sequence/function privileges revoked for the schema owner.

The two additive AUTH-01 migrations add four forced-RLS private metadata tables (contexts, encrypted challenges, hashed/encrypted sessions and HMAC rolling limits). The BFF gains only their CRUD capability. A separate non-login `rise_session_guard` owns the fixed boolean active-session function, with bounded Auth/session column grants and owner-filtered policies; authenticated callers may execute the predicate but cannot read the private tables. No application role bypasses RLS. See [the reviewed session boundary](AUTH-SESSIONS.md#private-storage-and-authorization).

Three additive AUTH-02 migrations add 24 forced-RLS `rise` tables, owner-inclusive foreign keys, revisions, invoker-derived XP totals, immutable habit snapshots and Unicode-compatible JSON byte bounds. Both stacks also apply the additive SYNC-01 migration: two owner/current-session forced-RLS staging tables and bounded prayer-history compatibility. Those initial AUTH/SYNC increments established six private infrastructure/auth tables and 26 `rise` tables (24 canonical personal/receipt plus two staging); later lifecycle/push/group migrations extend that schema. Schema `rise` remains unexposed by the Data API. Normal commands use the existing restricted BFF login with transaction-local claims established from verified sessions; no administrator credential or new privileged role is used. [The personal guide](PERSONAL-ACCOUNTS.md) records the complete migration list, grants, transaction contract and recovery limits.

OPS-01 adds [aggregate-only local monitoring](LOCAL-OPERATIONS.md), private status/alert files and an explicit user diagnostic download. `infra:up` adds only the new operations password to older state; existing keys/volumes/data are preserved. Its capability is a no-login/no-bypass guarded function with narrow column reads and forced RLS, not direct table access. Cloud provisioning and incident ownership remain pending.

Administrative bootstrap runs separately through `infra/provision.ts`. It inserts the marker only if absent, compares an existing marker without overwriting it, and creates separate generated login passwords. It refuses an unexpected role membership or elevated role. It is not imported by the BFF.

| Identity | Current privileges | Credential custody |
| --- | --- | --- |
| Migration administrator | Apply reviewed DDL; establish marker and role credentials | Administrative connection only; excluded from BFF environment |
| `rise_bff_login` → `rise_bff` | Read marker; AUTH-01 metadata; owner/session-filtered personal commands; narrow membership/family/squad capabilities; no direct shared-table writes, profile deletion or receipt mutation | BFF runtime only |
| `rise_worker_login` → `rise_worker` | Marker, narrow subscription/job dispatch, heartbeat and expired-preview cleanup permissions; no private journeys/provider tokens | Separate local sender custody; start explicitly |
| `rise_lifecycle_login` → `rise_lifecycle` | Restricted deletion job/ledger operations; no private journeys | Separate local purge process and provider-admin custody |
| `rise_ops_login` → `rise_ops` | Fixed local/test aggregate snapshot function only; no table access or queue mutation | Separate protected `ops.env`; no provider/signing keys |
| Provider `authenticated` | Owner/session-filtered personal SELECT, current-member shared SELECT and boolean session predicate; no direct writes or private metadata reads | Synthetic SQL/RLS tests; `rise` is not Data API exposed |
| Anonymous provider users | No personal/private table or totals-view access | Synthetic negative tests |

Future domain migrations must add the required owner/member policies and narrowly scoped privileges. A capability role alone does not establish business authorization. The original synthetic “removed” persona is a fixture name; GROUP-01–03 now exercise actual membership removal and stale-command/read denial against the local/test database.

For new schema work, use `npx supabase migration new <name>`, review the resulting additive SQL, test on these isolated stacks and run the advisors. Do not edit a migration already applied to a shared environment. Do not run `db reset`, `stop --all` or `stop --no-backup` as a recovery shortcut.

If the CLI reports missing old migrations despite those versions being present in the database, inspect the private generated migration directory for duplicate filenames before attempting any repair. During GROUP-04, 21 ` 2.sql` copies were byte-identical to canonical source files. They were preserved outside the migration directory in `.rise-infra/local/migration-file-recovery-20261024/`, with a private hash manifest, and the normal command then applied only the two pending migrations. No history row, key, database or profile was reset. Do not use `--include-all` or rewrite migration history to bypass an unexplained mismatch; preserve differing files and diagnose them first.

## BFF contract and failure behavior

`server/config.ts` validates required configuration before accepting traffic. Local/test installation origins, database ports and provider endpoints are fixed. The only alternate browser origin is local 4192, retaining the original installation binding. Production requires `https://habit.saraftech.com`; staging cannot use it. Hosted provider URL and database hostname/pooler username must match the configured project reference. Remote Postgres connections require certificate verification; disabling TLS through URL query options is rejected.

The BFF accepts only the `rise_bff_login` database identity. Migration, worker, lifecycle, operations and provider-administrator environment variables are rejected. Database pools and timeouts are bounded. Startup checks the actual database marker/role and Auth health before opening its listener; readiness repeats those checks. Errors expose stable generic codes without credential values or provider responses.

`server/main.ts`, `server:local` and the frozen release entry retain the existing single-process runtime and five-connection restricted pool. The [execution-thread proposal](BFF-EXECUTION.md) is archived evidence, not an enabled mode: low-load HTTP improvement did not satisfy the complete gate, and the later full100 candidate run also failed capacity after disk headroom was restored. Configuration, ports and timeouts remain unchanged; no worker setting or credential is required.

| Endpoint | Response | Cache behavior |
| --- | --- | --- |
| `GET /api/v1/health/live` | `200 {"status":"ok"}` after startup | `no-store` |
| `GET /api/v1/health/ready` | `200` with readiness/release, or generic `503` | `no-store` |
| Public web files | Existing production build only; same bytes | Immutable hashed assets; worker/index/manifest revalidated |
| Unknown API, source, secrets, provenance text, traversal or escaping symlink | `404` | `no-store` |
| Wrong Host or cross-origin Origin header | `403` | `no-store` |

Only the production build is accepted, including when serving staging. Reviewer bundles are refused. The public-file allowlist includes the current PWA manifest, worker, icons and generated assets. Logs contain generated request ID, method, route pattern and response status; they exclude raw URLs, query strings, headers, bodies, SQL and error details. AUTH-01 adds `/api/v1/session`, `/auth/code`, `/auth/verify` and `/logout`. AUTH-02 adds `GET /api/v1/personal` and `POST /api/v1/personal/commands`; all private responses are no-store. Their session/CSRF checks reuse the existing auth wrapper. SYNC-01 adds validated `/sync/head`, `/sync/pull`, `/sync/commands` and `/sync/imports/*` endpoints with expected-account assertions, consented field projections and the same session/Origin/CSRF boundary. No arbitrary-table write or canonical whole-profile upload is exposed.

The BFF now loads the shared pure domain modules through the pinned production `tsx` dependency. Always use `node --import tsx`; `npm run server:start` and the proposed systemd/test entries already include it. The existing frontend source needs no import rewrite, and browser builds still exclude backend code.

For a future reverse proxy, preserve the canonical Host. A direct loopback production readiness check would need that Host header:

~~~sh
curl --fail --header 'Host: habit.saraftech.com' http://127.0.0.1:8080/api/v1/health/ready
~~~

## Secrets and build isolation

`.rise-infra/`, real environment files and local signing keys are ignored. Environment directories use mode `0700`; generated credential/configuration files use `0600`. CLI status and failure diagnostics can contain privileged development keys, so the controller captures them into protected files and prints only safe outcomes. Do not attach those files to bug reports or CI artifacts.

`server.env` contains the BFF connection password, session-encryption key and provider publishable configuration. Separate runtime passwords/admin status remain outside the BFF process. Publishable keys are public identifiers, not an authorization boundary; signed Auth tokens, RLS and database credentials provide that boundary. The controller atomically adds the versioned session key to older protected local state once; it preserves existing installation and runtime credentials. Partial/damaged key state fails closed. See [session key rotation and recovery](AUTH-SESSIONS.md#key-custody-recovery-and-rollback).

Both Vite build variants reject imports from backend/private infrastructure directories and environment files. Public `VITE_*` variables use an allowlist: optional `/api/v1` API base and the matching build mode. Unknown public variables fail the build without printing values. The production reviewer-module guard remains. Real build failures and bundle scans test these controls; no real secret enters browser storage or deployed assets.

Rotation procedure:

1. Scope the affected environment and identity. Keep its existing protected state and database marker; do not recreate the installation.
2. Through the administrative maintenance connection, generate a fresh random password and change only that login. Supply secrets through a protected program/secret manager, never shell arguments or committed SQL.
3. Update only the corresponding process's protected configuration and restart/drain that process's old connections. PostgreSQL password changes do not invalidate existing sessions; terminate compromised sessions through the administrator if required.
4. Verify old-password rejection, new-password access, correct marker and unchanged sibling identities. The integration suite rehearses this for the test worker and restores its original credential afterwards.
5. For a hosted Auth signing-key compromise, use the provider's current key rotation/revocation process and invalidate affected sessions. That hosted drill is pending provisioning and hosted session acceptance; a local runtime-password check does not verify hosted session revocation.

## Verification

~~~sh
npm run check
npm run test:infra
npm run test:backend
npm run test:auth
npm run test:sync
npx supabase db advisors --local --workdir .rise-infra/local --type all --level warn --fail-on warn
npx supabase db advisors --local --workdir .rise-infra/test --type all --level warn --fail-on warn
~~~

`test:infra` uses real local Postgres/Auth, synthetic `@example.invalid` users, including real managed codes captured only by the local SMTP sink. It covers migration/readiness, least privilege, immutable installation identity, crossed database/password/JWT/administrator credentials, protected secret files, bundle scanning, startup refusal and runtime password rotation. AUTH-02 adds every-table ownership/stale-session denial, relational round trips, two-session command races, stable replay, generated XP, Unicode limits and injected receipt-failure rollback. It refuses production fixtures before any write.

`test:backend` freezes the production build and serves it through the actual Fastify/database adapter on 4191. It exercises current onboarding/check-in/reload, service-worker offline entry and non-public file rejection in Chromium, WebKit and Firefox. All browser contexts are new, block external origins and never use 4173. It is desktop engine evidence, not physical-device certification.

Run `test:infra`, `test:backend` and `test:auth` sequentially: the infrastructure checks briefly change the synthetic test role's grants/password to verify rejection and then restore them. Firefox's offline-emulation navigation skips workers; its browser scenario disconnects the isolated test server instead, as in the existing PWA suite. That control exists only in the test entry and is absent from the production BFF.

The CI infrastructure job starts only local Docker stacks and receives no hosted credentials. Do not upload `.rise-infra/`. Hosted GitHub Actions execution remains unverified because this folder has no Git repository/remote. Dated local evidence is in [the INFRA-01 report](evidence/infrastructure-2026-10-21/README.md), [AUTH-01 report](evidence/auth-2026-10-21/README.md) and [AUTH-02 report](evidence/personal-backend-2026-10-21/README.md).

## Hosted completion and rollout

The product owner selected the connected organization **“owner-selected Supabase organization”** for a future database setup, then explicitly requested **“Keep cloud provisioning pending.”** No project was created. The provider quoted $0/project/month on the current Free plan; that is a dated quote, not a production cost/capacity commitment or an approval for paid services. Frankfurt was proposed and remains unapproved. Hetzner's plan is not yet identified.

`infra/environments/` contains separate, deliberately incomplete staging/production BFF templates. Placeholders fail startup validation. `infra/hetzner/` contains proposed systemd/reverse-proxy examples for a Cloud/VPS host only. They have not been installed or tested on a Hetzner machine. Shared Webhosting capability must be checked before choosing a backend host; do not assume it supports Node or background workers.

Hosted acceptance still requires the correct plan/access, region/residency decision, separate projects/origins/secrets, reviewed remote migration/bootstrap, staging-only fixtures, TLS/network checks and real health/deployment evidence. Sender, backups, operating contacts and the combined $100/month estimate remain operating decisions. Local sessions now exist; hosted session acceptance and actual job capabilities remain separate gates.

Deploy compatible schema expansion before server changes and serve only a completed immutable production bundle. Keep the previous compatible release and its environment-specific configuration. Roll back application assets/server without dropping schemas, deleting markers or downgrading browser storage. No browser data needs migration for this task. A hosted rollback, database restore and physical HTTPS-device drill cannot be claimed from the local checks; OPS-02/OPS-03 record those gates.

## Primary references reviewed

- [Supabase CLI 2.121.0 source](https://github.com/supabase/cli/tree/v2.121.0), installed command help and the [CLI configuration reference](https://supabase.com/docs/guides/local-development/cli/config).
- [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles), [new API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) and [self-hosted Auth keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys).
- [Fastify server options](https://fastify.dev/docs/latest/Reference/Server/) and the [Supabase changelog](https://supabase.com/changelog).

### DATA-04 local lifecycle process

`infra:up` now also writes mode-0600 `lifecycle.env` beside each retained environment's BFF configuration. It contains that installation's restricted lifecycle database URL and local provider admin key; neither is present in `server.env`. Existing credentials/installation identity are retained. Run the separately scoped `npm run lifecycle:watch -- local` (or `lifecycle:run`) for primary purge. Protected ledger export/replay and shutdown behavior are documented in [ACCOUNT-LIFECYCLE](ACCOUNT-LIFECYCLE.md). Do not source lifecycle/admin credentials into BFF or browser processes. Hosted provisioning remains pending.

OPS-03 now adds [local sealed packages, activation and rollback](LOCAL-ROLLOUT.md), using the existing protected BFF configuration and fixed 4192/4191 origins. The implementation requires an identical verified schema and storage/API contract; it performs no migrations or cloud provisioning and starts no sender. The host examples above remain uninstalled proposals.
