# Optional group notification acceptance

24 October 2026 · GROUP-04 / PRD-11, PRD-14–15. Local/test Auth, Postgres, BFF and isolated sender on macOS. Cloud provisioning remains pending. All accounts, subscriptions and deliveries were synthetic; no real invitation, email or push was sent. The saved profile on 4173 was not accessed.

Explicit default-off group opt-in now combines with separate installation consent, mandatory group-timezone quiet hours and bounded generic notifications for assignments and explicit squad publication. The sender and receiving worker recheck current sessions, source revision, both memberships, installation and deletion suppression. Exact retries never duplicate delivery; cancellation preserves provider acceptance while suppressing later presentation. See the [contract](../../GROUP-NOTIFICATIONS.md) for limits, failure behavior and rollback. The earlier [invitation increment](../group-invitations-2026-10-24/README.md) is part of the same task.

| Command | Result |
| --- | --- |
| `npm run check` | 263 unit/tooling tests; toolchain, lint, app/test/server types and both builds pass |
| `npm run test:infra` | 156 real database/BFF cases pass, including 14 optional-notification cases |
| `npm run test:groups` | 93 cases pass across Chromium, WebKit and Firefox |
| `npm run test:push` | 54 cases pass |
| `npm run test:sync` | 69 cases pass |
| `npm run test:pwa` | 42 real-worker lifecycle/entry cases pass |
| `npm run test:production` | 54 cases pass |
| `npm run test:browser` | 378 existing journey, persistence, prayer and backup cases pass |
| `npm run test:visual` | 48 cases compare all 720 unchanged frozen images successfully |
| `npm run typecheck`, `npm run lint` | Pass after the final layout-fixture additions |
| `npm run infra:up -- test` / `-- local` | Both retained installations apply both additive migrations |
| Supabase local/test database advisors, all types at warning level | No issues |
| `npm run check:docs` | 34 documents, 512 local links, 58 anchors, 38 tasks and 20 requirements; no failures |

Node 24.16.0, npm 11.13.0, Playwright 1.64.1, Supabase CLI 2.121.0; Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. BFF suites run sequentially on 4191 with credential captures disabled. PWA and production use 4181 sequentially; journeys use 4180 and visual comparisons use 4182. Browser provider, permission and display adapters are synthetic. Encrypted sender payloads, the current-authorization API and worker occurrence-ledger logic were exercised; physical delivery and sound were not certified.

Database acceptance covers separate consent and legacy bodies, no opt-in backfill, immutable retry, no XP side effects, closed generic payloads, exact receive tuples, quiet hours/DST, correction/withdrawal, departure/removal/archive/mute, logout/installation rotation, quota exhaustion, transactional rollback, recoverable leases, expiry/backoff, concurrent provider acceptance, forced RLS and narrow grants. Recipient/source deletion clears jobs, and retained suppression blocks restored source identities even before terminal cleanup repeats.

The new Background notifications sheet uses the existing visual system and installation controls. Its title initially clipped at 320 px/200% text; the existing flexible group-header treatment now includes this sheet. A layout fixture also changed its mock authentication instant on every refresh, causing a remount during measurement; its metadata is now stable. Before/after screenshots show the same unverified English blocked-permission scene. Enabled privacy controls and pending disable are also checked. Fifteen membership/settings scenes cover three languages, two appearances, five widths (320/375/393/430/1440) and two text scales in three engines: 2,700 states. Including task/list/priority and squad layouts, the group suite covers 5,940 states. Forty-five new safe captures show settings and device states; no usable session or code appears.

[Before header](screens/before-notification-device-en-light-320-200.png), [after header](screens/groups-notification-device-en-light-320-200.png), [Russian enlarged privacy controls](screens/groups-notification-privacy-controls-ru-dark-320-200.png), [Uzbek pending disable](screens/groups-notification-pending-uz-light-393-100.png).

A restored-source deletion test initially reproduced an unauthorized send: recipient suppression alone did not reject a source author restored under its retained deletion ledger. The additive `20261024054131_group_notice_source_suppression.sql` closes send and receive authorization for either suppressed party. The original migration was not rewritten. Earlier full database failures also exposed synthetic deletion jobs left queued by test cleanup; those fixtures now finish their own bounded lifecycle work. The 100,000-row invitation case timed out while competing with a full visual run; its unchanged isolated check and final full database suite pass. No production timeout, quota or authorization rule was weakened. Earlier layout runs failed or were stopped after the same header failure; the final complete run supersedes them.

The retained local CLI workdir also contained 21 duplicate migration files with ` 2.sql` suffixes. Each matched its canonical root migration byte-for-byte. Only those generated copies were moved to a private recovery folder with hashes; database history, keys and applied root migrations were preserved. Normal migration then succeeded. The [environment guide](../../BACKEND-ENVIRONMENTS.md) records this recovery; raw private CLI state is not included here.

Changes cover the group preference contract, durable draft acknowledgment, localized settings/device entry, group receipt effect, isolated queue sender, receive API, root worker, sender runtime/CLI, tests and current guides. Two additive migrations install the job/cancellation boundary and suppression correction. No dependency, artwork, cache/backup format, old migration, historical evidence or frozen visual reference changed. The only public asset change is the intended root-worker code; CSS changes are scoped to the new sheet. The existing full browser capture tests refreshed six disposable images under `.impeccable/review/`; they are listed separately from source changes in the preservation record. Rollback preserves accepted receipts, suppression, jobs, caches and installation keys; stop sending before a rollback or restore and replay deletion suppression before resuming.

GROUP-04 is locally complete and in REVIEW for hosted/device acceptance. Wider shared-export/cache/deletion/restore acceptance follows in GROUP-05. Hosted operation, proxy logging, load monitoring and physical HTTPS-device proof remain release gates.

[Verification/source/build hashes](verification.json), [preservation audit](preservation.json), [visual manifest](visual-manifest.json), [full database log](logs/infra-final.log), [initial suppression failure](logs/infra-recovery.log), [full browser log](logs/groups-final.log), [frozen visual log](logs/visual-final.log), [final document check](logs/docs-final.log).
