# RISE PWA: installation, offline use and updates

WEB-02 · 21 October 2026 · production web build. This is an implementation guide, not a deployment or physical-device sign-off.

## Installation

Build with `npm run build` and serve **all of `dist/`** at the root of a dedicated HTTPS origin. `habit.saraftech.com` remains the intended, unconfigured deployment. Loopback HTTP is permitted for local testing. A first visit needs a connection to download the complete app shell.

**You → Settings → Install & offline** contains installation guidance, actual offline-file readiness, an update check and an optional persistent-storage request. New visible and accessibility text is provided in English, Russian and Uzbek Latin. The existing RISE sprout supplies the 192/512 px icons, maskable icon and 180 px Apple touch icon; `public/icons/rise-icon.svg` is the vector source. No existing art or favicon was replaced.

Browsers exposing `beforeinstallprompt` get an explicit Install RISE button. Other browsers get manual instructions, including iPhone/iPad **Share → Add to Home Screen**. A dismissed/accepted prompt alone is not installation proof. RISE detects a standalone launch or the browser's `appinstalled` event. An ordinary browser tab may still offer guidance when another platform-specific Home Screen instance exists.

Installation does **not** enable background Fajr alarms or Web Push. Existing executing-page reminders retain their limits. Push permission/subscription and server scheduling belong to PUSH tasks.

## Offline behavior and personal data

After the worker has verified and cached every required public file, personal flows can start offline, including a new tab after the previous tab is closed. The shell includes migration and backup worker chunks, so offline startup and explicit export do not depend on a network module import. Cached files never substitute a fictional profile or prayer timetable.

The offline status uses the browser's connection signal; that signal does not prove an internet/server connection. A device can report online while its network or server is unreachable. The guest journey remains device-only. Explicitly selected account journeys use SYNC-01/02’s separate owner cache/outbox and show Synced only after server acknowledgment/reconciliation; session-only accounts keep private state in memory. See [the account sync contract](ACCOUNT-SYNC.md).

Guest private records, drafts, original migration sources, restore points and operation receipts remain in `rise-device` IndexedDB. Remembered accounts use separate `rise-accounts`; push consent uses `rise-push-device`. None is placed in the public cache. Database version 1, repository formats 1/2, domain schema 4 and backup format 1 are unchanged. No state is migrated into Cache Storage. Clearing local data cannot restore records from the cached shell. Clearing site/browser storage, private browsing, eviction or device loss can still remove local records; export backups regularly. Persistent storage is requested only after an explicit button action and may be denied. It does not prevent deliberate browser-data clearing.

A brand-new browser with no completed cache cannot cold-start offline. If public files are evicted or unavailable, RISE does not manufacture a successful offline state. Reconnect and reopen/check updates. Failed saves retain the existing recovery/export/retry path.

## One root service worker

`/notifications-sw.js` with scope `/` remains the single registration URL used by both app bootstrap and notification delivery. Registration uses `updateViaCache: "none"`. No second root worker is introduced. Native Capacitor entry and review/development builds do not automatically install the PWA.

The production build finalizer (`scripts/pwa-build.ts`) injects a release ID, a storage compatibility contract and an explicit public-file list into the worker. The release ID includes worker source and asset digests. Every downloaded file must return 200 without redirect and match its SHA-256 digest before installation succeeds. The list includes the public shell, fingerprinted chunks/styles, existing mascot/trail assets, manifest and icons. Prompt/source text and private/API responses are not precached. Incomplete installation deletes only the candidate cache and leaves the previous shell intact.

Cache names are `rise-public-v1-<release>`. The fetch handler serves the known root/index shell and allowlisted public files. Queries on assets, cross-origin requests, non-GET requests and private/API/auth/logout routes bypass Cache Storage. There is no general runtime response cache or catch-all HTML response for unknown routes. Previously cached fingerprinted chunks can serve a tab that loaded just before activation. Cleanup preserves live tab releases and one previous public cache; unknown/unresponsive tabs defer cleanup. It never enumerates or deletes private repository data or unrelated caches.

Review output has no manifest link, release metadata or automatic worker bootstrap. Its copied notification worker has no injected cache configuration. Review fixtures remain confined to their existing guarded origins.

## Update protocol and storage safety

