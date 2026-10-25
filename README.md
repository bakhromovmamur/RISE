# RISE — Daily life around salah

**Local completion review, 25 October 2026:** the IndexedDB acknowledgment race is fixed, redundant validation/cloning is reduced, failed release-build cleanup is repaired, and a read-only pre-push publication check is available. Final verification and remaining limits are recorded in [the local evidence](docs/evidence/local-completion-2026-10-25/README.md). QUALITY-03 and RELEASE-01 remain IN PROGRESS: desktop save and account capacity targets are unmet; three Firefox group-suite timeouts remain unexplained; the threaded runtime experiment was not adopted. Cloud provisioning remains pending. [Local handoff and later server prerequisites](docs/LOCAL-READINESS.md).

**Local sign-in and test-queue follow-up, 25 October 2026:** identity refresh ordering, provider quota-lock contention, stale email-template mounts and sender-test isolation are corrected locally. All 270 remaining browser cases pass; design, functionality and saved-data preservation checks are recorded in [the evidence](docs/evidence/signin-queue-2026-10-25/README.md). RELEASE-01 remains IN PROGRESS for the consented pilot, performance and other release gates. [Pilot protocol](docs/RELEASE-PILOT.md). Cloud provisioning remains pending.

**Local help and policies, 25 October 2026:** OPS-04 adds Settings → Help & policies in English, Russian and Uzbek Latin, with privacy/use notices, deletion/retention guidance, support diagnostics and original third-party notices. Public policies, named contacts, operating entity/provider arrangements and app/artwork rights approval remain pending. The confirmed markets remain Uzbekistan and Kazakhstan. [Local contract and launch gates](docs/LAUNCH-POLICIES.md); [verification evidence](docs/evidence/launch-policies-2026-10-25/README.md). Cloud provisioning remains pending.

**Local backup recovery, 24 October 2026:** OPS-02 adds encrypted 30-day server backups, retention/purge commands, backup freshness alerts and a networkless disposable restore drill with deletion/revocation reconciliation. Current data and the interface remain unchanged. [Commands and recovery limits](docs/SERVER-BACKUP-RECOVERY.md); [local evidence](docs/evidence/backup-recovery-2026-10-24/README.md). Always-on supervision, off-site custody, lost-source recovery, hosted recovery/reopening and cloud provisioning remain pending.

**Local operations, 24 October 2026:** OPS-01 adds redacted release/latency/error signals, a restricted read-only queue monitor and a tested private local alert route. Settings now offers an explicit diagnostic download containing only technical save/sync status. Product analytics stay off. [Local commands, support and incident procedure](docs/LOCAL-OPERATIONS.md); [verification evidence](docs/evidence/operations-2026-10-24/README.md). Named incident owners, a dedicated contact, hosted monitoring and cloud provisioning remain pending.

**Local security, 24 October 2026:** the BFF now enforces a tested browser resource/script/framing policy and limits unused browser capabilities. Policy changes enter the PWA release fingerprint and use the existing safe update flow; personal storage and the interface remain unchanged. [Contract and rollout limits](docs/LOCAL-SECURITY.md); [integrated verification evidence](docs/evidence/security-2026-10-24/README.md). Hosted HTTPS/HSTS, physical-device and operational acceptance remain pending. Cloud provisioning stays pending.

**Local background sender, 23 October 2026:** consented prayer/Fajr/habit jobs now use the isolated encrypted sender. Readiness follows its live heartbeat; the receiving worker checks current server authorization before presentation, including cancellation after provider acceptance. Design and saved-profile formats are preserved. Bounded queue/receipt cleanup and a local 200-job load check are implemented; hosted operation/load acceptance and physical HTTPS-device evidence remain pending. Cloud provisioning stays pending. See [local live-sender integration](docs/LIVE-PUSH-SENDER.md).

