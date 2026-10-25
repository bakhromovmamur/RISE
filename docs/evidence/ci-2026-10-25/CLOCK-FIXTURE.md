# Paused browser clock initialization

25 October 2026 · PUSH-04 / AUTH-01 / FND-02 · PRD-12, PRD-17 and NFR-08.

Hosted run `40216691259`, Firefox job `121239248251`, failed the Russian habit-reminder layout case during `seed`, before any application assertion: `clock.pauseAt: Cannot fast-forward to the past`. The fixture called `install({time: now})` followed by `pauseAt(now)`. Installation starts a running clock, so elapsed setup time can put the pause target in the past.

The diagnosis used the installed Playwright **1.64.1** API definitions (`node_modules/playwright-core/types/types.d.ts`, Clock) and the matching bundled client/server/injected implementation (`node_modules/playwright-core/lib/coreBundle.js`). `pauseAt` already installs clock instrumentation when necessary. On a fresh context it can establish the exact paused target directly. On navigation the clock log replays that target with a fresh performance origin; `fastForward` still advances both the wall clock and timer ticks. No arbitrary time margin, sleep, expanded timeout or application timing change is needed.

`tests/production/habit-reminders.production.spec.ts` now calls `pauseAt(now)` before navigation and asserts that the loaded fixture still reports the exact `08:59:00Z` target. The existing one-minute advance, explicit notification consent, generic payload, deduplication, pre-reminder completion, XP, saved-habit and reload checks are retained. English/Russian/Uzbek light/dark mobile reflow checks remain unchanged.

A private blank-page probe reproduces the old failure with 250 ms of deliberately injected delay between installation and pause. It then checks the corrected API sequence with delay before and after pause, navigation, a due timer, a 60,001 ms advance and reload. The delay is a diagnostic stress condition only; it is not added to any committed fixture. All three engines reproduce the old error and pass the corrected checks. In the application document, `Date.now()` equals the target, `performance.now()` is zero, and `performance.timeOrigin` equals the target. After advance, wall time and performance both advance exactly 60,001 ms, the due timer fires once, and reload retains the advanced date.

Local environment: macOS arm64, Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. The probe uses only fresh blank/data pages and no server, credentials or stored profile.

| Command | Result |
| --- | --- |
| `node .rise-infra/local-completion-20261025/clock-fixture/probe.mjs` | Old failure reproduced and corrected date/performance/timer/reload checks pass in all three engines |
| `node_modules/.bin/oxlint tests/production/habit-reminders.production.spec.ts tests/auth/identity-race.auth.spec.ts --deny-warnings` | Passed |
| `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json` | Passed |
| `npm run test:auth -- 'tests/auth/identity-race.auth.spec.ts$'` | 9/9 passed, zero failures/skips/retries, 28.8 s |
| `npm run test:production -- 'tests/production/habit-reminders.production.spec.ts$'` | 15/15 passed, zero failures/skips/retries, 25.4 s |

Independent read-only review checked the exact date and timer semantics, including the navigation performance origin. The audit also found the same installation/pause sequence in `tests/auth/identity-race.auth.spec.ts`. That fixture receives the same direct pause and exact-date assertion before its existing controlled refresh race. Held-request ordering, the 14,000/1,000 ms advances, network deadlines, latest-response checks and real sign-in assertions remain unchanged. Other clock installations intentionally keep time running or use fixed-date semantics and do not repeat this pause-at-installation-time pattern.

Application code, production timers, reminder targets, data formats, visual styles and saved user origins are unchanged. The production suite used isolated port 4181; the credential-bearing identity suite used isolated port 4191 with traces/video/screenshots disabled. Private probe source/results and targeted suite reports are retained under `.rise-infra/local-completion-20261025/clock-fixture/`. Hosted rerun status belongs in the [overall CI record](README.md). Cloud provisioning and physical-delivery acceptance remain pending.
