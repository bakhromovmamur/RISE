# RISE — Repository Instructions

These instructions apply throughout this repository. Follow higher-priority system/developer instructions and the user's current request. The latest product direction is **a real mobile web product with the same product, design and functionality as the current RISE app**. Native store delivery is deferred.

## 1. Read before changing code

1. Read [README.md](README.md) for current capabilities and actual commands.
2. Read the relevant requirements in [PRD.md](PRD.md), then the matching task in [TASKS.md](TASKS.md).
3. Read the relevant sections of [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md).
4. For UI changes, inspect [DESIGN.md](DESIGN.md), [.impeccable/design.json](.impeccable/design.json), the existing source and relevant visual evidence.
5. Inspect the affected tests and any more-specific repository instructions before editing.

Do not load every historical report for a small change. Read enough to understand the affected behavior.

### Document authority

- The current user request governs the authorized task and scope.
- PRD defines production requirements; architecture/security define implementation constraints.
- TASKS records execution status. An unchecked plan is not implemented behavior.
- DESIGN and the current interface define visual parity. Resolve documented token/source drift using observed current behavior; do not silently redesign.
- PRODUCT describes the current implementation. VERIFICATION and archived guides are dated evidence.
- BRIEF is historical. Do not reintroduce its retired Plus/paywall concepts or prototype-only limitation.

Use conventional root filenames: README.md, PRD.md, AGENTS.md, TASKS.md, ARCHITECTURE.md and SECURITY.md. Do not create casing/spelling variants that drift apart.

## 2. Working discipline

- Inspect before modifying. Search with `rg`/`rg --files`; read the smallest relevant code surface.
- Work within the current request. A documentation request does not authorize provisioning, deployment, sending invitations or rewriting the application.
- Continue ordinary reversible implementation and verification without repeatedly asking for permission. Surface a material scope/privacy/billing/destructive ambiguity when it actually blocks a decision.
- Preserve unrelated changes and saved user profiles. Never reset a browser origin, database or working directory to simplify a test.
- Do not assume Git is initialized. Inspect repository state before Git operations; do not invent branches, remotes or commits.
- Keep changes focused on a task/requirement. Avoid unrelated formatting, dependency churn or a whole-app refactor.
- Use existing assets/components. No new visual direction, mascot, font system or generated artwork unless requested.
- Keep proposed infrastructure clearly labeled until it exists and has been tested.
- Update task status and relevant docs with actual evidence. Never mark a task done solely because code compiles.

### Project-local coding skill

For nontrivial implementation, debugging, refactoring and code review, read and apply the [Karpathy guidelines for Codex](.agents/skills/karpathy-guidelines/SKILL.md). Its four principles are: think before coding, prefer simple complete solutions, make surgical changes, and verify observable outcomes. Apply them alongside these repository rules; preserve required security, recovery and domain behavior. Routine reversible choices do not require additional confirmation.

## 3. Preserve domain invariants

| Domain | Required invariant |
| --- | --- |
| Habit XP | Full 20, tiny 10, at most 20 per scheduled occurrence; upgrade adds only the difference |
| Undo/correction | Explicit action; removes/reconciles the selected record, with no duplicate side effects |
| Non-habit actions | Prayer, Fajr acknowledgment, family tasks, goal milestones, claims, reflections and navigation award no habit XP |
| Habit history | Existing target/schedule edits apply tomorrow; materialized historical snapshots remain |
| Priorities | At most three ordered unique choices; completed selections remain; replacement does not complete/delete anything |
| Goals | Explicit milestone completion; habit check-ins do not complete milestones automatically |
| Rewards | Fixed goal/week conditions; explicit claim/enjoy; correction reconciliation; missed later days do not erase earned progress |
| Prayer | Explicit on-time/later/missed record; elapsed time alone does not create a missed record |
| Private pause | Exclude affected unrecorded entries, retain prior records, hold streaks without growth, preserve earlier unresolved gaps |
| Fajr | Plan is dated; “I'm up” cancels wake alerts without recording prayer; preview never changes a real acknowledgment |
| Sharing | Exact opt-in snapshot; no automatic private-data disclosure or recomputation after publication |
| Time | Civil dates plus IANA timezone; absolute instants for dispatch/audit; never server-local time assumptions |

