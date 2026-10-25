# Local renewal and readiness — PUSH-04

**Current integration:** [live local sender and receive-time authorization](LIVE-PUSH-SENDER.md) now connect the existing consented queue to the encrypted transport. Cloud provisioning and physical-device acceptance remain pending. Earlier increment evidence retains its original scope.

23 October 2026. This increment connects the staged prayer/Fajr plan backend to the existing mobile web readiness sheet. It addresses the renewal/readiness portion of PRD-11 and PRD-19. Cloud provisioning remains pending. Habit delivery and live transport are now integrated locally; physical-device acceptance remains unfinished.

## Consent and scheduling ownership

Background subscription and scheduling-device choice are separate actions. Signing in, viewing an account, subscribing, opening readiness or importing a guest profile does not select a primary scheduling device. After explicitly opening an initialized account journey, the user can choose this installation to replace and renew the account plan. Other installations cannot take over automatically.

The existing prayer/Fajr and habit preferences remain the source of eligibility. See [the habit increment](HABIT-REMINDERS.md) for mandatory habit quiet hours and foreground consent. Explicit background-plan consent enables only the pure background projection; it neither requires nor changes the saved foreground/native delivery switch. The new quiet-hours override is a separate explicit choice, defaulting off for the first plan. This installation's own saved choice is shown on reopening the sheet; another installation's override is not inherited. Editing the switch alone does not upload a plan. Replacement submits the displayed choice. Guest data, authored text and coordinates are never uploaded by the renewal module. It submits only the existing bounded opaque event/time contract.

## Renewal boundary

`PlanRenewal` owns renewal, request replay and readiness projection behind an injected clock/storage/network interface. The web-only provider observes account changes, foreground focus, reconnection and a one-minute page timer. It does not run a service-worker timer or request notification permission.

Renewal requires the selected account, durable local save, current verified identity, an empty sync outbox/recovery queue and a synced journey. Pending local cancellation work blocks submission. The coordinator first flushes durable cancellation intent, then verifies current subscription/version and server plan metadata. Clock disagreement over two minutes requires correction rather than uploading a shifted timetable.

The chosen device renews after relevant state or subscription changes and at the earlier of a twelve-hour deadline or one minute before actual receiving coverage ends (with a minimum one-minute interval) while open/online. Each generated plan retains the seven-day bound and up to 84 events. Events within thirty seconds are omitted from a newly submitted plan to avoid claiming an event that can expire in transit; coverage remains the actual last queued event, never an assumed seven days. Quiet-hour filtering is enforced by the existing server staging boundary.

Before submission, `rise-push-device` v1 durably stores the immutable request ID/body and a hash of the local scheduling inputs. Lost responses replay that exact request, including after reload. Obsolete intents get a new ID; a definite revision/generation conflict disables automatic renewal until explicit review/replacement. Another primary installation stops this installation's automatic replacement. Ordinary failures retain pending intent with a bounded retry delay. No credential, coordinate or private source text is stored in this metadata.

Refresh requests arriving during an active request are coalesced for a follow-up check of the current source; no stale explicit takeover choice is retained. Every completion checks the current source, owner and control revision. A late response cannot undo disable, account switching, newer cancellation or another tab's consent change. Account cleanup/disable removes renewal metadata; guest and account journey cache formats are unchanged. The workspace exposes a ready source only after in-flight cancellation metadata work has settled.

## Truthful readiness

The protected plan read uses the verified actor and HttpOnly installation handle. Under the existing owner lock it reads the current plan and the receiving installation's current-version jobs. It reports server time, current generation, actual next/last queued times, live unexpired event keys and terminal failure count. A newly subscribed installation has no backfilled coverage until a new generation includes it. Public roles and unrelated owners retain their existing restrictions; no new grants, tables or migrations are needed.

The existing readiness sheet adds a section using existing controls, spacing and colors, localized in English, Russian and Uzbek Latin. It distinguishes missing plan, pending sync, offline/unverified coverage, clock mismatch, competing primary, stopped plan, expired coverage, empty eligibility, delivery error and staged coverage. It maps next Fajr wake/backup only from the receiving installation's current events, and explicitly identifies a wake suppressed by quiet hours. Permission, installation support and subscription states remain in the existing background-notification section. Foreground/native readiness and the labeled preview flow remain unchanged.

A POST receipt is historical acknowledgment, never current readiness. The coordinator rereads server metadata before storing confirmation. The API reports `dispatchEnabled` from a fresh sender heartbeat. Staged copy identifies a stopped sender; scheduled copy retains best-effort limitations. Receive-time server authorization supports closed secondary installations across plan generations. Tests and saved plans do not confirm notification display, sound or wake-up.

## Recovery and remaining work

Retain the existing database schema and optional control fields on rollback; do not clear profiles or migration history. Existing controls without renewal fields remain valid. Privacy changes advance the subscription version, so old-version jobs no longer count as this installation's coverage. Offline cancellation cannot retract a push already accepted by a provider.

Still pending: hosted supervision and operational latency/retention gates in PUSH-02, and HTTPS/physical iPhone/Android evidence in PUSH-05. Keep a separate phone alarm. No deployment or cloud provisioning was performed.

See [plan contract](PUSH-PLANS.md), [cancellation contract](PUSH-CANCELLATION.md), and [verification evidence](evidence/push-renewal-2026-10-23/README.md).
