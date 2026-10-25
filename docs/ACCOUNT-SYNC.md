# Local account import and synchronization

**Scope:** SYNC-01/SYNC-02 · PRD-02–04 · SEC-01–03/05.  
**Implemented locally:** 22 October 2026, Asia/Tashkent. Cloud provisioning, deployment and external email remain pending.

## User-visible behavior

Open **You → Settings → Your data → Account** through `npm run server:local` on `http://127.0.0.1:4192`. Use a synthetic `auth-<random-id>@example.invalid` address and the local mail inbox; see [session setup](AUTH-SESSIONS.md). The static preview on 4173 remains a separate guest origin. Starting the BFF does not transfer its storage.

The browser-blocked 4190 port is retained for installation identity/legacy Chromium storage; the fixed 4192 entry passes all three engines without moving saved profiles. See [current local-entry evidence](evidence/product-review-2026-10-23/README.md) and [the original observation](evidence/sync-2026-10-22/runtime-health.json). Fixture suites remain isolated on 4191; HTTPS device acceptance is still open.

Signing in alone creates no personal profile and uploads no guest records. The account sheet offers the existing account, an explicitly initialized empty account, or a selected import. The device-only profile remains available separately. An empty account follows the existing onboarding flow.

Import has two explicit boundaries:

1. Select individual authored habits and optional goals/rewards, real prayer history/pauses/Fajr plans, saved reflections and personal preferences. Nothing is selected by default. Basic profile name and planning timezone are shown as part of the import.
2. Prepare a **device-only worker preview**. Review counts, date range, XP, provenance and exclusions. Known fictional habits/goals and sample prayer dates are withheld; ambiguous legacy history requires the user's review.
3. Check consent to upload this selection to the verified account shown above. Only then are bounded, owner-scoped staging pages uploaded. Staging is private but is server storage; it is not yet live account history.
4. Review the server's added/kept counts and XP delta. Confirm **Import selected records** to commit. Existing account records win; the account is never replaced wholesale.

Cancel/review again deletes uncommitted staging when reachable. An interrupted request can be retried with the same import ID and immutable pages. Uncommitted plans expire after 24 hours; new import attempts opportunistically remove expired plans. Expiry is an access deadline, not a guarantee of physical deletion at precisely 24 hours. A future lifecycle job must enforce operational cleanup. At most three active plans per owner are allowed. Committed staging pages are deleted in the commit transaction; minimal import/receipt metadata remains for replay.

The guest profile, immutable legacy source, drafts, receipts, recovery point and collaboration archives are not modified. Skipped data stays there. Restore/clear in account mode explains the device boundary and offers switching to the device profile. DATA-04 now implements [full server export/deletion](ACCOUNT-LIFECYCLE.md); a pending-change download remains a separate private local recovery copy.

## Data projection and merge

`src/sync/importModel.ts` projects known per-entity fields through `src/contracts/personalRecords.ts`. It never submits the legacy `State` object as canonical server data. Runtime validation checks exact tables/columns, nested field allowlists, IDs, references, dates, normalized round trips, duplicates and size limits. A SHA-256 digest binds the complete reviewed projection; it detects mutation, not identity or authenticity.

| Data | Import/sync treatment |
| --- | --- |
| Habits and occurrences | Selected bundles retain created/effective dates, materialized target/name snapshots, checks and derived 20/10 XP |
| Goals, milestones, rewards | Optional; links to unselected/unavailable habits or fictional records are removed; existing account bundles remain authoritative |
| Priorities | Guest import includes habit/milestone references only. Account sync also retains authorized opaque family-task references; no simulated shared-task/member identities |
| Prayer dates/windows/reports | Real dates only; dated timezone and UTC windows retained/resolved; no fabricated report timestamp for legacy unknown times |
| Private pause and Fajr | Optional private pause keys, dated plans/backup choices and independent wake acknowledgments |
| Reflections/preferences | Only selected saved content and supported settings; no inferred private notes |
| Coordinates/raw calculation keys | Never sent; consented prayer import may retain this device's matching calculation setup in its new owner-scoped local cache |
| Drafts, active timers, delivery consent | Device-owned; excluded from import and outbound account commands |
| Groups/invitations/archives | Not converted into real membership or synchronized by this task |

Existing UUID entity IDs remain stable. Legacy non-UUID IDs map deterministically by account, entity family and original ID. Retrying or reimporting the same bundle does not duplicate activity. Reimport keeps existing habit/goal/date bundles, even if the device copy differs; skipped history is retained in the original guest profile. Independent new records append after existing items. Prayer tracking start is stored separately from the earliest habit-history date.