**Groups, 24 October 2026:** account-selected group creation, explicit nickname/join consent, invitation links, membership/ownership controls and durable retry recovery connect to the verified local/test backend. GROUP-02 now connects real task/list screens, dated completion/Undo, private priorities and durable conflict recovery to the local/test API. GROUP-03 now connects exact server previews, publication, author edits, encouragement, withdrawal and owner removal; its local acceptance checks pass ([evidence](docs/evidence/squad-snapshots-2026-10-24/README.md)). Owner invitation history now uses [bounded pages and retention limits](docs/GROUP-INVITATIONS.md). Optional generic group notifications now connect explicit group opt-in, separate device consent, mandatory quiet hours, bounded jobs and current-source authorization in the local/test implementation. [Local notification acceptance](docs/evidence/group-notifications-2026-10-24/README.md) passes across the database, three browser engines and unchanged visual references. See [group notifications](docs/GROUP-NOTIFICATIONS.md) and [the snapshot boundary](docs/SQUAD-SNAPSHOTS.md). [Membership boundary](docs/GROUP-MEMBERSHIP.md), [membership browser evidence](docs/evidence/group-ui-2026-10-23/README.md) and [shared-content contract](docs/SHARED-CONTENT.md) and [local task/list acceptance](docs/evidence/shared-content-ui-2026-10-23/README.md).

**Release target:** production mobile web, with an installable Progressive Web App (PWA).  
**Planning baseline:** 21 October 2026 · documentation v1.0.  
**Current maturity:** a local app under production development, with empty personal entry, real prayer calculations, durable guest storage, email-code sessions, owner/session RLS and consented account import/synchronization. Remembered accounts have separate durable caches/outboxes; session-only accounts keep private data in memory. Hosted environments and Web Push are not deployed.

RISE helps adult Muslims organize manageable commitments around five daily prayers. **Today, Journey, Progress and You** connect habits, three daily priorities, goals, personal rewards, family planning and optional squad reflections.

Production work must retain the current product, visual design and interaction behavior. It replaces simulations with real persistence and authorized collaboration, adds supporting account/offline/error states, and verifies the result on mobile browsers. It is not a redesign.

**PUSH-01, local:** per-installation permission, encrypted subscriptions, generic privacy defaults, revocation and background-test processing are implemented. Explicit plans and a running local sender now support reminder dispatch; see the current integration note above. [Setup, security and device limits](docs/PUSH-SUBSCRIPTIONS.md).

**DATA-04, local:** the account sheet now separates private export, device cleanup and permanent deletion. A separate cleanup service performs the tracked purge; cloud provisioning stays pending. [Setup, retention and recovery](docs/ACCOUNT-LIFECYCLE.md).

**GROUP-05, local:** Group settings now offer a separate shared archive after recent authentication and explicit review. Current membership and the reviewed revision protect every page; private backup/cache formats remain unchanged. Combined deletion and stale-cache/server-backup replay are locally verified. [Contract](docs/GROUP-LIFECYCLE.md); [acceptance evidence](docs/evidence/group-lifecycle-2026-10-24/README.md). Hosted backup operations and physical-device acceptance remain pending.

## Documentation map

| Document | Purpose | Authority |
| --- | --- | --- |
| [PRD.md](PRD.md) | Scope, feature requirements, parity and acceptance criteria | What the product must do |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current code, target modules, data, synchronization and delivery | How the production system will work |
| [SECURITY.md](SECURITY.md) | Sensitive data, permissions, threat model and controls | Security and privacy requirements |
| [TASKS.md](TASKS.md) | Ordered backlog, dependencies and evidence gates | Execution status |
| [AGENTS.md](AGENTS.md) | Instructions for coding agents and maintainers | How to change this repository |
| [DESIGN.md](DESIGN.md), [.impeccable/design.json](.impeccable/design.json) | Existing visual system and tokens | Preserve the incumbent interface |
| [PRODUCT.md](PRODUCT.md) | Detailed implementation snapshot | Current behavior, not production promises |
| [VERIFICATION.md](VERIFICATION.md) | Dated test and review records | Evidence for the recorded versions and scopes |

The original [BRIEF.md](BRIEF.md) describes an earlier prototype commission. Its prototype-only limit and retired Plus concepts do not define the new release. This documentation set supersedes those scope statements while preserving historical evidence.

## Current capability versus release requirement

