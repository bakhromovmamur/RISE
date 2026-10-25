# PRAY-02 — Prayer records, private pause and dated Fajr

**Date:** 21 October 2026  
**Scope:** PRAY-02, PRD-10–12; local mobile web implementation and verification.  
**Status:** complete for the local PRAY-02 scope. The full production release remains in progress. See [verification.json](verification.json) for exact scopes and results.

## Behavior and decisions

- Saved UTC windows now drive streak deadlines, alert planning, Fajr clock display and real-time phase comparisons through `prayerWindowInstants` / `prayerWindowState`. Travel and repeated DST clocks no longer leave those views using different deadlines. Time passing never creates an explicit missed record.
- An existing explicit prayer report can be corrected or removed after the clock moves backward. Its dated timetable remains; obsolete report metadata is removed, and the new audit timestamp uses the captured action instant. A new unrecorded report still requires its start, and a new later/missed report requires its end. Weekly counts and cells retain existing reports even if the clock is behind their date. Prayer actions remain separate from habit XP.
- Pause/resume validates the tracking interval and captured action date. A resumption point before the pause start is rejected. Include-current semantics retain their existing inclusive/exclusive boundary; resuming at the exact start can remove an empty interval. The form retains its original current-window default, including already reported prayers, while open overnight Isha uses its original date. Earlier unresolved gaps remain pending. Explicit reports survive pause; Undo inside the excluded interval leaves that prayer paused.
- Each new dated Fajr save snapshots `backupEnabled` with its plan. Later dated saves cannot change that date's enable/backup choice. The last saved plan remains the existing default for unplanned dates. Older plans without this optional field continue to use the existing device backup preference; no historical choice is invented.
- Fajr drafts retain an optional date through reload and validated portable backup. An existing undated draft uses the date shown when opened and binds it on the next edit/save. A form saved after midnight retains the displayed date instead of attaching its note to another morning. New plan submission validates lead/backup bounds; stored legacy fields are not rewritten.
- Real-profile wake previews use component-local stages. Stop, backup preview and preview acknowledgment cannot overwrite a live alarm or its acknowledgment ledger. Demo rehearsal stages remain persisted. A real acknowledgment cancels its date's wake/backup plan, leaves prayer records and preparation/due reminders separate, and wins over a stale ringing command.
- A recording command moves a work break to `returned` only if the requested report exists afterward. A rejected record retains its note and stage. Overnight expiry updates the open form, preserves the saved note and original prayer date, and does not grant another wrap-up minute.
- Scoped CSS keeps Fajr times, pause fields and long sheet titles readable at actual enlarged text sizes, including 320 px / Russian / 200%. Existing controls, copy, colors, spacing and assets are retained. Frozen references are never regenerated.

## Reproduction and coverage

The new public-interface domain tests initially passed 2 cases and failed 9, reproducing blocked history correction, hidden future-dated weekly records, civil-clock streak deadlines, erased pause ranges, dated plan coupling, overwritten acknowledgment state, lost draft date, DST wake display and an incorrectly finished work break. The original failures remain in [reproduction.log](reproduction.log).

The 11 domain cases also check pause exclusion across midnight, earlier gaps, no prayer/XP side effects, explicit Undo during pause, backup round trips, legacy field fallback and rejected work-record recovery. The browser file adds six functional journeys plus six layout variants per engine: saved-record correction after rewind; overnight pause/resume; dated draft reload; different-date preview isolation; same-date live stop/preview/real acknowledgment; and overnight work-note expiry/recovery.

Browser events in the same-date alert test are synthetic same-origin service-worker messages. They verify page routing, durable acknowledgment and planner cancellation; they are not proof of a real background push or physical-device wake-up. Existing foreground-delivery tests remain part of the regression suite.

Authoring-time selector/option-attribute failures and the initial layout/visual failures are retained separately. The pause default difference was corrected against the original frozen reference. The layout diagnostic identified the long sheet header after the time columns had been fixed; the same scoped title guard also covers the wake preview. These initial/interrupted runs are not completion evidence.

## Verification

