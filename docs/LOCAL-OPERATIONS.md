# Local operations and support diagnostics

**OPS-01 · PRD-20 · SEC-07 · 24 October 2026.** This is the local/test operations boundary. Cloud provisioning, hosted monitoring, human paging, operating ownership and public contact publication remain pending. Product analytics and session replay are off; no analytics SDK, consent record, tracking identifier or third-party diagnostic destination was added.

## Run the local checks

Apply the additive migration and create the separate protected monitor configuration without resetting either installation:

```sh
npm run infra:up -- local
npm run infra:up -- test
npm run server:local
# In another terminal:
npm run ops:check -- local
npm run ops:watch -- local
# Synthetic alert-route acceptance only:
npm run ops:drill -- test
```

`ops:check` runs once. `ops:watch` checks approximately every ten seconds, stopping on Ctrl-C/SIGTERM. It does not start a BFF, sender or lifecycle process, deliver a notification, repair a queue, or contact a hosted service. Start it explicitly when monitoring is wanted; it is not an installed background service. The default local health target is the browser-compatible **4192** entry; test uses **4191**. The retained 4190 installation/profile remains intact. Exit codes: **0** no active alerts, **2** active alerts, **1** configuration/route failure. A stopped BFF or retained synthetic backlog legitimately produces alerts.

The test drill writes and reads a raised/resolved `test_alert` through the same private file route. It sends no email/message/push and does not certify human receipt. Its separate `drill.json` cannot clear a real alert. An exclusive `.rise-infra/<environment>/ops.lock` prevents concurrent check/watch writers. After an abrupt process kill, inspect the recorded process ID and confirm that it is no longer running before removing only that lock. Never remove a live lock or other private infrastructure files to force a check through.

## What is measured

The BFF emits allowlisted request diagnostics: a server-generated request ID, UTC timestamp, coarse route area, HTTP status, bounded duration, runtime release and web release. It never logs URL/query strings, headers/cookies, IP addresses, submitted operation IDs, actor IDs, error messages/stacks or request/response bodies. Origin/CSRF/session checks and request outcomes are unchanged. A synchronous diagnostic sink exception cannot change a completed response.

Local/test `server/main.ts` fingerprints `server/`, `src/` TypeScript source and the pinned lockfile at startup as `local-<hash>`; configuration/secrets are excluded. `webRelease` is the actual production HTML/PWA fingerprint. Hosted execution still requires a truthful immutable `RELEASE_ID`; hosted acceptance is pending. Factory-based integration tests supply their explicit synthetic release. Missing web metadata is `unavailable`, never invented.

Five-minute request counters use at most five minute buckets; the oldest partial minute is dropped at a minute boundary. They count non-health requests, server errors, sync 5xx/409, Auth 429 and requests taking at least two seconds. Health polling does not inflate usage counts. Counters reset on restart; they are operational signals, not activation/retention metrics or a durable audit trail. Offline/local save failures cannot reach the BFF and are diagnosed using the explicit support download. Existing transactional membership/security audit records remain in their restricted database boundary.

A separate `rise_ops_login` is a member only of non-login `rise_ops`. Its only application capability is `rise_private.operations_snapshot(environment, installation_id)`. The function checks a fixed local/test installation and returns combined notification queue counts, due age, expired pending work, stale leases, recent failed/retired outcomes, sender freshness and pending deletion failure/deadline counts. There are no owner/group/installation/job identifiers or distinctions between habit/prayer events in the result. The no-login, no-bypass `rise_ops_guard` owns the empty-search-path function and can select only required status/time columns through forced RLS. The monitor cannot query underlying tables, obtain endpoints/provider credentials or mutate work. Browser/BFF/worker/anonymous/authenticated roles cannot execute it. `.rise-infra/<environment>/ops.env` contains only its restricted DB credential, installation binding and environment; the BFF rejects `DATABASE_OPS_URL`.

## Local status and alert route

Protected files are under `.rise-infra/<environment>/operations/` (directory 0700, files 0600):

- `bff-4192.json` or `bff-4191.json`: latest request counters, rewritten every five seconds by the running BFF. The legacy 4190 entry writes its own filename.
- `status.json`: latest validated health/request/queue observation. Missing or invalid samples are `null`. It explicitly says operating ownership is unassigned. OPS-02 adds validated local backup/maintenance freshness signals, without exposing archive contents or keys.
- `alerts.json`: active fixed alert codes and raised/resolved transitions. Repeated observations do not duplicate events. The atomic file write is the routing acknowledgment; a failed write does not claim success. A backward clock relative to the last acknowledged check preserves the existing journal and fails the route until time catches up or an operator reviews it.
- `drill.json`: test-only routing evidence, separate from real alerts.

No per-request history is written by this feature. Snapshots replace the previous sample. Alert history is bounded to 200 events and seven days, pruned on each check. Stopping the processes stops pruning and sampling; retained files are stale evidence, not live health. The monitor rejects samples older than 20 seconds or more than five seconds in the future, and rejects request counters whose runtime/web release differs from the live BFF. Monitor failure/absence itself needs an external supervisor before hosted launch. stdout logs are redacted but not archived/rotated by RISE; any future collector must enforce a short retention policy (at most seven days unless a scoped incident requires documented preservation).

