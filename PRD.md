# RISE — Product Requirements Document

**Local background sender, 23 October 2026:** consented prayer/Fajr/habit jobs now use the isolated encrypted sender. Readiness follows its live heartbeat; the receiving worker checks current server authorization before presentation, including cancellation after provider acceptance. Design and saved-profile formats are preserved. Bounded queue/receipt cleanup and a local 200-job load check are implemented; hosted operation/load acceptance and physical HTTPS-device evidence remain pending. Cloud provisioning stays pending. See [local live-sender integration](docs/LIVE-PUSH-SENDER.md).

| Field | Value |
| --- | --- |
| Document | PRD v1.0 |
| Baseline date | 21 October 2026, Asia/Tashkent |
| Release | RISE mobile web v1 |
| Status | Implementation specification; not a claim of release readiness |
| Product owner | Project owner; launch decisions recorded in the decision register |
| Engineering/security owners | To be assigned before staging is promoted to production |
| Related documents | [Architecture](ARCHITECTURE.md), [Security](SECURITY.md), [Tasks](TASKS.md), [Design](DESIGN.md) |

## Contents

- [1. Product intent](#1-product-intent)
- [2. Users and jobs](#2-users-and-jobs)
- [3. Scope and non-goals](#3-scope-and-non-goals)
- [4. Product parity contract](#4-product-parity-contract)
- [5. Functional requirements](#5-functional-requirements)
- [6. Nonfunctional release targets](#6-nonfunctional-release-targets)
- [7. Critical acceptance journeys](#7-critical-acceptance-journeys)
- [8. Launch gates](#8-launch-gates)
- [9. Dependencies, assumptions and open decisions](#9-dependencies-assumptions-and-open-decisions)
- [10. Change control](#10-change-control)

## 1. Product intent

RISE is a personal daily-life app organized around salah. It helps users see the next prayer, choose a manageable next action, record effort honestly and make progress toward meaningful goals. Family coordination and squad encouragement are optional.

**User direction:** make the current app a real product while keeping its product, design and functionality the same; deliver mobile web first.

This is a productionization specification. The current app is the behavioral and visual baseline. The release adds the infrastructure and recovery states needed for real use, without replacing the four-tab structure, visual identity, core journeys or existing domain rules.

## 2. Users and jobs

| User/context | Job to be done | Successful outcome |
| --- | --- | --- |
| Adult balancing prayer, work and personal growth | See what matters now and take one manageable action | Clear next prayer and up to three priorities |
| User recovering from an incomplete day | Continue without losing honest history | Tiny action, correction and next-day plan remain available |
| User preparing for Fajr | Prepare a dated plan and understand reminder readiness | Saved plan, accurate next alert, honest delivery limits |
| Household member | Coordinate practical work with consenting adults | Assigned/repeating tasks and lists visible to actual members |
| Squad participant | Share a chosen reflection without exposing private history | Previewed snapshot published only to the chosen squad |
| User on intermittent mobile internet | Keep personal records and recover after reconnecting | Durable local actions, visible sync state, no silent overwrite |

The initial audience is adults. Child accounts, parental supervision and age-specific family controls are out of scope. The user confirmed **Uzbekistan and Kazakhstan** as the launch markets on 21 October 2026. Deployment region, market-specific operating obligations and public policies still require review before launch.

## 3. Scope and non-goals

### Included in web v1

All current core flows: onboarding, the four tabs, habits, full/tiny check-ins, timers, three priorities, milestone goals, Pip unlocks, personal rewards, progress and corrections, real/manual prayer times, Fajr preparation, prayer breaks, private pause, family tasks/lists, squad snapshots, membership controls, language/appearance settings and personal data controls.

Production foundations include guest use, optional accounts, cloud sync, safe migration, validated backup/restore, PWA installation/offline support, Web Push, access control, monitoring, support and recoverable deployment.

Existing simulated group features must become real before the complete release is declared. A gated personal pilot is permissible during development, but is not full scope completion.

### Excluded from this release

- App Store/Google Play publication and native-specific alarm integrations.
- Guaranteed wake-up, critical alerts, full-screen Clock alarms, forcing sound through Focus/mute, app blocking or background location tracking.
- Payments, Plus subscriptions, habit limits, ads, streak repairs or monetized prayer scores.
- New competitor features such as incremental quantity logging, flexible weekly quotas, widgets, wearables, AI coaching, Quran/audio libraries or public leaderboards.
- Public social discovery, direct messaging, public feeds, image uploads or automatic invitations to address-book contacts.
- A new visual direction, new mascot, new illustration system or rewritten navigation.

These exclusions do not remove existing full/tiny count and duration habits. They prevent expansion into a different product while the current one is made dependable.

## 4. Product parity contract

### PRD-01 — Preserve the experience

**Required:** preserve the four tabs and their responsibilities, current hierarchy, sheet navigation, focus/back behavior, light/dark appearance, Pip/trail assets, motion preferences and established copy tone.

| Surface | Required parity |
| --- | --- |
| Today | Prayer context first; three saved priorities; first unfinished habit expanded; completed priorities retained; two quiet reward cues; routine/family/goals disclosures |
| Journey | One eligible/next Pip unlock; Personal rewards; earned-first selection; full reward/history and trail access |
| Progress | Salah, Habits and Goals summaries; shared Monday–Sunday selector; current reward availability linked to Journey |
| You | Compact profile/collection entry; Prayer preferences, Family, Squads and Settings |
| Navigation | Normal tab changes retain each tab's position/state; explicit shortcuts focus the destination heading; opening a view changes no records |
| Recovery | Supportive, non-punitive language; smaller actions; honest corrections; missed days do not erase lifetime progress |

**Allowed supporting additions:** account/sync status, install guidance, offline/error/conflict states, invitation confirmation, privacy controls and security-sensitive confirmations using existing components. Remove simulation wording only when its behavior is implemented and verified.

**Acceptance:** compare equivalent real-data and baseline states at 375, 393 and 430 px, desktop, both appearances and 200% text. No unapproved visual/layout change; new required states follow the same tokens. Accessibility fixes may correct defects without changing the product's identity. Record intentional differences and their requirement IDs.

## 5. Functional requirements

### PRD-02 — Honest entry, onboarding and demo isolation

A new production visit begins with an empty personal profile and real date/time. Onboarding retains current habit setup and optional prayer setup. Account creation is not mandatory for personal local use.

Demo and reviewer controls run in a separate non-production origin/build. Production must not seed people, accomplishments, XP or timetables, and query parameters cannot turn on fixture replacement.

Existing local profiles migrate without reset. Because live prayer setup currently retains demo history, migration must not infer authenticity from `mode: fresh` alone. Detect known fixture signatures, show a dated import summary and retain ambiguous records locally until the user chooses what to carry forward. Never silently discard or upload mixed history.

**Acceptance:** new browser has zero activity; reload retains real progress; malformed legacy data offers recovery; demo URLs cannot mutate production data; converting a mixed profile preserves its original backup and explicitly chosen records only.

### PRD-03 — Account and session lifecycle

Guest users can use the personal app locally. An account is required for cloud sync, groups and server-scheduled Web Push. Explain the purpose at the relevant entry point without blocking the personal daily loop.

Proposed authentication is email one-time code through managed Auth. Support code request, resend with cooldown, expired/incorrect code recovery, sign-in/out, session expiration and account deletion. No user-visible password flow is required for v1.

Before first cloud upload, explain which private records are synchronized. Offer a summary and explicit import choice. Do not merge a guest profile into an unrelated existing account automatically. If both sides contain history, offer keep separate, import selected local records, or cancel; never replace the account wholesale.

“Remember this device” enables persistent account cache/offline access with a clear shared-device explanation. When off, account data is session-only and cleared at session end; a device-only guest profile stays separate.

**Acceptance:** account A cannot see account B's cache after logout/switch; repeated code submissions do not create duplicate profiles; remembered-device offline work is preserved through reauthentication; logout clears account cache/subscription while giving a choice to sync/export pending personal changes first.

**Implementation note, 22 October 2026:** local AUTH-01/AUTH-02 and SYNC-01 now support verified email-code sessions, relational owner/session RLS, explicit selected guest import, separate remembered account state/outboxes, session-only memory storage, captured dated intents, replay and bounded authorized snapshot pull. Signing in alone never uploads or relabels guest data. The original device profile remains intact. SYNC-02 adds semantic per-record conflict checks, independent merges, ordinary tombstones/removal barriers, bounded incremental changes and explicit full-snapshot stale-queue review. Original intent stays in a private recovery point; expired IDs are not silently repurposed. [Recovery contract](docs/SYNC-RECOVERY.md). Hosted delivery and physical-device acceptance remain release gates; DATA-04’s local account lifecycle is recorded under PRD-18. See [the sync contract](docs/ACCOUNT-SYNC.md).

### PRD-04 — Reliable local data and synchronization

Save personal actions atomically with their outbound operation. Show “Saved on this device”, “Syncing”, “Synced”, “Offline” and “Needs attention” according to actual state. “Synced” means server acknowledgment, not request initiation.

Support offline personal check-ins, corrections, goals, priorities, plans and saved settings after initial load for guests and remembered-device accounts. A session-only account keeps private state in memory and requires an online acknowledgment to report a save; if offline, offer to enable device retention or preserve/export the unsaved draft. Never promise durable offline storage in a mode that declined it. Shared writes may queue drafts/intent, but must remain visibly pending until current membership and server state are verified.

Use stable operation IDs and entity revisions. Replayed operations must not duplicate XP, tasks, reactions or rewards. Concurrent edits of the same record require the conflict behavior in the architecture; destructive corrections must never be silently overwritten.

**Acceptance:** loss of connection after server commit but before response causes no duplicate when retried; concurrent check/undo retains a resolvable conflict; storage exhaustion shows failure without false saved feedback; a stale device cannot resurrect deleted data or removed membership.

### PRD-05 — Habits and focus timer

Retain unlimited habits, names/icons/areas/reasons, check/count/duration types, full/tiny targets, weekday schedules, cues, optional reminders, archiving and dated history. The current habit flow exposes archived history but no restore action; do not silently add a new habit-restoration rule under a parity task.

Retain the existing rules:

- Full completion: 20 XP; tiny completion: 10 XP; at most 20 per scheduled occurrence.
- Tiny-to-full adds the remaining 10 XP. Duplicate taps and retries add nothing.
- Undo removes the entire occurrence's completion and XP, including an upgrade.
- Schedule/target edits take effect tomorrow for an existing habit. Materialized historical occurrences keep their snapshots.
- A newly created habit may be actionable today if scheduled.
- Timer start/pause/resume/exit does not record completion. Finishing a timer requires an explicit completion action.
- Current-week progress excludes future dates from its denominator.

**Acceptance:** the domain regression cases survive the persistence/server transition; an interrupted timer recovers elapsed state correctly; a timezone change does not duplicate an occurrence; long names and large text remain usable.

### PRD-06 — Three daily priorities

Preserve up to three ordered priorities drawn from scheduled habits, goal milestones and eligible family tasks. Completed selections remain until explicitly changed. Replacing or removing a priority does not complete, undo or delete the underlying item.

**Acceptance:** duplicate selections are rejected; a fourth selection offers replacement; completing a family task awards no habit XP; a removed group task is shown as unavailable without deleting the user's other priorities.

### PRD-07 — Goals and milestones

Preserve outcome/reason/target date, ordered milestones, linked habits, explicit completion/correction, pause and archive/restore. Habit check-ins never automatically complete a milestone.

**Acceptance:** completing all milestones updates the goal; undo reconciles goal/reward eligibility; selected-week movement is distinct from total progress; archiving preserves history and invalid references are explained.

### PRD-08 — Pip, Journey and personal rewards

Retain lifetime habit-XP thresholds at 100, 250, 500, 800 and 1,200; current artwork/collection; explicit claim/equip; earned-first presentation; no invented next threshold after the final unlock.

Retain personal rewards based on a named completed goal or a fixed week's check-in target, explicit enjoyment, feature-on-Today/Journey, correction history, archive/restore and a separate “Try next week” attempt.

Claims, equipment changes and reward enjoyment award no XP. A later missed day does not revoke earned progress. An explicit correction can reduce eligibility according to existing model rules; keep the explanation and correction history.

**Acceptance:** all tabs use the same derived eligibility; retries cannot double-claim; a new week does not silently change an existing reward's target week; reduced-motion/large-text trail remains usable.

### PRD-09 — Real prayer timetable

Keep offline Adhan calculation with coordinates, IANA timezone, calculation method, Asr convention, high-latitude rule and planned offsets. Retain presets, manual coordinates and user-requested geolocation. No automatic background location collection.

Show source, selected location/timezone, actual date, calculated start, planned target and window end. Fajr ends at sunrise in the existing model; Isha extends to the next date's Fajr. These are the app's tracking conventions, not a religious ruling. Users can choose a trusted date-specific manual timetable.

Refresh the existing rolling 30-day calculation coverage on startup/resume/settings change. Preserve previously checked entries and manual-date snapshots. Invalid/polar results must offer manual recovery, never sample substitutes. An unavailable or missing date cannot schedule an alert.

Travel or detected device-timezone change prompts a location/timezone review instead of silently rewriting history. Planned offsets do not change the astronomical start.

**Acceptance:** compare known reference cases for several cities/methods, DST transitions and a non-hour offset; calculate independently of host timezone; test date crossing and invalid coordinates; checked snapshots remain unchanged after location/method changes.

### PRD-10 — Prayer records and private pause

Keep five explicit dated records: on time, later or missed, with correction. A passed window without a record remains unconfirmed; time passing is not an automatic missed record.

Keep independent on-time streaks, cumulative milestones and accurate denominators. Prayer actions award no habit XP.

Private pause selects a starting date/prayer and a resumption point. Affected unrecorded prayers are excluded, existing records retained, streaks held without growth, and earlier unresolved gaps remain unresolved. Do not require a reason, health detail or cycle prediction.

Pause suppresses relevant RISE reminders. Sync pause data only as private account data after cloud consent. No family/squad member can request it or infer it through an explicit pause field. Optional aggregate sharing must warn that even a chosen total may reveal patterns.

**Acceptance:** pause/resume across midnight and multiple devices retains prior records; private fields never enter group payloads; offline pause immediately stops local delivery and clearly marks remote cancellation as pending until acknowledged.

### PRD-11 — Prayer, habit and Fajr notifications

**Current local implementation, 23 October 2026:** explicit subscription and primary-device consent, durable renewal, prayer/Fajr/habit eligibility, transactional cancellation, quiet hours, occurrence deduplication and encrypted dispatch are connected. Readiness requires a fresh sender heartbeat; receive-time authorization rejects stale or canceled events. A stopped sender reports staged coverage. Bounded seven-day receipt cleanup and a local 100-account/200-job fixture now pass, with due-to-submission p95 7.322 s using a synthetic 100 ms provider boundary. Hosted supervision/load acceptance and physical-device evidence remain open. [Retention and evidence limits](docs/PUSH-RETENTION.md). See [the current sender contract](docs/LIVE-PUSH-SENDER.md) and its linked increment evidence.

Delivery is optional and permission is requested only after an explicit action. Keep per-prayer preparation/due controls, preparation lead time, habit reminder preferences and Fajr's independent enable/backup controls.

The web release supports two honest modes:

| Mode | Contract |
| --- | --- |
| Foreground reminder | Works only while RISE is executing on an awake device |
| Web Push | Account + supported browser/installation + permission + subscription + a confirmed server schedule; best-effort delivery |

Web Push can receive server messages while a supported web app is not loaded, but platform delivery is outside RISE's control. [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) describes this mechanism. Never use a long-running service-worker timer as an alarm scheduler.

The existing dated Fajr plan retains bedtime, wake lead, phone placement, message and optional backup. “Stop this alert” stops the current in-app sound; it does not record prayer or necessarily cancel a planned backup. “I'm up” cancels remaining wake alerts for that date, without recording prayer/XP. Preview acknowledgment cannot affect live delivery.

Readiness must distinguish unsupported, install needed, permission needed/blocked, subscription missing, sync pending, scheduled through a named time, expired coverage and delivery error. A test alert confirms only that test's observable outcome. Server acceptance does not prove device display or wake-up.

Proposed web schedule coverage is seven days, refreshed while online; display the actual last queued time. Foreground and push paths deduplicate the same event on the same installation. A primary scheduling installation governs the account's prayer plan; changing it is explicit. Each receiving installation opts in.

Habit and group notifications follow their quiet hours. Prayer/Fajr alerts require a separate explicit choice to deliver during quiet hours; default is to suppress during quiet hours. If the next Fajr alert is suppressed, show that in readiness rather than “ready”.

No notification contains personal prayer status, pause information, habit names, reflections or work notes by default. Use generic copy; detailed content is an explicit per-device option with a lock-screen explanation.

**Acceptance:** test real iPhone Home Screen and Android browser/PWA flows; denied/revoked permissions; locked/background/offline devices; expired schedules; duplicate push; canceled/acknowledged backup; timezone changes; quiet hours and different devices. Late alerts expire instead of appearing as if timely. No claim of guaranteed wake-up.

### PRD-12 — Step away and return notes

Preserve preparation prompt, save-and-step-away, a private return note, optional single wrap-up minute and return-to-Today. A window expiring while a form is open changes available actions without losing the note.

This flow does not save external editor files, block other apps or automatically record prayer.

**Acceptance:** note survives reload after saving; unfinished drafts survive locally; an expired break offers honest prayer recording/recovery; the Today shortcut focuses Today even when entered from You.

### PRD-13 — Real family tasks and shared lists

Make the existing create/edit/assign/date/time/repeat/archive/restore task flows work across real members. Each recurring date has an independent completion with actor/time; Undo changes only that occurrence. Keep priority pinning.

Make list creation/rename, item add/edit/quantity/reorder/check/remove, archive/restore real shared actions. Server validation prevents references to other groups.

All active members can read and update family tasks/lists under v1's collaborative model; ownership administration is separate. Competing edits must retain a recoverable conflict rather than overwrite silently.

**Acceptance:** two accounts see accepted changes within the target sync interval; pending edits are labeled offline; a removed member's queued write is rejected; a completion/undo retry is idempotent; archive retains history.

### PRD-14 — Membership and invitations

Preserve create group, invite, accept, revoke, remove member, rename, transfer ownership, leave, archive/restore, mute and quiet hours.

An owner creates an expiring, revocable invitation link and chooses how to share it. RISE does not send unsolicited email or messages. Acceptance requires sign-in and an explicit confirmation naming the group. Invitation preview discloses only the minimum needed to identify it.

Exactly one active owner exists. Transfer is atomic and requires recent authentication; the last owner must transfer or explicitly delete the group before leaving/deleting the account. Archived groups are read-only until restored by the owner.

V1 defaults: invitations are single-use, expire after seven days and have high-entropy tokens; enforce configurable abuse limits without presenting them as a premium tier.

**Acceptance:** revoked/expired/consumed links cannot join; two concurrent acceptances consume a single-use link once; removed/left users lose future access immediately; old authorization tokens do not restore membership; an owner cannot orphan the group.

**GROUP-04 local implementation, 24 October 2026:** [optional generic group notices](docs/GROUP-NOTIFICATIONS.md) require separate default-off group opt-in and explicit device consent. Mandatory group quiet hours, bounded message/invitation controls, exact retry and current source/membership/session/suppression checks connect to the isolated sender. Removal, leave, archive, corrections and deletion cancel future eligible delivery. Physical-device and hosted acceptance remain pending.

### PRD-15 — Squad reflections and sharing

Preserve composition, optional habit count/milestone titles/prayer total, exact preview, explicit publication, reactions, edit/republish and withdrawal. Start sharing switches off on each new update.

Published content is a fixed snapshot of selected fields. Later private records cannot silently change it. Only the author edits their update; only the reacting member changes their reaction. Owners can remove abusive shared content through a minimal group-control action.

Omit individual prayer history, pause data, private habit names, coordinates and work notes. Authored free text can disclose anything the user types; explain that it is shared and allow review. Withdrawal removes active access, but cannot recall screenshots or copies already seen.

**Acceptance:** a member sees exactly the previewed payload; later check-ins do not change it; withdrawal and membership removal stop future fetches; cross-group IDs fail; no hidden private fields appear in network responses or logs.

### PRD-16 — Progress, history and reflection

Preserve Overview/Salah/Habits/Goals with one Monday–Sunday week selector, per-date details, history correction, prayer calendars, habit charts, milestones, lifetime statistics and optional weekly reflection.

Keep current-week denominators limited to elapsed days; empty/paused denominators show a meaningful empty state rather than zero-percent failure. The Journey reward count is current, independent of the selected week.

**Acceptance:** the same record produces matching Today/Progress/Journey results; opening summaries writes nothing; older weeks remain stable after schedule changes; reflection is optional and awards no XP.

### PRD-17 — Language, accessibility and responsive behavior

Retain English, Russian and Uzbek Latin. Finish untranslated Uzbek areas; do not remove a language. Translate errors, offline/conflict states, notification copy and accessible names, not just headings. Preserve user-authored text and stable domain IDs.

Target WCAG 2.2 AA with documented manual evidence; a target is not certification. Use semantic controls, visible focus, logical reading order, appropriate names, focus management, live save/error announcements and no color-only state. RISE's own touch-target target is 44 × 44 CSS px, larger than some WCAG minimums. Follow [W3C's criteria](https://www.w3.org/WAI/WCAG22/quickref/).

**Acceptance:** 320 px reflow; 375/393/430 primary phone widths; 200% text; keyboard/VoiceOver/TalkBack journeys; reduced motion; dark/light; software keyboard and safe areas. No clipped sheet header/exit control, lost draft or unreadable time value.

### PRD-18 — Export, restore, deletion and portability

Provide a versioned full private-data export with a sensitivity warning. Exclude credentials, session tokens, push endpoints, invitation secrets and other members' private data. Shared records are exportable only within the requester's current permissions, clearly separated from personal backup.

Restore validates schema, sizes, references, dates and enum values before mutation. Show counts/date range, duplicates and conflicts; take a pre-import snapshot; apply atomically; reject future/unknown schemas safely. Import never recreates real group membership from a backup or uploads fictional users.

“Clear this device” and “Delete account” are different actions. Clear local data does not imply cloud deletion. Account deletion requires recent authentication, ownership resolution, cancellation of alerts, revocation of sessions and a tracked purge. Describe backup-retention limits honestly.

**Acceptance:** exported personal records round-trip without changed XP or dates; malicious/oversized input changes nothing; revoked group data cannot be restored into live collaboration; deletion prevents stale-device resurrection.

**Local implementation, 22 October 2026 (DATA-04):** recent-auth private account export, deliberate same-owner email reauthentication, version-bound device cleanup and reviewed account deletion are implemented. Deletion atomically suppresses all sessions/JWTs and queues a separate restricted local service; exact retries return the terminal receipt. Populated historical rows cascade on primary purge, and authoritative ledger replay blocks restored identities. Full record files round-trip through validation; DATA-02 restores their current personal view into a device profile and explicitly explains retained history in the original file. Minimal suppression is retained for 35 days after confirmed primary purge to cover delayed deletion plus backup retention. [Protocol and local operation](docs/ACCOUNT-LIFECYCLE.md). Subscription and scheduled-job cleanup are integrated locally. Local group membership now supplies real last-owner transfer/deletion controls; family history, authored squad erasure and recipient/source notification cleanup extend the lifecycle hooks. GROUP-05 now adds a separate explicit current-member shared archive and locally verifies the combined ownership/deletion/cache/restore boundary. Its reviewed revision, recent authentication, closed projection and whole-file limits preserve the private format and prevent restored membership. [Contract](docs/GROUP-LIFECYCLE.md); [evidence](docs/evidence/group-lifecycle-2026-10-24/README.md). Hosted scheduling/backup expiry and physical-device certification remain separate gates; cloud provisioning is pending.

### PRD-19 — Settings and help

Retain name, language, appearance, reduced motion, sound/haptic preferences and grouped settings. Unsupported haptics/sound behavior must be explained or gracefully inactive; a saved preference is not proof of a device effect.

Add concise guidance for account/offline data, install, permissions, timezone and Fajr limitations in the existing Settings/help pattern. Keep “Your data” and private-pause access easy to find. Display app version and a functioning support route.

**Acceptance:** settings persist in their correct account/device scope; permission denial has a recovery path; revoked capabilities are rechecked on resume; no simulated “ready” state in production.

**Local implementation, 25 October 2026 (OPS-04):** Settings now supplies localized privacy/use notices, data-retention and recovery guidance, app release metadata, original dependency notices and the existing private project conversation as an interim support route. Dedicated public contacts, final launch policies, operating arrangements and rights approval remain pending. [Current policy boundary](docs/LAUNCH-POLICIES.md). Cloud provisioning remains pending.

### PRD-20 — Operability and product measurement

Provide real health/error monitoring, audit events for membership/security changes, privacy-conscious diagnostics, tested backups and rollback. Define operational ownership before opening public access.

Collect no advertising IDs, session replay, free text, coordinates, prayer records or pause data in analytics. Product measurement is optional and consent-based; operational metrics use redaction and short retention.

Proposed product measures are activation (first saved personal action), week-one return, successful recoveries and completion of intended user journeys. Report actual pilot evidence; do not invent retention or demand targets without a baseline. Prayer compliance or frequency is not an optimization metric.

**Acceptance:** operational dashboards can detect sync failure and notification backlog without exposing personal content; crash/error reports contain no profile payloads; support can diagnose with a redacted report the user chooses to share.

**Local operations recovery, 24 October 2026 (OPS-02):** encrypted server recovery points, 30-day expiry, scheduled-while-running maintenance and backup freshness alerts now exist. A real networkless PostgreSQL drill verifies deletion/revocation replay, unchanged-group recovery, preserved habit XP and authorization. It requires current source authority and withholds changed groups; it never reopens access. Continuous cadence, off-site custody, lost-source recovery and full hosted RPO/RTO remain unaccepted. [Contract and local limits](docs/SERVER-BACKUP-RECOVERY.md); [evidence](docs/evidence/backup-recovery-2026-10-24/README.md). Cloud provisioning remains pending.

**Local rollout, 24–25 October 2026 (OPS-03):** immutable local packages, compatibility admission, real readiness probes, protected configuration, write pause and compatible backend/frontend/worker rollback are now verified locally. Real-session/pending-outbox acceptance passes in three browser engines. The current gate refuses schema/storage changes; hosted rollout and operational supervision remain unaccepted. [Runbook](docs/LOCAL-ROLLOUT.md); [evidence](docs/evidence/local-rollout-2026-10-24/README.md). Cloud provisioning remains pending.

## 6. Nonfunctional release targets

Targets below are proposed engineering gates, not measured current performance.

| ID | Target | Verification |
| --- | --- | --- |
| NFR-01 | Mobile p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | Representative Android/iPhone lab runs before launch; privacy-safe field data when sufficient |
| NFR-02 | Local action feedback ≤ 100 ms; durable local commit p95 ≤ 250 ms on test devices | Instrument check-in, undo and drafts; failure cannot be shown as saved |
| NFR-03 | Accepted online mutation p95 ≤ 1 s; shared convergence ≤ 15 s while foreground/online | Defined 100-concurrent-user staging workload, 100 active habits and two years' history per synthetic profile |
| NFR-04 | API monthly availability target 99.9%; backup RPO ≤ 24 h, RTO ≤ 4 h | Synthetic monitoring; documented isolated restore; measure before claiming achievement |
| NFR-05 | Scheduler claim-to-provider submission p95 ≤ 30 s after due time under agreed load | Queue metrics; separate provider acceptance from end-device delivery |
| NFR-06 | Zero known exploitable critical/high findings; all ownership/isolation negative tests pass | Security review and authenticated integration tests |
| NFR-07 | No silent personal-data loss in migration, retry, storage failure, conflict or rollback scenarios | Fault injection, round-trip and multi-device tests |
| NFR-08 | Full required journeys across supported browser modes and languages | Recorded matrix, screenshots and physical-device evidence |

Support the current and previous major iOS Safari releases at release freeze, including Home Screen mode, and current/previous Chrome on supported Android devices. Record actual versions/devices in release evidence. Web Push eligibility is capability-detected; older/unsupported clients retain personal features and an honest fallback. Desktop Chrome/Safari/Firefox receive responsive smoke coverage; tablets must remain usable.

Performance work must preserve the visual baseline. Code splitting is preferable to removing features or reducing accessibility.

## 7. Critical acceptance journeys

| Journey | Start → finish | Required failure variants |
| --- | --- | --- |
| A — Personal first day | Empty profile → habit → tiny → full → reload → Undo | Storage denial, offline, double tap |
| B — Existing profile | Legacy data → backup → migrate → reload → optional cloud import | Mixed demo history, corrupt schema, interrupted migration |
| C — Prayer day | Location → method → real timetable → prepare → record → history | DST, polar failure, manual date, travel |
| D — Fajr | Dated plan → opt-in → real schedule → alert → “I'm up” | Permission blocked, coverage expired, delayed push, backup race |
| E — Difficult day | Unconfirmed prayer → honest correction → tiny action → next day | Expired work break, pause and resume, no automatic records |
| F — Two devices | Local change → reconnect → server receipt → second device | Conflict, lost acknowledgment, stale delete, expired session |
| G — Family | Invite → actual acceptance → assign → check → Undo | Cross-group request, revoke, concurrent edits, ownership transfer |
| H — Squad | Compose → opt-in fields → preview → publish → withdraw | Private-field injection, stale membership, free-text review |
| I — Data lifecycle | Export → validated restore → logout → account deletion | Import rollback, account switch, backup restore after deletion |
| J — Accessibility | Four tabs and long forms with screen reader/large text | Software keyboard, focus restoration, reduced motion, all languages |

## 8. Launch gates

The complete public release requires every PRD-01–20 requirement and NFR gate to have evidence or an explicit product-owner-approved scope revision.

1. Visual baseline/parity matrix approved for the implementation.
2. All personal journeys work with durable real data and an empty new profile.
3. Authenticated account and group isolation verified with hostile requests.
4. Migration/export/restore, conflict and deletion tests pass.
5. PWA/offline and real-device push capability verified on the supported matrix.
6. No simulation remains presented as real functionality.
7. Localization/accessibility/performance checks meet the agreed targets.
8. Restore/rollback exercise succeeds; contacts, ownership, privacy/terms and distribution rights are recorded.

Native build status is not a gate for this web release. Guaranteed wake-up is not a web v1 promise. If that promise becomes essential, it requires a separate native scope decision.

## 9. Dependencies, assumptions and open decisions

| Decision | Proposed default | Needed before |
| --- | --- | --- |
| Backend | Same-origin TypeScript backend + Supabase Auth/Postgres | Infrastructure implementation |
| Hosting and region | Managed HTTPS hosting near the selected database region | Staging/prod provisioning |
| Initial users | Adults, invitation-led pilot | Public policies and acquisition |
| Language scope | English, Russian, Uzbek Latin | Release verification |
| Monetization | No billing in v1 | Any pricing or entitlement work |
| Offline account cache | Explicit remembered-device choice | Identity implementation |
| Notifications | Generic content, per-device consent, seven-day schedule | Push implementation |
| Operating owners and contacts | Named product/engineering/security responsibilities | Public pilot |
| Launch markets and legal basis | Uzbekistan and Kazakhstan confirmed; review obligations for the actual deployment/audience | Public launch |
| Public domain | `habit.saraftech.com`, owned but not yet configured | DNS/TLS and staging/production setup |
| Capacity and expense ceiling | USD 100/month ceiling confirmed; validate the proposed test load and itemized provider costs | Hosting commitment |

These are actionable decisions with owners/tasks in [TASKS.md](TASKS.md). Confirmed user inputs and remaining provider, region, sender and ownership details are recorded in [the infrastructure decision record](docs/INFRASTRUCTURE-DECISIONS.md). This table does not authorize a vendor purchase or public deployment by itself.

## 10. Change control

Changes to the existing product, release scope, privacy model or promised notification behavior must update this PRD, architecture and task dependencies together. Ordinary implementation choices within these requirements do not require repeated product approval.

Preserve stable IDs and add a dated change note. A requirement is complete only with working behavior and recorded evidence; mock screenshots, generated native folders and written documentation are not substitutes.

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-21 | 1.0 | Established production mobile-web scope, incumbent parity, explicit current/target separation and release gates |


**PUSH-04 local habit increment, 23 October 2026:** explicit device consent now enables generic, silent foreground habit reminders. Dated versions/snapshots, completion/archive cancellation and mandatory habit quiet hours feed the local staged account plan; no XP/history rewrite, database migration or cloud provisioning occurs. The existing two-minute local expiry remains until a coordinated live-delivery change. The later [local sender](docs/LIVE-PUSH-SENDER.md) adds background dispatch; physical-device acceptance remains pending. [Behavior, privacy, recovery and limits](docs/HABIT-REMINDERS.md).
