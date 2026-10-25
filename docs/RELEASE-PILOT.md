# Controlled pilot and complete-day acceptance — RELEASE-01

This protocol covers PRD journeys A–J, PRD-01–20 and their release gates. The authorized work is local verification. Cloud provisioning remains pending. A synthetic automated rehearsal is not a consented human pilot, an elapsed day of use, a physical-device test or a release decision.

The [25 October local evidence](evidence/release-rehearsal-2026-10-25/README.md) records the tested version, results, failures and remaining gates. The [activation follow-up](evidence/worker-activation-2026-10-25/README.md) records the request-draining correction and closes the specific Chromium handoff blocker locally. The [sign-in and queue follow-up](evidence/signin-queue-2026-10-25/README.md) verifies identity-ordering, quota-lock, template-mount and sender-isolation corrections, with all remaining local browser suites passing. Its diagnostic record retains the historical provider transaction timeout and distinguishes observed causes from unproven links; hosted readiness remains pending. RELEASE-02 remains a separate decision. The existing [performance evidence](evidence/performance-2026-10-24/README.md) still reports unmet QUALITY-03 latency/capacity targets; functional regression results cannot close them.

## Pilot admission and privacy

Before recruiting or starting a real pilot, record the responsible product/QA person, incident primary and backup, private support route, approved participant information and the exact release/origin. These are currently unassigned or pending in [launch policies](LAUNCH-POLICIES.md) and [local operations](LOCAL-OPERATIONS.md). Do not contact people, publish, provision services or enable live notifications through this protocol alone.

Use consenting adults and at least two distinct people for the family/squad journey. Explain the current local/hosted boundary, voluntary participation, ability to stop or skip sensitive steps, separate sharing/device permissions and best-effort alerts. Use synthetic habits, prayer reports, notes and groups. Do not ask for actual religious practice, pause reasons, coordinates or private exports. A tester may decline a step; record not-run rather than pass. Participants should perform their own explicit join, sharing and permission actions.

Keep identities and consent records separately in restricted operator-controlled storage. The repository may contain only pseudonymous participant IDs, a consent-record reference and redacted observations. No codes, cookies, invitation fragments, endpoints, addresses, private profiles or raw network recordings. Use disposable test profiles; never clear an existing personal browser origin. Never test deletion on a real account. Choose and communicate feedback retention/access before collecting it; no feedback collection or retention period is implied by this document.

## Complete-day observation script

Record actual timestamps, civil date and IANA timezone. A compressed clock-based rehearsal must be labeled accelerated and cannot establish day-one or week-one retention. Observe one actual day and the next-day return for the real pilot, without treating prayer frequency as a success metric. Participants may use fictional records throughout.

| Journey | Actions and observable acceptance | Failure/recovery observation |
| --- | --- | --- |
| A — Personal first day | Empty profile; choose a habit; tiny gives 10 XP; upgrade totals 20; reload; explicit Undo reconciles the occurrence | Double activation does not duplicate XP; offline/storage denial does not show false saved success |
| B — Existing profile | Use a synthetic legacy profile; export the original; review migration; reload; separately choose account import | Mixed/corrupt/future data remains recoverable; interrupted migration preserves source; login alone uploads nothing |
| C — Prayer day | Explicit location/method or authored manual date; inspect timetable; prepare; explicitly record; inspect history | Travel, DST and unavailable polar dates; prior checked snapshots remain; no substituted sample dates |
| D — Fajr | Save the dated plan; review actual readiness; explicitly choose installation consent; observe a real scheduled alert and acknowledgment | Denied/revoked permission, expired/offline coverage, delayed alert and backup race; acknowledgment records no prayer/XP; provider acceptance is distinct from display |
| E — Difficult day | Leave a prayer unconfirmed; choose an honest correction; take a tiny action; resume next day | Expired break retains draft; private pause/resume preserves earlier records and gaps; time alone creates no missed record; earned rewards remain |
| F — Two devices | Same account in two separately scoped devices; edit offline; reconnect; observe receipt and convergence | Lost acknowledgment retries the original operation; conflicting edits require review; deleted data and expired sessions cannot silently return |
| G — Family | Two people create/explicitly accept an invite; assign task; check; Undo; inspect both views | Competing edit, revocation, ownership transfer and cross-group IDs; no habit XP; removed member cannot commit queued work |
| H — Squad | Sharing initially off; explicitly choose fields; review exact preview; publish; inspect from second member; withdraw | Private-field injection and stale membership fail; later private activity does not change the published payload; authored text is reviewed |
| I — Data lifecycle | Synthetic export; validate/preview restore; reload; account switch/logout; recent-auth synthetic deletion | Malformed restore changes nothing; rollback retains source; stale cache/backup cannot resurrect deletion or membership |
| J — Accessibility | Complete four tabs and long forms in English, Russian and Uzbek Latin, with large text and assistive technology | Focus restoration, reduced motion, keyboard/safe areas, errors and denied permissions remain usable; use the physical matrix below |