For prayer-calendar changes, use `zonedTime` and `prayerWindowState` for dated real-time comparisons. A manual save must not retain calculated keys/stale UTC timestamps or manufacture prayer records. Keep each manual date's timezone and checked snapshots; handle unavailable dates without sample substitution. Device-timezone observation is local metadata and prompts explicit review rather than changing the selected location.

Use `prayerWindowInstants` for dated dispatch/display math and `prayerWindowState` for phase/streak decisions. Existing explicit prayer reports remain correctable after clock changes; fresh reports keep their start/end guards. Pause resume cannot precede its start. Newly saved Fajr plans own their optional backup choice per date; older plans fall back to the existing device preference. Fresh-profile wake previews stay local to the component and cannot write live alarm/acknowledgment state. Preserve dated drafts and the original legacy recovery source.

Verify behavior through the domain interface. Do not duplicate XP, streak, reward or prayer calculations in screen components.

## 4. UI and accessibility

Keep Today, Journey, Progress and You, including tab-state preservation and explicit shortcut focus. Retain porcelain/forest/mint roles, paired action/text tokens, system fonts, existing rounded controls and original Pip/trail provenance.

Add required account/offline/error/permission states using existing composition. Never replace a working flow with a placeholder, inert control or fake success message.

Maintain keyboard operation, semantic names/roles, focus containment/restoration, visible focus, readable errors, adequate touch areas, reduced motion, light/dark and large-text layout. Do not suppress focus outlines or fix overflow by hiding essential text.

Check changed screens at 375/393/430 px and 200% text; include 320 px reflow where relevant. Use equivalent state/data for before/after comparisons. A visual test is not meaningful if it accidentally shows reviewer controls or a different scene.

Localize visible/accessibility/error/notification strings for English, Russian and Uzbek Latin. Do not translate or mutate user-authored names, notes or reflections on language change.

## 5. Architecture and code conventions

Retain React/TypeScript/Vite and current CSS. Evolve the persistence and platform seams incrementally; do not introduce Next.js or another app framework without a reasoned scope decision.

Prefer deep modules: a small interface that owns behavior and invariants. Use adapters where behavior actually varies, such as IndexedDB/test storage or web/native delivery. Do not add a generic layer that merely forwards every call.

- Keep domain logic pure where practical; inject clock/storage/delivery dependencies.
- Validate unknown data at entry with runtime schemas; TypeScript types do not validate JSON.
- Use explicit discriminated commands and error cases; avoid `any`, unchecked casts and swallowed errors.
- Treat user actions as idempotent operations and update all dependent records transactionally.
- Personal journey edits use `DeviceSession.dispatch` through AppContext; drafts use the durable draft helpers. Backup/restore/clear use their dedicated transactional APIs. Keep the compatibility `setState` path limited to local collaboration simulations and isolated review controls. Preserve stable IDs and captured action context on retry, and wait for durable acknowledgment before showing save success or rescheduling delivery.
- Store derived XP/progress as derived values or verified projections, never arbitrary client increments.
- Keep asynchronous effects cancellable and resilient to resume, duplicate execution and account changes.
- Use stable identifiers and date/version provenance. Do not generate new IDs on every retry.
- Preserve compatibility through staged migrations. Never wipe old data to repair a schema mismatch.
- Do not commit built `dist/`, test reports or generated native web bundles unless the repository's release process explicitly requires them.

