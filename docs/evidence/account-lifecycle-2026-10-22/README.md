# DATA-04 — Local account lifecycle evidence

22 October 2026 · Asia/Tashkent · existing local workspace. **Local verification passed.** Local implementation is recorded as REVIEW; no hosted or physical-device release claim is made.

## Delivered behavior

- Recent-auth full private account export, strict schema/size/reference/checksum validation and DATA-02 previewed current-view restore.
- Purpose/session/owner-bound email reauthentication with rotated opaque cookies; pending account state stays separate from the guest.
- Explicit device-only account cleanup and reviewed permanent deletion, with independent cache-generation and canonical-revision guards.
- Atomic suppression of every account session/JWT, opaque-cookie terminal receipts, lost-reply retry and no stale account initialization/import/command resurrection.
- Isolated provider purge with bounded retry, primary-absence confirmation, populated historical/staging cleanup and a minimal authoritative deletion ledger.
- Strict owner cache/preferences cleanup across tabs; quota failure hides the account and exposes retry without wiping guest/other-owner records. Foreground alert work/callbacks and deduplication data are scoped to the account.
- Fail-closed hooks for real last-owner and server push cleanup, assigned to their existing integration tasks.

[Exact protocol and operating guide](../../ACCOUNT-LIFECYCLE.md). The implementation reuses existing components and dependencies. There is no Git repository, deployment, cloud project creation, DNS change, external email or access to the user's 4173 profile.

## Verification record

The final machine-readable [verification](verification.json) contains actual command results, engine versions and scope. Passing logs, reports and the [36 synthetic captures](screenshots.json) are retained with this report. Initial failed checks are described separately; they are not counted as passing evidence.

| Check | Final result |
| --- | --- |
| `npm run check` | **180 passed**; lint, types and both builds pass. Final CLI/test edits also pass lint/types and runtime checks |
| `npm run test:infra` | **59 passed**, real retained local/test Auth/Postgres |
| Full sync, auth and BFF browser checks | **69 / 21 / 9 passed**, Chromium/WebKit/Firefox; zero skips or flaky results |
| Final DATA-04 focused browser confirmation | **21 passed** before the final complete run; 324 new supporting-state dimensions |
| Existing journeys, production entry and PWA | **378 / 39 / 42 passed** |
| Original visual matrix | **48 configurations / 720 comparisons passed**; no reference updates |
| Database advisors | Both environments: **No issues found**, warn threshold/fail-on-warn |
| Artifact secrets and source preservation | [Secret scan](secret-scan.json): no leaks. [Preservation](preservation.json): all protected source/asset/golden categories unchanged |

Real Auth/PG cases cover recent authentication, wrong-owner/CSRF/missing confirmation/stale review, concurrent commands, old JWT/session revocation, idempotent terminal retry, primary purge failure/restart, retention and restoration of one synthetic old identity before ledger replay. Populated-account checks verify zero remaining owner rows across all 28 application tables, plus Auth/BFF session removal; another real synthetic owner survives.

The new browser cases use real local codes/sessions for export, two-tab device cleanup/deletion, an actually dropped deletion reply, pending account edits, failed strict cleanup and same-owner reauthentication. Traces, videos and automatic failure screenshots stay off. Layout captures use mocked metadata and no usable account/code, all three languages/engines, both appearances, 375/393/430/320/1440 px and 100/200% text. This is automation, not physical iPhone/Android certification.

## Findings resolved during implementation

