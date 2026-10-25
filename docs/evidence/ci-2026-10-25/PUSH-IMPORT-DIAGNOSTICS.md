# Selected-import failure diagnostics in the sender browser test

25 October 2026 · PUSH-02 / PUSH-03 / SYNC-01 / FND-02 · local diagnosis; hosted cause remains unconfirmed.

Hosted run `40216691259`, WebKit infrastructure job `121239248059`, passed 17/18 push cases. The live-sender case timed out waiting for the `Synthetic reading` checkbox after opening selected import. The restricted infrastructure upload intentionally did not retain a credential-bearing page snapshot or trace. This failure has not been reproduced at the same step locally, and no application correction is claimed.

Three local WebKit repeats of the original case body with private, sanitized request/UI instrumentation passed (21.9 seconds total). Session, code, verification and head requests returned successful statuses; no focus event or page error was observed. These runs used the newly built production bundle containing the independently reviewed formatter cache candidate. A separate forced-focus characterization passed: an already-open chooser is invalidated while Account verifies identity again, and a successful same-owner response returns to the explicit choice. This confirms the existing safety behavior but does not prove that focus caused the hosted failure. Identity fencing, private-form invalidation and the explicit import-consent flow are unchanged.

Only `tests/push/live-sender.push.spec.ts` gains failure diagnostics. Its existing sender/import/owner assertions, test timeout, helpers, retries and production behavior remain intact. The hooks collect at most 100 events from eight fixed same-origin session/auth/import paths, GET/POST/other method labels, HTTP status/outcome categories, relative timings and allowlisted error names. The failure snapshot contains only numeric counts and fixed-label booleans for saved state, dialogs, chooser/checkbox availability, sign-in/checking/pending/busy states and focus count. DOM reading is best effort with a two-second cap. No response bodies, headers, request data, cookies, form values, storage contents, IDs, email addresses, raw errors, screenshots or traces enter the report.

Unexpected failures alone write `test-results/infra/live-sender-<browser>-repeat<N>-retry<N>.json`, using an allowlisted browser name and runner indices. This is inside the workflow's existing restricted evidence path; no upload scope is expanded. Independent privacy review found no exported private content. A deliberate private test failure after synthetic sign-in exercised the artifact path: its JSON passed exact-key/type/enum checks, the 100-event bound and checks for email, UUID, long-token and synthetic private-text patterns. That deliberately generated artifact was moved to the ignored diagnostic directory before the real regression run.

Local results, macOS arm64, Node 24.16.0, npm 11.13.0 and Playwright 1.64.1:

| Command / case | Result |
| --- | --- |
| Private original-body WebKit diagnostics, three repeats | 3/3 passed, 21.9 s |
| Private forced-focus characterization | 1/1 passed, 8.9 s total; this is not a reproduction of the hosted trigger |
| Private deliberate failure after verified synthetic sign-in | Failed at the injected assertion as intended; failure-only JSON emitted and privacy/schema checks passed |
| `node_modules/.bin/oxlint tests/push/live-sender.push.spec.ts --deny-warnings` | Passed |
| `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json` | Passed |
| `npm run test:push -- 'tests/push/live-sender.push.spec.ts$'` | Chromium and Firefox passed; WebKit timed out later while waiting for Synced after import, 2/3 passed overall |
| `npm run test:push -- 'tests/push/live-sender.push.spec.ts$' --project=webkit` | Fresh isolated repeat passed, 1/1, 6.0 s total (4.0 s test) |

The later local WebKit failure differed from the hosted missing-checkbox failure. Its sanitized events show successful verification, import creation/pages/preview/commit and head responses by 3.58 seconds, followed by a long interval without an allowlisted response; the recorded total elapsed time was 287.65 seconds despite the unchanged 120-second test limit. Focus count and page-error count were zero. At collection the page had one saved marker and no dialog/chooser. Concurrent host scheduling pressure was observed by the coordinating agent (load averages 51.46/30.81/16.19 and an unrelated 45-second wait taking 112 seconds). That is relevant provenance, not proof of the failure's cause. No user process was stopped and no timeout was relaxed. The isolated successful repeat did not overwrite the retained failure report.

Engine versions: Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. Private original-body, focus, deliberate-failure and real-run reports are preserved under `.rise-infra/local-completion-20261025/push-import-diagnostic/`. The real sanitized failure remains available in the allowed local evidence directory. A clean hosted rerun must validate the unchanged flow; the additional failure artifact will distinguish states if it recurs. This record does not mark the original intermittent failure fixed. Cloud provisioning, saved user profiles and physical push-delivery gates remain unchanged.
