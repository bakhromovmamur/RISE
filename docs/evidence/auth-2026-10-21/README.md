# AUTH-01 — Local email-code sessions and guest separation

**Date:** 21 October 2026 · **Status:** REVIEW — local implementation complete, hosted acceptance pending.  
**Requirements:** PRD-03, SEC-02; the account-data lifecycle also depends on AUTH-02/SYNC/DATA/PUSH tasks.  
**Authorization:** local implementation only. Cloud projects, SMTP sender, DNS and deployment remain pending by user direction.

## Implemented behavior

The existing Account destination under You → Settings → Your data now requests and verifies real managed six-digit email codes through the local BFF. Mail is captured by the local SMTP inbox and never delivered externally. The forms use the incumbent sheet, fields, buttons and typography in English, Uzbek Latin and Russian. No CSS, design tokens or artwork changed.

Challenges bind a browser context, encrypted address, remembered-session choice, ten-minute expiry and five-attempt limit. Rolling HMAC rate limits enforce resend and brute-force budgets. Responses remain neutral when delivery is refused. Verification rotates opaque HttpOnly identifiers; provider credentials stay encrypted on the server. Reads verify linked BFF/provider session state and current account ban/deletion status. Refresh is serialized with a row lock; temporary faults preserve the session for retry. Logout commits revocation and erases provider material before clearing account cookies.

**The daily journey remains separate device-only guest data while signed in.** Authentication cannot upload, merge, replace, clear or reassign the guest profile, receipts or drafts. No account-personal table/cache, sync sender, real membership or subscription exists yet. Remembered-device choice controls session persistence only in this increment. The Account sheet states those limits explicitly. Its metadata, email, code and challenge stay in memory, outside durable drafts/backups. Failed/disconnected sign-out never reports confirmed success.

See [setup, policy, grants, key custody and recovery](../../AUTH-SESSIONS.md) and [backend environments](../../BACKEND-ENVIRONMENTS.md).

## Recorded verification

All runs used synthetic isolated contexts/data. No test loaded or changed the user's preview/profile on 4173. Browser reports record zero unexpected failures, skips or flaky results in the final runs.

| Command/check | Final result | Evidence |
| --- | --- | --- |
| `npm run check` | Passed toolchain, lint, app/tools/server types, **156 unit/tooling tests**, production/review builds | [check.log](check.log) |
| `npm run test:infra` | **20 passed**, against actual separate local/test Postgres/Auth | [integration.log](integration.log) |
| `npm run test:auth` | **21 passed**, seven scenarios in Chromium/WebKit/Firefox | [auth-browser.log](auth-browser.log) |
| `npm run test:backend` | **9 passed**, real BFF production/offline/static boundary | [backend-browser.log](backend-browser.log) |
| `npm run test:browser` | **378 passed**, retained journeys in three engines | [journeys.log](journeys.log) |
| `npm run test:production` | **39 passed**, including legacy versions 1–4 and malformed-data recovery | [production.log](production.log) |
| `npm run test:pwa` | **42 passed**, real worker/offline/update lifecycle | [pwa.log](pwa.log) |
| `npm run test:visual` | **48 passed / 720 exact screenshot comparisons**, no golden updates | [visual.log](visual.log) |
| Environment verification, both stacks | Correct installation, restricted BFF role, Auth health and loopback ports | [local](local-verify.log), [test](test-verify.log) |
| Database security/performance advisors, warning threshold | Both exit 0, no findings | [local](local-advisors.log), [test](test-advisors.log) |
| Impeccable mechanical detector, changed UI targets | Empty findings; bounded visual inspection also performed | [detector](design-detector.json), [capture manifest](screens.json) |
| Private-value scan | No matched secrets in source, docs, bundles, test artifacts or current auth logs | [secret-scan.json](secret-scan.json) |
| Final rebuilt bundles versus tested bundles | **43 files identical**, so the rebuilt output matches the tested release | [tested-builds.json](tested-builds.json) |

[Machine-readable verification](verification.json) records browser run dates/durations. Environment: Darwin 25.6.0 arm64, Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0; standard Postgres 17.11. These are desktop engines, not physical phone or hosted HTTPS certification. The pre-existing large-chunk build advisory remains informational; performance acceptance is separate work.

### Important observed cases

