# Local sign-in and test-queue corrections — 25 October 2026

Scope: RELEASE-01 / AUTH-01 / INFRA-01 / GROUP-04 / PUSH-04; PRD-01, PRD-03, PRD-04, PRD-11, PRD-14 and PRD-20. Local desktop browsers and fixed local/test installations only. Cloud provisioning remains pending.

Local verification is complete: all 270 remaining browser cases passed with zero failures, skips or retries. [Commands and results](verification.json), [diagnostic attempts](diagnostics.json) and [browser versions](environment.json) separate reproduced defects, fixture errors and successful runs. Earlier [activation evidence](../worker-activation-2026-10-25/README.md) is unchanged.

## Verification

| Command | Final result |
| --- | --- |
| `npm run check` | 316 tests; lint, types and both builds pass |
| Selected auth/lifecycle/group-notification/live-sender database integration suites | 48 pass |
| `npm run test:auth` | 30 pass across Chromium, WebKit and Firefox |
| `npm run test:sync` | 69 pass across Chromium, WebKit and Firefox |
| `npm run test:push` | 54 pass across Chromium, WebKit and Firefox |
| `npm run test:groups` | 111 pass across Chromium, WebKit and Firefox |
| `npm run test:rollout` | 6 pass across Chromium, WebKit and Firefox |
| `npm run infra:verify -- local` and `-- test` | Both pass, including exact email-template responses |

Earlier same-day retained reports show production 78/78, PWA 63/63 and visual 48/48 (720 comparisons) passing. These are listed separately from the final continuation runs. [Preservation comparison](preservation.json) checks 62 local tables, five protected configuration files, UI/styles/assets, migrations and all 799 frozen visual references. [Secret scan](secret-scan.json) records zero known-secret matches. Prior failures and diagnostic limits remain in the diagnostic record.

## Sign-in corrections

`src/sync/workspace.ts` retains the newest identity-read outcome until replacement, sign-out or closure. An older Account-sheet response awaits that outcome, including a newer failure that has already settled. This prevents an unusable form caused by a superseded null identity. Generation checks after asynchronous cache reads fence outdated identity changes. Identity remains memory-only and grants no server authority.

`tests/auth/identity-race.auth.spec.ts` covers the real Account screen and BFF with controlled response ordering, followed by real email-code sign-in. It checks a usable form, latest-read failure with explicit Retry, and a newer failure settling before the older response. Its clock is paused between deliberate advances and outstanding routes are awaited during teardown. Service workers are blocked only in these response-order cases; ordinary auth/sync/rollout/PWA suites retain their worker settings.

`server/auth/sessions.ts` commits request/verification quota reservations before provider I/O. The original code reproduced a database advisory-lock timeout when a slow provider call held another context's shared-IP quota lock. Both reservation and challenge transactions validate CSRF/context and applicable current-session/reauthentication authority. Failed/interrupted attempts remain charged. All quotas, database/network deadlines, neutral delivery responses, challenge binding, five-attempt counters and `provider_ready` checks remain. The new database cases exercise real provider verification with only one call held at its existing adapter boundary.

Original logs identify the historical Chromium invalid-code outcome as an Auth `/otp` HTTP 500 after a 5.04-second transaction cancellation; the BFF correctly left that challenge unusable. A template 404 occurred in the same interval. The historical WebKit unavailable outcome coincided with an advisory-lock statement timeout. These observations do not establish that the template failure caused the provider transaction timeout. Transient provider failure remains fail-closed and explicitly retryable; passing runs are not proof that a provider can never fail.

## Local template repair

Repeated `cp` setup replaced the inode of the public email template while Docker mounted the old file. Both local/test gateways returned 404 and their mounted files were unreadable. `scripts/infra/email-templates.ts` now preserves file identity, skips unchanged content and updates changed content in place; `scripts/infra/local.ts` uses it and verifies the exact confirmation/magic-link HTTP responses. A hard-link regression checks the observable mounted-file semantics.

Only the two labeled RISE gateway containers were restarted to remount their existing template files. Database/Auth containers, volumes, credentials and installation identities were not reset. Both `infra:verify` commands pass. The [environment guide](../../BACKEND-ENVIRONMENTS.md) records recovery for an older stale mount. No email wording, provider configuration or key was changed.

## Sender test isolation

Browser sender cases previously ran an entire installation scheduler tick and required every other test's due queue to be empty. Retained synthetic records can legitimately become due later. `tests/groups/notifications.groups.spec.ts` and `tests/push/live-sender.push.spec.ts` now use existing owner-filtered claims and the same encrypted dispatch path as the full scheduler.

`server/push/groupJobs.ts` exposes `sendGroupNotice`; `server/push/worker.ts` exposes `sendPushReminder` and shares reminder encryption. Authorization, leases, owner/membership checks, consent, expiry, cancellation, encryption and receipts remain in the existing dispatch transaction. Production scheduler selection, lanes and limits are unchanged. The reminder browser case supplies a database heartbeat; full scheduler/readiness/watch behavior is separately exercised by the real runtime integration tests.

`tests/support/senderBrowser.ts` deliberately creates another fresh synthetic account with a due reminder and queued explicit test. It verifies that their IDs, status, attempts and lease/completion fields remain unchanged during each delivery case, then deletes only that newly created account. No historical queue reset or unowned job drain is used to satisfy the browser test. Only outbound provider transport is injected; encryption, database authorization and receive handling remain real.

`tests/support/browser.ts` attaches at most thirty authentication route/status outcomes on failure, with allowlisted error codes. No request body, address, code, cookie, token or raw provider error is included. Credential traces, videos and automatic screenshots stay disabled. Raw test outputs remain private and are not published with this evidence.

## Compatibility and remaining gates

No UI composition, CSS, domain rule, user-authored record, schema, cache format, dependency or consent setting changes. Rollback is format-compatible, though reverting these fixes reintroduces the documented races, quota contention and stale-template setup behavior. No database recovery, cache clearing or schema rollback is needed.

The earlier temporary logs disappeared across the environment restart; retained repository reports and the fresh final runs are identified separately in the command record. No missing log is presented as a newly executed test.

RELEASE-01 remains IN PROGRESS for the actual consented pilot, physical-device/elapsed-day acceptance, QUALITY-03 performance targets, operational/policy approval and hosted verification. No real messages, public pilot, deployment or cloud provisioning was performed. Managed email guidance and the [official changelog](https://supabase.com/changelog.md) were reviewed alongside the [email OTP contract](https://supabase.com/docs/guides/auth/auth-email-passwordless).
