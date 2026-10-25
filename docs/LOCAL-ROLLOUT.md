# Local release and rollback — OPS-03

This is the local/test implementation of PRD-20 and SEC-06. Cloud provisioning, a hosted deployment supervisor, TLS/device acceptance and public release approval remain pending. The existing preview on 4173 and retained installation on 4190 are not deployment-test targets.

## Build and admission

Run the relevant checks before packaging:

~~~sh
npm run check
npm run release:build
~~~

`release:build` copies an explicit source allowlist to a temporary directory, detects changes during copying, installs the pinned lockfile offline with lifecycle scripts disabled, and builds the production PWA there. It does not rebuild the user's preview directory. Populate the ordinary npm cache with the normal reviewed `npm ci` first if offline installation fails. It inherits no provider credentials, `VITE_*`, Node hooks or user npm configuration.

The command returns a release ID and web release ID. `.rise-infra/releases/<release-id>/` contains the frozen frontend, server/domain source, runtime dependencies and a content-addressed manifest. Files/directories are read-only. The manifest hashes dependencies and symlink targets as well as app files; symlinks cannot escape the package. The package excludes environment files, saved profiles, test entry points and native bundles. Browser output must be production-only, with a matching worker contract and every public asset digest present. A publication ID changes the worker release even when republishing the same source; screens and data formats do not change.

Packages are local, platform/architecture/Node-specific artifacts, not signed supply-chain attestations. Trusted filesystem ownership is still required. Keep the active and previous packages; no automatic release pruning is implemented.

If packaging fails while sealing or publishing its temporary build, cleanup restores owner-write permission only on that build's directories before removal. It rejects paths outside the OS temporary build namespace and never follows symbolic links or prunes retained releases. An incomplete cleanup produces a separate sanitized error; review local disk space and permissions before retrying. This repairs the verified read-only-directory cleanup failure without changing package admission or saved data. [Focused regression and scope](evidence/local-completion-2026-10-25/release-security/README.md).

## Select and serve

~~~sh
npm run release:verify -- test <release-id>
npm run release:select -- test <release-id>
npm run release:serve -- test
~~~

Use `local` for the fixed browser-compatible local installation on 4192, or `test` for isolated 4191. No hosted environment or arbitrary origin is accepted. Do not run another BFF on the same port. The selector writes a prepared request; **selection alone is not deployment**. The foreground supervisor starts it, verifies HTTP readiness and records actual activation. Run selection commands in a second terminal while the supervisor runs. Stop with Ctrl-C; it closes only its own child and releases its lock. This is not an installed always-on system service.

Protected configuration is loaded separately from `.rise-infra/<environment>/server.env`, with the existing strict identity/role/origin checks. Keys, installation identity and cookies are preserved. Credentials travel to the child through stdin, never command-line arguments, manifest, public files or logs. The BFF cannot inherit administrative or sender keys. Its code and dependencies resolve inside the sealed package.

The frozen entry retains its original single-process BFF. The [execution-thread proposal](BFF-EXECUTION.md) and its focused tests are archived without adoption pending complete capacity/rollout evidence. Candidate preflight and the current server can already coexist with two five-connection pool budgets; that sequencing is unchanged. The independent failed-build cleanup correction above remains implemented. No worker runtime, schema/cache/API change, automatic mutation retry or response truncation is enabled by the experiment.

Admission checks the current fixed stack and exact applied migration history, source migration hashes, PWA/storage/API contracts and runtime fingerprint. A candidate starts on an ephemeral loopback port for a real health probe before the serving child is stopped. The replacement then binds the installation's original browser origin and must pass health again. If that replacement cannot start, the supervisor revalidates and restarts the previous compatible package. There is a short restart interval; this is not a zero-downtime rollout. A failed preflight leaves the serving child intact. Corrupt selection files cannot replace a running release.

## Schema and delivery order

