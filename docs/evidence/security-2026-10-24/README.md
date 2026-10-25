# SAFE-01 — Integrated local security verification

24 October 2026 · SAFE-01 · SEC-01–06 / NFR-06–07 · PRD-03–04, PRD-10–11, PRD-13–15 and PRD-18. Retained local/test Postgres/Auth/BFF on macOS. Cloud provisioning remains pending. This is local acceptance evidence, not a hosted release decision or physical-device certification.

**Local review complete; SAFE-01 is REVIEW for hosted/device acceptance.** Both confirmed local hardening gaps are fixed. No local test failure remains unresolved after the documented test-only corrections. The original failed runs remain visible; they are not rewritten as successful executions.

## Scope and confirmed gaps

The review traced BFF route/session boundaries, runtime validation, personal/group projections and authorization, privileged SQL capabilities, notification endpoint/transport/receive checks, public-cache behavior, lifecycle suppression and build/credential isolation. Existing entity-specific real-database and browser suites provide the integrated scenarios; new tests cover cross-cutting policy, route and installed-schema gaps.

1. **Missing script/framing policy.** The BFF had `nosniff`, referrer and cache headers, but no CSP or frame denial. The added header regression fails against the original server. The enforced policy now blocks inline script, event handlers, string evaluation, base replacement and embedding, while allowing only the required same-origin resources. This is defense-in-depth hardening; the source review did not find an application raw-HTML injection sink.
2. **Missing feature restrictions.** The BFF now permits self-origin geolocation and disables unused camera, microphone, display capture, payment and USB. No permission is requested or notification consent changed.
3. **Header-only rollout would retain old offline policy.** The public release previously depended only on asset/template bytes and the storage contract. The build now fingerprints the browser policy too, so a policy-only change reaches an installed app through its existing explicit safe update. The new build regression checks changed policy → changed release, unchanged interface and repeatable identical builds. Cached responses preserve the policy offline. Open/older offline documents retain their old policy until that update is applied; no profile or cache is forcibly cleared.

`server/browserPolicy.ts` owns the policy; `server/app.ts` applies it before host/origin rejection; `scripts/pwa-build.ts` binds it to release identity. Tests change in `tests/server.test.ts`, `tests/security-build.test.ts`, `tests/infra/isolation.test.ts`, `tests/infra/security.test.ts` and `tests/infra/security.infrastructure.spec.ts`. The style-only inline exception is documented in [the contract](../../LOCAL-SECURITY.md): existing React progress/chart/motion/layout attributes remain. Scripts have no inline/evaluation exception.

## Verification coverage

The installed-schema test checks forced RLS across all application tables and non-login/non-bypass owners, empty search paths and no PUBLIC execution for privileged functions. The route matrix checks ten private read routes, duplicate session/context cookies, and origin rejection across all 27 POST routes. Valid empty-account reads do not create a journey. Malformed, oversized and prototype-bearing input returns bounded errors without leaking its synthetic canary to responses/logs.

Entity-specific database suites separately test valid owner/member actions, unrelated/removed/expired identities, forged metadata, cross-owner/group keys, immutable receipts, lost replies, revocation races, exact squad previews, current-source notification authorization, recent authentication, populated deletion and restored-backup suppression. No RLS grant, deadline, quota, domain calculation, data schema or privacy projection was relaxed to make a test pass.

Browser policy tests use the real BFF and browser CSP enforcement. Ordinary same-origin script loading tests evaluation restrictions: Playwright direct evaluation bypasses CSP and is unsuitable for that assertion. Service workers are blocked only in synthetic attack probes so WebKit reaches the test script route. A separate real-worker test covers onboarding, deferred group loading, backup download/restore workers, durable records and offline headers. Authored markup remains plain text through migration/reload. Browser credential suites disable automatic screenshots/video/traces.

## Test development observations

The original header assertion failed as expected. The first report-only journey used the wall clock and expected a daytime habit action after its label had changed; it was corrected to the existing isolated daytime clock and current account-button name. An initial new matrix type error came from optional properties inferred in a heterogeneous header array and was corrected with an explicit string-record type.

