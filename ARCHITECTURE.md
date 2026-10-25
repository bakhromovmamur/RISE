# RISE — Architecture

**Local background sender, 23 October 2026:** consented prayer/Fajr/habit jobs now use the isolated encrypted sender. Readiness follows its live heartbeat; the receiving worker checks current server authorization before presentation, including cancellation after provider acceptance. Design and saved-profile formats are preserved. Bounded queue/receipt cleanup and a local 200-job load check are implemented; hosted operation/load acceptance and physical HTTPS-device evidence remain pending. Cloud provisioning stays pending. See [local live-sender integration](docs/LIVE-PUSH-SENDER.md).

**Version:** 1.0 · **Date:** 21 October 2026  
**Scope:** production mobile web v1, preserving the existing RISE interface.  
**Status:** current-state inventory plus target architecture. Local BFF/Postgres/Auth, email-code sessions, relational personal commands and consented guest import/account synchronization are implemented. Local conflict/tombstone/stale-device recovery is implemented by SYNC-02. Local account lifecycle and PUSH-01 subscription/test setup are implemented. Hosted environments and physical-device acceptance remain pending; scheduled sending now exists locally.

Read with [PRD.md](PRD.md), [SECURITY.md](SECURITY.md) and [TASKS.md](TASKS.md).

## Contents

