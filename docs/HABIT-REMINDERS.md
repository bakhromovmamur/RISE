# Habit reminders — local PUSH-04 increment

**Current integration:** [live local sender and receive-time authorization](LIVE-PUSH-SENDER.md) now connect the existing consented queue to the encrypted transport. Cloud provisioning and physical-device acceptance remain pending. Earlier increment evidence retains its original scope.

Implemented 23 October 2026 for PRD-05, PRD-11 and PRD-19. Cloud provisioning remains pending. This increment adds working foreground habit delivery and integrates habits with the existing locally staged account queue. The subsequent live-sender integration enables local background dispatch; physical-device acceptance is still pending.

## User behavior

Keep each habit’s existing reminder time, weekday schedule, preview and tomorrow-effective edits. In **You → Settings → Habit reminders**, save the account/guest reminder preference and explicitly enable foreground habit reminders on this device. Browser permission is requested by that button only. A previously saved preview preference is not delivery consent. Permission denial, storage failure, disabled preferences and device consent remain distinct; notification failure never reports successful delivery or completes a habit.

Foreground notifications work while RISE is executing on an awake device. They use generic English, Russian or Uzbek Latin copy, request silence, and open RISE without recording completion. The existing completion-sound preference is not repurposed as a notification sound setting. The operating system ultimately controls notification presentation and sound. Preview remains a labeled simulation and neither asks for permission nor schedules an alert.

For accounts, existing explicit subscription and scheduling-device consent now include eligible habits alongside prayer/Fajr events. Current readiness distinguishes a stopped sender from live scheduling. Guest storage is never uploaded by this integration.

## Eligibility and cancellation

`src/habitSchedule.ts` is a pure projection. It uses domain `versionAt`/`scheduled`, materialized occurrence snapshots, the selected IANA timezone and `wallTimeInstant`. It does not write history or calculate XP. New habits may remind today; existing edits retain today’s version and start tomorrow. Blank/invalid legacy times, unavailable DST wall times, unscheduled dates, archived dates and either tiny or full completions have no event. A repeated DST clock uses its first occurrence once. Already elapsed reminders are not replayed on reload or after a long suspension.

Habit quiet hours always apply, including when a prayer/Fajr quiet-hour override is selected. Dates and habit IDs form stable semantic keys which are hashed before entering the queue. Completion/correction and explicit timer completion cancel that occurrence’s opaque event key. Other habit schedule/archive/preference changes conservatively invalidate the staged plan through the existing cancellation boundary; renewal reconstructs eligible prayer and habit events after save/sync. Consequently an offline structural change may leave the account plan stopped until the chosen device reconnects. Existing foreground prayer delivery remains separate.

Server cancellation commits in the same transaction as the accepted personal command and receipt. Plan submission rehydrates authorized saved state and matches habit key/time against current eligibility. Recognizable habit keys are checked even if a legacy caller omits the optional `kind: "habit"` marker. A newly submitted current revision cannot revive completed/archived habits or bypass quiet hours. Arbitrary typed habit keys and mismatched timezones/times produce no eligible jobs. A later undo may permit a new plan, but cannot redisplay an occurrence already claimed on this device.

The foreground adapter rechecks the current saved profile, owner, permission and consent around asynchronous work. Failed/pending saves are not delivery sources. The provider stops on account changes and account cleanup removes only the matching owner’s consent/ledger/visible alerts. Guest and other-owner data remain intact. Local cancellation cannot retract a provider submission that has already happened; the existing dispatch lock/race contract still applies.

## Storage, privacy and limits

- Existing journey, backup, database and cache formats are unchanged. No migration, grant or RLS change is required.
- `rise-push-device` v1 gains optional `habitForeground`, containing only `guest`, an owner UUID, or null. Missing means disabled. This device consent is not part of a portable backup or account profile.
- The plan contract accepts the optional bounded habit marker; job rows retain their existing opaque identifiers and timestamps. No habit title, cue, reason, coordinates or authored notification body is added to the job payload.
- Foreground and staged push use the same transactional owner/event/instant display ledger and tag. Claim-before-display prevents duplicate presentation, but a failed display after a successful claim can lose that occurrence. It is not an exactly-once delivery guarantee.
- Local queue limits remain seven days, 84 chronological events and the existing 12-events-per-hour validation. Readiness shows actual admitted coverage. Renewal runs at the earlier of twelve hours or one minute before that coverage ends, with a minimum one-minute retry interval. New-plan events within thirty seconds remain excluded. Excessive bursts fail visibly; no silent rate-filter drops were added.
- This increment intentionally retains the current **120-second expiry** across foreground, staged jobs and worker validation. The architecture’s proposed 15-minute habit/group expiry remains a future coordinated protocol/database/device change; it is not claimed here. No existing expiry constraint is loosened.
- The sender now processes consented reminder jobs and explicit tests. Verification exercises real encryption with an injected synthetic provider; physical notification display, background arrival, sound and locked-device behavior remain PUSH-05 gates.

## Recovery and rollback

Disabling foreground delivery clears the consent through the existing control CAS. Lost or conflicting control writes expose a retryable error rather than success. Revoking browser permission stops delivery without changing habit history. Existing account cancellation intent/replay and renewal recovery remain documented in [PUSH-CANCELLATION.md](PUSH-CANCELLATION.md) and [PUSH-RENEWAL.md](PUSH-RENEWAL.md).

Rollback disables the new provider/projection. An older frontend cannot parse a pending renewal request containing the new habit marker: before reverting, use the current control CAS to disable renewal and remove only its pending request, retaining a private recovery copy if needed. Never change and replay that immutable request under the same ID. An explicit future choice creates a new intent. The foreground-consent field itself is optional and ignored by the old frontend. Retain saved journeys and display ledgers; do not reset databases, browser origins or migration history. A previously attempted occurrence should remain claimed after rollback. No hosted services or real-person notifications were used for development verification.

See [the evidence report](evidence/habit-reminders-2026-10-23/README.md) for exact checks and limits.
