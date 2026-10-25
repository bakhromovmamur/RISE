# Local completion review — 25 October 2026

This work addresses QUALITY-03 (NFR-02/03/07), the OPS-03 release-cleanup boundary (PRD-20 / SEC-06), and a safe source handoff for the later RELEASE-02 review. Three subagents implemented and independently reviewed separate areas. **This is not a declaration that every task or release gate is complete.** Cloud provisioning, Git initialization/commit/push and deployment were not performed.

## Changes retained

- [Browser/domain evidence](browser-performance/README.md): complete stored-envelope validation no longer walks the profile twice; pure helpers no longer receive a redundant outer full-history clone. A callback-retained object could change an IndexedDB acknowledgment after the database captured another value. The new independent snapshot is captured before writing and is returned only after strict commit. The original failure reproduces in all three engines; the regression passes after the fix.
- [Release-cleanup evidence](release-security/README.md): failed packaging can remove its owned, sealed temporary build safely. It refuses unrelated paths and symlink roots and reports cleanup failure separately. Retained releases are never pruned by this change.
- [Publication/handoff evidence](../local-readiness-2026-10-25/README.md): `npm run check:publication` inspects candidate files and actual staged blobs, including ignored forced additions, staged secrets removed only from the worktree, index flags and Git replacement objects. Broken Git metadata fails closed. The checker never initializes this project, changes its index or uploads data. Its limitations and post-staging recheck are explicit in [the handoff](../../LOCAL-READINESS.md).
- A personal organization display identifier was removed from three infrastructure documents. The one historical report has an explicit privacy-redaction note; exact originals remain private. No dated test claims were changed by that redaction.

Application source changes are limited to `src/data/storedState.ts`, `src/data/indexedDb.ts` and `src/domain/personalCommands.ts`. Tooling changes are in the release package/CLI, `.gitignore`, `package.json` and the new publication checker. Focused outcome tests accompany these changes. No dependency, SQL migration, UI, stylesheet, artwork, storage version or public API changes are retained.

## Capacity findings and rejected work

The [full 100-account original-runtime baseline](capacity-summary.json) fails its targets: 400/400 personal and 113/200 shared first intentions succeed, with 41 shared failures and 46 deferred intentions. Scheduled personal/shared p95 is 4,129.0/5,341.6 ms; 30 of 113 observed shared updates take over 15 seconds. All 87 exact recoveries, full original histories/XP, shared readbacks and fixture cleanup pass. The fixture contains 7.3 million synthetic habit occurrences; no real account data is used.

A [bounded execution candidate](../../BFF-EXECUTION.md) was built, reviewed and tested. Seven protocol and two real-database failure tests pass; the complete candidate-stage source check passes 339 cases and its database run passes 183. Both two-account actual-HTTP variants accept all 12 scheduled operations and preserve receipts, histories/XP and cleanup. The candidate reduces scheduled personal/shared p95 from 1,943.6/1,424.4 ms to 1,611.6/80.4 ms, but both variants have two late shared observations and fail the complete gates. These small sequential diagnostic samples are not full-load acceptance or isolated hardware benchmarks.

The candidate full run stops **before fixture creation** at the unchanged greater-than-12-GiB free-disk guard (11.77 GiB available). No abandoned project-owned release-build directory was available to reclaim. No retained release or user file was deleted to bypass the guard. The candidate is **not adopted**: original runtime entry/wiring files were restored exactly, and the candidate/new tests are retained as a portable, hash-verified patch with measurements. Candidate-stage checks are distinct from the final retained-code checks below.

After the owner freed disk space, the isolated archived candidate completed a full100 actual-HTTP run (15:02–15:13 UTC, 17.51 GiB free at start): **265/400 personal** and **26/200 shared** first intentions were accepted. Personal/shared scheduled p95 was **5,996.9/5,237.7 ms**; only 25/26 accepted shared updates were observed during measurement, with four late or missing. All **309 exact recoveries**, complete 7.3-million-occurrence history/XP readbacks, shared snapshots and fixture cleanup passed. The command exits 1 for the failed capacity gate, with no assertion or cleanup error. The candidate remains archived and the active runtime stays unchanged. [Full result and environment](candidate-full-summary.json). This full run uses real HTTP; the earlier full serial baseline uses injected transport, so their difference does not isolate threading.

Dense local durable-check medians remain 271.8/302.0/557.0 ms in Chromium/WebKit/Firefox. The acknowledgment correctness fix itself has no demonstrated material speedup. The readback alternative was slower in Firefox and was rejected. No timing target, fixture density, success condition, authorization check or deadline was relaxed.

