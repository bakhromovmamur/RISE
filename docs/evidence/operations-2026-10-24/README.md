# OPS-01 local acceptance — 24 October 2026

**Task:** OPS-01 · **Requirements:** PRD-20, SEC-07. **Disposition:** local technical acceptance complete; REVIEW for named operating contacts, staffed/external alert routing and hosted acceptance. Cloud provisioning remains pending by user direction.

## Outcome

Implemented a read-only local operations boundary and an explicit user-controlled support download while retaining the current app composition and saved-data contracts. Product analytics, advertising identifiers and session replay remain off. No cloud project, deployment, real-person message or live push delivery was performed.

- BFF diagnostics now include coarse route area, server-owned request ID, bounded latency/status, UTC time and runtime/web release IDs. Input URLs, bodies, credentials, actors and raw error messages are excluded. Logging failure cannot change a completed action.
- Five-minute bounded request counters combine with real database aggregate queue/lease/expiry/failure/deletion metrics. Missing, stale, mismatched-release and unavailable signals fail closed. Local runtime source/lockfile fingerprints distinguish BFF changes from the actual PWA web fingerprint.
- A separate restricted monitor login can execute only the fixed local/test aggregate capability. It cannot read private rows, mutate queues, become a guard/worker, or use BFF/provider/signing credentials. Forced RLS and narrow no-login/no-bypass function ownership remain intact.
- Private alert files record deduplicated raise/recovery transitions with a 200-event/seven-day bound while checks run. Corrupt evidence, backward clocks and failed routing remain failures rather than false acknowledgment. A synthetic drill exercises the same file route without sending anything.
- Settings → Your data → Download diagnostics is localized in English, Russian and Uzbek Latin. It exports only technical status fields, flags unacknowledged local saves as pending, provides visible failure/retry, and leaves profiles/recovery sources unchanged. Unknown errors are replaced with a fixed code.

The [operating contract](../../LOCAL-OPERATIONS.md) documents commands, thresholds, incident steps, privacy, retention, ownership gaps and rollback.

## Changed surfaces

| Area | Files |
| --- | --- |
| Runtime diagnostics and monitoring | `server/operations/{requests,monitor,database,files,release}.ts`, `server/app.ts`, `server/main.ts`, `server/config.ts`, `scripts/infra/ops.ts` |
| Additive installation/configuration | `supabase/migrations/20261024180000_local_operations.sql`, `infra/provision.ts`, `scripts/infra/local.ts`, package scripts; protected local/test state gains only its separate monitor password and `ops.env` |
| Explicit support download | `src/diagnostics/{Diagnostics,text,report}`, one insertion into `src/Personal.tsx`; no stylesheet, domain or storage-format change |
| Verification | New unit/database/runtime/browser diagnostics cases; extended secret isolation, BFF health metadata and production-policy download checks |
| Current documentation | README, PRODUCT, ARCHITECTURE, SECURITY, AGENTS, TASKS, backend environment guide and the new operations contract |

No Git repository exists. Review used a before-change file snapshot and content hashes. No branch, commit or deployment was invented.

## Verification

Executed on macOS 26.6.2, Node 24.16.0, npm 11.13.0, Playwright 1.64.1 and isolated local/test Postgres 17.11. Browser versions: Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Exact final fingerprints are in [environment.json](environment.json).

