# DATA-01 — durable local storage and safe migration

**Date:** 21 October 2026 · **Task:** DATA-01 · **Requirements:** PRD-02, PRD-04, NFR-07. This report covers the local mobile web implementation. It does not certify deployment, cloud sync, background alarms or physical devices.

## Delivered behavior

The application now uses IndexedDB database `rise-device`, database/envelope version 1 and domain schema 4. The adapter commits a profile revision and local operation receipt atomically, requests strict durability, resolves saves on transaction completion and rejects competing revisions. Stable operation identifiers prevent duplicate replay. BroadcastChannel updates idle tabs; focus/visibility refresh provides a fallback. Confirmed clearing advances the revision, preventing stale tabs from resurrecting cleared records.

Legacy versions 1–4 are validated and migrated in a worker. The exact `rise.local.v1` string is retained unchanged, both in localStorage and the recovery store. The candidate and original commit together; a separate readback verifies every normalized field against its SHA-256 digest before the verified marker is committed and read back. Interrupted migration resumes safely. Unsupported, corrupt, oversized or unsafe data cannot become a writable empty profile. Startup also checks for legacy changes that happened during migration.

Validation covers the stored schema, finite numbers, dates/timezones, enum values, duplicate IDs/occurrences, live references, prototype keys, field lengths, depth 20, 250,000 object records and 50 MiB JSON. Unknown safe fields and unfinished drafts survive. Historical priority/reward references can outlive edited milestones. No migration invents people, achievements or prayer records. The summary flags sample timetables and known fixture signatures even in fresh mode; other legacy origins remain unverified. Settings → Your data presents the dated counts, provenance and original download. All records and outbox entries are cloud-ineligible.

Storage failures pause unsafe writes and preserve the previous committed state. The unsaved version remains exportable; retries keep the same operation ID. Conflicts require explicit reload/discard after an export opportunity. Invalid edits cannot silently become a successful save. Recovery offers the original bytes and a raw database archive, including records a newer database version prevents this client from opening normally. English, Russian and Uzbek copy uses the existing interface components and visual tokens.

## Scope and implementation boundaries

`src/data/validation.ts`, `storedState.ts`, `migration.ts`, `migration.worker.ts`, `indexedDb.ts`, `deviceSession.ts` and `StorageNotice.tsx` implement this boundary. App startup, the context and confirmed clearing use it. Existing screens retain their setter contract and optimistic behavior through the compatibility bridge. Their conversion to individual commands is DATA-03.

The existing validated command repository also works against the actual IndexedDB adapter. Its domain commands enter the local outbox. Compatibility writes store a revision/hash receipt without a private whole-profile payload; these are not replayable server commands. There is no cloud sender, and no coordinates or raw calculation key are placed in a generic outbound snapshot. Consented import and server projections remain future work.

The normal interface and domain rules are unchanged. The only new surfaces are storage status/migration details inside Settings → Your data and required recovery states. Tests now read IndexedDB and wait for its committed-save acknowledgment before reload. Their original journey assertions remain. One synthetic collection fixture now supplies the referenced habits rather than dangling occurrence IDs, so it meets the validated schema.

## Verification

All required checks passed. Exact case lists, versions and build/source hashes are in [verification.json](verification.json).

| Check | Result |
| --- | --- |
| Pinned toolchain, lint, types, production/review builds | Passed |
| Domain, migration and tooling tests | 88 passed |
| Full browser journeys and storage checks | 234 passed across Chromium, WebKit and Firefox |
| Final focused storage checks after final guards | 33 passed, 11 per engine |
| Final production-entry/recovery checks | 24 passed, 8 per engine |
| Frozen visual comparisons | 48 variants, 720 exact screenshots; no reference changes |
| Documentation | 172 local links, 47 anchors; 38 tasks with consistent status |

The full journey and visual run preceded final guards for invalid-edit recovery, stale refresh results and a legacy source changing during migration. All 33 targeted storage cases and 24 production cases then passed against the final build. Normal screen composition and CSS did not change after the complete visual run. Fault injection is not presented as actual browser disk exhaustion.

Recovery examples at 200% text: [320 px](recovery-320-200.png), [375 px](recovery-375-200.png), [393 px](recovery-393-200.png), [430 px](recovery-430-200.png).

Coverage includes schema 1–4 preservation of authored fields, XP, reward eligibility, check kinds, historical targets, pauses, notes and drafts; hostile/future/partial data; exact raw downloads; pending migration interruption and altered readback; atomic rollback when recovery/outbox writes throw an injected `QuotaExceededError`; operation retry/reuse; competing tabs; stale writes after clear; BroadcastChannel and focus fallback; changed legacy source; unsupported database version recovery; invalid unsaved edits; and a two-year/100-habit profile with 73,100 occurrences through actual IndexedDB readback.

The visual suite uses all 720 existing golden images: 48 combinations of English/Russian/Uzbek, light/dark, 100%/200% text and 375/393/430 px/desktop. References were not regenerated. New recovery captures cover 320/375/393/430 px at 200% text. Only isolated synthetic browser contexts on ports 4180–4182 were used; the saved profile on 4173 was not accessed or seeded.

## Recovery and rollback

- Do not delete `rise.local.v1` to finish a migration. It is the preserved original, not the ongoing save target.
- On a failed save, export unsaved changes and the recovery archive before closing the tab. Retry can complete the same operation. After a conflict, reload the saved copy only after preserving wanted edits.
- An unsupported or corrupt database must be exported and repaired by a compatible version. Do not downgrade/delete the database or ship the older localStorage-only application as rollback.
- The original source is deleted only by the existing explicit Clear local data confirmation. A versioned empty profile remains to reject stale writers.
- These downloads preserve data. Validated, previewed restore and pre-import rollback are DATA-02, not a claimed feature of this recovery archive.

## Limits

Browser storage is origin-local, sensitive to same-origin code and subject to browser eviction or explicit clearing. Transaction acknowledgment does not certify survival of device loss or forced termination before acknowledgment. Fault tests inject quota/abort exceptions into real browser transactions; they do not physically fill a device disk. WebKit automation is not physical iPhone certification. There is no authenticated account mode, server durability, cloud synchronization, background push, offline app-shell update lifecycle or production deployment in this task. The existing large JavaScript bundle warning remains. No dependency was added. No Git repository/remote or hosted CI run exists in this folder.
