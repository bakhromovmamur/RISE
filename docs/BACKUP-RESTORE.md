# RISE private backup and restore

Implemented for DATA-02 on 21 October 2026. This is device-local portability for the mobile web app. It does not provide an account, cloud backup, server authorization or guaranteed protection against browser eviction.

## User workflow

1. Open **You → Settings → Your data**. Read the privacy notice before choosing **Export local data**. Export waits for pending saves, reads a committed revision and prepares the file in a worker. A failed export never changes the profile.
2. Keep the downloaded `rise-backup-YYYY-MM-DD.json` somewhere private. It contains religious-practice history, private notes and any saved location settings. It is **not encrypted**. Its SHA-256 checksum detects corruption, not authenticity.
3. Choose **Restore a backup** and select a RISE JSON file. Versioned backups and legacy schema 1–4 exports are supported. Reading, validation and comparison run in a dedicated worker. Cancel terminates that work; closing the sheet also cancels it.
4. Review the record counts, date range, timezone, habit XP and comparison. This is a full device-profile replacement, not a merge. Matching records appear once, incoming values win conflicts and current records absent from the incoming profile are removed. An explicit checkbox enables replacement; selecting a file alone changes nothing.
5. After a successful transaction, the profile is available immediately and after reopening. **Previous device profile → Preview previous profile** allows a second explicit replacement with the exact local pre-import snapshot. It replaces any subsequent edits. The next successful restore or rollback replaces the one retained recovery point.

Download a separate backup rather than relying on that recovery point. **Clear local data** removes the profile contents, archives, recovery point, original migration source and local receipts. It leaves a revisioned empty record so stale tabs cannot silently restore cleared data. Browser storage deletion or eviction can also remove the recovery point. None of these actions deletes an account. The separate [DATA-04 account lifecycle](ACCOUNT-LIFECYCLE.md) now implements that explicit action locally; hosted provisioning remains pending.

## Portable content and deliberate exclusions

The exporter uses an explicit field projection. Supported personal records retain their authored text, IDs, dates, schedules, materialized habit history, XP inputs, prayers, Fajr plans and acknowledgments, private pauses, goals/milestones, rewards/corrections, priorities, preferences, reflections and understood drafts. Historical draft fields embedded in older habit versions are retained. DATA-03 adds understood habit-edit, goal, reward, ordered-priority, reflection and onboarding drafts; unfinished drafts stay drafts and do not create completed records. XP is derived; restore does not grant extra XP or recompute shared snapshots.

Precise saved coordinates and historical calculation keys can appear in this user-requested private file. They remain excluded from routine account synchronization and notification projections. Export does not request location or notification permission.

Credentials, sessions, push subscriptions/endpoints, invitation codes, unknown extensions and unrecognized drafts are excluded. A malformed known draft blocks the portable export rather than silently discarding its data. The current profile and original source stay intact. Export failure exposes the existing **device recovery archive** for manual preservation; this unfiltered archive is sensitive and is not accepted by the normal restore screen. The legacy recovery download is also retained when available.

Current groups are local simulations. Only groups where `self` is still a member and has not left are projected, with their permitted shared tasks, lists and explicitly shared weekly snapshots. Invitation secrets are omitted. The projected content lives in `data.localArchives`, separate from `data.personal.life`'s empty live group/task/list/update arrays. After import it is stored in repository metadata and is readable, without edit, invite or membership actions, from the restore sheet. It cannot become live membership through a file. Future server groups require current server authorization and deletion/revocation replay; local membership fields are not evidence of those permissions.

Portable restore disables device delivery, clears a currently ringing alert and resets device readiness. It retains reminder preferences, dated plans and acknowledgments; enabling delivery again is a separate explicit action. Exact same-device rollback returns that device's original local preferences and simulations, not any server access. The current browser/OS permission remains authoritative.

## Version 1 envelope

| Field | Contract |
| --- | --- |
| `format` | Exactly `rise.private-backup` |
| `version` | Exactly `1`; unknown/future versions fail closed |
| `schemaVersion` | Exactly `4`, the existing domain schema |
| `exportedAt` | Valid ISO date/time |
| `timezone` | Valid IANA zone, equal to the personal profile zone |
| `counts` | Computed habits, habit checks, prayer checks, goals, rewards, groups, tasks, lists, shared updates and drafts; checked against content |
| `data.personal` | Validated schema-4 personal profile with no active shared collections or imported device permission |
| `data.localArchives` | Separate local shared snapshots; each bundle has groups, tasks, lists and updates |
| `checksum` | `{ algorithm: "SHA-256", value: "<64 lowercase hex characters>" }` |

Checksum input is UTF-8 canonical JSON of the envelope **without** `checksum`: object keys sorted by code-unit order, array order unchanged, standard JSON string/number encoding, no whitespace. No Unicode normalization is applied to authored text. Reformatting JSON or reordering object keys does not invalidate the checksum. A recomputed checksum cannot bypass payload validation, projection checks or reference constraints.

