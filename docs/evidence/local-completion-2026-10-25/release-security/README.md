# Local release/security review — temporary build cleanup

25 October 2026 · OPS-03, SAFE-01 / PRD-20, SEC-06, NFR-07. Cloud provisioning and deployment remain pending.

## Finding and correction

A failed release build could leave its large temporary package behind after sealing. The package builder changes directories to mode `0500`, then its failure handler called recursive `rm(..., { force: true })` and suppressed cleanup errors. On this macOS host, removing files from those sealed directories fails with `EACCES`; `force` does not restore directory write permission. A small synthetic filesystem reproduction and the new regression both reproduce that failure.

`discardBuildStage` now restores owner-write permission only on real directories belonging to the fresh temporary build before deleting that stage. It requires the `rise-release-build-XXXXXX` name directly under the canonical OS temporary directory, rejects a root symlink or non-owned directory, and does not follow nested symbolic links. An already-absent root stage is harmless; nested I/O errors propagate. Retained `.rise-infra/releases/` packages are outside this boundary and are never pruned.

The package builder preserves a distinct `release_build_cleanup_failed` result when cleanup itself fails; the CLI reports incomplete cleanup with fixed, sanitized text instead of swallowing the error. No private path, credential, subprocess output or profile content is included in that CLI message. Package integrity/admission, migration compatibility, deployment selection, rollback and application behavior are unchanged.

Changed files: `scripts/infra/release/package.ts`, `scripts/infra/release.ts`, `tests/release.test.ts`, and the recovery note in `docs/LOCAL-ROLLOUT.md`. [Patch](implementation.patch), [source hashes](source-hashes.json).

## Verification

The regression is at the same cleanup function used by the package builder. Before the correction, the old recursive-removal call was extracted unchanged into that function; the new sealed-directory test then failed with `EACCES`. After the correction, all five focused release tests pass:

```sh
node --import tsx --test --test-name-pattern='failed build cleanup' tests/release.test.ts
node --import tsx --test tests/release.test.ts
npx oxlint scripts/infra/release/package.ts scripts/infra/release.ts tests/release.test.ts --deny-warnings
```

The first command is the retained pre-fix failure, not a current failure. [Red log](red.log), [green log](green.log), [lint log](lint.log), [command record](verification.json).

The tests verify removal of a sealed synthetic tree, unchanged contents and mode of a linked external synthetic directory, harmless repeated cleanup, and refusal of arbitrary directories, nested lookalike stages and root symlinks. Existing schema/rollback, integrity/link escape and production-asset admission tests also pass. The fixtures are created specifically for these tests and removed afterward. No saved profile, retained release package, database, installation configuration or existing browser origin was cleared or modified.

Environment: macOS 26.6.2 arm64; Node 24.16.0; npm 11.13.0. This focused verification builds no package, installs no dependencies, starts no BFF/sender and runs no database/browser suite. The broader coordinated verification is recorded by the parent local-completion task. No full-package fault-injection or hosted cleanup result is claimed here.

Rollback restores the original package/CLI code; it needs no schema, stored-data or deployment-state rollback. It also restores the previous cleanup defect, so retain this regression when changing packaging in future.

## Remaining acceptance boundaries

The review found existing local implementations and dated acceptance for SAFE-01 and OPS-01–04. The following are actual pending gates rather than missing UI controls or permission to fabricate acceptance:

- SAFE-01: hosted HTTPS/HSTS/proxy/key/backup operations and physical-device privacy/delivery evidence.
- OPS-01: named primary/backup incident owners, a dedicated private support/security contact, human receipt/escalation and supervised hosted monitoring.
- OPS-02: off-site archive/key custody, unavailable-source recovery authority, changed-group reconciliation and complete hosted service recovery/reopening evidence.
- OPS-03: hosted supervisor, cross-schema compatibility expansion if needed, zero-downtime acceptance if required and signed artifact custody.
- OPS-04: actual operator/provider/region/processor arrangements, policy approval and app/artwork/distribution-rights approval.
- RELEASE-01/02: unresolved performance targets, actual consenting participants and two-person group usage, an elapsed day/return, observed feedback, physical accessibility/push and an explicit release decision.

No participants were contacted and no operating owners, legal approvals, device outcomes, retention or release sign-off were invented. See [pilot admission](../../../RELEASE-PILOT.md), [local operations](../../../LOCAL-OPERATIONS.md), [recovery](../../../SERVER-BACKUP-RECOVERY.md), [rollout](../../../LOCAL-ROLLOUT.md) and [launch policies](../../../LAUNCH-POLICIES.md). Local technical verification cannot close these human, physical or hosted gates.
