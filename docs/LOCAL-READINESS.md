# Local completion and source handoff

25 October 2026 · local engineering audit and preparation for the owner's GitHub handoff. Cloud provisioning, server deployment and public release remain pending. This document does not replace [TASKS](../TASKS.md), the [PRD](../PRD.md), [security gates](../SECURITY.md) or their dated evidence.

The project did not have Git metadata at the start of this audit. No repository was initialized in the project, no commit/push was made, and no remote or deployment credential was configured. The owner will choose the repository, visibility, branch and remote when committing the reviewed changes.

## What can be completed locally

“Locally verified” means the actual local adapter or runtime was exercised against synthetic records on isolated test origins. It does not mean a real person's device, an operational server, human receipt of an alert or a release approval was verified.

| Task group | Existing local implementation and evidence | Remaining acceptance boundary |
| --- | --- | --- |
| DOC-01; FND-01/02/04; WEB-01; DATA-01/02/03; PRAY-01/02; QUALITY-01 | Documented requirements, frozen design, pinned checks, production/review separation, transactional guest storage, backup/restore, personal/prayer invariants and localization are recorded DONE | Preserve these contracts and rerun relevant checks after changes |
| FND-03 | [Decision record](INFRASTRUCTURE-DECISIONS.md) identifies the existing account/domain, intended origin, markets and budget | Actual host plan/access, provider ownership, region, sender, operating people, audience and custody decisions require the owner; do not invent them |
| INFRA-01 | [Isolated local/test Postgres/Auth and BFF](BACKEND-ENVIRONMENTS.md) | Separate approved staging/production infrastructure, hosted secrets/network/TLS and operating evidence |
| WEB-02; QUALITY-02 | [PWA lifecycle](PWA.md), [mobile/accessibility matrix](MOBILE-ACCESSIBILITY.md) and desktop-engine regressions | Real iPhone/Android installation, safe areas/keyboards, VoiceOver/TalkBack and current/previous release-device evidence |
| AUTH-01/02; SYNC-01/02; DATA-04 | [Sessions](AUTH-SESSIONS.md), [account sync](ACCOUNT-SYNC.md), [conflict recovery](SYNC-RECOVERY.md), [account lifecycle](ACCOUNT-LIFECYCLE.md) | Actual HTTPS/email/provider behavior, hosted operations and physical-device acceptance; local owner/RLS/receipt/cancellation boundaries remain mandatory |
| PUSH-01/02/03/04 | [Subscription consent](PUSH-SUBSCRIPTIONS.md), [plans](PUSH-PLANS.md), [cancellation](PUSH-CANCELLATION.md), [renewal](PUSH-RENEWAL.md), [local sender](LIVE-PUSH-SENDER.md) | Hosted supervision and genuine provider/device delivery; provider acceptance is never proof of an audible wake-up |
| PUSH-05 | Physical test procedure and truthful readiness boundary exist | Requires an approved HTTPS environment and actual phones in foreground/background/locked/offline/Focus and permission states; emulation cannot close it |
| GROUP-01/02/03/04/05 | [Membership](GROUP-MEMBERSHIP.md), [shared content](SHARED-CONTENT.md), [exact squad snapshots](SQUAD-SNAPSHOTS.md), [notices](GROUP-NOTIFICATIONS.md), [lifecycle](GROUP-LIFECYCLE.md) | Hosted/device acceptance and the separate pilot with two consenting real people |
| QUALITY-03 | [Performance/resilience diagnostics](PERFORMANCE.md) and relevant real-adapter regression suites | Actual latency/capacity targets must pass for the current code. Passing correctness tests or a faster helper alone is insufficient. Physical Web Vitals and hosted availability/recovery remain separate |
| SAFE-01 | [Integrated local security review](LOCAL-SECURITY.md) and authenticated negative tests | Hosted TLS/proxy/key custody, physical privacy/push and operating gates; no whole-product security certification follows from a local pass |
| OPS-01 | [Redacted diagnostics, private file alerts and synthetic routing drill](LOCAL-OPERATIONS.md) | A named person who responds first, a backup person, a private support/security contact, actual receipt/escalation and continuously supervised monitoring |
| OPS-02 | [Encrypted backups, retention and disposable recovery](SERVER-BACKUP-RECOVERY.md) | Current source authority is required; changed groups are withheld. Recovery when the source is unavailable needs an independent current authority ledger/custody design. Off-site keys/backups and complete-service RPO/RTO remain unaccepted |
| OPS-03 | [Immutable compatible packages, rollout and rollback](LOCAL-ROLLOUT.md) | Current rollback requires identical migration sets and storage/API contracts. Cross-schema deployment needs separate compatibility evidence; local supervision is not hosted zero-downtime operation |
| OPS-04 | [Localized local notices, rights inventory and launch-policy boundaries](LAUNCH-POLICIES.md) | Actual operator/contact, audience, provider/region/processor arrangements, deployment-specific policy approval and app/artwork/distribution rights |
| RELEASE-01 | [Synthetic complete-day protocol and technical rehearsal](RELEASE-PILOT.md), with activation/sign-in/queue follow-up evidence | A consented human pilot, an actual day/return, two real group members and observed feedback; unresolved QUALITY-03 defects remain blockers |
| RELEASE-02 | This local handoff and the existing rollout/recovery procedures prepare the technical review | Named release ownership, exact release/origin, complete gate evidence and the owner's explicit release decision; no automatic approval |