INFRA-01/AUTH-01/AUTH-02 and SYNC-01 now exist locally as recorded in the environment/session/personal/sync guides. Cloud provisioning stays pending. `WorkspaceSession` selects the original guest repository or an explicit account journey. Never upload/relabel guest storage automatically. Use the reviewed selected-import flow; preserve its original source and recovery data. Remembered accounts use owner-scoped `rise-accounts` state/outbox; session-only private data stays in memory. Keep auth credentials out of both. Expected account assertions must match the verified actor, and scope changes must dismiss stale private forms.

Account commands use `server/personal/` and `src/contracts/accountCommands.ts`, reuse the existing domain reducer, and establish actor/audit time from the verified session/database. Sync captured time/date is bounded personal intent, never an identity or auth clock. Preserve the one-transaction data/revision/receipt boundary, owner-inclusive foreign keys, forced owner/session RLS, invoker totals and exact replay results. Account initialization is explicit; reads must not create/import a profile. Keep drafts, timers, coordinates/calculation keys and delivery consent out of this account API. The BFF trusts verified session claims on a restricted connection; never replace it with service/admin credentials. Use `node --import tsx` for server entry points; the existing pinned loader is a production dependency so domain source need not be rewritten.

SYNC-02 adds optional immutable `expected`/`observedRevision`/`predecessor` conditions to sync operations, compact owner-only changes/removal barriers and a retention floor. Never silently renumber/recycle an old operation to resolve conflict. Preserve cache formats 1/2 and the original recovery state/outbox; unresolved recovery counts as pending for logout and session-only durability. Recovery decisions require a current authorized head and strict cache CAS; unavailable targets have no override. A reviewed timezone change must not reactivate coordinates for a different calculation timezone. The original setup stays in the private recovery point. See [the exact recovery contract](docs/SYNC-RECOVERY.md). Keep current receipt update denial and the narrow owner/expired-only DELETE policy.

DATA-04 adds [the account lifecycle boundary](docs/ACCOUNT-LIFECYCLE.md). Sensitive export/deletion require server-clock recent authentication. Reauthentication challenges bind purpose/session/owner and never create users. Ordinary `asActor` always rechecks authorization; only the dedicated terminal deletion transaction may commit after suppression. Keep owner-root cascade foreign keys alongside composite history references. Never remove the ledger to repair a failed purge. The 35-day suppression clock starts after verified primary purge.

Keep provider administrative keys exclusively in the isolated local lifecycle process/protected environment, never the BFF, browser, exports or logs. Test deletion only with synthetic accounts. Verify populated historical/staged data, old-JWT rejection, lost replies, failed provider completion, concurrent writes and backup replay. The local watcher/one-shot accepts only fixed local/test installations; do not extend to hosted targets without the user’s authorization.

Account cache cleanup must retain database/cache format compatibility, use strict owner/version/generation checks and preserve guest/other-owner data. Deleted-owner markers prevent stale reinsertion. Treat quota cleanup failure as incomplete and expose retry while hiding the account. Do not clear the public PWA cache or guest alert ledger to clean an account. PUSH-01 now supplies subscription/test ownership, pre-suppression cancellation and cascade purge. Real group modules and future notification-job tables must extend the documented hooks before they are enabled; integrated acceptance remains assigned to those tasks.

PUSH-01 adds [the installation subscription boundary](docs/PUSH-SUBSCRIPTIONS.md). Keep push consent/observations in `rise-push-device` v1, separate from guest/account caches and portable files. Never subscribe or request permission on login, refresh, rotation or restore. Only explicit user gestures enable; identity observation may only revoke. Keep owner/version CAS, generic default copy and pending-cancellation feedback. VAPID signing belongs to the isolated local sender, never the BFF/browser. Preserve its narrow column grants and retirement-only RLS; no private journey/provider-token access. New scheduling tables must extend deletion hooks before activation. A provider acceptance or browser display report proves no sound or wake-up.

PUSH-04’s local [habit reminder boundary](docs/HABIT-REMINDERS.md) reuses dated domain versions and snapshots. Keep habit quiet hours mandatory even with a prayer override. Saved preview preferences alone are not device consent. Foreground delivery requires the current saved scope and explicit device consent; generic notifications never complete a habit or award XP. Keep the shared occurrence ledger and current staged/live distinction.