| Alert | Local threshold | First response |
| --- | --- | --- |
| Health/database unavailable | Probe fails or database sample is stale | Check the selected local process/installation; do not substitute admin credentials. |
| Diagnostics stale | Missing/invalid/older-than-20-second BFF snapshot | Check BFF version and private directory write access; do not report missing data as zero failures. |
| Sender unavailable | Pending work and no DB-clock heartbeat in 30 seconds | Review explicit sender readiness; do not promise delivery or replay old jobs. |
| Queue backlog / stale lease / expired pending | Oldest due age ≥30 seconds / any expired lease / any expired pending job | Inspect sender health and authorization; preserve receipt/acceptance/cancellation evidence. |
| Delivery failed | At least one failed completion in the preceding 24 hours | Review sender status with generic codes; never export endpoints or private payloads. |
| Deletion overdue / retrying | Any unpurged deadline exceeded / attempted unpurged job | Follow the lifecycle retry procedure; retain the suppression ledger. |
| Server errors / sync failures / conflicts | ≥3 HTTP 5xx / any sync 5xx / ≥5 sync 409 in the current window | Correlate release/request IDs; preserve immutable operations and recovery state. |
| Auth throttled / slow requests | ≥10 Auth 429 / ≥5 requests taking ≥2 seconds | Check abuse/load and dependency health; do not weaken quotas or authorization. |

Thresholds are local diagnostic defaults, not hosted SLOs or capacity certification. A 24-hour failure alert stays active until its observation window clears. Provider acceptance is never proof of browser display, sound or wake-up. OPS-02 now adds `backup_stale` (missing/future/≥24-hour recovery point) and `maintenance_stale` (missing/future/>120-second housekeeping or failed purge). [Recovery commands and RPO/RTO limits](SERVER-BACKUP-RECOVERY.md) distinguish a local drill from continuous service recovery. Release/rollback automation remains OPS-03.

## User-controlled support report

**Settings → Your data → Download diagnostics** uses the existing grouped-row composition in English, Russian and Uzbek Latin. It downloads `rise-diagnostics.json` only after a user action; nothing is automatically sent. The report contains its format/version/time, web release, storage contract, allowlisted save/sync status/error codes, a boolean for pending changes/persistent storage, online state and worker-control state. Unknown errors become `unknown`; arbitrary messages never pass through. `pendingChanges` also stays true for an unacknowledged/failed local save. `persistentStorage` describes device-retained versus session-only account mode; it is not proof of a granted browser persistent-storage permission or protection from eviction. It contains no profile, names, account IDs, counts of personal records, free text, prayer/pause/location data, URLs, invitation tokens, push consent/endpoints, cookies, backup payloads or credentials. It creates no new browser database/cache and does not dispatch a domain command. A failed download has a localized visible retryable error.

Ask the user to review the file and share it only through the existing private project conversation. Examples: `online:false` with `syncPhase:offline` indicates a connection problem; `storageStatus:attention` with `storageError:save` indicates an unacknowledged local save; `syncPhase:attention` and a recovery code requires the existing reviewed recovery flow. These fields narrow the investigation; they do not prove a root cause. Do not ask for a private profile export, password/code or copied cookies. Diagnose the declared release and status first. Preserve pending edits and the original recovery source; never suggest clearing a profile as a generic repair.

## Ownership and incident escalation

| Responsibility | Current local status |
| --- | --- |
| Primary incident owner — first person contacted | Unassigned; requires a named human |
| Backup owner — person contacted when primary is unavailable | Unassigned; requires a named human |
| Private support/security contact | Existing private project conversation is interim only; no dedicated address published |
| Staffed response window / external paging | Unassigned and unverified; no 24/7 promise |

An incident should be contained at the smallest affected capability, with UTC time, release and minimal redacted evidence preserved privately. Review/revoke the affected session or installation through its authorized lifecycle, repair the cause, then verify normal and unauthorized cases. For a restore, replay deletion/revocation authority before re-enabling delivery. Communicate verified scope and recovery status through the approved private route. Before public operation, assign the table above, approve a private contact and response window, configure external liveness/alert routing, run a human receipt/escalation drill and link its evidence. Local file routing cannot satisfy those human or hosted gates.

## Compatibility and rollback

Migration `20261024180000_local_operations.sql` adds roles, column grants/read policies and one function. It changes no rows or storage formats. Local bootstrap adds only a new monitor password to the existing protected state and never regenerates existing credentials. Stop the monitor and revert application code to roll back this feature; retain the compatible additive schema and data. If revoking the monitor later, revoke its login/function execution through a reviewed administrative migration, without dropping data or deletion ledgers. Diagnostic artifacts are not backups and must not enter portable exports or the public PWA cache.

The implementation follows current official [function privilege guidance](https://supabase.com/docs/guides/database/functions), [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and the [changelog reviewed on 24 October 2026](https://supabase.com/changelog). No hosted change was made.
