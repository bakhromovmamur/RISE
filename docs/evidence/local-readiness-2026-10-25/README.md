# Local task and source-handoff audit

25 October 2026 · FND-02/FND-03, SEC-06, OPS-04 and RELEASE-02 preparation. Local publication hygiene is verified; this is not a production release decision. Cloud provisioning remains pending.

## Findings and changes

[The local readiness inventory](../../LOCAL-READINESS.md) maps all task groups to their actual local implementation and outstanding acceptance. Hosted infrastructure/operations, physical phones/push/accessibility, named operating people, policy/rights decisions and the consented pilot cannot be replaced by repository checks. QUALITY-03 still needs its measured targets; use TASKS and the current performance evidence for that work's latest result. The inventory explicitly preserves OPS-02's dependence on current source authority and changed-group quarantine, the need for an independent authority/custody design for source-unavailable recovery, and OPS-03's identical-schema/storage/API rollback limitation.

The initial candidate audit found `.DS_Store` and `.vite/deps` cache files eligible for a first commit. `.gitignore` now excludes those and local signing material while retaining source, assets, frozen references and dated evidence. No ignored file was deleted. Native generated bundles remain covered by their existing nested ignore rules.

`npm run check:publication` now checks candidate paths and exact known-secret bytes before or after Git initialization. It uses disposable Git metadata when the project has no repository. For an existing repository it reads every regular stage-zero index blob through a bounded batch stream, including blobs hidden by `assume-unchanged` or `skip-worktree`. It detects forced ignored files, index secrets removed only from the current worktree, private-key headers, unsupported/symlink entries and file-size violations without printing matched contents. It changes neither the project files nor its index. See the inventory for its explicit limits: this is not a complete unknown-secret, archive or personal-data scanner.

Only the personal organization display identifier was redacted from these publication texts:

- `docs/INFRASTRUCTURE-DECISIONS.md`
- `docs/BACKEND-ENVIRONMENTS.md`
- `docs/evidence/infrastructure-2026-10-21/README.md`

The selected provider/organization meaning remains. Exact originals are retained privately under `.rise-infra/local-completion-20261025/readiness-agent/` with a 0700 directory and 0600 files. The dated infrastructure evidence has an explicit 25 October privacy-redaction note; its original verification commands, results, scope and limitations are unchanged. This is the single intentional historical-evidence byte change for privacy, not a re-run or a rewritten test claim. No public diff or report republishes the removed identifier. The follow-up text search finds zero remaining publication-text matches; image/OCR and unknown personal data are outside that search.

## Verification

The publication test command passes **6/6** cases, including exact index preservation, secret-value nondisclosure, pre-init isolation, forced ignored index entries, stale staged bytes under both index flags, symlink/key denial, and streaming empty/repeated/multi-chunk content. Scoped Oxlint and current-document validation pass; the new handoff/evidence links resolve. These tests use only disposable synthetic directories; no application database or browser profile is involved.

The final read-only candidate scan at its recorded point checks **5,086 files / 221,235,860 bytes**, derives **22 known local/test secret values**, and reports **zero failures**. There is no initialized project repository or real index at that point; the index branches are exercised by the synthetic tests. Concurrent engineering may add source/evidence afterward, so rerun the command after final staging and before the owner's commit/push. The earlier inventory found no candidate larger than 6 MB.

The two existing historical synthetic prayer trace ZIPs are additionally inspected read-only after decompression: **64 members**, **22 known secret values**, **zero known-secret/private-key matches**. No archive was extracted onto the project, changed or removed. This byte check does not certify screenshots through OCR or recognize every possible unknown credential/private value. Their dated synthetic scope remains authoritative.

[Exact commands, scope and results](verification.json), [changed-file hashes](source-hashes.json). The parent engineering run owns the final whole-project regression and task status. This subtask made no commit/push, provisioned no cloud resource, contacted no person and changed no application design, saved profile or database.

[The independent execution-runtime review](EXECUTION-REVIEW.md) records the later worker restart finding, its source-level correction, transport/security review, memory-accounting limits and final verification instructions. It is a source review, not an additional test or capacity pass.

## Publication review follow-up

A later independent review found two checker gaps: Git replacement refs could substitute benign bytes for a staged secret, and a failed Git discovery could be mistaken for an uninitialized project. All checker Git subprocesses now disable replacement objects. Pre-initialization fallback now requires absent Git metadata; broken pointers, directories, symlinks, damaged HEAD files, ancestor metadata and explicit metadata environment overrides fail closed when discovery fails. Original indexed bytes, index contents and replacement refs are preserved.

Focused publication verification subsequently passes **8/8** tests and scoped Oxlint. New regressions cover the replaced secret-bearing blob with a benign worktree, broken metadata variants and index preservation. [Follow-up commands and source hashes](publication-review-follow-up.json) record this later result separately from the earlier 6-test candidate/archive audit above. A final whole-project publication/docs check remains owned by the parent engineering run after all edits; no new repository-wide scan was performed for this fix.