| Exact command | Result and evidence |
| --- | --- |
| `npm run infra:up -- local`, then `npm run infra:up -- test` | PASS; additive migration applied and fixed identities, restricted BFF role, Auth health and loopback bindings verified. Original credentials/identities and every existing application/private table count were unchanged immediately after migration. [Preservation](migration-preservation.json) |
| `npm run check` | PASS: pinned dependency/toolchain validation, lint, app/tool/server types, **302 unit/tooling tests**, production and review builds. [Log](check.log) |
| `npm run test:infra` | PASS: **176 real database/runtime checks**, run sequentially, including direct unauthorized access, forced RLS/function ownership, stable replay/rollback, lifecycle/group/push regressions and the new monitor/process cases. [Log](infra.log) |
| `npx tsx --test --test-concurrency=1 tests/infra/operations-runtime.test.ts` | PASS: real entry-point startup, current private snapshot, real CLI alert routing/drill, no canary exposure, graceful shutdown and unavailable-health alert. The runtime case also runs in the full infrastructure suite. [Log](runtime.log) |
| `npm run test:browser -- tests/diagnostics.browser.spec.ts tests/accessibility.browser.spec.ts` | PASS: **57 checks** across all three engines; explicit download, private canaries absent, exact saved-state/legacy-source preservation, keyboard action, localized failure/retry and existing accessibility behavior. [Log](browser.log) |
| `npm run test:backend` | PASS: **21 checks** across all three engines, including real production CSP download, backup/restore, offline behavior, private monitor-file exclusion and generic health metadata. [Log](backend.log) |
| `npm run test:production` | PASS: **66 checks** across all three engines. [Log](production.log) |
| `npm run test:pwa` | PASS: **45 real-worker checks** across all three engines. [Log](pwa.log) |
| `npm run test:visual` | PASS: **48 scenarios / 720 existing screenshot comparisons**, without regenerating references. [Log](visual.log) |
| `npm run ops:check -- local` | Correctly returned **2** with `health_unavailable` and `diagnostics_stale`: no 4192 BFF listener was running. The restricted database probe succeeded and no queue/deletion alert was raised. No sender, repair or destructive cleanup was started to make the display green. [Redacted command output](local-monitor.log) |
| `npm run check:docs` | PASS: links/anchors and task/requirement consistency checked. [Log](docs.log) |

The diagnostic row was checked at 320/375/393/430 px, 100%/200% text, both themes and all three languages in all three engines (144 layout combinations). Supplemental 393 px/200% screenshots were inspected: [English light](en-light-diagnostics.png), [English dark](en-dark-diagnostics.png), [Russian light](ru-light-diagnostics.png), [Russian dark](ru-dark-diagnostics.png), [Uzbek light](uz-light-diagnostics.png), [Uzbek dark](uz-dark-diagnostics.png). They use synthetic profiles only. The existing 720 references remain unchanged.

## Preservation and privacy evidence

[Source preservation](source-preservation.json) records unchanged public assets, eight existing stylesheets, 75 existing domain/persistence/sync/push/group module files, dependencies and the pinned lockfile. The only modified existing app-source file is the Settings insertion; diagnostics are new modules. Browser checks compare the saved profile and original legacy recovery source before/after downloading. Migration preservation checks compare existing protected configuration fingerprints (excluding the intentionally added monitor password) and table counts; they do not export row contents.

The [secret scan](secret-scan.json) checks known local/test private credentials against changed/new source, final production/review bundles and evidence, reporting only matches by filename. No private values matched. Protected provider/CLI status, raw infrastructure logs, account exports, cookies and usable codes are not included in this evidence directory.

## Corrections during implementation

Initial migration attempts failed on administrative ownership/grant ordering. The order was corrected before successful application; capability grants were not widened. An integration test initially tried to assume a BFF role from the restricted administrative connection; it was corrected to test denial through the actual BFF/worker connections instead of weakening role membership.

One verification run overlapped production-entry tests on reserved port 4181. The test-server guard rejected the occupied port. [That failed run is retained](check-port-collision.log); the final `check`, production and PWA runs were then completed with the required separation. The final report projection also guards pending local writes, and an alert-journal clock rollback preserves existing evidence rather than erasing it.

The build still reports the pre-existing large-chunk and ineffective-dynamic-import warnings. OPS-01 does not claim to complete QUALITY-03 or certify capacity.

## Remaining limits and rollback

Primary incident owner, backup and a dedicated private support/security address remain unassigned. The existing private project conversation is interim only. The test drill proves local file routing, not human receipt, paging or 24/7 coverage. Check/watch is an explicit local process, not an installed always-on service; process absence itself needs an external supervisor before hosted acceptance. Snapshot/history retention stops when monitoring stops. stdout logs have no new collector/rotation service.

Hosted health/alert routing, HTTPS infrastructure, physical-device delivery and release acceptance remain pending. Backup freshness/RPO/RTO is explicitly unconfigured (OPS-02); deployment/rollback automation remains OPS-03. Cloud provisioning is still pending.

Rollback can stop the monitor and restore earlier app code while retaining the compatible additive roles/function/policies and existing data. No browser database/cache format or account/domain schema changes. Do not drop ledgers, reset profiles, delete queues or rotate existing credentials as a rollback shortcut. Diagnostic files are not backups and are never inserted into public PWA caches or portable profile exports.
