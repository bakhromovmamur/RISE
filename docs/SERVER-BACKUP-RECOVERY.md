# Local server backup, retention and isolated recovery

OPS-02 · PRD-18/20, NFR-04, SEC-05 · 24 October 2026. This is a local/test implementation. Cloud provisioning remains pending.

## Scope and recovery limits

`backup:create` takes a consistent PostgreSQL custom-format snapshot of the `auth`, `rise` and `rise_private` schemas using an exported repeatable-read snapshot. It includes private records, shared records, authorization policies, private operational records and Auth data. It is sensitive infrastructure recovery material, not a portable user export. No browser profile, IndexedDB, guest recovery source, source file or live database is replaced.

The supported target is **only a new disposable Docker container**, using the already installed database image ID, no network, no published ports, no mounted volumes, a Unix socket and UTF-8 initialization. A caller cannot select a database URL/name or an existing target. The command never opens a BFF, Auth server or sender. It removes its own container on success and ordinary failure. A killed host/process may leave `rise-recovery-<uuid>` behind; inspect that exact container's `rise.recovery=isolated` label/network/ports before manually removing it. Never use a global Docker cleanup or stop the local/test stacks.

This drill needs the original local/test source to supply **current authority**, and the exact applied migration set/source files must match. It deliberately fails if that authority is unavailable, stale or changes during verification. It does not implement promotion, whole-machine disaster recovery, off-site key custody, point-in-time recovery, hosted restoration or application reopening. Those remain operating acceptance gates. The source must be quiet for the final authority comparison. A successful drill is not authorization to expose its database.

## Encryption and files

Each installation has a separate random 256-bit AES-GCM backup key, stored at `.rise-infra/recovery-keys/{local,test}.key`, outside its backup folder and separate from BFF/provider/session/push keys. Existing keys are reused. Missing keys with existing archives, corrupt keys, non-private files and symlinks fail; keys are never silently regenerated to repair an existing archive.

Archives live in `.rise-infra/{local,test}/backups/` with mode 0600, directories 0700. The `RISEBA01` envelope authenticates its header and encrypts all manifest fields and dump bytes with a fresh 96-bit nonce/128-bit authentication tag. Installation/environment, capture/completion times, migration digest and role names are checked before restoring. File writes use an exclusive temporary file, file fsync and atomic rename. A failed write cannot replace a previous recovery point. Plaintext dumps are held in memory and piped to the isolated container; they are not written as repository artifacts or logged.

The current local implementation bounds a dump to 64 MiB, an archive file to 128 MiB and authority inventories to 100,000 entries each. Oversized work fails, without truncation or partial success. Role names and object ownership/grants are retained; restored roles are **NOLOGIN**, with no source role passwords or runtime login configuration. External provider credentials, configuration/signing/encryption keys, Storage object files and browser-local data are not supplied by this backup. Restoring a trusted database archive executes database code; accept only locally authenticated archives from the protected key custody boundary.

A lost backup key makes these archives unreadable. Preserve keys separately when arranging future encrypted off-site storage; never put a key in the same transfer as its archive. No off-site transfer, managed secret service or key rotation was configured in this task. Local filesystem separation is not protection against compromise of the same OS account.

## Commands

Run from this repository with the pinned Node/npm toolchain and running fixed local/test infrastructure:

```sh
npm run backup:create -- test
npm run backup:drill -- test <filename-returned-by-backup-create>
npm run backup:maintain -- test
npm run backup:watch -- local
```

`create` prints only an opaque archive filename and timestamps. `drill` prints timing/gate counts and writes private `last-drill.json`; it never prints records, SQL, credentials or provider responses. `maintain` is one bounded housekeeping pass. `watch` performs that pass every minute while it runs, creates a backup when the newest authenticated recovery point reaches 23 hours (one hour of headroom before the 24-hour freshness limit), and exits cleanly on SIGINT/SIGTERM. Both reuse the existing verified lifecycle worker for pending account purges. They do not dispatch notifications. Failure exits 1; a one-shot with missing/stale backup or failed purge exits 2. `create`, `drill`, `maintain` and `watch` share an exclusive per-environment `backup.lock`. After a crash, verify the recorded PID has stopped before removing only that stale lock.

No always-on supervisor was installed. A command that stops, a sleeping laptop or a failed disk breaks the operating cadence. `ops:check`/`ops:watch` now report `backup_stale` when a private latest archive is missing/future/at least 24 hours old, and `maintenance_stale` when housekeeping is missing/future/older than 120 seconds or has a failed purge. The monitor checks the private file's presence/permissions and metadata; only the backup process authenticates/decrypts it, and only a drill proves restore success. `latest.json` and `status.json` are metadata, not backups. Existing private alert routing, seven-day/200-event retention and unassigned human escalation remain unchanged.

