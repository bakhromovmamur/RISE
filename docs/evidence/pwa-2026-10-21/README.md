# WEB-02 — Installable PWA and offline/update lifecycle

**21 October 2026 · local implementation complete · REVIEW pending physical mobile acceptance.**

RISE now has a production manifest, branded platform icons, installation guidance, a verified public offline shell and explicit updates that protect personal work. The existing four-tab interface, domain behavior and persistence schemas remain intact. No hosting, account backend, remote push subscription or guaranteed background alarm is claimed.

## Implemented behavior

- `/notifications-sw.js` remains the single root registration for public files and notification clicks. App bootstrap and notification delivery share its registration helper.
- The build injects a release ID, a compatibility contract and 17 public-file digests. Installation verifies every required file, including migration and backup worker chunks. Missing/corrupt files reject the candidate cache and retain the previous shell.
- Root/index cold and warm starts work from the completed cache. Public assets are separate from private IndexedDB records. Private/API/auth/logout responses, non-GET requests and cross-origin requests bypass Cache Storage; unrelated caches remain untouched.
- Updates stay waiting until an explicit action. Every same-origin window participates, including windows on another URL. Open forms, unfinished onboarding, startup/readback, active restore/clear, failed saves, unknown clients and incompatible contracts prevent forced activation. Temporary leases freeze new writes while durable queues finish. Held tabs reload only after successful activation; initial adoption does not reload.
- Settings adds installation/manual Home Screen guidance, actual offline-file readiness, update checks and an explicit persistent-storage request. English, Russian and Uzbek Latin cover new support/error states. Errors remain visible inside Settings. Test-notification clicks still open/focus RISE without creating a prayer/check-in.

The storage contract remains **database 1, repository formats 1/2, domain schema 4, backup format 1**. No records, recovery sources, drafts, operations or restore points are moved into Cache Storage. Existing public artwork, design tokens and dependency lock are unchanged. The user's personal-preview origin on 4173 was not loaded, seeded or cleared by tests.

## Verification results

Environment: macOS 26.6.2 arm64, Node 24.16.0, npm 11.13.0, Playwright 1.64.1. Actual browser versions: Chromium **156.0.8078.4**, WebKit **27.2**, Firefox **157.0**. See [environment.json](environment.json).

| Command | Result | Scope and evidence |
| --- | --- | --- |
| `npm run check` | **146/146** unit/tooling cases; lint, types and both builds pass | Final application/worker batch. [Log](check.log) |
| `npm run test:browser` | **378/378** existing journeys | Complete three-engine review regression before the final focused worker/support-state batch. Personal/domain implementations did not change afterward. [Report](browser-report.json), [log](browser.log) |
| Focused notification/Settings repeat | **6/6** | Final build; existing permission/test-notification and Settings save/export journeys in all three engines. [Report](browser-confirmation-report.json), [log](browser-confirmation.log) |
| `npm run test:pwa` | **42/42** | Final real-worker/cache/IndexedDB lifecycle and support-state cases across three engines. [Report](pwa-report.json), [log](pwa.log) |
| `npm run test:production` | **39/39** | Final empty entry, onboarding, schemas 1–4, recovery, backup/restore and prayer/travel checks. [Report](production-report.json), [log](production.log) |
| `npm run test:visual` | **48/48** variants; **720/720** comparisons | Final review build; zero-pixel tolerance, references unchanged. [Report](visual-report.json), [log](visual.log) |

The six focused review cases repeat cases from the 378; they are not six additional unique journeys. PWA and visual runs used independent isolated ports concurrently; production and PWA runs shared 4181 sequentially. All servers froze temporary copies of completed builds. `npm run check` finished before browser suites because its server regression also reserves 4181.

Final code/config/test inputs and both built trees are hashed in [verification-inputs.json](verification-inputs.json) and [builds.json](builds.json). Final source audit found no drift from the inputs used by the final PWA/production/visual and focused review checks. The full earlier review build is identified in [its build/check log](check-before-worker-confirmation.log); it was followed by the final checks above, rather than being represented as a second complete 378-case run.

### What the PWA cases establish

Nine lifecycle scenarios per engine exercise actual service-worker registration, install/activation/waiting, Cache Storage and IndexedDB:

1. Real manifest/icon delivery and exactly one root registration.
2. Warm reload and closed-tab/new-tab cold start without the app server, preserving a tiny check-in and exporting a backup offline.
3. Public-cache exclusion of synthetic private/auth/logout/mutation responses, including failed private fetches offline and preservation of an unrelated cache.
4. An unfinished authored goal draft in another tab blocks activation, survives the eventual coordinated update and reopens with both fields intact, without creating a goal.
5. Missing new assets leave the old version and saved records usable offline.
6. An incompatible storage contract cannot force an old tab to reload.
7. A real IndexedDB transaction blocks startup readback in another tab; activation waits until it finishes.
8. A real outbox write failure retains unsaved export, blocks activation and permits retry before updating; XP is preserved without duplication.
9. Clearing local data while an update waits cannot resurrect records from the public shell.

Two additional cases per engine use **synthetic install events** to check one-use prompt handling, accepted/dismissed outcomes and honest installed-state UI. They do not certify an OS installation.

Three language cases per engine check the new controls in light/dark themes at 320/375/393/430/1440 px and 200% text: **90 layout configurations**, plus offline/update/error views. Selected synthetic captures and their hashes are in [screens.json](screens.json). A bounded manual inspection checked mobile/dark controls, desktop/light controls, localized errors and the derived maskable icon. The mechanical detector returned no findings for the new support controls before the final error-visibility adjustment; that adjustment reused the existing form-error style and was checked in the final browser/screenshots. No extra design loop or baseline replacement occurred.

### Browser-emulation and acceptance limits

Firefox's Playwright offline switch produced `NS_ERROR_OFFLINE` before consulting the navigation worker. Its cold-start and failed-update tests instead disconnect the **isolated HTTP server**, while still requiring a real worker response and preserved records. Ordinary connection-indicator and private-fetch failures also use browser offline emulation. Chromium and WebKit cold-start cases use `context.setOffline(true)`. These are recorded test conditions, not a physical airplane-mode certification.

WebKit desktop automation is not physical iPhone Safari/Home Screen evidence. New/future storage contracts are injected for the refusal test; this task introduces no database-version migration. Real accounts/logout/switch cleanup remains AUTH/SYNC work; WEB-02 tests the public-cache boundary and actual guest clearing without fictional account controls.

## Corrections and preservation audit

- The first daytime tiny-check test needed a fixed page clock because the incumbent late-day flow has another valid action label. No product action was changed for that test.
- Seeded profiles can acquire existing device-timezone metadata during startup. Interface checks now wait for that existing durable observation before comparing state; the offline-clear check permits that known metadata while requiring all cleared domain fields to remain empty.
- The existing production export test selected the last Settings disclosure. The new install disclosure exposed that positional assumption. The test now selects **Your data** semantically, and all 39 production cases pass. The initial failed run remains in [production-initial.log](production-initial.log).
- Focused regressions reproduced two worker edge cases before correction: an unresponsive same-origin window beyond the start URL was excluded from readiness, and an alert-free test-notification click did not open RISE. [Before log](worker-regressions-before.log). Final unit cases and real multi-tab PWA checks cover the correction; forwarded alert payloads contain only known fields.
- The starting snapshot hashed **1,154 files**. No starting file was deleted. **729 protected files**, including all 720 frozen visual references, original public assets, design tokens, the Karpathy skill and dependency lock, retain their hashes. The existing journey suite refreshed 11 synthetic diagnostic captures under `.impeccable/review`; one differs from the starting capture. Those are generated diagnostics, not visual references or application assets. See [changes.json](changes.json) and [changes.patch](changes.patch).

## Remaining acceptance gate and recovery

WEB-02 is **REVIEW**, with its local implementation complete. Run the [physical-device procedure](../../PWA.md#verification-and-remaining-real-device-gate) on the configured HTTPS release origin: iPhone Safari/Home Screen and Android Chrome/PWA installation, force-close/offline reopening, blocked/failed/compatible updates, saved drafts and offline clearing. Record actual device/OS/browser versions. `habit.saraftech.com` is not configured by this task.

Publish complete builds atomically and retain prior fingerprinted assets during rollout. Roll back with a compatible complete build; never delete IndexedDB or clear all caches to resolve an update. A failed worker install keeps the prior shell. An incompatible contract remains waiting until old windows can safely close. Exported backups remain necessary for browser clearing, eviction and device loss. Installation does not enable background prayer delivery or a guaranteed Fajr alarm.

See the [PWA implementation and deployment guide](../../PWA.md) for the complete operational contract and primary platform references.
