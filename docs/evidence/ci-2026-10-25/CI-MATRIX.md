# Infrastructure browser matrix — 25 October 2026

Scope: FND-02 CI execution; existing security, database and browser gates are retained. Cloud provisioning and deployment remain pending.

## Observed reason

[Run 40211768434](https://github.com/bakhromovmamur/RISE/actions/runs/40211768434) passed all three web jobs (600 browser cases), 185 infrastructure cases, 21 backend cases, 30 auth cases, 69 sync cases and 54 push cases. Its infrastructure job had consumed approximately **51 minutes** when the group step failed: **105/111 passed in 29.8 minutes**, with six mock-layout failures in WebKit/Firefox. It did **not** hit the 60-minute job timeout. Rollout and advisors were skipped after that failure, so this is not a complete backend acceptance result.

The measured elapsed time leaves little room for the remaining rollout/advisor gates and makes each serial CI attempt slow. The layout failures require their own fixture diagnosis; splitting the job does not repair them or change their assertions.

## Change and coverage

Only `.github/workflows/ci.yml` changes executable configuration. Its infrastructure job becomes three independent Ubuntu runners: Chromium, WebKit and Firefox, with `fail-fast: false`. Each retains the **60-minute** job limit and installs only its selected Playwright browser. All six browser commands receive `--project=${{ matrix.browser }}` through npm's existing argument forwarding.

| Gate | Cases per runner | Combined browser coverage |
| --- | ---: | ---: |
| `test:infra` | 185 | Same 185 database cases repeated on all three runners |
| `test:backend` | 7 | 21 |
| `test:auth` | 10 | 30 |
| `test:sync` | 23 | 69 |
| `test:push` | 18 | 54 |
| `test:groups` | 37 | 111 |
| `test:rollout` | 2 | 6 |
| Browser total | **97** | **291** |

Each runner still performs checkout, pinned Node/npm installation, `npm ci`, production/review builds, both local/test stack setups, the complete database suite, all six browser suites, both warning-failing database advisors and `always()` cleanup of only its two stacks. Browser suites retain one worker and run sequentially within that runner. No per-test timeout, application deadline, performance threshold, retry policy, assertion or test selection beyond the browser project changes. The web matrix and its 20-minute limits are unchanged.

Both explicit browser project configurations (`playwright.infrastructure.config.ts`, `playwright.auth.config.ts`) declare the same three names; sync, push, groups and rollout inherit the auth projects. All six npm scripts directly invoke Playwright with their existing config. The table uses the retained full-suite counts, divided by those three project instances; discovery/source inspection was read-only, with no test or server execution for this workflow change.

## Isolation and tradeoff

Each hosted runner provisions its own loopback-only stacks, credentials, databases, generated configuration and sealed rollout packages. No database, deployment metadata, browser profile or release directory is shared between matrix jobs; the workflow caches only npm dependencies. Existing fixed ports therefore remain isolated by runner. Rollout builds its own packages on each runner.

Job names and failure-artifact names include the browser. Artifact scope stays exactly `test-results/infra/` with seven-day retention; real-auth traces, private configuration and broader browser reports are not newly uploaded. Workflow concurrency still cancels superseded runs for the same ref.

This repeats provisioning and the 185 database cases three times, increasing total runner work, while shortening the browser critical path. It does not guarantee a specific hosted duration. Raising only the serial job to 90 minutes would retain the same long feedback cycle. The matrix must be verified by a subsequent hosted run before claiming complete acceptance.

## Verification status

Static comparison against the preceding workflow confirms only the intended infrastructure matrix, job/artifact names, browser installation and project arguments changed. All gates and 291 browser cases remain represented, with 185 database cases on every runner. Independent workflow review found no actionable issue. No tests, builds, ports, migrations, application files or saved data were changed or executed for this configuration edit.

Final hosted verification: [run 40218685041](https://github.com/bakhromovmamur/RISE/actions/runs/40218685041), source `9e1ec427487d16c90834edb74994288e2b93b6fc`, passed all six jobs on its first attempt. Each backend runner completed 185 database cases, its 97 browser cases, both advisors and scoped cleanup. The overall run completed in approximately 24 minutes 18 seconds. This is one observed run, not a duration guarantee; [the overall record](README.md) retains counts, failures and remaining limits.
