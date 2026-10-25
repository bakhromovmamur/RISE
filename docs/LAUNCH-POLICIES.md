# Launch policies, rights and local help

**OPS-04 · PRD-18–20 · 25 October 2026 · local implementation; public launch review pending.** Cloud provisioning remains pending. This record is not an approved public privacy policy or service agreement and does not establish a legal entity, jurisdiction, recipient address or processing agreement.

## Available in this edition

Settings → **Help & policies** supplies English, Russian and Uzbek Latin guidance in the existing disclosure composition. Its source of truth is [the localized notice](../src/help/text.ts), rendered by [Help](../src/help/Help.tsx). It is available without signing in and, after the public shell is ready, after an offline cold start. It shows the actual public release fingerprint, or an explicit unavailable label in a build without that metadata. Reading a notice is not consent, terms acceptance or an account command. No acceptance timestamp, age/date-of-birth field, new persistence format or external request was introduced.

The sections explain:

- **Privacy:** sensitive personal/prayer/pause/free-text categories; guest versus account storage; explicit selected import; remembered versus session-only accounts; device-only coordinates/calculation settings/drafts; account sessions; optional push services; exact shared snapshots and the limits of recalling downloaded copies; no end-to-end encryption claim.
- **Export, deletion and retention:** local backup/restore/clear versus account export/device cleanup/permanent deletion; separate authorized shared archives; immediate suppression versus queued primary purge; backup and ledger timing; independently retained downloaded copies.
- **Local use terms:** intended adult audience, ordinary respectful/authorized use, no emergency/alarm/religious-authority promise, no payment or service contract created by reading, no invented app/artwork license or transfer of user content rights. This is guidance for local evaluation, not approved public launch terms. Age verification is not implemented.
- **Install, offline and reminders:** existing installation/storage controls, explicit device permission and denial recovery, iPhone Home Screen requirement, pending edits and safe retry/recovery, explicit timezone review and a separate reliable Fajr alarm.
- **Support and security:** the existing private project conversation with the installation maintainer is the interim route. Public contact and staffed response times are unassigned. Users can generate the existing redacted diagnostic file here, inspect it and decide whether to share it. No message is sent. Never request codes/cookies/invitations/push secrets/private profile exports as an initial report, or suggest clearing data as a generic repair.
- **Credits:** original artwork provenance, system fonts, browser dependency attribution and original license texts. These texts are deliberately preserved in their source language.

The account deletion explanation also now qualifies the seven-day primary-purge **target**: the local cleanup service must be running. It no longer asserts an unconditional seven-day result. No deletion behavior changed.

## Current processing and retention inventory

| Category and purpose | Current boundary | Retention/control |
| --- | --- | --- |
| Guest journey, dated location/calculation data, drafts and recovery source | Device browser databases/local legacy source; no automatic account upload | Explicit clear/restore/rollback APIs; browser eviction is possible; exported copies are user-managed |
| Saved account journey and history for sync | Configured local/test BFF and Postgres, verified owner/session; no hosted installation | Current records/history retained; account deletion queues primary purge; ordinary edit/removal can leave command/history/recovery copies |
| Account session and email verification | Local Auth and private server metadata; local email testing uses Mailpit | Expiry/revocation and bounded maintenance; no claim that all metadata has one common retention clock |
| Remembered account cache/outbox/drafts | Separate owner-scoped device database | Explicit account cleanup/logout/deletion handling; pending work needs review/export; session-only private journey is memory-only |
| Shared names/tasks/lists/snapshots | Current-member authorized local group API; server pages memory-only in browser | Archive retains history; author withdrawal/group deletion/account lifecycle enforce their documented erasure rules; downloaded copies cannot be recalled |
| Push subscription and generic delivery | Explicit installation consent; isolated sender; browser push provider only when real sending is explicitly configured/used | Revocation and account lifecycle; seven-day receipts; job payload cleanup after expiry; no physical-delivery certification |
| Personal sync and group operation receipts | Private replay/conflict protection | 90-day bounded maintenance, owner floors; current history is not a 90-day rolling deletion policy |
| Encrypted server backups | Protected local files, separate recovery key | Expire 30 days after capture when authenticated maintenance runs; stopped/failed maintenance does not prove erasure; external copies need separate custody/expiry |
| Deletion suppression | Minimal authoritative private ledger | 35 days **after confirmed primary purge**; replay before restored access; no removal to bypass a failed purge |
| Operations | Five-minute coarse in-memory counters, private latest snapshot, allowlisted request diagnostics and bounded private alert journal | Alert journal at most 200 events/seven days while monitor runs; console/request-log custody still needs an operator retention policy |
| User-chosen downloads | Private backups, shared archive or redacted diagnostic file | User/recipient-managed; no automatic upload or recall |

Exact exceptions and procedures are in [account lifecycle](ACCOUNT-LIFECYCLE.md), [backup recovery](SERVER-BACKUP-RECOVERY.md), [sync recovery](SYNC-RECOVERY.md), [group lifecycle](GROUP-LIFECYCLE.md), [push retention](PUSH-RETENTION.md) and [local operations](LOCAL-OPERATIONS.md). The local edition has no advertising SDK, product analytics or session replay. Optional future product measurement requires its own consent and review.