| Area | Current repository | Production requirement |
| --- | --- | --- |
| Interface | Four tabs, sheets, habits, priorities, goals, Pip, rewards and recovery | Same design and domain behavior on mobile browsers |
| Personal data | IndexedDB version 1, validated personal commands, atomic saves, versioned backup, previewed restore and rollback | Optional account sync and device release verification |
| Account backend | Local sessions/RLS, selected import, durable account outboxes, independent merges, conflict review, tombstones, stale-device recovery and account lifecycle | Hosted/physical-device acceptance and scheduled operations |
| First browser launch | Empty real profile; fixtures restricted to isolated review builds | Preserve empty entry and demo isolation |
| Prayer times and records | Offline Adhan calculation, manual dates, UTC-aware history/streaks, private pause and dated Fajr plans/drafts | Preserve behavior; complete sync and physical-device verification |
| Prayer/Fajr alerts | Existing foreground timers; account-bound Web Push subscription/privacy, tests, local renewal, live sender and per-device readiness | Opt-in Web Push, durable scheduling, cancellation and honest readiness |
| PWA | Manifest/icons, public offline shell, explicit safe updates and storage protection | Physical iPhone/Android installation and HTTPS release evidence |
| Habit reminders | Explicit device consent, foreground delivery, quiet hours, cancellation, and local background dispatch | Hosted/physical-device acceptance |
| Family/squads | Local/test membership, shared tasks/lists, private priorities, exact squad snapshots, optional generic notifications, explicit shared archives and verified integrated lifecycle; original simulations retained separately | Hosted operations and physical-device acceptance |
| Languages | English, Russian and complete audited Uzbek catalogs; local language/parity acceptance passes ([evidence](docs/evidence/localization-2026-10-24/README.md)) | Complete reviewed English, Russian and Uzbek Latin |
| Accessibility | Keyboard disclosure order, focus restoration, short-viewport field visibility and 44 px priority/weekday/recovery targets have focused three-engine checks ([matrix](docs/MOBILE-ACCESSIBILITY.md)) | Physical VoiceOver/TalkBack, phone keyboards/safe areas and release-browser acceptance |
| Native | Generated Capacitor shells and local notification adapters | Preserve for later; no native store release in this milestone |
| Operations | Local BFF, isolated Postgres/Auth, redacted monitoring, encrypted recovery drills and sealed rollout/rollback | Hosted environments, HTTPS, supervised operations, off-site recovery and release acceptance |