Local scheduled sending now uses `server/push/runtime.ts` and the existing isolated transport. See [the sender/receive contract](docs/LIVE-PUSH-SENDER.md). Keep readiness tied to fresh database-clock sender heartbeats, never a build flag. The root worker authorizes each reminder through the current session/installation API before claiming the shared ledger; a locally cached plan generation is not authority. Preserve provider acceptance when suppressing later presentation. Run sender verification with synthetic subscriptions and an injected outbound boundary; cloud provisioning and physical delivery remain pending.

PUSH-02 retention uses [bounded sender lanes and seven-day receipts](docs/PUSH-RETENTION.md). Preserve durable `throughGeneration` on cancellation retries, owner-locked floor advancement/deletion, the narrow non-login cleanup role and owner-root marker cascades. An unknown legacy cancellation after cleanup needs explicit review; never silently replace its ID/body or bind it to a newer plan. Keep the compatible API after cleanup when rolling back. `check:push-load` uses only the fixed test stack and an injected outbound boundary; run it sequentially with other database suites.

## 6. Privacy and security

Follow SECURITY.md. Treat religious practice, pause data, coordinates and free text as sensitive.

- No secrets in source, `VITE_*`, browser storage, screenshots, fixtures, exports or logs.
- Never use real profile exports as test fixtures; generate synthetic records.
- Server identity comes from the verified session. Never trust submitted owner/member roles.
- Check current membership on every shared operation; group ownership grants no private-record access.
- RLS, field projections and transaction checks are required even when UI controls are hidden.
- Do not use privileged provider credentials for ordinary user requests.
- Keep private caches account-scoped; clear them on logout/account switching as specified.
- Permission requests and invitations must follow explicit user actions.
- Browser push is best-effort; never describe a scheduled job/provider acceptance as a guaranteed wake-up.
- Restore cannot recreate real membership, secrets or deleted accounts.
- Keep installation/deployment environments separate. Never connect review fixture tooling to production.
- Do not send emails, messages or invitations to real people during development unless directly authorized.

For Supabase changes, consult current official docs/changelog and relevant installed skills. Use reviewed migrations, inspect grants/policies and test direct unauthorized access. Do not weaken policy checks to make a failing request succeed.

## 7. Commands and verification

Current commands (local lifecycle commands and protected configuration are described in the lifecycle guide):

~~~sh
npm ci
npm run check
npm run test:browser
npm run test:production
npm run test:pwa
npm run test:visual
~~~

The journey suite runs the review build on isolated port **4180** in Chromium, WebKit and Firefox; production-entry checks use **4181**, and visual comparisons use the review build on **4182**. Build first: each test server freezes a temporary copy of the completed bundle so a later build cannot disrupt it. The real-worker PWA suite also uses 4181 and must run separately from production-entry checks. Its temporary server offers synthetic version/connection failure controls that are never deployed. Keep those ports free. Finish `npm run check` before browser suites because its test-server regression briefly uses 4181. Install required Playwright browsers if missing. Import browser fixtures from `tests/support/browser.ts` to enforce the isolated origin and block external requests. The user's main preview/profile is on 4173; do not load fixtures into it.

Current `npm run build:native` builds web assets and performs Capacitor sync. It does not compile/sign/install a native app. Native commands are not routine web-task gates unless shared native behavior changed.