The first evaluation probe ran inside Playwright's privileged evaluation and therefore executed even with CSP. Moving evaluation into a normal page-loaded script verified browser enforcement. WebKit's real worker bypassed that synthetic route in one subsequent run; the attack-only context now blocks workers, while the distinct offline test still exercises the real worker. These initial failures are retained and are not counted as acceptance. The policy was not weakened to accommodate test tooling.

The first group regression run hit a detached “Try again” control in the English shared-content layout matrix after 15.4 seconds, consistent with the reader's 15-second refresh replacing the control. The error snapshot retained the intended read-error scene; the UI bundle was byte-identical to the preceding release. The run was interrupted after recording the failure. The visual check now re-resolves the control within a bounded retry, reasserts the read-error scene, and still requires the last control and Close to be in the viewport. This changes only `tests/groups/content-layout.groups.spec.ts`; it does not change refresh behavior, skip an assertion or update reference images. The initial interrupted run remains separate from final acceptance.

The subsequent complete group run passed 110 cases and exposed the same detached-control race in Chromium's English squad layout after 15.4 seconds. The family correction passed all nine language/engine combinations. `tests/groups/squad-layout.groups.spec.ts` now uses the same bounded scene/reachability assertion. Lint and all type checks pass after this test-only correction. All nine affected squad-layout cases pass on the focused recheck, without runner retries or skipped cases. The passing application cases are not repeatedly rerun for this assertion repair. The full run's original failure remains in its log/report; it is not relabeled as a clean full-suite execution.

Both retained databases report PostgreSQL 17.11, with neither `ltree` nor `btree_gist` installed. The current Supabase changelog review therefore required no speculative database upgrade. The recorded npm dependency audit reports zero vulnerabilities; both local/test security advisors report no issues. These checks supplement the explicit adversarial tests rather than certifying all infrastructure.

## Preservation and limits

Source comparison preserves all `src/` files, original public assets/worker source, database migrations, dependencies and persisted formats. Compared with the recorded increment-13 build, every application JavaScript/CSS asset and every review-build file is byte-identical. Only `dist/index.html` and the generated `dist/notifications-sw.js` change, carrying the policy-aware release fingerprint. Built bundles are not copied into this evidence directory.

This workspace has no Git repository. The review uses a pre-change file-hash manifest, a retained implementation patch and release hashes instead of inventing a commit or branch identity. Production release: `f10c7d5e178eb33c3fd4`. Environment: macOS 26.6.2, Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. These are desktop engine results, not physical mobile compatibility claims.

Tests use new isolated browser contexts, fixed test origins and synthetic accounts/subscriptions. The saved preview on 4173 was not accessed. Email stayed in the local sink; outbound push uses the existing injected boundary. No real message/invitation, deployment, DNS change, provider project, key replacement or profile reset occurred. Existing isolation tests temporarily exercise and restore the test worker's credential/grants through their established scoped regression.

The dependency audit covers the pinned npm graph; it is not a container/OS vulnerability scan. Known-secret scanning checks exact current protected local/test credential values without printing them; it is not an unknown-secret detector or screenshot OCR. Provider/host TLS, HSTS, Secure cookies, trusted proxy/IP attribution, hosted key/backup operations, physical-device notification privacy and SEC-07 contacts/monitoring remain open. QUALITY-03 capacity remains failed/unaccepted and was not rerun by this security task.

Rollback restores compatible BFF/build code and rebuilds public assets; it requires no migration or personal-data modification. Keep all guest/account storage, outboxes, cancellation intent and deletion ledgers. Removing policy enforcement weakens protection and must remain an explicit security rollback, not an equivalent security acceptance.

## Recorded checks

All commands run from the repository root against the fixed local/test installations. BFF/database browser suites run sequentially on isolated port 4191. The source gate precedes browser runs. Earlier failed/diagnostic runs are retained separately and do not count as passing acceptance.