## Launch decisions and external gates

| Item | Verified current decision | Still required before public access |
| --- | --- | --- |
| Markets | **Uzbekistan and Kazakhstan**, already confirmed by the user in [FND-03](INFRASTRUCTURE-DECISIONS.md) | Qualified review of the actual data categories, lawful basis/consent, special-data handling, rights routes, language and residency/transfer obligations in both markets |
| Operator/controller and audience | PRD intends adult Muslims; no legal operating entity or age-verification system is recorded | Named responsible entity/contact and confirmation of adult launch scope; do not invent a company from a domain/account name |
| Hosting/database/email/backup/push | Existing Hetzner account, future Supabase organization selected; local software/services tested; intended `habit.saraftech.com` is not configured | Region/plan, provider ownership, processor arrangements/subprocessors, email sender, transfer safeguards, retention/custody, budget and actual hosted evidence; Frankfurt remains a proposal |
| Support/security | Existing private project conversation only | Dedicated private address, primary/backup humans, response window and tested human escalation; no 24/7 claim |
| Public policies | Local privacy/use notices and operating inventory exist | Approved deployment-specific privacy policy and terms, effective date, rights/contact procedures and publication/access evidence |
| Rights | Browser notices and inventory below; original assets unchanged | App license/distribution authorization, artwork generation-account/usage rights, full server/tool/native/container distribution review and approval |

Current primary legal sources checked on 25 October 2026:

- [Uzbekistan Law on Personal Data, current official Uzbek text](https://lex.uz/docs/4396419): articles 20, 25 and 27¹ are relevant to registration, special categories and storage/processing conditions. The current 27¹ reflects the March 2026 amendment and distinguishes categories and conditions; the older blanket-localization summary must not be used as the current rule. The page also lists later 2026 revisions. This is a review flag, not a determination that the proposed region is permitted.
- [Kazakhstan Law on Personal Data and Their Protection, official Adilet text](https://old.adilet.zan.kz/eng/docs/Z1300000094): article 12 addresses in-country storage; the indexed official text records a June 2026 amendment. Direct page fetch timed out during this review, so the current official indexed excerpt was used only to identify a required residency review, not to approve a deployment.

No compliance certification, legal-basis determination or authorization to provision follows from these checks. Reconfirm current local-language law and its application with qualified review before choosing a region or opening public accounts.

## Rights and attribution audit

[The dependency inventory](evidence/launch-policies-2026-10-25/dependencies.json) records the unchanged lockfile hash, **315** pinned package entries and a conservative **12-package** closure of literal external source imports. This is a source/dependency inventory, not a claim that every package enters the browser bundle. Platform-optional packages and server/build tools are separate from the browser notice set.

The browser notice set is React, React DOM, scheduler, Lucide React, Adhan, tz-lookup, Capacitor core/app/geolocation/local-notifications/synapse and tslib. Installed license files and their copyright notices are preserved verbatim in [the packaged notice file](../src/help/third-party-notices.txt); tslib's separate copyright notice is included. Lucide's notice also credits its Feather portions. Declared licenses in this set are MIT, ISC, CC0-1.0 and 0BSD. The checker verifies installed versions against the lock and rejects missing or changed notice text; it is not a legal compatibility scanner and does not discover computed imports or separately distributed native/container resources.

The broader lock inventory includes **MPL-2.0** for web-push and Lightning CSS/platform packages. A blanket “all MIT” assertion would be false. Review their source/distribution obligations for the actual released server/tool artifact, along with Apache/BSD and other notices; keep original package licenses/source with sealed packages. Do not infer that package.json's `private: true` is an application license. There is no root application license grant; the local Karpathy skill's MIT license applies only to that skill.

[Pip provenance](../public/assets/pip.prompt.txt) and [trail provenance](../public/assets/trail.prompt.txt) identify original image-generation prompts. PNGs and sidecars are unchanged. Those sidecars establish provenance, not proof of the generating account's contract or final rights clearance. PWA icons derive from the existing sprout; no new artwork or downloaded font is introduced. Rights confirmation remains open.

```sh
npm run check:notices
# After an intentional, reviewed dependency update only:
node scripts/check-notices.mjs --write
# Refresh the auditable package inventory:
node scripts/check-notices.mjs --inventory docs/evidence/launch-policies-2026-10-25/dependencies.json
```

`npm run check` and browser CI now include notice verification. A mismatch requires reviewing the affected package before regenerating; it must not be suppressed to pass a build.

## Verification and rollback

See [dated acceptance evidence](evidence/launch-policies-2026-10-25/README.md). The only product changes are a read-only Settings disclosure, two scoped wrapping rules and the localized deletion explanation. No backend/migration/domain/cache/worker/permission interface changes. Reverting these presentation/notice files is data-compatible; existing OPS-03 rollback still requires exact compatible schema/storage/API contracts. Open offline documents retain their previous help until the normal safe PWA update is applied. Do not clear storage or regenerate old recovery data to force an update.
