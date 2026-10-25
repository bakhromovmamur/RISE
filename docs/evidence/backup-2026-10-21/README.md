# DATA-02 — Validated backup and restore

Implementation and verification record, 21 October 2026. Scope: PRD-18 and the local portability portions of SEC-03/SEC-05. The user requested the existing product, design, functionality and saved data remain intact; the project Karpathy guidelines governed focused changes and verification.

## Delivered behavior

- Settings → Your data exports the latest committed profile as `rise.private-backup` version 1, with schema version, timestamp, timezone, checked counts and a SHA-256 corruption checksum. The UI explains that this private file is unencrypted and can include religious-practice history, notes and location settings.
- A dedicated worker handles bounded file reading, strict UTF-8 decoding, validation and comparison. Cancel/close terminates the worker. Legacy schemas 1–4 remain supported; unsupported schemas, malformed JSON/bytes, duplicate records, bad references/dates/enums, unsafe keys, size/depth/record-limit violations and altered checksums fail before mutation.
- Restore previews counts, dated coverage, XP, matches, conflicts, additions and removals. Replacement requires an explicit acknowledgment. A strict IndexedDB transaction saves the previous profile, replacement and local receipt together; in-transaction readback must match. Failed writes abort everything, and retry is idempotent.
- Stale previews cannot overwrite a newer tab or resurrect a cleared profile. A selected recovery point is revision/ID checked. Exact same-device rollback retains the pre-import profile's authored data, local simulations and unknown safe fields; imported files cannot supply that privileged snapshot.
- The portable field projection excludes credentials, subscription endpoints, invitation secrets, inaccessible groups and unknown extensions/drafts. Supported history, corrections, XP inputs, pauses, plans, acknowledgments, known drafts and historical habit-version descriptions remain. Malformed supported drafts fail export with an explicit raw-preservation path.
- Imported shared records are held outside active app state as read-only local archives. No imported membership, live invite, permission or notification delivery is created. The archive viewer renders authored text as text, including hostile markup.
- One recovery point is retained until the next successful restore/rollback or clear. Clear removes archives, recovery, legacy copies and receipts, while retaining a revisioned empty record. Repository format 2 prevents older DATA-01 clients from unknowingly clearing only part of this newer storage; database version 1 and domain schema 4 remain.

The [backup format and user/recovery guide](../../BACKUP-RESTORE.md) defines the envelope, privacy rules, comparison units, exact rollback semantics and compatibility boundary. Source entry points are `src/data/backup.ts`, `backupProjection.ts`, `backup.worker.ts`, `indexedDb.ts`, `deviceSession.ts` and `BackupScreen.tsx`.

## Verification record

Final machine-readable results and hashes are recorded in [verification.json](verification.json). Full case listings are in [browser-results.json](browser-results.json), [production-results.json](production-results.json) and [visual-results.json](visual-results.json). The [browser versions](browser-versions.json), [starting source manifest](before.json) and [initial full-run results](initial-full-suite-results.json) retain the verification context.

| Final check | Result |
| --- | --- |
| `npm run check` | Pass: pinned toolchain, lint, app/tooling types, 97 unit/domain/tooling tests, production + review builds |
| `npm run test:browser` | 276/276, Chromium/WebKit/Firefox; 36 backup cases included; no skipped/flaky cases |
| `npm run test:production` | 27/27 across the same three engines; no review harness in production |
| `npm run test:visual` | 48/48 variants; 720 exact PNG comparisons, zero changed golden hashes |
| New restore UI | Three languages × two appearances × four phone widths at 200% text; keyboard focus, cancel, error, retry and rollback checked |

All final runs use the recorded final build. The historical initial full-run build hashes are retained separately in `full-run-builds.json`.

### Meaningful failure exercises

The browser harness invokes the actual IndexedDB adapter in Chromium, WebKit and Firefox; it is excluded from production builds. These are transaction fault injections, not simulated repository results or physical disk-exhaustion claims.