`npm run check` verifies pinned Node/npm and dependency resolution, runs Oxlint correctness rules, checks app/test/configuration/server types, runs domain/tooling tests and builds production and review variants. The CI workflow repeats these gates for each browser; it has no deployment credentials. Backend checks use `npm run infra:up -- local`, `npm run infra:up -- test`, `npm run test:infra` and `npm run test:backend`; see [the environment guide](docs/BACKEND-ENVIRONMENTS.md). The BFF browser suite freezes the production build on **4191**, with fresh contexts and the shared origin guard. Reserve that port for tests; **4192** is the browser-compatible local BFF origin; the retained **4190** installation entry remains for existing Chromium storage. `npm run server:local` uses the fixed 4192 alias without rewriting identity or moving profiles. `npm run check:local-browser` is a read-only, fresh-context smoke, never a fixture loader. Cloud provisioning remains pending by user direction. Keep `.rise-infra/` private; never upload CLI status/logs or stop/delete unrelated Docker stacks.

Production output is `dist/`; review output is `dist-review/`. The review build must remain on isolated loopback ports (4174 for manual review, 4180/4182 for tests). Production query parameters never enable reviewer controls, fixtures or design mode. Preserve this exclusion when changing the entry point.

Local PUSH-01 checks use `npm run test:push`, sequentially with other 4191/database suites; browser provider/permission adapters are synthetic and do not certify physical delivery. Run the isolated `push:run`/`push:watch` only against local/test installations.

Local AUTH-01 checks use `npm run test:auth`; SYNC-01 checks use `npm run test:sync`, sequentially with other database/BFF suites on 4191. See [the sync protocol and cache boundaries](docs/ACCOUNT-SYNC.md). Real server-side fault controls exist only in the isolated test entry so WebKit worker-owned requests are exercised; they require verified owner/Origin/CSRF. Visual-only mock metadata tests block service workers and contain no usable session/code. See [session setup and security boundaries](docs/AUTH-SESSIONS.md). Disable traces/video/automatic screenshots for real credential flows; capture only unverified forms without usable codes. Each sequential backend browser worker resets only three HMAC quota subjects for the synthetic test loopback IP, after enforcing the test environment; it never clears accounts or guest storage. Do not weaken production rate limits to make reruns pass.

The frozen visual matrix is documented in [foundation evidence](docs/evidence/foundations-2026-10-21/README.md). Normal visual runs must not regenerate references. `npm run test:visual:update` is only for an accepted visual change with inspected differences and recorded requirement/build/fixture evidence. Current goldens use macOS/Chromium system fonts; do not replace them with Linux rasterization to force a passing check.

### Choose checks for the change

| Change | Minimum meaningful evidence |
| --- | --- |
| Markdown only | Links/anchors, requirement/task consistency, current-versus-target claims, no unintended source edits |
| Domain/state | Relevant domain tests, edge/failure cases and build |
| Persistence/schema | Migration, corrupt/partial failure, readback, rollback and round-trip tests |
| UI/navigation | Build, affected browser journey and visual comparison at required states |
| Backend/auth | Real database integration, owner/unrelated/member/removed-user negative cases |
| Push | Pure plan tests, adapter integration and real HTTPS-device evidence for device claims |
| Deployment | Environment isolation, health check, restore/rollback procedure and secret checks |

Run the complete relevant regression suite before a release. Broaden checks when a failure or unresolved concern justifies it; do not repeatedly rerun passing suites for an unchanged documentation edit.

Do not write tests that merely repeat implementation details. Test outcomes at public module interfaces and important failure/race cases. Do not replace a real adapter with a mock and then claim the real system was verified.

## 8. Evidence and task updates

A completion entry should include:

- Task and PRD IDs.
- Behavior changed and why.
- Files/migrations/configuration changed.
- Exact commands and results, with date and environment.
- Browser/device versions for compatibility claims.
- Screenshots or logs where relevant, redacted of private data.
- Remaining limitations and recovery/rollback implications.

The historical 140 passing tests are a baseline, not evidence for future changes. Preserve dated reports and append new evidence; do not rewrite past reports as if they tested a new release.

Update README for actual setup changes, PRODUCT for actual capability changes, PRD for accepted product changes, ARCHITECTURE for decisions/interfaces, SECURITY for new risks/data and TASKS for status. Documentation must agree about what is real and what is planned.

## 9. Definition of completion

