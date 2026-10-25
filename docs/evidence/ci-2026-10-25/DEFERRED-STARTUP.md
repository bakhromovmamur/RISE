# Deferred and PWA fixture startup boundaries

25 October 2026 · QUALITY-02 / WEB-02 / NFR-07/08.

Hosted run `40210661891`, WebKit job `121220975092`, exposed the same startup timing boundary previously seen in the [security reload test](SECURITY-RELOAD.md). The deferred-sheet case `closing a loading sheet cannot reopen it when the module arrives` captured `dailyPriorities: {}` immediately after migration; its later complete-state comparison saw the expected 2026-10-19 read/walk/english priorities. Main journeys (153 cases), backend security and authentication had passed in that run. This was a test baseline taken before the separate durable startup command, not evidence of an unintended sheet action changing personal data.

The correction adds explicit persisted `ensurePriorities(state).dailyPriorities` expectations at four custom-fixture startup sites:

- Both bootstrap sites in `tests/production/deferred.production.spec.ts`: three translated interrupted-download/retry cases and the close-before-download-completes case.
- `tests/pwa/help.pwa.spec.ts`: three translated real-worker offline help cases.
- `tests/pwa/interface.pwa.spec.ts`: three translated install/offline/reflow cases, retaining the existing device-timezone wait.

Each fixture still starts with its original state and exercises actual migration and priority initialization. The complete stored-state snapshots and equality assertions remain intact. Deferred request counts, loading/error/retry behavior, keyboard/focus checks, late-module non-reopening, and offline/worker checks are unchanged. No fixture writes, fields ignored in comparison, sleeps, timeout increases or retries were added. The global `stored()` helper and all production source remain unchanged.

## Related-site audit

Every production and PWA spec was inspected for materially identical custom fixture startup followed by a complete-state baseline. Production help and backup use `balancedFixture`, which already initializes its daily priorities. Legacy entry/schema and prayer/habit tests deliberately test unset states or compare unaffected state projections. Fresh onboarding/empty-state assertions remain unchanged; they must not silently wait for an onboarded state. Lifecycle PWA cases use the real onboarding/worker-ready flow, rather than the custom migrated fixture boundary. Independent read-only review found no additional matching site requiring a change.

## Verification

macOS arm64; production build on isolated port 4181, then the real-worker PWA server on the same port sequentially. No user origin or saved profile was reset; no app rebuild was needed for these test-only edits.

| Command | Result |
| --- | --- |
| `npm run test:production -- --project=webkit --grep 'closing a loading sheet' --repeat-each=5 --max-failures=1` before correction | 5/5 passed, 5.2 s; the actual hosted failure did not reproduce locally |
| `npm run test:production` after correction | 78/78 passed across Chromium, WebKit and Firefox, 1.3 min |
| `npm run test:pwa -- help.pwa.spec.ts interface.pwa.spec.ts` | 18/18 passed across Chromium, WebKit and Firefox, 31.1 s |
| `node_modules/.bin/oxlint tests/production/deferred.production.spec.ts tests/pwa/help.pwa.spec.ts tests/pwa/interface.pwa.spec.ts` | Passed |
| `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json` | Passed; includes all test sources |

Playwright 1.64.1 browser manifest: Chromium 156.0.8078.4/revision 1248, Firefox 157.0/1555, WebKit 27.2/2370. Private logs: `.rise-infra/ci-deferred/baseline-webkit.log`, `production-all.log`, `pwa-startup-all.log`. Hosted follow-up belongs in the [overall CI report](README.md). Cloud provisioning remains pending.
