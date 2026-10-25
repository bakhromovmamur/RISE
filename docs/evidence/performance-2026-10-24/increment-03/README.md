# Increment 3 — owned repository snapshots and production feedback

24 October 2026 · QUALITY-03 / NFR-02, NFR-07 diagnostics. macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0. Browser versions: Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Cloud remains pending. This increment is verified; QUALITY-03 remains IN PROGRESS.

## Change and evidence

`LocalStore` explicitly transfers detached, owned results. Both existing adapters already provide that isolation. `LocalRepository` now transfers that state into its public snapshot instead of cloning the entire profile again. The adapter's strict transaction, input validation, post-commit copy and atomic receipts remain unchanged. Tests mutate source inputs, callback references, reads, successful results and replays, then verify independent snapshots and durable readback. No schema/cache version, persisted record, UI, CSS, asset or dependency change is required. [Diff](source-changes.patch), [source hashes](source-hashes.json), [build hashes](build-hashes.json).

New opt-in probes measure repository phases and a real production Today action. The repository phase probe verifies 73,000 occurrences, check/Undo XP, nine durable revisions and exact replay. The production probe seeds a disposable 4181 context, reloads through production validation, clicks the real habit control, observes completion/save status and checks history and XP after another reload. It asserts that reviewer controls do not exist. No saved profile or 4173 origin is accessed.

## Measurements and limits

Repository work outside the adapter drops from median 36.9/49/65 ms to 0.2/0/0 ms in Chromium/WebKit/Firefox. These are medians across the nine operations in each run. Remaining phases include read/validation, reducer work and validation/write/clone. [Before phase samples](phases-before.json), [final samples](after-measurements.json).

| Engine | Check dispatch / durable | Undo dispatch / durable | Draft dispatch / durable |
| --- | --- | --- | --- |
| Chromium | 113.1 / 300.6 ms | 135.8 / 325.1 ms | 113.8 / 298.7 ms |
| WebKit | 105 / 346 ms | 101 / 337 ms | 103 / 342 ms |
| Firefox | 181 / 608 ms | 183 / 610 ms | 173 / 600 ms |

These are three-sample desktop medians. They do not establish p95, and every durable median remains above 250 ms. The separate production UI probe has one sample per engine:

| Engine | Completed DOM state | Subsequent frame opportunity | Saved status |
| --- | --- | --- | --- |
| Chromium | 146.6 ms | 165.6 ms | 386.3 ms |
| WebKit | 136 ms | 189 ms | 607 ms |
| Firefox | 239 ms | 241 ms | 751 ms |

[UI samples](feedback.json). DOM/frame timing is not a physical paint or standardized INP measurement. The visible completed state and saved records are asserted separately. The 100 ms feedback target is not met by these samples. The production entry is `index-B1DJr5Dw.js`, review `index-Bmjac_51.js`; CSS remains `index-DM2hzASY.css`.

A 20-sample Node XP probe found about 1.2 ms median traversal time. It did not justify changing XP logic; `src/model.ts` remains unchanged. [Discovery samples](xp-discovery.json). Further work should target command preparation and whole-record transactions, then bundle/load and the capacity/fault matrix. Hosted and physical acceptance remain open.

## Verification

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/commands.test.ts tests/personal-commands.test.ts` | 16 pass; [log](logs/targeted.log) |
| `npm run check` | 280 unit/tooling cases, lint/types and both builds pass; [log](logs/check.log) |
| `npx playwright test --config playwright.performance.config.ts` | 6 pass: local session and repository phases across three engines; [log](logs/browser.log), [report](reports/browser.json) |
| `npm run test:browser -- 'tests/(storage\|personal-commands).browser.spec.ts$' --workers=1` | 57 pass, including new real IndexedDB snapshot isolation and existing quota/conflict/lost-reply/migration checks; [log](logs/storage.log), [report](reports/storage.json) |
| `npx playwright test --config playwright.performance-production.config.ts` | 3 pass; [log](logs/feedback-production.log), [report](reports/feedback-production.json) |
| `npm run typecheck` / `npm run lint` | Pass after adding the production probe/config; application source unchanged since the 280-case gate; [types](logs/types.log), [lint](logs/lint.log) |
| `npm run test:production` | 54 pass, including real guest onboarding, account-entry exclusion, history migration and prayer persistence; [log](logs/production.log), [report](reports/production.json) |

The first UI probe incorrectly expected no reviewer nodes in the review build. All three engines failed that assertion before collecting timings. The corrected probe uses the frozen production build on 4181 and retains the zero-reviewer assertion. [Original test](diagnostics/review-ui-test.ts), [failure log](diagnostics/review-ui.log), [failure report](diagnostics/review-ui-report.json). This was test-environment selection, not an application failure; no deadline or acceptance threshold changed.

Earlier database and visual results retain their recorded build scopes. This increment changes only the local repository source, tests and documentation. Persisted formats remain readable by the prior build; rollback requires no data migration. The [verification manifest](verification.json), [preservation audit](preservation.json), [final source hashes](final-source-hashes.json) and [documentation check](logs/docs.log) record exact scope and remaining gates.