Local comparison and serialization strip calculation keys and shared simulation references. Saved prayer windows can synchronize without coordinates. The primary device retains its location settings only locally; another device can use received dated coverage and explicitly configure its own location. A remote planning-timezone change that conflicts with retained local calculation settings produces **Needs attention**, rather than recalculating with the old location automatically.

GROUP-02 adds [private opaque task priorities](SHARED-CONTENT.md#private-priorities-and-browser-reads). Group/task UUIDs and occurrence date synchronize without shared text or membership. The server authorizes new references within the personal transaction; retained unavailable choices remain removable/reorderable. Old priority rows, cache formats 1/2, immutable fingerprints and staged import hashes remain compatible. Append import preserves existing account references but never imports a new task reference. Remote removal of a real reference cannot be undone by reattaching local simulation state.

## Client storage and ownership

`WorkspaceSession` selects the existing guest `DeviceSession` or a separate `AccountJourney`. The new IndexedDB database is `rise-accounts`, version 1, with backward-readable cache formats 1/2, owner-keyed `accounts` and an `active` owner preference. `rise-device` version 1 and schema-4 guest data remain unchanged.

| Mode | Save contract |
| --- | --- |
| Guest | Existing atomic guest state/receipt; never enters an account outbox |
| Remembered account | Strict IndexedDB transaction commits the local materialized state **and its stable outbound operations together**; success waits for completion |
| Session-only account | Private state, local drafts and retry queue stay in memory; successful save feedback requires server acknowledgment; offline edits do not survive closing the tab |

Authentication metadata stays in memory and credentials remain HttpOnly/server-held. The only sessionStorage choice is `rise.account-view = "1"`, containing no identity or private data. It allows a session-only view to reopen after a fresh verified server read. Persistent offline cache use requires the remembered-device choice. IndexedDB storage is not encrypted at rest by the application; use the shared-device warning and explicit logout.

Account A's state, drafts and outbox are never displayed or sent as account B. Both client and server verify an expected account assertion against the current session. That assertion is not an authorization source. Scope changes dismiss old sheets/forms and return to Today. Data-free BroadcastChannel messages prompt an authorized refresh; they carry no records or tokens.

Expiry or unexpected identity change hides the active account immediately and clears the active preference. Pending data remains locked to its original owner for reauthentication/recovery. Confirmed logout clears the selected account cache and preserves guest data. Pending work, including an inactive account while viewing the guest profile, requires sync/export or an explicit version-bound discard choice. Unchecking that choice revokes it. New pending work arriving while logout is in flight is retained locked, rather than discarded using an older choice. Offline revocation cannot erase an unreachable device; DATA-04 supplies account deletion; scheduled retention remains OPS-02.

## Command, acknowledgment and pull protocol

All routes are under `/api/v1`, session-authorized, no-store and excluded from service-worker caches. POST requests require exact Origin, JSON content type and the current session-bound CSRF header. The restricted BFF connection establishes actor claims from the verified session; forced owner/current-session RLS remains mandatory. No service/admin credential is used in ordinary requests.

| Route | Behavior |
| --- | --- |
| `GET /sync/head` | Owner ID, initialized flag, canonical revision and derived XP; never initializes data |
| `POST /sync/pull` | `{accountId, revision, cursor:{table,offset}}`; projected rows for one fixed table, next cursor and matching head |
| `POST /sync/changes` | Pinned compact updates/tombstones; stale floor requires full pull |
| `POST /sync/review` | Current-head recovery permission and receipt status, without a write |
| `POST /sync/commands` | `{accountId, operations}`; up to 100 dependent commands in one database transaction |
| `POST /sync/imports` | Explicit consent, stable import ID, source hash/provenance, base revision and page count |
| `POST /sync/imports/page` | Idempotent immutable numbered projection page |
| `POST /sync/imports/preview` | Revalidate complete projection and report an append merge against the unchanged account revision |
| `POST /sync/imports/commit` | Explicit keep-existing commit; relational delta, canonical revision, replay receipt and staging cleanup are atomic |
| `POST /sync/imports/cancel` | Idempotent removal of only this owner's uncommitted staging; does not undo committed history |

The sync operation is `{protocolVersion:1, operationId, baseRevision, command, context:{now,date,timezone}}`, with optional immutable SYNC-02 `expected`, `observedRevision` and `predecessor` fields. IDs, payload and captured context are generated once and retained on retry. The server checks the selected account timezone, civil-date consistency and a bounded client clock (90 days past, five minutes future). Client time expresses personal action intent only; authentication, expiry, audit and transaction time remain database-derived. Small future skew is clamped only when its civil date remains unchanged. Stale clocks/timezones fail visibly and retain intent.

Timer completion becomes an explicit dated habit check/correction. Device-only drafts/timers/permission changes never become server commands. Calculated/manual prayer setup sends only sanitized dated coverage and supported preferences; it cannot upload samples or manufacture a prayer report. A device calendar observation without a personal delta sends no command and advances no revision.

Push consumes the outbox in dependency order. Each batch is atomic; failed validation or receipt/session failure rolls it all back. Exact replay returns the original minimal revision/XP receipt. The local queue is removed only after validated acknowledgment, in another version-checked transaction, without overwriting later local edits. Losing a response after commit therefore cannot duplicate XP.

Within one account session, local saves, receipt acknowledgment and remote snapshot installation share a serialized cache boundary. A private draft arriving during a pull retains the newer account records and its device-owned fields. Personal operations arriving during reconciliation retain their original IDs, conditions and captured context, and resume sending after the active pass. This ordering does not retry a stale write against another tab's version or weaken the store's owner/version/generation checks. Real intervening writes still preserve unsaved intent for explicit recovery; offline queues do not repeatedly restart the sender.

Foreground startup/focus/online activity and a 15-second visible-page interval drive synchronization. Transient failures use bounded exponential backoff with jitter, honoring bounded Retry-After values; manual retry/reconnect can retry sooner. Conflicts, validation errors and expired identity stop automatic sending. No Background Sync or executing service-worker timer is required. Requests time out after 15 seconds so unavailable account services cannot indefinitely block offline recovery.

Pull checks the head and fetches a coherent projected snapshot at initialization/recovery and after writes; an idle changed head can use compact deltas. Each page contains at most 200 rows and approximately 256 KiB (requests capped at 512 KiB). Cursors are revision-bound and owner-asserted. Any intervening commit invalidates the cursor; the client restarts up to three times, then retains its previous cache and reports failure. Page/record limits fail without truncation. Large snapshot hydration runs in a worker.

SYNC-02 adds compact owner-private incremental changes, semantic per-record conditions, removal barriers and explicit stale-device recovery. The client uses coherent deltas while idle and reconciles after writes; old cursors/floors trigger a full pull. Old format-one queues remain retained and conservatively checked. Independent records merge; competing corrections require a current-head review. Original IDs are never silently renumbered. The 90-day policy prunes opportunistically, without a scheduled purge guarantee. See [the complete recovery contract](SYNC-RECOVERY.md).

## Truthful status and recovery

- **Saving on this device:** transaction has not acknowledged completion.
- **Saved on this device / sync pending:** remembered cache and intent committed locally, with server work remaining.
- **Syncing:** the sender/read is active; this does not imply acknowledgment.
- **Synced:** no pending operations and successful server acknowledgment/head reconciliation.
- **Offline:** remembered edits are saved locally; session-only edits remain unsaved in memory.
- **Needs attention / sign in again:** records/intent remain retained; export or reauthenticate as indicated.

Storage quota/CAS failure cannot report a successful save. The previous committed state/outbox remains unchanged, unsaved intent remains exportable, and Retry writes the same operation IDs. Recovery downloads contain cached personal records and pending edits, without credentials; keep them private. The existing PWA update lease checks the selected repository's durability and blocks unsafe updates with unacknowledged session-only changes.

## Migration, verification and release limits

`20261021201759_consented_personal_sync.sql` adds two forced-RLS staging tables and bounded JSON compatibility for separate prayer tracking start/unknown legacy report time. It does not reset existing tables, rewrite previous migrations or alter guest formats. Normal provider roles have no staging-table access; owner-inclusive staging foreign keys and active-session policies apply. Apply through `npm run infra:up -- local` and `-- test`, never a database reset.

Run `npm run check`, `npm run test:infra`, `npm run test:sync`, `npm run test:auth`, `npm run test:backend` and the relevant production/PWA/journey/visual suites. All BFF/browser suites reserve 4191 and run sequentially. Real-code tests disable traces, videos and automatic screenshots. Layout captures use clearly marked visual-only metadata with no usable session or code. See [dated SYNC-01 evidence](evidence/sync-2026-10-22/README.md).

Keep additive schema and owner caches on rollback. Deploy a build capable of reading the current cache/command formats and task-reference columns before allowing account edits. A static older guest build cannot safely be described as account-sync capable; it must not clear `rise-accounts` to roll back. The original guest store remains independently usable. Cloud provisioning, live email, HTTPS device acceptance, production security/load/recovery, integrated shared-content lifecycle acceptance and hosted/physical-device background push remain separate release gates. Membership and family controls are locally verified; [exact squad sharing](SQUAD-SNAPSHOTS.md) is locally verified.