For each journey retain pass/fail/not-run, observer and participant pseudonyms, actual release/OS/browser/device, exact steps, expected/observed outcome, assistance required, redacted evidence and linked defect. Distinguish independent participant success from observer-assisted completion. Record actual wording only with consent and after removing private content. Never fill missing feedback with inferred satisfaction.

Use [mobile and accessibility acceptance](MOBILE-ACCESSIBILITY.md) for physical VoiceOver/TalkBack and supported current/previous iOS Safari/Android Chrome, including Home Screen mode. Use [push subscriptions](PUSH-SUBSCRIPTIONS.md) and [live sender](LIVE-PUSH-SENDER.md) for the real HTTPS/device boundary. Desktop Playwright engines and synthetic provider adapters do not satisfy those rows.

## Local reproducible rehearsal

Use the pinned runtime and existing fixed test installation; keep private configuration under `.rise-infra/`. Finish `npm run check` before browser suites. Run the following sequentially, retaining exact commands, exit codes, counts and build identity:

~~~sh
npm run check
npm run test:browser
npm run test:production -- --workers=1
npm run test:pwa
npm run test:visual
npm run test:infra
npm run test:backend
npm run test:auth
npm run test:sync
npm run test:push
npm run test:groups
npm run test:rollout
npm run check:docs
~~~

The review complete-day/difficult-day scenes are synthetic domain/UI rehearsals on 4180. Production entry and day-boundary checks use 4181; PWA uses that port separately. Visual checks use 4182 with existing references. Database/BFF/rollout suites use the fixed test installation and isolated 4191, synthetic verified accounts and local mail capture; credential traces/video/screenshots stay disabled. These are real local authorization and persistence adapters but not real human participants. Never run fixtures on 4173, 4190 or 4192. Do not regenerate visual references for acceptance.

The database suite includes encrypted disposable backup recovery and revocation/suppression replay. The rollout suite exercises compatible package replacement, pause, failed-candidate recovery and rollback with retained pending actions. See [backup recovery](SERVER-BACKUP-RECOVERY.md) and [rollout](LOCAL-ROLLOUT.md). Do not downgrade schemas, delete profiles or reset worker storage to force success. These checks do not start hosted services or establish a full-service recovery SLO.

## Defects, stop conditions and acceptance

Stop the affected real pilot path for exposure, unexplained data loss, unauthorized membership, false save/delivery success or unrecoverable intent. Preserve minimal restricted evidence, use the existing operational containment/rollback procedure and verify the same failure after a focused correction. Record timing-sensitive failures and reruns; do not quietly retry until green or relax security/assertions.

Carry existing QUALITY-03 performance failures as open blockers. No new capacity claim follows from this rehearsal. Other pending gates include physical accessibility/push, hosted security/operations/recovery, named operating contacts, policy/provider/rights approval and actual consented feedback. Keep cloud provisioning pending.

Local completion may be recorded as REVIEW with these limits. RELEASE-01 cannot become DONE until consented journeys A–J (including two real group members), observed feedback and resolved blocking defects have evidence. RELEASE-02 must still assess every PRD/NFR requirement or an explicit product-owner-approved scope revision. No approval is inferred from silence or an automated pass.

## Current human observation register

| Item | Recorded result |
| --- | --- |
| Consented participants / two-person group pilot | Not started; no participants recruited |
| Actual complete day / next-day return | Not observed |
| Participant feedback | None collected |
| Week-one return / retention | Not measured |
| Physical device / assistive technology / real push | Pending |
| Public/hosted release decision | Pending; cloud provisioning pending |

Create a dated restricted run record only when observations occur. Its fields are: run ID, release/origin, observer, consent references, participant pseudonyms, device matrix, journey outcomes, timestamps/timezone, redacted feedback, defects/fixes/retest evidence and explicit decision. Keep this unfilled register separate from automated test results.