- Actual managed code verification succeeds; resend preserves one Auth identity per address. Cross-context handles, expired challenges, incorrect/consumed codes, five-attempt lockout and stale CSRF fail. A failed replacement delivery cannot activate a previously valid managed code.
- Missing/foreign Origin, missing/stale CSRF and extra actor/redirect fields fail before email dispatch. No request-supplied identity authorizes the session.
- Default cookies are session cookies with 30-minute idle/12-hour absolute expiry. Explicit remembered sessions persist for at most 30 days with seven-day idle expiry.
- Logout invalidates the linked predicate even for old provider claims; provider-session removal, idle/absolute expiry and account bans deny a previously valid session. A copied session without its context and damaged ciphertext fail closed.
- Six concurrent reads refresh once through the real provider. A temporary injected provider outage returns 503, preserves the row and recovers on retry.
- Anonymous/authenticated/worker/lifecycle identities cannot read private session tables. The narrow predicate owner cannot log in, bypass RLS, create roles/databases or read password material. Wrong-subject and revoked linked claims return false.
- Browser tests cover rejected code recovery, returning from the inbox without losing the challenge, session reload, A→logout→B, remembered-session choice, cross-tab sign-out and a real disconnected-server failure. Identity never enters guest storage or public caches.
- An actual failed IndexedDB guest edit remains pending while another tab signs in and signs out. Retry later saves that exact edit while retaining the other records and immutable legacy source.
- New forms reflow in all three languages, both appearances, 320/375/393/430 px at 100%/200% text. Headers/Close remain in view and verification actions are reachable. Fifteen captures show only unverified forms with empty code inputs. Real credential flows disable traces, video and automatic screenshots; no inbox/body/cookie export is retained.

The test-only setup resets only three HMAC quota subjects for the shared loopback browser IP after verifying the isolated test installation. This prevents successive complete test runs from exhausting each other's budgets; it does not weaken application limits, clear accounts or expose a runtime reset endpoint. Per-run integration injectors use a synthetic loopback subnet. Provider-failure/expiry tests change only their own synthetic challenge/rate/session rows.

## Preservation and change boundary

[Before hashes](before.json) cover 900 pre-existing files. [Preservation results](preservation.json) record zero removed baseline files and unchanged protected data/domain/persistence code, CSS, artwork, design documents and visual references. Existing frontend edits are limited to Account routing/title, one Settings disclosure row and its Russian title. Domain rules, personal commands, backup/restore and the service worker are unchanged.

New code lives in `server/auth/`, `src/auth/`, `src/contracts/auth.ts` and focused tests/configuration. Two additive auth migrations extend the original infrastructure migration; [actual database metadata](database-summary.json) confirms six forced-RLS private tables and the catalog-bound predicate owned by the restricted guard in each environment. No habit/prayer/pause/note/member tables or browser migrations were introduced.

The protected controller upgrade adds a versioned random session-encryption key once. Existing installation UUIDs, runtime passwords, Auth signing keys and volumes are retained. `.rise-infra/`, managed provider logs and mail contents are excluded from this evidence. No Git repository was initialized and no cloud resource or deployment was created. Only RISE's named local/test stacks were used; unrelated Docker projects were untouched.

After verification, both RISE stacks were stopped with their volumes and credentials retained ([local](stop-local.log), [test](stop-test.log)). The unrelated containers remained running. Use the guide's explicit startup commands to try local account sessions. [Documentation checks](documentation-check.json) resolve all 144 local links; [source hashes](source-hashes.json) identify the implementation reviewed here.

## Remaining acceptance and rollback

Hosted HTTPS uses Secure `__Host-` cookies. Fixed HTTP loopback uses separate development cookie names without Secure because WebKit rejects Secure Host cookies there. This explicit development exception is not transport-security certification. Verified SMTP delivery, hosted cookie/header/origin behavior, host/region decisions, mobile devices, proxy/IP/abuse capacity, operational key recovery and hosted rotation remain release gates. INFRA-01 stays IN PROGRESS; AUTH-01 stays REVIEW for local completion.

Account-personal schema/RLS, cache/queues/import consent, synchronization, deletion, subscriptions and recent-auth business actions remain assigned to later tasks. No account-data isolation or offline-cache certification is claimed for stores that do not exist yet.

Rollback preserves additive schemas, existing keys and browser data; use compatible server/assets and explicitly revoke still-active sessions if reverting to a release without account controls. The current single-key format requires reviewed revoke-and-rotate maintenance. Never reset a profile or regenerate installation credentials to recover an authentication error. See [the recovery procedure](../../AUTH-SESSIONS.md#key-custody-recovery-and-rollback).
