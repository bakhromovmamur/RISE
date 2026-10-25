# RELEASE-01 — local complete-day rehearsal

25 October 2026, Asia/Tashkent. UTC timestamps are retained in the machine-readable results. Scope: PRD section 7 journeys A–J, PRD-01–20, NFR-06–08 and SEC-01–07 local regression evidence. **RELEASE-01 remains IN PROGRESS. Cloud provisioning remains pending.**

## Decision and limits

This is an accelerated synthetic local rehearsal, not a consented human pilot. No participants were recruited, no real feedback was collected, and no elapsed-day/week retention is measured. Real local PostgreSQL/Auth and independent synthetic member sessions exercise authorization; they are not two real people. Hosted and physical-device acceptance remain pending.

The [pilot protocol](../../RELEASE-PILOT.md) records consent/privacy rules, actual-day observation steps, outcome fields and failure handling. [Journey mapping](journeys.json) links each A–J journey to actual test files. [Environment](environment.json) records macOS, Node/npm and browser versions. [Verification](verification.json) distinguishes the original broad run, diagnostic runs and final checks. Existing QUALITY-03 dense-profile latency and mixed-capacity failures remain release blockers; functional passes do not close them.

## Changed surface

- `src/pwa/client.ts`: after an approved update, a worker reply timeout no longer releases the save hold. A later controller change can reload the new release. Explicit refusal and the existing 30-second expiry still release the hold. The 10-second reply timeout and 30-second hold were not increased; no storage clearing or migration was added.
- `tests/pwa/lifecycle.pwa.spec.ts` and the isolated `scripts/serve-pwa-test-build.mjs`: a real-worker regression delays activation 12 seconds, past the reply deadline, and checks exact saved-state equality after activation and reload. A second test checks successive updates and rollback. The delay control exists only in the isolated test server; it is not packaged or deployed.
- `tests/production/day-boundary.production.spec.ts`: UI onboarding from an empty production origin, tiny/full/Undo, durable reload, accelerated next-day return, retained history and independent next-day XP. It uses real IndexedDB and injects no saved fixture.
- Existing accessibility/backup tests select the intended Settings data disclosure after OPS-04 added Help; keyboard traversal includes the eighth stop. The Russian scan exempts original license text and a narrow Help-only list of technical names, with an exact comparison of the complete original notices. Surrounding UI and accessibility names remain scanned.
- The server-backup integration test writes generated results under `test-results/infra/`, preserving dated evidence. Prayer-layout captures now use per-test output paths. The first broad run had already regenerated eleven legacy synthetic captures; six remain different from the initial hashes. Frozen visual references were never regenerated. All 64 legacy captures remained unchanged in the focused rerun after the path fix.
- README, PRODUCT, ARCHITECTURE, PWA contract, TASKS, VERIFICATION, pilot protocol and this evidence. No dependency, CSS, artwork, domain reducer, backend, schema or persisted-format change.

## Defects and diagnostics

### Fixed: approved update lost after a reply timeout

The original client cleared its approved hold at the ten-second reply deadline even though worker activation was still possible. The controller-change handler reloads only held clients, so a later activation left the old document open. The isolated 12-second delay reproduced that exact symptom on the original production build: the expected new release never appeared within the unchanged 20-second assertion. After the focused catch-path correction, the same test passes in Chromium, WebKit and Firefox, preserving the saved tiny check-in and its 10 XP through reload. See the red/green counts in [verification](verification.json).

### Open blocker: intermittent Chromium sealed-package activation stall

