# Local exact squad snapshots

**24 October 2026 · GROUP-03 · PRD-15.** The local/test implementation adds an owner-private server preview, explicit publication, author edits, encouragement, withdrawal and owner removal to the existing squad composition. Local acceptance is verified and recorded as REVIEW for hosted acceptance. [Evidence](evidence/squad-snapshots-2026-10-24/README.md). Cloud provisioning remains pending by the product owner's direction. [Optional group notifications](GROUP-NOTIFICATIONS.md) are now connected locally; [integrated shared lifecycle](GROUP-LIFECYCLE.md) is now locally verified; hosted operations and physical-device acceptance remain pending.

## Consent and source

The server builds the preview from the verified actor's committed personal records, the requested Monday–Sunday civil week and explicit sharing choices. The account must already be initialized; a read never creates a profile or imports a guest journey. The request asserts the selected account, personal revision, group revision, post ID and prior post revision. Account identity and the audit clock come from the verified session and database.

`src/domain/squadSnapshot.ts` reuses the existing habit, milestone and prayer calculations with an injected database instant and the account's saved IANA timezone. The group's timezone does not change the author's personal reporting week. Future weeks are rejected. The complete shared payload is:

| Field | Meaning and bound |
| --- | --- |
| `week` | Civil Monday, years 0001–9999 |
| `note` | Reviewed authored text, at most 600 Unicode characters |
| `habits`, optional | Checked habit occurrences, at most 1,000,000 |
| `milestones`, optional | At most 100 completed milestone titles, each at most 160 Unicode characters |
| `prayers`, optional | Explicit on-time/later records, at most 35 |

The note is trimmed before preview. A selection that exceeds the bounds fails with a readable error; it is never silently truncated. Empty text is allowed when an aggregate or milestone selection is present. Individual prayer dates/statuses, pauses, habit names, coordinates, work notes, private source records and credentials are rejected as payload extensions. Authored text and selected milestone titles can disclose private information, so the interface explains their audience and requires review. Even a selected aggregate may reveal patterns.

Every new update starts with all three sharing choices off. Editing an existing publication starts with its previously published choices and content. Language changes localize controls and errors without translating authored notes or milestone titles. Previewing, publishing, reacting, editing and withdrawing award no habit XP and do not change personal records.

## Exact preview and publication

`POST /api/v1/squads/preview` requires the normal verified session, Origin and CSRF checks. The BFF reads the actor's private records on its restricted owner/session connection, checks the personal revision, and passes only the bounded selected payload to the group capability. The group capability rechecks active membership, squad kind, archive state, group revision and author/post identity under the group lock. The group guard has no private-journey or provider-token access.

The private `rise_private.squad_previews` row stores the selected payload, post/source revisions, owner, group and database-created ten-minute expiry. Its SHA-256 hash is calculated from the stored JSONB. Only the creator receives the preview content and opaque ID/hash. No shared read, export, browser public cache or group receipt exposes the private preview. Expired previews are inaccessible immediately; the isolated worker removes them in bounded batches, and a new preview opportunistically prunes the actor's expired rows. A stopped worker cannot make expired previews publishable.

Publication uses `POST /api/v1/groups/commands` and `squad.publish`, containing only group/post/preview IDs and the hash. It does not accept replacement content. In one transaction the server rechecks the current actor and membership, the expected group revision, preview owner/group/post/hash/expiry and base post revision, stores exactly the previewed payload, consumes that preview, advances the group revision and records the minimal immutable operation receipt. Later personal edits never recalculate a published snapshot or alter a pending preview. New values require a new explicit preview.

The existing actor lock precedes the group row lock. Receipt failure rolls back publication and preview consumption together. A retry uses the original operation ID and body. A lost reply can be replayed after later group edits without overwriting them, but only while current membership remains valid. Conflicts retain the original pending operation and private draft; stopping a retry does not reverse an action already accepted by the server. A reviewed replacement uses a new operation ID against the current authorized head.

## Posts, reactions and removal

There is at most one active post per author, squad and week. An author can replace the active payload only through another exact preview. This preserves the post ID and existing encouragement. An owner cannot edit somebody else's post.

`squad.react` explicitly sets or removes the acting member's single encouragement. It cannot submit another reactor's identity. `squad.withdraw` erases the author's post payload, all its reactions and outstanding previews. `squad.remove` provides the same erasure for an owner removing abusive content. Both retain an opaque post-ID barrier so an old request cannot republish a removed ID. A later explicit new update receives a new ID and begins with sharing off.

Archived squads allow withdrawal, owner removal and removal of one's existing encouragement. They reject new publications and new encouragement. Leaving or removal immediately prevents future authorized reads and receipt replay; it does not retroactively revoke a snapshot that the author already chose to publish. Account deletion erases that author's posts and reactions, including posts from former memberships. Previously seen screenshots or copies cannot be recalled.

