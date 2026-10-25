# Chromium worker activation — local correction, 25 October 2026

Scope: RELEASE-01 / OPS-03 / WEB-02; PRD-01, PRD-03, PRD-04, PRD-17 and PRD-20. Local desktop browser verification only. Cloud provisioning remains pending.

## Reproduction and cause

The earlier [release rehearsal](../release-rehearsal-2026-10-25/README.md) correctly left the intermittent Chromium activation finding open. This follow-up first reproduced the original sealed-package replacement failure on its first attempt. Content-free network and worker-state diagnostics observed the old worker stop, immediately restart, and remain active while the approved replacement stayed installed/waiting. A background sync request arrived at that boundary; no network request remained pending at the final observation. These observations identify an application handoff race, not a proven defect in a particular Chromium source revision.

The original approval protocol froze personal edits but allowed account/session/group/sync requests and optional worker status/pruning messages to restart the retiring worker. `AccountJourney.whenSaved()` may itself initiate background sync for a remembered account. Required session-only sync must finish before approval, so disabling sync indiscriminately would lose its durability guarantee.

A smaller real-worker probe with repeated direct private fetches also failed immediately. Explicit worker network forwarding improved that probe but failed on the sixth repeat; it was discarded. Repeated focus events through the real account client passed ten times before the fix, so that probe alone was not treated as proof. The retained regression instead observes the missing handoff invariant directly: after approval, fifty additional private reads began during one second on the original code. It uses the existing isolated twelve-second activation delay, the actual WorkspaceSession/account client, and the unchanged activation deadline. Initial test-copy capitalization mistakes are recorded separately from this valid failure.

The browser lifecycle interpretation is consistent with Chromium's [registration activation logic](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/service_worker/service_worker_registration.cc) and [worker skip-waiting/no-work handling](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/service_worker/service_worker_version.cc). Those moving main-branch sources are supporting context, not evidence that the tested binary contains an independently diagnosed browser bug.

Diagnostic attempts and their actual outcomes are retained in [diagnostics.json](diagnostics.json).

## Focused correction

- `src/pwa/requestHold.ts` owns a per-document, memory-only private-request hold. It waits for already-started requests, including response-body handling. New requests fail through the existing unavailable/retry path; it never stores credentials, queues requests, rewrites operation IDs or replays mutations.
- `src/auth/client.ts` and `src/sync/client.ts` bracket their existing request/parsing paths with that hold. Their authentication, owner checks, CSRF, cache policy, abort behavior and existing request deadlines remain.
- `src/pwa/client.ts` finishes the existing journey durability hold first, then drains and pauses private requests before replying with approval. It suppresses optional status/pruning messages during the lease. Explicit refusal and the existing thirty-second expiry reopen the request lane; controller change reloads the held document. The prior reply-timeout correction remains.
- `tests/pwa-request-hold.test.ts` verifies response-body draining, both API entry points, no replay, refusal/expiry release, stale-token fencing, network/JSON failures and cancellation. `tests/pwa/lifecycle.pwa.spec.ts` verifies real account reads stop during approval, the actual worker replaces, saved records remain equal, and reads resume afterward.

No worker fetch/cache implementation, UI, CSS, domain reducer, schema, migration, dependency, storage format, public protocol contract or test deadline changed. Temporary worker/network probes were removed. The original rollback test is unchanged and remains the integrated regression for session, exact outbox, guest source and eventual single application of a pending action.

## Verification and preservation

The correction passes the original-code failing handoff regression in Chromium, WebKit and Firefox. Five extended Chromium replacement/rollback cases passed before a separate login failure stopped that run; the final sealed-package suite passed all six cases across the three engines. The final source check passed 315 unit/tooling tests, PWA 63, production 78, visual 48 cases/720 comparisons, authentication 21 and push 54. The group run passed 110 with one test-queue isolation failure; its affected scenario passed three isolated reruns. The full sync run passed 68 with one pre-update sign-in failure; its affected scenario passed three focused reruns. See the separate-results section below rather than treating those reruns as a full-suite pass.

See [verification.json](verification.json) for exact commands, outcomes, build and browser identities, including diagnostic failures. See [preservation.json](preservation.json) for read-only local database/configuration and file comparisons. The installed runtime/browser versions are in [environment.json](environment.json). The scoped [known-secret scan](secret-scan.json) covers source, builds, this evidence and sealed public assets; it is not a complete security audit. Private logs and credentials are not published. Browser fixtures use only isolated test origins; authenticated suites keep credential traces, video and screenshots disabled. No user browser origin was reset or loaded with fixtures.

### Separate regression findings

The extended Chromium rollout attempt completed five successful replacement/rollback cases, then rejected a synthetic sign-in code in the sixth case before reaching activation; nine cases did not run. The final complete rollout suite passed six cases across all three engines, and the full authentication suite passed 21. The broader sync suite passed 68 cases and failed one WebKit case while opening its initial sign-in form with an unavailable message, before any update hold. That export/cleanup case passed three isolated reruns. These pre-update results are retained for triage; passing later checks do not establish their causes or claim them fixed. No production authentication limit, test deadline or assertion was weakened. RELEASE-01 remains IN PROGRESS for these separate findings and its remaining release gates.

The full group suite passed 110 cases and failed one WebKit notification case at its database-isolation precondition: 35 due push jobs existed where zero were required. It failed before attempting notification delivery and never entered worker replacement or an update hold. The scenario passed three isolated WebKit reruns. The test queue was not cleared and the assertion was not weakened. This separate test-isolation finding remains open; isolated reruns cannot establish that the full sequence is reliable.

## Recovery and remaining gates

The correction requires the updated page code. An already-open older page retains its older request behavior; an already-stalled old-client update is not retroactively repaired. Preserve pending data and use the existing [compatible rollout procedure](../../LOCAL-ROLLOUT.md): finish required saves and close/reopen older app tabs normally. Never unregister workers, delete storage, discard outboxes or downgrade schemas to repair an update. Compatible rollback retains the same formats, though returning to code predating this correction restores its older handoff behavior.

This evidence does not establish physical mobile/browser delivery, a consented pilot or production release readiness. QUALITY-03 performance/capacity, actual participant feedback, physical accessibility/push, operational contacts, hosted security/recovery and policy/provider approval remain open. RELEASE-02 is not approved. Cloud provisioning remains pending.