The original full rollout suite passed five cases and failed the Chromium compatible rollback case. Unchanged focused repeats reproduced it. A filtered worker probe observed the current controller still active, the expected replacement installed/waiting, successful client approval and complete cached assets. The waiting worker entered `skipWaiting()` but did not return during the assertion window. The [service-worker specification](https://w3c.github.io/ServiceWorker/#service-worker-global-scope-skipwaiting) distinguishes activation from the page message reply; these observations do not establish which browser/event condition delayed activation.

The timeout fix does **not** close this finding: an uninstrumented focused run failed again after the fix. Three later instrumented repeats passed, yielding no failed pending-event trace. Rapid static-server updates/rollback also pass. Neither result proves the sealed server-replacement path reliable. Temporary probes were removed; no production worker protocol, test deadline, origin guard or storage was weakened to force a pass. Exact diagnostic outcomes are retained in [diagnostics](diagnostics.json), including interrupted runs.

Reproduction: `npm run test:rollout -- --project=chromium --grep 'compatible backend' --repeat-each=3`, sequentially against the fixed test stack. The existing suite asserts the real session, exact queued outbox, immutable guest recovery source, compatible worker replacement and eventual single reflected record. Next investigation should distinguish old-worker event/request completion from overlapping registration work during server replacement. Keep this release gate open until a causal fix and uninstrumented repeats pass; a green rerun alone is insufficient.

### Corrected test drift and evidence output

The initial journey run was interrupted after Settings selectors expected seven keyboard stops, matched multiple nested disclosures, or opened Help instead of Your data. A first broad text-filter correction also matched Help prose and was replaced by the exact section heading. The new day-boundary test initially targeted a habit inside a collapsed next-day routine; it now opens that disclosure. The Russian probe initially flagged original notices and technical names; the final scoped scan preserves and verifies those notices. These failures and corrections changed tests, not product UI or assertion deadlines.

## Verification and preservation

Exact commands, timestamps, exit codes and counts are in [verification.json](verification.json). Original broad-run results: `npm run check` passed 312 unit/tooling checks plus pinned toolchain, notices, lint, types and both builds; browser 453; production 78; PWA 54; visual 48 cases/720 comparisons; real database integration 179; backend 21; auth 21; sync 69; push 54; groups 111. Rollout was 5 passed/1 failed. The original production release was `c86bc7e9532f6158e490`; the corrected production release is `c2b58520045b4717c91a`. Final post-fix suite results are listed separately below and never replace the original failures.

All BFF/database suites ran sequentially against the fixed **test** installation on 4191 with synthetic accounts/local mail and injected external-push boundaries. The review, production/PWA and visual suites used 4180/4181/4182; production and PWA ran separately. The existing personal origins 4173/4190/4192 were not loaded with fixtures. Credential traces/video/screenshots remained disabled for authenticated suites. No local release selection, hosted service, live sender or real invitation was started.

[Preservation](preservation.json) reports the read-only comparison of all 62 local application tables and five protected installation configuration files, source/reference comparisons and the legacy-capture caveat. No private records, configuration values or raw database hashes are published. [Secret scan](secret-scan.json) records known-secret checks across source, outputs, evidence and sealed public releases; it is not a complete security audit.

The real database suite also performed an encrypted, network-disabled disposable restore with reopening disabled. [Drill result](backup-drill.json) records its measured recovery age/duration and quarantine. This is not hosted/lost-source recovery or a full-service RPO/RTO acceptance claim. Original dated backup evidence remains unchanged.

## Recovery and remaining acceptance

The client fix changes no persisted format. Compatible release rollback retains the existing guest/account caches and pending intent. The unresolved activation finding means automatic in-page replacement cannot yet be accepted as reliable in the tested Chromium sealed-runtime path. Use the existing [rollout procedure](../../LOCAL-ROLLOUT.md); preserve evidence and pending data. Never unregister the worker, clear storage or downgrade a schema to turn this check green.

Consent and actual feedback, an elapsed day/return, two real group members, physical push/assistive technology/mobile browsers, QUALITY-03 performance/capacity, named operating owners/contact, hosted security/operations/recovery and policy/provider/rights approval remain open. See [mobile acceptance](../../MOBILE-ACCESSIBILITY.md), [performance evidence](../performance-2026-10-24/README.md), [launch policies](../../LAUNCH-POLICIES.md) and [backup recovery](../../SERVER-BACKUP-RECOVERY.md). RELEASE-02 is not approved. Cloud provisioning remains pending.


## Final post-fix checks

| Command | Result |
| --- | --- |
| `npm run check` | PASS — 312 unit/tooling checks; toolchain, notices, lint, types and production/review builds |
| `npm run test:pwa` | PASS — 60 cases, all three engines |
| `npm run test:production -- --workers=1` | PASS — 78 cases, all three engines |
| `npm run test:visual` | PASS — 48 cases, 720 comparisons; no reference updates |
| `npm run test:rollout` | PASS — 6 cases, all three engines; earlier intermittent activation finding remains open |
| `npm run typecheck` / `npm run lint` | PASS after final test edits |
| `npm run check:docs` | PASS — 43 documents, 707 links, 62 anchors; additional new-evidence links and A–J paths checked |

The four final browser suites reported zero unexpected, skipped or flaky cases in this run. Their exact timestamps/durations and the generated sealed-package identifiers are in [verification.json](verification.json). This is a final-run result, not a claim that the preceding intermittent failure was fixed. The main app's 453-case suite and the real backend/security/lifecycle suites listed above preceded the PWA client-only correction; their domain/backend code remained unchanged. The final rollout re-exercised real account/session/outbox/guest preservation across that correction.