1. A newly downloaded worker verifies its complete public shell and stays **waiting**. Installation never calls `skipWaiting()` automatically.
2. An explicit Update RISE action asks all app windows at the same origin whether they are ready. Settings closes before its own update request; other open forms are left intact.
3. Startup/migration/readback without an attached verified `DeviceSession`, unfinished onboarding, open dialogs, active restore/clear, failed saves and incompatible contracts refuse readiness. This conservatively protects both durable drafts and forms that still own component-local edits.
4. A ready session takes a temporary, non-persisted update lease. It freezes new writes and waits for its existing durable queue. The application is inert while held. No lease is written into user data.
5. The worker rechecks the client set and all replies. A new tab, missing reply or rejected readiness releases held tabs and leaves the update waiting. The UI explains how to resolve it.
6. Only a successful coordinated request activates the worker. Held clients reload on controller change. Initial worker adoption does not reload the page. An explicit worker refusal releases the hold. A reply timeout after approval does not cancel browser activation, so the approved hold remains until controller change or its existing 30-second fallback. Errors before approval still show an update failure. No timeout is extended and no personal storage is cleared. Before approval, required journey saves/session-only sync finish, then both private API request paths drain through body parsing and stop admitting new requests. New attempts use their existing unavailable/retry behavior; there is no credential/request queue or mutation replay. Optional status/pruning messages also pause. Refusal or expiry reopens the lane; matching tokens prevent stale releases. [Local activation correction and tests](evidence/worker-activation-2026-10-25/README.md).

Already-open older page code retains its previous handoff behavior until replaced. A stalled older client may require finishing saves and normally closing/reopening app tabs; never unregister the worker or clear storage.

The compatibility contract is currently `db1-repository2-domain4`. Change it deliberately when old and new clients cannot share storage. Such an update cannot force current clients through activation; finish/export work and close old tabs, then reopen normally so new code can run its supported staged migration. Never clear storage to resolve an update mismatch.

The notification click boundary validates a bounded, nonexpired known alert and routes only to the fixed same-origin application. It awards no XP and never records a prayer or wake acknowledgment. PUSH-01–04 now extend this validation/delivery seam with subscriptions, server scheduling and receive-time authorization/expiry. These were outside the original WEB-02 evidence scope.

## Deployment and recovery contract

- Publish the entire build atomically. Keep the current and previous fingerprinted files available during rollout; never mix an index/worker from one build with chunks from another.
- Serve `/notifications-sw.js` as JavaScript and `/manifest.webmanifest` as `application/manifest+json`. Serve worker/index/manifest with `Cache-Control: no-cache` or stricter revalidation. Fingerprinted chunks may use immutable long caching. Private/API/auth responses require `Cache-Control: no-store`.
- Root hosting is required by the current manifest, routing and worker scope. Do not mount this build under a subdirectory or share this worker's root with a different app.
- Preserve site storage during rollback. Redeploy a compatible complete build as a new worker update. Do not unregister workers, clear caches indiscriminately or delete IndexedDB as a rollback procedure.
- HTTPS, security headers, production host configuration and actual release/rollback drills remain infrastructure/release work. The localhost checks do not certify that hosting.

## Verification and remaining real-device gate

Run these **sequentially**, after building, with isolated ports free:

```sh
npm run check
npm run test:pwa
npm run test:browser
npm run test:production
npm run test:visual
```

`test:pwa` serves a frozen temporary copy of `dist/` on guarded loopback port **4181**, with synthetic version/connection failure controls. These routes exist only in `scripts/serve-pwa-test-build.mjs`, never in production. It runs real service workers, Cache Storage and IndexedDB in Chromium, WebKit and Firefox. Firefox's current Playwright offline-emulation navigation fails before consulting its worker; those cold-start cases disconnect the isolated HTTP server instead. They still require an actual worker response and preserved durable data. Ordinary offline-indicator and failed-network fetch checks use the browser's offline switch. This distinction is recorded rather than reporting a simulated physical airplane-mode test.

Before WEB-02 acceptance on the release host, record exact physical device/OS/browser versions and screenshots for:

- Supported iPhone Safari and installed Home Screen app; supported Android Chrome and installed PWA. Verify icon/name, launch/safe areas and manual/automatic installation affordances.
- Complete the first online cache, then airplane mode, warm use and force-close/cold reopening. Check authored drafts/records, backup export and a reconnect.
- Publish a compatible update: keep a form open in another tab, save a command, update explicitly, and verify all data and only one root registration.
- Interrupt an update download; reopen offline using the prior version. Run a staged incompatible update with a storage migration and verify no active old writer crosses the compatibility boundary.
- Clear local data offline while an update waits; confirm no personal records reappear. AUTH-01 separately tests real local identity/logout/switch and guest preservation. Separate SYNC/DATA-04/PUSH evidence covers local account-cache/subscription cleanup; it is not supplied by this original PWA increment.

See [WEB-02 evidence](evidence/pwa-2026-10-21/README.md) for actual local results and unresolved gates.

Primary platform references: [MDN worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting), [MDN install prompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent), [WebKit Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Prompt support is progressive enhancement; automated desktop engines do not prove a physical Home Screen install.

## OPS-03 local rollout integration

[Local release packages](LOCAL-ROLLOUT.md) retain the worker's verified asset manifest and all-tab update protocol. A publication stamp gives a republished complete package a distinct worker identity without changing screens or storage contracts. Rollback publishes the previous compatible package; the user then applies it through Update RISE. Never unregister the worker or clear saved data to force adoption. The rollout acceptance suite uses real account sessions and durable pending changes on isolated 4191, separately from the 4181 PWA suite.