## Read and browser boundaries

`GET /api/v1/squads/:groupId?week=YYYY-MM-DD` returns at most 20 published posts, their stable group-member references, publication/update instants, current post revisions, chosen payloads and aggregate/own-reaction state. It never returns Auth account IDs, private source revisions, preview IDs or withdrawn payloads. An optional `authorMemberId` allows a bounded lookup of the current member's post independently of feed pagination. Further pages require the returned cursor and group revision. Reads use one statement snapshot for membership, group revision, payloads and reactions, with `Cache-Control: no-store`.

`src/groups/squads.ts` keeps pages only in memory. Account/scope changes, membership loss and group-revision changes abort and discard old results, including late successes and errors. Continuation pages cannot mix revisions or duplicate rows. A failed continuation clears the partial feed and retains explicit reload. A transient unavailable result can also retry from the first page after fresh successful group metadata, even at the same revision. Busy/receipt updates cannot trigger a retry loop; authorization errors, account switches and membership loss retain their existing fences.

`src/groups/SquadScreens.tsx` uses the existing composition and controls. The selected account's durable draft helpers retain authored text, choices, stable post/group revisions and, after a successful preview, only its opaque ID/hash. The exact preview payload remains component memory. Reopening a saved draft requires a fresh preview before publication. Durable acknowledgment precedes save success. A draft edit removes its preview reference; late publication acknowledgment cannot erase a newer draft. Pending group intent contains no note, selected titles, totals or private records. Portable backups exclude these operational group drafts and cannot restore membership or publish content.

Preview preparation waits for local durability and account sync, then sends the acknowledged personal revision. A concurrent source revision change fails closed. Account changes, unmount, a different draft, or a newer group head fence an outstanding preview response. Conflict review shows the currently shared post alongside the retained draft and requires an explicit choice before creating another preview. Unavailable or expired previews never silently regenerate and publish.

## Database and lifecycle

`rise.squad_posts`, `rise.squad_reactions`, `rise_private.squad_previews` and `rise_private.squad_limits` all force RLS. BFF/authenticated SELECT grants expose only member-authorized published columns. Direct writes and private preview reads are denied. The non-login `rise_group_guard` owns the fixed, empty-search-path stage/mutation functions; runtime roles cannot assume it. Only the BFF executes those functions. The worker receives only the expired-preview cleanup capability and cannot read payloads. See the [membership boundary](GROUP-MEMBERSHIP.md), [security policy](../SECURITY.md), [official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function guidance](https://supabase.com/docs/guides/database/functions).

Default operator limits are 20 outstanding previews per account, 10,000 post IDs per group including removal barriers, and 1,000 reactions per post. The existing group mutation quota also applies to preview requests. The private limits table has bounded configuration ranges. GROUP-04 adds [bounded invitation history](GROUP-INVITATIONS.md) and [optional generic message controls](GROUP-NOTIFICATIONS.md).

Account pre-suppression cleanup takes the actor lock and sorted affected-group locks, including former memberships and retained posts/reactions/previews. Ownership must already be resolved. It erases the actor's squad content and advances affected group revisions before membership identity scrubbing and suppression can commit. A failed suppression transaction rolls back this cleanup. The terminal lifecycle hook requires the retained suppression ledger and repeats cleanup for restored pre-deletion data before managed Auth purge. Old credentials cannot revive access. Group/Auth-root cascades independently remove dependent records.

Stable group/member references are composite foreign keys. The post/reaction member references are deferred to transaction end so deleting a group can cascade through memberships and posts in either database order while still enforcing the final boundary. Existing family history remains deidentified according to its own contract. GROUP-04 now erases recipient and source-author jobs before suppression and on terminal replay; a missing installed notification cleanup hook still blocks deletion.

## Migrations and rollback

The additive migrations are applied to both retained local/test installations:

- `20261023184555_exact_squad_snapshots.sql` adds the four tables, forced RLS/grants, exact preview and mutation functions, cleanup capability, receipt kinds and squad lifecycle hooks.
- `20261023185202_squad_group_cascade.sql` defers only the two composite member-reference checks to permit a complete group cascade.

Previous migrations, cache formats 1/2, guest storage, original review simulations and the visual references remain compatible. No environment or profile reset is required.

Roll back exposure by disabling the squad routes and controls while retaining data, receipts, removed-ID barriers, preview cleanup and compatible lifecycle hooks. Do not edit applied migrations, drop the tables, remove the suppression ledger or restore older cleanup code against populated squad data. Pending local drafts must remain recoverable. The current worker must accompany the schema capability it calls; an older sender may omit preview cleanup, but the database expiry check still prevents publication. Hosted supervision, restore operation and physical-device acceptance are separate pending gates.
