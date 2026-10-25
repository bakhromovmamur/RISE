# DATA-03 — Durable commands for personal journeys

**Date:** 21 October 2026  
**Scope:** DATA-03; PRD-05–08, PRD-12, PRD-16 and PRD-19.  
**Status:** Complete; all required local gates passed.

## Delivered behavior

Routine personal journey edits now enter through `DeviceSession.dispatch` and the validated local command repository. A command captures one operation ID, expected revision, civil date, IANA timezone and absolute action instant. Entity IDs are supplied once when creating a habit, goal, reward, retry attempt or prayer pause. The same envelope survives a failed write and retry. The profile and its command receipt commit together in a strict IndexedDB transaction; no sender uploads the local outbox.

Screens retain the current markup, CSS, text, navigation and domain calculations. Progress still derives from recorded activity. Full/tiny/upgrade/Undo retain the 20/10/20 XP rules; non-habit actions do not award habit XP. A timer completion clears the timer and records its explicit check-in in one transaction. Habit target/schedule edits still start tomorrow, historical occurrences remain, and reward conditions stay tied to their original goal or week.

Save toasts and inline form confirmations wait for the durable session to finish. A failed write stops editing, retains the previous committed profile and exposes the existing retry/unsaved export/reload recovery controls. Notification scheduling waits for committed preferences. These guarantees concern transaction completion; an optimistic edit lost before acknowledgment is not a successful save.

### Coverage by flow

| Flow | Durable intents and preserved behavior |
| --- | --- |
| Habits | Create/edit, new/edit drafts, archive, full/tiny/upgrade/Undo and explicit history correction; stable IDs and next-day versions |
| Focus timer | Start, pause, resume, end without XP, and atomic explicit completion; persisted elapsed time and original date |
| Priorities | Initial selection, replacement/reordering and family-task pin/unpin; at most three ordered choices, retained completed/unavailable historical choices |
| Goals and rewards | Goal editing/milestones/status, reward editing/enjoy/archive/feature/retry, collection claim/equip; correction and fixed-week semantics |
| Reflections and onboarding | Incomplete drafts are separate from submitted records; submission clears its draft in the same command; onboarding creates selected habits once |
| Settings | Name, appearance, preferences and language, preserving authored text and unrelated records |
| Prayer and return notes | Setup, manual timetable submission, reminders, pause/resume, explicit records, dated Fajr plans/acknowledgment/preview, return notes/stage/wrap-up and calendar refresh |

The existing shared family/squad simulations and isolated review controls retain the revisioned compatibility setter. They are still local simulations. Personal priority changes inside those screens use commands. The draft helper also saves existing shared-form drafts locally; that does not authorize shared publication or create membership.

## Data and compatibility

Database version **1**, repository formats **1/2**, domain schema **4** and private backup version **1** remain unchanged. There is no destructive migration or profile reset. The exact legacy `rise.local.v1` source remains until the user's existing explicit clear action.

Older local command receipts without captured context remain readable. New receipts use additional command kinds and optional context; older builds reject unknown receipts rather than overwriting them. After saving DATA-03 commands, application rollback requires assets that understand these receipts. Preserve the raw recovery archive before attempting manual recovery with an incompatible application.

Known personal drafts now include habit editing, goals, rewards, reflections, ordered priorities and onboarding. Existing prayer/shared drafts retain their prior format. New draft shapes are validated independently of completed records, so unfinished forms do not fabricate activity. Portable backups include the current supported drafts. Unsupported saved drafts remain in the original/raw recovery paths; merely opening a form does not overwrite them.

Local receipts contain private intent payloads, potentially including earlier draft revisions, notes, prayer/pause details and location settings. They stay cloud-ineligible and have no automatic pruning. Portable backups exclude receipt history; raw archives retain it. Explicit clearing removes local receipts. Server authorization, retention/compaction and authorized cloud projections remain separate work.

## Verification

| Command | Final result |
| --- | --- |
| `npm run check` | Passed: 104 unit/domain/tooling tests, lint/types, production and review builds |
| `npm run test:browser` | 297 passed in Chromium, WebKit and Firefox; no skipped, flaky or failed cases |
| `npm run test:production` | 27 passed in those three engines, including unfinished onboarding reload and schema 1–4 preservation |
| `npm run test:visual` | 48 variants / 720 exact screenshots matched; threshold 0, maxDiffPixels 0, no golden updates |
| Final production and review output | Built directly in the project by `npm run check`; both build manifests are recorded in `builds.json` |

See [verification metadata](verification.json), [check log](check.log), [browser report](browser-report.json), [production report](production-report.json), [visual report](visual-report.json). The visual matrix covers English, Russian and Uzbek; light/dark; 375/393/430/1440 px; and 100%/200% text. Existing browser cases also cover 320 px reflow. CSS, artwork, design authority and all 720 reference images are unchanged.

