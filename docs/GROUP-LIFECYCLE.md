# Shared archives and integrated account lifecycle

**24 October 2026 · GROUP-05 / PRD-14, PRD-15, PRD-18.** This local/test increment adds an explicit shared download and verifies the installed membership, family, squad and notification deletion hooks together. Cloud provisioning remains pending. Local acceptance is verified and the task is in REVIEW for hosted operations and physical-device acceptance. [Dated evidence](evidence/group-lifecycle-2026-10-24/README.md). This is not a release verdict.

## Explicit shared download

Group settings provide **Download shared archive** for current members, including members of an archived group. The review explains the contents, their sensitivity, private storage, the separate personal-backup boundary and the inability to recall an already downloaded copy. A checkbox and explicit download action are required. The same review, errors and accessible labels are available in English, Russian and Uzbek Latin. Authored names and content retain their original language.

The server requires authentication within ten minutes. An expired authentication opens the existing same-owner email verification flow; verification returns to review with confirmation unchecked. It never automatically downloads. A changed group requires review of its latest saved revision. A failed request produces no partial file; a lost reply can be retried explicitly. The UI reports that a download started, not that the browser saved it to disk.

`src/groups/archive.worker.ts` fetches, validates and hashes the file away from mobile navigation. The component retains only its review state; no shared file or response is written to IndexedDB, local storage, a durable draft or the PWA cache. Cancellation, unmount and observed group/account changes terminate the worker. A final scope/revision check fences a late response before creating the download. The worker also verifies the expected group, revision and current member ID. Its bounded lifetime is sixty seconds.

## File contract

`rise.group-archive` version 1 is a separate JSON file with a SHA-256 integrity checksum. It contains the database UTC export instant, group ID/kind/name/IANA timezone/revision/archive status, current members' chosen names and roles, and the following closed projection:

| Group | Included |
| --- | --- |
| Family | Current tasks, including archived tasks; every materialized dated completion/Undo snapshot with its original title, notes, assignee, timezone and task revision; lists, including archived lists; current nonremoved items with quantities, order and checked state |
| Squad | Currently published exact snapshots across weeks, publication/update instants, stable author member references and aggregate/current-requester encouragement state |

Historical assignment, completion and author references are opaque member UUIDs. A departed or deleted member's name is not recovered through an expanded query. Current member RLS remains in force. Family content is shared group content; deletion removes account identity while retaining that history. Squad account deletion erases authored snapshots, reactions and unpublished previews under the existing policy.

Excluded fields include Auth user IDs, other members' private records, session/provider credentials, invitation metadata/secrets, installation/subscription data, notification consent/preferences, source personal revisions, unpublished previews, withdrawn/removed text and operational drafts. The archive grants no access and carries no restore command.

`src/contracts/groupArchive.ts` validates exact fields, version, dates, times, timezones, enums, Unicode limits, unique IDs/order positions, group/revision coherence, task/list references, historical snapshot revisions, completion consistency and the checksum. The existing whole-file limits remain **50 MiB UTF-8, 250,000 object records and depth 20**. Exceeding a limit rejects the complete file without truncation.

The existing `rise.account-export` v1 remains a private-only format with `shared: {available: false, items: []}`. Its historical records and private restore behavior are unchanged. The private restore parser rejects `rise.group-archive` before mutation; it cannot initialize an account, recreate membership, restore invitation authority, grant consent or publish a squad post. Existing legacy/simulation archives retain their separate read-only behavior.

## API and consistency

`POST /api/v1/groups/:groupId/export` accepts exactly `{accountId, revision}`. It is local/test only and requires exact Origin, CSRF and a verified current session. The account assertion must match the actor. The response is `application/json`, `Cache-Control: no-store`, `Vary: Cookie`, with the fixed filename `rise-group-archive.json`. Filenames do not contain group names or user text.

