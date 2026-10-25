# Increment 4 — deferred group screens

24 October 2026 · QUALITY-03 / NFR-01, NFR-07; preserves PRD-13–15 group flows and PRD-17 language/accessibility behavior. Local macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0. Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Cloud remains pending. This increment is verified; QUALITY-03 remains IN PROGRESS.

## Change and measurements

Group management, task/list editing, invitations and squad composition now load when their sheet opens. Today rows, private priorities and shared retry status remain in the initial graph. Existing component bodies and route mappings were moved without changing their behavior. The loader caches module code only, fences completion after unmount, and exposes localized loading/error/retry states through the existing sheet. Retry and keyboard focus work after an interrupted download. [Source diff](source-changes.patch), [source hashes](source-hashes.json), [extraction checks](extraction-checks.json).

| Production code | Bytes | Gzip level 6 bytes |
| --- | ---: | ---: |
| Previous initial entry | 1,277,012 | 389,368 |
| Current initial entry | 1,180,784 | 366,633 |
| New deferred group chunk | 98,787 | 26,048 |

The initial entry decreases by 96,228 bytes (7.5%). The new entry and deferred chunk together are 2,559 bytes larger than the previous entry; splitting adds loader/module overhead. Compression uses Python gzip level 6 with mtime zero for both builds; these values are not Vite's displayed estimates. The previous production build was reproduced in an isolated temporary directory and its entry/CSS hashes matched increment 3 exactly. Current production entry is `index-Cmaexc-U.js`, deferred chunk `GroupScreenBody-CQRUq2L3.js`; CSS remains byte-identical `index-DM2hzASY.css`. [Sizes and hashes](bundle-sizes.json), [complete build hashes](build-hashes.json), [before graph](bundle-before.json), [after graph](bundle-after.json), [read-only probe](bundle-probe-source.mts).

The real service worker still precaches every public chunk. This change defers page evaluation and reduces initial entry size; it does not reduce total installed download size or establish faster LCP/INP. Earlier dense-profile feedback and durable-commit shortfalls remain open. No CSS, artwork, dependencies, server code, migrations or persisted formats changed. The design sidecar refresh changes only its timestamp; its visual metadata and DESIGN.md remain unchanged.

## Verification

| Command | Result |
| --- | --- |
| `npm run check` | 280 unit/tooling cases, lint/types and both builds pass; [log](logs/check.log) |
| `npx playwright test --config playwright.production.config.ts deferred.production` | Initial 9 language/engine cases pass; [log](logs/cold.log), [report](reports/cold.json) |
| `npm run test:pwa` | 45 pass, including three new cold offline openings of a previously unopened group screen; [log](logs/pwa.log), [report](reports/pwa.json) |
| `npm run test:production` | 66 pass, including all 12 new deferred-screen cases; [log](logs/production.log), [report](reports/production.json) |
| `npm run test:visual` | 48 cases / 720 frozen comparisons pass without updating references; [log](logs/visual.log), [report](reports/visual.json) |
| `npm run test:browser -- 'tests/(life\|you).browser.spec.ts$' --workers=1` | 48 local family/squad and You-tab journeys pass; [log](logs/guest.log), [report](reports/guest.json) |
| `npm run test:groups` | 108 pass across three engines, including real account commands/recovery/lifecycle and metadata-only layout cases; [log](logs/groups.log), [report](reports/groups.json) |
| `npm run typecheck` / `npm run lint` | Pass with the final new tests; [types](logs/types.log), [lint](logs/lint.log) |

Test contexts use isolated 4180/4181/4182/4191 origins; the saved 4173 profile is not accessed. Real account tests use only synthetic identities in the existing fixed test installation and disable credential-flow captures. Layout-only adapters carry no usable session. New production error checks cover English, Russian and Uzbek, 320/375/393/430 px, light/dark and 200% text. The three [English](captures/en-deferred-error-dark-200.png), [Russian](captures/ru-deferred-error-dark-200.png) and [Uzbek](captures/uz-deferred-error-dark-200.png) captures were visually inspected for clipping, legibility and control size.

## Corrections and recovery

An initial placement of the global group stylesheet changed cascade order. Moving its import to the first line of the entry restored the exact prior CSS bytes before the final source/browser/visual gates. The first isolated baseline build lacked its HTML entry; copying the original entry fixed the probe setup. The read-only graph probe required an ESM `.mts` extension. Neither probe changed application data. Docker was stopped before account tests; the existing Docker application was started without resetting or replacing either installation.

The protected-file audit rechecks the previous 2,924-file inventory, including historical evidence, original assets, server/migrations, dependency metadata and frozen references. [Preservation](preservation.json). Rollback requires no data migration: revert the loader/extraction source together and build the complete compatible public shell. Never remove a chunk from an installed shell or clear private data to repair an asset failure. Existing worker install/update failure handling retains the last complete shell.

The [verification manifest](verification.json) records exact commands, timestamps and scopes. [Final source/document hashes](final-source-hashes.json), [documentation diff](documentation-changes.patch) and [documentation check](logs/docs.log) complete the record. The document audit also reconciles the old initial-bundle figure and the already-accepted local Uzbek coverage; no product requirement changed.
