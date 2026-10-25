# OPS-03 — local release and rollback evidence

Dates: 24–25 October 2026 (Asia/Tashkent; UTC event records remain dated 24 October). Requirements: PRD-20, SEC-06. Environment: local macOS, pinned Node 24.16.0/npm 11.13.0, fixed local/test infrastructure. Cloud provisioning remains pending.

## Scope

Sealed production packages, pinned runtime dependencies, strict schema/storage compatibility, protected configuration, candidate HTTP readiness, local activation/rollback records, server-only write pause and normal service-worker update coordination. See [the operational contract](../../LOCAL-ROLLOUT.md).

No database migration, UI redesign, account-cache format change or domain change was made. The release commands do not start push sending. Local and hosted operation are distinct; hosted supervision and full release acceptance remain open.

## Recorded checks

- Initial `npm run check`: passed, 311 unit/domain/tooling checks, lint, app/tool/server types, production and review builds. A final parallel repeat hit the pre-existing two-second `push-renewal.test.ts` deadline (310/311); the focused and sequential final checks are recorded below. No renewal logic or timeout was changed. Existing large-chunk warnings remain under QUALITY-03.
- `node --import tsx --test tests/release.test.ts tests/server.test.ts`: 13 passed. Covers drift/missing migrations, incompatible contracts, changed/extra files, escaping links, review/incomplete assets, server write pause and narrow previous-chunk fallback.
- `npm run test:rollout`: 6 passed across Chromium, WebKit and Firefox. A deliberately damaged candidate is refused without changing the active release; a candidate that passes probing but fails real startup restores the previous healthy runtime; malformed requests cannot stop it. Real verified sessions, exact pending account operations, guest state and legacy source survive a newer worker and compatible rollback. Resuming commits the reflection once and retains 20 habit XP. Public caches contain no API response. [Redacted release records](rollout-records.json).
- `npm run test:pwa`: 45 passed across the three engines, including offline cold starts, incomplete/incompatible updates, storage failures and all-tab update holds.
- `npm run test:production`: 66 passed, including review-entry isolation, retained profiles, deferred screens and prayer correction behavior.
- `npm run test:infra`: 178 passed against real isolated PostgreSQL/Auth, including forced RLS, current authorization, replay, lifecycle, recovery and sender boundaries.
- `npm run test:backend`: 21 passed; `npm run test:auth`: 21 passed; `npm run test:sync`: 69 passed. Credential-flow traces, videos and screenshots are disabled.
- `node --import tsx --test --test-concurrency=1 tests/infra/release-runtime.test.ts`: 1 passed. Uses a real sealed runtime and database; refuses a stale rollback choice after a newer pause request, handles repeated interrupts during rollout and verifies the child/port/lock are gone. The shutdown-only refinement followed the full browser matrix; this targeted real-runtime test covers that final change.
- `npm run typecheck && npm run lint`: passed after the added operational regression code.
- Final `node --import tsx --test tests/push-renewal.test.ts`: 13 passed; `node --import tsx --test --test-concurrency=1 tests/*.test.ts`: 311 passed. Final `npm run build` and `npm run build:review` passed. This verifies the existing parallel deadline separately without changing its logic or timeout.
- Final real-runtime race/repeated-interrupt test: 1 passed in 27.6 seconds. The additional local 4192 startup/production-shell/repeated-interrupt check exited 0 and removed its lock.
- `npm run check:docs`: passed (41 documents, 665 links, 62 anchors and 38 task IDs).

## Review notes

Initial packaging under `.rise-infra` was correctly rejected by the existing private-import build guard; compilation now happens in an isolated temporary directory. The health probe uses Node HTTP because Node fetch ignored its Host override. The browser test waits for the waiting worker's verified asset cache before choosing Update RISE; no worker/data reset bypass was added. Playwright now uses graceful shutdown. A separate local interrupt check exposed duplicate-signal cleanup; handlers now remain installed from lock acquisition through final cleanup. The early forced-shutdown and duplicate-signal stale locks were removed only after confirming their processes and ports were absent. The final runtime regression verifies cleanup without manual lock removal.

## Environment and preservation

macOS 26.6.2; Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Browser evidence uses isolated 4191/4181 origins and synthetic profiles. No physical-device or hosted claim is made.

All 202 baseline files under `src/`, `public/`, migrations and the dependency lockfile are unchanged. The ordinary production web release remains `14b94acfaeaf38b5f855`. Publication stamps distinguish sealed releases without changing screen content. Existing visual references were not regenerated. The user's 4173/4190 browser profiles were not opened or reset.

A real local selection/start/HTTP-health/production-shell check on 4192 preserved all 62 application tables and all five protected configuration files, verified by before/after content hashes. No schema migration, profile import or real delivery was performed. Hosted-target CLI admission was rejected before configuration/provisioning. Intermediate generated packages were removed while retaining referenced releases.

## Changed surface

- `scripts/infra/release.ts` and `release/{package,runtime,entry}.ts`: sealed build/admission, fixed-installation selection, probing, activation/rollback, private records and shutdown.
- `server/config.ts`, `server/app.ts`: strict server-owned write pause, existing logout authorization and previous fingerprinted JS/CSS fallback.
- `scripts/pwa-build.ts`, `vite.config.ts`: validated publication identity; default builds remain stable.
- Unit, real-runtime and rollout tests; isolated rollout entry/config; npm commands and CI gate. No dependency or migration changes.
- Root status/architecture/security/capability instructions, backend/PWA guides and the local rollout runbook.

## Limits

Admission currently requires an identical verified migration set and storage/API contract. Schema expansion, hosted staging/production rollout, zero-downtime infrastructure, signed artifact attestation and installed always-on supervision are not claimed. Release records describe observed events; current health determines availability. The supervisor does not start push/lifecycle/maintenance jobs or certify other independently running senders. Keep existing heartbeat/consent checks and explicit worker update leases. Cloud provisioning and full public-release acceptance remain pending.

## Final artifacts

[Verification summary](verification-results.json), [preservation and known-secret scan](preservation.json), and [redacted deployment/rollback records](rollout-records.json). The final scan checked 283 source/build/manifest/public-asset files against 20 actual installation secret values, with zero matches; it is not a new dependency-vulnerability audit. The final local release was health-checked, then stopped after verification. No test BFF or deployment lock is intentionally left running. OPS-03 is REVIEW for the remaining operating gates; OPS-04 is the next local task.