| Command | Result | Record |
| --- | --- | --- |
| `npm run check` | 296 passing source/domain/tooling cases; lint/types and both builds pass | [Log](logs/check-final.log) |
| `npm run test:infra` | 173 passing real database/BFF cases | [Log](logs/final-infra.log) |
| `npm run test:backend` | 21 passing cases across three browser engines | [Log](logs/final-backend.log), [report](reports/backend.json) |
| `npm run test:auth` | 21 passing cases across three browser engines | [Log](logs/final-auth.log), [report](reports/auth.json) |
| `npm run test:sync` | 69 passing cases across three browser engines | [Log](logs/final-sync.log), [report](reports/sync.json) |
| `npm run test:groups` | 110 pass; one squad-layout detached-control failure, repaired as described above | [Log](logs/final-groups.log), [full report](reports/groups-full.json) |
| `npm run test:groups -- tests/groups/squad-layout.groups.spec.ts` | All 9 affected cases pass after correction; no unresolved group failure | [Log](logs/final-groups-layout.log), [report](reports/groups-layout.json) |
| `npm run test:push` | 54 passing cases across three browser engines; synthetic outbound boundary | [Log](logs/final-push.log), [report](reports/push.json) |
| `npm run test:production` | 66 passing production-entry/localization/prayer cases across three engines | [Log](logs/final-production.log), [report](reports/production.json) |
| `npm run test:pwa` | 45 passing real-worker install/offline/cache/update cases across three engines | [Log](logs/final-pwa.log), [report](reports/pwa.json) |
| `npm run test:visual` | 48 matrix cases, all 720 frozen screenshot comparisons pass; no baseline update | [Log](logs/final-visual.log), [report](reports/visual.json) |
| `npm run lint`; `npm run typecheck` | Pass after the final squad-layout test correction; production code/builds unchanged | [Lint](logs/lint-after-layout.log), [types](logs/typecheck-after-layout.log) |
| `npm audit --json` | Zero reported vulnerabilities in the pinned dependency graph | [Audit](dependency-audit.json) |
| `npm run infra:verify -- local`; `npm run infra:verify -- test` | Both pass after all database/BFF suites | [Local](logs/final-verify-local.log), [test](logs/final-verify-test.log) |
| `npx supabase db advisors --local --workdir .rise-infra/local --type security --level info --fail-on info` and the same command with `.rise-infra/test` | Both report no issues after all database/BFF suites | [Local](logs/final-advisors-local.log), [test](logs/final-advisors-test.log), [command record](environment-checks.json) |
| `npm run check:docs` | 38 documents, 628 links, 62 anchors, 38 tasks and 20 requirements; no failures | [Log](logs/final-docs.log) |
| `python3 docs/evidence/security-2026-10-24/scan-known-secrets.py` | No exact protected local/test credential values found in the scanned source, evidence and builds | [Result](known-secret-scan.json) |

Reproducible change identity: [before hashes](source-before.json), [implementation/test hashes](source-after.json), [implementation patch](implementation.patch), [build hashes](build-hashes.json), [build comparison](build-preservation.json), [runtime versions](environment.json), [database versions](database-runtime.json) and [timestamped regression commands](regressions.json). The [known-credential scanner](scan-known-secrets.py) reads protected configuration locally and prints only counts and offending paths; it never emits credential values.

The final [preservation check](preservation.json) verifies 952 protected existing source/asset/migration/golden/dependency files, the unchanged 52-file acceptance build, matching implementation hashes and the task register. [Documentation changes](documentation.patch), [reviewed-file hashes](reviewed-files.json), [evidence links](evidence-links.json) and [test-port cleanup](test-port-cleanup.json) complete the record. The [artifact hash manifest](artifact-sha256.json) covers this evidence directory except itself. No test listeners remain on 4180, 4181, 4182 or 4191; retained local/test infrastructure remains running.

Initial observations: [expected missing-header failure](logs/headers-before.log), [first report-only journey](logs/csp-report-only.log), [corrected report-only compatibility](logs/csp-report-only-fixed.log), [initial matrix type error](logs/typecheck-initial.log), [privileged-evaluation probe failure](logs/backend-enforced.log), [WebKit worker-route probe failure](logs/backend-fixed.log), and [interrupted group run](logs/groups-initial-interrupted.log) with its [report](reports/groups-initial-interrupted.json). No reference images were regenerated.