`server/groups/export.ts` takes the existing shared actor lock and recent-authentication check. Metadata and each bounded 200-row page execute on the ordinary restricted BFF connection, under existing current-membership RLS. No service/admin credential, new database role, write grant, definer capability, schema migration or persistent export table is introduced. [Supabase documents how grants and RLS combine](https://supabase.com/docs/guides/database/postgres/row-level-security).

Every page asserts the reviewed monotonic group revision. The final metadata/recent-auth check follows file validation and hashing; `Sessions.asActor` performs its final authorization check before transaction completion. A concurrent edit or removal invalidates the entire result. A copy authorized before a later removal cannot be remotely recalled. Export does not create a personal profile or award XP.

Family and squad exports reuse the screen readers' known-field SQL projections from `server/groups/projections.ts`. Pages use keyset continuation rather than one query per task/list. The inner page explicitly binds the requested group ID so the planner can use that group's distribution and the existing ordered indexes. Correlating only on the outer group hid that distribution and caused a full-history sort before LIMIT in the large-history regression. [PostgreSQL explains the ordered-index/LIMIT distinction](https://www.postgresql.org/docs/current/indexes-ordering.html). No authorization predicate or database timeout was weakened to resolve it.

## Deletion, stale devices and backup replay

The integrated path retains the existing account lifecycle contract:

1. An owner must transfer ownership or delete each owned group. Archiving alone does not resolve ownership. A blocked deletion leaves content and identity intact.
2. Accepted deletion atomically removes recipient/source notification jobs, revokes invitations, removes group preferences and authored squad data, deidentifies membership and suppresses sessions. Failure at the suppression write rolls the entire operation back.
3. Remaining members can export retained family history with opaque former-member references. They cannot recover deleted squad text or the former member's name through the archive. The deleted actor cannot export, mutate or initialize records with old credentials.
4. The isolated lifecycle worker repeats terminal group cleanup and performs the tracked primary/provider purge. Owner-root cascades remove personal history and installation records. The minimal ledger remains for 35 days after verified primary purge.
5. Offline server-backup restore must apply the retained authoritative deletion ledger and terminal cleanup before serving restored content. Restored memberships, preferences, posts, reactions, previews, subscriptions or jobs do not override suppression. Never remove the ledger to repair a failed purge.

The selected-account cache and deletion markers keep their existing formats and generations. Shared response content is memory-only. Account/scope changes dismiss private group forms. Device cleanup retains the guest profile, other owners and public PWA cache. A previously downloaded file remains outside this revocation boundary. See [account lifecycle](ACCOUNT-LIFECYCLE.md), [membership](GROUP-MEMBERSHIP.md), [shared content](SHARED-CONTENT.md), [squad snapshots](SQUAD-SNAPSHOTS.md) and [group notifications](GROUP-NOTIFICATIONS.md).

## Verification and recovery

The final check passes 267 unit/tooling tests, including four archive-contract cases. All 164 database/BFF cases pass, including eight archive/combined-lifecycle cases. All 108 group browser cases pass across Chromium, WebKit and Firefox, including twelve download-flow cases and three cross-tab deletion/stale-cache cases. Twelve existing private lifecycle cases, 42 PWA, 54 production-entry and twelve navigation checks also pass. The group layout matrix covers 6,480 states; all 720 frozen visual comparisons remain unchanged. The dated evidence records exact commands, versions and scope. Tests use only synthetic accounts/subscriptions in the fixed test installation. No external email, invitation, push or hosted deployment is performed.

Bulk test history is analyzed after insertion so its query plan represents retained data. The original correlated query still fails with those statistics; the explicit group parameter reaches the supported size-limit response under the unchanged restricted role and timeouts. Initial failures and their exact commands are retained in the completion evidence.

Exposure can be rolled back by removing the export button and route while keeping current data, private formats, account deletion markers and all installed lifecycle hooks. No database rollback is needed. Keep the installed sender and lifecycle cleanup compatible with populated group data. Hosted backup expiry, supervision, physical-device delivery and release certification remain separate gates.