## Final retained-code verification

| Command | Result |
| --- | --- |
| `npm run check` | 334 pass |
| `npm run test:browser` | 459 pass |
| `npm run test:production` | 78 pass |
| `npm run test:pwa` | 63 pass |
| `npm run test:visual` | 48 pass |
| `npm run test:backend` | 21 pass |
| `npm run test:auth` | 30 pass |
| `npm run test:sync` | 69 pass |
| `npm run test:push` | 54 pass |
| `npm run test:groups` | 108 pass, **3 fail** |
| `npm run test:rollout` | Build stopped: missing pinned npm cache; no cases ran |
| `npm run test:rollout` | 6 pass |

The first rollout attempt stopped before cases because its offline package build returned `ENOTCACHED`. The exact lockfile was installed without scripts in an owned disposable directory to restore the pinned download cache; project dependencies and lockfile were unchanged. The subsequent rollout result is recorded separately above.

The group run has three Firefox failures, so the broad regression is **not clean**. The original failure report is preserved. [The follow-up](browser-followup.json) records separate diagnostic repetitions; later passes do not establish a root cause or repair. No assertion, deadline or production rate limit was weakened.

The visual run compares 720 scenes without regenerating references. `npm run check` includes pinned-toolchain/notices checks, lint, app/tooling/server types, 334 source/tooling tests and production/review builds. Existing bundle-size and mixed static/dynamic-import advisories remain; they are not performance acceptance.

[Machine-readable commands, timestamps, source hashes and environment](verification.json). Raw logs and credential-sensitive browser reports remain under the private `.rise-infra/local-completion-20261025/` and ignored test-output directories. Browser fixtures use only isolated 4180/4181/4182/4191 origins.

The earlier `npm run test:infra` passed 183 cases in 182.6 seconds: 181 retained database/backend cases plus two candidate-only execution cases. It ran before the candidate was archived; the retained runtime is separately exercised by the backend/auth/sync/push/group and sealed-release browser suites above. The candidate-only cases are not counted as retained source/browser coverage.


The final production UI diagnostic passed all three history/XP/reopen assertions. Its single Chromium/WebKit/Firefox samples measured DOM feedback at **236.7/280/486 ms**, frame opportunity at **284.8/407/496 ms**, and saved status at **702.5/1,123/1,451 ms**. These samples still exceed the 100 ms feedback and 250 ms durable targets; they are not physical paint, INP or p95 evidence. They measure the full Today UI, whereas the earlier DeviceSession medians isolate the session adapter. [Exact measurements and scope](production-feedback.json).

Final documentation validation passes: 45 documents, 781 links, 63 anchors, 38 tasks and 20 requirements, plus 96 links in the new evidence/handoff documents. The read-only publication check passes with 5,110 candidate files, zero staged entries, 22 known-secret comparisons and no findings. The project remains uninitialized in Git. This is bounded publication hygiene, not a complete secret/data audit; rerun after staging. All isolated test listeners on 4180/4181/4182/4191 have stopped.

## Preservation

[Hash comparison](preservation.json) confirms all 62 existing local `rise`/`rise_private` tables and five protected local configuration files are unchanged. The test fixtures use the separate fixed test installation. Existing source hashes match for 44 UI files, eight stylesheets, 12 public assets, 35 migration files and 799 visual references. Of 3,085 existing dated-evidence files, only the explicitly documented infrastructure organization-label privacy redaction differs. The original is preserved privately. No saved browser origin was reset, fixture-loaded or cleared.

## Remaining gates and recovery

QUALITY-03 and RELEASE-01 remain **IN PROGRESS**. Current task totals remain 11 DONE, 4 IN PROGRESS, 21 REVIEW and 2 TODO. REVIEW records the already documented local implementation plus its unfulfilled external acceptance; it is not a production-ready verdict.

Remaining work includes local response-time/capacity targets and the three unexplained Firefox startup/sign-in timeouts; physical HTTPS/assistive-technology/push checks; named operating contacts and legal/rights decisions; independent authority/key/backup custody for source-unavailable disaster recovery; hosted supervision; a consented real pilot; and explicit release approval. The current rollback still requires identical migration/storage/API contracts. These boundaries are listed in [LOCAL-READINESS](../../LOCAL-READINESS.md).

No migration or data conversion is needed for the retained fixes. Reverting the acknowledgment fix restores the demonstrated race. Reverting release cleanup restores the sealed-directory failure; publication hygiene would again require equivalent manual review. Continue to preserve immutable pending operations, original recovery sources and current release packages.