The requested change works, relevant checks pass, current data/design are preserved, failure cases are handled and the user receives a clear account of results and limits.

For production release, every applicable PRD and security gate needs evidence. A mock, generated project, green build, written document or “ship” verdict on a narrow UI fix is not sufficient proof of the complete product.


## PUSH-02 local staging boundary

See [durable plans](docs/PUSH-PLANS.md). Plan APIs are local/test only. A fresh GET reports `dispatchEnabled` from current database-clock sender heartbeats; immutable POST receipts retain their original observation. Reuse `buildWebPushEvents`, current personal revision, explicit primary takeover and immutable request receipts. Queue work uses database-clock leases and expiry with owner/session/version rechecks. PUSH-03 cancellation/quiet-hours/deduplication and PUSH-04 integration now connect the queue to the local sender; preserve every prerequisite and the current receive-time authorization check. Preserve forced RLS, worker column grants, lifecycle cancellation and Auth-root cascades.

PUSH-03 adds [transactional cancellation and quiet-hour rules](docs/PUSH-CANCELLATION.md). Preserve the owner lock across domain receipt/cancellation and final dispatch. Dated acknowledgment cancels wake/backup IDs only. Cancellation retries must replay without touching later generations. Never turn a preview into a cancellation or prayer record. Local blocked keys and pending receipts are owner-scoped; matched responses cannot clear newer intent. The page/worker ledger is an atomic occurrence claim, not evidence of display. Live dispatch requires current renewal/readiness, consent and receive-time authorization; those integrations now exist locally.

## Local plan renewal (PUSH-04 increment)

The web-only `PlanRenewal` coordinator requires explicit primary-device consent, a saved/synced selected account, current installation/version and flushed cancellation intent. Preserve immutable pending request IDs and exact body replay; compare current GET metadata after POST rather than treating a receipt as current readiness. CAS and source checks must fence old responses, including errors, after newer choices or account changes. Keep `rise-push-device` v1 compatible and clear owner-bound renewal metadata on disable/cleanup. Renewal metadata contains only opaque event/time requests and input hashes, never credentials or private source text. Current GET readiness follows sender liveness; do not label a stopped sender, stale receipt or staged coverage as active delivery. Habit reminders and the live sender are integrated locally; hosted and physical-device acceptance remain pending. See [the renewal contract](docs/PUSH-RENEWAL.md).

## GROUP-01 local membership boundary

See [membership authority and lifecycle](docs/GROUP-MEMBERSHIP.md). The local/test API and membership screens now exist; original shared-content simulations remain isolated in review/retained local records. Never relabel or upload those groups automatically. Group roles derive from the one active owner constraint; all shared nicknames are explicit. Preserve the actor-then-group lock order, expected revisions, immutable request IDs/issue times, current membership checks and exact authorized receipt replay. The BFF cannot write group tables directly; the narrow `rise_group_guard` must never gain private journey/provider-token access or become a runtime login role.

Invite secrets belong only in an explicit response/URL fragment and transient browser memory, not logs, drafts or backups. Transfer/archive revoke outstanding links; a pre-departure invitation cannot rejoin a removed member. Group preferences alone grant no delivery consent. Group cleanup precedes account suppression; terminal cleanup must commit before the provider deletion connection runs. Keep retained deletion-ledger authority and fail-closed readiness for future squad/notification tables until their hooks are implemented. New shared modules must retain deidentified historical member references and extend GROUP-05 acceptance.

## GROUP-02 local backend boundary

See [shared family content](docs/SHARED-CONTENT.md). The local/test task/list backend, private account priority references, in-memory reader and real browser controls are locally verified. Preserve dated task snapshots, explicit per-date completion/Undo, member-ID deidentification, group-inclusive foreign keys, item removal barriers and no habit XP. All collaborative writes use the existing actor-then-group lock, expected group revision and immutable receipt transaction. The BFF has no direct content DML grants. Reads use bounded coherent pages; a changed group revision requires restarting pagination. Do not silently regenerate conflicted operations. Archive retains history; group deletion cascades content. Personal storage formats and guest simulations remain separate. Preserve the verified browser/offline/priority behavior and its dated GROUP-02 evidence.