- [1. Architecture decisions](#1-architecture-decisions)
- [2. Current architecture](#2-current-architecture)
- [3. Target topology](#3-target-topology)
- [4. Data ownership and time](#4-data-ownership-and-time)
- [5. Relational model and remaining schema](#5-relational-model-and-remaining-schema)
- [6. Local repository and migration](#6-local-repository-and-migration)
- [7. Synchronization protocol](#7-synchronization-protocol)
- [8. Identity and collaboration transactions](#8-identity-and-collaboration-transactions)
- [9. Notification delivery](#9-notification-delivery)
- [10. Configuration and environment separation](#10-configuration-and-environment-separation)
- [11. Operations, rollout and recovery](#11-operations-rollout-and-recovery)
- [12. Verification and unresolved implementation risks](#12-verification-and-unresolved-implementation-risks)
- [13. Document maintenance](#13-document-maintenance)

> DATA-04 local update, 22 October 2026: account lifecycle now has a dedicated recent-auth export/deletion boundary, owner/version-bound device cleanup, atomic suppression, tracked isolated provider purge and authoritative ledger replay. [Account lifecycle implementation](docs/ACCOUNT-LIFECYCLE.md) defines the exact protocol, failure behavior, roles and recovery. Ordinary BFF connections retain their existing restricted identity; only the separate local cleanup process receives a provider admin secret. Cloud provisioning remains pending.

## 1. Architecture decisions

| ID | Decision | Status and rationale |
| --- | --- | --- |
| ADR-01 | Keep React, TypeScript, Vite, current CSS and artwork | Required by product parity; no framework rewrite |
| ADR-02 | Mobile web/PWA is the first release; preserve Capacitor adapters for later | User-directed scope |
| ADR-03 | Use an IndexedDB local store and transactional outbound queue | Guest receipts remain cloud-ineligible; SYNC-01 adds a separate consented account cache/outbox |
| ADR-04 | Add a same-origin TypeScript backend-for-frontend (BFF), using Fastify on Node 24 LTS | Local shell/health, sessions and personal command API implemented; shared domain loaded through pinned production `tsx` |
| ADR-05 | Use managed Supabase Auth and standard Postgres with row-level security | Local standard Postgres/Auth and RLS boundary implemented; hosted provisioning explicitly pending |
| ADR-06 | Use a separate worker process from the backend codebase and a Postgres job queue | Implemented locally; leased Postgres jobs and a separate encrypted sender, with hosted supervision pending |
| ADR-07 | Keep precise coordinates on the device; upload a consented bounded notification plan | Implemented in local account plans; server delivery receives bounded opaque event/time projections without coordinates |
| ADR-08 | Use revision-based conflict resolution and idempotent commands | Implemented for device and independent account stores; owner lock/revision and semantic conditions; SYNC-02 adds independent merges, compact changes and reviewed recovery |
| ADR-09 | Keep personal/private data separate from explicit shared snapshots | Required privacy and product behavior |
| ADR-10 | Use foreground polling initially for shared updates, at most 15 seconds while active | Proposed; sufficient for v1 tasks/lists without another realtime system |
| ADR-11 | Establish verified session claims on the restricted BFF database connection and enforce owner plus active-session RLS | AUTH-02 implemented locally; BFF is the trusted identity boundary, not a database JWT-signature verifier; no blanket administrator or service key |
| ADR-12 | Keep guest and account repositories separate; consent before staged import; paginate revision-consistent account snapshots | SYNC-01 local implementation; SYNC-02 preserves original intent through explicit recovery |

These are implementation defaults, not approved vendor spending. Record hosting, region, sender, domain and capacity before provisioning. A replacement vendor must satisfy the same interfaces and security gates.

The Supabase changelog was checked on 21 October 2026. Relevant infrastructure notices include [TLS cipher retirement](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) and [Postgres maintenance changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). Use supported TLS and a maintained standard Postgres release; do not introduce preview database engines or legacy crypto.

## 2. Current architecture

~~~mermaid
flowchart LR
  UI["React tabs and sheets"] --> CTX["AppContext and App state"]
  CTX --> DOMAIN["Habit / goal / prayer / life models"]
  CTX --> SESSION["DeviceSession: queued revisioned saves"]
  SESSION --> IDB["IndexedDB: profile / recovery / local receipts"]
  LS["Legacy localStorage: rise.local.v1"] --> MIGRATION["Validated worker migration"]
  MIGRATION --> IDB
  SESSION --> BACKUP["Backup worker: private projection / validation / preview"]
  DOMAIN --> CALC["Adhan + tz-lookup"]
  CTX --> DELIVERY["PrayerDeliveryProvider"]
  DELIVERY --> BROWSER["Executing-page timer + display worker"]
  DELIVERY --> NATIVE["Capacitor local notification adapter"]
~~~

The application stores a validated schema-4 profile in IndexedDB and retains the exact legacy localStorage source for recovery. Atomic revisioned writes, backup preview and restore are implemented locally. Domain functions are mostly pure or clone/update state. The calendar, habit-calendar, prayer-ID and pause modules break the existing domain import cycles without changing screen imports. The command/repository/initial-state runtime graph contains no UI modules; see the [boundary inventory](docs/evidence/commands-entry-2026-10-21/module-boundaries.json).

Production first use creates an empty profile on the real device calendar. The separate review entry initializes fictional fixtures only on isolated loopback origins. Guest/review family and squad records remain illustrative; explicitly selected accounts use the local/test membership, family-content and squad-snapshot boundaries below. Versioned private export, staged validation, explicit replacement and same-device rollback are implemented; imported shared content stays in read-only repository archives. The single root service worker owns a verified public offline shell and validated notification clicks; PUSH-01–04 and GROUP-04 add bounded generic test/reminder/group handling, durable scheduling and current-session receive authorization. See [the implemented PWA lifecycle](docs/PWA.md).

Group management and editing screens load through `DeferredGroupScreen` and `GroupScreenBody`. Today task rows and shared status/retry controls remain in the initial graph through `TodayGroups`, `SharedToday` and `GroupStatus`. Only module code is cached across openings; forms retain their existing scope and lifecycle. Loading and recoverable download errors use the existing sheet, localized copy and keyboard focus behavior. Group CSS remains in its original global cascade position. The public offline shell precaches the deferred chunk, preserving cold offline access; this split reduces initial page code, not total installed download size. See [performance evidence](docs/evidence/performance-2026-10-24/increment-04/README.md).

Real calculation, date-specific manual timetables and native schedule reconciliation already exist. They are implementation foundations, not a production backend. Native folders are generated/synced, not device-verified.

INFRA-01 adds `server/` (Fastify/static production files and health endpoints), `supabase/migrations/` (additive infrastructure schemas), `infra/` (separate administrative bootstrap/fixture helpers) and `scripts/infra/` (isolated local/test Docker orchestration). The BFF verifies database identity and runtime privileges before listening. See [the implemented environment contract](docs/BACKEND-ENVIRONMENTS.md).

A [BFF execution-thread proposal](docs/BFF-EXECUTION.md) was implemented and measured locally, then archived without adoption. Its two-account HTTP comparison improved observed personal/shared latency, but both variants failed the complete gate. An initial full100 attempt stopped at the disk guard; after disk cleanup, the isolated full100 candidate also failed capacity, while exact recovery/history/XP checks passed. Normal/local and frozen-release entry points retain the existing single-process BFF and restricted five-connection pool. The archived patch preserves the candidate and focused failure tests for future capacity/rollout evaluation; no partial personal state, API or storage contract was introduced.

AUTH-01 adds `server/auth/` for managed OTP verification, private challenges, opaque encrypted-token sessions, CSRF, revocation and serialized refresh. `src/auth/` owns the memory-only Account sheet/client/localized copy. Authentication alone never initializes or imports personal history. Guest data remains separate during login/logout/switching. Remembered-session consent also permits an owner-scoped offline cache after explicit account use; session-only account data remains in memory. See [the session contract](docs/AUTH-SESSIONS.md).

Auth quota reservations commit before provider I/O, releasing shared IP/email advisory locks while keeping all limits and rechecking CSRF/current authority in the challenge transaction. Superseded browser identity reads await the newest result and recheck their generation after cache reads. These changes require no schema or cache-format migration; see [the sign-in correction evidence](docs/evidence/signin-queue-2026-10-25/README.md).

AUTH-02 adds `server/personal/` and `src/contracts/accountCommands.ts`: independent relational records, forced owner/current-session RLS, derived XP, canonical revisions and atomic replay. SYNC-01 adds `src/sync/`, shared per-entity projection in `src/contracts/personalRecords.ts`, staged consented import, captured command batches, owner-scoped cache/outbox and bounded revision-consistent pull. `WorkspaceSession` selects the guest or account repository through `JourneySession`; the existing domain reducers, styles and artwork stay unchanged. No canonical whole-profile upload or automatic guest conversion occurs. See [personal storage](docs/PERSONAL-ACCOUNTS.md) and [account sync](docs/ACCOUNT-SYNC.md).

## 3. Target topology

~~~mermaid
flowchart TB
  subgraph Device["User's mobile browser / installed PWA"]
    UI["Existing React interface"]
    DOM["Shared domain modules"]
    LOCAL["IndexedDB: profile, drafts, outbox"]
    SW["One scoped service worker"]
    UI --> DOM
    UI --> LOCAL
    SW --> LOCAL
  end
  CDN["HTTPS static hosting / CDN"] --> UI
  UI -->|"same-origin /api/v1, HttpOnly session"| BFF["TypeScript BFF"]
  BFF --> AUTH["Managed Auth"]
  BFF -->|"user-scoped queries + transactional commands"| DB["Postgres with RLS"]
  WORKER["Durable job worker"] -->|"limited job role"| DB
  WORKER --> PUSH["Browser push providers"]
  PUSH --> SW
  SW --> NOTICE["Visible notification"]
~~~

Three deployable responsibilities: static assets, BFF process, worker process. BFF and worker share code/contracts but run with different credentials. Supabase supplies Auth/Postgres; it does not eliminate application authorization.

The public origin routes `/api/v1/*` to the BFF and app/assets to static hosting. No production auth tokens go into React, localStorage, IndexedDB or a service-worker payload. Direct authenticated browser database access is not part of this design. Group/private RLS predicates also check active-account state and a narrowly exposed provider-session revocation predicate, so a previously issued JWT cannot bypass revocation by calling the provider directly.

### Module responsibilities

A module exposes a small interface; implementation details stay behind that interface. Do not create a generic abstraction for every function.

| Module | Interface responsibility | Existing code to retain/extract |
| --- | --- | --- |
| Personal records | Apply explicit habit/goal/reward commands and derive current views | `model.ts`, `developmentModel.ts` |
| Prayer calendar | Calculate/validate dated entries and preserve recorded snapshots | `prayerCalculation.ts`, `prayerModel.ts` |
| Prayer practice | Record/correct, apply pause ranges, derive streaks/windows | `prayerModel.ts`, `lifeModel.ts` |
| Delivery plan | Produce eligible events, cancellation and coverage from state/time | `prayerSchedule.ts` |
| Local repository | Atomic state + outbox changes, migrations, subscriptions, recovery | `src/data/indexedDb.ts`, `deviceSession.ts` |
| Synchronization | Push commands, pull authorized changes, resolve conflicts | `src/sync/`, `server/personal/sync.ts` and recovery modules |
| Identity | Local email-code session, guest separation, selected import and recent-auth account lifecycle | `src/auth/`, `server/auth/`, `src/contracts/auth.ts` |
| Account personal store | Validated owner-scoped commands, relational projection, atomic revision/receipt and derived XP | `server/personal/`, `src/contracts/accountCommands.ts`, existing `src/domain/` |
| Collaboration | Local/test verified membership, explicit invitations, tasks/lists and exact squad snapshots | `src/groups/`, `server/groups/`; retain original review simulations separately |
| Notification adapter | Permission/subscription, schedule receipt, display and acknowledgment | Extend browser adapter; keep native adapter isolated |
| Data portability | Validated backup/export/import, device clearing and recent-auth account export/deletion | `src/data/backup.ts`, `backupProjection.ts`, `BackupScreen.tsx` |

UI components consume view models and commands. They do not calculate XP independently, compose database filters or decide group authorization.

### Implemented command foundation

`src/contracts/commands.ts`, `personalCommands.ts` and `prayerCommands.ts` define and runtime-validate personal intents: habits and timer lifecycle, priorities, goal/reward management, collections, settings, reflections/drafts, onboarding, prayer setup/records/reminders/pauses, dated Fajr plans/acknowledgment and work notes. They reject unknown payload fields/kinds, invalid dates/enums/revisions, repeated priorities, prototype keys, accessors and oversized/deep input before storage access. Incomplete form drafts have separate shape validation; submission still enforces the existing domain rules.

`src/domain/commands.ts` and its personal/prayer reducers apply intents through existing domain functions and check record references. Personal journey edits use `DeviceSession.dispatch`; progress remains derived from the same records. Backup/restore/clear retain their dedicated validated transactional APIs. Timer completion clears the timer and records the check-in together. Goal/reward/habit creation IDs are generated once at dispatch and retained across retries. Existing XP, fixed-week rewards, next-day habit versions, prayer/Fajr separation and explicit completion semantics remain. Local family/squad simulation writes and isolated review controls still use the compatible `setState`; they are not real shared commands.

`src/data/repository.ts` owns guest operation validation and atomic replay through `deviceSession.ts`/`indexedDb.ts`; `storedState.ts` and the migration worker preserve existing data/provenance. Guest receipts remain cloud-ineligible. AUTH-02 retains the actor-free single-command API with database time. SYNC-01 adds an expected-account assertion plus validated captured action context in a separate batch envelope. The BFF still derives identity and audit/authorization time independently; client context is bounded personal-action provenance, not trusted identity.

### Proposed repository additions

Keep current paths until each module moves with imports/tests. `src/data/`, `src/contracts/`, `src/sync/`, `server/`, additive migrations and real integration/browser suites now exist. Shared-domain relocation, backend notification workers and physical-device paths below remain proposals:

~~~text
src/data/                 IndexedDB and sync adapters
src/platform/web/         installation, permission and worker integration
src/contracts/            validated request/response and backup schemas
shared/domain/            extracted pure domain behavior used by web and BFF
server/                   BFF routes, sessions, command handlers
worker/                   push scheduling and deletion/cleanup jobs
supabase/migrations/      reviewed schema/policy changes
tests/integration/        real database/auth/authorization tests
tests/device/             reproducible manual device procedures and evidence
~~~

Do not reorganize every screen as a prerequisite. Replace the persistence seam first and keep the existing AppContext-compatible views.

## 4. Data ownership and time

| Data | Authoritative copy | Offline policy |
| --- | --- | --- |
| Guest personal records | Local repository | Available locally; export is the backup |
| Remembered-device account records | Server committed version + durable local pending operations | Persistent cache/outbox after explicit choice |
| Session-only account records | Server committed version + in-memory pending state | No persistent account cache; online acknowledgment required for a durable-save claim |
| Drafts and active timer | Device store | Local; saved results may synchronize |
| Precise coordinates | Device store | Never uploaded by normal sync; private full export may include them |
| Calculation settings/timetable snapshots | Coordinates/settings remain device-local; sanitized dated windows may synchronize after consent | Primary device refreshes calculations; raw calculation keys never leave the device |
| Groups/membership/shared data | Server | Cached view/draft; server checks every accepted change |
| Scheduled alert receipt | Server queue | Local receipt is informational, not proof of future delivery |
| Credentials and provider tokens | BFF session storage | Never exported or stored in browser application data |

Use UTC instants for events and audit timestamps. Use `YYYY-MM-DD` for civil occurrence dates plus an explicit IANA timezone. Never derive a prayer date from UTC midnight or the server's timezone. Preserve `performedAt`, `recordedAt`, source, settings revision and the actual prayer window snapshot.

The current `calculationKey` serializes complete settings, including coordinates. It must remain device-local and must not pass through generic state sync, logs or notification jobs. Cloud serializers use an explicit field allowlist and a random opaque settings-revision ID, not the raw key or an enumerable coordinate hash. Full user-requested device backups may retain the original settings with a privacy warning.

Account planning timezone governs personal dates. Travel changes it explicitly for future planning; historical occurrence identities do not move. A group stores its own timezone for repeating family tasks, defaulted from its creator. Show the group timezone when it differs; do not silently shift an existing task's civil date.

Client clocks support offline actions but are untrusted for invitation expiry, sessions, audit ordering and job execution. Server time controls those decisions. A clock discrepancy produces a warning; it never rewrites recorded user intent.

### Implemented prayer calendar (PRAY-01)

`src/domain/zonedTime.ts` owns Gregorian date validation, IANA date/clock formatting and manual wall-clock resolution. It rejects nonexistent clocks and skipped dates; an ambiguous repeated clock resolves to the first occurrence. `prayerCalculation.ts` still uses Adhan 4.4.6 and tz-lookup 6.1.25. Around the international date line it recalculates the adjacent solar UTC date whose solar noon belongs to the requested local date; it never shifts an existing instant or invents a missing event. Parameter conventions and astronomical starts remain unchanged by planned offsets. If an explicitly selected timezone is still on the previous civil date during first setup, the prayer tracking start extends to that date so its current window remains recordable; existing dated records are not reassigned.

`calendar.refresh` runs on startup, focus/resume and the existing timers. It extends 30 dates from the calculation timezone without pruning earlier history. Checked entries retain their exact snapshots; date-specific manual timetables retain their source, zone and entries. Failed/polar calculations leave dates unavailable. `getCurrentPrayerDay` keeps obsolete calculated locations out of the active view and schedule while `getPrayerDay` still exposes saved history.

`prayer.timetable` validates the complete dated timetable before preferences or state change. `saveTimetable` removes calculation metadata, rebuilds unchecked UTC instants from the submitted clocks/zone and preserves previously checked entries. Caller-supplied check fields cannot create prayer records. An unresolved manual date cannot create a partial alert plan. Recognizable older manual edits that retained a calculation key are preserved without rewriting their snapshot; their authored clocks govern live windows. An authored source differing from the original key identifies a legacy manual date. A clock-only difference with the calculated source is ambiguous with timezone-rule drift: retain it, withhold active windows/alerts and offer explicit manual review. A completely unchanged save with identical calculated source/times has no distinguishable legacy authorship marker; raw migration/recovery sources remain available.

`PrayerMoment.instant` and `prayerWindowState` provide one real-time comparison for status, prompts, recording guards and work-break expiry. Dated UTC windows remain authoritative across DST and travel; manual clocks resolve in the saved day's timezone. Demo scenes keep their civil-minute clock. These changes do not automatically record a prayer, add XP or alter a checked entry.

Optional `life.deviceTimezone` stores the last observed device-zone identifier and the accepted review baseline (an initial matching zone, or a later explicit keep/save). `calendar.refresh` captures the observation in its validated command. `prayer.location-reviewed` acknowledges that exact observation, and a successful calculated-setup save also acknowledges it. Observation never changes the planning timezone or requests location permission. The marker is device-local and omitted from portable backups; raw same-device recovery retains it. Database version 1, repository formats 1/2, domain schema 4 and backup format 1 remain compatible.

The [PRAY-01 report](docs/evidence/prayer-timetable-2026-10-21/README.md) records the pinned reference vectors, runtime/ICU/tz-data versions, browser probes, preservation checks and limits. Browser Intl does not expose a tz-data version; report actual engine versions and behavior evidence instead of inventing one.

### Implemented prayer records and dated planning (PRAY-02)

`prayerWindowInstants` resolves the saved date's authoritative UTC start, target and end. `prayerWindowState`, the alert planner and Fajr clock display use this same window. Independent streaks wait for the actual end across travel and repeated DST clocks. Elapsed windows remain unconfirmed; no calendar refresh manufactures a record. Weekly counts and history controls retain explicit reports even when the device clock moves behind their date.

Creating an unrecorded prayer report still requires its window to have begun; a new later/missed report requires the end. An existing explicit report can be corrected or removed after a backward clock change. Correction retains the dated window, removes obsolete report metadata and uses the captured command instant for the new audit timestamp. It does not infer an actual performance time outside the open window, or award habit XP. A work break reaches `returned` through a recording command only when the requested report exists after the command; rejected recording retains the note and stage.

Pause/resume commands validate the tracking date and captured action date. Resume before the active pause's starting prayer is rejected rather than deleting its range. Resuming at that exact start with “include this prayer” removes an empty range; otherwise the excluded interval is retained. The form defaults to an open overnight Isha's original date, and prevents an earlier resumption point. Prior explicit reports remain correctable; Undo within an excluded interval leaves that prayer paused.

New Fajr plan saves snapshot optional `backupEnabled` alongside each date's existing plan fields. That date's enable/backup choices govern its alerts independently of later dated saves. The last saved plan remains the default for unplanned dates. Older plans without the optional field retain the existing device backup preference; no past choice is invented or migrated. Fajr drafts now retain an optional explicit date through reload and portable backup. An older undated draft uses the date shown when opened and binds it on the next edit/save.

Fresh-profile wake previews use component-local state. Stop, backup preview and preview “I'm up” cannot overwrite a live alarm or its cancellation ledger. Demo simulations retain their persisted rehearsal stages. A real acknowledgment suppresses wake/backup alerts for its date, leaves preparation/due reminders and prayer records separate, and wins over a stale ringing command. Portable restore still disables real delivery. The optional fields are backward compatible with database 1, repository 1/2, domain 4 and backup 1; no data rewrite or schema bump is required.

## 5. Relational model and remaining schema

AUTH-02 implements the personal subset below in 24 `rise` tables: profiles/preferences, habits/versions/days/occurrences, goals/milestones/links, personal rewards, priority days/slots, cosmetics, prayer settings/reminders/days/windows/records/pauses, dated Fajr plans/acknowledgments, reflections, saved work breaks and personal receipts. Each has ownership, a server revision and creation/update times. Composite foreign keys enforce owner agreement. Entity IDs are UUIDs; dated records use owner/entity/civil-date keys. Text/JSON fields are bounded. The full map includes future group, push and lifecycle tables; their presence here is not an implementation claim.

Personal accounts accept explicit manual dates and sanitized calculated coverage with dated UTC windows, without coordinates/calculation keys. Prayer tracking start is separate from the earliest habit-history date; legacy reports can retain unknown record time. Account status comes from managed Auth/current-session RLS. Drafts/timers/delivery consent remain device scope. Two owner-filtered forced-RLS staging tables support reviewed import; the 24 canonical personal tables remain. SYNC-02 adds semantic conflicts, compact ordinary tombstones and incremental changes; account deletion remains separate. See [the exact contract](docs/ACCOUNT-SYNC.md).

| Entity family | Important keys and fields | Required invariants |
| --- | --- | --- |
| profiles / account_preferences | auth user ID; name, locale, planning timezone, account status | Private settings; separate minimal member display projection |
| habits / habit_versions | owner; effective civil date; full/tiny target, weekdays, cue/reminder | One version per habit/effective date; valid positive targets; owner consistency |
| habit_occurrences | owner + habit + civil date; immutable schedule/name/target snapshot; check kind | Unique occurrence; full/tiny/null only; no writable XP total |
| goals / goal_milestones / goal_habits | owner; ordered milestones; completion and archive dates | Linked habit/goal ownership agrees; completion explicit |
| daily_priorities | owner + date + slot; typed habit/milestone/task reference | Slots 0–2; distinct targets; references validated |
| personal_rewards / cosmetic_claims | owner; fixed condition; earned/enjoyed/corrected dates; XP threshold | Derived eligibility, explicit claim/enjoy, stable target week |
| prayer_settings / prayer_days / prayer_records | owner; civil date; timezone/method/source; per-prayer UTC windows and record | One prayer ID per date; checked windows immutable; sample flag forbidden on live writes |
| prayer_pauses | owner; inclusive from/through prayer keys | Private; at most one active pause; no reason or health-detail column |
| fajr_plans / fajr_acknowledgments | owner + target date; plan revision; acknowledgment time | Acknowledgment is independent of prayer completion |
| reflections / saved_work_breaks | owner; date; bounded plain text; break stage | Private saved content; drafts remain device-only |
| groups / memberships | group kind/status/timezone/owner; user + role/status | One owner; unique active membership; all role changes transactional |
| invitations | group; token hash; expiry; consumed/revoked time; creator | Single-use; token not stored in plaintext |
| family_tasks / task_occurrences | group; title/notes/assignee/schedule; date + actor completion | Assignee is active member or anyone; completion per date; no habit XP |
| shared_lists / shared_items | group/list; name/text, quantity, position, checked, removal barrier | Stable item identity; revision checked on conflicting edits/reorder |
| squad_posts / squad_reactions | group/author; immutable chosen snapshot per published revision; reactor | Author owns edits; reactions unique per member/post |
| installations / push_subscriptions | owner; installation ID, preferences, endpoint/key material, consent | Per-device opt-in; endpoints encrypted and excluded from normal reads |
| push_plans / push_jobs | owner; plan generation, event key, installation, fire/expiry, lease/status | Unique generation/event/destination; bounded coverage; cancellation revision |
| notification_jobs | recipient/source actor, group/member/source revision, operation/installation, two-minute expiry and lease/status | Explicit group/device consent; exact replay; current-source authority; cancellation and suppression |
| operation_receipts / change_log | actor + operation ID; result and revision; authorized change cursor | Replay returns prior result; payload mismatch rejected |
| server_sessions / deletion_jobs / security_events | restricted operational schema | No browser grants; minimal data; retention/purge rules |

No large remotely synchronized copy of the entire legacy `State` is the canonical database. Bounded JSON snapshots are appropriate for historical occurrence details and published sharing payloads, not for bypassing ownership or validation.

Index owner/date on personal history, group/status on shared rows, active membership lookups, invite-token hash, and pending jobs by fire time. Index referencing foreign keys and policy predicates. Query plans must be measured against representative synthetic data; an index is not justified only by convention.

### Access enforcement

RLS is enabled and forced on all implemented personal tables, including tables excluded from the Data API. Personal rows require the authenticated owner and the active linked BFF/provider session/account predicate. Implemented membership and family-content reads require current active membership; mutations also validate role and group status. Updates check both the existing row and the proposed owner/group.

ADR-11 makes the BFF the trusted identity boundary: it verifies/refreshes the provider session, locks the current opaque session, and establishes transaction-local `sub`/`session_id` on `rise_bff_login`'s restricted connection. PostgreSQL does not independently verify a JWT signature from these SQL settings. Requests cannot supply claims or an actor, and normal operations never use a provider service key or migration administrator. `rise` is not exposed by the Data API; provider `authenticated` has RLS-filtered SELECT only, and worker/lifecycle/anonymous identities have no personal access. Profile deletion and receipt update/delete are denied to the BFF. Transactional helper functions default to invoker privileges. The existing narrowly privileged session predicate retains its fixed search path, bounded grants, explicit checks, revoked public execution and security tests.

Views used for data access must preserve caller permissions; group display queries must not expose complete profiles. See [Supabase's RLS model](https://supabase.com/docs/guides/database/postgres/row-level-security) and the authorization matrix in [SECURITY.md](SECURITY.md).

## 6. Local repository and migration

The implemented `rise-device` database is version 1, with `profile`, `recovery` and `outbox` stores. The profile envelope accepts repository formats 1 and 2 and contains domain schema 4, a monotonically increasing revision, command receipts and migration metadata; format 2 supports separate local archives and guarded restore/clear compatibility. `DeviceStore` implements initialization, readback, commands, compare-and-swap saves, atomic restore/rollback and explicit clearing. `DeviceSession` supplies stable subscriptions, personal command dispatch, a compatibility setter for shared simulations/review, serial writes, retry, conflict preservation, reload and BroadcastChannel/focus coordination. Each dispatched command captures civil date, IANA timezone and absolute instant before optimistic reduction. Retry reuses that envelope; it does not read a new clock or generate a new ID. Older receipts without context remain readable. Recovery downloads are provided by `StorageNotice.tsx`.

Writes request strict IndexedDB durability and resolve only on transaction completion. The state and receipt share a transaction. A stable operation ID and content hash make retry idempotent; an altered operation ID payload is rejected. The command adapter records validated operations. The transitional React setter records a **local-only revision receipt**, without a whole-profile payload: it is not a replayable server command. These receipts and all imported profiles are `cloudEligible: false`. Personal actions now use individual intents; only local collaboration simulations and review controls retain this bridge. Success toasts and notification rescheduling wait for a saved session. SYNC-01 must obtain explicit provenance/import consent and build permitted field projections. No sender drains this outbox today.

The adapter validates the complete unknown stored envelope once, then checks the profile's fields and references without a second JSON-safety walk. It exposes no unchecked validation path. Before a transactional callback can yield, the adapter captures an independent snapshot for both writing and acknowledgment; later mutations of a callback-retained object cannot change the committed result. The snapshot is returned only after strict transaction completion. Pure save/timer helpers retain ownership of their results while avoiding redundant outer copies. These changes preserve formats, history and recovery; [local regression evidence](docs/evidence/local-completion-2026-10-25/browser-performance/README.md).

A failed save retains the last committed database state and the unsaved in-memory snapshot. Unsafe edits stop until Retry succeeds or the user explicitly exports/discards them and reloads the saved copy. Revision conflicts never automatically rebase whole-profile replacements. A before-unload guard warns about pending edits; survival of a forced process kill before acknowledgment is not promised. The original source is retained in both localStorage and IndexedDB until explicit clearing. An old client changing that source stops new edits. A confirmed clear removes both copies and receipts and advances the profile revision to prevent stale resurrection.

Profile validation checks JSON/prototype/depth/size/record limits, versions, field types/enums, dates/timezones, IDs, occurrence uniqueness and live references. Unknown safe fields and unfinished form drafts survive; historical priority/reward references can outlive edited milestones. Migration runs in a dedicated worker. Its pending candidate and exact source commit together; a SHA-256 comparison of a separate readback verifies all normalized fields before the verified marker is committed. The marker itself is read back. Startup safely resumes a pending candidate. The checksum detects corruption, not malicious same-origin changes. Mixed/demo detection checks sample timetables and known fixture IDs/dates/people even if mode is fresh. Unrecognized legacy origins remain unverified, never presumed authentic. A dated summary is available under Settings → Your data.

QUALITY-03 reduces repeated CPU work without changing these boundaries. The bounded JSON parser performs its safety walk once before profile shape/reference checks; direct object validation still performs both. The walk inspects own property descriptors without invoking getters, including non-enumerable fields, and retains all limits. Trusted schema field lists are compiled when validators are created; no validation result is cached for mutable input. Short strings avoid character-array allocation while retaining Unicode code-point limits. Stored IDs reject the same ECMAScript whitespace and U+0000–U+001F controls in one pattern scan; accepted Unicode IDs, error paths and all JSON/schema/reference checks remain unchanged. Account hydration groups ordered child rows by parent once instead of repeatedly scanning whole tables. Habit check commands reuse the pure check-in result for materialized-occurrence validation; an archived occurrence remains valid for explicit Undo through its original snapshot. See [performance measurement and constraints](docs/PERFORMANCE.md).

The account record writer compares already-validated JSON values directly when deciding whether a row changed. Object key order is ignored; array order, field presence and scalar types remain significant, and numeric zero retains JSON equivalence. This private comparison is not an input validator. Canonical serialization remains unchanged for row identities, sync/import hashes and immutable replay fingerprints. No-op account commands still advance the account revision and receipt once, while unchanged rows and removal barriers retain their versions. The writer first pairs occurrence rows only when both complete arrays have the same length and ordered keys. It still compares every row value; unchanged pairs need no canonical key maps. Different length or ordering retains the general insertion/removal path. SQL changes, barrier computation and canonical identities remain the same; no result is cached for mutable input.

The account reader projects the dense `habit_occurrences` table's fixed columns directly, retaining `to_json(t.date)` so civil dates remain JSON strings rather than process-local JavaScript dates. Other table projections keep their existing JSON construction. Qualified table ordering preserves date/position/ID order without sorting the JSON date alias. Owner filters, the aggregate record limit, runtime validation, RLS and the caller's actor transaction remain unchanged.

`LocalStore.read` and `LocalStore.transaction` transfer owned records detached from retained storage, other calls and transaction callback objects. IndexedDB detaches its read results and clones the committed callback result; the memory adapter keeps equivalent isolation. `LocalRepository` can transfer the owned state into its snapshot without making a second whole-profile copy. Mutating a returned read, command result or replay must not change durable state, another caller's view or later results. The strict transaction and atomic receipt boundary remain unchanged.

`parseStoredState` validates parsed JSON without normalizing it. `DeviceSession.dispatch` therefore reuses the command result's serialized text for no-op comparison instead of serializing the parsed result again. Validation still precedes optimistic publication, and only the transactional acknowledgment may report a save. No-op commands create no receipt or revision; unknown safe extensions and the original recovery source remain intact.

Keep database version 1/profile schema 4 and repository formats 1/2 readable during application rollback. DATA-02 restore and clear write repository format 2, intentionally rejected by older DATA-01 clients so they cannot leave unknown recovery/archive data behind during a clear. Older localStorage-only assets are also incompatible. Unsupported database, repository or profile versions fail closed and expose raw exports. Expanded DATA-03 command kinds/context also require compatible assets: older command parsers reject unknown receipts without writing. Keep a DATA-03-capable build for application rollback after personal commands have been saved. The exact backup and rollback contracts are in the [portability guide](docs/BACKUP-RESTORE.md).

For guests and remembered-device accounts, an IndexedDB transaction commits the materialized local change and its outbound command together. The UI may update optimistically, but a failed durable commit must show recovery and retain the previous durable state. Multi-tab coordination uses transactional version checks and BroadcastChannel; Web Locks are an optimization with a fallback, not a correctness dependency.

Session-only account mode uses the in-memory adapter for private state and transient retries; only a server acknowledgment is durable. It cannot promise offline survival across tab closure. Offer an explicit switch to remembered-device storage or an export before leaving with unsaved work. Do not depend on an unload event to purge plaintext IndexedDB after browser termination.

SYNC-01 implements these cache boundaries locally: owner-keyed strict IndexedDB state/outbox for remembered accounts, memory-only private state for session-only accounts, verified owner assertions, guest separation and protected pending-work logout. Unexpected expiry/identity change hides and locks pending owner data for reauthentication. Confirmed logout purges the selected cache; newer pending work arriving during logout is retained locked for recovery. Guest storage is never cleared by account logout. Details and limits are in [the sync guide](docs/ACCOUNT-SYNC.md).

### Legacy migration sequence

1. Read the exact `rise.local.v1` value without modifying it.
2. Validate version/shape/limits; do not trust imported object prototypes or identifiers.
3. Preserve an exportable original, then run explicit schema 1–3 to 4 migrations already represented in the model.
4. Identify demo/mixed provenance and produce a user-reviewable import summary.
5. Install the validated schema-4 profile in a versioned IndexedDB envelope in one transaction; do not add people or activity.
6. Verify counts, dates, check kinds, derived XP, reward eligibility and private fields.
7. Mark the migration complete only after readback. Repeated startup is idempotent.
8. Keep the legacy copy until successful verification and an export opportunity; later cleanup is explicit and bounded by the local retention policy.

If any stage fails, leave the original untouched, expose raw export/recovery and disable unsafe writes. Never replace corrupt data with a blank profile and overwrite the original.

### Backup format

Implemented envelope: `rise.private-backup`, version 1, domain schema 4, export time, timezone, checked record counts, `data.personal`, separate `data.localArchives` and SHA-256 over canonical JSON excluding the checksum. A checksum is not authentication. Validation checks the payload, known-field projection and metadata, not merely its digest.

Legacy schema 1–4 JSON remains an import source. Exports exclude credentials, endpoints, invitation secrets, unknown extensions and unrecognized drafts. Supported authored fields and local coordinates remain private backup data. Shared content imports only as a read-only local archive; it cannot recreate membership. Shared server archives require current authorization and a reviewed group revision on every page; they remain separate from private restore. The worker applies the 50 MiB/250,000-object/depth-20 limits, validates and compares before mutation, and terminates on cancel.

Restore is an explicit full replacement tied to the previewed revision. The profile, `recovery/pre-import` snapshot and cloud-ineligible operation receipt commit in one strict transaction with in-transaction readback; errors abort all three. A stable operation ID/content hash makes retry idempotent. Rollback reads the exact snapshot from this database and checks its ID and current revision, rather than trusting an imported file as local authority. There is one recovery point, replaced on the next successful restore/rollback and removed by explicit clearing. Ordinary edits preserve it. See [DATA-02 details](docs/BACKUP-RESTORE.md) for comparison units, delivery reset, raw preservation and limits.

## 7. Synchronization protocol

### Command envelope

AUTH-02 retains the single-command API, while SYNC-01 connects the interface through `POST /sync/commands` and `GET /sync/head`/`POST /sync/pull`.

~~~ts
type SyncOperation = {
  protocolVersion: 1;
  operationId: string; // generated once; same ID, payload and context on retry
  baseRevision: number;
  command: AccountCommand;
  context: { now: number; date: string; timezone: string };
  expected?: string; // immutable semantic read-set fingerprint
  observedRevision?: number; // acknowledged canonical revision
  predecessor?: string; // immediately preceding queued operation ID
};
// Batch: {accountId: expectedVerifiedAccount, operations: SyncOperation[]}
~~~

The account assertion is checked against the verified session, never used as identity. Captured time/date is bounded personal-action intent; auth/audit/expiry remain database-derived. State and stable operations commit atomically to the remembered cache. The sender validates server receipts before removing a batch, preserving later local edits. Exact retries cannot duplicate XP; stale different intents return 409 and remain retained. A calendar observation without a personal delta sends no command.

`AccountJourney` serializes its local cache work across draft saves, receipt acknowledgment and remote snapshot installation. Device-only saves merge into newly installed personal state when necessary; personal operations keep their captured conditions and identity. Pending actions resume after reconciliation, while offline work stays queued. Store CAS still detects a real intervening tab/owner/generation change; this coordination never refreshes the expected version to force a failed local write through.

Guest import prepares a known-field projection in a worker, requires explicit upload consent, stages bounded owner-private pages, previews an append merge and requires final confirmation. Existing account records win; guest data remains intact. Uncommitted plans expire/cancel; committed pages are removed transactionally with the receipt. There is no whole-account replacement.

Pull reads the cheap canonical head and, when it changes, paginates a coherent full projected snapshot (at most 200 rows/about 256 KiB per page). Cursors bind to owner and revision; intervening commits restart the read up to three times. Large hydration uses a worker. SYNC-02 adds compact incremental changes; stale cursors/floors fall back to a full snapshot. A post-push reconciliation is required even after a lost response or unchanged later head. Foreground startup/focus/online and a 15-second visible interval drive work, with bounded backoff/jitter for transient errors and explicit retry for conflicts/auth/validation. No Background Sync dependency exists. See [routes, storage, recovery and limits](docs/ACCOUNT-SYNC.md).

### Implemented local sync conflict policy

AUTH-02 retains conservative account-wide checks for the independent legacy command API. SYNC-02 adds immutable semantic conditions and observed revisions to the sync API: independent records/dates merge, while dependent corrections require explicit review. Original intent remains in a private recovery point; a reviewed action receives a new ID. No silent revision renumbering occurs. [Implementation and limits](docs/SYNC-RECOVERY.md). Personal, membership and family-content conflicts have local server/browser recovery paths. GROUP-03 now supplies [exact squad preview/publication and conflict recovery](docs/SQUAD-SNAPSHOTS.md); local acceptance is verified ([evidence](docs/evidence/squad-snapshots-2026-10-24/README.md)).

| Case | Resolution |
| --- | --- |
| Exact replay | Return the committed result; no second effect |
| Two identical sets of the same check state | Treat as converged if domain conditions match |
| Concurrent full versus Undo, prayer correction, edited target or reward enjoyment | Return 409 with permitted current state; retain local intent and offer explicit choice |
| Different entities/dates | Merge independently |
| Different list items | Apply independently; same item or order revision conflict is surfaced |
| New private draft | Retain locally; no server conflict until saved |
| Membership removal/account deletion | Reject; do not offer an override that restores access |
| Stale archived/deleted entity | Tombstone wins; restore requires an explicit authorized command |
| Ownership transfer/invite consumption | Serialize in a database transaction; no optimistic membership success |

The local 90-day receipt/ordinary-change policy prunes opportunistically under the owner lock and advances a monotonic rebase floor. A narrow RLS DELETE policy allows only current-owner expired receipts; receipt updates remain denied. Older queues require a full snapshot and review; an unknown old ID is never assumed uncommitted. A compact removal revision survives deletion/recreation until its change entry expires, after which the floor requires rebase. OPS-02 now runs the same owner-locked retention/floor transaction through the local housekeeping command. DATA-04 now supplies immediate account-deletion suppression and the separate local purge loop; see the account-lifecycle guide.

### Server interfaces

All routes are under `/api/v1`. Auth/session, personal, sync, account lifecycle, push, membership and shared task/list routes are implemented locally. Membership, family task/list controls and private task priorities have browser integration. Squad preview, bounded reads and group-command mutations are locally verified. Optional generic group notifications now use explicit preferences, transactional jobs and current receiving authorization. Ordinary changes go through validated commands rather than generic arbitrary-table writes.

| Route family | Purpose |
| --- | --- |
| `/auth/code`, `/auth/verify`, `/session`, `/logout` | Email code, verified BFF session and revocation |
| `/personal`, `/personal/commands` | Implemented authorized relational snapshot and atomic account commands; independent of guest data |
| `/sync/head`, `/sync/pull`, `/sync/commands`, `/sync/imports/*` | Implemented head, coherent paginated snapshot, atomic batches and consented staged import |
| `/sync/changes`, `/sync/review` | Implemented compact revision-bound deltas/tombstones and current-head recovery permission checks |
| `/groups`, `/groups/commands`, `/groups/:id/invitations`, `/groups/invitations/preview`, `/groups/receipt` | Local/test current membership projection, explicit commands, minimal invitation preview and owner-bound recovery acknowledgment |
| `/groups/:groupId/export` | Local/test recent-auth shared archive; reviewed revision, current-member RLS, complete bounded pages and worker validation; separate from private backup |
| `/groups/:groupId/content`, shared commands through `/groups/commands` | Local/test bounded revision-bound task/list/item/occurrence reads and transactional family content writes |
| `/squads/preview`, `/squads/:groupId`, squad commands through `/groups/commands` | Local/test owner-private ten-minute preview, revision-bound 20-post pages and exact transactional publication/edit/withdrawal/reactions |
| `/push`, `/push/disable`, `/push/test` | Implemented per-device subscription/privacy, revocation and explicit test |
| `/push/plan`, `/push/cancel-plan`, `/push/reminder` | Implemented local/test plan replacement, cancellation and reminder receive authorization |
| `/push/group` | Local/test exact group-job receive authorization; boolean only, with current source/membership/consent and retained suppression |
| `/sync/commands` with dated Fajr acknowledgment | Implemented wake-only cancellation in the personal transaction |
| `/account/export`, `/account/deletion`, `/auth/reauth/*` | Implemented recent-auth export/deletion and purpose-bound reauthentication; terminal status comes from `/session` |

Use consistent errors: code, safe message key, field errors, retryability, request ID and permitted conflict revision. Use 401 for expired identity, 403/404 without leaking other records, 409 for conflicts, 422 for validated input failures and 429 with retry guidance. Never return SQL, tokens or full profile data in error messages.

## 8. Identity and collaboration transactions

Email code verification is implemented locally through the BFF and managed Auth. Hosted HTTPS requires an opaque `__Host-rise_session` cookie: Secure, HttpOnly, Path=/, SameSite=Lax, no Domain. Fixed HTTP loopback environments use separate `rise_local_*`/`rise_test_*` development cookies for WebKit compatibility; this is not hosted HTTPS evidence. Server stores a hash of the opaque identifier and AES-GCM encrypted provider token material. Refresh token rotation is serialized per session. The no-argument `rise_private.active_session()` predicate checks linked BFF/provider revocation, expiry and current account status through a narrowly privileged non-login owner. See [implementation, grants and key recovery](docs/AUTH-SESSIONS.md). [Supabase documents managed email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [session behavior](https://supabase.com/docs/guides/auth/sessions).

The BFF validates CSRF tokens and exact Origin on mutations. The absence of a JavaScript-readable token limits credential theft but does not make XSS harmless. Provider JWTs can remain valid until expiry after an application logout; record/reject their linked session ID in the database revocation predicate as well as invalidating the BFF session. Test direct provider access with a revoked token. A tightly scoped predicate helper must not expose the session table or accept a caller-selected user ID.

Local `Sessions.read`/`asActor` admission now queues same-session work before database acquisition, with bounded total/per-session counts and a three-second wait. This prevents session-lock waiters from occupying the whole restricted pool. The opaque-cookie digest is only a scheduling key; every operation rechecks current authorization afterward, and SQL locks/RLS remain authoritative across instances. The five-connection budget, normal single-process entry and transaction/receipt boundaries remain. [Limits and restart behavior](docs/AUTH-SESSIONS.md#bounded-session-admission).

**GROUP-01 local membership:** [the membership boundary](docs/GROUP-MEMBERSHIP.md) implements the server operations below through `server/groups/`, a strict command contract, forced RLS and a narrow non-login database capability role. The BFF cannot write group tables directly. A deferred owner/member foreign key enforces one active owner; shared nicknames are explicit, and delivery preferences are owner-only. Account suppression and terminal backup replay are integrated for membership. `src/groups/GroupProvider.tsx` selects only the verified account journey; `GroupSession` owns immutable pending operations, current server views and retries. Views and invitation secrets stay in memory. Non-secret intent and form drafts use the existing owner-scoped account store (memory only for session-only accounts), with unchanged cache formats. `WorkspaceSession` includes unresolved group intent in departure safeguards without treating it as personal sync work or push readiness. The [bounded invitation reader](docs/GROUP-INVITATIONS.md) adds 20-row current-owner/revision pages, memory-only navigation and retained-history limits. The review build retains the original simulations; account-selected task/list controls use the GROUP-02 reader and command boundary below.

**GROUP-02 local shared-content boundary:** [the shared-content contract](docs/SHARED-CONTENT.md) adds group-owned tasks, dated completion snapshots, lists and item removal barriers. Active members collaborate through the existing actor/group lock and immutable receipt boundary. The group revision detects competing edits and reorders; coherent 50-row pages refuse continuation after a changed revision. Stable member IDs retain deidentified family history across account deletion, and group deletion cascades content. Private priorities add only group/task UUIDs and an explicit occurrence date, without a shared-parent cascade. New selections acquire sorted shared group locks and require current member/schedule authorization inside the personal transaction; retained selections remain removable/reorderable after access loss. Domain authority is separate from wire context. Account caches 1/2, older rows, immutable fingerprints and staged imports stay compatible. `SharedContent` keeps pages in memory, fences owner/revision changes and registers loaded eligibility through `WorkspaceSession`; it stores no shared text in personal records. Account-selected task/list screens consume that reader, including group-timezone Today, dated history and private priority replacement. Stable form components survive their own revision refresh; current access still gates the rendered body. Durable drafts retain IDs/revisions, immutable shared intent replays exactly, and explicit review captures a newer head. Successful receipt cleanup clears only the matching draft. Unknown completion reads show loading/error states rather than an unchecked action. Shared-content, squad and invitation readers remember which group-result array was current when a read became unavailable. A newer successful group result invalidates that transient error even when its revision is unchanged; ordinary busy/receipt updates cannot trigger retries. Successful/in-flight views remain, authority errors remain fenced, and clearing/closing entries releases the failed-read metadata. Invitation recovery uses the new authorized first page. Review simulations retain their original composition.

Invite links carry a high-entropy token in a URL fragment; the app reads and removes it before navigation/telemetry, then sends it in a protected request body. Store only its hash on the server. Both initial navigation and same-document fragment changes remove the token from history. A reload after an interrupted join uses the owner-bound receipt endpoint; an unknown outcome needs the original link and another explicit review. The browser never persists the token in its recovery draft. Acceptance locks the invite, checks expiry/revocation/usage, inserts membership and consumes the invite atomically. A link preview grants no group access.

Ownership transfer locks the group and checks the current owner and active recipient. Leaving/deletion cannot remove the last owner without a transfer or explicit group deletion.

For squad sharing, the server builds a bounded snapshot from allowed selections and committed private records. It returns a preview ID/hash and exact content. Publication stores that preview unchanged; if the user wants newer values, they regenerate and review it. A preview expires after 10 minutes. Never silently re-query private data at publish and change the approved contents. GROUP-03 implements this boundary with forced RLS, memory-only shared reads, durable private drafts, explicit conflict recovery and pre-suppression squad erasure. [Data, authority and rollback](docs/SQUAD-SNAPSHOTS.md).

## 9. Notification delivery

**GROUP-04 local implementation:** [optional group notifications](docs/GROUP-NOTIFICATIONS.md) use a separate default-off group preference plus existing per-installation consent. Task assignment edits and explicit squad publications create bounded generic jobs in the content/revision/receipt transaction. Recipient actor → group → job locks protect final dispatch; receiving authorization rechecks both memberships, source revision, installation/session, quiet hours and recipient/source-author deletion suppression. Cancellation preserves provider acceptance while suppressing later presentation. The existing isolated signer and shared occurrence ledger are reused. The legacy preference body and cache formats remain compatible; device permission is never requested by saving group settings. Lifecycle cleanup erases both recipient/source jobs before suppression and during terminal replay.

**PUSH-01 local implementation:** `server/push/`, `src/push/` and the root worker now implement verified per-installation subscription/privacy, encrypted capability storage, explicit bounded test requests, revocation and account-deletion integration. The separate local sender owns VAPID signing and a restricted database role. `rise-push-device` v1 stores only revisioned consent/observation metadata; guest/account formats are unchanged. Subscribing does not create a prayer/Fajr/habit schedule. PUSH-02–04 now implement the plan/queue sequence locally, including live sender heartbeats and receive authorization; see [current integration](docs/LIVE-PUSH-SENDER.md). See [implemented contracts, grants and limits](docs/PUSH-SUBSCRIPTIONS.md).

### Plan and receipt

Existing `buildPrayerSchedule` remains the domain foundation. Browser v1 adds a web plan adapter for seven days of future events, with account/installation identity, UTC fire and expiry times, schedule generation, source revision and an opaque event key.

The primary scheduling installation calculates from its local coordinates or manual timetable. It sends the selected timezone, dated schedule, eligibility and cancellation updates after explicit notification consent. Other installations receive the same account plan but opt into delivery independently. A different primary installation must explicitly take over; competing revisions cannot silently replace the plan.

The server validates date ranges, per-kind rate limits, schedule ordering, current pause/acknowledgment state and consent. It does not claim to independently verify astronomical accuracy without coordinates. Receipts show the actual committed coverage and next eligible alert.

Do not upload coordinates, private notes or habit titles to the job payload. Event timestamps/kinds can themselves reveal a routine and are treated as sensitive. Generic visible copy is the default.

### Delivery sequence

1. User opts in; capability detection explains any installation requirement.
2. After the user's gesture, request notification permission and subscribe with VAPID public key.
3. Validate/encrypt the subscription server-side; VAPID private key stays in the secret manager.
4. Replace pending jobs for the accepted plan generation atomically.
5. Worker leases due jobs, checks account/installation/consent/plan validity again and sends.
6. Record provider acceptance or failure separately from any device-side observation.
7. Worker retries transient failures within expiry; 404/410 endpoints are retired. Expired events are not newly dispatched.
8. Service worker handles a user-visible push and opens only allowed same-origin routes.
9. The page and worker use one transactional display ledger/tag per installation/event to avoid duplicate foreground/push presentation.

The current local protocol enforces a 120-second expiry for prayer/Fajr and habit reminders. A 15-minute habit/group expiry is a proposed pilot change requiring coordinated contract, database, sender and receiver validation; it is not current behavior. Provider TTL must not extend beyond event expiry. A late received alert must not masquerade as a timely alarm.

Use user-visible pushes, not silent keepalive or background computation. Handle stale/duplicate incoming pushes in a manner that respects provider user-visible requirements; verify platform behavior rather than assuming arbitrary suppression is allowed. [Push subscription semantics](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) specify the visible-use contract.

### Cancellation and acknowledgment

A prayer record, pause, plan/settings change, delivery disable, group mute or account removal cancels pending eligible jobs in the same accepted transaction. “I'm up” cancels that date's remaining wake/backup jobs, not prayer records.

Already submitted pushes cannot reliably be recalled. Offline cancellation affects local delivery immediately but server cancellation remains pending; show this difference. The worker rechecks generation immediately before send, yet a final dispatch race remains possible and must be tested/documented.

The current page timer stays a clearly labeled foreground fallback. The service worker must not schedule an overnight timeout. Sound, haptics and wake behavior are platform capabilities, not application guarantees.

### Service worker lifecycle

SAFE-01's [browser security policy](docs/LOCAL-SECURITY.md) is a single server-owned header definition consumed by both the BFF and the PWA build fingerprint. Policy-only changes produce a distinct public release and use the existing explicit all-tab update protocol. Cached public responses retain their policy offline; no personal database/cache-format migration or forced clearing is introduced. The BFF enforces same-origin resources, script/evaluation and framing restrictions, with an explicit existing-style exception and limited feature permissions. Hosted HTTPS/HSTS acceptance remains pending.

WEB-02 retains `/notifications-sw.js` at root scope for app files and notification clicks. `scripts/pwa-build.ts` injects the public asset list, SHA-256 hashes, release ID and `db1-repository2-domain4` compatibility contract into production output. Review builds do not auto-register the worker or link the manifest. Public caches are separate from IndexedDB; private/API/auth/logout and mutation responses bypass Cache Storage. There is no generic runtime response cache. PUSH-01–04 add validated test/reminder listeners and uncached receive authorization; private notification API responses remain outside this cache.

Install verifies all public assets before succeeding, without automatic `skipWaiting`. Explicit activation asks every app window to close forms, finish startup/migration/readback and hold its `DeviceSession` command queue. Temporary leases freeze new writes; failed saves, restore/clear, open dialogs, unknown clients or incompatible contracts keep the update waiting. Recheck the live window set before activation. Held clients reload on controller change; first adoption does not reload. A reply timeout after an approved hold does not cancel worker activation: retain that hold until controller change, explicit worker refusal or the existing 30-second expiry. An error before approval retains the ordinary failure path. Approval also waits for the per-document private-request lane (`src/pwa/requestHold.ts`) to drain after journey durability is established. Both account and sync API entry points track requests through response-body parsing and reject new work through their existing unavailable/retry path while held; nothing is queued or replayed by the lane. This preserves required session-only sync before approval and prevents background requests from restarting the retiring worker. Optional worker status/pruning messages pause during the same lease. Matching refusal/expiry releases the lane; stale tokens cannot reopen it. See [the activation correction evidence](docs/evidence/worker-activation-2026-10-25/README.md). A failed download retains the previous complete shell. Cleanup retains releases needed by live tabs and one previous public version, leaving unrelated caches and all personal storage untouched.

No persistence schema changes are made by WEB-02. For a future incompatible schema, change the compatibility contract deliberately and migrate only after old windows are closed; never erase data to resolve a mismatch. See [PWA deployment, recovery and physical-device acceptance](docs/PWA.md).

## 10. Configuration and environment separation

The BFF implements the environment/provider/database and session-key contract below. PUSH-01 implements separate local sender settings; hosted sender configuration remains pending. The frontend requires none of these server variables.

| Setting | Location | Classification |
| --- | --- | --- |
| APP_ORIGIN, DEPLOY_ENV, RELEASE_ID | Server/build | Non-secret, validated per environment |
| INSTALLATION_ID, SUPABASE_PROJECT_REF | BFF/administrative bootstrap | Non-secret identity; checked against the database marker |
| DATABASE_URL | BFF only | Restricted BFF login secret; remote TLS verification required |
| BIND_HOST, PORT, STATIC_DIRECTORY | BFF | Server-only binding and production asset configuration |
| VITE_API_BASE | Web build | Public; same-origin path by default |
| VITE_BUILD_MODE | Web build | Public; production or separate review build, never URL-controlled |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | BFF | Provider configuration; not an administrator credential |
| Provider admin credential | Isolated account-lifecycle jobs | Secret; never ordinary request identity |
| DATABASE_WORKER_URL / DATABASE_MIGRATION_URL | Separate process/CI identities | Secrets with distinct privileges |
| SESSION_ENCRYPTION_KEY | BFF secret manager / protected local runtime file | Implemented 32-byte key, protected local format v1; explicit revoke-and-rotate maintenance, no online multi-key rotation |
| PUSH_DATA_ENCRYPTION_KEY | Protected BFF/sender configuration; hosted secret manager pending | Implemented separate 32-byte AES-GCM key; ciphertext binds environment/owner/device; preserve separately from backups |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT | Public config endpoint / isolated sender | Implemented locally; only the public key reaches the browser, signing key stays outside the BFF |
| Email sender/domain credentials | Auth provider configuration | Secret and verified sender |
| Error-reporting endpoint | Approved config | Treat as public identifier; redact payloads regardless |

Local/test have separate Postgres/Auth containers, signing/runtime credentials and installation origins (4190/4191). `server:local` serves the local installation on fixed browser-compatible 4192; the immutable 4190 marker, keys and old-origin storage remain. `origin` is the exact request/CSRF origin; `installationOrigin` is the independently verified database marker. No arbitrary alias or hosted override is allowed. The CLI's development administrator password is restricted to loopback and is not a hosted configuration. Separate hosted staging/production projects remain pending. Never connect fixture tests or review builds to production. The Vite split emits `dist/` and `dist-review/`; both reject backend/private imports and unapproved public environment variables. Production rejects reviewer modules, and the review entry refuses origins outside 4174/4180/4182. BFF startup fails closed on invalid/missing configuration, crossed database identity or elevated runtime role; health endpoints expose no secrets. The production-only static boundary is served on the same origin as `/api/v1/`.

Hetzner is confirmed, but its plan/process support is unknown. The future Supabase organization is selected; the product owner kept cloud provisioning pending. Database region remains undecided. Verify host capability, backup, cost and data-residency needs before deployment. Details and explicitly uninstalled host examples are in [the environment guide](docs/BACKEND-ENVIRONMENTS.md#hosted-completion-and-rollout).

## 11. Operations, rollout and recovery

Build immutable assets, run tests, deploy backward-compatible schema expansion, then backend/worker, then frontend. Enable new capabilities with server-enforced flags per environment. Never use a frontend flag as authorization.

Monitor API health/latency, local save failures, sync conflict/retry rates, queue age, worker leases, failed/retired subscriptions, authentication abuse and backup freshness. Logs carry request IDs and bounded error codes, not private payloads.

The queue uses leases and retry backoff. A crashed worker can cause retry; operation/event IDs prevent additional business effects. No claim of mathematically exactly-once push delivery is made.

Backups target daily recovery points, at most 24 hours' data loss and at most four hours to recover, subject to a measured restore drill. Test restoration in an isolated environment with notifications disabled. Before enabling access, reapply account-deletion and revocation records newer than the backup.

Rollback returns to the previous compatible assets/backend. Do not roll back by deleting user rows or shipping an older client that misreads a newer local schema. Use expand/contract database changes and a migration recovery plan.

## 12. Verification and unresolved implementation risks

| Layer | Required evidence |
| --- | --- |
| Domain | Existing invariant suite plus timezone/travel/pause/correction regressions |
| Local store | Interrupted migration, corrupt import, quota error, multi-tab race and rollback |
| Backend | Real database integration, duplicate commands, concurrent revision conflict, atomic group transactions |
| Authorization | Anonymous, owner, unrelated user, member, removed member and stale-session negative tests |
| PWA | Offline cold/warm load, update while editing, cache/account separation |
| Notifications | Real devices and providers, scheduled receipt vs arrival, cancellation races and expiry |
| Release | Visual parity, accessibility, supported browser matrix, load test and isolated restore |

FND-01/FND-02 add a [reproducible visual baseline and local/CI checks](docs/evidence/foundations-2026-10-21/README.md): exact runtime/dependency pins, application/test/config type checks, correctness linting, three browser engines and isolated test origins. Hosted CI and physical-device acceptance are not implied by local automation.

Known risks remain: the whole-state compatibility path for local collaboration simulations/review, mixed demo/live histories, a large current JS bundle, incomplete cloud provisioning decisions, and best-effort platform notification delivery. English/Russian/Uzbek coverage has [local QUALITY-01 acceptance](docs/evidence/localization-2026-10-24/README.md); physical language/accessibility acceptance remains open. The [operating decision record](docs/INFRASTRUCTURE-DECISIONS.md) captures confirmed launch markets, intended domain and cost ceiling alongside unresolved provider/region/ownership details.

## 13. Document maintenance

Update the ADR table when a decision changes, including consequences and migration steps. Keep proposed routes/entities clearly separated from implemented code until each task lands. Link accepted deviations to the PRD and security review.

The UI remains the existing product throughout this migration. Technical restructuring earns its place by protecting correctness, privacy or operability.


### DATA-04 storage and process decisions

Six additive migrations introduce purpose-bound reauthentication metadata, three forced-RLS operational deletion tables, the suppression predicate/session trigger, restricted lifecycle session-hash access and eight missing personal-root cascade links. Existing migration files, domain rules and guest schemas remain intact. The initially attempted managed-Auth SQL deletion surface is removed by a later additive migration; final purge uses the supported provider admin API in its isolated process.

`server/lifecycle/` owns recent-auth export, terminal deletion and purge behavior. `src/account/` owns the strict private-file boundary and localized controls. `scripts/infra/lifecycle.ts` supplies local/test one-shot/watch and protected ledger export/replay. Provider deletion cannot share the job transaction: an already-absent subject is an idempotent retry, and completion follows verified absence. The terminal receipt uses opaque existing cookies and never a public owner-ID lookup.

`rise-accounts` stays database version one/cache formats one and two. Strict account/preferences transactions carry per-owner clear generations and deletion markers; device cleanup is separate from server deletion and the guest database. Delayed foreground delivery checks scope before display/callback. Public PWA caches remain public-only. PUSH-01–03 implement subscription/test/plan/job cancellation and cascade purge. GROUP-01–04 now extend that integration seam to membership, retained family history, authored squad erasure and recipient/source notification jobs. A missing installed notification cleanup hook still blocks deletion; GROUP-05 verifies the combined local ownership/export/deletion/cache/restore path. Hosted restore operations and physical-device acceptance remain pending. See [shared archives and lifecycle](docs/GROUP-LIFECYCLE.md) and [evidence](docs/evidence/group-lifecycle-2026-10-24/README.md).

The earlier PUSH-02 staging, PUSH-03 cancellation and PUSH-04 renewal/habit increments are integrated by the [current local sender](docs/LIVE-PUSH-SENDER.md). Their dated evidence remains in `docs/evidence/`; it does not certify hosted supervision, load acceptance or physical-device delivery.

PUSH-02 queue hardening adds four bounded concurrent sender lanes, bounded expiry/cleanup, seven-day receipt retirement and owner-root retention markers. New cancellation requests durably capture an authorized `throughGeneration` before their first POST. The private cleanup function exposes only a count to the worker; a narrow non-login owner retains metadata-only receipt grants. Ordinary BFF receipt update/delete remains denied. Old legacy intent stays pending for explicit review after its receipt expires. [Protocol, authorization and rollback](docs/PUSH-RETENTION.md).

## Shared archive and integrated lifecycle — GROUP-05

`server/groups/export.ts` reuses the screen readers' known-field SQL projections on the ordinary restricted BFF connection. The current actor lock, recent authentication and reviewed group revision protect complete 200-row keyset pages and a final authorization check. Explicit group predicates retain ordered-index plans for large history. No new role, grant, migration or retained export table is needed.

`rise.group-archive` v1 carries only current authorized group metadata and family history or published squad snapshots, with a SHA-256 integrity checksum and the existing 50 MiB/250,000-object/depth-20 limits. It is separate from `rise.account-export` and rejected by private restore. The browser worker fetches/validates/hashes in memory; cancel, account/revision changes and unmount terminate it, with a final identity fence before download. Recent authentication returns to explicit review rather than starting a file automatically. See [the full contract](docs/GROUP-LIFECYCLE.md).


## Local operations interface — OPS-01

[The operations contract](docs/LOCAL-OPERATIONS.md) owns fixed local/test probes, safe diagnostic projections, thresholds, retention and support handling. `createApp.operationsSnapshot()` exposes bounded in-process counters to the entry point only; it is not a public API. The local BFF writes a latest private snapshot every five seconds. `ops:check`/`ops:watch` combine it with readiness and `operations_snapshot` on a separate aggregate-only login. Missing/stale samples are failures, not zero values. The atomic private alert journal records deduplicated raised/resolved codes, limited to 200 events/seven days while monitoring runs. The monitor cannot alter queues or call ordinary user APIs. `ops:drill -- test` verifies that route without external delivery.

Local runtime source/lockfile fingerprints and the actual PWA web release identify code; protected configuration is excluded. The browser report accepts only status primitives, uses an explicit download action and has no new persistence or telemetry transport. Domain commands, account/cache formats, private backups and push authorization remain unchanged. Product analytics remain off. OPS-02 now reads private backup/maintenance metadata and checks latest-file presence for freshness alerts; external liveness, named operating owners/contact and hosted monitoring remain pending, with cloud provisioning pending.

### OPS-02 local recovery boundary

[Server backup/recovery](docs/SERVER-BACKUP-RECOVERY.md) uses a consistent custom PostgreSQL archive encrypted with an independent AES-GCM key. Only a new networkless, unmounted disposable container can receive a restore; there is no existing-target or promotion option. Restore revokes all sessions/invitations/push consent, replays current suppression and removes restored deleted/banned identities through the existing terminal cleanup. Shared groups whose authority/revision changed are withheld from the recovered copy. A fresh source authority inventory is required and compared again before success; missing/changed authority fails closed.

The local maintenance CLI shares the existing sync floor, narrow push cleanup and lifecycle purge boundaries. It supplies daily backups while running, 30-day authenticated archive expiry and separate backup/maintenance freshness alerts. No migration, browser/domain/storage-format or UI changes were required. Key custody, source-loss recovery, changed-group reconciliation, supervision, full service RPO/RTO/reopening and hosted operation remain explicit gates; cloud provisioning remains pending.

OPS-03 now supplies [sealed local releases and rollback](docs/LOCAL-ROLLOUT.md). Each package owns its production shell, backend/domain source and pinned dependencies. Fixed-installation admission verifies file/worker digests, exact migration history and unchanged storage/API contracts before a candidate health probe. The local supervisor restarts on the same browser origin, preserves the previous compatible package and records observed activation. A server-only write pause preserves durable retry intent; logout retains its authorization. Previous fingerprinted chunks may be served, but HTML/worker/private responses never fall back. No schema downgrade, automatic migration, sender start or hosted provisioning is included.

## Local help and policy boundary — OPS-04

[Localized local notices](docs/LAUNCH-POLICIES.md) are a read-only Settings disclosure. They use existing styles, the public release metadata and the existing explicit diagnostic download; they dispatch no commands, set no consent and call no external service. Original dependency notices are bundled as escaped text and inherit the existing offline shell/update lifecycle. No database, cache format, API, worker or backend change is required. Public-policy approval and dedicated operating contacts remain open.