This first local contract permits only an **identical migration set and identical storage/API compatibility contracts**. Missing, extra or changed migrations fail closed. The release tools execute no migrations, down migrations, resets, row deletion or cache clearing. A schema expansion needs its own reviewed migration, real database tests and explicit compatibility work before this gate can be widened. Never edit an applied migration or change a manifest to bypass admission.

For a future schema change: verify backup/recovery; review and apply additive compatible migrations using the existing environment workflow; verify both runtime versions; update the tested compatibility contract; stage the backend and isolated sender; publish the complete frontend; verify current readiness. Hosted execution remains unimplemented. The local supervisor packages the sender's source but **never starts push sending or lifecycle/maintenance jobs**. Existing independently running jobs must be accounted for by the operator; the release record's `senderStarted: false` does not assert that all other senders are stopped. Worker liveness continues to derive from the existing database heartbeat.

## Pause and roll back

~~~sh
npm run release:select -- test <active-release-id> paused
npm run release:rollback -- test
npm run release:select -- test <restored-release-id>
~~~

`paused` sets the BFF's strict server-only `RISE_WRITES_ENABLED=false`. Reads and health remain available, and logout still uses its normal authorization. Other API mutations return the existing retryable unavailable error and do not reach domain handlers. Browser flags, query strings and submitted roles cannot override it. Ordinary startup defaults to enabled; invalid values fail startup. This is a temporary write pause, not session revocation or a push cancellation mechanism. Retried operations retain their original IDs/bodies. Resume explicitly after health and data checks.

After each selection, wait for `release_active` and verify the protected state/current health before continuing. Rollback refuses a pending or changed selection instead of overwriting a newer pause choice. Once settled, rollback selects the previous **different** release, retaining the current pause choice. Flag-only restarts do not discard the previous release. Previous fingerprinted JS/CSS remains available to older tabs; previous HTML, worker, configuration and private responses are never fallback content. Only current HTML and worker are published, with their existing no-cache policy.

The browser's newer worker may remain active until the user chooses **Update RISE**. Preserve the existing all-tab update leases and contract checks. Remembered account edits already durably stored in the compatible outbox can survive that update; unsaved/session-only work and open forms retain their existing update blocks. Never unregister the worker, reset an origin or downgrade IndexedDB to force rollback. After reconnect/resume, verify exact queue replay, session continuity, domain totals and preserved guest/recovery sources.

## Records and recovery

`.rise-infra/<environment>/deployment/` holds protected desired/state files, selection/server locks, and per-request outcome records. Records include release/web IDs, previous release, time, write setting and whether this supervisor started a sender. They contain no identities, tokens or journey content. `prepared`, `started`/`activated`, `rejected` and `restored` are distinct outcomes; inspect state and current health before claiming deployment. The BFF continues publishing the existing redacted operational snapshot.

If a process is killed before lock cleanup, inspect the owning process and port before removing only its stale deployment lock. Never remove a live lock, stop an unrelated process or delete installation configuration. If startup has no healthy compatible release, it fails closed; select a verified known-good package after resolving the cause. An operator must reconcile an interrupted switch against current health and the preserved records. Do not use rollback as database disaster recovery; follow [server recovery](SERVER-BACKUP-RECOVERY.md) instead.

## Verification

`npm run test:rollout` builds two isolated sealed packages and exercises the real supervisor, real local Auth/database, active session, paused pending outbox, actual root worker update and rollback in Chromium, WebKit and Firefox. It uses only synthetic accounts on 4191, blocks external browser requests and disables credential-flow traces/video/screenshots. Run sequentially with all other database/BFF suites. `npm run test:pwa` separately covers failed installation, incompatible contracts, offline startup and update holds. Evidence is in [the dated OPS-03 report](evidence/local-rollout-2026-10-24/README.md).

The official [Supabase migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [changelog](https://supabase.com/changelog) were checked on 24 October 2026. Migration tracking is checked read-only here. The announced retirement of obsolete hosted HTTP TLS ciphers does not authorize weakening TLS or provisioning cloud services.