Shared priorities store only group/task UUIDs and occurrence date. The personal day is independent. New references require current membership and schedule authorization inside the personal transaction; retained selections remain removable/reorderable after access loss. Never cascade shared deletion into private selections or copy shared titles/notes into the personal API. Keep sorted group locks after the actor lock, separate domain authority from submitted context, preserve old priority rows/cache formats/fingerprints/staged import hashes, and exclude all task references from guest import. The memory reader must clear inaccessible data and fence late results; owner-bound eligibility registration never replaces server authorization.

Group UI uses `GroupSession` through the selected verified account. Keep server views and invitation secrets in memory; strip initial and same-document invitation fragments. Persist only immutable non-secret intent (a join uses an owner/operation/group marker) in the existing account drafts, never a second group cache. Keep group pending counts separate from personal sync/push readiness, while including them in logout, session-only departure and update holds. Retry exact IDs/bodies, check receipts after a reload, preserve newer drafts during cleanup and require an explicit current-version decision for stale forms. Keep both successful and failed responses fenced after account changes. `npm run test:groups` uses isolated 4191 sequentially with other BFF/database suites; screenshots use only unverified visual metadata, with no usable codes.

## GROUP-03 exact squad boundary

See [exact squad snapshots](docs/SQUAD-SNAPSHOTS.md). The local/test implementation derives previews only from the verified owner's committed personal revision and database clock, using the existing domain totals. Sharing starts off for each new post. Publication consumes the exact stored ten-minute preview by ID/hash; never accept replacement content or recalculate it at publication. Keep note/aggregate/title allowlists, author-only edits/withdrawal, own reactions, owner abuse removal and no habit XP. Withdrawal erases payload/reactions/previews and retains an ID barrier. Archived groups permit erasure and removal of an existing own reaction, not new publication.

Shared pages remain memory-only, current-member authorized, bounded to 20 and fenced by group revision. Account drafts retain stable IDs, reviewed revisions, private authored text/choices and opaque preview references; the exact preview stays in memory. A fresh preview requires saved/synced account data. Account changes, draft changes and stale responses cannot restore an earlier preview. Acknowledgment clears only the matching draft, and conflicts require explicit review without renumbering old operations.

Pre-suppression and terminal lifecycle hooks erase the author's squad posts/reactions/previews, including former memberships, under the actor and sorted group locks. Keep the suppression ledger, Auth-root cascades and deferred composite member references needed for complete group deletion. The group guard has no private-journey access; the worker only prunes expired previews through its narrow capability. Notification jobs must extend these hooks before activation. Cloud provisioning and hosted/device acceptance remain pending.


## GROUP-04 optional group notifications

See [the group notice contract](docs/GROUP-NOTIFICATIONS.md). Preserve default-off group opt-in and separate installation consent. Legacy preference commands must omit their absent flag on retry and must never imply consent or erase a newer draft. Task assignment edits and explicit squad publications may create generic notices; reactions, task check-ins and private actions do not. Group quiet hours always apply, independently of prayer overrides.

Keep content/revision/receipt/job creation transactional, bounded optional capacity, immutable replay and recipient actor → group → job dispatch locks. Current source revision, both memberships, installation/session and recipient/source-author deletion suppression authorize each send and receive; a restored membership/job is not authority. Preserve accepted provider outcomes while canceling later presentation. Never include shared text or private totals in group payloads, and never award XP or create records on a push/click.

Retain `rise-push-device` v1 and the shared occurrence ledger. Group delivery needs no prayer plan. The installed deletion hook erases recipient/source jobs before suppression and during terminal replay; a missing hook blocks deletion. Test with synthetic subscriptions and an injected provider boundary, sequentially with other database/4191 suites. Keep full visual runs separate from database capacity checks to avoid competing benchmark load. Cloud provisioning and physical-device acceptance remain pending.

