# GROUP-01 local browser integration

23 October 2026 · macOS · retained local/test installations · GROUP-01 / PRD-14 / SEC-01, with PRD-04/17 and DATA-04 account-boundary regression checks. Cloud provisioning remains pending by the user's direction. The personal preview/profile on 4173 was not accessed; all account operations used synthetic identities and the local inbox. No invitation, email or push was sent to a real person.

## Behavior and scope

**GROUP-01 is locally verified and recorded as REVIEW for hosted acceptance.** Its downstream local tasks can now use this verified membership contract.

The production local/test entry now connects group creation, invitations, explicit join consent, membership and owner controls to the verified backend. Members choose a shared nickname; private profile names are not copied. Owners can rename, remove members, transfer ownership, archive/restore, revoke links and explicitly delete a group. Transfer/deletion require recent server-clock authentication. Members can leave and save their own mute/quiet-hour preferences; saving preferences does not enable notifications.

`GroupSession` owns current server views, durable intent, exact retries and account fencing. Received group content and invitation secrets stay in memory. Initial and same-document invitation fragments are removed from history. A signed-out visitor can select an account and return to explicit invitation review. A join stores only owner/operation/group IDs; after a reload, its minimal receipt lookup cannot expose a token. Unknown outcomes require the original link and explicit review. The added receipt endpoint requires verified ownership, Origin/CSRF and current membership, except for the actor's terminal leave/delete acknowledgment.

Non-secret commands are saved through the selected account's existing store before sending. Remembered accounts use their owner-scoped cache; session-only accounts use memory. One unresolved operation blocks another and participates in logout/departure/update safeguards. A lost reply replays the same ID, body, issue time and revision. Failed cleanup remains recoverable. Matching form cleanup preserves newer and unrelated drafts. Stale edits require an explicit current-version choice; stopping local intent never reverses an already accepted server action. Successful recovery, including after recent authentication, returns to the resulting group/list and announces the save.

English, Russian and Uzbek Latin use existing components and visual tokens. Group headers now grow around enlarged text. Nested sheets restore focus to their opener, including pointer-activated controls in WebKit; keyboard focus remains contained. Account changes close private forms. The account deletion ownership error opens group management for resolution.

Shared tasks/lists, exact squad snapshots and group notifications remain GROUP-02–04. Full shared-content deletion/export/restore acceptance remains GROUP-05. The original simulations, saved guest source and portable recovery remain separate; signing in imports nothing. Hosted and physical-device acceptance are not established here.

## Changes

New browser module: `src/groups/{client,session,intent,invitation,GroupProvider,GroupScreens,text,groups.css}`. Strict runtime response/pending-intent schemas extend `src/contracts/groups.ts`. Existing app/group entry points, account ownership resolution, account pending safeguards and localized status/error mappings connect this module. `src/components.tsx` changes sheet focus restoration; `src/push/client.ts` fixes the permission-dependent cleanup described below.

The server addition is the minimal group receipt lookup in `server/groups/{repository,routes}.ts`. The isolated BFF test entry supplies verified owner/Origin/CSRF-protected network fault controls; production does not expose them. New group session/browser tests and the `test:groups` command/CI step cover this boundary. The push browser fixture models permission-revocation deactivation while retaining explicit unsubscribe for granted permission. No migration, schema/cache/backup format, dependency version, private installation configuration or original asset changed in this increment.

## Verification

Node 24.16.0, npm 11.13.0, Playwright 1.64.1. Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0. BFF/database suites run sequentially on isolated 4191. Real credential flows have traces, video and automatic screenshots disabled. Layout captures use unusable synthetic account metadata and blocked service workers; real membership scenarios use the actual BFF/Auth/database/IndexedDB and service worker.

| Exact command | Observed result |
| --- | --- |
| `npm run check` | 227 unit/tooling tests, lint/types and production/review builds pass; existing Vite bundle-size advisory remains |
| `node --import tsx --test tests/infra/groups.test.ts` | 12 database/BFF checks pass, including owner/current-membership/CSRF denial and token-free receipt recovery |
| `npm run test:groups` | Final full run: 27 passed, zero failed/skipped/flaky; 18 real membership/account cases and nine layout cases |
| `npm run test:groups -- membership.groups.spec.ts --grep 'lost group replies'` | Three engines pass after the test waits for restored-account readiness |
| `npm run test:push` | 54 pass across three engines, including granted/revoked permission, explicit unsubscribe/logout, pending cancellation, renewal, foreground consent and the injected encrypted sender/receiver |
| `npm run test:sync -- account.sync.spec.ts lifecycle.sync.spec.ts` | 33 pass across three engines: selected import, two-device convergence, offline/lost replies, pending logout, owner cache isolation, export, recent authentication and deletion cleanup |
| `npm run lint` and `npm run typecheck` | Pass after the final test synchronization edit |
| `npm run check:docs` | Current-document links/anchors, 38 task dependencies/statuses and 20 PRD mappings pass; exact totals in the verification manifest |

