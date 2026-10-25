# RISE — Security and Privacy Requirements

**Local background sender, 23 October 2026:** consented prayer/Fajr/habit jobs now use the isolated encrypted sender. Readiness follows its live heartbeat; the receiving worker checks current server authorization before presentation, including cancellation after provider acceptance. Design and saved-profile formats are preserved. Bounded queue/receipt cleanup and a local 200-job load check are implemented; hosted operation/load acceptance and physical HTTPS-device evidence remain pending. Cloud provisioning stays pending. See [local live-sender integration](docs/LIVE-PUSH-SENDER.md).

**Version:** 1.0 · **Updated:** 22 October 2026  
**Scope:** mobile web v1 and its proposed account, database, collaboration and notification infrastructure.  
**Status:** security specification, not a completed audit, compliance certificate or description of controls already deployed.

[PRD.md](PRD.md) defines the product. [ARCHITECTURE.md](ARCHITECTURE.md) defines the target system. [TASKS.md](TASKS.md) tracks implementation and evidence.

## Contents

- [1. Current posture and security objectives](#1-current-posture-and-security-objectives)
- [2. Data classification and handling](#2-data-classification-and-handling)
- [3. Threat model](#3-threat-model)
- [4. Authorization model — SEC-01](#4-authorization-model--sec-01)
- [5. Authentication and session controls — SEC-02](#5-authentication-and-session-controls--sec-02)
- [6. Browser and service-worker controls — SEC-03](#6-browser-and-service-worker-controls--sec-03)
- [7. Notification security — SEC-04](#7-notification-security--sec-04)
- [8. Retention, deletion and recovery — SEC-05](#8-retention-deletion-and-recovery--sec-05)
- [9. Infrastructure, secrets and dependency controls — SEC-06](#9-infrastructure-secrets-and-dependency-controls--sec-06)
- [10. Monitoring and incident response — SEC-07](#10-monitoring-and-incident-response--sec-07)
- [11. Vulnerability reporting](#11-vulnerability-reporting)
- [12. Verification and release checklist](#12-verification-and-release-checklist)
- [13. Maintenance](#13-maintenance)

## 1. Current posture and security objectives

The guest app stores a validated private profile in IndexedDB and preserves its exact legacy source. Separate local managed sessions, owner/current-session RLS and consented account synchronization now exist; public hosting, production security acceptance, hosted verification of shared authorization, server backup and hosted/physical-device Web Push acceptance remain pending. PUSH-01 adds the local subscription/test security boundary described below. Local tests do not certify those release properties.

DATA-01 adds runtime validation (50 MiB JSON, 250,000 object records, depth 20 and field limits), worker-based legacy migration, readback verification, duplicate-operation protection and explicit recovery on quota/corruption/conflict. Metadata flags sample/mixed or unverified legacy provenance; no record is cloud-eligible. Compatibility receipts contain revision/hash metadata; validated domain operations remain local. Coordinates and raw calculation keys are never put in a generic outbound whole-profile payload. The original source and raw device archive are sensitive downloads and deliberately preserve unknown safe fields; keep them private.

DATA-02 adds a known-field private backup with checked metadata/checksum, worker validation/cancel, previewed full replacement and one atomic pre-import recovery point. Portable exports exclude credentials, push subscriptions/endpoints and invitation secrets; unknown extensions/drafts are excluded with notice. Unsupported known drafts or oversized exports fail without truncation and expose raw preservation. Private location settings can appear only in this explicit, unencrypted user download. Shared snapshots import as read-only local archives outside live state; notification delivery and readiness are not inherited. Same-device rollback returns the exact local snapshot. Format-2 repository records block older clients from accidentally clearing only part of this new storage. See the [backup threat boundaries and recovery guide](docs/BACKUP-RESTORE.md). These controls do not complete the server authorization/deletion replay portions of SEC-03/SEC-05.

DATA-03 routes personal UI actions through runtime-checked intents and stable local operation envelopes. The profile and receipt commit atomically; failed writes retain the prior durable profile and the unsaved snapshot for export/retry. Command context captures the action date, timezone and instant for deterministic retries. It is local provenance, not trusted server time or identity. Draft writes cannot modify records outside the draft collection; form submission uses explicit commands and domain validation.

Local domain receipts now contain private command payloads, which can include earlier drafts, work notes, prayer/pause information and location settings. Treat the database and raw recovery archives as sensitive. Portable backups exclude operation history and project only the current supported state; they now include habit-edit, goal, reward, priority, reflection and onboarding drafts. Receipts remain local and cloud-ineligible, with no sender or automatic retention pruning. Explicit clearing removes them; future retention/compaction and cloud projections must preserve replay protection and deletion requirements.

PRAY-01 keeps calculation, coordinate-to-zone lookup and travel detection on the device. Travel detection reads the device timezone identifier, not location coordinates. The optional observed/reviewed timezone marker and its command receipts are private device metadata; portable backups omit the marker. No routine outbound serializer, account sync or background geolocation is added. Explicit manual saves validate the selected date/zone before commit, and unavailable dates cannot produce an alert plan. Legacy recovery sources and existing checked/manual records remain preserved. Ambiguous legacy clock-only changes are withheld from alerts until explicit manual review. Browser/OS timezone databases still require current device software; automated engine checks are not physical-device certification.

PRAY-02 keeps dated Fajr backup choices and draft dates in the existing private device profile and validated private backup. It adds no pause reasons, health fields or external serializer. Prayer window/streak comparisons are pure; clock changes, pause/resume and wake acknowledgment cannot create prayer records or habit XP. Live acknowledgment and preview state are isolated, and an invalid resumption point cannot erase an exclusion interval. Captured client time remains untrusted provenance. Raw recovery and local receipts retain their existing sensitivity; no account sync or remote cancellation is implemented by this task.

AUTH-01 implements local managed email-code sessions, exact-Origin/session-bound CSRF, hashed opaque HttpOnly identifiers, encrypted provider material and serialized refresh. Forced-RLS private metadata and a narrow active-session predicate reject revoked/expired/provider-removed/banned identities. Account controls keep identity in memory. The current guest journey, receipts and drafts remain separate during login/logout/switching. Remembered-session consent permits owner-scoped offline account retention after explicit account use; session-only state stays in memory. See [the auth threat boundaries and local HTTP exception](docs/AUTH-SESSIONS.md). Hosted SMTP/HTTPS and integrated release security remain gates.

Quota reservations release shared IP/email locks before provider calls. Both reservation and challenge transactions validate CSRF and applicable session/reauthentication authority; failed or interrupted attempts remain charged. No client-visible reservation token, quota increase or timeout relaxation is introduced. Browser failure diagnostics retain only bounded route/status/allowlisted error codes, never email, code, cookies, tokens or raw provider errors. [Local verification](docs/evidence/signin-queue-2026-10-25/README.md).

AUTH-02 supplies 24 forced-RLS canonical personal tables, owner-inclusive keys, invoker XP totals and one transaction for data/revision/receipt. SYNC-01 connects explicit account use/import through separate owner caches/outboxes and two additional forced-RLS staging tables. Signing in alone never uploads guest data. Strict known-field projections exclude coordinates/raw calculation keys, drafts, timers, delivery consent and simulated membership. Expected account assertions cannot replace session identity. Conflicts preserve intent without silent overwrite. See [the sync privacy, cache and recovery contract](docs/ACCOUNT-SYNC.md); local negative checks/advisors are not a production audit.

Browser eviction, user storage clearing and loss before a transaction acknowledges remain possible. No server-backup or physical-device durability claim is implied by local tests. Remembered account caches remain subject to ordinary browser eviction and shared-device exposure. Forced termination before acknowledgment is not treated as a successful save.

RISE handles data that can reveal religion, daily routines, location, relationships and private prayer pauses. Treat it as sensitive regardless of the legal classification in a particular market.

Security objectives:

1. Only the owner can access private records; group ownership never grants access to members' private lives.
2. Sharing is deliberate, field-limited and revocable for future access.
3. Data survives ordinary faults without silent corruption or duplicate effects.
4. Credentials and infrastructure privileges never reach the browser or exports.
5. Notifications do not expose private information or become an unsolicited messaging channel.
6. Users understand local storage, cloud sync, deletion and platform limitations.
7. Operators can detect and recover from failures without routinely reading private content.

No end-to-end encryption claim is made. Proposed TLS and encryption at rest protect transport/storage but do not prevent authorized backend processing or all operator access.


QUALITY-03’s allocation changes retain the existing JSON safety, schema and reference checks. Direct object validation rejects enumerable/non-enumerable accessors without invoking them, hidden unsafe keys, invalid prototypes, depth beyond 20 and more than 250,000 object records. The private path immediately after `JSON.parse` reads its own data properties without redundant descriptor inspection: parsing cannot create accessors. It retains the same unsafe-key, finite-number, depth, record and UTF-8 byte limits. Arbitrary object callers always use descriptor checks; there is no caller-controlled validation bypass. [Measurement scope and constraints](docs/PERFORMANCE.md).

## 2. Data classification and handling

| Class | Examples | Handling |
| --- | --- | --- |
| Public | App assets, documentation, VAPID public key | Cacheable; no private data mixed into public build output |
| Account-private | Name, language, preferences, habits, goals, rewards | Authenticated owner access; cloud only after account/import consent |
| Highly sensitive private | Prayer history, pause ranges, reflections, saved work notes, timetable/routine | No group access, analytics or ordinary logs; encrypted infrastructure storage |
| Device-private | Precise coordinates, unsaved drafts, timer state | Local by default; coordinates never in routine sync/jobs; full export clearly labeled |
| Intentionally shared | Family tasks/lists, chosen squad snapshot and member display name | Active-member access only; exact field projection |
| Secrets | Session IDs, provider refresh tokens, private keys, invite tokens, push endpoints/key material | Server-controlled, encrypted/hash as appropriate, excluded from logs/exports |
| Operational | Request IDs, error codes, queue counts, audit actor IDs | Minimize, restrict and expire; never attach full profile content |

Group names and shared free text can also contain sensitive information. “Shared” means restricted to the selected group, not public.

Before first cloud upload, describe synchronized categories and offer a reviewable import summary. A local guest account does not silently become a cloud account. Device geolocation is requested only through a meaningful user action; denying it leaves presets/manual entry available. The legacy `calculationKey` contains coordinates: omit it through the explicit sync field projection. Future notification references must use an opaque settings-revision ID instead. Test all exports, sync requests and notification plans for unintended coordinate leakage.

## 3. Threat model

| Threat | Example | Required mitigation | Evidence |
| --- | --- | --- | --- |
| Broken object authorization | Member substitutes another user's prayer record ID | Owner predicates and active-account checks in every read/write; RLS | Cross-user integration tests |
| Cross-group access | Member uses a task ID from another family | Group-scoped authorization and composite ownership references | Read/edit/export/reaction negative tests |
| Stale membership | Removed member retries an old offline edit | Check current membership transactionally, not stale JWT role | Revocation during queued write |
| XSS and stored injection | Malicious habit name, reflection or imported JSON | Render plain text, validate fields, CSP, no unsafe HTML paths | Stored/reflected payload tests |
| CSRF | Another site submits a group transfer or push registration | Exact Origin checks, session-bound CSRF token, SameSite cookies | Cross-origin request tests |
| Credential/session theft | Token included in local export or logs | HttpOnly opaque cookie, encrypted server token store, redaction | Bundle/storage/log inspection |
| Invite abuse | Token guessing, reuse, unintended group access | Random high-entropy token, hash, expiry, single-use, explicit acceptance | Concurrent/revoked/expired invitation tests |
| Sync races and replay | Check-in retried after response loss | Transactional idempotency and revision checks | Fault and concurrency tests |
| Worker SSRF | Fake push endpoint points to metadata/internal network | Provider allowlist, HTTPS-only, DNS/IP validation, no redirects | Malicious endpoint and rebinding tests |
| Notification disclosure | Lock-screen body contains a prayer or pause record | Generic default content, per-device detailed-content consent | Device captures and payload inspection |
| Local/shared device exposure | Next user sees prior account's cache | Owner-scoped cache, logout purge, explicit remembered-device option | Account switch/offline tests |
| Restore resurrects deleted data | Old backup restores a removed account or membership | Deletion ledger replay before access; revoked identities stay blocked | Isolated restore exercise |
| Supply-chain compromise | Malicious dependency or leaked deployment secret | Lockfile/pins, secret scan, least-privilege CI, protected deployment | Dependency/build review |
| Abuse/resource exhaustion | Repeated OTPs, giant imports or notification plans | Per-account/IP/device limits, bounded payloads and queues | Rate/size/load tests |

Assume browser input, query parameters, stored JSON, import files, push payloads and all client-calculated timestamps are untrusted. Command boundaries reject malformed/unknown/oversized commands before adapter access and handle revision/replay conflicts. Production builds exclude review modules, and review initialization is restricted to isolated loopback origins. DATA-01/DATA-02 separately validate stored profiles and imports. AUTH-02 now adds local server authorization and hostile-access tests; hosted/shared authorization, integrated SAFE verification and data-lifecycle gates remain incomplete. Local UI visibility is never authorization.

## 4. Authorization model — SEC-01

Default deny. Every query returns only the fields its caller needs.

| Resource/action | Guest | Signed-in owner | Active group member | Group owner | Operator |
| --- | --- | --- | --- | --- | --- |
| Private habits/goals/rewards/prayers/pauses | Own device only | Own records | No access to another member | No access to another member | No routine content access |
| Personal export/deletion | Local export/clear | Own account, recent auth for sensitive actions | No access to another member | No access to another member | Audited lifecycle tooling only |
| Shared archive download | No | Only if current member | Authorized group projection with recent auth/revision review | Same current-member projection | No routine content access |
| Group display/member names | No group access | Only if member | Read minimal member projection | Read minimal projection | Restricted support metadata |
| Family tasks/lists | Local drafts only | If active member | Create/read/edit/complete/archive | Same, plus administration | No routine edits |
| Squad post | No | Author if member | Read; own reactions | Read; remove abusive shared content | Escalated support only |
| Squad post edit/withdraw | No | Author only | Author only | Removal allowed; cannot impersonate author | Audited removal only |
| Invite/create/revoke/remove/rename | No | If group owner | No administrative grant | Yes | Exceptional audited recovery |
| Ownership transfer | No | If current owner | Must be eligible recipient | Recent-auth transactional transfer | Documented recovery process |
| Archive/restore group | No | If owner | Read archived data only | Yes | Exceptional audited recovery |
| Push subscription/plan | No remote subscription or server plan; optional device foreground reminders | Own installation/account | No other members' subscriptions | No other members' subscriptions | Worker sees limited dispatch data |

Archived groups are read-only to members. Removed/left members cannot fetch future content, publish, mutate cached records or export the group. Already downloaded information and screenshots cannot be remotely recalled.

Supabase access policies must enforce owner/current-membership rules, check both existing and replacement ownership on update, and cover joins/views/functions. Do not authorize from user-editable metadata. Privileged keys and definer functions can bypass ordinary policies and require explicit isolation. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) explains the underlying mechanism; this matrix is RISE's required policy.

Never use a broad backend admin key as a shortcut for ordinary user operations. Negative tests must call the backend directly, not merely verify hidden buttons.

Implemented personal authorization: `Sessions.asActor` verifies the managed identity and active stored session, checks mutation CSRF and sets transaction-local claims on the restricted BFF connection. The database trusts the BFF to establish that identity; SQL `set_config` is not independent JWT-signature verification. Every personal policy checks owner **and** the linked active-session predicate, with `USING`/`WITH CHECK` on updates. The totals view preserves caller grants/RLS. Provider `authenticated` is SELECT-only; `rise` is excluded from the Data API, and anonymous/worker/lifecycle roles cannot read personal tables/views. The BFF cannot delete profiles or update/delete receipts. No new definer command function or bypass-RLS role is introduced. Direct tests cover every table under owner, unrelated, forged-metadata, wrong/revoked-session and anonymous identities, attempted ownership replacement and cross-owner foreign keys.

Same-session admission is an in-memory resource bound, not an authentication cache. It retains at most 256 running/waiting operations and 16 per opaque-session digest, with a 3,000 ms pre-pool wait and an admission-time deadline recheck. Overflow/expiry returns generic retryable unavailability without running the operation. Admitted work rechecks the provider/session/account, CSRF and current RLS; queued revocation cannot inherit earlier authorization. No digest or private payload is added to logs, exports or durable storage. Cross-instance locking, logout and deletion still use their existing database boundaries. [Exact scheduling contract](docs/AUTH-SESSIONS.md#bounded-session-admission).

The [archived BFF execution proposal](docs/BFF-EXECUTION.md) tested cross-thread session admission, restricted roles, exact ingress limits and retries after process loss before dispatch/after commit. It was not adopted: both small measured variants missed the complete HTTP gate. After the initial disk-guard block was resolved, the full100 candidate also failed capacity; exact recovery and complete history/XP checks passed. The active entry retains the current single-process boundary. The proposal's 32 MiB bound covered admitted inputs only, not total memory/output buffering; it must not be presented as an active security or capacity guarantee.

Commands take actor/time only from the verified session/database, derive XP from occurrences, and commit the result receipt atomically. Changed operation-ID reuse and stale bases return 409. Receipt-insertion failure rolls back both data and canonical revision. Receipts retain only the request fingerprint and minimal outcome, excluding command text; SYNC-02 adds an owner/active-session/older-than-90-days DELETE policy and an atomic rebase floor. Receipts remain non-updatable; pruning is opportunistic during owner activity, not a scheduled purge guarantee. The existing private metadata/session guard remains a separately reviewed, narrowly privileged boundary. Local membership permissions now follow the narrow [group authority boundary](docs/GROUP-MEMBERSHIP.md); the [family task/list boundary](docs/SHARED-CONTENT.md) now uses the same verified authority through account-selected browser controls. GROUP-03 implements exact preview/publication and author/member permissions locally; its local acceptance checks pass ([evidence](docs/evidence/squad-snapshots-2026-10-24/README.md)). Local account export/deletion follows the DATA-04 boundary described below.

## 5. Authentication and session controls — SEC-02

The local BFF delegates email-code verification to managed Auth. It does not implement homegrown password or OTP cryptography. Hosted deployment remains pending; the combined shared-content/group-notification lifecycle is locally verified in GROUP-05; DATA-04 supplies local account export/deletion, GROUP-01 supplies membership resolution, and PUSH-01–04 supply local subscription/plan/job cleanup. The implemented policy, rolling limits, restricted predicate owner, encryption key custody and recovery are documented in [AUTH-SESSIONS](docs/AUTH-SESSIONS.md).

- Use neutral code-request responses to limit account enumeration.
- Bind verification to a server-side challenge, expiry and attempt limits.
- Never log the code, challenge secret, email verification URL or provider tokens.
- Allow only configured same-origin return destinations. An invite is not authentication.
- Create a fresh opaque session identifier after authentication or privilege-sensitive changes.
- Cookie: `__Host-rise_session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain.
- Development exception: only fixed HTTP loopback local/test origins use separate `rise_local_*`/`rise_test_*` cookies without Secure. Hosted HTTP fails startup; this exception cannot certify production cookie transport.
- Store the session identifier hash and encrypted provider token material server-side; serialize token refresh.
- Default session target: 30-minute idle/12-hour absolute. Explicit remembered-device target: seven-day idle/30-day absolute. These are RISE policy values to validate in the pilot, not provider defaults.
- Recent authentication means within ten minutes for ownership transfer, account deletion and sensitive account export.
- Revoke server sessions and subscriptions on account deletion; verify active account/session on requests. Managed JWT validity can outlive logout, so actor-scoped database access also checks linked session revocation rather than trusting token expiry alone.
- Administrative consoles require MFA and least-privilege named accounts.

OWASP recommends protecting session identifiers and using secure cookie attributes; RISE's chosen session lifetimes above are product-specific controls. [Session management reference](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Revoking a server session prevents new server access; it cannot erase data from a disconnected remembered device. On recognized expiry/identity change, SYNC-01 immediately hides the account and clears the active scope choice. Pending owner data stays locked for same-owner reauthentication/recovery, never displayed or sent as a different account. Confirmed logout purges the selected cache after sync/export or explicit version-bound discard; newer pending work arriving during logout remains locked. DATA-04 now supplies local account deletion; scheduled hosted retention and shared/scheduled notification cancellation remain OPS-02/PUSH gates. PUSH-01 implements local installation cleanup. Explain persistent offline exposure before enabling remembered-device retention.

When logging out with unsynced personal work, offer sync/export or explicit discard. Clear account-scoped state before showing a different account; never copy it into the guest profile automatically. Session-only account mode uses an in-memory cache, not persistent plaintext storage that depends on a reliable browser-close event for deletion. Durable offline work requires guest mode or an explicit remembered-device choice.

## 6. Browser and service-worker controls — SEC-03

### Input and rendering

Validate on the server and client with shared schemas. Use parameterized queries and allowlisted mutations. Strings are plain text in v1; no rich HTML, executable Markdown, remote embeds or user-supplied script/URL rendering.

Proposed limits, enforced consistently and tested with Unicode:

| Field/request | Initial maximum |
| --- | --- |
| Display name | 80 Unicode characters |
| Habit/goal/task/list/reward title | 160 characters |
| Reflection/work note/task note | 5,000 characters |
| Squad update text | 600 Unicode characters, matching the existing composition limit; implemented by GROUP-03 |
| Regular JSON mutation request | 64 KiB |
| Sync batch | 100 commands and 512 KiB |
| Notification plan request | 512 KiB, also subject to event-count/horizon limits |
| Import | 50 MiB uncompressed JSON, 250,000 records, depth 20 |
| Invitation token | Fixed-format random 256-bit token before encoding |
| Notification plan | Seven days; maximum 1,000 events per account plan |

Reject prototype-pollution keys, unsupported schemas, invalid references and pathological nesting. Validate dates, finite numbers, enum values, timezones and text lengths. Validate large files off the main thread with bounded memory and progress/cancel feedback; do not freeze mobile navigation. Import into staging memory/storage and commit only after validation; never evaluate imported code. Round-trip the PRD's representative two-year/100-habit profile within these limits. If a legitimate profile exceeds the supported limit, preserve the export and report the limitation without truncation; evolve the versioned format or limit through a measured task.

### Origin and script protection

Serve production only over HTTPS. Require exact-origin CSRF checks and a session-bound token on all mutations, including subscription registration, invite acceptance and logout. Do not enable wildcard credentialed CORS.

Start CSP in report-only mode, fix real violations, then enforce a tested policy with same-origin scripts, no plugins, restricted framing, approved connections and no unsafe evaluation. Existing inline style usage must be inventoried; do not break the preserved UI by blindly applying an incompatible policy. Style exceptions require a documented reason. Avoid inline script exceptions.

SAFE-01 now implements the [local browser policy](docs/LOCAL-SECURITY.md): after a three-engine report-only compatibility probe, the BFF enforces same-origin scripts/workers/connections, no inline scripts/evaluation, no framing or base replacement, and explicit form destinations. A documented style-only inline exception preserves React's existing layout/progress/motion attributes. Permissions Policy retains self-origin geolocation while disabling unused camera/microphone/display capture/payment/USB capabilities. Policy changes enter the PWA release fingerprint so the normal safe update flow refreshes cached response headers without clearing personal data. Old open/offline documents retain their old policy until the update is applied. HTTPS/HSTS and hosted proxy verification remain pending.

Set HSTS after HTTPS validation, `X-Content-Type-Options: nosniff`, a restrictive Referrer-Policy and Permissions-Policy allowing only needed capabilities, including self-origin geolocation. Prohibit untrusted framing through CSP. Production source maps must not expose embedded secrets or private build paths.

Browser storage is readable by same-origin script and is not a vault. Do not put session identifiers or credentials in localStorage/IndexedDB. Offline private records remain sensitive even with browser storage isolation. [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

### Worker/cache isolation

One known service worker scope owns PWA caching and push. Cache public fingerprinted assets/app shell only; private responses use `Cache-Control: no-store` and bypass Cache Storage. Account data is explicitly managed in an owner-scoped local repository.

Validate notification message schema, event IDs and allowed same-origin destinations. A notification click never executes arbitrary URLs or records a prayer/check-in automatically. Shared-group data is reauthorized after navigation.

WEB-02 implements release/digest-checked public caches and an explicit all-tab readiness protocol. Open forms, unverified startup/migration, pending/failed writes and active restore/clear prevent forced activation. A temporary non-persisted lease freezes writes while existing queues commit. After required durability completes, approval drains existing private API responses and holds new requests in each tab. The memory-only hold rejects new attempts through existing retry paths; it stores no credentials or bodies, replays no operations and releases on matching refusal/expiry. Authentication/authorization and private-cache rules are unchanged. Candidate cache failure cannot delete the previous shell; cleanup preserves unknown/live tab versions and never touches unrelated caches or IndexedDB. Notification clicks validate known nonexpired alerts and use a fixed same-origin destination. No service-worker timer is used as a background alarm. See [PWA lifecycle and deployment controls](docs/PWA.md).

Automated isolated-browser checks cover stale/failed/incompatible updates, startup locks, failed commands, offline clearing and private/auth/logout cache bypass. AUTH-01 also checks real local identity switching/logout while preserving guest data; SYNC-01 adds real local account-cache isolation/logout/recovery checks; PUSH-01 adds local subscription cleanup; scheduled-plan and physical-device acceptance remain PUSH-02–05 work. Physical mobile installation and HTTPS host/security-header checks remain release gates. These local controls do not complete SEC-03 as a whole.

## 7. Notification security — SEC-04

**Implemented locally in PUSH-01:** explicit browser permission and installation consent; owner/current-session RLS; separate AES-GCM endpoint/key storage; HttpOnly installation handle; version checks; fixed provider URL allowlist; connection-time public-address checks and pinned TLS; generic test payloads; bounded requests; offline cancellation status; logout/device/deletion cleanup. The isolated signer cannot enable/transfer consent or read private journey/session tokens. Account exports and personal sync exclude push capabilities. [Contracts, retention, grants and local evidence](docs/PUSH-SUBSCRIPTIONS.md). Local scheduling, full queue cancellation/deduplication and receive-time authorization are implemented in PUSH-02–04. Hosted and physical HTTPS acceptance remain open; SEC-04 is not closed by local mocks or cryptographic tests.

Require an account, per-installation consent and real browser permission for remote push. Do not import a subscription or its permission from a backup. Revocation/disable must cancel pending jobs and retire the endpoint.

Keep VAPID private keys in the worker's secret store. Encrypt stored subscription endpoints/key material; treat endpoints as sensitive capability URLs. Do not log them. A provider acceptance response proves neither display nor wake-up.

The worker receives only bounded event/cancellation/dispatch fields, not arbitrary private history. Its database role can lease and update eligible jobs but cannot browse personal notes or modify membership.

Validate push endpoints against a maintained list of supported provider hosts, HTTPS/443, no URL credentials and no redirects. Reject loopback, link-local, private/reserved ranges and metadata addresses, including IPv6/mapped forms. Check resolved destination addresses at connection time to prevent DNS rebinding; fail closed. This applies even though the URL arrived from a browser subscription. [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Enforce event/destination uniqueness, valid schedule generation, maximum horizon, reasonable per-kind frequency and expiry. Before dispatch recheck subscription, account and cancellation state. Limit retries to the live window; retire permanent failures.

Use generic lock-screen copy by default. Detailed prayer/habit names are an explicit installation preference. Never include pause reasons/ranges, work notes, coordinates, access tokens or invitation tokens. Encrypted Web Push payload transport does not make sensitive lock-screen copy private.

Offline cancellation cannot immediately reach the server, and already-submitted pushes may still arrive. Show pending cancellation and avoid absolute guarantees.

## 8. Retention, deletion and recovery — SEC-05

These are operating targets that must be reflected in the public privacy notice and actual provider configuration. OPS-02 now applies the local backup/maintenance rules described below; hosted policies and supervision remain pending.

| Data | Target retention/deletion |
| --- | --- |
| Active private account records | Until user deletes records/account; no silent expiry of personal history |
| Device drafts | Until saved/discarded or that profile is explicitly cleared; session-only account drafts cleared at logout |
| Precise device location | Until changed/cleared; never background location history |
| Legacy local migration backup | Retain through verified migration and export opportunity; explicit cleanup, no indefinite hidden duplicate |
| Local pre-import recovery point | One visible point until the next successful restore/rollback or explicit device clear; also subject to browser eviction |
| Pending notifications | Until send/cancel/expiry; purge expired payloads within 24 hours |
| Delivery metadata | Seven days, without content/endpoints in logs |
| Push plan/cancellation receipts | Seven days; immutable while retained, generation-bound retry afterward |
| Push cancellation retention marker | One owner ID/cleanup cutoff until account purge; no event content, needed to reject forgotten legacy retries |
| Invalid/revoked subscription | Disable immediately; purge endpoint/key data within seven days |
| Expired/used invitation hash | Seven days after expiry/use for abuse diagnosis, then purge |
| Operational logs | Seven days |
| Security/admin audit events | 30 days; restricted metadata, no private content |
| Sync receipts/ordinary tombstones | 90 days; older offline clients must rebase |
| Account private-data deletion | Block access immediately; primary-store purge within seven days |
| Encrypted recovery backups | Rolling maximum 30 days; expire naturally, never restore without deletion replay |
| Minimal account-deletion ledger | 35 days after verified primary purge, covering delayed purge plus rolling backups; identifier/original deletion time only |
| User-downloaded export | Controlled by user; RISE cannot revoke copies already downloaded |

The [local push retention implementation](docs/PUSH-RETENTION.md) uses forced owner/session RLS and a non-login, narrowly granted cleanup function owner. The sender can request bounded expired receipt deletion but cannot read receipt bodies, alter the marker directly or read personal/provider data. Floor advancement and deletion are one owner-locked transaction. Unverifiable legacy cancellations require an explicit current-plan choice; refresh never rebinds them. Operational supervision and restore reconciliation remain open before hosted acceptance.

On account deletion, remove private records, authored squad posts and reactions. Family tasks/lists needed by remaining members may remain as group-owned content with the former actor deidentified; explain this before confirmation. Remove personal references where unnecessary. If the account is the last group owner, require transfer or explicit group deletion first.

A removed member loses server access immediately. Clear cached shared data on the next successful revocation refresh; no promise of remote erasure while disconnected.

Backups are encrypted with access separated from application credentials. Perform an isolated restoration before release and periodically afterward. Keep push sending disabled during restore, replay deletions/revocations newer than the backup, verify permissions, then reopen access. RPO/RTO targets are specified in the PRD; provider backup availability alone is not evidence of recoverability.

OPS-02 implements [local encrypted server backups and isolated recovery](docs/SERVER-BACKUP-RECOVERY.md). Keys are separate protected files; authenticated archives expire after 30 days, and corrupt/wrong-installation/expired input fails closed. Restores have no network, runtime logins or delivery and cannot target an existing database. Every restored session/invitation/subscription is revoked. Current deletion and group authority must be available and unchanged across validation; changed shared groups are quarantined in the disposable copy. No public/private journey data or grants change in the source during backup/drill. The maintenance process retains owner-locked sync floors, uses the existing restricted push cleanup login and existing verified lifecycle purger. The administrative local backup/ordinary-retention connection is not a hosted least-privilege service. Same-host key separation, a synthetic drill and a manual watcher do not certify off-site disaster recovery or continuous production RPO/RTO. Cloud provisioning remains pending.


## 9. Infrastructure, secrets and dependency controls — SEC-06

- Separate development, test, staging and production origins, databases/Auth projects and keys.
- Secrets live in a managed secret store or protected local environment files, never `VITE_*` values, source, screenshots or client logs.
- Use different identities for migrations, BFF requests, push worker and lifecycle jobs.
- Restrict database/network access and connection pools; enforce timeouts and bounded query/batch sizes.
- Pin reviewed dependency versions and preserve the lockfile. FND-02 replaces direct `latest`/range declarations with exact versions, pins Node/npm and checks package/lockfile agreement. Future changes require a deliberate lockfile update and relevant verification.
- Use `npm ci` in CI, dependency/secret scans, reviewed third-party licenses and reproducible artifacts.
- Restrict deployment credentials, require named maintainers/MFA and record release IDs. Do not deploy from untrusted pull-request code with production secrets.
- Rotate suspected-compromised keys promptly; version encryption keys and rehearse rotation without losing decryptability.
- Do not adopt insecure ciphers or unsupported provider runtimes to preserve an obsolete device.

INFRA-01 implements separate local/test Postgres/Auth stacks, generated signing/runtime credentials, loopback binding enforcement, a private installation marker and non-login capability groups with three distinct restricted logins. RLS is enabled/forced on the two infrastructure tables, and anonymous/authenticated/service roles have no application-schema access. BFF startup checks identity/privileges before listening, requires verified remote TLS configuration and rejects administrator/worker/lifecycle credentials. Both browser builds reject backend/private imports and unapproved `VITE_*` variables. Real database/Auth integration tests cover unauthorized access, crossed JWT/admin credentials, mismatch refusal and scoped password rotation. See [controls and custody](docs/BACKEND-ENVIRONMENTS.md#secrets-and-build-isolation).

These local stacks use the pinned CLI's development administrator password and must stay on trusted loopback-only machines. They are not public hosting. Hosted SEC-06 acceptance remains open: cloud provisioning is pending by user direction; Hetzner plan/access, hosted secrets/network/TLS, key custody/rotation and deployment/rollback evidence are unverified. No account/session or owner/member business authorization is claimed by these infrastructure checks.

Rate-limit code request/verification, invitation creation/acceptance, import/export and push registration. Starting proposals: one code request per minute and five per hour per address; five verification attempts per challenge; ten invites per owner per hour. Also apply IP/device-wide abuse controls, with user-readable retry behavior. These are tunable abuse controls, not commercial limits.

No automatic public file upload is included in v1. Introducing attachments, remote images or rich content requires a fresh threat-model update.

## 10. Monitoring and incident response — SEC-07

OPS-01 now implements the [local operations boundary](docs/LOCAL-OPERATIONS.md): allowlisted coarse request metrics with release IDs, an aggregate-only restricted DB capability, bounded private alert transitions and explicit user-controlled technical reports. No profile/error payload, analytics identifier or session replay is collected. The runtime monitor is local/test only; no public metrics endpoint or third-party collector exists. Incident primary/backup owners and a dedicated support/security contact remain unassigned; tested local file routing is not human paging or hosted acceptance. Cloud provisioning remains pending.

Log request/operation IDs, status/error codes, latency, actor identifier where necessary and security-relevant administrative actions. Redact emails when full values are unnecessary. Never log bodies, session cookies, bearer tokens, coordinates, private content, pause ranges or push endpoints.

Before public access, name an incident owner and a backup, configure tested alerts and publish a private security contact. Response goals must match actual staffing; this document does not promise staffed 24/7 response.

| Severity | Examples | Initial action |
| --- | --- | --- |
| Critical | Cross-account exposure, privileged-key compromise, destructive corruption | Stop affected access/dispatch, page owner immediately, preserve restricted evidence |
| High | Membership bypass, recoverable data loss, systematic notification disclosure | Contain feature, revoke affected credentials, investigate promptly |
| Medium | Limited availability, blocked sync, exploitable low-impact input path | Triage and schedule correction with workaround |
| Low | Hardening/documentation gap without current exploit | Track with owner and review date |

Incident sequence:

1. Identify scope and incident owner; record UTC times and a release ID.
2. Contain using scoped access/feature controls, not mass deletion.
3. Preserve minimal forensic evidence with restricted access.
4. Revoke/rotate compromised credentials and repair the defect.
5. Restore through the tested path, replay deletions and verify access controls.
6. Communicate known facts, impact and remediation through the established support channel.
7. Determine applicable notification duties with qualified advice for the actual markets.
8. Record root cause, corrective tests and follow-up tasks.

Do not disclose private data in status updates or promise that an incident affected nobody before evidence supports it.

## 11. Vulnerability reporting

A dedicated public reporting address and repository reporting channel have **not yet been established**. Establish and test them in SEC-07's implementation task before launch. Until then, report privately to the project owner through the existing private project channel, not a public issue.

A useful report contains the affected release/origin, minimal reproduction, expected versus observed result and a redacted impact description. Never request live account passwords, private profile exports, session tokens or unnecessary records.

Published response expectations and any safe-harbor policy must be approved by the operator before being advertised.

## 12. Verification and release checklist

Security gates are incomplete until implemented and evidenced.

SAFE-01's 24 October 2026 [integrated local review](docs/evidence/security-2026-10-24/README.md) verifies the retained local/test SEC-01–06 boundaries and closes the missing browser-policy and policy-only PWA update gaps. Its scope, exact release, initial test failures, corrections and remaining limits are recorded there. SAFE-01 is REVIEW: these release checkboxes remain open for hosted/device/operational evidence, including PUSH-05 and OPS-01–04. Cloud provisioning remains pending.

- [ ] SEC-01: Account/group policies and direct-request negative tests cover every entity and sensitive action.
- [ ] SEC-02: Session, CSRF, revocation, recent-auth and account-switch tests pass.
- [ ] SEC-03: Input/import/XSS, production headers and worker/cache isolation checks pass.
- [ ] SEC-04: Push endpoint validation, secret handling, consent/cancellation and device privacy tests pass.
- [ ] SEC-05: Export/restore/deletion and backup-resurrection prevention pass.
- [ ] SEC-06: Least privilege, environment separation, secret/dependency scans and key-rotation procedure are verified.
- [ ] SEC-07: Contacts, ownership, alert routing and incident/restore rehearsal are operational.
- [ ] No known exploitable critical/high issue remains open.
- [ ] Privacy statements match implemented collection, sharing and retention.
- [ ] Launch markets, legal basis, processor arrangements and rights requests have been reviewed for the real deployment.

Automated tests, a clean package audit and a security document are different kinds of evidence. None alone establishes production security or legal compliance.

## 13. Maintenance

Update this document when introducing a new data category, provider, permission, public surface, sharing field or privileged module. Link each change to a PRD requirement, task and test. Review policies after incidents and before major releases.


### SYNC-02 local recovery boundary

Compact changes and removal barriers are owner/current-session protected by forced RLS, with no ordinary provider/worker/lifecycle grants. Same-record corrections require current semantic conditions; ordinary tombstones/archives take precedence over stale intent. Full-snapshot recovery never overrides session revocation or missing authorization. Original cache state/operations stay in a local recovery point; no credentials enter it. It can retain earlier private notes, prayer/pause history and original device location setup, and remains sensitive. Session-only recovery stays in memory. Active/inactive unresolved recovery gates logout using the existing version-bound discard rule. See [protocol, retention and rollback limits](docs/SYNC-RECOVERY.md).

The 90-day ordinary receipt/change policy is implemented opportunistically for active owners. Inactive metadata may remain longer until maintenance; scheduled purge guarantees and account-deletion suppression/backup replay are still separate operational work. Current private account history does not expire through sync cleanup.

## DATA-04 local security implementation — 22 October 2026

The [account lifecycle guide](docs/ACCOUNT-LIFECYCLE.md) supersedes earlier statements that account export/deletion is wholly pending. Recent authentication is checked against database time within ten minutes. Reauthentication binds challenge purpose, original opaque session and subject, disallows implicit user creation and rotates session/context identifiers. Client time and submitted owner IDs never establish identity or freshness.

Deletion inserts durable suppression before any primary purge. The fixed active-session predicate denies every old session/JWT, and new BFF sessions for that subject are rejected. Owner/session locks, a final ordinary-command authorization check and reviewed revisions protect concurrent writes. Opaque-cookie terminal receipts make lost replies recoverable without account-ID enumeration.

The BFF retains its restricted role and publishable key. A separate loopback-only lifecycle process holds its own restricted job/ledger connection and protected provider admin secret; it cannot read journeys or token ciphertext. The provider performs hard Auth deletion, and the worker verifies absence before completion. Missing personal-root cascade links are now explicit foreign keys; populated purge tests check every owner-bearing application table. Failed purges retain suppression and bounded retry metadata.

The ledger’s 35-day clock begins after confirmed primary purge. Starting it at request time could expire protection while a delayed purge still exists in a retained backup. Pending jobs never age out suppression. Authoritative replay is installation/environment-bound, validated before mutation and required before restored access. Hosted backup expiry, provider security-audit retention and supervised operational deadlines are still OPS-02 gates; local development fixtures do not certify them.

Known-field account exports exclude credentials, operational staging/receipts and other owners. Full historical files preserve retired/inactive rows; guest restore explicitly uses only the current personal projection and never reinstates access. Device cleanup uses strict owner transactions/generation markers, leaves the guest and other owners intact, and exposes failures instead of claiming erasure. Foreground alerts/callbacks are owner-scoped; server subscription/plan/job cleanup is integrated locally; group ownership resolution and membership identity scrubbing are now integrated locally. Family task/list history now survives through deidentified member references and cascades on group deletion; GROUP-03 now erases authored squad posts, reactions and previews before suppression, including former memberships. GROUP-04 now erases recipient and source-author notification jobs before suppression and during terminal replay; a missing installed cleanup hook remains a fail-closed gate. Offline caches cannot be remotely erased while disconnected.

The earlier PUSH-02 staging, PUSH-03 cancellation and PUSH-04 renewal/habit increments are integrated by the [current local sender](docs/LIVE-PUSH-SENDER.md). Their dated evidence remains in `docs/evidence/`; it does not certify hosted supervision, load acceptance or physical-device delivery.

## Local group membership security — 23 October 2026

GROUP-01 implements current-member projection, owner administration, hashed seven-day single-use invitations and recent-auth atomic ownership transfer through private fixed database operations. Forced RLS protects all five group tables. `rise_group_guard` cannot log in, bypass RLS, read private journeys or provider-token ciphertext; runtime roles cannot assume it. The BFF has no direct group/member/preference/invitation write grants. Invalid invitation attempts retain their rate charge, receipts contain only fingerprints/minimal outcomes and retries cannot silently recreate expired intent. [Exact grants, limits and recovery](docs/GROUP-MEMBERSHIP.md).

GROUP-02's local task/list backend adds four forced-RLS shared tables and operator-only limits. Only current members can read or issue validated collaborative commands. The fixed private mutation function checks the locked group revision, current membership and group/parent status; actor and completion time come from the verified session/database. Composite group references prevent cross-group assignment and parent substitution. Dated task snapshots survive plan edits, item removal barriers prevent stale resurrection, and the content/revision/receipt transaction rolls back together. Reads are bounded, no-store and pinned to a coherent group revision. Personal records, provider credentials and habit XP are outside this capability. [Shared-content security and rollout boundaries](docs/SHARED-CONTENT.md).

The later priority extension stores only group/task UUIDs and an occurrence date in owner/session-protected personal rows. Shared title, note, assignment and completion data never enter that projection. New references require the narrow BFF-only authorization function inside the private transaction, with sorted group locks after the actor lock; runtime roles still cannot assume the guard, and the guard cannot read private selections. Existing unavailable selections remain reorderable/removable without a shared-parent cascade. Personal receipt acknowledgment grants no renewed group access. Guest import excludes all task references, while compatible private exports preserve opaque selections without restoring membership. The browser reader keeps shared pages in memory, validates owner/group/parent/date/revision and clears inaccessible data; account changes fence old replies and eligibility callbacks. Real task/list and priority controls consume that fenced reader. Own draft text and immutable non-secret pending commands stay in the selected account cache or session-only memory; portable personal exports exclude those drafts. No shared text is added to personal account rows. Delayed or failed dated reads cannot present a fresh unchecked completion action, and removed access hides shared bodies while keeping explicit recovery available.

Account deletion locks membership/ownership resolution before suppression. A restrictive ledger policy independently rejects unresolved groups. The isolated terminal lifecycle hook requires retained suppression and commits group cleanup before calling managed Auth; it handles restored pre-transfer ownership without reviving the deleted identity. Auth-root cascades and a member-identity scrub preserve deidentified references. The family task/list backend now retains group-owned history through stable member references and cascades it on group deletion. GROUP-03 now erases authored squad posts/reactions/previews before suppression and in terminal backup replay; GROUP-04 now integrates recipient/source-author job erasure and retains a fail-closed check for its installed cleanup hook. The [snapshot boundary](docs/SQUAD-SNAPSHOTS.md) restricts previews to their owner, publication to the stored reviewed payload and reads to current members. The local membership browser removes invitation fragments before navigation, requires explicit nickname/join consent and keeps group views/secrets in memory. Pending non-secret commands use the selected account’s existing cache and version checks; join recovery stores only owner/operation/group IDs. Logout, session-only departure, account clearing and deleted-owner markers include this intent. Account changes fence late responses and dismiss private forms. The receipt endpoint rechecks membership and never returns a token. GROUP-05 now verifies integrated local export/cache/deletion/server-backup replay; [the evidence](docs/evidence/group-lifecycle-2026-10-24/README.md) does not close hosted operations or physical-device gates. The [invitation paging boundary](docs/GROUP-INVITATIONS.md) now restricts responses to 20 owner-only metadata rows, pins continuation to the current group revision and caps retained history. The equivalent owner-set RLS policy retains active-session/member checks without repeating them for every row. Local maximum-quota and stopped-worker invitation acceptance passes. [Optional group notices](docs/GROUP-NOTIFICATIONS.md) add default-off group consent, independent device consent, mandatory quiet hours and bounded frequency/retention. A restricted sender sees no shared text or source-author identity. Dispatch and receiving authorization check current membership/source and the retained suppression ledger for both recipient and author, so restored rows cannot revive deleted-author delivery. Both job creation and cancellation share the accepted command transaction; provider acceptance is preserved separately from presentation permission.

## Shared archive boundary — GROUP-05

The local/test shared export route requires verified current membership, exact Origin/CSRF, recent authentication and the reviewed group revision. Each bounded page and the final check use existing RLS on the ordinary restricted connection. Changed access or content rejects the complete result. Only known shared fields enter the file; private journeys, Auth IDs, invitation secrets, unpublished/withdrawn/removed content, credentials, push details and consent remain excluded. Former member references stay opaque and cannot recover deleted names.

The sensitive download is explicitly reviewed, kept in memory until download and never placed in browser caches, drafts or server export storage. File checks reject invalid references, malformed history, unknown fields, bad checksums and oversized content without partial output. A previously authorized downloaded copy cannot be recalled. Private restore rejects this format before mutation; neither shared files nor stale account caches grant membership. Retained deletion suppression remains authoritative after server-backup replay. See [the contract and recovery limits](docs/GROUP-LIFECYCLE.md).

OPS-03 adds a [local release boundary](docs/LOCAL-ROLLOUT.md): private content-addressed packages include dependency hashes, reject escaping links/review shells/missing public assets and never include environment files or saved profiles. Protected BFF configuration travels over child stdin, preserving installation/session keys and excluding administrative/sender credentials. Only fixed local/test installations are supported. Exact schema/storage/API compatibility and candidate health are prerequisites; write pause is server-enforced and grants no authorization. Trusted local filesystem ownership remains necessary; these checks are not artifact signatures or hosted deployment acceptance. Cloud provisioning remains pending.

## Local policy and support disclosure — OPS-04

[The launch-policy inventory](docs/LAUNCH-POLICIES.md) maps the current guest/account/shared/push/diagnostic boundaries and their different retention clocks. Localized Settings notices disclose the absence of end-to-end encryption, stopped-maintenance limits, downloaded-copy limits and unassigned public contacts. Support downloads remain explicit and redacted; no support messages, acceptance records or age fields are collected. Browser dependency notices preserve original attribution; this does not approve app/artwork/container distribution. The confirmed Uzbekistan/Kazakhstan markets still require actual-operator, legal-basis, special-data, residency/transfer and provider review before public access. Cloud provisioning remains pending.