## GROUP-05 shared archive and integrated lifecycle

See [shared archive and lifecycle](docs/GROUP-LIFECYCLE.md). `rise.group-archive` v1 is an explicit current-member download, separate from unchanged private backup/cache formats. Keep the recent-auth/reviewed-revision checks, current-member RLS on every bounded page and final authorization. Reuse the shared screen projections; never expand departed-member name access or include private journeys, invitations, previews, credentials or device consent. Bind the group parameter within paged queries so large retained history uses its ordered index; do not relax database timeouts or authorization to make exports pass.

Validate the complete bounded file, references and checksum. Never truncate or retain a partial export. Worker cancellation and final owner/revision fences prevent late files after scope changes; reauthentication returns to explicit confirmation. Private restore must reject this format before mutation. Preserve deidentified family history, squad/notification erasure, deleted-owner cache markers and authoritative ledger replay. Tests use synthetic accounts only; hosted backup operations and physical-device proof remain pending.

## SAFE-01 local browser security boundary

See [the local security contract](docs/LOCAL-SECURITY.md). Keep the BFF policy in `server/browserPolicy.ts` and include its headers in the PWA release fingerprint. Policy-only changes must reach cached shells through the existing safe update flow; never clear a profile/cache or force activation to install headers. Preserve the documented style-only inline exception until equivalent-state evidence supports removing it; never add inline-script/evaluation or arbitrary remote-source exceptions to silence a failure. Test normal workers, downloads, offline navigation and negative script/framing cases through the BFF. Playwright direct evaluation bypasses CSP and is not an evaluation-blocking test. Hosted HTTPS/HSTS, physical-device and operating acceptance remain pending.


## OPS-01 local operations boundary

See [local operations](docs/LOCAL-OPERATIONS.md). Keep `rise_ops_login` aggregate-only through its fixed local/test capability; never give the monitor BFF/worker/lifecycle/provider credentials or direct table access. Diagnostic output uses explicit status/code allowlists, never bodies, URLs, error messages, identifiers or profile data. Browser diagnostics are an explicit download, with no automatic upload, analytics or new persistence. Preserve the private bounded alert journal, atomic routing acknowledgment, stale/unknown failures and separate test drill. Local file routing does not prove human paging or hosted monitoring. Named incident owners/contact and cloud provisioning remain pending. Do not run senders or mutate queues to make monitoring green.


## OPS-02 local server recovery

See [the recovery boundary](docs/SERVER-BACKUP-RECOVERY.md). Preserve separate backup keys, authenticated 30-day expiry, exact applied migration checks and current authority reconciliation. Restore only into a new networkless disposable container; never add an existing database target or automatically reopen access. Missing/stale/changed authority fails closed. Changed shared groups remain quarantined until reviewed reconciliation. Never restore session, invitation or push authority from an archive. Keep the existing owner-locked sync floors, restricted push cleanup and dedicated lifecycle purge rules. Test deletion/restore acceptance with synthetic accounts; preserve user profiles and original recovery sources. Do not log database dumps, credentials or private rows. Continuous supervision, off-site/lost-source/hosted recovery and cloud provisioning remain pending.

## OPS-03 local release boundary

Use [the local rollout contract](docs/LOCAL-ROLLOUT.md). Never edit a sealed package or its manifest to bypass checks. Release admission requires identical applied migrations and storage/API contracts; schema expansion needs separate compatibility work. Preserve the fixed 4192/4191 origins, protected installation/session keys, immutable outbox IDs and normal PWA update leases. Write pause is server-owned, retryable and does not bypass logout authorization or revoke/cancel delivery. The supervisor starts no sender. Keep active/previous assets; never unregister workers or reset data for rollback. Run `test:rollout` sequentially with other BFF/database suites. Cloud provisioning remains pending.
