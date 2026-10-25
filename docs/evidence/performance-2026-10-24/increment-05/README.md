# Increment 5 — validated command preparation

24 October 2026 · QUALITY-03 / NFR-02, NFR-07; preserves PRD-18 recovery boundaries. Local macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Cloud remains pending. This increment is verified; QUALITY-03 remains IN PROGRESS.

## Change and boundaries

The private traversal immediately after `JSON.parse` reads its own data properties without inspecting descriptors that parsing cannot create. Arbitrary JavaScript objects still undergo every descriptor check, including hidden fields; there is no public option to bypass it. Both paths retain prototype/key/finite-number/depth/record checks, and parsing retains the exact 50 MiB UTF-8 limit. Schema and reference validation remain unchanged. New tests exercise parsed and arbitrary-object bounds, escaped unsafe keys, non-finite numbers, array depth, and exact multibyte acceptance/rejection at the byte boundary.

`DeviceSession.dispatch` reuses the command result's serialized text after parsing/validation instead of serializing the same parsed value again. Parsing does not normalize data. Validation still precedes optimistic publication; stable operation IDs, atomic state/receipt writes, retry and durable acknowledgment remain. Real IndexedDB tests verify that no-op/repeated edits add no revision/receipt and preserve Unicode, unknown safe fields and the original recovery source through reopen. [Source diff](source-changes.patch), [before source hashes](before-source-hashes.json), [final source hashes](source-hashes.json).

No UI, CSS, asset, dependency, schema/cache format, migration or server source changes. Production is `index-B9DtxPsS.js`, review `index-DXgStKvM.js`; CSS remains byte-identical `index-DM2hzASY.css`. [Before build identity](before-build-hashes.json), [current builds](build-hashes.json). Prior visual evidence retains its recorded increment-4 build scope; no reference is regenerated.

## Measurements and remaining shortfalls

The same synthetic 100-habit / 730-date / 73,000-occurrence workload runs sequentially before and after the change, alone on the isolated browser origins. Its serialized size is 10,754,296 bytes. Three-sample medians below include the real strict IndexedDB adapter and verify complete history, check/Undo XP, drafts, revisions, original recovery data and exact replay. These are desktop diagnostics, not p95 or device acceptance. [Before samples](before-measurements.json), [after samples](after-measurements.json).

| Engine / action | Dispatch before → after | Durable before → after |
| --- | ---: | ---: |
| Chromium check | 125.6 → 105 ms | 316 → 298.5 ms |
| Chromium Undo | 142.5 → 126 ms | 348.4 → 317.9 ms |
| Chromium draft | 111.6 → 101.3 ms | 303.4 → 307.7 ms |
| WebKit check | 108 → 90 ms | 341 → 331 ms |
| WebKit Undo | 103 → 90 ms | 339 → 362 ms |
| WebKit draft | 106 → 89 ms | 337 → 324 ms |
| Firefox check | 184 → 166 ms | 604 → 598 ms |
| Firefox Undo | 175 → 148 ms | 603 → 635 ms |
| Firefox draft | 176 → 146 ms | 616 → 574 ms |

The separate production probe clicks the real Today habit and verifies completion/history/XP after reload, with no reviewer controls. It has one sample per engine. DOM observation and a subsequent frame opportunity are not physical paint or standardized INP. [Before UI samples](ui-before-measurements.json), [after UI samples](ui-after-measurements.json).

| Engine | Completed DOM before → after | Saved status before → after |
| --- | ---: | ---: |
| Chromium | 145.6 → 128.3 ms | 387.8 → 368.8 ms |
| WebKit | 153 → 119 ms | 648 → 592 ms |
| Firefox | 222 → 192 ms | 702 → 666 ms |

All visible completion samples still exceed 100 ms, and all durable medians exceed 250 ms. Some Undo/draft durable medians worsened; all samples, including the 925 ms first Firefox check, are retained. This change targets command preparation, not the underlying full-profile transaction cost. The repository-only phase medians remain about 194/237/431 ms after the change. Further local work must address durable cost, the capacity workload and the integrated fault matrix before claiming local completion; hosted and physical acceptance remain open.

The earlier Node discovery isolated command preparation: median reducer 49.8 ms, serialization 14.5 ms, parse/validation 75.7 ms, redundant serialization 13.1 ms and current-state serialization 12.9 ms. A separate unapplied parser experiment measured 79.7→63.0 ms and matched 62 output/rejection cases. Those experiments informed this change; they are not acceptance results. [Dispatch probe](diagnostics/dispatch-probe-source.mts), [phase samples](diagnostics/dispatch-phases.json), [parser probe](diagnostics/parser-probe-source.mts), [experiment source](diagnostics/validation-experiment.ts), [experiment samples](diagnostics/parser-experiment.json).

## Verification and recovery

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/validation.test.ts tests/storage-migration.test.ts tests/backup.test.ts tests/commands.test.ts tests/personal-commands.test.ts` | 38 pass; [log](logs/targeted.log) |
| `npm run check` | 282 unit/tooling cases, lint/types and both builds pass; [log](logs/check.log) |
| `npx playwright test --config playwright.performance.config.ts` | 6 before and 6 after pass; [before](logs/before.log), [after](logs/after.log), [before report](reports/before.json), [after report](reports/after.json) |
| `npx playwright test --config playwright.performance-production.config.ts` | 3 before and 3 after pass; [before](logs/ui-before.log), [after](logs/ui-after.log), [before report](reports/ui-before.json), [after report](reports/ui-after.json) |
| `npm run test:browser -- 'tests/(storage\|personal-commands\|backup\|recovery).browser.spec.ts$' --workers=1` | 105 pass; [log](logs/storage.log), [report](reports/storage.json) |
| `node --import tsx --test --test-concurrency=1 tests/infra/lifecycle.test.ts tests/infra/group-export.test.ts` | 21 real database cases pass; [log](logs/database.log) |
| `npm run test:groups -- 'tests/groups/(export\|lifecycle).groups.spec.ts$'` | 15 real account browser cases pass; [log](logs/groups.log), [report](reports/groups.json) |
| `npm run test:production` | 66 pass; [log](logs/production.log), [report](reports/production.json) |
| `npm run test:pwa` | 45 pass; [log](logs/pwa.log), [report](reports/pwa.json) |

Browser contexts are disposable and restricted to 4180/4181/4191; the saved 4173 profile is not accessed. Database tests use the existing fixed test installation and synthetic accounts only, including populated history, unauthorized requests, failed/lost replies, suppression, provider completion and restored-backup replay. No real messages, invitations, provider push, cloud provisioning or deployment occurs.

Rollback needs no migration: the previous compatible build reads the same saved records and recovery data. Never clear a profile, reduce validation limits, weaken owner/session checks or replace provider credentials to make these checks pass. The private parsed-value optimization must not become an option for arbitrary object callers.

The [verification manifest](verification.json) records exact commands and timestamps. One report-copy step initially used the wrong path after the production suite passed; its actual report was preserved and the PWA suite ran separately. No application check failed and no passing suite was repeated for that correction. [Preservation](preservation.json), [final source/document hashes](final-source-hashes.json), [documentation changes](documentation-changes.patch) and [documentation check](logs/docs.log) complete the record. The document audit also clarifies that shared-authorization verification is pending for hosted environments; the local implementation and acceptance already exist.
