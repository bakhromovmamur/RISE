# SYNC-02 local verification — 22 October 2026

**Result: local implementation complete; TASKS status REVIEW.** Cloud provisioning, hosted release and physical mobile acceptance remain pending. See [the user/protocol guide](../../SYNC-RECOVERY.md).

## Implemented and observed

- Semantic conditions merge independent records/dates; competing check/Undo, prayer, target and reward corrections retain local intent for explicit review.
- Stable retries return the original receipt. Compact tombstones/removal revisions and a monotonic retention floor prevent stale deletion/recreation from appearing unchanged.
- Old format-one account caches remain readable. Full-snapshot recovery retains the original optimistic state/outbox and uses current-head/cache-version checks. Eligible reapplication creates a new reviewed ID; it never silently repurposes an expired ID.
- The existing account sheet presents current/local choices in English, Uzbek Latin and Russian. Source intent remains privately downloadable. Storage failure, stale preview, account expiry and pending logout do not silently discard it.
- Fresh corrections on retained archived history and separate next-week reward attempts retain the original domain behavior without unarchiving their parents. A recovered timezone does not reactivate calculation settings for a different zone; the original setup remains in recovery.

## Verification

| Command | Result |
| --- | --- |
| `npm run check` | 174 unit/tooling tests; lint, three TypeScript projects and both builds pass |
| `npm run test:infra` | 46 real local Postgres/Auth/infrastructure tests pass |
| `npm run test:sync` | 48 Chromium/WebKit/Firefox checks pass: 30 real-session functional cases and 18 visual-only layout cases |
| `npm run test:auth` | 21 checks pass |
| `npm run test:backend` | 9 checks pass |
| `npm run test:browser` | All 378 existing journey checks pass |
| `npm run test:production` | All 39 checks pass |
| `npm run test:pwa` | All 42 checks pass |
| `npm run test:visual` | 48 matrix cases / 720 unchanged comparisons pass; no reference regeneration |
| Local/test database advisors | No warning/error issues |

The final sync run has no retries, skips or unexpected failures. The added database cases exercise full/Undo and deletion/recreation, prayer correction/tombstone, reward correction/re-earning, retired milestones, stable replay, stale clocks/floors, receipt rollback, owner isolation and fresh archive-history behavior. Browser cases use real managed local sessions and storage; synthetic fault controls live only in the test server. Old queues and expired receipt timestamps are simulated with synthetic data, not a claim of waiting 90 days or exhausting a physical disk.

[Machine-readable verification](verification.json) records versions, durations and scopes. [Implementation iterations](test-iterations.json) distinguish resolved fingerprint/fixture issues and an offline-test outage cascade from the passing runs. The offline case now waits for service-worker readiness/controller and restores its synthetic outage independently of the page. The repeated full standalone sync runs passed.

## Preservation and security

[Preservation hashes](preservation.json) confirm unchanged **7 CSS files, 12 public assets, 14 domain files and 720 visual goldens**, with no source removals. The existing 4173 origin/profile was never opened, read, seeded, cleared or used for fixtures. Guest IndexedDB/domain versions and the legacy source are unchanged. The existing journey suite rewrote its historical desktop-delivery capture; that file was restored exactly from the before snapshot after the suite.

[Database metadata](database-summary.json) records nine additive migrations, 28 `rise` tables, forced owner/session RLS and the invoker totals view in each retained local/test environment. Two migrations add compact changes/floor and removal barriers; no applied older migration was rewritten. Receipt updates remain denied. The only new receipt DELETE grant is constrained to the active owner's database-expired receipts.

[Credential scan](secret-scan.json) checks actual protected local/test runtime values in memory plus authenticated-JWT/session-cookie/CSRF patterns against source, bundles, documentation and test artifacts; it emits counts/paths only. No real mail, session credentials or user data are included here. Traces, video and automatic screenshots stay disabled for real-code flows.

## Interface evidence

The 18 visual-only cases cover **486 layout states** across both themes, en/uz/ru, 375/393/430/320 px at 100/200% text and desktop width. [The screenshot manifest](screenshots.json) identifies **72 synthetic captures**, including existing consent and new recovery top/action views. These use visual-only metadata with no usable cookie/code; real session cases are separate. Automated checks assert reflow, reachable controls and keyboard focus. The primary agent inspected representative English mobile, Russian 320 px/200% and Uzbek desktop captures in the bounded confirmation pass. The one mechanical design scan found no issues; CSS/artwork remain unchanged.

## Limits and cleanup

This is local acceptance. The earlier 4190 WebKit/Firefox entry observation remains INFRA-01; functional BFF/browser suites use 4191. Physical mobile/HTTPS, hosted throughput/security, account deletion/shared membership and Web Push remain separate gates. Ordinary receipt/change retention runs opportunistically during owner activity; inactive metadata can remain longer until a scheduled maintenance job is implemented under OPS-02.

[Cleanup](cleanup.json) records only this task's local/test stacks stopped with volumes retained. Unrelated containers and the existing 4173 preview remain available. No deployment, DNS change, purchase or cloud project provisioning occurred.
