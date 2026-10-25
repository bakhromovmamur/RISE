# Local conflict and stale-device recovery

**Scope:** SYNC-02 · PRD-04 · NFR-07 · 22 October 2026.  
**Delivery:** local BFF/Postgres/Auth only. Cloud provisioning, deployment and external email remain pending. [Account deletion](ACCOUNT-LIFECYCLE.md) and [real membership](GROUP-MEMBERSHIP.md) are implemented locally; the [shared task/list controls](SHARED-CONTENT.md) now use the same account cache and recovery boundary.

This extends [account synchronization](ACCOUNT-SYNC.md), using the same interface, domain reducer and owner/session authorization. It does not alter the guest database, legacy migration source, prayer rules, XP rules, CSS, artwork or visual references.

## Conflict contract

Every accepted command still commits canonical relational changes, one account revision and a minimal idempotency receipt in one transaction. The owner advisory lock serializes decisions. A sync operation may additionally contain:

| Field | Meaning |
| --- | --- |
| `expected` | SHA-256 fingerprint of the command's semantic read set, generated before its optimistic edit |
| `observedRevision` | Last acknowledged canonical revision when this device authored the intent |
| `predecessor` | Stable immediately preceding queued operation, when present; permits a direct deliberate successor of its own removal |

The read set includes relevant dated records, parent targets, eligibility and planning timezone. For example, a reflection depends on its date, a habit check on its habit/version and dated occurrence, a prayer correction on its saved window/report/pause state, and reward enjoyment on its fixed goal/week condition. The server constructs that same read set from current authorized records. The fingerprint is a concurrency condition, never an authorization credential. It contains no raw location/calculation keys or drafts. Current clients hash through the existing digest helper; specifically SHA-256 of the JSON encoding of the canonical read-set string. Short-lived in-memory read-set text is replaced before durable outbox insertion. Older bounded textual conditions remain readable.

| Race | Local behavior |
| --- | --- |
| Exact same operation retry | Original revision/XP receipt, no second effect; ID/payload/context/conditions remain immutable |
| Different entities or independent dates | Merge against current authorized state when their semantic dependencies still match |
| Identical habit check states | Converge only if the target/history conditions still match; never award duplicate XP |
| Full versus Undo; competing prayer/target/reward correction | 409, retain local intent; no automatic revision renumbering or destructive overwrite |
| Archived habit/goal/reward or retired milestone | Reject stale edits; no stale override of unavailable records |
| Clear, then later recreate a check/report | Removal revision prevents the old apparent value from defeating deletion precedence |
| Explicit goal/reward restore | Existing authorized restore command, based on the current reviewed state; no new habit-restore control |
| Expired/revoked/different account | Deny/hide under the existing verified-session boundary; no recovery override of authorization |
| Old client without conditions | Conservative account-revision checks remain; upgrade does not rewrite or automatically resubmit its queue |

A fresh action on retained archived history can still use the existing domain rules when its current condition and observed revision match. For example, correcting a retained historical habit check or starting a separate next-week reward attempt does not unarchive its parent. An old archived intent is not offered as a recovery override.

Dependency sets are deliberately conservative within a goal, reward condition, ordered daily priority set or pause range. Independent habit checks/dates and reflections can merge; two dependent changes can still require review even if a human could combine them. Accepted no-ops advance the canonical revision once. Domain validation can reject an otherwise unchanged dependency set when capacity, eligibility or clock rules no longer permit the action.