Meaningful new checks are in `tests/personal-commands.test.ts` and `tests/personal-commands.browser.spec.ts`. The production onboarding journey now reloads an unfinished plan before submitting it. Existing browser assertions were retained.

| Acceptance / failure case | Evidence |
| --- | --- |
| Full/tiny/upgrade/Undo, next-day edits, archive/history and rollover | Existing domain, balanced, Russian, recovery and production journeys; captured-date unit case |
| Stable IDs and ordered retry after an outbox failure | Real IndexedDB session queues a habit and tiny check; injected `QuotaExceededError` rolls back both profile/receipt writes; retry writes once in order |
| Commit succeeds but response is lost | A real transaction commits, then its wrapper throws; the same operation replays once; altered content under the same ID is rejected |
| Concurrent tabs | Two sessions submit at the same revision; one succeeds, the other retains its pending snapshot through retry until explicit reload |
| Goals, rewards and corrections | Full goal/reward browser journey; direct storage validation of new goals; fixed-week retry and no-extra-XP unit coverage |
| Draft recovery | Goal draft survives reload without creating a goal; explicit submission creates one goal and clears its draft; production onboarding survives reload before submission |
| Timer recovery | Persisted pause survives session close/reopen; resume and explicit completion add exactly 20 XP and clear the timer in the same operation |
| Save acknowledgment | A real IndexedDB readwrite lock delays a Fajr save; the UI stays in saving state without its saved confirmation until the blocked transaction commits |
| Settings and source preservation | Actual settings UI writes command receipts; exact synthetic legacy source remains unchanged |
| Historical priorities / return notes | Unavailable selected priorities remain until explicit removal; a reminder preview can retain a work note without requiring a configured timetable |
| Backup/migration regressions | Existing schema 1–4, failure/rollback, multi-tab, raw archive and two-year/100-habit round-trip suites remain in the complete runs |

### Defects caught during implementation

The first complete journey run reported 12 failures across four goal-related scenarios in three engines; 282 other cases passed. New goal objects contained optional dates explicitly set to `undefined`. Optimistic JSON normalization hid that value, while direct transaction validation correctly rejected it. Optional properties are now omitted when absent, and a unit assertion checks the directly storable command result. The original browser assertions are rerun unchanged. See [the initial report](browser-initial.json) and [log](browser-initial.log).

Focused review also retained the previous ability to begin a reminder-preview return note before timetable setup, and protected selected historical priorities from being silently filtered. Both have regression coverage. Final review aligned the four explicit prayer/Fajr form confirmations with the saved session; a real transaction-lock browser test covers the waiting and committed states. The full suites were rerun after that final adjustment. Test fixtures used in direct state-validation assertions are parsed as stored JSON, matching real migration rather than passing undefined fixture-only fields to the adapter.

## Environment and reproducibility

- macOS 26.6.2 (25G83), arm64; Node.js 24.16.0; npm 11.13.0; Playwright 1.64.1. Launched engines: Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0.
- Only synthetic contexts on `127.0.0.1:4180`, `:4181` and `:4182`; the personal profile on **4173 was not opened or modified**.
- Browser fixtures block external requests. No hosting, account, database service or messaging operation was performed.
- No Git repository was available. [Before hashes](before.json), [after hashes](after.json), [change inventory](changes.json) and [build hashes](builds.json) provide the comparison.
- macOS iCloud offloaded source/dependency files during the work. The folder was requested for download and set to Keep Downloaded. No source files were reset or replaced to repair this.
- Earlier verification used a temporary local copy with `npm ci --offline` and the unchanged package/lockfile. Cached original bytes were used only for offloaded files whose size and nanosecond modification time matched the before snapshot. Once files were available, all **839** application/test/configuration/asset inputs were independently hashed against the project with **zero mismatches**. The final check, full browser, production and visual suites then all ran directly in the rehydrated project folder after the last code adjustment. [Verification inputs](verification-inputs.json) and [build hashes](builds.json) record those final files. Dependencies, lockfile and test gates were not changed.
- The source snapshot location is recorded in [source-snapshot.txt](source-snapshot.txt). The temporary verification path and test details are retained in the machine-readable report.

## Remaining gates

This is local persistence and command integration, not cloud sync or a production release. Physical iPhone/Android behavior, filesystem power-loss durability, app-shell offline installation, authenticated collaboration, remote push, server authorization/deletion replay and hosting remain unverified. The pre-existing large JavaScript chunk warning remains; performance/device budgets are separate quality gates. PRAY-01 is the next ordered task.