All commands use Node 24.16.0 / npm 11.13.0 and isolated synthetic origins. Build before browser checks; each server freezes the completed build. The final input/build manifests identify the exact verified code.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run check` | Passed: lint, types, 137 unit/tooling tests, production/review builds | [check.log](check.log) |
| `npx playwright test tests/prayer-records.browser.spec.ts` | Passed: 36, three engines | [focused report](browser-prayer-final-report.json), [log](browser-prayer-final.log) |
| `npm run test:browser` + dated-scenario recheck | 378 unique cases verified: 375 in the full run, then 3 with the corrected retained-date expectation | [full report](browser-full-report.json), [dated recheck](browser-dated-final-report.json), [full log](browser.log) |
| `npm run test:production` | Passed: 39, three engines | [production report](production-report.json), [log](production.log) |
| `npm run test:visual` + targeted repeat | 48 variants / 720 exact comparisons: 47 passed initially; one passed on repeat after a capture timeout | [visual verification](visual-verification.json), [matrix report](visual-matrix-report.json), [repeat report](visual-retry-report.json) |

The full journey run still expected an unfinished October 19 Fajr draft to rebind to October 20 after reload in one scenario. That expectation conflicts with the dated-draft requirement. The test now expects October 19 and checks the saved draft date; all three engines passed the focused rerun (`npx playwright test tests/full-day.browser.spec.ts --grep 'Fajr plans keep their displayed date'`). No application/build changed. Final lint and types also passed. [browser-full-inputs.json](browser-full-inputs.json) records the full-run test inputs; [verification-inputs.json](verification-inputs.json) records the final assertion update. These are 378 unique journey cases plus 39 production cases, not an inflated sum of overlapping focused runs.

A supplemental pure command/planner check verifies a 00:30 Fajr with a 90-minute lead fires at 23:00 on the preceding civil date. Acknowledgment uses the following Fajr date, cancels only that date's wake/backup events, retains later dates and leaves prayer history/XP unchanged. [Result](fajr-midnight.log).

The only final visual interruption was a 5-second wait for a stable Journey capture in EN/dark/1440/100%; it produced no pixel mismatch. The unchanged-build repeat used `npx playwright test --config playwright.visual.config.ts --grep 'en-dark-1440x1000-100$'` and passed all 15 comparisons. The original failure is preserved under [visual-timeout](visual-timeout/). A first anchored grep matched no tests and was corrected; it is not counted as verification.

See [environment.json](environment.json) for actual runtime/engine versions: Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0, macOS arm64. Browser automation does not certify physical phones. Existing Vite bundle-size warnings remain non-failing and outside this task.

## Interface and preservation evidence

The six layout variants cover EN/light/375, EN/dark/1440, RU/light/393, RU/dark/320/200%, UZ/light/430/200% and UZ/dark/375. Each captures the Fajr form, acknowledged preview and private pause. All three engines check dialog horizontal bounds and header title/control bounds. The retained Chromium images are in [screens](screens/); the contact sheet is an inspection aid, not a replacement visual baseline. Toasts are dismissed for final captures, and screenshots target the app shell so reviewer controls are excluded.

[before.json](before.json) records the 1,152 starting input hashes and the temporary source snapshot location. [changes.json](changes.json) / [changes.patch](changes.patch) describe the focused source/test/doc changes. No starting input was deleted. The [final audit](final-audit.json) checks the retained hashes, output trees, links and task counts. The dependency manifests, design authorities, original assets and 720 frozen reference files remain unchanged. The Impeccable hook updates its own generated cache; it is not an application/data change.

[verification-inputs.json](verification-inputs.json) hashes 848 source/test/config/asset inputs, and [builds.json](builds.json) hashes both output trees. No schema version, migration, dependency, native project, deployment or permission configuration changed. The original immutable legacy recovery source remains untouched; no test opened or seeded the personal preview on port 4173.

The [mechanical detector](design-detector.json) reported existing radius advisories outside the changed rules. Those existing style choices were retained. The context loader also reports the historical mixed Platform value in PRODUCT.md; the user's mobile web target governs this task and that unrelated metadata was not repaired.

## Limits and recovery

This completes the local semantics task only. Accounts, multi-device reconciliation, server cancellation, PWA/background delivery and physical-device acceptance remain in their planned tasks. No prayer/health information, private notes or new serializer was sent externally.

Database 1, repository 1/2, domain 4 and backup 1 remain the existing versions. Optional dated backup/draft fields are validated and portable; existing records are never rewritten on load. Raw recovery retains unsupported legacy data. Export current/pending data before any code rollback: older command validators do not understand new payload fields, so a downgrade requires review rather than deleting fields or resetting the profile.