| Exercise | Required observed outcome |
| --- | --- |
| Quota failure at recovery write, profile write or receipt write | Both profile and existing recovery point remain byte-equivalent; same-ID retry commits once |
| Transaction abort or deliberately damaged readback | All restore writes roll back |
| Two open stores restore the same revision | One replacement succeeds; the other cannot overwrite it |
| Another UI tab saves during preview | The newer data survives; the stale preview must be regenerated |
| Clear followed by an old restore/rollback request | Empty revision survives; recovery point and archives are gone |
| Reopen after restore and same-operation retry | Committed state persists without duplicated activity or revisions |
| Exact rollback after an import | Original personal state, local groups, drafts and unknown safe field return |
| Worker cancellation, oversize file or invalid UTF-8 | No profile write; authored text is not silently replaced |
| Two years × 100 habits | All 73,100 dated check-ins and derived XP survive a real adapter restore/reopen |
| Malformed portable export draft | Current state is untouched; raw device recovery download contains the exact saved state |
| Recovery-point read fails after successful commit | UI reports the successful restore truthfully and offers raw preservation, not a false rollback claim |
| Imported markup in shared notes | Plain text in the local archive; no script execution |

Pure tests additionally verify all four legacy schemas, complete personal round-trip, reward eligibility, explicit projection at nested paths, overlap/conflict/removal counts, forged checksums, future versions, duplicates, broken references, invalid date/time, nonfinite values, nesting/record/byte limits and staged-payload tampering.

### Corrections found during verification

The first round-trip comparison found older authored habit descriptions embedded in schedule versions. The projection now explicitly validates and retains these known historical fields. It does not turn arbitrary unknown extensions into portable fields.

The first new UI run exposed an overly broad test selector that chose the nested migration disclosure. It was narrowed to the top-level settings disclosure. Enlarged-text checks then found the global life-screen input width applying to the confirmation checkbox; a restore-screen-only rule corrected it. Screenshots were inspected at normal and 200% text, including English 320 px dark, Russian 375 px dark and Uzbek 430 px light.

The initial complete interaction run had 273 passes and three failures in existing Chromium journeys. Their helpers performed full navigation immediately after a fixture/language change. A failure trace contained “Saving on this device” before leaving. Five fixture-navigation helpers and the two relevant full-navigation transitions now wait through the shared durable-save helper. No product assertion was removed, weakened or retried to hide the failure. The complete suite was rerun afterward. A final input review also replaced permissive UTF-8 decoding with fatal decoding, with an actual-worker regression case.

## Parity and data protection

Tests used synthetic profiles on isolated origins 4180, 4181 and 4182. Their common browser fixture blocks external requests and rejects other origins. The existing personal preview/profile on 4173 was not opened, seeded, cleared, imported into or migrated by this work. Legacy source bytes remain unchanged through export/restore/rollback tests.

The four tabs, existing sheets, artwork, typography, colors and domain rules were preserved. The new restore screen and supporting messages reuse the existing controls and tokens in English, Russian and Uzbek Latin. All golden images are unchanged. The [screen manifest](screens.json) records 25 original PNG captures: one normal-text preview and 24 confirmation views across three languages, both appearances, 320/375/393/430 px and 200% text. The captures include ordinary transient toast/hover states; no image was edited or resized.

## Limits and next boundary

This completes local DATA-02, not the public product release. No cloud service, account, real shared membership, push subscription, email or invitation was created. No deployment, hosted CI run or Git commit is claimed; this directory has no Git repository. Dependencies and the original design sources were not changed.

Browser eviction, user storage clearing, forced OS termination, physical iPhone/Android delivery, encrypted server backup, account deletion/revocation replay and server authorization remain separate gates. The local tests do not certify physical disk durability or guarantee an alarm. The existing JavaScript bundle-size warning remains; no performance-release claim is made. DATA-03 remains the next task: route personal flows through individual durable commands without changing their product behavior.