The group layout suite checks eight scenes × three languages × two appearances × five widths (320/375/393/430/1440) × two text sizes (100/200%) × three engines: **1,440 layout states**. Checks cover horizontal reflow, header text bounds, reachable final actions, nested focus return and keyboard entry into recent-auth verification. Forty-eight Chromium captures, their exact synthetic fixture/source/build hashes and capture times are in [the visual manifest](visual-manifest.json). The screenshots show the scroll viewport; the tests separately scroll to the final action. Representative inspected views: [English hub](screens/groups-hub-en-light-393-100.png), [English invitation](screens/groups-invite-en-light-393-100.png), [Russian enlarged join](screens/groups-join-ru-dark-320-200.png) and [Uzbek enlarged settings/reauthentication](screens/groups-reauth-uz-dark-320-200.png).

Earlier in this same increment, `npm run test:browser -- tests/navigation.browser.spec.ts tests/full-day.browser.spec.ts` passed **21**, `npm run test:production` passed **54**, `npm run test:pwa` passed **42**, and `npm run test:visual` passed **48 cases / 720 exact frozen-image comparisons**. These runs include the final sheet focus/reflow changes; they precede the final group-retry navigation and push-permission cleanup fixes. Their timestamps/scopes are retained separately in the verification manifest. No visual reference was regenerated. The final group and related account/push runs cover the later changes.

Real membership coverage includes two accounts, clipboard failure, explicit join consent, fragment removal, no token in account storage, removal/revocation, fresh explicit rejoin, preference saves, recent-auth ownership/deletion, leave, lost create replies, exact replay after reload, blocked logout, stale edits, account-switch privacy, session-only discard, original guest preservation and zero habit XP from membership. Unit tests additionally cover failed durable intent/cleanup, token-free join recovery after reload, unknown join outcomes, response fencing and preserving newer drafts. The previous [backend report](../group-membership-2026-10-23/README.md) retains the wider single-owner/concurrency/RLS/suppression/restore evidence; those historical results are not represented as reruns of this browser increment.

## Failures found and corrected

Initial group layout checks found clipped Russian/Uzbek headers at 320 px and 200% text, nested-sheet focus loss and a test navigating before account restoration. Scoped header growth, opener tracking and an observable account-ready wait fixed those cases. The final layout matrix passes without changing the established visual references.

Strengthening the protected-deletion check found that recent authentication completed the server command but left its old confirmation visible. The shared retry completion path now replaces that stale screen stack and announces the acknowledged result. The final real deletion test verifies both the server outcome and visible empty group list/save announcement.

A real-worker WebKit logout test exposed a stalled `PushManager.getSubscription()` lookup for an account that never enabled push but had cancellation metadata. The same failure occurred without group actions. Blocking the worker or bypassing only subscription lookup isolated the boundary; changing notification closing, group subscriptions or sheet focus did not fix it, and those probes were reverted. The final regression uses the real worker with no subscription mock.

RISE creates permission-bound, user-visible subscriptions. The [Push API permission contract](https://w3c.github.io/push-api/#security-and-privacy-considerations) requires browsers to deactivate affected subscriptions when permission is revoked. Observation/cleanup now avoid entering the platform push service without granted notification permission. Granted subscriptions still use explicit unsubscribe; server retirement, notification closing, owner cleanup and retries remain required. This fixes the observed pinned desktop WebKit port; it is not physical Safari or push-provider certification. [Implemented cleanup boundary](../../PUSH-SUBSCRIPTIONS.md#logout-cleanup-and-deletion).

One intermediate full group run passed 26/27: Firefox clicked guest navigation during asynchronous account restoration. The test now waits for the restored account's group response, preserving the required scope reset. The targeted three-engine recovery check and final 27/27 full run pass. Diagnostic bypasses are absent from application and final acceptance tests.

## Evidence and recovery

[Code checks](check.log), [database checks](infra.log), [final group run](groups.log), [reload regression](reload.log), [push regression](push.log), [account regression](sync.log), [navigation](navigation.log), [production entry](production.log), [PWA](pwa.log), [visual comparison](visual.log), [lint](lint.log), [types](types.log), [document validation](documents.log), [verification manifest](verification.json) and [source preservation](preservation.json).

Keep all three existing membership migrations, forced RLS, receipt/suppression policies and lifecycle/retention hooks when disabling browser exposure. Retain unresolved non-secret account drafts for same-owner recovery; export recovery before intentional cache removal. Do not reset guest/account databases, recreate invitation intent or remove the deletion ledger to make an older client work. Public PWA caches and guest alert deduplication are independent of account cleanup.

The local membership contract can support GROUP-02/03. Maximum-quota invitation pagination, including a stopped retention worker, remains GROUP-04; the current 5,000-entry decoder ceiling fails closed and is not an overload guarantee. Real shared content, complete lifecycle integration, hosted operation, physical-device evidence and release approval remain open. The overall goal is still active, with cloud work pending.
