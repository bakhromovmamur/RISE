# PUSH-04 — Local habit reminder delivery and cancellation

**Date:** 23 October 2026. **Requirements:** PRD-05, PRD-11, PRD-19; existing SEC-03/04 consent, ownership and cancellation boundaries. **Environment:** macOS arm64, pinned Node 24.16.0/npm 11.13.0, isolated local/test databases and loopback browser fixtures. Cloud provisioning remains pending.

## Result and scope

Implemented pure dated habit eligibility, explicit per-device foreground consent/delivery, generic localized notifications, owner-scoped consent cleanup, inclusion in the existing staged account plan, save/sync-aware renewal and transactional completion/archive/preference cancellation. Saved domain, backup and database formats remain unchanged; no schema, grants, dependencies, styles, assets or design tokens were changed. The original preview remains a simulation. See [the behavior and recovery contract](../../HABIT-REMINDERS.md).

Foreground browser tests use the real app, IndexedDB, permission-action flow, worker registration and notification adapter, with the OS permission/display seam substituted. They prove that the adapter is called once for an eligible event, that explicit completion suppresses it and that no XP/private title is emitted by delivery. They do not prove a physical device displayed a notification. Backend tests use real verified sessions, owner RLS and transactions, with an injected synthetic transport. No real-person email or push was sent.

The existing API still reports `dispatchEnabled: false`. Account jobs are locally staged; the live sender remains test-notification-only. PUSH-04 stays **IN PROGRESS** for live integration. PUSH-02 operational sending and PUSH-05 HTTPS/physical-device evidence remain pending. Local expiry stays 120 seconds, with 84 events/seven days and the existing burst validation; the proposed longer habit expiry is not implemented.

## Verification

| Command | Result / evidence |
| --- | --- |
| `npm run check` | **215 passed**; toolchain, lint, app/test/server types and production/review builds pass. [Final log](check-complete.log). Existing bundle-size advisory remains. |
| `npm run infra:up -- local` and `npm run infra:up -- test` | Existing installations resumed and isolation verified without reset or migration changes. |
| `npm run test:infra` | **84 passed**, including real plan submission, immutable replay, RLS denials, dispatch/cancellation races and new habit eligibility/cancellation cases. [Log](infra.log). |
| `node --import tsx --test --test-concurrency=1 tests/infra/push-plans.test.ts` | **13 passed**. [Focused log](backend-plans-retest.log). |
| `npm run test:production` | **52 passed initially; two existing Firefox cases timed out**, then both passed in the isolated retry below. All 15 new habit cases passed. [Initial log](production.log). |
| `npm run test:production -- --project=firefox --grep 'production first-use salah\|production calculates offline'` | **2 passed**, completing all 54 production scenarios. [Retry log](production-retry.log). |
| `npm run test:push` | **42 passed** in the separate rerun. [Log](push-retry.log). |
| `npm run test:push -- habit-consent` | **3 passed** on the final cleanup change: guest/account separation and logout without a background subscription. [Log](consent-cleanup.log). |
| `npm run test:visual` | 42/48 configurations initially passed; six timed out. The targeted retry passed all six, completing **720 unchanged reference comparisons**. [Initial log](visual.log), [retry](visual-retry.log). No references regenerated. |
| `npm run test:pwa` | **42 passed**, including the actual root-worker offline/update lifecycle. [Log](pwa.log). |

The initial parallel browser runs encountered timeouts opening pages, filling unchanged prayer fields and taking screenshots. Separate reruns used the existing timeouts and unchanged reference images. The macOS `caffeinate -i` wrapper kept the machine awake during retries. An earlier new-test selector was corrected to the existing “Log 1 time +20” action; an earlier backend test read `operationRevision` incorrectly. Those failed logs remain alongside the successful final results.

New pure tests cover full/tiny/undo, tomorrow-effective schedule/time edits, materialized snapshots, archive, reminder disable, mandatory quiet hours, selected timezone, DST gap/repeat behavior, stable opaque event IDs and authored-text exclusion. Renewal tests verify habit state changes replace eligible events while retaining the explicit completion record. Server tests reject stale/completed/archived/arbitrary habit events and prevent omission of the habit marker from bypassing quiet hours. Existing queue/cancellation isolation and retry tests remain passing.

## Interface and preservation

The new settings controls use the current components, colors and type system. English/Russian/Uzbek Latin controls were exercised at 320/375/393/430 px, 100%/200% text and light/dark themes in all three browser engines: **144 layout combinations**. Normal English and Uzbek captures and the Russian 320 px/200% dark capture were inspected for readable actions and reflow. The existing narrow native time inputs are unchanged.

Representative captures:

- [English, 393 px](habits-en-light-393-100.png)
- [Russian, 320 px / 200% / dark](habits-ru-dark-320-200.png)
- [Uzbek Latin, 393 px](habits-uz-light-393-100.png)

The user's preview at 4173 was not seeded or reset. Tests used disposable contexts on 4181/4182/4191 and synthetic owners. Guest preservation is asserted through foreground delivery, account import and logout. No Git repository was present; affected files were reviewed against the private starting copies where available. Current [source hashes](source-hashes.json), [browser versions](browser-versions.json), [artifact checks](artifact-verification.json) and [cleanup results](cleanup.json) accompany this report. Playwright 1.64.1 used Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0.

## Recovery and remaining gates

Keep all journey data and display ledgers during rollback. Before reverting to an older frontend, disable renewal and remove only an incompatible pending habit-marked request using the current control CAS; never mutate/replay an existing request ID. Optional foreground consent does not require a database version change. See [rollback details](../../HABIT-REMINDERS.md#recovery-and-rollback).

Local/test stacks are stopped after verification with their volumes retained. No hosted account, deployment, domain configuration, invitation or provisioning action was performed. Future device testing must distinguish adapter invocation, provider acceptance, actual display and wake/sound behavior.

Consulted the current [Supabase changelog](https://supabase.com/changelog) and [official RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security). This change does not alter database policies, grants or provider APIs.
