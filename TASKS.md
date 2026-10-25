# RISE — Implementation Plan and Task Register

**Version:** 1.1 · **Baseline:** 21 October 2026  
**Release:** production mobile web v1 with the existing product/design preserved.  
**Status:** M0–M4 have completed or locally verified increments; M5 quality, operations and release work remains. Full-release completion still requires the open hosted/device/operating gates.

Sources: [PRD](PRD.md), [Architecture](ARCHITECTURE.md), [Security](SECURITY.md), [Repository instructions](AGENTS.md).

## Contents

- [1. How to use this register](#1-how-to-use-this-register)
- [2. Baseline already available](#2-baseline-already-available)
- [3. Delivery order](#3-delivery-order)
- [4. Task backlog](#4-task-backlog)
- [5. Requirement traceability](#5-requirement-traceability)
- [6. Deferred P2 work](#6-deferred-p2-work)
- [7. Definition of done for each task](#7-definition-of-done-for-each-task)
- [8. Decision and risk register](#8-decision-and-risk-register)
- [9. Documentation validation record](#9-documentation-validation-record)
- [10. Foundation implementation record](#10-foundation-implementation-record)

## 1. How to use this register

- A checkbox means accepted evidence exists, not just code was written.
- Status values: **TODO**, **IN PROGRESS**, **REVIEW**, **BLOCKED**, **DONE**.
- **P0** blocks safe personal/account use or a foundational dependency. **P1** is still required for the complete public web release. **P2** is explicitly deferred.
- Roles identify responsibility, not assigned people: **Product**, **Frontend**, **Backend**, **Security**, **QA**, **Operations**. Assign named owners before execution.
- Dependencies are task IDs. Complete dependency acceptance before relying on the resulting behavior. Under the user’s 23 October direction to finish local work while cloud provisioning remains pending, downstream local implementation may use a dependency’s explicitly verified local contract. This does not close its hosted/device acceptance or authorize release.
- Keep tasks independently reviewable. Record files, tests, actual device/browser versions, evidence and unresolved limits on completion.
- Never claim the complete product is shipped while full-release P1 work is merely hidden.

The active execution order and open external gates are recorded in [the 23 October audit](docs/evidence/product-review-2026-10-23/README.md). Cloud provisioning remains pending by the user’s reconfirmed direction.

No calendar estimate or delivery date is committed. Size is a relative planning hint: S = narrow, M = one bounded module/flow, L = several integrated paths. Re-estimate after foundational work.

## 2. Baseline already available

| Evidence | Current status | What it does not establish |
| --- | --- | --- |
| Four-tab app and original visual system | Implemented locally | Production hosting or real multi-user operation |
| Habit/goal/reward/prayer domain models | Implemented with regression coverage | Durable server transactions or multi-device conflicts |
| Offline prayer calculations and native queue adapter | Implemented in code | Browser background push or native device verification |
| 71 domain + 69 Chromium cases | Previously passed on 21 October 2026 | New backend/security/browser-matrix acceptance |
| Generated iOS/Android projects | Web build and Capacitor sync recorded | Native compilation, installation or store release |

Do not repeat the native-first plan: the latest user direction is **mobile web first**.

## 3. Delivery order

| Milestone | Goal | Exit evidence |
| --- | --- | --- |
| M0 — Baseline and foundations | Freeze parity, decisions, contracts and safe environments | Reproducible baseline; no prototype fixture in production entry |
| M1 — Dependable personal web | Durable local data, backup/restore, real timetable verification, offline PWA | Personal daily journeys survive failures without design regression |
| M2 — Identity and sync | Accounts, authorization, migration and conflict recovery | Two real accounts/devices with isolation and deletion evidence |
| M3 — Real web reminders | Opt-in server scheduling, Web Push and truthful readiness | Physical iPhone/Android evidence; expiry/cancellation/coverage tested |
| M4 — Real family and squads | Replace fictional membership and local collaboration | Cross-account journeys and hostile access tests |
| M5 — Release readiness | Complete localization, accessibility, performance and operations | All launch gates with named sign-off and rollback/restore evidence |

Prayer validation begins in M1. Background reminders depend on M2 because secure subscriptions, identities and cancellation state are prerequisites. This order makes the earlier prayer/notification work usable in a real web product.

## 4. Task backlog

### M0 — Baseline and foundations

#### DOC-01 — Publish the production documentation set

- [x] **Status: DONE · P0 · S · Owner: Product/Engineering · Depends: none**
- Deliver README, PRD, AGENTS, TASKS, ARCHITECTURE and SECURITY with current/target separation and cross-links.
- Accept when link/ID/dependency checks pass, historical guidance is retained, and source/configuration/visual assets are unchanged.
- Evidence belongs in the documentation-validation note at the end of this file. This task does not implement the app.

#### FND-01 — Freeze the visual and behavioral baseline

- [x] **Status: DONE · P0 · M · Owner: Codex (local Frontend/QA implementation) · Depends: DOC-01**
- Capture the current four tabs and important sheets at 375/393/430 px, desktop, both appearances, all languages and 200% text; record fixture, build and dimensions.
- Reuse existing evidence where the state/build is applicable. Record known defects rather than treating every old screenshot as current authority.
- Accept when PRD-01's parity checklist and intentional supporting additions are explicit, with no new design direction.
- Evidence: [foundation report](docs/evidence/foundations-2026-10-21/README.md) and [capture manifest](docs/evidence/foundations-2026-10-21/visual-manifest.json). Forty-eight configurations cover 720 images; the full comparison passed without changing the references. Source/build/fixture hashes and baseline limitations are recorded.

#### FND-02 — Pin runtime/dependencies and establish CI

- [x] **Status: DONE · P0 · M · Owner: Codex (local Engineering implementation) · Depends: DOC-01**
- Pin Node/toolchain, replace unbounded `latest` declarations with reviewed versions, preserve lockfile and add required lint/type/build/test checks.
- Add Chromium, WebKit and Firefox projects as appropriate without rewriting baseline assertions to hide failures.
- Accept when clean install/build is reproducible and synthetic fixture tests never access a personal or production origin.
- Implemented: exact runtime/dependency pins, lockfile agreement check, correctness linting, app/test/config type checks, three browser projects, isolated origin enforcement and a pinned GitHub Actions workflow. [Final local verification](docs/evidence/foundations-2026-10-21/verification.json): clean install, lint/types/build, 72 domain/tooling tests, 207 browser checks and 720 exact visual comparisons passed. The repository is now published and hosted CI is active; the initial hosted failures and their correction are tracked in [CI repair evidence](docs/evidence/ci-2026-10-25/README.md). The earlier foundation report remains local evidence only.

#### FND-03 — Resolve infrastructure and operating decisions

- [ ] **Status: IN PROGRESS · P0 · S · Owner: Product/Operations/Security · Depends: DOC-01**
- Record approved backend default, hosting, region, domain, sender, cost ceiling, launch markets, responsible owners and provider account ownership.
- Confirm standard Postgres/Auth support, backups, key storage and intended adult audience.
- Accept when each decision has an owner, rationale and operating constraint. Provisioning/cost commitments follow the actual implementation authorization; this planning task creates none.
- Confirmed by the user: Uzbekistan and Kazakhstan; `habit.saraftech.com` (not configured); existing domain/hosting account; USD 100 monthly ceiling. [Decision record](docs/INFRASTRUCTURE-DECISIONS.md) identifies remaining provider/plan, region, sender, account ownership and operational assignments. No service was provisioned or purchased.

#### FND-04 — Define validated commands and module seams

- [x] **Status: DONE · P0 · M · Owner: Codex (local Engineering implementation) · Depends: FND-01, FND-02**
- Introduce typed domain commands/contracts and the local repository interface while retaining current AppContext-compatible UI.
- Extract only the pure modules needed by web/server; handle current model import cycles without a wholesale screen rewrite.
- Accept when existing domain behavior passes unchanged and invalid commands cannot reach side-effect adapters.
- Evidence: [command/entry report](docs/evidence/commands-entry-2026-10-21/README.md) and [verification](docs/evidence/commands-entry-2026-10-21/verification.json). Validated record commands, atomic repository contract, non-durable memory adapter and acyclic domain modules are implemented; Today check-in uses the boundary. Full persistent-store and remaining form/draft migration remain DATA-01/DATA-03.

#### WEB-01 — Separate production entry and demo/review builds

- [x] **Status: DONE · P0 · M · Owner: Codex (local Frontend implementation) · Depends: FND-01, FND-02**
- Make production first use empty/real-time; isolate fixtures/reviewer controls in a separate build/origin; remove query-parameter fixture access from production.
- Retain the review experience for development without touching saved personal profiles.
- Accept when new production data has no fictional people/XP/history and legacy profiles still open safely. Covers PRD-02.
- Evidence: [command/entry report](docs/evidence/commands-entry-2026-10-21/README.md). Production excludes review modules; review refuses personal/public origins. All 21 production browser checks passed, including empty entry, onboarding/check-in/reload, schema 1–4 preservation and recoverable malformed/future-schema input. Mixed-history provenance and full migration validation remain DATA-01/SYNC-01.

### M1 — Dependable personal web

#### DATA-01 — Transactional local storage and safe legacy migration

- [x] **Status: DONE · P0 · L · Owner: Frontend · Depends: FND-04, WEB-01**
- Implement IndexedDB repository, schema versioning, outbox transaction, multi-tab coordination, storage failure handling and readback.
- Preserve the exact legacy source; migrate versions 1–4; detect mixed demo provenance before cloud eligibility.
- Accept with interrupted/corrupt/quota/multi-tab tests, invariant comparison and recovery/export without silent reset. Covers PRD-02, PRD-04.
- Completed 21 October 2026: transactional IndexedDB, schema 1–4 worker migration, exact source retention/readback, local-only outbox, revision conflicts, subscriptions and recovery. Evidence: [DATA-01 report](docs/evidence/storage-2026-10-21/README.md), including 88 unit/tooling cases, 234 full browser checks, 33 final focused storage checks, 24 production checks and 720 unchanged visual comparisons. Fault injection uses real IndexedDB transactions; physical disk exhaustion/device durability is not claimed. DATA-02/DATA-03 remain separate.

#### DATA-02 — Validated export, previewed restore and rollback

- [x] **Status: DONE · P0 · M · Owner: Frontend/QA · Depends: DATA-01**
- Add versioned private backup, validation/limits, preview, duplicate/conflict report, pre-import snapshot and atomic commit.
- Exclude credentials/subscriptions/live invite secrets; restore cannot manufacture real membership.
- Accept when legacy and new backups round-trip, malformed/oversized/future schemas leave state unchanged and failed import rolls back. Covers PRD-18, SEC-03, SEC-05.
- Completed 21 October 2026: known-field versioned backups, cancelable validation/preview, read-only local archives, atomic replacement/recovery, revision protection and exact local rollback. [DATA-02 evidence](docs/evidence/backup-2026-10-21/README.md): 97 unit/tooling tests, 276 browser checks, 27 production checks and 720 unchanged visual comparisons; includes real IndexedDB quota/abort/readback failures and a 73,100-check-in round-trip. Server authorization/deletion replay remain later gates.

#### DATA-03 — Preserve all personal journeys through the new store

- [x] **Status: DONE · P0 · L · Owner: Frontend/QA · Depends: DATA-01**
- Connect habits/timer/priorities/goals/rewards/progress/notes/settings to durable commands; preserve drafts and normal navigation behavior.
- Accept full/tiny/Undo, next-day schedule edits, fixed-week rewards, archive/history and day rollover; no extra XP or changed completion semantics.
- Covers PRD-05–08, PRD-12, PRD-16, PRD-19.
- Completed 21 October 2026: personal UI flows use validated durable commands with stable IDs and captured action dates; timers complete atomically, drafts recover across reload and success waits for commit. [DATA-03 evidence](docs/evidence/personal-commands-2026-10-21/README.md): 104 unit/tooling tests, 297 browser checks, 27 production checks and 720 unchanged visual comparisons. Local collaboration simulations/review retain the compatibility setter; accounts/sync remain separate.

#### PRAY-01 — Verify timetable, travel and manual-date behavior

- [x] **Status: DONE · P0 · M · Owner: Engineering/QA · Depends: DATA-01**
- Preserve Adhan/method/Asr/high-latitude settings and 30-day refresh; add reference-city, DST, non-hour zone, travel and unavailable-solar-event cases.
- Keep coordinates local and prior checked/manual snapshots unchanged. Record calculation-library/tz-data versions.
- Accept when all PRD-09 cases pass without using fabricated fallback times.
- Completed 21 October 2026: dated manual saves rebuild UTC windows, travel review is explicit, checked/manual history survives refresh, ambiguous legacy dates await review and unavailable solar events never use samples. [PRAY-01 evidence](docs/evidence/prayer-timetable-2026-10-21/README.md): 403 reference dates, 126 unit/tooling tests, 342 full journey regressions, 75 final prayer/delivery checks, 39 production checks and 720 unchanged visual comparisons. The report records the final guard and verification scope; device/push certification remains separate.

#### PRAY-02 — Harden records, pause and dated Fajr semantics

- [x] **Status: DONE · P0 · M · Owner: Engineering/QA · Depends: PRAY-01, DATA-03**
- Preserve unconfirmed versus explicit missed, independent streaks, private-pause exclusion, dated plans, preview isolation and work-break recovery.
- Accept that clock changes, pause/resume and “I'm up” do not record prayer/XP; cross-midnight and history-correction cases pass.
- Covers PRD-10–12.
- Completed 21 October 2026: UTC-aware records/streaks, safe pause boundaries, dated Fajr backup/draft choices, live/preview isolation and overnight work-note recovery. [PRAY-02 evidence](docs/evidence/prayer-records-2026-10-21/README.md): 137 unit/tooling tests, 378 verified journey cases, 39 production checks and 720 unchanged visual comparisons. The report records the updated legacy draft-date expectation and one bounded visual timeout repeat; no application changes followed the full run.

#### WEB-02 — Installable PWA and offline/update lifecycle

- [ ] **Status: REVIEW · P0 · L · Owner: Frontend · Depends: DATA-01, WEB-01**
- Add manifest/icons/install guidance and one worker for app-shell caching; prepare the worker's push extension seam.
- Protect drafts and migrations during activation; separate public asset caches from private state; provide offline cold/warm paths.
- Accept install/offline/update/logout tests on real mobile browsers with no duplicate root workers or stale incompatible schema. Covers PRD-04, PRD-17, SEC-03.

- Implemented 21 October 2026: branded manifest/icons, one verified public-cache worker, offline cold/warm entry, localized install/storage guidance and explicit all-tab update coordination. Durable queues, drafts, startup/readback and save recovery are protected without changing persistence schemas. [WEB-02 evidence](docs/evidence/pwa-2026-10-21/README.md): 146 unit/tooling cases, 378 existing journey cases, 42 final PWA cases, 39 final production checks and 720 unchanged visual comparisons. The report records the final worker/support-state verification scope and export-test selector correction.
- **Review gate:** run physical iPhone Safari/Home Screen and Android Chrome/PWA installation, offline cold launch and update checks on the HTTPS release host. The local implementation is complete; desktop engine tests do not accept that device gate. Real account logout/switch testing belongs to AUTH/SYNC; WEB-02 verifies public-cache bypass and guest clearing without inventing accounts. See [the device procedure](docs/PWA.md#verification-and-remaining-real-device-gate).

### M2 — Identity and sync

#### INFRA-01 — Create isolated backend/database environments

- [ ] **Status: IN PROGRESS · P0 · L · Owner: Backend/Operations · Depends: FND-02, FND-03, FND-04**
- Implement same-origin BFF, standard Postgres/Auth projects, reviewed migrations, least-privilege runtime roles, secrets and synthetic staging fixtures.
- Add configuration validation, production/review isolation, health endpoints and backward-compatible deployment.
- Accept clean setup from committed migrations, environment mismatch failure and no privileged credential in browser bundles. Covers SEC-06.

- Local foundation implemented 21 October 2026: same-origin Fastify production shell/health endpoints, separate standard Postgres/Auth Docker stacks, reviewed additive migration, immutable installation identity, restricted BFF/worker/lifecycle logins, protected credentials and synthetic Auth fixtures. [Setup and boundaries](docs/BACKEND-ENVIRONMENTS.md); [verification evidence](docs/evidence/infrastructure-2026-10-21/README.md).
- **Hosted acceptance remains pending at the user's explicit request.** Hetzner is confirmed but the plan is unknown. The future Supabase organization is selected; no cloud project, region decision, deployment or DNS change has been made. INFRA-01 stays IN PROGRESS until those environment and operational gates have real evidence. Existing app design, behavior and device data remain unchanged.
- Local-origin follow-up resolved 23 October 2026: WebKit/Firefox block port 4190. `npm run server:local` uses fixed loopback 4192 while retaining the original database marker, installation UUID, credentials and browser-origin storage. Fresh-context Chromium/WebKit/Firefox checks pass with strict Origin/CSRF boundaries. [Current evidence](docs/evidence/product-review-2026-10-23/README.md); [original observation](docs/evidence/sync-2026-10-22/runtime-health.json).

#### AUTH-01 — Email-code sessions and guest/account separation

- [ ] **Status: REVIEW · P0 · L · Owner: Backend/Frontend · Depends: INFRA-01, DATA-01**
- Implement code/retry/recovery, BFF HttpOnly sessions, CSRF, logout, expiry, remembered-device choice and neutral responses.
- Keep private local guests distinct from cloud users and preserve pending personal actions during reauthentication.
- Accept account switching, shared-device, CSRF, replay, brute-force and session-revocation cases. Covers PRD-03, SEC-02.

- Local AUTH-01 implemented 21 October 2026: managed email codes captured in the local inbox, bounded/expiring challenges, opaque HttpOnly sessions, exact-Origin/CSRF validation, serialized refresh, remembered-session choice, sign-out and linked-session/account-status checks. Account forms use existing components in English/Uzbek/Russian. No account-personal cache or sync is implied: guest records, drafts, receipts and pending saves remain separate and unchanged. [Setup and boundaries](docs/AUTH-SESSIONS.md); [verification evidence](docs/evidence/auth-2026-10-21/README.md).
- **REVIEW records local completion; hosted acceptance remains pending.** No cloud project, SMTP sender, DNS or deployment was created. HTTPS cookie/header behavior, real email/mobile devices, hosted abuse/recovery and account-data cleanup in later AUTH/SYNC/PUSH tasks retain their acceptance gates. INFRA-01 remains IN PROGRESS by user direction.

#### AUTH-02 — Personal schema, RLS and transactional commands

- [ ] **Status: REVIEW · P0 · L · Owner: Backend/Security · Depends: AUTH-01, FND-04**
- Implement ownership constraints, personal data tables, actor-scoped commands, idempotency receipts and canonical revisions; derive XP from records.
- Validate invoker/definer privileges, views and update ownership. Do not use admin credentials as ordinary user identity.
- Accept direct cross-user/anonymous/stale-account denial and concurrent command tests across every personal entity. Covers SEC-01.
- Local AUTH-02 implemented 21–22 October 2026: 24 forced-RLS personal tables, owner-inclusive foreign keys, invoker totals/generated XP, explicit account initialization, authorized relational reads and validated commands using the unchanged domain reducer. Records, canonical revision and minimal replay receipt commit atomically; exact retries return the original result and conflicting edits return 409. [Contract and scope](docs/PERSONAL-ACCOUNTS.md); [verification](docs/evidence/personal-backend-2026-10-21/README.md): 160 unit/tooling tests, 28 real database integration tests, 21 account browser checks and 9 BFF browser checks; both advisors clean. All 43 production/review output files match the prior build byte-for-byte.
- **REVIEW records local completion; hosted acceptance remains pending.** The original AUTH-02 increment left the guest UI unchanged. SYNC-01/02 now connect explicit account use/import, caches, conflict recovery and receipt retention; DATA-04 adds local account export/deletion. Cloud provisioning, production security/load/recovery and shared authorization retain their separate gates.

#### SYNC-01 — Guest import consent and multi-device sync

- [ ] **Status: REVIEW · P0 · L · Owner: Frontend/Backend · Depends: AUTH-02, DATA-02, DATA-03**
- Implement import summary/provenance choices, outbox push, authorized change pull, pagination and truthful save/sync states.
- Handle retry after lost server response, reconnect, offline backlog, drafts and owner-scoped caches.
- Accept two-device convergence with no duplicate activity, unintended cloud upload or whole-profile overwrite. Covers PRD-03–04.
- Locally implemented 22 October 2026: selected worker preview, explicit upload consent, owner-private staged append import/final confirmation, durable remembered state/outbox, memory-only session mode, captured dated intents, exact replay, revision-consistent pagination, owner separation and protected pending-work logout/reauthentication. Guest source/data/recovery and domain/design assets remain intact. [Protocol and recovery](docs/ACCOUNT-SYNC.md); [evidence](docs/evidence/sync-2026-10-22/README.md): 169 unit/tooling checks, 36 database integrations, 30 sync browser checks, 21 auth checks, 9 BFF checks, 378 existing journeys and 720 unchanged visual comparisons.
- **REVIEW records local completion, not hosted/physical-device acceptance.** Snapshot pull is bounded and revision-consistent; SYNC-02 now adds incremental feeds, entity conflicts, tombstones and stale rebase. DATA-04 and PUSH-01–04 add local account lifecycle and background sending. Real collaboration and production operations remain assigned tasks. Cloud provisioning stays pending; the local-origin follow-up is resolved under INFRA-01.

#### SYNC-02 — Conflicts, tombstones and stale-device recovery

- [ ] **Status: REVIEW · P0 · M · Owner: Frontend/Backend/QA · Depends: SYNC-01**
- Implement specified revision conflicts, retained local intent, delete/archive precedence and rebase of outboxes older than receipt retention.
- Accept check/Undo, prayer correction, reward correction and stale-deletion races; rejected writes remain understandable and recoverable.
- Covers PRD-04, NFR-07.

- Local implementation, 22 October 2026: immutable semantic conditions merge independent records while competing corrections retain intent for current-head review. Compact tombstones/removal barriers prevent stale resurrection; a 90-day replay floor requires full-snapshot review of old queues. Format-one caches remain readable; explicit choices retain original state/operations in a private recovery point. [Protocol, privacy and rollback](docs/SYNC-RECOVERY.md); [verification](docs/evidence/sync-recovery-2026-10-22/README.md).
- **REVIEW records local completion; hosted and physical-device acceptance remain pending.** Ordinary retention is opportunistic during owner activity; scheduled cleanup remains OPS-02 and account-deletion suppression is now implemented locally by DATA-04. The INFRA-01 local-origin observation is resolved through the fixed 4192 browser entry. Cloud provisioning stays pending.

#### DATA-04 — Account export, deletion and cache cleanup

- [ ] **Status: REVIEW · P0 · L · Owner: Backend/Frontend/Security · Depends: SYNC-02, DATA-02**
- Implement recent-auth export/deletion, session revocation, local versus cloud deletion distinctions, tracked purge and deletion ledger.
- Include ownership-resolution hooks for groups; complete their integrated tests after GROUP-01.
- Accept no stale-client resurrection, no credential export, and cleanup of notifications/subscriptions when those modules are integrated. Covers PRD-18, SEC-05.
- Locally implemented 22 October 2026: strict full private-record export, DATA-02 current-view restore, recent same-owner email reauthentication, separate version-bound device cleanup, atomic all-session suppression, stable terminal receipts, isolated tracked provider purge, cascading historical cleanup, bounded retention and authoritative old-backup replay. Guest/other-owner data, design assets and domain rules remain intact. [Protocol and recovery](docs/ACCOUNT-LIFECYCLE.md); [verification](docs/evidence/account-lifecycle-2026-10-22/README.md). Final local evidence: 180 unit/tooling checks, 59 real database integrations, 69 sync browser checks, 21 auth checks, 9 BFF checks, 378 existing journeys, 39 production checks, 42 PWA checks and 720 unchanged visual comparisons; both database advisors are clear.
- **REVIEW records local completion.** Hosted supervised cleanup, deadline monitoring, provider backup/audit retention and integrated shared-content cleanup remain OPS-02/GROUP-05 gates. Server subscription/job cleanup is integrated locally by PUSH-01–03; GROUP-01 now supplies locked membership/last-owner resolution and its browser controls, while future shared-content/notification tables remain fail closed. Cloud provisioning remains pending; physical devices and the original 4190 origin are not certified by those historical tests; current local-entry evidence is linked under INFRA-01.

### M3 — Real web reminders

#### PUSH-01 — Per-device permission, subscription and privacy controls

- [ ] **Status: REVIEW · P0 · M · Owner: Frontend/Backend · Depends: AUTH-01, WEB-02, INFRA-01**
- Implement capability/install detection, explicit permission, per-installation VAPID subscription, encrypted endpoint storage and real test alert.
- Preserve denied-permission recovery; default to generic notification copy. Validate endpoints against SSRF controls.
- Accept iPhone Home Screen and Android setup, unsupported fallback, revoke/re-enable and logout cleanup. Covers PRD-11, SEC-04.

- **Local result, 22–23 October 2026:** explicit permission/install detection, owner-bound encrypted subscriptions, generic privacy defaults, versioned revocation/test requests and the isolated VAPID sender are implemented. Logout/device cleanup/deletion cancel tests and retire endpoint material. The original increment accepted bounded generic test envelopes; PUSH-02–04 subsequently add separately consented schedules and receive authorization. No push creates a domain record or XP. [Implementation and recovery](docs/PUSH-SUBSCRIPTIONS.md), [verification](docs/evidence/push-subscriptions-2026-10-22/README.md).
- **Acceptance limit:** local crypto/real database/BFF/IDB tests pass with synthetic browser OS/provider adapters. PUSH-02–04 are integrated locally; real-provider HTTPS/iPhone/Android delivery, hosted operations and PUSH-02 retention/load gates remain pending. Cloud provisioning stays pending by direction.

#### PUSH-02 — Durable plan, job queue and scheduler

- [ ] **Status: REVIEW · P0 · L · Owner: Backend · Depends: PUSH-01, SYNC-02, PRAY-02**
- Implement primary scheduling installation, bounded seven-day plans, generation receipts, worker leases, expiry and retry.
- Keep coordinates/private notes out of the queue; distinguish schedule/provider acknowledgment from device display.
- Accept duplicate worker, restart, offline device, missed window, clock skew and invalid subscription tests. Covers PRD-11, NFR-05.

- **Historical substrate increment, 23 October 2026 (superseded by the sender increment below):** validated plan projection, owner/generation CAS, explicit primary takeover, immutable receipts, forced-RLS queue, leases/restart recovery, bounded retries/expiry and logout/deletion cleanup implemented. At that substrate milestone, live sending and UI renewal were gated; the later sender increment below supersedes that boundary. Hosted supervision remains pending. NFR-05 load acceptance is outstanding. [Contract](docs/PUSH-PLANS.md), [evidence](docs/evidence/push-plans-2026-10-23/README.md).

- **Current local sender/retention increment, 23 October 2026:** encrypted sending, four bounded lanes, bounded cleanup and seven-day receipt retirement are implemented. Immutable generation-bound cancellation survives cleanup/replacement; old unversioned intent requires explicit localized review. The 100-account/200-job synthetic-provider fixture achieved p95 7.322 s. Evidence: 218 unit/tooling tests, 94 database integrations, 54 unique push browser cases across full/focused runs, 720 unchanged visual comparisons and clean local/test advisors. **REVIEW records local completion; hosted supervision/load acceptance and physical HTTPS delivery remain open.** [Contract and rollback](docs/PUSH-RETENTION.md), [dated verification](docs/evidence/push-retention-2026-10-23/README.md).

#### PUSH-03 — Cancellation, acknowledgment and quiet-hour rules

- [ ] **Status: REVIEW · P0 · L · Owner: Engineering/QA · Depends: PUSH-02**
- Reconcile prayer records, pause/resume, location/plan changes, disable, “I'm up”, quiet hours and account deletion; deduplicate page/push delivery.
- Show remote cancellation pending while offline and test the dispatch race; preserve preview independence.
- Accept no additional prayer/XP effects and no false “ready” state for suppressed/expired coverage. Covers PRD-10–11, SEC-04.

- **Local result, 23 October 2026:** transactional command/import cancellation, dated wake-only acknowledgment, quiet-hour defaults/explicit staged-plan override, immutable cancellation replay, offline pending states and page/worker occurrence claims implemented. Dispatch race tests distinguish cancellation-before-send from already-submitted acceptance. The later PUSH-04 sender increment completes local generation/renewal integration; physical acceptance is PUSH-05. [Contract](docs/PUSH-CANCELLATION.md), [evidence](docs/evidence/push-cancellation-2026-10-23/README.md).

#### PUSH-04 — Renewal, habit reminders and full readiness integration

- [ ] **Status: REVIEW · P1 · M · Owner: Frontend/Backend · Depends: PUSH-03, DATA-03**
- Integrate explicit primary-installation selection, durable online renewal and current per-installation readiness.
- Turn existing habit reminder preferences into real delivery, preserving quiet hours; reuse readiness, receipts and failure states.
- Replace preview-only claims only where verified; retain an explicitly labeled preview action.
- Accept scheduled-day changes, archive/completion cancellation, all languages and per-device sound limitations. Covers PRD-05, PRD-11, PRD-19.

- **Local renewal increment, 23 October 2026:** explicit scheduling-device selection, stable pending-request replay, save/sync-gated automatic renewal, current receiving-installation coverage and localized quiet/expired/offline/error readiness are implemented. This dated increment preceded habit/live sending; the current local sender result below supersedes that boundary. [Contract](docs/PUSH-RENEWAL.md), [evidence](docs/evidence/push-renewal-2026-10-23/README.md).

- **Local habit increment, 23 October 2026:** pure dated habit eligibility, explicit per-device foreground consent/delivery, generic localized notifications, staged account-plan integration and transactional cancellation are implemented. Existing preview, design and saved journey formats remain. Local expiry/queue limits remain conservative. The later sender increment below adds background dispatch; physical-device acceptance remains pending. [Contract](docs/HABIT-REMINDERS.md), [evidence](docs/evidence/habit-reminders-2026-10-23/README.md).

- **Local sender integration, 23 October 2026:** encrypted reminder dispatch, process liveness readiness and authenticated receive-time cancellation are connected and verified locally. PUSH-04 moves to review; HTTPS physical-device acceptance remains PUSH-05. [Contract](docs/LIVE-PUSH-SENDER.md), [evidence](docs/evidence/live-push-sender-2026-10-23/README.md).

#### PUSH-05 — Physical-device notification evidence

- [ ] **Status: TODO · P0 · L · Owner: QA · Depends: PUSH-03, PUSH-04**
- Run HTTPS staging on supported iPhone Safari/Home Screen and Android Chrome/PWA, recording exact OS/browser versions.
- Cover foreground/background/locked/offline, Focus/mute, denied/revoked permission, missed expiry, expired schedule, primary/backup and cross-device acknowledgment.
- Accept honest documented behavior, not a guaranteed alarm claim. Emulator/mocked Notification tests alone cannot close this task.

### M4 — Real family and squads

#### GROUP-01 — Real membership, invitation and ownership lifecycle

- [ ] **Status: REVIEW · P1 · L · Owner: Codex (local Backend/Frontend implementation) · Depends: AUTH-02, SYNC-02**
- Replace fictional members with real identities; implement invite/hash/expiry/revoke/accept, current-member policies, transfer, leave and archive/restore.
- Keep existing screen structure; copy/share links only after the user's action. Add recent-auth ownership and deletion resolution.
- Accept two-account lifecycle, concurrent invite consumption, stale-token rejection and no orphaned owner. Covers PRD-14, SEC-01.
- Locally verified: strict commands, current-membership RLS, single-use tokens, ownership/archive/leave, preferences, retries and account-suppression/restore hooks now have real account-selected browser flows, explicit nickname/join consent, transient invite secrets, durable non-secret recovery and localized errors. [Contract](docs/GROUP-MEMBERSHIP.md), [backend evidence](docs/evidence/group-membership-2026-10-23/README.md) and [browser evidence](docs/evidence/group-ui-2026-10-23/README.md). Final increment checks: 227 unit/tooling, 12 database/BFF, 27 group browser, 54 push and 33 account sync/lifecycle cases; 1,440 group layout states. Existing navigation, production/PWA and 720 frozen visual comparisons also passed in the documented scopes. REVIEW retains hosted acceptance; shared content and integrated lifecycle remain GROUP-02–05.

#### GROUP-02 — Shared tasks and lists with conflict recovery

- [ ] **Status: REVIEW · P1 · L · Owner: Frontend/Backend · Depends: GROUP-01, SYNC-02, DATA-03**
- Implement group-timezone recurrence, assignment, per-date completion/Undo, priority references, lists/items/ranks and archives.
- Keep pending shared changes visible; revalidate membership on commit. No habit XP from family actions.
- Accept cross-device convergence, conflicting edits/reordering, removal during offline work and cross-group denial. Covers PRD-06, PRD-13.
- Local backend increment: authorized task/list commands, dated completion snapshots, per-date Undo, item ranks/removal barriers, coherent bounded reads, exact replay, current-member conflicts and populated family lifecycle handling now exist. [Contract](docs/SHARED-CONTENT.md) and [dated backend evidence](docs/evidence/shared-content-backend-2026-10-23/README.md): 230 unit/tooling, 116 real database/BFF and 27 membership browser checks passed; both local/test advisors reported no issues. That checkpoint preceded priority integration.
- Priority/reader increment: private opaque group/task/date references now use current membership/schedule authorization, retained unavailable selections, compatible cache/export/import/recovery and account-root purge. The memory reader fences pagination and account changes. [Evidence](docs/evidence/shared-priorities-2026-10-23/README.md) records 239 unit/tooling, 125 real database/BFF, 69 account browser and 27 group browser checks; both local/test advisors report no issues. That checkpoint preceded the real task/list and priority controls and their browser conflict/offline acceptance.

- Browser/cache increment: account-selected task/list controls, dated snapshots/Undo, private priority replacement, complete-page loading states, matching durable draft cleanup and explicit conflict review are locally verified. Own-session cache saves/acknowledgments/pulls now serialize without weakening foreign-writer CAS or recovery. [Evidence](docs/evidence/shared-content-ui-2026-10-23/README.md): 247 unit/tooling, 54 group and 69 account sync/recovery/lifecycle cases passed; 3,060 group layout states and 55 safe captures are recorded. The earlier 720 frozen visual comparisons passed without regenerating references. No migration, server code, asset or saved user profile changed in this increment. REVIEW retains hosted acceptance; exact squads and notification/lifecycle integration remain GROUP-03–05.

#### GROUP-03 — Exact squad snapshots and withdrawal

- [ ] **Status: REVIEW · P1 · L · Owner: Frontend/Backend/Security · Depends: GROUP-01, SYNC-02**
- Implement server-validated preview, explicit publication, immutable chosen snapshot, author edits, reactions and withdrawal.
- Sharing options start off; reject private fields; add minimal owner abuse-removal handling in existing group controls.
- Accept exact preview equality, no silent later recomputation, author/member permissions and deletion/revocation behavior. Covers PRD-15.
- Locally verified: exact private preview/publication, author edits, encouragement, withdrawal/owner removal, durable conflict/retry recovery, forced RLS and populated pre-suppression/backup-replay erasure. [Contract](docs/SQUAD-SNAPSHOTS.md) and [evidence](docs/evidence/squad-snapshots-2026-10-24/README.md): 256 unit/tooling, 139 database/BFF, 81 group, 69 account sync and 27 navigation cases pass, with 720 unchanged frozen comparisons. Group layout coverage totals 4,680 states; 54 new safe captures are recorded. Production entry has 24 unique verified cases across an initial 23-pass/one-timeout run and a passing unchanged-build focused rerun. Both retained local/test installations have the two additive migrations and clean advisors. REVIEW retains hosted acceptance; GROUP-04/05 follow.

#### GROUP-04 — Group notification preferences and abuse limits

- [ ] **Status: REVIEW · P1 · M · Owner: Backend/Frontend · Depends: GROUP-02, GROUP-03, PUSH-04**
- Connect mute/quiet-hour preferences to minimal optional group/task notifications with generic default copy.
- Implement invitation/message frequency limits, owner removal and safe error feedback; no unsolicited external messaging.
- Locally verified invitation increment: 20-row owner-only pages, immutable continuation context, capacity feedback and bounded history at the maximum 100,000 retained entries with cleanup stopped. The existing maximum 100/hour frequency limit and exact retries pass. [Contract](docs/GROUP-INVITATIONS.md), [evidence](docs/evidence/group-invitations-2026-10-24/README.md): 261 unit/tooling, 15 relevant database/BFF and 12 browser cases pass for that invitation increment. The completed notification integration is recorded below.
- Accept leave/archive/remove instantly suppress future eligible sends and no private payload leaks. Covers PRD-11, PRD-14–15.
- Local acceptance, 24 October 2026: default-off group opt-in plus independent installation consent now drives bounded generic assignment/publication jobs. Mandatory group quiet hours, actor/group/job locking, exact receipt retry, current-source receive authorization and recipient/source deletion suppression are implemented. Corrections and membership/preferences/session changes cancel future eligible delivery while preserving provider acceptance. Old preference bodies, account caches and guest data remain compatible.
- [Contract](docs/GROUP-NOTIFICATIONS.md) and [acceptance evidence](docs/evidence/group-notifications-2026-10-24/README.md): 263 unit/tooling, 156 database/BFF, 93 group, 54 push, 69 sync, 42 real-worker PWA, 54 production and 378 existing-app browser cases pass. All 720 frozen visual references remain unchanged; the new device sheet reflows through 320 px/200% text. The report records initial suppression/layout failures, additive fixes and the preserved local migration-file recovery.
- REVIEW retains hosted/operator/physical-device gates. No external invitation/email/push or cloud provisioning was performed. Wider export/cache/deletion/restore acceptance follows GROUP-05.

#### GROUP-05 — Integrated membership/deletion/restore test

- [ ] **Status: REVIEW · P1 · M · Owner: QA/Security · Depends: GROUP-04, DATA-04**
- Exercise account deletion as member/last owner, retained deidentified family content, squad withdrawal, removed-member exports and stale caches.
- The integration audit found that the strict private account export deliberately contains no live shared records. Add a separate explicit, current-member shared archive with recent authentication, reviewed revision and bounded validated projections; preserve the private export/cache formats and never restore live membership from a file. Then verify authorized export, removed-member denial and the combined lifecycle/backup-replay outcomes.
- Accept authorization and data-lifecycle outcomes match both the PRD and security retention policy.
- Locally verified, 24 October 2026: explicit current-member shared archives now preserve the private export/cache formats, require recent authentication and revision review, and reject stale/removed access, malformed history and oversized files without partial output. Combined ownership resolution, suppression rollback, family retention, squad/notification erasure, old-session rejection, cross-tab cache cleanup and authoritative server-backup replay pass with synthetic accounts.
- [Contract](docs/GROUP-LIFECYCLE.md) and [evidence](docs/evidence/group-lifecycle-2026-10-24/README.md) record commands, initial query/layout failures, fixes, source/build hashes and preservation checks. REVIEW retains hosted backup operations and physical-device acceptance. Cloud stays pending; the next dependency-ready local work is QUALITY-01.

### M5 — Quality, operations and release

#### QUALITY-01 — Complete localization and parity review

- [x] **Status: DONE · P1 · L · Owner: Codex (local Frontend/Product/QA review) · Depends: PUSH-04, GROUP-04**
- Completed the older Uzbek UI fallback catalog and reviewed Russian/English additions. Shared catalogs have 1,569 keys; authored names, notes, reflections and custom units remain untouched. Errors, accessibility names, measurements and recovery summaries localize at render time.
- Uzbek display dates now avoid Chromium's `M10` fallback while preserving instants/timezones. Account/onboarding/reminder guidance describes implemented local capabilities and separate device consent accurately.
- Equivalent-state review preserves all 480 English/Russian references and 34 Uzbek references. The 206 intended Uzbek changes have inspected replacements and hash-verified original archives. A family segmented-control wrap fixes clipping at 320 px/200% text without a redesign.
- Final local acceptance, 24 October 2026: `npm run check` passes 272 unit/tooling cases, lint/types and both builds. The complete 390-case journey run passed 382; six outdated translated-label assertions and two Firefox timeouts are resolved by 60 passing affected journeys and two passing targeted reruns. Production entry passes 54 cases. Group and recovery layout matrices pass nine cases each (1,620 and 162 states); 60 capture cases cover 900 images. Normal visual verification passes 46 cases plus two passing timeout reruns with no image mismatch. Final lint/types and document checks pass.
- [Evidence, exact commands, hashes, initial failures and recovery](docs/evidence/localization-2026-10-24/README.md) accept the local language/parity scope of PRD-01/17 and capability-copy scope of PRD-19. Physical accessibility/mobile browser acceptance remains QUALITY-02; release help/support remains OPS-04. Cloud stays pending. No stored-data format, domain behavior, original artwork, dependency or applied migration changed.

#### QUALITY-02 — Accessibility and mobile browser acceptance

- [ ] **Status: REVIEW · P0 · L · Owner: Codex (local QA/Frontend verification); physical QA pending · Depends: WEB-02, QUALITY-01**
- Local accessibility acceptance passes on 24 October 2026. Priority/recovery targets and narrow weekday controls are at least 44 px; enlarged forms stack and long sheet titles wrap. The Tab loop skips closed disclosure contents, clicked openers restore correctly in WebKit, and focused fields remain visible inside shortened sheets. Original recovery bytes and durable drafts are preserved.
- Final build: `npm run check` passes 272 unit/tooling cases, lint/types and both builds. Focused accessibility passes 39 cases; existing navigation/language journeys 51; account checks 21; real shared-content/membership checks 21; production entry 54. All run in Chromium, WebKit and Firefox. Earlier shared layout evidence covers 27 cases / 6,480 states on its recorded layout build.
- Final capture and normal visual runs each pass 48 cases / 720 images. 676 references remain byte-identical; 44 inspected 200%-text header changes have hash-verified original archives. Design roles, artwork, domain logic, saved-data formats and applied migrations are preserved. The design sidecar's narrow weekday example now matches the source.
- [Evidence, failures, exact commands, build scopes and preservation](docs/evidence/accessibility-2026-10-24/README.md) record the initial target/focus failures, one renewal-test deadline resolved by isolation and a sequential full pass without changing its source/timeout, and a Docker startup interruption resolved without resetting data.
- **REVIEW records local completion.** Physical VoiceOver/TalkBack, actual current/previous supported Safari/Chrome versions and Home Screen modes, software keyboards, safe areas, desktop/tablet checks and the complete PRD-17/NFR-08 release matrix remain in [mobile acceptance](docs/MOBILE-ACCESSIBILITY.md). Automated scans do not certify accessibility. Cloud provisioning remains pending.

#### QUALITY-03 — Performance, resilience and capacity

- [ ] **Status: IN PROGRESS · P0 · L · Owner: Engineering/QA · Depends: GROUP-04, PUSH-05**
- Measure the PRD workload; optimize splitting/assets/queries while preserving the design.
- Inject API outages, lost acknowledgments, worker restarts, storage quota and flaky connections.
- Accept NFR-01–05/07 evidence, bounded queue growth and no silent data loss.

- Local work started after QUALITY-02 acceptance on 24 October 2026. First measure the 100-habit/two-year workload through existing public state, command and storage interfaces, then target demonstrated bottlenecks while preserving failure/recovery behavior and the visual baseline. The initial production entry was about 1.28 MB (393 kB gzip); size alone is not a mobile timing result. Hosted 100-user staging and physical mobile Web Vitals remain pending.
- Initial three-sample desktop probe preserves all 73,000 occurrence records and XP, with median account hydration 425.4 ms and stored-profile parsing 230.9 ms. These are discovery measurements, not NFR acceptance; real storage/browser measurement and optimization follow. [Work-in-progress evidence](docs/evidence/performance-2026-10-24/README.md).
- Increment 1 removes repeated hydration scans, JSON safety walks and check-in materialization. Final Node hydration/parsing medians are 57.5/76.0 ms; Chromium's dense-profile durable check median improves from 691.9 to 399.6 ms. Three-engine storage measurements still exceed the 250 ms target and do not establish p95/device acceptance. Final application checks pass 277 unit/tooling, 3 dense-profile browser, 16 database and 54 storage/recovery cases, plus 48 visual cases / 720 unchanged references. The initial Firefox benchmark transfer timeout and corrected JSON transport are retained in the evidence. QUALITY-03 remains IN PROGRESS for further optimization, actual UI/load and capacity/resilience evidence.
- Increment 2 compiles trusted schema field lists and removes short-string/ID allocations while preserving Unicode and rejection semantics. The source gate passes 279 cases; dense-profile and storage/recovery checks pass 3/54. Durable check medians improve to 335.6/393/667 ms in Chromium/WebKit/Firefox. All remain above the target; no p95, physical or complete-product acceptance is claimed. Exact samples and build scopes are appended to the same evidence report.
- Increment 3 removes duplicate repository snapshot copying after the adapter transfers an isolated result. Mutation/replay tests preserve returned-view and durable-state independence. Final checks pass 280 source cases, 6 large-profile measurements, 57 storage/recovery cases, 3 production feedback probes and 54 production-entry cases. Durable check medians are 300.6/346/608 ms; production DOM feedback samples are 146.6/136/239 ms. Both targets remain unmet. [Exact source/build scope, phase timings and the corrected UI probe](docs/evidence/performance-2026-10-24/increment-03/README.md). No persisted format or design change.
- Increment 4 defers group management/editing code while keeping Today rows eager. The initial production entry drops by 96,228 bytes (7.5%); the public worker still precaches all screens. Localized download retry, close-during-load focus and cold offline opening are verified. Final checks pass 280 source cases, 66 production cases, 45 PWA cases, 48 local journeys, 108 account-backed group cases and 48 visual cases / 720 unchanged references. [Exact evidence and tradeoffs](docs/evidence/performance-2026-10-24/increment-04/README.md). CSS is byte-identical; persisted formats, assets and existing forms remain. Entry size is not Web Vitals acceptance, and dense-profile latency/capacity/resilience work remains open.
- Increment 5 removes redundant descriptor inspection only for freshly parsed JSON and reuses the validated command result's serialized text. Arbitrary object inputs retain descriptor checks; byte/depth/record/schema limits, unknown safe fields, no-op receipts and original recovery data remain verified. Final checks pass 282 source cases, 6 dense-profile and 3 production-feedback probes, 105 storage/backup/recovery journeys, 21 database cases, 15 export/deletion browser cases, 66 production and 45 PWA cases. Completed DOM samples improve to 128.3/119/192 ms in Chromium/WebKit/Firefox; the 100 ms target remains unmet. Durable medians remain above 250 ms, with some Undo/draft samples worse. [All before/after samples, exact scopes and limits](docs/evidence/performance-2026-10-24/increment-05/README.md). QUALITY-03 stays IN PROGRESS; capacity and integrated resilience work remain open.
- Increment 6 adds a repeatable fixed-test workload with 100 real synthetic accounts, each retaining 100 habits and 730 dates. The two-wave burst **fails capacity**: 11/200 first attempts succeed, 189 return 503, and accepted p95 is 4,335.7 ms. Every exact retry, receipt replay, full-history/XP readback and cleanup passes. Overlap and interruption guards pass; profiling identifies repeated record serialization as substantial CPU work. [All samples, test corrections and scope](docs/evidence/performance-2026-10-24/increment-06/README.md). Application/schema/security settings are unchanged. QUALITY-03 remains IN PROGRESS for optimization, mixed/shared load and integrated resilience; hosted/physical gates remain pending.
- Increment 7 compares validated account JSON directly for change detection while preserving canonical identities/hashes and all validation/transaction boundaries. Checks pass 282 source cases and 48 real database cases, including a new no-op/version/barrier regression. Single-account samples improve from 815.2/716.4 to 657.1/624.2 ms. The identical 100-user burst accepts 20/200 first attempts instead of 11, but accepted p95 worsens to 4,861.0 ms; **capacity still fails**. All 180 exact retries, full-history/XP readbacks and cleanup pass. [Exact evidence and limits](docs/evidence/performance-2026-10-24/increment-07/README.md). Frontend builds and persisted formats are unchanged; QUALITY-03 remains IN PROGRESS.
- Increment 8 implements the separate mixed workload: 100 dense accounts, 50 explicitly joined families, 400 personal and 200 shared intentions, and the actual shared reader at 15-second refresh. **Capacity/convergence fail**: 359/600 first attempts succeed, 65 return 503 and 176 are deferred; accepted personal/shared p95 including scheduling lateness is 5,348.9/4,936.7 ms. Of 110 accepted shared updates, 13 observations are late and 16 remain missing. All 241 failed/deferred intentions recover exactly; full histories/XP/shared snapshots and cleanup pass. Interruption cleanup, legacy smoke, 282 source cases and final types/lint pass. [Evidence and limits](docs/evidence/performance-2026-10-24/increment-08/README.md). This changes diagnostic tooling only; QUALITY-03 remains IN PROGRESS.
- Increment 9 selects dense occurrence columns directly while preserving JSON civil dates, owner filtering, bounds and all validation/transaction rules. Checks pass 282 source cases, 49 database cases and date-format/process-timezone parity. Isolated 73,000-row reads improve from 174.9–241.4 to 86.6–108.0 ms. The identical single-thread mixed workload accepts 377/600 first intentions, with 66 HTTP failures and 157 deferred. Accepted personal/shared scheduled p95 is 5,631.2/4,913.1 ms. Of 121 accepted shared updates, 10 observations are late and 23 remain missing. All 223 failed/deferred intentions recover exactly; every history/XP/shared snapshot and cleanup check passes. Frontend builds are unchanged; QUALITY-03 remains IN PROGRESS. [Evidence and limitations](docs/evidence/performance-2026-10-24/increment-09/README.md).
- Increment 10 pairs equal-length, ordered occurrence identities and compares every value before constructing key maps only for changed rows; mismatches retain the existing path. CPU-only writer medians fall from about 109–111 to 23–24 ms with identical SQL/parameters. Checks pass 282 source cases and 50 database cases, including row versions, reindexing and old-receipt/barrier preservation. The unchanged mixed workload accepts 542/600 first intentions, with 20 HTTP failures and 38 deferred. Accepted personal/shared scheduled p95 is 4,715.8/4,599.1 ms. Of 177 accepted shared updates, 25 observations exceed 15 seconds and 11 remain missing. All 58 failed/deferred intentions recover exactly; complete histories, XP, shared snapshots and cleanup pass. Frontend builds are unchanged; QUALITY-03 remains IN PROGRESS. [Evidence and limitations](docs/evidence/performance-2026-10-24/increment-10/README.md).

- A subsequent concurrency experiment accepts all 600 mixed intentions through five BFF execution threads, with personal/shared scheduled p95 583.4/520.7 ms and all 200 shared updates observed within 15 seconds. The same total five connections through a real-HTTP, five-process cluster accepts 565/600; personal/shared p95 is 4,763.2/4,030.5 ms, with 29 late and eight missing observations. All 35 exact recoveries, every receipt/history/XP/shared readback and cleanup pass. These runtime/transport experiments do not isolate the cause of the difference; connection affinity is a follow-up hypothesis. No production runtime change is adopted. A separate same-revision transient-reader failure is reproduced and remains unfixed. [Evidence and scope](docs/evidence/performance-2026-10-24/bff-concurrency-discovery/README.md). QUALITY-03 remains IN PROGRESS.

- Increment 11 lets unavailable family/squad reads recover after fresh authorized metadata at the same revision; owner invitation failures restore the new authorized first page. Busy/receipt updates cannot cause retry loops, and authority/late-response/account fences remain. Checks pass 290 source cases, 21 reader cases and 33 three-engine browser journeys, including a previously failing timer-only recovery. Stabilized equivalent-state captures are pixel-identical in all 96 comparisons. The normal dense mixed run still fails: 481/600 first intentions accepted, personal/shared scheduled p95 5,501.1/5,347.8 ms, with 18 late and nine missing observations. All 119 exact recoveries, complete histories/XP/shared snapshots and cleanup pass. A prior controlled HTTP run also shows that disabling connection reuse is insufficient. No server runtime, schema, CSS or persisted-format change is adopted; QUALITY-03 remains IN PROGRESS. [Evidence, failures and limits](docs/evidence/performance-2026-10-24/increment-11/README.md).

- A subsequent real-HTTP admission comparison accepts all 600 first intentions through both five-worker gateways, preserving the same five total restricted database connections. Least-pending routing still fails at personal/shared scheduled p95 1,637.4/1,204.6 ms, with one late shared observation. One active request per worker with a bounded FIFO queue worsens p95 to 7,123.1/6,627.9 ms, with 26 late observations and a peak of 138 queued requests. Every receipt/history/XP/shared readback and exact cleanup passes. Neither runtime is adopted; request-phase profiling is the next check. [Evidence and scope](docs/evidence/performance-2026-10-24/bff-http-admission-discovery/README.md). Application, builds, design and saved data remain unchanged; QUALITY-03 stays IN PROGRESS.

- The isolated request-phase capture records 3,459 matching gateway/worker requests with no drops. Capacity still fails: 284/600 first intentions are accepted; personal/shared scheduled p95 is 6,319.4/4,941.2 ms, with 19 late and ten missing shared observations. All 316 exact recoveries, complete histories/XP/shared readbacks and fixture cleanup pass. Shared mutation pool-acquisition p95 is 4,829.9 ms versus 4,963.6 ms overall; owner-lock time averages 1.8 ms. Host memory pressure and duplicated worker heaps are also observed, without isolating causality. A five-round ordered JSON-aggregate query is rejected: median read time is 232.3 ms versus 129.5 ms for current direct columns. No application change is adopted. Next: compare fewer execution threads with the same five restricted connections and overlapping requests. Instrumentation/host load limit comparison with earlier runs. The initial full phase-capture failure and successful repair are retained. [Commands, phases, rejected query and scope](docs/evidence/performance-2026-10-24/bff-phase-discovery/README.md). QUALITY-03 remains IN PROGRESS; cloud stays pending.

- The two-thread/3+2-connection follow-up retains the same total five restricted connections and overlapping requests. It still fails capacity: 337/600 first intentions succeed, personal/shared scheduled p95 is 6,201.6/4,950.8 ms, and 33 shared observations are late with 11 missing. All 263 exact recoveries, complete histories/XP/shared readbacks and cleanup pass; 3,578 gateway/worker records match with no drops. Shared pool-acquisition p95 remains 4,812.5 ms. Per-thread CPU and heap maxima rise, and host-wide swapping continues. The partition is not adopted; these shared-host runs cannot isolate thread-count causality. Before another full runtime experiment, use a smaller diagnostic to separate pool hold time, same-session waits and per-request allocations. [Evidence and limits](docs/evidence/performance-2026-10-24/bff-pool-partition-discovery/README.md). Application, builds, design and saved data remain unchanged; QUALITY-03 stays IN PROGRESS and cloud stays pending.

- Increment 12 prevents concurrent requests for one session from exhausting the restricted connection pool while waiting on that session's row. A bounded in-process FIFO admits work before database acquisition and rechecks current authorization afterward; SQL/RLS, receipts, connection budgets, deadlines and UI remain unchanged. The old class fails the new contention regression; the implementation passes 294 source/tooling cases, 24 focused database cases, 21 auth and 69 sync browser cases. The complete database recheck passes 169 cases; an initial large invitation-transfer 503 remains recorded as an unresolved timing-sensitive observation. The normal 100-account mixed capacity run is worse: 130/600 first intentions succeed, personal/shared scheduled p95 is 9,359.1/6,121.3 ms, with five late and two missing shared observations. All 470 exact recoveries, complete histories/XP/shared readbacks and cleanup pass. This is a narrow contention fix, not demonstrated capacity acceptance. QUALITY-03 remains IN PROGRESS and cloud stays pending. [Evidence, regressions and limits](docs/evidence/performance-2026-10-24/increment-12/README.md).

- Increment 13 removes per-object temporary filter/map/pair arrays from the fixed-field account projection. Own/defined allowlisted values, privacy exclusions, record order and stored formats are preserved. Two alternating-order dense-profile experiments reduce median projection wall time from 30.2–30.7 ms to 13.0–13.7 ms; this is a pure-function result, not API/device capacity. Checks pass 295 source/tooling cases, 39 targeted real-database cases and 69 three-engine sync cases with no flakes. CSS and screen code remain unchanged. No new 100-account capacity result is claimed; QUALITY-03 remains IN PROGRESS and cloud stays pending. [Evidence and limits](docs/evidence/performance-2026-10-24/increment-13/README.md).

- Increment 14 (25 October) combines stored-ID whitespace/control rejection into one scan, preserving Unicode limits, exact errors and all validation/security boundaries. Two complete-state comparisons reduce validation time by 12–14%; 3,342,349 differential ID checks match the original. A fresh five-account diagnostic preserves all ten actions, exact replay, complete histories/XP and cleanup, but p95 remains above target (1,486.4 ms before, 1,498.7 ms after); no API speedup is established. Dense-browser durable/feedback probes also remain above target. Checks pass 317 source/tooling tests, 39 targeted real-database cases and 225 three-engine browser cases, including backup/recovery, sync and real-worker update/offline failures; no retries or flakes. The full 100-account mixed run stops before fixtures at the unchanged disk guard (11.61 GiB free, more than 12 GiB required). QUALITY-03 remains **IN PROGRESS**; cloud provisioning stays pending. [Current measurements, regression results and limitations](docs/evidence/performance-2026-10-25/README.md).

- SAFE-01's local review is now complete independently of QUALITY-03. Existing GROUP-05/DATA-04 and PUSH-01–04 implementations support that local review; PUSH-05 physical-device acceptance remains TODO. Keep the capacity gate open. OPS-01 is the next dependency-ready local task; hosted acceptance stays deferred.

#### SAFE-01 — Integrated security verification

- [ ] **Status: REVIEW · P0 · L · Owner: Codex (local Security/QA review); hosted/device acceptance pending · Depends: GROUP-05, PUSH-05, DATA-04**
- Execute SEC-01–06 controls against real staging infrastructure, including direct-request ownership tests, SSRF, headers, CSRF, imports, credentials and cache leakage.
- Resolve exploitable critical/high issues; record residual risks and limits.
- Accept a reproducible report tied to a release, not a general claim based on unit tests.
- Local acceptance, 24 October 2026: the BFF now enforces CSP, framing denial and limited feature permissions. The public PWA fingerprint includes that policy so compatible updates refresh offline response headers. Existing inline styles remain explicitly allowed; scripts/evaluation do not. No UI source, public asset, schema, dependency or saved-data format changes. [Contract](docs/LOCAL-SECURITY.md) and [release-bound evidence](docs/evidence/security-2026-10-24/README.md).
- Verification: 296 source/tooling and 173 real database/BFF cases pass; browser runs pass 21 backend, 21 auth, 69 sync, 54 push, 66 production and 45 PWA cases. The complete group run passed 110 cases and found one squad visual-test refresh race; all nine affected cases pass after its test-only repair. The earlier family test race was also repaired and passed across all three languages/engines. All 720 frozen visual comparisons pass without baseline updates. Dependency audit reports zero vulnerabilities; both retained environments and security advisors pass. Original failures and corrected checks remain in the evidence.
- REVIEW retains hosted HTTPS/HSTS, proxy/cookie/key/backup operations and physical-device privacy/delivery acceptance. SEC-07 operating ownership/alerts remain OPS-01 work. QUALITY-03 capacity is still IN PROGRESS. Cloud provisioning remains pending.

#### OPS-01 — Observability, support and privacy-safe diagnostics

- [ ] **Status: REVIEW · P0 · M · Owner: Operations/Backend · Depends: INFRA-01, SYNC-01, PUSH-02**
- Configure redacted errors, health/queue alerts, release IDs, support/security contact and named escalation ownership.
- Implement optional consent-based product measurement only within PRD-20's limits; no session replay or sensitive event fields.
- Accept test alert routing and support diagnosis without private profile payloads. Covers SEC-07.
- **Local acceptance complete, 24 October 2026:** redacted request/release/latency counters, a separate aggregate-only monitor capability, bounded private health/queue alerts and a test routing drill are implemented. Settings adds an explicit technical diagnostic download in EN/RU/UZ, with no profile payload, analytics or automatic sending. [Operating contract](docs/LOCAL-OPERATIONS.md); [dated evidence](docs/evidence/operations-2026-10-24/README.md).
- **Validation:** `npm run check` (302 unit/tooling checks), `test:infra` (176 database/runtime checks), focused browser/accessibility (57), BFF (21), production entry (66), real-worker PWA (45), and 720 unchanged visual comparisons pass. Existing credentials/table counts survived the additive migration; saved profiles/recovery sources, styles/assets, domain rules and storage formats are preserved.
- **REVIEW retains the operating gates:** incident primary/backup and a dedicated private support/security contact remain unassigned. Local file routing is tested; always-on supervision, human receipt/escalation, hosted monitoring and physical-device acceptance are not claimed. The stopped local BFF correctly raises availability/stale-diagnostic alerts. Backup recovery remains OPS-02 and rollout automation OPS-03. Cloud provisioning stays pending.

#### OPS-02 — Backup restore, retention and deletion replay

- [ ] **Status: REVIEW · P0 · L · Owner: Operations/Security · Depends: GROUP-05, OPS-01**
- Configure retention/purge jobs and encrypted backups; restore into an isolated environment with push disabled.
- Replay deletions/revocations newer than the backup and verify personal/shared access afterward.
- Accept measured RPO/RTO, expired backup handling and written recovery evidence. Covers PRD-18/20, SEC-05.

- **Local implementation, 24 October 2026:** independent-key AES-GCM PostgreSQL archives, 30-day authenticated expiry, retention/purge commands and backup/maintenance freshness alerts. Restore accepts only a fresh networkless disposable target, revokes sessions/invitations/push consent, replays deletion authority and withholds changed shared groups. Current profiles, design, storage formats and original sources are preserved; no migration or live restore occurred. [Contract](docs/SERVER-BACKUP-RECOVERY.md); [evidence](docs/evidence/backup-recovery-2026-10-24/README.md).
- **Validation:** `npm run check` (306 checks), `test:infra` (178), final focused recovery/retention (2), real CLI create/drill/maintenance/watch/lock/shutdown and documentation checks pass. The populated local recovery point was 2.974 seconds old; its bounded recovery took 7.013 seconds. No full-service RPO/RTO claim.
- **REVIEW retains operating gates:** continuous supervision, off-site/key custody, unavailable-source authority recovery, changed-group reconciliation and complete hosted service RPO/RTO/reopening are not claimed. The local drill measures only its bounded decrypt/restore/replay/validation path. Cloud provisioning stays pending.

#### OPS-03 — Deployment, rollback and worker update runbook

- [ ] **Status: REVIEW · P0 · M · Owner: Operations/Engineering · Depends: INFRA-01, WEB-02, OPS-01**
- Automate immutable builds and compatible schema/backend/frontend rollout, protected production configuration and safe capability flags.
- Rehearse rollback with a pending outbox, active session and newer service worker; no data-destructive downgrade.
- Accept a deploy/rollback record and no connection from review builds to production. Covers PRD-20, SEC-06.

- **Local implementation, 24–25 October 2026:** sealed production packages include frozen backend/domain code and pinned dependencies; fixed local/test admission checks exact schema/storage compatibility and real candidate health. The supervisor records activation and compatible rollback, preserves prior fingerprinted chunks and protected session configuration, and provides a server-only write pause. Stale rollback choices are fenced; repeated interrupts drain without leaving a lock. [Runbook](docs/LOCAL-ROLLOUT.md); [evidence](docs/evidence/local-rollout-2026-10-24/README.md).
- **Validation:** `npm run check` (311), `test:infra` (178), focused real-runtime race/shutdown regression (1), rollout matrix (6), PWA (45), production entry (66), backend (21), auth (21), sync (69), types/lint and documentation checks pass. The three-engine rollout preserves active sessions, exact pending operations, guest records and newer-worker compatibility; rejected/failed candidates preserve or restore the healthy runtime. Local 4192 verification preserved all 62 application tables and five protected configuration files.
- **Check limitation:** a final parallel check repeat hit the existing two-second renewal-test deadline. It is verified in isolation and sequentially; no application behavior or timeout was weakened.
- **REVIEW retains operating gates:** the accepted local contract requires an identical migration set and storage/API contracts. Cross-schema expansion needs separate compatibility evidence. Hosted deployment, zero-downtime/supervised operations, signed artifact custody and public release acceptance remain pending. The release supervisor starts no sender or maintenance jobs. Cloud provisioning stays pending.

#### OPS-04 — Launch policies, rights and user-facing help

- [ ] **Status: REVIEW · P0 · M · Owner: Product/Security · Depends: FND-03, GROUP-05, OPS-01**
- Publish accurate privacy/terms, support/security routes, deletion/retention explanation, adult-audience scope and notification limitations.
- Confirm launch markets, provider/processor arrangements, software license and artwork/dependency rights.
- Accept policies reflecting the actual deployed system, with no unsupported compliance/alarm claims. Covers PRD-18–20.

- Implemented locally on 25 October 2026: English/Russian/Uzbek Settings help, local privacy/use notices, truthful deletion/retention copy, actual release metadata, interim private support guidance and original browser dependency notices. No state/consent/backend/schema change. [Policy, rights inventory and external gates](docs/LAUNCH-POLICIES.md).
- [Local acceptance evidence](docs/evidence/launch-policies-2026-10-25/README.md): 312 unit/tooling checks, 75 production checks, 54 PWA checks, 18 diagnostic checks and 720 visual comparisons pass; the earlier WebKit save-wait timeout and sequential rerun are recorded. All historical visual references, 248 protected source/asset/contract files and the pinned lockfile remain unchanged.
- REVIEW remains open for the named operator/contact/incident coverage, actual provider/region/processor and legal arrangements, public policy approval and app/artwork/distribution rights. Uzbekistan/Kazakhstan remain confirmed markets. Cloud provisioning, hosted and physical-device acceptance remain pending.

#### RELEASE-01 — Controlled pilot and complete-day acceptance

- [ ] **Status: IN PROGRESS · P0 · L · Owner: Product/QA · Depends: QUALITY-02, QUALITY-03, SAFE-01, OPS-02, OPS-03, OPS-04**
- Run PRD journeys A–J with consented pilot users, including difficult-day recovery and two real group members.
- Document observed failures and actual feedback; protect private test data; fix blocking defects.
- Accept complete web scope without fictional behavior presented as live. Do not invent retention results.
- Local rehearsal on 25 October 2026 maps synthetic coverage to journeys A–J and adds a production day-boundary check. [Pilot protocol](docs/RELEASE-PILOT.md); [commands, failures and preservation evidence](docs/evidence/release-rehearsal-2026-10-25/README.md).
- Fixed a reproduced PWA reply-timeout defect: an approved save hold now survives the reply deadline until activation, explicit refusal or its existing bounded expiry. The delayed-activation regression passes in all three engines without changing saved records.
- **Activation blocker corrected locally, 25 October 2026:** the approved handoff now drains private responses and pauses new account/sync requests and optional worker status/pruning messages. The retained invariant regression fails on the original code and passes in all three engines; final sealed-package replacement/rollback preserves session, exact outbox and original guest data. [Correction, diagnostic failures and verification](docs/evidence/worker-activation-2026-10-25/README.md). No timeout relaxation, worker reset or profile deletion was used.
- **Prior activation-follow-up findings:** an extended repeat rejected its synthetic code before activation, and broader sync recorded a WebKit sign-in-unavailable outcome. Those dated reports are retained. The follow-up below distinguishes the observed provider transaction timeout from the reproduced identity-ordering and quota-lock defects.
- The prior group suite passed 110 cases and failed one global-queue precondition in WebKit (35 due test jobs, expected zero). The owner-scoped delivery correction below replaces that environmental assumption with an explicit unrelated-work preservation assertion.
- **Sign-in and test-queue follow-up verified locally, 25 October 2026:** latest identity outcomes (including settled failures), short quota reservations, preserved template file identity and scoped encrypted dispatch are implemented. Final checks: 316 unit/tooling tests, 48 database cases, auth 30, sync 69, push 54, groups 111 and rollout 6 browser cases pass. [Corrections, original failures, verification and preservation](docs/evidence/signin-queue-2026-10-25/README.md). No production quota/deadline increase, profile reset or queue purge was used. The historical provider timeout is documented without claiming that transient provider failures are eliminated.
- Actual consented participants/feedback, an elapsed day and return, two real group members, physical accessibility/push, unresolved QUALITY-03 latency/capacity, operational/policy approval and hosted acceptance remain pending. No retention is claimed. Cloud provisioning remains pending.

#### RELEASE-02 — Production release decision and handoff

- [ ] **Status: TODO · P0 · S · Owner: Product/Operations · Depends: RELEASE-01**
- Record named release owners, version, public origin, support contacts, evidence, known limits and rollback reference.
- Verify every P0/P1 requirement is complete or explicitly rescope the PRD with the product owner.
- Accept only after launch gates are satisfied. This checklist is not authorization to publish during the documentation task.

## 5. Requirement traceability

| PRD requirement | Primary implementation tasks | Evidence |
| --- | --- | --- |
| PRD-01 parity | FND-01, QUALITY-01, QUALITY-02 | Equivalent-state screenshots and navigation checks |
| PRD-02 real entry | WEB-01, DATA-01, SYNC-01 | Empty profile and provenance migration |
| PRD-03 identity | AUTH-01, SYNC-01, DATA-04 | Account/session lifecycle |
| PRD-04 persistence/sync | DATA-01, SYNC-01, SYNC-02, WEB-02 | Fault, offline and conflict tests |
| PRD-05 habits | DATA-03, PUSH-04 | Domain invariants and real reminders |
| PRD-06 priorities | DATA-03, GROUP-02 | Selection, replacement and task references |
| PRD-07 goals | DATA-03, SYNC-02 | Milestone/correction history |
| PRD-08 rewards | DATA-03, SYNC-02 | Eligibility, claim and fixed-week attempts |
| PRD-09 timetable | PRAY-01 | Reference dates, methods and travel |
| PRD-10 records/pause | PRAY-02, PUSH-03, SAFE-01 | Private exclusion and cancellation |
| PRD-11 delivery | PUSH-01–05, GROUP-04 | Real-provider/device evidence |
| PRD-12 step away | DATA-03, PRAY-02 | Draft/expiry/return journey |
| PRD-13 family | GROUP-02 | Two-member tasks/lists |
| PRD-14 membership | GROUP-01, GROUP-05 | Atomic invitation/ownership/revocation |
| PRD-15 squads | GROUP-03, GROUP-05 | Exact snapshot and privacy tests |
| PRD-16 progress | DATA-03, SYNC-02 | Cross-tab derived-state consistency |
| PRD-17 inclusion | QUALITY-01, QUALITY-02 | Languages and manual accessibility |
| PRD-18 data lifecycle | DATA-02, DATA-04, OPS-02, GROUP-05 | Round-trip, purge and restored-backup tests |
| PRD-19 settings/help | QUALITY-01, PUSH-04, OPS-04 | Truthful persisted capabilities/help |
| PRD-20 operations | OPS-01–04, RELEASE-01 | Alerts, runbooks, policy and pilot evidence |

Security IDs SEC-01–07 map to AUTH-02/GROUP tasks, AUTH-01, DATA-02/WEB-02, PUSH tasks, DATA-04/OPS-02, INFRA-01/FND-02/OPS-03 and OPS-01/04 respectively. SAFE-01 verifies their integration. PRD nonfunctional targets are scored in QUALITY-02/03, SAFE-01 and OPS-02.

## 6. Deferred P2 work

Retain these as future decisions, not hidden requirements for web v1:

| Item | Why deferred | Re-entry condition |
| --- | --- | --- |
| Native store builds and stronger native alarm behavior | Latest scope is mobile web | Separate native release request and device/toolchain plan |
| Incremental counts and flexible weekly targets | New behavior beyond current parity | Product-approved PRD extension |
| Widgets/wearables and richer prayer-linked routines | Platform/scope expansion | Validated user need after web launch |
| Billing/Plus | Retired from current product | Explicit monetization decision; no restoration from the old brief |
| Public discovery/chat/media | Additional privacy/moderation surface | New requirements and threat model |

## 7. Definition of done for each task

A completed task records its requirement IDs, actual code/configuration changes, meaningful verification, recovery/negative cases, any source or schema migration, and remaining limitations.

UI changes require equivalent-state parity evidence. Permission/network changes require failure paths. Data changes require migration/restore and isolation checks. Real-device claims require real-device evidence. Update README/PRODUCT only when implemented behavior changes; do not turn architecture proposals into present-tense marketing.

A task may be BLOCKED only with a named missing dependency/decision and a concrete next action. Do not mark it done because a mock or happy-path screenshot exists.

## 8. Decision and risk register

| ID | Issue | Owner | Resolution task |
| --- | --- | --- | --- |
| D-01 | Backend/vendor, region, host, domain, costs | Product/Operations | FND-03 |
| D-02 | Named engineering/security/support ownership | Product | FND-03, OPS-01 |
| D-03 | Launch markets, policies and rights | Product/Security | OPS-04 |
| R-01 | Mixed demo/live local history | Frontend | DATA-01, SYNC-01 |
| R-02 | Browser notification limitations and races | Engineering/QA | PUSH-02, PUSH-03, PUSH-05 |
| R-03 | Concurrent edits alter records/XP | Backend/QA | SYNC-02 |
| R-04 | Membership/backup restores private access | Security | GROUP-05, SAFE-01, OPS-02 |
| R-05 | Large bundle; localization now locally accepted | Frontend | QUALITY-01, QUALITY-03 |
| R-06 | UI drift during infrastructure work | Frontend/QA | FND-01, QUALITY-01 |
| R-07 | Missing runtime/build/deployment governance | Engineering/Operations | FND-02, INFRA-01, OPS-03 |

## 9. Documentation validation record

**Documentation pass:** 21 October 2026.  
**Application test status:** historical 140 passing checks; not rerun for documentation-only edits.  
**Document validation status:** passed. Checked all six core documents plus the updated implementation-snapshot banner and archived README: 105 local links, 46 anchors, 20 requirement mappings and 38 task definitions. All task dependencies resolve, every task has acceptance criteria and the dependency graph has no cycle. Code-grounded review corrected habit-archive parity, session-only offline behavior and coordinate-bearing calculation-key handling.  
**Source integrity:** SHA-256 comparison of 167 existing source/configuration/asset files found no changes, including DESIGN.md and its sidecar. The original README is preserved in the dated archive; PRODUCT.md received only a scope/status banner.  
**Implementation status at the documentation pass:** DOC-01 was complete and the 37 production implementation/release tasks remained TODO. No app code, runtime settings, cloud infrastructure or deployment was changed by that pass. The later implementation record below supersedes its task counts.

## 10. Foundation implementation record

**Started:** 21 October 2026. **Execution:** Codex in the existing local project; product inputs supplied by the user in this conversation.

FND-01 and FND-02 are complete, and FND-03 has confirmed market/domain/budget inputs with remaining operating decisions documented. FND-04 (validated record commands and repository boundaries) and WEB-01 (empty production entry and isolated review builds) are complete with [dated evidence](docs/evidence/commands-entry-2026-10-21/README.md). DATA-01 is now complete with [durability and migration evidence](docs/evidence/storage-2026-10-21/README.md). DATA-02 is complete with [validated backup/restore evidence](docs/evidence/backup-2026-10-21/README.md). DATA-03 is complete with [personal-command and recovery evidence](docs/evidence/personal-commands-2026-10-21/README.md). PRAY-01 and PRAY-02 subsequently completed timetable/travel/manual-date and record/pause/dated-Fajr verification. WEB-02 is in REVIEW with local PWA evidence and physical HTTPS-device acceptance pending.

The [evidence report](docs/evidence/foundations-2026-10-21/README.md) includes the parity checklist, reproducible capture matrix, original failing browser cases, tooling decisions and limits. A WebKit keyboard-focus escape was corrected without changing visuals or domain rules. Firefox's layout assertion now accounts only for measured subpixel rounding; no failing product behavior was hidden by skipping a test.

Production entry, durable guest storage/migration, validated backup/restore, personal commands and prayer hardening are implemented. Local account sessions, personal backend, selected import/account sync and PWA lifecycle are in REVIEW. Hosted provisioning remains pending; local conflict/tombstone recovery is now implemented. Local account lifecycle is now in REVIEW; scheduled hosted retention, background push, real collaboration and deployment retain their gates. Current register: **10 DONE, 2 IN PROGRESS (FND-03/INFRA-01), 6 REVIEW (WEB-02/AUTH-01/AUTH-02/SYNC-01/SYNC-02/DATA-04), 20 TODO**.


### PUSH-01 local implementation record — 23 October 2026

PUSH-01 is in REVIEW for hosted/device acceptance. Final local evidence: `npm run check` (193 tests), `npm run test:infra` (70), `npm run test:push` (24), account sync (69 unique cases across full/focused runs), auth (21), BFF entry (9), existing journeys (378), production entry (39), PWA lifecycle (42) and 720 unchanged visual comparisons. Nineteen migrations are applied to both retained isolated environments; all 39 application/private tables force RLS, advisors report no warnings, and private capabilities remain outside exports/sync/public caches. The [dated record](docs/evidence/push-subscriptions-2026-10-22/README.md) distinguishes real adapters from synthetic OS/provider seams and records corrections, preservation, secret scanning and cleanup. No cloud provisioning, deployment, real-person email/push or access to the 4173 profile occurred.

### Current local execution checkpoint — 23 October 2026

The document audit reconciled current claims and the fixed 4192 entry resolves the original WebKit/Firefox port block. PUSH-02 local queue/retention/load and GROUP-01 membership API/browser work are in REVIEW with the evidence above. GROUP-02 now has locally verified task/list controls, private priorities, durable recovery and account-cache coordination, and is in REVIEW for hosted acceptance. Current register: **10 DONE, 3 IN PROGRESS (FND-03/INFRA-01/GROUP-05), 14 REVIEW and 11 TODO**. GROUP-03 exact snapshots and GROUP-04 invitation/notification integration are locally verified and in REVIEW. GROUP-05 now addresses explicit authorized shared export and integrated deletion/cache/restore acceptance. Cloud provisioning remains pending; hosted, physical-device and operating-owner gates stay explicit. Earlier checkpoint counts above are dated history.


### Localization acceptance checkpoint — 24 October 2026

QUALITY-01 is DONE with local language, preserved-data interaction and equivalent-state visual evidence. Current register: **11 DONE, 2 IN PROGRESS (FND-03/INFRA-01), 15 REVIEW and 10 TODO**. QUALITY-02 is the next dependency-ready local task. Physical devices, hosted operation, operating owners and release acceptance remain open; cloud provisioning stays pending. Earlier checkpoint counts describe their recorded dates and scopes.

QUALITY-02 local accessibility acceptance is now IN PROGRESS. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-02), 15 REVIEW and 9 TODO**.

QUALITY-02 local acceptance is complete and recorded as REVIEW for physical-device/assistive-technology gates. Current register: **11 DONE, 2 IN PROGRESS (FND-03/INFRA-01), 16 REVIEW and 9 TODO**. QUALITY-03 is the next dependency-ready local task; hosted and physical acceptance remain pending.

QUALITY-03 is now IN PROGRESS. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-03), 16 REVIEW and 8 TODO**. Cloud provisioning remains pending.

### Local security acceptance checkpoint — 24 October 2026

SAFE-01 local acceptance is complete and recorded as REVIEW for hosted/device gates. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-03), 17 REVIEW and 7 TODO**. OPS-01 is the next dependency-ready local task. PUSH-05 physical-device acceptance, operating owners, hosted operation and release acceptance remain open. Cloud provisioning remains pending. Earlier checkpoint counts retain their original dated scopes.


OPS-01 local technical acceptance is complete and recorded as REVIEW for named operating contacts and hosted monitoring. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-03), 18 REVIEW and 6 TODO**. OPS-02 is the next dependency-ready local operations task. Cloud provisioning, physical-device acceptance, staffed alert routing and full release acceptance remain pending. Earlier checkpoint counts retain their dated scopes.

OPS-02 local backup/retention/replay acceptance is recorded as REVIEW with the explicit recovery limitations above. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-03), 19 REVIEW and 5 TODO**. OPS-03 is the next dependency-ready local operations task. Continuous supervision, off-site/lost-source recovery, hosted/device and full release acceptance remain pending. Cloud provisioning stays pending.

OPS-03 local rollout/rollback acceptance is recorded as REVIEW on 25 October 2026, with the operating limits above. Current register: **11 DONE, 3 IN PROGRESS (FND-03/INFRA-01/QUALITY-03), 20 REVIEW and 4 TODO**. OPS-04 is the next dependency-ready local operations task. Cloud provisioning, hosted/device gates, named operating ownership and public release acceptance remain pending. Earlier checkpoint counts retain their dated scopes.

### OPS-04 local checkpoint — 25 October 2026

OPS-04 local help/policy/attribution work is verified and in REVIEW; public approval gates remain open in [the policy record](docs/LAUNCH-POLICIES.md). Current register: **11 DONE, 3 IN PROGRESS, 21 REVIEW and 3 TODO**. RELEASE-01 still requires its operational, hosted/device and policy prerequisites; no public pilot or cloud provisioning was started. This supersedes the OPS-03 next-task checkpoint above without changing its historical evidence.


### RELEASE-01 local checkpoint — 25 October 2026

The synthetic local rehearsal and bounded update-timeout fix are recorded in [the release evidence](docs/evidence/release-rehearsal-2026-10-25/README.md). RELEASE-01 remains **IN PROGRESS** because an intermittent Chromium activation stall reproduced after the fix; later passing runs are not closure. Current register: **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. The next local blocker is the sealed-package worker activation stall. QUALITY-03 performance failures and real consented/physical/hosted/policy acceptance remain open. Cloud provisioning remains pending. Earlier checkpoint counts retain their dated scopes.


### Chromium activation correction checkpoint — 25 October 2026

The specific activation blocker is corrected locally with a request-draining handoff, an original-code failing regression and verified real-worker/real-account replacement and rollback. [New evidence](docs/evidence/worker-activation-2026-10-25/README.md) preserves the earlier failures and records current commands/results. This supersedes the open activation finding above without rewriting its dated evidence. RELEASE-01 remains **IN PROGRESS**: QUALITY-03 performance, actual consented/physical/hosted/policy acceptance and the separate sign-in/test-queue isolation results still require follow-up. Current register remains **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. Cloud provisioning remains pending.

### Sign-in and test-queue local checkpoint — 25 October 2026

The remaining browser continuation is complete: **270/270 pass**, with zero failures, skips or retries. [Evidence](docs/evidence/signin-queue-2026-10-25/README.md) records the corrected identity races, quota contention, template mounts and sender-test isolation, plus retained earlier diagnostics. This supersedes the open reproducible sign-in/queue findings in the preceding checkpoint. RELEASE-01 remains **IN PROGRESS** for actual consented/physical/hosted/operational-policy acceptance and QUALITY-03 performance; current register remains **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. Cloud provisioning remains pending.

### 25 October 2026 — QUALITY-03 local follow-up checkpoint

The [current performance evidence](docs/evidence/performance-2026-10-25/README.md) records a smaller stored-ID validation cost with identical acceptance/error behavior, 317 source/tooling tests, 39 database cases and 225 browser cases passing. Local saved tables/configuration, design sources and frozen references remain unchanged. QUALITY-03 stays **IN PROGRESS**: the fresh five-account and desktop save/feedback measurements still miss targets, and the full 100-account mixed rerun stops at the unchanged disk guard before creating fixtures. Full capacity, further latency work and hosted/physical acceptance remain open. Current register remains **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. Cloud provisioning remains pending.


### 25 October 2026 — local completion and source-handoff review

Three subagents implemented and independently reviewed focused local fixes: an IndexedDB acknowledgment race, redundant complete-envelope/reducer work, safe cleanup of failed sealed build stages, and a read-only candidate/index publication check. The checker includes staged-secret, replacement-object and broken-metadata regressions. [Final retained-code evidence and preservation](docs/evidence/local-completion-2026-10-25/README.md) records actual completed commands; [handoff and remaining server inputs](docs/LOCAL-READINESS.md) separates local implementation from later deployment acceptance.

The original-runtime full100 baseline ran and failed capacity/convergence; all 87 exact recoveries and complete history/XP/shared readbacks passed. Dense desktop saves still miss 250 ms. A threaded runtime improved the small actual-HTTP comparison, but both variants missed complete gates and the candidate full100 attempt was blocked before fixture creation by the unchanged greater-than-12-GiB free-disk guard. The candidate is archived, not active; normal and sealed-release runtime entries are restored to their originals. No saved data, retained release, timing threshold or authorization check was removed to force a pass.

QUALITY-03 and RELEASE-01 remain **IN PROGRESS**. The final group regression recorded three Firefox startup/sign-in timeouts (108/111 pass); separate diagnostic passes are not a confirmed repair. Current register remains **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. Local latency/capacity, unresolved browser timeouts, physical HTTPS/device/assistive-technology, operating contacts/policies/rights, independent disaster-recovery custody, real consenting pilot and explicit release approval remain open as applicable. No Git initialization, commit, push, cloud provisioning or server deployment was performed. This checkpoint supersedes the prior statement that a fresh full baseline was unavailable, without rewriting its dated evidence.

The later full100 candidate run completed after the owner freed disk space: 265/400 personal and 26/200 shared first intentions accepted, scheduled p95 5,996.9/5,237.7 ms, four late/missing observations. All 309 exact recoveries and complete history/XP/shared readbacks passed; fixtures were removed. [Numerical result](docs/evidence/local-completion-2026-10-25/candidate-full-summary.json). The archived candidate remains unadopted; disk headroom is no longer the missing evidence for this run. Final retained checks pass 334 source/tooling cases and 936 browser cases, with three original Firefox group-suite timeouts unresolved despite 15 isolated passing repeats. Six sealed rollout/rollback cases and three production feedback correctness cases pass; measured UI latency still misses targets. No task status is promoted by these partial/failed gates.

### 25 October 2026 — hosted CI repair checkpoint

The initial source snapshot is committed and published to [bakhromovmamur/RISE](https://github.com/bakhromovmamur/RISE). Initial hosted CI exposed build-directory dependencies in four server unit tests and the infrastructure scan, plus a database deadline failure in the maximum invitation-history case. [Repair evidence](docs/evidence/ci-2026-10-25/README.md) records the actual clean-checkout reproduction and verification. Local CI repair verification now passes 334 source/tooling tests, 185 infrastructure cases, 12 security browser cases and 18 diagnostics cases; hosted revalidation is in progress. The initial follow-up hosted run passed Chromium/Firefox and all 183 database cases, then exposed the WebKit layout and startup-snapshot cases recorded in the evidence. No release task is promoted by these fixes: QUALITY-03 and RELEASE-01 remain **IN PROGRESS**, with cloud provisioning and deployment pending.

The later partitioned workflow passed the complete Chromium web/backend jobs, including database advisors. Follow-up fixes address a reproduced Firefox startup formatter bottleneck, paused-clock initialization and the midnight snapshot readiness precondition. The corrected source passes **337 source/tooling tests and all 78 production browser cases** locally; account-import diagnostics remain under investigation and full hosted revalidation is still required. See the same dated CI evidence for individual runs and retained failures. This checkpoint does not close broader performance or release gates; cloud provisioning and deployment remain pending.

### 25 October 2026 — CI repair verified

The scoped CI repair is complete: [run 40218685041](https://github.com/bakhromovmamur/RISE/actions/runs/40218685041), source commit `9e1ec427487d16c90834edb74994288e2b93b6fc`, passed all six jobs on attempt 1. Evidence confirms **891 browser cases**, **337 source/tooling cases per web runner**, **185 database cases per backend runner**, both database advisors and cleanup. The [final CI record](docs/evidence/ci-2026-10-25/README.md) supersedes the earlier pending-CI checkpoints while retaining their failures. The intermittent import trigger is not retrospectively declared resolved; its case passed and bounded failure diagnostics remain. Current register stays **11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO**. QUALITY-03 and RELEASE-01 remain **IN PROGRESS** for their separate acceptance gates. Cloud provisioning and server deployment remain pending.