GROUP-02 extends that check to new opaque family-task priorities. Current membership, active group/task and the dated schedule are verified during both review and commit. A lost-access target has no override; existing selected references can still be reordered or removed. A committed personal receipt acknowledges private intent without returning shared content. Older habit/milestone priority fingerprints stay unchanged when the new nullable task columns are added. See [the priority boundary](SHARED-CONTENT.md#private-priorities-and-browser-reads).

## Tombstones, removal barriers and retention

`rise.sync_changes` is a compact latest change per owner/table/primary key. Fixed table identifiers, canonical keys, revision and a deletion flag identify updates or ordinary tombstones. It stores no private row payload. Removal barriers retain the revision and operation responsible for a cleared habit check, deleted prayer report, archive or retired milestone, including across later changes to that key. The account's `sync_state.floor_revision` advances monotonically before expired replay/change metadata is removed.

Receipts and ordinary change/tombstone metadata older than 90 days are pruned opportunistically under the owner's lock during eligible command/delta work. Active private records do not expire. A busy updated key retains its earlier barrier until its compact entry itself expires; a stale device must then cross the account's rebase floor. There is no scheduled all-account purge job in this task: an inactive account's metadata can remain longer than 90 days until activity/maintenance. Scheduled cleanup and hosted monitoring remain OPS-02. Exact receipts checked before pruning can still return their original result.

The BFF remains unable to update receipts. Its new DELETE policy permits only the currently authorized owner's receipts that the database considers older than 90 days. No ordinary request uses administrator/service credentials. Forced owner/current-session RLS protects both new tables; ordinary provider, worker and lifecycle roles receive no grants. Account-level deletion suppression and local ledger replay are implemented by DATA-04; full backup restoration remains OPS-02. Ordinary tombstones do not replace those controls.

## Incremental changes and coherent snapshots

`POST /api/v1/sync/changes` accepts expected account, `since`, pinned head `revision` and offset. It returns at most 200 entries/about 256 KiB and a next offset, ordered by revision/table/key. Each entry contains the projected current row or a null tombstone. Changes are compact, not an audit history. The server reads current rows only from fixed table definitions. An intervening commit invalidates the head/cursor; a request before the retention floor requires a full snapshot.

The client stores the coherent canonical record projection separately from its optimistic state. When an idle head advances, it applies bounded deltas to that projection, restores canonical ordering and validates hydration. A stale cursor/floor falls back to the existing bounded full pull. Large hydration uses the existing worker. A successful push invalidates that prior projection and requires a full reconciliation, including when the initial post-ack pull was lost. Therefore a later equal head cannot make an unreconciled optimistic cache appear Synced.

Local implementation still reads the bounded current relational set to assemble a delta page. This provides coherent, bounded wire responses; it is not evidence of hosted large-account throughput. Load verification remains QUALITY-03/SAFE-01/operations work.

## Explicit recovery workflow

In **You → Settings → Your data → Account**, a conflict offers **Review pending changes**. The steps are:

1. Read a full current authorized account snapshot. A failed read or failed storage transaction preserves the original cache/outbox.
2. Atomically retain the complete original optimistic state and original queue as one private recovery point; open the current account state for review. Older format-one caches are accepted without resetting IndexedDB or rewriting guest data.
3. Review queued actions one at a time. The screen shows the current account record and the retained local action. Other account editing is held while unresolved actions remain.
4. **Keep account record** records the explicit choice. The original action remains in the recovery point; it is not resent.
5. **Apply my action** is available only after a fresh server permission/eligibility check. It creates a new operation ID, current-condition fingerprint and current account time/timezone, preserving the command's selected record date. An old habit check becomes an explicit dated correction. The original ID is retained for recovery, not silently recycled.
6. Wait for server acknowledgment/reconciliation before the next action. If another edit arrives, the reviewed head or new condition fails, and review must refresh. A failed reapplied action can itself enter the remaining review without dropping either intent.

A committed original receipt is identified as committed and cannot be applied again. Reused operation IDs, unavailable/archived records and invalid/now-ineligible actions offer no local override. A preview is bound to owner, current head, cache version and recovery index. Multi-tab CAS, storage quota failure, interrupted requests and reauthentication cannot silently advance a decision.

Outboxes beyond 90 days or the retained revision floor stop before ordinary sending and require this full-snapshot review. The server checks retained receipts where available; after expiry, it does not infer that an unknown ID was never applied. Review is explicit even if a stale action looks harmless. Authentication/expiry/audit clocks remain server/database controlled; captured time is personal intent only.

If a recovered account timezone differs from this device's saved calculation timezone, the old calculation is not reactivated. The complete original location setup remains in the recovery point; active location setup needs review. Saved dated prayer windows/reports remain intact.

One recovery point remains downloadable after review finishes and until the next explicit recovery or confirmed account-cache purge. A later recovery replaces it, as explained before starting. It can contain religious practice, pause ranges, free text and device location settings from that account's original local state: keep the download private. It is a local recovery artifact, not a server export/restore API. No credentials are included. Session-only recovery remains in memory; closing the tab without export can lose it.

Unresolved recovery decisions count as pending for active and inactive account scopes, sign-out/discard consent, status and private recovery export. Confirmed logout follows the existing version-bound policy; newer pending work remains locked. Switching identities cannot display/send the old recovery as a different owner.

## Migration and rollback

Apply the two additive CLI-generated migrations through the existing environment controller:

- `20261022100855_sync_conflicts_and_retention.sql`: owner-private compact changes/floor, indexes and expired-receipt DELETE policy. Existing profiles begin at a full-snapshot floor without rewriting their records.
- `20261022101526_sync_removal_barriers.sql`: removal revision/operation metadata on compact entries.

`rise-accounts` stays IndexedDB version 1; cache formats 1 and 2 are readable. Format 2 adds optional canonical records and the retained recovery point. State, queue, source and decisions use the existing strict version-checked transaction. Do not reset either database or delete caches to roll back. An older client that cannot parse format 2 must remain stopped with an export opportunity, not initialize an empty account. Guest mode remains independent.

## Verification and remaining gates

See [dated evidence](evidence/sync-recovery-2026-10-22/README.md) for actual command results, browser versions, preservation hashes, database policies and synthetic captures. Tests include concurrent check/Undo, prayer/reward corrections, archives/retirement, deletion/recreation, receipt failure rollback, old-format/old-clock recovery, stale preview, storage failure and owner/current-session denial.

INFRA-01 now supplies the browser-compatible 4192 entry while retaining the original 4190 installation. These historical sync checks use isolated 4191. Local account deletion, Web Push and real membership are implemented; physical mobile/HTTPS installation, hosted load/security, hosted retention jobs and integrated shared-content lifecycle acceptance remain separate gates. [Exact squad sharing](SQUAD-SNAPSHOTS.md) is locally verified. Cloud provisioning is still pending by user instruction.