## Retention and deletion

Housekeeping authenticates each archive before expiring it at **30 days from capture**. Unknown files are untouched; corrupt, wrong-installation or unreadable archives stop the pass and remain for investigation. There is no expired-backup override. Expiry precedes lifecycle-ledger pruning so an old local recovery point cannot silently outlive its suppression coverage. External copies remain the operator's responsibility.

The local administrative maintenance process applies existing retention without a sender:

- Personal receipts/ordinary sync changes expire at 90 days, under the canonical owner lock with monotonic floor advancement in the same transaction; 20 eligible owners per pass. Current records/history are retained. Group receipts expire after 90 days, 200 per pass.
- Expired uncommitted import stages and expired auth challenges/contexts are removed in bounded batches. Auth rate buckets older than two days and group-attempt audit metadata older than 30 days are pruned.
- Existing narrow worker cleanup functions prune seven-day push receipts with owner floors, seven-day used/revoked/expired invitation hashes, and expired squad previews. Existing job cleanup removes payloads more than a day after expiry; generic push-test metadata expires after seven days.
- The existing lifecycle process performs idempotent pending purges, confirms provider absence and retains deletion suppression for **35 days after verified primary purge**. Its integration readiness checks, group cleanup, retry/backoff and terminal deletion boundary remain intact.

Backup and ordinary retention use the protected local administrative connection only inside this isolated CLI; push cleanup uses the existing restricted worker login, and lifecycle work uses its existing dedicated login/provider boundary. No new BFF, browser or ordinary-request privileges, migrations or role grants were added. The new process is not a least-privilege hosted retention service; define and verify that service separately before hosting.

## Replay and verification

After decrypting/restoring, one transaction:

1. Revokes every restored BFF session and removes provider sessions/refresh tokens/challenges. An old JWT or cookie cannot regain access.
2. Revokes all restored invitation links, clears subscription ciphertext/endpoint hashes/consent, increments installation versions, cancels queued/leased jobs/tests and removes sender heartbeats. Accepted provider outcomes stay historical; no delivery is attempted.
3. Replays the current deletion ledger with the original earliest deletion time. Accounts absent from current Auth or currently banned are also excluded from the recovered copy. The existing terminal group-identity cleanup runs before deleting restored Auth roots and their dependent private data.
4. Retains a shared group only if its current ID, revision, owner and archive state still match the backup. A changed/deleted group is quarantined by removing it **from the disposable restored copy**. This prevents old membership, transferred ownership or withdrawn posts from reappearing. The encrypted recovery point is preserved for a separate reviewed reconciliation; unchanged groups retain their records. This conservative policy can withhold otherwise recoverable shared work and is a material limit, not a silent merge strategy.
5. Checks zero enabled push subscriptions, unrevoked BFF sessions and suppressed Auth users. It requires a fresh authority sample and rechecks the live authority inventory after the drill. Failure keeps access closed and destroys the disposable target.

The automated populated drill creates only synthetic accounts. It checks surviving personal records/20 habit XP, unchanged shared tasks, removed-group denial, deleted-account purge, old-JWT denial and owner/unrelated authorization under the restored real policies. A fresh synthetic session is created only inside that networkless test target to verify positive RLS access. A group authority change during the drill fails its final gate and also exercises target cleanup. Source records and enabled subscription state are compared afterward to prove the drill did not change the source.

## Timing and rollback

The report measures recovery-point age at drill start and elapsed decrypt/restore/replay/validation time. PRD targets are RPO ≤24 hours and RTO ≤4 hours. The dated synthetic local measurement is in [OPS-02 evidence](evidence/backup-recovery-2026-10-24/README.md). It excludes outage detection, lost-source authority recovery, key retrieval, off-site transfer, group reconciliation, credential rotation and reopening a hosted service. A short local drill does not certify continuous daily backups or production RPO/RTO.

To roll back tooling, stop its watcher and retain archives, keys, deletion ledgers and compatible database/schema/browser formats. Never delete live data or downgrade migration/storage versions. Existing retention already performed cannot be undone by reverting code; an encrypted recovery point can be inspected only through the same replay/isolation gates. No production restore command or automatic cloud provisioning is provided.

References checked 24 October 2026: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [Supabase changelog](https://supabase.com/changelog). Supabase hosted backup behavior is background guidance, not evidence of a provisioned service here.