The current task register carries the authoritative status and links to the latest measured results. A REVIEW task can have complete local implementation while retaining its stated external acceptance. Keep those rows open until their actual evidence exists. Never turn a failed or not-run performance/device requirement into DONE by renaming its scope.

## Source publication check

Run from the project root:

```sh
npm run check:publication
```

The checker is read-only for the project and its Git index. Before Git initialization it uses disposable Git metadata outside the project to enumerate files with the repository's ignore rules. Broken or inaccessible Git metadata fails the check instead of selecting this pre-initialization fallback. With an initialized repository it examines candidate worktree files and every regular stage-zero index blob, including ignored files that were forced into the index and secret bytes removed only from the worktree. `assume-unchanged`, `skip-worktree` and Git replacement refs do not bypass the index check. Blob metadata is batched; contents are streamed one bounded blob at a time rather than buffering the whole repository.

It refuses private/generated paths, non-regular candidates, unsupported/conflicted index entries, files at or above 100 MiB, private-key headers and exact known local/test secrets. Private configuration is read only to derive the comparison values. Output includes counts, paths and reason codes, never matching contents or secret values. No file is deleted, unstaged, rewritten, committed or uploaded. A failed check requires reviewing and correcting the candidate/index; changing the worktree alone does not remove an already staged secret.

The ignore rules preserve `.rise-infra/`, environment files, build outputs, dependencies, test reports, OS/Vite caches and local signing material outside source control. Existing native ignore rules retain generated Capacitor bundles and native build caches. Example environment files, source, migrations, pinned lockfiles, original assets, frozen visual references and dated reviewed evidence remain eligible.

This is a publication-hygiene check, not a complete secret or personal-data audit. It does not recognize every unknown credential, encoded value, private export or compressed archive member. Review any newly added artifacts and confirm that historical traces/screenshots contain only their documented synthetic data. Do not include real profile exports, usable codes/cookies/invitation fragments/push endpoints, raw infrastructure logs or unreviewed credential recordings. Retain required evidence; do not hide or delete a failed test to obtain a clean result.

After selecting/staging the intended source files, rerun the checker and inspect the actual staged names and diff before committing. Recheck after changes to the index. A successful check is not a GitHub visibility or application-license decision. No application license grant has been invented; the existing rights review remains applicable.

## Local verification record

Use the pinned runtime and the command definitions in [README](../README.md). The parent engineering run coordinates the final results in TASKS and its dated evidence. Build/source checks must finish before browser suites, and database/BFF/browser suites run sequentially against their reserved test ports. Do not create fixtures on saved-profile origins 4173, 4190 or 4192.

```sh
npm run check
npm run check:docs
npm run check:publication
```

The full release rehearsal commands are in [RELEASE-PILOT](RELEASE-PILOT.md#local-reproducible-rehearsal). Performance and sender-load commands are separate, explicit workloads in [PERFORMANCE](PERFORMANCE.md) and [PUSH-RETENTION](PUSH-RETENTION.md). Preserve workload, resource, authorization and deadline guards. No source publication check substitutes for those tests.

The publication checker itself has outcome tests for pre-init isolation, forced ignored index files, staged-secret removal from the worktree, index flags, symlink/key rejection and streaming empty/repeated/large content. These tests use only disposable synthetic directories. They do not initialize this project's repository or change its index.

[The dated source-handoff audit](evidence/local-readiness-2026-10-25/README.md) records the checker results, two historical synthetic trace archive checks and the narrowly documented privacy redaction of an operator identifier. It does not close the outstanding release gates.

## Inputs for the later server phase

Record these before applying a deployment plan; do not paste credentials into source or chat:

1. Confirm the existing Hetzner plan and supported backend/worker processes, intended public origin, provider ownership, approved region and combined service cost within the recorded budget.
2. Assign the responsible release/operator, first incident responder, backup responder and private contact. Confirm the actual audience, operator/policies, data-handling arrangements and distribution rights.
3. Choose independent staging/production identities, protected secret/key storage, email sender, TLS/proxy configuration and supervised backend/sender/maintenance/monitoring processes. Local `release:*` tools accept only fixed local/test installations; they are not a hosted deploy command.
4. Define off-site backup/key custody and independent current deletion/revocation/group authority for source-unavailable recovery. Preserve the conservative changed-group quarantine and prove the recovery path before reopening access. The local source-dependent drill cannot establish disaster recovery.
5. Select the immutable tested release and its compatible rollback package. Keep the current exact-schema/storage/API limitation unless a separate migration compatibility plan has passed review and tests.
6. Complete real HTTPS/phone/assistive-technology and delivery acceptance, followed by the consented pilot and explicit release decision. Verify every required gate against the exact hosted version before public access.

The local development stacks, protected `.rise-infra` installation, saved browser profiles and private recovery data are not deployment artifacts. GitHub source handoff does not authorize provisioning, DNS/email changes, real invitations, live push or a production rollout.