1. The restricted BFF cannot call Auth schema functions by arbitrary schema lookup. Freshness now uses the transaction claims already established from its verified stored session; no broader Auth grant was introduced.
2. Managed Auth does not delegate its user DELETE privilege to the migration role. Final purge uses its supported administrative endpoint in a separate local process; the ordinary BFF never receives that key. A successful empty provider response is followed by explicit absence verification; `user_not_found` supports safe retry.
3. A populated import exposed missing cascading root ownership on eight historical child tables. Additive profile-owner foreign keys now permit complete primary purge while retaining composite owner/reference checks. No migration removes existing rows.
4. Retention begins after confirmed primary purge, so a delayed deletion cannot outlive suppression while a retained backup still includes the account.
5. An advisor warning on the freshness policy's claim expression was resolved with an initialization-plan-friendly scalar claim lookup. Both retained environments now pass warn-level advisors.
6. The existing offline-reload scenario timed out in a full run despite an interactive cached page. Its network control now uses an independent bounded request fixture, and reload waits for DOM plus explicit private-data UI assertions. A focused three-engine run passed before the clean full rerun.
7. A two-tab lost-reply rerun exposed a focus refresh aborting an active lifecycle action before its deletion request completed. The account sheet now coordinates the active action, and newly recognized deletion broadcasts once to other tabs. Final supporting-state fixes also make resend send another code, focus an invalid code and omit unavailable pending-data downloads. All 21 focused DATA-04 checks then passed across the three engines before the final complete regression run.

See [iteration metadata](test-iterations.json) for bounded attempts and final scope. Only passing, scrubbed logs are archived. Temporary failing request diagnostics are not retained with credentials.

## Preserved implementation

[Preservation hashes](preservation.json) compare the starting snapshot with current CSS, design files, existing public design assets, domain modules, original visual goldens, applied migrations and guest persistence sources. The public worker has an intentional account-scope callback change; its public-cache behavior remains under the PWA regressions. Source/build hashes and the focused change inventory are generated after verification. The historical desktop delivery PNG rewritten by the journey suite is restored from the exact pre-task snapshot.

Both retained databases use PostgreSQL 17.11, 15 committed migrations and 28 application tables plus nine private operational tables. All application/private tables retain forced RLS and the totals view remains invoker-secured. [Database metadata](database-summary.json) contains schemas, policies, grants, constraints and role flags only, never account rows or secrets.

## Limits and release gates

- Local cleanup requires the separate service. A stopped service leaves requests queued and access blocked; supervised hosting, deadline alarms and provider backup/security-audit retention are OPS-02 gates.
- The authoritative ledger drill restores only one synthetic subject, not an entire physical backup. Hosted RPO/RTO/expiry is unverified. The ledger is retained for 35 days after primary purge; backups target at most 30 rolling days.
- Full relational history stays in the private account file. Device restore uses its current personal projection, explains historical rows retained in that original file and cannot restore account access/membership.
- Real groups, last-owner transfer, family deidentification and server push/subscription cancellation are not implemented by this task. Their hook fails closed; GROUP-05/PUSH integration tests remain pending.
- Offline devices cannot be remotely erased. Recognition clears the owner cache; terminal recognition is bounded by retained deletion metadata, and much-later pending caches can remain locked for explicit local cleanup. Downloaded copies stay under user control.
- The pre-existing local 4190 WebKit/Firefox entry observation remains INFRA-01. Three-engine BFF acceptance uses isolated 4191. The current large-bundle warning remains a later performance gate.
- The user's real saved profile was never inspected or reset. Data safety is supported by additive migration/source checks and synthetic preservation/failure/race tests.

[Cleanup and environment preservation](cleanup.json) records stopped owned stacks, retained volumes/credentials, unrelated containers and the untouched preview listener. Cloud provisioning remains pending.

## Retained artifacts

- [Exact command results and versions](verification.json), [database integration log](database.log), [full sync log](sync-browser.log), [original parity log](visual.log).
- [Private lifecycle runtime smoke](runtime-smoke.json): replayable mode-0600 ledger export, graceful watcher shutdown and protected local/test configuration.
- [Metadata-only database review](database-summary.json), [local advisors](advisors-local.log), [test advisors](advisors-test.log).
- [Source hashes](source-hashes.json), [build hashes](build-hashes.json), [focused changes](changes.json), [link checks](links.json), [mechanical design detector](design-detector.json).

The final environment is macOS Darwin 25.6.0 arm64, Node 24.16.0, Playwright 1.64.1, Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. The full sync run covers 42 real-session cases and 27 visual-only cases (810 layout states); its focused DATA-04 subset is also recorded independently. Only visual-only metadata fixtures were captured.
