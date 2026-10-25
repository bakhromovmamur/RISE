# Firefox guest startup: bounded timezone formatter reuse

Date: 25 October 2026. Tasks: QUALITY-03 / RELEASE-01; requirements NFR-02 (responsive local actions) and NFR-07 (preserve saved data). This is a focused startup repair, not acceptance of all performance or release targets. Cloud provisioning remains pending.

## Observed failure and diagnosis

[Hosted run 40216691259](https://github.com/bakhromovmamur/RISE/actions/runs/40216691259), Firefox job `121239248251`, failed the production test `migration summary is dated, explains mixed provenance and exports the exact original` at its unchanged five-second saved-marker assertion. The synthetic-only trace shows the full Today screen explicitly displaying **Saving on this device**, successful migration-worker/session requests and no captured page error. It does not show a blank startup or storage recovery failure.

A private copy of the same test, retaining its fixture, five-second assertion and exact original-source download comparison, added read-only IndexedDB transaction/request events and DOM storage-status observation. Five Firefox repeats reproduced **3 failures / 2 passes**. Every transaction completed; there was no abort, rejection or indefinitely stuck queue. Final saved-state observation took **7,762 / 7,448 / 4,786 / 6,004 / 5,621 ms** from navigation. The assertion begins after navigation returns and observes intermittently, so those navigation-relative times are not its exact elapsed budget.

Targeted profiling identified repeated first-use `Intl.DateTimeFormat` work in manual prayer-window calculations. A fresh-mode fixture's six prayer streaks alone constructed 2,444 formatters in one pass. In an actual-page profile, the final saved observation at **2,478 ms** followed **29,733 formatter constructions**, **970 ms** in `formatToParts` and **1,094 ms** in `format`; constructor time itself was only **34 ms**, consistent with expensive first-use formatting. That less-loaded profiling repeat passed, so these measurements do not imply every original run exceeded five seconds.

## Focused change and invariants

`src/domain/zonedTime.ts` now reuses the existing fixed-locale date/time formatters by exact explicit timezone. A FIFO map holds at most **32 zones / 64 formatters**. Both formatters must construct successfully before insertion. No instant, UTC offset, formatted result, prayer window, profile, owner or private record is cached. `canonicalZone`, domain calculations, startup commands, persistence, validation, acknowledgment and UI behavior are unchanged.

Every call still formats its supplied instant in its supplied zone. DST changes, repeated clocks, skipped dates, historical timezone changes and invalid-input behavior remain governed by the same Intl calls and existing manual-time algorithm. No saved profile or browser origin was cleared. Rollback is a source-only performance rollback; there is no schema or stored-data migration.

## Verification

Local environment: macOS 26.6.2 (25G83), Node 24.16.0, Playwright 1.64.1 with pinned Firefox 157.0 / revision 1555. Hosted failure was Linux. All browser work used isolated port 4181 and synthetic fresh contexts. Other agents' backend checks occasionally overlapped; timings are diagnostic local observations, not a controlled device benchmark or NFR acceptance.

- Before implementation: `node --import tsx --test tests/zoned-time.test.ts` — **1 failed / 2 passed**. The real manual-history streak regression observed **4,884 formatter constructions** across two passes; the new test requires fewer than 20 while preserving results and input state.
- After implementation: `node --import tsx --test tests/zoned-time.test.ts tests/prayer-timetable.test.ts tests/prayers.test.ts tests/prayer-records.test.ts tests/prayer-delivery.test.ts` — **63/63 passed**, 652.9 ms. Coverage includes repeated clocks, DST gaps, skipped dates, fractional/date-line zones, historical Almaty changes, parity with fresh Intl instances before/after 40-zone eviction, invalid zones/instants, prayer history, delivery and input immutability.
- `npx oxlint src/domain/zonedTime.ts tests/zoned-time.test.ts --deny-warnings` — passed.
- `npm run build` — passed, retaining the existing bundle-size advisory.
- `npx playwright test --config=.rise-infra/ci-firefox-startup/playwright.config.ts --project=firefox --grep='migration summary is dated' --repeat-each=5` — corrected instrumented copy **5/5 passed**, 15.6 s, zero retries/skips. No assertion or timeout changed. Final saved observation: **426 / 623 / 502 / 638 / 684 ms**. The profiling instrumentation recorded **769–875 constructions** and **45–88 ms formatting** by that saved observation. Whole-case formatter constructions fell from **34,279** in the original profiled repeat to **981** in each corrected repeat.
- Root-owned `npm run check` — **337/337 source/tooling tests passed**, with toolchain, notices, lint, all type checks and both production/review builds passing. Private log: `.rise-infra/ci-20261025/formatter-check.log`.
- Root-owned `npm run test:production` — **78/78 passed** across Chromium, WebKit and Firefox in 2.2 minutes, zero failures/skips/retries, on the completed production build. Private log: `.rise-infra/ci-20261025/formatter-production.log`.
- Two independent source reviews found no actionable issue. This production result does not establish complete hosted CI or backend acceptance; follow-up status is recorded in the [overall CI report](README.md).

The three earlier Firefox group-suite timeouts had insufficient secondary-context evidence. This repair addresses a newly reproduced production startup bottleneck; it does **not** retrospectively prove the cause or resolution of those older failures. Dense two-year save/account-capacity targets remain separate open work.

## Evidence provenance

Private artifacts remain under `.rise-infra/ci-firefox-startup/`: original synthetic hosted `artifact.zip` and trace, `probe-baseline-report.json`, `probe-baseline.log`, `intl-baseline-report.json`, `intl-baseline.log`, `intl-green-report.json`, `intl-green.log`, `zoned-red.log`, `zoned-green.log`, `build.log`, and the read-only diagnostic test/config. An initial diagnostic invocation failed before tests because the private config inherited a relative server path; setting its server working directory to the repository corrected that harness setup. No diagnostic instrumentation was added to application or committed browser-test source.

SHA-256 of reviewed source:

| File | SHA-256 |
| --- | --- |
| `src/domain/zonedTime.ts` | `37b426ec8945a6811045968622acad0ad9af1a6174099cd5cb9db34200553878` |
| `tests/zoned-time.test.ts` | `9e9688351f89309045345325ff305e611ccdbc4823257b27735ddca7a1b25437` |