**A real web product does not imply a guaranteed alarm.** Fajr planning and acknowledgment remain. Web alerts are best-effort notifications subject to connectivity, permissions and system settings. On iPhone, Web Push requires a Home Screen web app and a permission request from a user action. See [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [the delivery design](ARCHITECTURE.md#9-notification-delivery).

## Run the current implementation

Use the pinned **Node.js 24.16.0** and **npm 11.13.0** toolchain. `.nvmrc`, package engines and `.npmrc` enforce the runtime; direct dependencies use exact versions and `package-lock.json` fixes transitive resolution. If you use nvm, run `nvm install` and `nvm use` in this folder first.

~~~sh
npm ci
npm run dev -- --port 5173
~~~

Open [the development app](http://localhost:5173/). To inspect the built bundle:

~~~sh
npm run build
npm run preview -- --port 4173
~~~

Open [the local preview](http://localhost:4173/). New storage starts empty with the real device calendar. Existing saved profiles remain available. Serve `dist/` over HTTP, not as a local HTML file. The frontend requires no cloud account or API key. Vite preview is for local inspection, not production hosting.

A phone accessing an ordinary HTTP LAN address may render the interface but cannot validate features requiring a secure context. Use the future HTTPS staging origin for device install, geolocation and notification checks.

### Isolated design and scenario review

~~~sh
npm run build:review
npm run preview:review
~~~

Open [the review build](http://localhost:4174/?review=1). It retains the existing fictional fixtures, simulated clock and design-system viewer. Its runtime guard only permits loopback ports 4174, 4180 and 4182; it refuses the personal-preview origin on 4173 and public/LAN origins before loading state. `npm run dev:review` provides the same tools in development on 4174.

`dist/` is the production entry; `dist-review/` is review tooling. The production build fails if review modules enter its bundle. `?review`, `?design`, `?text` and fixture query parameters cannot enable these tools in production. Historical walkthroughs that put review parameters on 4173 predate this split; use 4174 for those rehearsals now. Both builds retain the same application screens and styles.

### Available commands

| Command | Actual behavior |
| --- | --- |
| `npm run dev` | Starts Vite development |
| `npm run check:notices` | Verifies pinned browser dependency versions and original license/copyright notices; included in `check` |
| `npm run build` | TypeScript checks and production `dist/` build, with review-module exclusion and verified PWA asset manifest |
| `npm run build:review` | Isolated scenario/design build in `dist-review/` |
| `npm run dev:review` / `npm run preview:review` | Review development / built preview on loopback port 4174 |
| `npm run preview` | Serves the built web bundle locally |
| `npm test` | Domain tests through tsx and Node's test runner |
| `npm run test:browser` | Existing journeys against the review build in three browser engines |
| `npm run test:production` | Empty entry, real onboarding, legacy-profile preservation and recovery against the production build |
| `npm run test:pwa` | Real service-worker install/offline/update/storage-failure checks against isolated production build versions |
| `npm run check:toolchain` | Verifies Node/npm, exact dependency pins and lockfile agreement |
| `npm run check:docs` | Checks current-document local links/anchors, task metadata/dependencies and PRD mappings |
| `npm run check:publication` | Read-only pre-push candidate/index checks for private/generated paths, known local secrets and signing material; rerun after staging. [Scope and limits](docs/LOCAL-READINESS.md) |
| `npm run check:push-load` | Fixed test DB, 100 synthetic accounts/200 due reminders; injected provider boundary, no external push. Run separately from other DB suites. |
| `node --import tsx scripts/infra/check-account-load.ts smoke` / `full` | Opt-in fixed test DB capacity diagnostic: 1/100 synthetic accounts, each with 100 habits and 730 dates. Run alone; full mode requires 12 GiB free host disk. [Workload and cleanup](docs/PERFORMANCE.md). |
| `node --import tsx scripts/infra/check-account-load.ts mixed-smoke` / `mixed` | Opt-in mixed diagnostic: 2/100 accounts, 1/50 joined synthetic families, scheduled personal/shared mutations and 15-second foreground refresh. Run alone; `mixed` requires 12 GiB free host disk. [Results and cleanup](docs/PERFORMANCE.md#account-mixed-diagnostic). |
| `npx playwright test --config playwright.performance.config.ts` | Opt-in 100-habit/two-year real IndexedDB measurements on 4180, one engine at a time; run alone after building. [Scope and remaining targets](docs/PERFORMANCE.md). |
| `npx playwright test --config playwright.performance-production.config.ts` | Opt-in dense-profile Today feedback measurements on the production build at 4181; run separately from production-entry/PWA suites. |
| `npm run lint` | Oxlint correctness checks without automatic formatting |
| `npm run typecheck` | Type-checks the app, tests and configuration |
| `npm run check` | Toolchain, lint, type, domain/tooling tests and both build variants |
| `npm run test:visual` | Compares 720 screenshots with the frozen macOS/Chromium baseline |
| `npm run test:visual:update` | Explicitly replaces visual references after an accepted design change |
| `npm run build:native` | Web build plus Capacitor asset/configuration sync |
| `npm run open:ios` / `npm run open:android` | Opens native projects if the required IDE is installed |
| `npm run infra:up -- local` / `-- test` | Starts only that isolated Docker database/Auth stack, applies additive migrations and creates protected runtime configuration |
| `npm run infra:verify -- local` / `-- test` | Checks actual database identity, BFF privileges, Auth health and loopback bindings |
| `npm run infra:stop -- local` / `-- test` | Stops only that stack, retaining credentials and volumes |
| `npm run server:start` | Starts the same-origin BFF when its required environment is supplied |
| `npm run server:local` | Starts the retained local installation on browser-compatible loopback port 4192; no browser-data transfer |
| `npm run ops:check -- local` / `ops:watch -- local` | Read-only local health/queue checks and bounded private file alerts; no sender or cloud activation |
| `npm run ops:drill -- test` | Raises and resolves a synthetic alert through the private local route; sends no message |
| `npm run check:local-browser` | Checks local entry, worker reload and anonymous API denial in three fresh contexts on 4192; no fixtures or account writes |
| `npm run test:infra` | Real local/test isolation, sessions, personal RLS/commands, concurrency, replay and rollback checks; requires both stacks |
| `npm run test:backend` | Production app/offline entry through the real BFF on isolated 4191 in three engines |
| `npm run test:auth` | Real local email-code sessions, account switching, guest preservation and mobile account forms in three engines; requires the test stack and reserves 4191 |
| `npm run test:sync` | Consented import, two-device convergence, offline/replay/reauthentication/cache isolation, transactional failure and localized consent layouts; reserves 4191 |
| `npm run test:groups` | Real membership, tasks/lists, squads, optional notifications, shared export/deletion, lost replies, account boundaries and localized group layouts in three engines; reserves 4191 |

PWA packaging is included in the production build. Optional local backend setup requires Docker; see [backend environments](docs/BACKEND-ENVIRONMENTS.md). Start it with `npm run server:local` on `http://127.0.0.1:4192`. The retained 4190 entry is available for existing Chromium storage; WebKit and Firefox block that port. No browser data moves between origins. [Local sessions](docs/AUTH-SESSIONS.md) use the local inbox with no external email. [Account sync](docs/ACCOUNT-SYNC.md) offers explicit selected import, empty initialization or existing account use; signing in alone uploads nothing. The original guest repository remains separate. Hosted provisioning and the Hetzner plan remain pending; hosting examples are not a deployment.

### Verify a code change

~~~sh
npm run check
npx playwright install chromium webkit firefox
npm run test:browser
npm run test:production
npm run test:pwa
npm run test:visual
~~~

Install the Playwright browsers once when needed. Existing journeys run in Chromium, WebKit and Firefox against `dist-review/` on **4180**. Production-entry and PWA lifecycle suites use `dist/` on **4181**, sequentially. Visual comparisons use the review build on **4182**. Each server takes its own temporary copy of the corresponding completed build, binds to `127.0.0.1`, refuses an existing server and uses fresh contexts with an origin guard. Keep these ports free and build before testing. The test-server regression also reserves **4181** briefly: finish `npm run check` before starting browser suites. Never run fixture-loading tests against the user's saved profile on 4173.

The [foundation evidence](docs/evidence/foundations-2026-10-21/README.md) records the rerun domain/browser results, screenshot matrix, environment and known limitations. The original baseline was 71 domain tests plus 69 Chromium scenarios. The [commands and production-entry report](docs/evidence/commands-entry-2026-10-21/README.md) records the next implementation batch. The application now saves through the IndexedDB repository, with transactional operation receipts, revision conflict protection and verified legacy migration. See the [DATA-01 evidence](docs/evidence/storage-2026-10-21/README.md). Versioned portability and atomic restore are covered by the [DATA-02 evidence](docs/evidence/backup-2026-10-21/README.md). Account import and synchronization now work against the isolated local BFF; see [SYNC-01 evidence](docs/evidence/sync-2026-10-22/README.md). [SYNC-02 evidence](docs/evidence/sync-recovery-2026-10-22/README.md) adds explicit conflict choices, retained recovery points, compact deltas and 90-day stale-queue review. Cloud deployment remains pending. WebKit automation is not physical iPhone/Safari certification; backend, Web Push and production-security evidence remain separate work.

[GitHub Actions configuration](.github/workflows/ci.yml) runs the toolchain gates and three browser projects on Linux with pinned actions and read-only repository permissions. It is configured locally; no Git remote or hosted run exists yet. Visual goldens are platform-specific: current references are for macOS/Chromium, and missing references fail rather than being generated automatically in CI.

## Local storage and recovery

RISE uses the origin-local `rise-device` IndexedDB database (database version 1, repository formats 1/2, domain schema 4). Initial migration reads `rise.local.v1` without changing it, validates schemas 1–4 in a worker, stores an exact recovery source and verifies a separate readback before enabling edits. New saves commit the profile and a local operation receipt together. Settings → Your data shows the actual save status, dated migration counts, provenance and original-source download.

Two tabs use revision checks with BroadcastChannel and focus refresh. A conflict stops further edits and keeps the unsaved snapshot for export; choose Reload saved copy only after exporting changes you want to retain. Storage failures offer Retry, the exact legacy recovery copy, unsaved changes and a raw device recovery archive. Invalid/future data never opens a writable blank profile. Clearing data still requires the existing explicit confirmation and leaves a revisioned empty profile to prevent stale tabs from resurrecting records.

**You → Settings → Your data → Export local data** produces a versioned private JSON backup with a corruption checksum. **Restore a backup** validates the file in a cancelable worker and previews counts, dates, XP, matching records, conflicts and removals before an explicit replacement. Restore atomically retains the previous device profile; the same screen offers its download and previewed rollback. Shared records restore into a separate read-only local archive, without live membership. Device delivery stays off until explicitly enabled. Credentials, subscriptions and invitation secrets are excluded; private coordinates and supported drafts remain. Files are unencrypted—keep them private. See the [backup format and recovery guide](docs/BACKUP-RESTORE.md).

One pre-import recovery point remains until the next restore/rollback or explicit clear. The original localStorage source is also retained until clearing. An old client changing it causes recovery mode, not an automatic overwrite. Restore and clear advance the repository envelope to format 2 so older DATA-01 clients fail closed. Application rollback must retain support for database version 1, repository formats 1/2 and the expanded personal command receipts with captured context; older clients fail closed on unknown receipts. Old localStorage-only assets are incompatible. Raw recovery archives preserve unrecognized or unsupported data but are not accepted by the normal restore screen.

IndexedDB completion confirms a device save; browser eviction, user clearing, private browsing and device loss still require an exported backup. Settings → Install & offline reports actual app-file readiness and offers installation guidance, coordinated updates and an explicit persistent-storage request. See the [PWA lifecycle and recovery guide](docs/PWA.md). Guest profiles and operations are never uploaded automatically. Explicit account use/import follows the separate [sync boundary](docs/ACCOUNT-SYNC.md). Personal actions now use validated commands with stable operation IDs and captured action dates/instants. Habits, timers, priorities, goals, rewards, notes, settings and prayer plans commit with their replay receipts; timer completion and its check-in are one transaction. Drafts survive sheet navigation and reload. Save confirmations wait for transaction completion. The whole-profile compatibility setter remains only for local family/squad simulations and isolated review controls. See the [DATA-03 evidence](docs/evidence/personal-commands-2026-10-21/README.md).

Remembered account state/outbox uses the separate owner-keyed `rise-accounts` database. Session-only account state stays in memory and needs server acknowledgment for successful save feedback. Sign-out protects pending account work and clears that account cache while preserving guest data. Conflicts retain intent for explicit current-head review; stale queues preserve their original recovery source. Account-mode guest restore/clear explains switching to the guest profile. DATA-04 now adds recent-auth account export, explicit device-only account cleanup, immediate deletion suppression, tracked primary purge and deletion replay; see [account lifecycle](docs/ACCOUNT-LIFECYCLE.md).

## Prayer dates and travel

Prayer setup keeps the existing methods, Asr conventions, high-latitude rules and planned offsets. Startup and resume extend 30 civil dates in the selected timezone. Calculations also support date-line locations and fractional offsets. A detected device-timezone change offers a review; your selected prayer location changes only through an explicit save.

A manual timetable belongs to one date and its own editable timezone. Saving it rebuilds UTC timestamps from the authored clocks and removes the recalculation key. Refresh and later location/method changes retain manual dates and checked entries. DST gaps and unavailable solar events require corrected times or a trusted manual source; they never produce sample replacements. Repeated manual clocks use the first occurrence of that clock. Ambiguous older clock-only changes remain saved and require explicit timetable review before alerts. Prayer status and recording controls compare the same absolute windows used for alerts, including a manual date kept after travel.

See the [PRAY-01 evidence](docs/evidence/prayer-timetable-2026-10-21/README.md) and [published calculation references](tests/fixtures/prayer-references.README.md). Coordinate lookup stays local; no background location collection or new external service is introduced. Browser notification delivery retains its existing best-effort limits.

## Protect the existing profile

- The `v` query is a preview label, not a reset command.
- Fresh production storage is empty and uses real date/time. Only the isolated review build seeds a demo. Existing storage loads its saved profile, including any retained sample/mixed history.
- Real prayer setup is at **You → Prayer preferences → Prayer times → Set up real prayer times**.
- Saving real setup switches to real time while retaining history. It does not automatically purge fictional history previously seeded by a demo. Production import must identify provenance before cloud upload.
- **You → Settings → Your data** exports private state, including prayer/pause records, notes, coordinates and drafts. Keep exports private.
- Loading a reviewer fixture replaces that origin's state. Rehearse in an isolated context and export before an intentional reset.
- Keep a downloaded backup outside browser storage. Site-data removal or eviction can destroy the local profile and recovery point; there is no automatic cloud backup. [MDN explains the lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Select Russian at **You → Settings → Language → Русский**; see [the Russian guide](RUSSIAN-LANGUAGE.md). Authored names and notes retain their language.

## Repository guide

| Location | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/context.tsx` | App shell, screen stack, tabs, loading and persistence |
| `src/model.ts`, `src/domain/` | Habit/domain behavior, shared calendar and prayer-pause modules, validated record commands |
| `src/contracts/commands.ts`, `src/data/repository.ts` | Runtime-checked local operation contract, revision/replay handling and non-durable memory adapter |
| `src/data/initialState.ts` | Empty personal profile construction |
| `src/account/`, `server/lifecycle/`, `scripts/infra/lifecycle.ts` | Recent-auth export/deletion, owner cache cleanup, isolated purge and ledger replay |
| `src/data/backup.ts`, `backupProjection.ts`, `backup.worker.ts`, `BackupScreen.tsx` | Private backup format, field projection, worker validation, preview and recovery |
| `src/review/`, `src/demo.ts` | Development fixtures and review controls excluded from the production bundle |
| `src/developmentModel.ts` | Goals, priorities, rewards and migrations |
| `src/prayerModel.ts`, `src/lifeModel.ts` | Prayer records, Fajr plans, pauses and local group models |
| `src/prayerCalculation.ts` | Offline calculation and timezone-aware coverage |
| `src/prayerSchedule.ts` | Event planning and native queue reconciliation |
| `src/prayerDelivery.ts`, `src/PrayerDeliveryProvider.tsx` | Permission, scheduling, receiving and acknowledgment adapters |
| `src/PrayerLive.tsx`, `src/Life.tsx` | Prayer setup, readiness, reminders, Fajr and pause screens |
| `src/Today.tsx`, `src/Balanced.tsx`, `src/Habits.tsx` | Daily priorities and habit flows |
| `src/Development.tsx`, `src/Explore.tsx`, `src/Prayers.tsx` | Goals, rewards, Journey and prayer history |
| `src/Groups.tsx`, `src/You.tsx`, `src/Personal.tsx` | People, settings, export and collections |
| `src/i18n.ts`, `src/messages.ru.ts`, `src/LifeUI.tsx` | Translation and formatting |
| `src/components.tsx`, `src/*.css` | Existing controls, tokens and composition |
| `public/assets/` | Pip/trail artwork and provenance |
| `public/notifications-sw.js`, `src/pwa/`, `scripts/pwa-build.ts` | One root worker, verified public offline cache, safe updates and a bounded generic push-test handler |
| `tests/` | Domain/browser tests |
| `server/`, `infra/`, `supabase/`, `scripts/infra/` | BFF, administrative bootstrap, additive database migration and isolated local-stack tooling |
| `ios/`, `android/`, `capacitor.config.ts` | Deferred native platform work |
| `screens/`, `.impeccable/review/` | Dated visual evidence, including superseded states |

## Production architecture direction

The stack retains React, TypeScript, Vite and the existing CSS. IndexedDB transactions and the local Fastify/Postgres/Auth foundation are implemented. Local sessions and consented personal sync are implemented. Scheduled Web Push now operates locally with explicit consent and a separately started sender. Real shared writes operate locally; hosted provisioning and production operations remain pending. Personal actions continue to work offline without uploading a profile.

The local infrastructure exists and has been tested; no hosted service was purchased or deployed. Hosting capabilities, data region, sender identity and operational ownership still need decisions. [ARCHITECTURE.md](ARCHITECTURE.md) defines the decisions and [TASKS.md](TASKS.md) defines execution.

Confirmed operating inputs are **Uzbekistan and Kazakhstan**, intended origin **`habit.saraftech.com`** (not configured), **Hetzner** hosting with an unknown plan, the selected future Supabase organization and a **USD 100 monthly ceiling**. Cloud provisioning is explicitly pending. Region, sender and named operating roles remain in [the infrastructure decision record](docs/INFRASTRUCTURE-DECISIONS.md).

Secrets stay on the server. Vite-exposed values and browser bundles are public. The implemented server configuration and remaining planned settings are documented in the architecture; secret values never belong in docs, fixtures or screenshots.

## Release definition

Production requires:

1. Preserved design and behavior with no fictional activity in a new account.
2. Safe migration, import/export, offline recovery and multi-device conflict handling.
3. Enforced account/group permissions and verified private-pause/sharing behavior.
4. HTTPS-device notification tests and truthful coverage reporting.
5. Browser, accessibility, performance and localization verification.
6. A successful backup restore, monitored deployment and rollback runbook.
7. Operational support/security contacts and published privacy/terms for the actual launch.

A personal pilot may gate unfinished modules with explicit availability states. It is not the complete release. See the requirement and evidence gates in [PRD.md](PRD.md) and [TASKS.md](TASKS.md).

## Historical guides and native continuation

The previous README is preserved in [the dated prototype guide](docs/archive/README.prototype-2026-10-21.md). [Full-day](FULL-DAY-WALKTHROUGH.md) and [difficult-day](DIFFICULT-DAY-WALKTHROUGH.md) rehearsals remain acceptance references; fixture dates and local port states are historical.

Native shells remain for future work. `build:native` does not compile, sign or install an IPA/APK. Xcode, Android SDK/Java and device testing are still required. Native notification code is not an AlarmKit or Clock-style alarm implementation.

## Contribution and security

Read [AGENTS.md](AGENTS.md) before editing. Link behavioral work to requirement/task IDs, and separate completed evidence from intended behavior.

The project includes [Karpathy guidelines for Codex](.agents/skills/karpathy-guidelines/SKILL.md) in `.agents/skills/karpathy-guidelines/`. AGENTS.md applies them to substantive coding work; you can also request `$karpathy-guidelines` explicitly. The skill preserves the four upstream principles with Codex-specific clarification and verification guidance. Its source revision and MIT declaration are recorded in the skill; it is installed only in this project.

[SECURITY.md](SECURITY.md) defines controls and a reporting procedure. A public security address is not established; establishing one is a release gate. Do not put private exports or credentials in public issues.

No repository software license has been declared. Confirm code, dependency and artwork rights before distribution; `private: true` in package metadata is not a license.

### Local conflict recovery

Account conflicts offer **Review pending changes** in the existing Account sheet. Load current records, then explicitly keep the account version or apply an eligible reviewed action. Original state/operations remain in a private recovery download. Archived/retired records and removed checks cannot be silently resurrected by an old queue. Caches in formats 1 and 2 remain readable; guest data is unchanged. See [the protocol, retention and rollback contract](docs/SYNC-RECOVERY.md). Retention is opportunistic per active owner; a scheduled all-account cleanup remains operations work. Cloud provisioning is still pending.

Local PUSH-01 setup and verification use `npm run push:watch -- local`, `npm run push:run -- test` and `npm run test:push`. See [per-installation subscriptions](docs/PUSH-SUBSCRIPTIONS.md). VAPID signing stays outside the BFF; neither guest data nor cloud infrastructure is changed.

The earlier PUSH-02 staging, PUSH-03 cancellation and PUSH-04 renewal/habit increments are integrated by the [current local sender](docs/LIVE-PUSH-SENDER.md). Their dated evidence remains in `docs/evidence/`; it does not certify hosted supervision, load acceptance or physical-device delivery.

### Local immutable rollout (OPS-03)

`npm run release:build` creates an isolated sealed production package with pinned dependencies. `release:select -- local <release-id>` prepares it, and `release:serve -- local` serves the verified package on 4192. `release:rollback -- local` selects the previous compatible package; cloud targets are rejected. Selection is not activation, and this foreground supervisor does not start push sending. See [commands, compatibility and recovery](docs/LOCAL-ROLLOUT.md). `npm run test:rollout` exercises real session/outbox/service-worker rollback on isolated 4191; run it sequentially with other database suites.
