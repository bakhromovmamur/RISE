# SYNC-01 — Local guest import and account synchronization

**Verified:** 22 October 2026 · Asia/Tashkent.  
**Status:** local implementation in REVIEW; cloud provisioning and release acceptance remain pending.  
**Requirements:** SYNC-01, PRD-02–04, SEC-01–03/05. Followed the repository's Karpathy discipline and existing interface. [Implementation guide](../../ACCOUNT-SYNC.md).

## Outcome

Signing in uploads no guest data. A worker prepares a selected-record preview with dates/counts/provenance/XP; upload requires explicit consent and live import requires final confirmation. An append merge keeps existing account records. The original guest profile, exact legacy source, recovery point, drafts and archives remain separate and intact.

Remembered accounts commit owner-scoped state and stable outbound intents atomically in a separate IndexedDB database. Session-only private data stays in memory and needs server acknowledgment for successful save feedback. Captured dates survive offline retry; lost successful responses replay without duplicate XP. Authorized snapshot pull is bounded and revision-consistent. Expiry/switching hides another owner's data, while pending logout offers recovery/export or explicit version-bound discard.

Global revision conflicts keep local intent and surface Needs attention. No automatic rebase or whole-account overwrite is implemented. Entity conflicts, tombstones, incremental feeds and stale-client recovery remain SYNC-02. Full account export/deletion remains DATA-04.

## Verification results

| Command | Result and scope |
| --- | --- |
| `npm run check` | 169 tests passed; pinned toolchain, lint, app/test/server types and both builds passed |
| `npm run test:infra` | 36 real Postgres/Auth integration checks passed |
| `npm run test:sync` | 30 checks passed: 21 real-session functional cases and 9 visual-only layout cases across Chromium/WebKit/Firefox |
| `npm run test:auth` | 21 existing session/account browser checks passed |
| `npm run test:backend` | 9 real BFF/public-shell checks passed |
| `npm run test:browser` | 378 existing journey checks passed in three engines |
| `npm run test:production` plus targeted rerun | All 39 unique checks passed across the full run and rerun; initial run had two Firefox timeouts, and both passed in an isolated rerun without a product-code change |
| `npm run test:pwa` | 42 real-worker install/offline/update/recovery checks passed |
| `npm run test:visual` | All 720 comparisons passed in 48 cases; no reference was regenerated |
| Supabase local/test advisors | No issues at warning threshold, with fail-on-warn |
| Manual changed-UI detector | No deterministic findings; screenshots inspected against existing design |

Exact machine/browser versions, commands and compact report statistics are in [verification.json](verification.json). Environment: Darwin 25.6.0 arm64, Node 24.16.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. These are desktop engine checks, not physical mobile certification. Build retains the existing large-chunk warning; no dependencies/framework were added.

Passing logs: [toolchain/build](check.log), [database](infra.log), [sync](sync.log), [auth](auth.log), [BFF](backend.log), [journeys](journeys.log), [PWA](pwa.log), [visual](visual.log). Production evidence retains the [initial run](production-initial.log) and [two-check rerun](production-retry.log). Advisors: [local](local-advisors.log), [test](test-advisors.log).

## Important cases exercised

- Sign-in and local preview produce no personal upload; staging remains outside live history until explicit final commit.
- Original guest state/legacy source remain unchanged; coordinates, raw calculation keys, unfinished drafts and credentials are absent from outbound import/command projections.
- Independent contexts with two real managed sessions converge through the actual BFF without duplicating habit XP.
- Remembered offline changes survive actual service-worker reload/reconnect. Expired owner A's pending work remains locked through account B and resumes after same-owner reauthentication.
- A real server commit followed by a discarded response replays the original operation exactly once. Fault controls are confined to the isolated test entry and require verified session/Origin/CSRF; ordinary production routes contain no fault endpoint.
- Active and inactive pending account work blocks logout without explicit discard. Unchecking consent revokes it; recovery download remains available. Guest records survive logout.
- Injected IndexedDB failure commits neither account state nor outbox and shows no successful save; retry preserves the intent.
- Real database tests cover actor/CSRF/consent denial, owner/session RLS, changed-owner updates, cross-owner staging FKs, whole-batch rollback, receipt-write rollback, immutable/repeated pages, repeat append import, pagination/stale cursors, expiry and cancellation.
- A synthetic two-year/100-habit projection preserves all 73,100 checks, XP and 731 reflections through bounded import pages. This is projection/round-trip evidence, not a 73,100-write hosted performance/load test.

The first browser pass exposed an unnecessary calendar revision and a logout render race; both were fixed. Preservation fixtures now wait for the existing startup calendar to finish before taking their baseline. WebKit worker requests bypassed page-route fault injection; the final tests exercise server-side connection faults instead. Visual-only mocked metadata blocks workers and makes no authentication claim.

## Interface and preservation

All existing CSS, public assets, domain reducers/calculations and frozen visual references retain their pre-change hashes. New account states use the current sheets, buttons, fields, labels and focus behavior. No artwork, typography or tab layout changed. [before.json](before.json), [preservation.json](preservation.json), [source hashes](source-hashes.json) and [build hashes](build-hashes.json) record the boundary.

Consent/selection checks cover English, Russian and Uzbek, both themes, 375/393/430/320 px, 100/200% root text and desktop: 324 layout states across three engines. The [36 captures](screens/) use visual-only metadata with no usable session or code. Examples: [English consent](screens/sync-preview-en-light-393-100.png), [Russian selection](screens/sync-selection-ru-dark-393-100.png), [Uzbek enlarged consent](screens/sync-preview-uz-dark-320-200.png), [desktop selection](screens/sync-selection-en-light-1440-100.png). [Detector result](design-detector.json) is supplementary, not a design verdict.

The user's browser/profile on 4173 was never opened, inspected, seeded or cleared. All test records/accounts are synthetic and isolated. The guest database/profile formats remain unchanged; the new owner cache is separate. [Secret scan](secret-scan.json) checks protected runtime values and authenticated JWT/cookie patterns without exporting them.

## Database, runtime and remaining gates

Both retained stacks applied seven additive migrations and run standard Postgres 17.11. The new `20261021201759_consented_personal_sync.sql` adds two forced-RLS owner-private staging tables, separate prayer tracking start and compatibility for unknown legacy report time. Each stack has 26 `rise` tables plus six private infrastructure/auth tables; all force RLS. No applied migration or credential/installation identity was rewritten. [Database metadata](database-summary.json).

Normal local runtime health on 4190 returned 200; anonymous sync returned 401/no-store. Chromium reached the app and received the expected 401 from a private read. Bounded WebKit/Firefox startup smoke on 4190 did not reach the app; cause was not established. All full BFF/sync tests pass on 4191. This existing local-origin compatibility issue is explicitly retained under INFRA-01 before local mobile acceptance. [Runtime observation](runtime-health.json). Do not weaken session/Origin/CSRF or reset installation identity to hide it.

Cloud project creation, region approval, external SMTP, hosting/DNS, deployment, physical-device installation and production security/load/backup drills remain pending. No cloud, email, DNS or deployment action was taken. The temporary runtime and only the two RISE stacks are stopped after verification, retaining their volumes/credentials; unrelated services and 4173 remain untouched.

Rollback retains additive schema, guest data, owner caches and current command/cache readers. Do not drop tables, clear caches or downgrade to an incompatible client to undo the feature. Staging expiration is an access deadline with opportunistic cleanup; a future lifecycle job must enforce physical retention. Receipts remain unpruned until SYNC-02 defines stale-client recovery.
