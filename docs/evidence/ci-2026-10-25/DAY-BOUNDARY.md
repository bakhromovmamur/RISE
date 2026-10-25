# Day-boundary durable snapshot correction

QUALITY-02 · NFR-07/08 · follow-up to hosted run `40216691259`, WebKit job `121239248303`.

The real-production day-boundary test failed at `morning.days["2026-10-26"].every(...)` because the new date was not yet materialized. Reopening a `DeviceSession` initially exposes the saved prior-day profile. `App` separately dispatches `calendar.refresh` from its mount effect; its existing reducer creates missing habit dates through `ensureDays`. Therefore a saved marker immediately after reload does not establish that the expected calendar refresh has already committed.

Only `tests/production/day-boundary.production.spec.ts` changes: import the existing pure `ensureDays` reducer and poll the persisted October 26 rows until they exactly match `ensureDays(evening, "2026-10-26")`. The complete morning snapshot is then captured. All original prior-day history, prayer, goal, reward, XP, correction, new-day full check-in and final reload assertions remain unchanged. The expected-state calculation clones its input; it never writes to the browser. No production code, shared storage helper, fixture state, assertion timeout, test timeout or retry policy changes.

## Deterministic reproduction and verification

A private copied scenario used a route-only fault injection on the isolated port 4181 bundle response: the exact App mount `calendar.refresh` callback was delayed by one second only on the fixed morning date. That diagnostic blocked service workers to keep its transformed response private to the diagnostic context. The on-disk build and application source were not changed. This deliberately widens the observed lifecycle gap; it is not presented as an unmodified local reproduction.

- Original test assertions under this delay: **failed** with the same `Cannot read properties of undefined (reading 'every')` at the new date.
- Corrected readiness precondition under the identical delay: **1/1 passed**, 5.2 seconds total, within unchanged assertions/deadlines.
- `npm run test:production -- day-boundary.production.spec.ts`, normal unmodified production bundle/configuration: **3/3 passed**, Chromium/WebKit/Firefox, 8.4 seconds total.
- `node_modules/.bin/oxlint tests/production/day-boundary.production.spec.ts`: passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json`: passed.
- Independent read-only review: no actionable findings; domain invariants and full assertions retained.

Private diagnostic copies and logs remain in `.rise-infra/ci-day/` (`red.log`, `green-delayed.log`, `all-engines.log`). They use the synthetic onboarding scenario, never a saved user profile. The first diagnostic launch required correcting its private web-server working directory; that setup error is not counted as a product regression. No local database, retained installation, source data or user browser origin was reset. Broader Firefox startup performance diagnosis is separate and is not declared fixed by this change. Hosted follow-up is recorded in the [overall CI report](README.md); cloud provisioning remains pending.
