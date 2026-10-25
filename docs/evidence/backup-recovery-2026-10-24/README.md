# OPS-02 — Local backup recovery evidence

24 October 2026 · OPS-02 · PRD-18/20, NFR-04, SEC-05. Status: **REVIEW** for the remaining operating gates. Cloud provisioning remains pending.

## Result and preservation

Implemented encrypted server backups, authenticated 30-day expiry, local retention/purge commands, backup/maintenance freshness alerts and a networkless disposable PostgreSQL restore/replay drill. [Recovery contract, commands and limits](../../SERVER-BACKUP-RECOVERY.md).

The populated synthetic drill retained the surviving habit's **20 XP** and unchanged shared task, denied old sessions and a removed member's access, purged a restored deleted account and verified positive owner/negative unrelated-user access through real restored RLS. A group authority change during recovery caused the final verification to fail closed. Every ordinary success/failure removed its disposable container. No notification transport or external message was used.

A new encrypted **local** backup was also created read-only. All **62 `rise`/`rise_private` tables**, including their content fingerprints, and the five existing protected state/runtime files matched immediately before/after creation. The original source was never a restore target. [Local preservation result](local-preservation.json).

All **205 protected application/source/assets/schema/lockfile files** in the starting comparison remained byte-identical. No existing file was deleted. The production web release remains **`14b94acfaeaf38b5f855`**, matching OPS-01; browser profile/storage formats, design, CSS, assets and domain behavior are unchanged. [Starting-state comparison](source-preservation.json). This checkout has no Git repository, so verification used a pre-edit SHA-256 inventory instead of a fabricated commit/diff.

## Commands and results

| Command/check | Result |
| --- | --- |
| `npm run check` | **306/306** unit/tooling checks, lint/type checks and production/review builds pass. [Log](check.log) |
| `npm run test:infra` | **178/178** real database/runtime checks pass, sequentially against the fixed test stack. [Log](infra.log) |
| `npx tsc -p tsconfig.server.json --noEmit` and `npx tsx --test --test-concurrency=1 tests/infra/server-backup.test.ts` | Final strengthened recovery/retention cases **2/2** pass, including a valid fresh unrelated/removed-member session and changed-authority rejection. [Log](focused-database.log) |
| `npx tsx --test tests/server-backup.test.ts` | Encryption, corruption/truncation/wrong-key, installation/version/expiry rejection, private key preservation and authenticated expiry cases pass; included in the final check. |
| `node --import tsx scripts/infra/backup.ts watch test` | First maintenance pass succeeded with a fresh archive and zero failed purges. Concurrent `create test` was rejected by the lock; SIGTERM exited 0 and removed the lock. [Runtime evidence](cli-runtime.json) |
| `node --import tsx scripts/infra/backup.ts create test`, then `drill test <returned-name>`, then `maintain test` | Actual CLI create, restore and one-shot maintenance succeed. [CLI evidence](cli-drill.json) |
| Read-only local `createBackup` through the same command module | Encrypted archive created privately; original application tables and protected configuration unchanged. [Result](local-preservation.json) |
| Monitor probes | Local archive is fresh and unstarted local housekeeping correctly reports stale; the test watcher supplies fresh housekeeping. Stopped BFFs report unavailable. [Observed signals](monitor.json) |
| `npm run check:docs` | Links/anchors/task/dependency/requirement validation passes. [Log](docs.log) |
| Protected-value scan | No known generated provider/runtime/backup key values in scanned implementation, evidence or built bundles. [Result](secret-scan.json) |

The first restore investigation found that the disposable database needed explicit UTF-8 initialization. A successful `pg_restore` may close its input pipe early; an EPIPE now defers to the actual process exit status. Final restore checks cover the corrected path. During concurrent verification, an existing two-second push-renewal test timed out; no renewal code was changed. Its isolated **13/13** rerun and the subsequent full **306/306** check passed. [Retained failed check](check-contention.log), [focused rerun](renewal-rerun.log). Existing Vite chunk-size/dynamic-import warnings remain; this task does not close QUALITY-03.

No browser/UI suite or golden regeneration was necessary for these operator-only changes; the entire product source/assets and actual web release are unchanged. Earlier browser/device evidence is not presented as newly run evidence. [Environment](environment.json).

## Measured local recovery

The final populated drill's recovery point was **2.974 seconds old** at start; decrypt/restore/replay/validation took **7.013 seconds**. It withheld one changed group, left push/network disabled and did not reopen access. [Machine-readable measurement](drill.json). These measurements are below the PRD's 24-hour/4-hour targets for this synthetic local path only.

This is not full service RPO/RTO: outage detection, unavailable-source authority, key retrieval, off-site transfer, changed-group reconciliation, credential rotation and hosted reopening were excluded. Daily cadence requires the watcher to remain running under a future supervisor. A stopped process/laptop cannot meet that target. There is no hosted provisioning or production restore/promotion command.

## Changed surface and recovery implications

New operator modules: `scripts/infra/backup.ts` and `scripts/infra/recovery/{archive,database,maintenance}.ts`; new encryption and real recovery tests. Existing operations monitor/probe/test and package scripts were extended. Root requirements/architecture/security/product/task instructions and related local-operations/lifecycle guides link the actual implementation. No dependency, migration, RLS grant, browser cache format or application component changed. [File hashes](files.sha256).

Backups carry sensitive Auth/private/shared records and stay in ignored protected local storage. Their independent keys are outside the backup directory. Neither plaintext archive nor private configuration appears in this evidence. The recovery copy has NOLOGIN roles, no source runtime credentials, no network/ports/volumes, revoked sessions/invitations and disabled push. Existing accepted provider outcomes remain historical. Current source authority must be available, fresh and unchanged; changed groups are withheld, never silently merged back into collaboration.

Stop the watcher to roll back the new operator tooling; retain keys, archives, original data and deletion ledgers. Do not downgrade schema/browser formats or delete data. Retention already performed is irreversible through a code rollback. Missing/corrupt/expired/wrong-installation archives fail closed; unrelated files and corrupt evidence remain for explicit investigation.

Remaining gates: named operators/escalation, continuous supervision, off-site/key custody, lost-source authority recovery, changed-group reconciliation, full hosted RPO/RTO and service reopening, device acceptance and cloud provisioning. OPS-03 is the next local operations task; this local evidence does not mark the product ready for public release.