Legacy exports have no checksum. Their source schema is displayed through provenance metadata, and they undergo the same limits and full state validation before known-field projection. Legacy schema 1 adds no invented prayer activity. Imported provenance remains demo/mixed or unverified, always `cloudEligible: false`; nothing is uploaded.

## Limits and preview meaning

The entire uncompressed input must fit **50 MiB**, **250,000 object records** and **20 nesting levels**. Arrays are containers, not additional object records. File size is checked before reading; strict UTF-8 decoding rejects damaged byte sequences instead of silently replacing authored characters. Byte length and structure are checked after decoding. Files are never decompressed or evaluated. Dates, finite numbers, enumerations, text lengths, timezones, IDs, duplicate entities and live references are validated. Prototype-related keys, unsupported schemas, malformed records and checksum mismatches fail without a database write. An export exceeding the supported format limit fails without truncation and offers raw preservation.

Preview comparison uses stable entity IDs or dated keys: habits, materialized habit occurrences, prayer days, Fajr preparations, reflections, priorities, goals, rewards, pauses and local archive entities. Settings and drafts form one settings record. Nested milestones/list items remain part of their parent entity. Archives are separate snapshot bundles and use bundle position plus entity ID. Counts therefore describe these comparison units, not individual changed scalar fields. The date range includes dated history and plans, including future targets; it is not a claim that all those dates have accomplishments.

## Commit, rollback and compatibility

`DeviceStore.restore` detaches and revalidates the staged payload and content hash. One strict IndexedDB transaction checks the expected revision and operation receipt, saves the previous record under `recovery/pre-import`, writes the replacement and adds a local-only restore receipt. An in-transaction readback must equal the proposed record. Only transaction completion acknowledges success. Quota errors, transaction aborts or failed readback roll back all writes, including the recovery point. Retry with the same operation ID/content/base revision is idempotent; reusing it with a changed payload is rejected.

A tab that has saved since the preview causes a conflict, not a whole-profile rebase. The user must preview again. Rollback also checks the current revision and the selected recovery-point ID, so a newer restore or clear cannot silently reuse an old preview. The exact previous record is available only from this database, never supplied as an authoritative rollback record by an imported file.

The database stays at **version 1**, with object stores `profile`, `recovery` and `outbox`. Domain state stays at **schema 4**. Existing DATA-01 records with repository `format: 1` remain readable. Restore, rollback and explicit clear write **repository `format: 2`**, which older DATA-01 clients reject instead of unknowingly modifying a profile with new recovery/archive metadata. Roll back application assets only to a build that understands repository formats 1 and 2 and all saved command kinds/context. DATA-03 expands those receipts without changing database/profile versions; an older command parser fails closed on unfamiliar receipts. Raw archive export remains the preservation path for unsupported versions.

The exact `rise.local.v1` source remains unchanged through export, preview, restore and rollback; only explicit clearing removes it. If an older client changes it unexpectedly, the existing legacy-drift protection blocks writes. Local receipts are not a cloud sync queue and contain no whole-profile export payload. DATA-03 receipts do contain the private intent payload (including draft revisions); portable backups exclude receipt history, while raw device archives preserve it. Treat raw archives accordingly.

## Verification and boundaries

Use synthetic profiles on test origins 4180/4181/4182. Never rehearse against the personal preview on 4173. The [DATA-02 evidence report](evidence/backup-2026-10-21/README.md) records the final runs, failure injection, two-year/100-habit round-trip, localization/reflow and unchanged visual references.

Physical disk exhaustion, forced OS termination after acknowledgment, real iPhone/Android behavior, authenticated sharing, account deletion replay, encrypted server backups and hosted release operations remain separate gates. Injected browser transaction failures prove atomicity of this adapter, not those unperformed checks.

### DATA-04 account files

The authenticated account sheet now downloads `rise.account-export` version one after recent-auth verification. It includes full known relational private history and excludes credentials/other owners. This restore screen validates that file and previews its **current personal projection** for device-profile replacement; retired milestones and older inactive work notes remain in the original full file, as the preview explains. Original timestamps/dates/XP remain unchanged. It cannot revive the source account, permissions or membership. See [account lifecycle](ACCOUNT-LIFECYCLE.md) for deletion, retention and operator ledger replay; the deletion ledger is not an app backup.

### GROUP-05 shared files

`rise.group-archive` version one is a separate explicit current-member download from Group settings. It includes authorized family history or published squad snapshots; it is not a private restore input. The private parser rejects it before mutation. It cannot recreate live groups, memberships, consent, invitations or account access. Existing private and legacy simulation archive formats remain unchanged. [The shared-file contract](GROUP-LIFECYCLE.md) records validation, current authorization, deletion and server-backup replay evidence. Encrypted hosted backup operations remain a separate gate.
