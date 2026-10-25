# Security reload snapshot synchronization

25 October 2026 · SAFE-01 / PRD-18, NFR-06/07/08, local CI correction.

Hosted run `40209551589`, infrastructure job `121217667349`, passed all 183 database tests and then failed one of 21 backend browser cases: WebKit's `authored markup stays inert plain text through legacy migration and reload`. The full state comparison differed only in `dailyPriorities`: the first snapshot was empty, while after reload the fixture's 2026-10-19 priorities contained read/walk/english.

The fixture intentionally migrates with empty priorities. `DeviceSession` initially exposes the committed migration as saved. `BalancedToday` subsequently dispatches `priorities.ensure` from its mount effect, and the existing reducer creates the default priorities as a separate durable command. The original test could capture the initial migration snapshot before this expected startup action. A saved badge alone does not establish that a later mount effect has completed.

Only `tests/infra/security.infrastructure.spec.ts` changes: before taking the complete baseline snapshot, the test polls durable IndexedDB priorities until they equal the existing domain `ensurePriorities(state)` result. It then retains the entire state comparison after reload, authored-text visibility checks, absence of a rendered attack image, and zero-dialog assertion. No state fields are ignored, no fixture priorities are preseeded, and no sleep, timeout increase or test retry is added. Application code, storage schemas, domain behavior and the shared browser helper are unchanged.

Local results, macOS arm64, isolated fixed-test BFF port 4191:

| Command | Result |
| --- | --- |
| `npm run test:backend -- --project=webkit --grep 'authored markup' --repeat-each=5 --max-failures=1` before change | 5/5 passed, 9.0 s; the hosted timing failure did not reproduce locally |
| `npm run test:backend -- --project=webkit --grep 'authored markup' --repeat-each=5` after change | 5/5 passed, 5.5 s |
| `npm run test:backend -- security.infrastructure.spec.ts` | 12/12 passed, 12.2 s across Chromium, WebKit and Firefox |
| `node_modules/.bin/oxlint tests/infra/security.infrastructure.spec.ts` | Passed |
| `node_modules/.bin/tsc -p tsconfig.server.json --noEmit` | Passed |

Installed Playwright 1.64.1 browser manifest: Chromium 156.0.8078.4 (revision 1248), Firefox 157.0 (1555), WebKit 27.2 (2370). The security suite retains real CSP script/handler/evaluation/base checks, embedding denial, backup workers, offline reload, and inert authored markup. Private local logs are `.rise-infra/ci-security/baseline-webkit.log`, `focused-webkit.log`, and `security-all-engines.log`. No saved local origin was opened or reset. Hosted rerun status belongs in the [overall CI report](README.md); cloud provisioning remains pending.
