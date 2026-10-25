# Verification — Russian interface

> Dated evidence archive. “Current” within an older section refers to that section’s build/date. Current execution status is in [TASKS.md](TASKS.md), with later reports in `docs/evidence/`. Historical counts and scope statements below are unchanged.

Latest audit: [23 October 2026 product-document reconciliation and browser-compatible local BFF](docs/evidence/product-review-2026-10-23/README.md). The fixed 4192 entry passed all three engines while preserving installation identity and existing origins. It does not close hosted or physical-device release gates.

Verified 21 October 2026, Asia/Tashkent. This release adds Russian across the complete interface while retaining the four-tab product, incumbent design, schema 4, storage key and progress rules. [The Russian guide](RUSSIAN-LANGUAGE.md) explains language selection and the demo entry points.

## Current results

- Production build passed: **`index-BOnYvotb.js / index-D4SQdtSZ.css`**. `dist/index.html` references that pair. Vite reports its existing 500-kB bundle advisory: 619.77 kB JavaScript / 183.50 kB gzip; there is no build error.
- **57 domain tests passed**, including four localization checks for Russian formatting/plurals, explicit fixture translation without changed achievement calculations, preserved saved content/preferences through migration, and translated timetable validation.
- **59 Chromium browser scenarios passed in 36.7 seconds** after the final corrections: nine Russian journeys plus the 50 retained scenarios.
- **116 passing automated checks total.** Russian coverage includes language persistence with whole-state equality except `life.language`; all four tabs and selected week; prayer setup/reminders and work notes; Fajr stop/backup/acknowledgment; tiny/full/Undo; goals/rewards and validation; family/list/squad interactions; private pause/readiness; empty setup/onboarding; keyboard focus; dark appearance; responsive widths and enlarged text. Covered Russian visible copy and accessibility names are checked for untranslated English, with brands, timezone identifiers and user-authored content excepted.
- The added motion-enabled long-form scenario checks 375/393/430 × 852 at normal and 200% text. It verifies that the full sheet header and Close stay inside the viewport and that the app shell remains at scrollTop 0.

These are the implementation owner's recorded results in [the verification notes](.impeccable/review/russian/verification-notes.md). The reviewer and documenter inspected evidence/source without rerunning tests or the build. The final complete suite covers the source after both reviewer-requested corrections.

## Localization and saved content

The 1,537-key Russian catalog, pure formatter and locale context cover newer Daily life flows and older screens, forms, errors, help, accessible names and reviewer controls. Numbers, dates, known units and plural forms use Russian presentation. Browser-native date/time picker chrome follows the browser's language settings.

Language selection writes only `life.language`; saved names, notes, reflections, group text and existing English fixture content stay as written. Records, XP, goals, rewards, priorities and identifiers remain. Explicit fixture loading retains the selected language and localizes built-in examples for a newly loaded Russian demo. It is a replacement of that origin's data, not a migration action. English and existing Uzbek UI paths remain. Generic Uzbek dates retain `en-US` formatting to avoid the embedded browser's `M10` fallback; Russian uses `ru-RU`, and the Uzbek Fajr-plan date keeps its existing numeric day.month.year branch.

Russian habit actions have equal columns and the concise «Минимум» label, stacking at 200% text. Shared sheets focus with `preventScroll` while entering and scroll long content internally, keeping the header and exit controls visible. No schema or domain-rule change is implied.

## Current live handoff

The owner preserved the [main port-4173 profile](http://localhost:4173/?v=daily-life), changing its preference from Uzbek to Russian through the UI without a reset. After reload it remains on Today with three completed tiny priorities, **260 XP**, planned Asr at **15:50**, the October 20 Fajr plan and the original return note beginning “Finish the save-button handler…” retained. Existing English names remain as written.

The separate [port-4174 rehearsal](http://localhost:4174/?v=russian) now holds explicitly loaded Russian Daily life on **October 19 at 14:00 with 240 fictional XP**. Russian built-in examples, one of three tiny priorities completed and an illustrative October 20 Fajr plan are present. Both delivered tabs are on Today, with viewport overrides reset. Neither preparing Fajr nor acknowledging its alarm records prayer or adds XP. The `v` query values are release labels, not reset commands. These state claims are owner evidence; the documenter did not operate either browser.

The full-day and difficult-day walkthroughs below document historical rehearsals. To replay one, explicitly select and load its fixture on port 4174; the current rehearsal no longer holds their completed-day or next-morning states.

## Current captures and finish

[The Russian manifest](.impeccable/review/russian/manifest.json) lists **16 actual browser images** with byte-identical public copies in `screens/russian/`. The original matrix contained 13; the reviewer correction replaced `prayer-setup.jpg` and added three focused confirmations. Phone exports match 375/393/430 × 852; requested desktop 1440 × 1000 exported at 1436 × 997. Captures cover all four tabs, language selection, prayer/Fajr, family/lists, light/dark appearance and 200% text. [The screenshot guide](screens/README.md) links every image.

The owner opened the original batch, made one bounded localization correction and recaptured affected regions. The manifest preserves the actual build of each capture. Unchanged regions from earlier builds remain identified as such; only the four reviewer confirmations record final build `index-BOnYvotb.js / index-D4SQdtSZ.css`. The documenter checked hashes, actual pixel dimensions and public-copy identity without reopening images or repeating the visual review.

The independent reviewer opened all 13 original images and found two material issues: the long prayer-form header/exit controls clipped above the viewport, and generic Uzbek dates exposed `M10`. One correction batch fixed both. The same reviewer then opened the replaced prayer-setup image plus the three new confirmations and verified their hashes, dimensions and public copies. Its [final disposition is **ship for the two resolved findings**](.impeccable/review/russian/finish-review.md), with no remaining issue in that scoped confirmation. This was not a second whole-surface review. The original findings and their resolutions remain in the report. Test execution and measurements such as header y = 0 are supplied owner evidence.

[The surface brief](.impeccable/briefs/russian-language.md) and [documentation check](.impeccable/review/russian/documentation-check.md) record the handoff. `DESIGN.md`, `.impeccable/design.json` and original artwork/provenance retain their authority. Automatic design hooks remained active; no additional detector ran.

## Scope and limits

Evidence comes from local Chromium/in-app-browser work and the prototype's review-only 200% root-text mode. It does not certify physical devices, Safari/WebKit, VoiceOver or exhaustive accessibility. Authored prayer times, local alarm/reminder/readiness and membership simulations remain; no real permission, alarm/push delivery, live timetable, external message, authentication, billing or cloud synchronization was added. The following records retain earlier releases and their original validation scope.

## Historical difficult-day refinement

Verified 21 October 2026, Asia/Tashkent. This refinement supports honest recovery from missed Fajr, a delayed Asr break and unfinished habits while retaining the four tabs, incumbent design, schema 4, storage key and existing domain rules. The results and continuous rehearsal below describe that release. Port 4174 now holds Russian Daily life; explicitly load the Difficult day fixture to replay this history.

### Difficult-day results

- **53 domain tests passed** in 163.974 ms.
- **50 Chromium browser scenarios passed** in 31.7 seconds: three new difficult-day scenarios plus 47 retained scenarios.
- **103 passing automated checks total.** New coverage includes explicit missed/later/corrected records, independent prayer streaks, lighter priorities without completion, an expired open Asr form with retained draft, returning unlogged, a 10-XP tiny check-in, unchanged prior goals/cosmetics/rewards, reload persistence, next-day occurrences without duplicates, a zero-check-in day and Uzbek 200% overflow checks at 375/393/430.
- After the final reviewer-checkpoint correction, `npm run build` passed with **`index-B4wVnNki.js / index-BOhwQIzY.css`**, and all three recovery browser scenarios passed again in 11.7 seconds. This correction sorts checkpoints chronologically and derives the after-Asr checkpoint from the prayer window; the product recovery flow is unchanged from the capture build.

These are the implementation owner’s recorded results in [the verification notes](.impeccable/review/recovery-day/verification-notes.md). The documenter checked documentation, relevant source and file integrity without rerunning tests, a detector or browser actions. The whole 103-check suite was not rerun after the reviewer-only checkpoint adjustment; the final build and focused three-scenario rerun cover that final source state.

### Continuous rehearsal and recovery behavior

The [difficult-day walkthrough](DIFFICULT-DAY-WALKTHROUGH.md) uses the explicit **Difficult day · one small step** fixture, loaded once on the separate [port-4174 rehearsal origin](http://localhost:4174/?review=1). It begins Tuesday, October 20 at 08:00 with unrecorded Fajr and labelled prior fictional accomplishments: 280 XP, Monday’s five on-time prayers and three check-ins, one completed goal milestone, Pip’s scarf and an earned coffee. The three-check-in coffee condition is shared with the explicit Full day fixture, not a changed product reward rule.

The owner explicitly recorded missed Fajr, reduced the plan to reading, recorded Dhuhr on time, saved an Asr return note and requested a wrap-up minute, then advanced past the prayer window with the save form still open. The form adapted in place and retained the note. Asr was explicitly recorded later; Maghrib and Isha were recorded on time. At bedtime only one page of reading was logged, adding **10 XP**. The coffee stayed earned and was explicitly marked enjoyed. The dated October 21 Fajr plan, records and note survived reload. The next morning’s Fajr was explicitly recorded on time.

Missed or later records explain their own on-time streak break and provide a direct Today return, with correction choices clearly labelled. Fajr restarted at one next morning while its best of three remained. Other prayer streaks, earlier records, goals, XP and earned rewards were preserved. Returning from an expired reminder can leave the prayer unlogged; it never assumes a miss or completion. Removing a priority logs nothing. Unfinished Tuesday habit occurrences remain in history and Wednesday receives its own scheduled plan, without duplicated catch-up tasks.

At that release, the shared rehearsal origin was left on **Wednesday, October 21 at 05:35 with 290 XP**. The main port-4173 profile was preserved; a read-only reload confirmed its original 260 XP, Fajr/Dhuhr on time, planned Asr at 15:50, three tiny priorities, unclaimed scarf, coffee at 3/5, saved Fajr plan and original return note. Both browser tabs remained available at that release. The earlier completed full-day scene can be replayed by selecting and loading its fixture on port 4174.

### Difficult-day captures and finish

[The recovery manifest](.impeccable/review/recovery-day/manifest.json) identifies **14 unmodified JPEGs**, with byte-identical public copies in `screens/recovery-day/`. The owner opened all 14 during one bounded capture review covering requested phone widths 375/393/430, desktop 1440, light/dark appearance and English 200% text. Actual exports are **371×843 / 389×843 / 426×844 / 1436×997**; filenames describe requested widths, not exact image pixels. Two captures were reframed and a scrolled enlarged-text action view was added. The completed-priority and enlarged-text action captures are deliberately scrolled. Per-capture builds, dimensions and hashes are recorded; no image editing or resizing was applied. See [the screenshot guide](screens/README.md).

The owner found no material product visual defect in that bounded pass. The fresh independent [finish review](.impeccable/review/recovery-day/finish-review.md) returned **ship with no material findings** within the difficult-day scope. The reviewer individually opened all 14 actual images, confirmed dimensions/hashes/public-copy identity, and inspected relevant source and tests. The reviewer did not rerun suites, the build or the continuous browser rehearsal. Screenshot evidence establishes visible states; persistence, exact XP in phone views and profile isolation also rely on inspected source and owner execution evidence. [The surface brief](.impeccable/briefs/recovery-day.md) and [documentation check](.impeccable/review/recovery-day/documentation-check.md) record the handoff and its limits.

### Difficult-day scope and limits

No persisted schema, storage key, domain rule, backend, native alarm or permission change. `DESIGN.md`, `.impeccable/design.json`, original artwork and provenance remain unchanged. No new detector suppression was added. Navigation/focus/reduced-motion coverage remains in the passing suite; the new recovery test checks Today-heading focus, and the owner used Reduce motion in the demo profile.

This is local Chromium/in-app-browser evidence, including the prototype’s explicit 200% text mode. It does not certify physical devices, Safari/WebKit, assistive technology or exhaustive accessibility. Native alarm/notification delivery, live timetables, external invitations, cloud synchronization and purchases remain outside the prototype. No test or live action proves religious validity or measures faith. The following records describe historical releases.

## Historical Fajr-to-bedtime refinement

Verified 21 October 2026, Asia/Tashkent. This preceding refinement joined Today, Journey, Progress and You through one cumulative day. Its build, 100-check result and 18-capture review below are historical evidence. Port 4174 now holds Russian Daily life; select and load Full day · Fajr to bedtime to replay this example.

### Full-day results

- Final production build passed: `index-3O6iX_SQ.js / index-gik2u5ez.css`.
- **53 domain tests passed** during this task; domain and schema files have not changed since that run.
- **47 Chromium browser scenarios passed in 26.6 seconds** on isolated port 4180: the three new full-day scenarios plus all 44 retained scenarios. Final runs passed without retries.
- **100 passing automated checks total.** New coverage includes the cumulative day, explicit/correction-sensitive Fajr records, stable priorities and XP, family-list/back navigation, date-specific saved plans, drafts, focus and enlarged-text layout.

These are the implementation owner’s results in [the verification notes](.impeccable/review/full-day/verification-notes.md). The fresh reviewer and documenter inspected supplied evidence/source without rerunning suites or opening a browser. Earlier fixture-typing and test-locator issues were corrected before the final passing runs. The terminal’s `NO_COLOR`/`FORCE_COLOR` warning was benign; the main and rehearsal browser tabs reported no warnings/errors.

### Walkthrough and corrected handoffs

The [walkthrough](FULL-DAY-WALKTHROUGH.md) documents an explicitly loaded Full day fixture on port 4174. Day checkpoint moved its clock from 05:10 to 22:00 without reloading the fixture or completing actions automatically. Reading full (+20), walking tiny (+10) and building full (+20) moved 230 prior fictional XP to **280 XP**. Prayer, task/list work, a goal milestone, reward enjoyment and clock movement added none. The three-check-in coffee condition belongs only to this explicit fixture.

Four corrections close the identified gaps: Fajr acknowledgment now reflects its actual record and corrections; prayer-break and saved-plan returns select/focus Today even after entering from You; a task opens its own family’s Lists section and retains its back path; and the next Fajr plan displays and retains its target date, with saved status while its current values match the saved plan. Enlarged text now stacks intact clock values and allows the sheet header to grow; the Uzbek plan date uses day.month.year.

The rehearsal retained five prayers, three check-ins, the completed family task and Apples item, one explicitly completed goal milestone, claimed scarf, enjoyed coffee and the next Fajr plan after reload. Tomorrow’s prayers remained unrecorded. At that release it was left at 22:00 on Today. The main port-4173 profile was preserved and reloaded from the final build: its 14:00 day, 260 XP, two prayer records, three tiny priorities, unclaimed scarf, coffee at 3/5, planned Asr at 15:50, saved Fajr plan and original return note remain. Both origins remained live at that release.

### Full-day captures and finish

[The manifest](.impeccable/review/full-day/manifest.json) identifies **18 unmodified JPEGs**, with byte-identical public copies in `screens/full-day/`. The implementation owner and independent reviewer opened every image. Coverage includes dark Fajr, requested phone widths 375/393/430, the day’s handoffs, desktop and Uzbek 200% text. Actual exports are 371×843, 389×843, 426×844 and 1436×997; they are not exact requested viewport dimensions. The manifest names each capture build. The two Uzbek enlarged-text captures show the final corrections; the ordinary English/dark captures retain the same relevant rendered content. Saved-plan and large-time views intentionally scroll. See [the screenshot guide](screens/README.md).

One bounded inspection/correction pass addressed the date and enlarged-text issues, followed by the final correction captures. No second broad implementation visual sweep was performed. The fresh independent [finish review](.impeccable/review/full-day/finish-review.md) inspected all 18 actual images, their dimensions/public-copy identity and relevant source, and returned **ship with no material findings**. No source correction remains. The [surface brief](.impeccable/briefs/full-day.md) and [documentation check](.impeccable/review/full-day/documentation-check.md) record the finish.

`DESIGN.md`, `.impeccable/design.json`, original artwork and provenance remain unchanged. The active hook suppressed repeated `context.tsx` hints without a new deterministic issue; no separate detector ran. Package refresh is the implementation owner’s final delivery step.

This is local Chromium/in-app-browser evidence, including the prototype’s explicit 200% mode. It does not establish physical-device, Safari/WebKit, screen-reader or exhaustive accessibility coverage. Real alarm/notification delivery, live timetables, external invitations, cloud sync and purchases remain outside the prototype. All records below are historical releases.

## Historical four-tab refinement

Verified 20 October 2026, Asia/Tashkent. This preceding refinement aligns Today, Journey, Progress and You within the pinned RISE identity, preserving saved data, domain rules and schema 4.

### Four-tab results

- Final production build passed: `index-vFGKc8ze.js / index-uh5ewCWE.css`; at that release, `dist/index.html` referenced this pair.
- **44 browser scenarios passed in 17.8 seconds** after the accessible-name correction, using isolated Chromium profiles on port 4180. Coverage comprises 11 balanced, 12 Daily life, 4 Today, 4 Progress, 5 Journey, 4 You and 4 shared-navigation scenarios.
- The prior **53 passing domain tests remain applicable** because domain/model/schema files are unchanged: **97 checks total**. The final semantic fix did not require a fresh domain run.
- New navigation checks cover shared headings; arrow/Home/End navigation and active-tab semantics; retained scroll, disclosures and Progress week/view; explicit shortcut scroll reset and heading focus; sheet-to-Journey handoff; one Today timetable entry; no navigation record changes; and readable 200% English/Uzbek navigation at 375/393/430 px.
- The timetable scenario checks local, calculated and unconfigured setup in both languages, preserving each complete visible label in its accessible name. Existing prayer, habit, goal, reward, Fajr, pause, draft, family, squad, export and migration checks remain passing.

Execution details are in [the four-tab verification notes](.impeccable/review/four-tabs/verification-notes.md). These are the implementation owner’s execution results. The finish reviewer and documenter inspected supplied evidence/source without rerunning suites or opening a browser. No warnings/errors were reported on the review or delivered tab.

### Four-tab behavior and visual evidence

All four tabs share a `TabHeading` and consistent heading size/spacing. Today retains prayer-first priorities and two quiet reward cues, with one city/source timetable entry and Record when available. Journey owns unlocks and the clearly named Personal rewards section. Progress has three closed native summaries for Salah, Habits and Goals, one current-availability Rewards in Journey link, then reflection. You retains its compact preferences/people hub. Ordinary tab switches preserve reading positions and local view state; explicit shortcuts reset destination scroll and focus the heading. The 200% review mode uses two roomy navigation rows.

[The manifest](.impeccable/review/four-tabs/manifest.json) lists **29 JPEGs**, with byte-identical public copies in `screens/four-tabs/`. It covers all four tabs at 375/393/430 × 852, desktop, dark phone appearance and English 200% text; Progress and You at 703 × 753; Uzbek 200% You; and earned-reward/empty Progress. All were opened and inspected by the implementation owner and independent reviewer. See [the screenshot guide](screens/README.md).

The matrix was captured from `index-8X90d8QZ.js / index-uh5ewCWE.css`. The final build only corrects the timetable button’s accessible name; visible text, layout and CSS are unchanged. The matrix remains valid visual evidence. `you-large-uz.jpg` explicitly shows a scrolled You state after closing Settings: requested 375 × 852, exported unmodified at **375 × 813**, with the complete two-row navigation visible. It is not a top-of-You capture. Other matrix images match their requested dimensions.

One bounded visual correction pass fixed crowded enlarged-text navigation. The subsequent fresh full finish review opened all 29 images and found one label-in-name issue. A semantic correction preserved the complete localized visible prayer-setup label in the accessible name. The final [narrow verdict is **ship — the issue is resolved**](.impeccable/review/four-tabs/finish-review.md); it covers that fix only, with no second broad review or recapture of the matrix. The delivered tab was reloaded and its accessibility tree confirmed the complete label.

The main profile at port 4173 was never replaced with fixtures. At that release it was left on Today with 260 XP, an unclaimed scarf, coffee at 3/5, three completed priorities, planned Asr at 15:50, its saved Fajr plan and return note. Supplementary [Today](screens/four-tabs/saved-today.jpg), [Journey](screens/four-tabs/saved-journey.jpg), [Progress](screens/four-tabs/saved-progress.jpg) and [You](screens/four-tabs/saved-you.jpg) captures are **385 × 753** and outside the matrix. The Today capture was refreshed from the final build. At that release, review tab/server 4174 were closed and port 4173 remained live. The later full-day and difficult-day rehearsals reused port 4174.

The [surface brief](.impeccable/briefs/four-tabs.md) and [documentation check](.impeccable/review/four-tabs/documentation-check.md) record the finish. `DESIGN.md`, `.impeccable/design.json`, original artwork and provenance remain unchanged. The active hook suppressed repeated hints on `balanced.css` and `life.browser.spec.ts` without a new deterministic finding; no separate detector ran. That release’s package refresh followed its documentation pass.

Evidence is local Chromium/in-app-browser testing and the prototype’s explicit `?text=large` mode. It does not certify physical-device, Safari/WebKit, VoiceOver, exhaustive accessibility or real alarm/service behavior. Older-screen language limitations remain.

## Historical You refinement

Verified 20 October 2026, Asia/Tashkent. This preceding refinement simplified You and its settings navigation, retaining the pinned identity, saved profile, domain rules and schema 4.

### You automated results

- Production build passed: `index-Cq5I9pnv.js / index-6Z8sEUZZ.css`.
- **53 domain tests and 40 browser scenarios passed: 93 total.** The final browser run took 17.8 seconds, using isolated Chromium profiles on port 4180. The browser suite includes 11 balanced, 12 Daily life, 4 Today, 4 Progress, 5 Journey and 4 You scenarios.
- New checks verify four visible destinations at 375/393/430 × 852 and 703 × 753; direct Family/Squad selection; keyboard focus restoration and no navigation writes; collection access; prayer/Fajr drafts, pause/resume and reload; disclosed settings, stored preferences and export; habit management; empty groups; Uzbek labels and 200% text without tested horizontal overflow.
- Existing regression tests follow the moved controls and still cover data clearing, group membership, prayer recording, habits, goals and rewards. No tests failed in either full browser run. Domain logic was not changed.

Execution details are in [.impeccable/review/you/verification-notes.md](.impeccable/review/you/verification-notes.md). The review browser and preserved primary profile returned no warnings or errors.

### You evidence and finish

[The manifest](.impeccable/review/you/manifest.json) lists 15 final JPEGs, each decoded at its declared viewport dimensions and byte-identical to the public copy in `screens/you-clarity/`. Coverage: three normal mobile widths, desktop, compact 703 × 753 preview, dark appearance, prayer preferences, collapsed/expanded settings, direct Family and Squads arrival, private pause, empty family setup and Uzbek 200% text with a long name.

One batched inspection led to one Uzbek heading copy correction, followed by the final confirmation matrix. All 15 were displayed and inspected. Enlarged text naturally needs vertical scrolling. The fresh [full finish review](.impeccable/review/you/finish-review.md) inspected all 15 actual captures and returned **ship with no material findings**. The [surface brief](.impeccable/briefs/you-clarity.md) and [documentation check](.impeccable/review/you/documentation-check.md) record the completed finish.

The user’s port 4173 profile was never replaced by review fixtures. At that release it remained at 260 XP, with unclaimed scarf and coffee at 3/5, and was left on You. [The delivery screenshot](screens/you-clarity/saved-profile.jpg) is 385 × 753, measured from the delivered tab, outside the 15-image fixture matrix. At that release, review tab/server 4174 were closed and production preview 4173 remained live.

`DESIGN.md`, `.impeccable/design.json`, original artwork and provenance remain unchanged. The active design hook reported no deterministic issues for the new You component/stylesheet; no separate detector ran. No physical-device, Safari/WebKit, VoiceOver, exhaustive accessibility or real alarm/service behavior is certified. That release’s package followed its documentation pass.

## Historical Journey refinement

Verified 20 October 2026, Asia/Tashkent. This preceding refinement simplified Journey within the pinned RISE identity. Today and Progress behavior, schema 4, domain logic, APIs and the saved user profile are unchanged. Prior Progress, Today and Daily life records remain below as release history.

### Journey automated results

- Production build passed: `index-COjyee5u.js / index-B6EggaiN.css`; at that release, `dist/index.html` referenced this exact pair.
- **53 domain tests passed** — 14 habit, 13 prayer, 19 development and 7 Daily life tests. No domain model changed.
- **36 browser scenarios passed in 18.8 seconds** — 11 balanced, 12 Daily life, 4 Today, 4 Progress and 5 Journey scenarios, using Chromium and isolated port 4180.
- **89 automated checks total.** Journey checks cover one unlock and one personal reward above navigation at 375/393/430 × 852 and 703 × 753; keyboard disclosures without record changes; earned unlock precedence and claim/equip persistence without added XP; earned personal rewards, enjoyment/history and selection; goal conditions and empty creation; long names and enlarged-text trail rows; and a complete Pip collection without an invented next threshold.

Execution results are recorded in [the Journey verification notes](.impeccable/review/journey/verification-notes.md). The finish reviewer and documenter inspected supplied evidence/source without rerunning tests or opening a browser. The implementation owner reported no console warnings or errors in the preserved port-4173 profile.

### Journey evidence and finish

[The Journey manifest](.impeccable/review/journey/manifest.json) identifies **13 final JPEGs**, captured from the final build at `2026-10-20T15:10:25.379584+00:00`. Every image was decoded at its declared dimensions and has a byte-identical public copy in `screens/journey-clarity/`; see [the screenshot guide](screens/README.md). Coverage includes three phone widths, desktop, the 703 × 753 preview, dark appearance, expanded rewards and trail, earned and enjoyed states, empty setup, a long reward name and 200% root text. Disclosure/history detail views are intentionally scrolled.

The first view shows one earned, unclaimed-or-next Pip unlock with matching lifetime habit XP, followed by one personal reward with a named goal or dated fixed-week condition. Earned personal rewards precede the selected or another active reward. **All rewards & history** and **Explore Pip’s trail** remain closed until opened; collection access and full reward management remain available. **Feature on Today & Journey** selects the shared featured reward. At 200% text, the trail becomes a static vertical list. The completed collection has no invented next threshold. Opening disclosures changes no saved records; claim/equip and enjoyment add no XP.

One batched visual inspection, one correction batch and one confirmation matrix completed the implementation pass. The corrections removed the duplicate Pip that overlapped a trail reward label and the redundant percentage in the personal reward button’s accessible name. The fresh **full finish review inspected all 13 actual images and returned ship with no material findings**. See [the finish review](.impeccable/review/journey/finish-review.md), [surface brief](.impeccable/briefs/journey-clarity.md) and [documentation check](.impeccable/review/journey/documentation-check.md).

Fixture walkthroughs used isolated port 4174, preserving the main profile on port 4173. [The supplementary saved-profile capture](screens/journey-clarity/saved-profile.jpg) is 703 × 753 and outside the 13-image matrix; it shows 260 XP, an unclaimed scarf and coffee at 3/5. At that release the main preview remained open on Journey and the isolated review origin was closed. The documenter checked build references, file identity and links without repeating the visual review.

`DESIGN.md` and `.impeccable/design.json` retain their authority hashes; original Pip/trail artwork and provenance remain intact. The existing Impeccable hook is active, found no deterministic findings in the new Journey stylesheet and suppressed repeated source hints; no separate detector ran. These checks do not certify physical-device, Safari/WebKit, VoiceOver, full accessibility or real service/alarm behavior.

## Historical Progress refinement

This preceding release established the earlier Progress overview. Its former Rewards summary is superseded by the current Journey shortcut. Its build, 84-check result and 19-image finish review below belong to that historical release.

### Progress automated results

- Production build passed: `index-DIRhxisW.js / index-ClM5Kqzs.css`; at that release, `dist/index.html` referenced this exact pair.
- **53 domain tests passed** — 14 habit, 13 prayer, 19 development and 7 Daily life tests. No domain model changed.
- **31 browser scenarios passed in 16.6 seconds** — 11 balanced, 12 Daily life, 4 Today and 4 Progress scenarios, using Chromium and isolated port 4180.
- **84 automated checks total.** New checks cover four summaries above navigation at 375/393/430 × 852 and 703 × 753; keyboard disclosures/view navigation and unchanged records; shared-week details versus current goals/rewards and lifetime XP; pause, earned reward and empty setup; and enlarged text without horizontal overflow.

Execution results are recorded in `.impeccable/review/progress/verification-notes.md`. The initial run’s only failure was an invalid fixture identifier in the new test; the corrected focused retry and final full suite passed. The finish reviewer and documenter inspected supplied evidence/source without rerunning tests or opening a browser. The implementation owner reported no console warnings or errors in the review tab.

### Progress evidence and finish

`.impeccable/review/progress/manifest.json` identifies **19 final JPEGs**, captured from the final build at `2026-10-20T14:39:19.219153+00:00`. All match their declared dimensions and have byte-identical copies in `screens/progress-clarity/`; see [the screenshot guide](screens/README.md). Coverage includes three phone widths, desktop, the 703 × 753 preview, expanded summaries, historical week, dedicated views, private pause, empty setup, earned reward, dark appearance and 200% root text.

Four initially closed native summaries introduce Salah, Habits, Goals and Rewards. All four fit above navigation at the reviewed normal phone and actual-preview sizes. One quiet reflection entry follows. The shared week remains; calendars and charts stay in their dedicated views, with secondary and lifetime details disclosed. Goal copy separates selected-week movement from current overall progress. Rewards state current availability and their own conditions. At 200% text the view selector uses two columns; extra vertical scrolling is expected. Declared scrolled captures show their named details.

One implementation correction batch addressed short-height spacing, enlarged-text navigation and empty prayer context before the final confirmation matrix. The fresh **full finish review inspected all 19 captures and returned ship with no material findings**. The report is `.impeccable/review/progress/finish-review.md`; the contract and documentation check are `.impeccable/briefs/progress-clarity.md` and `.impeccable/review/progress/documentation-check.md`.

Fixture walkthroughs used isolated port 4174, preserving the main saved profile on port 4173. `screens/progress-clarity/saved-profile.jpg` is supplementary and outside the 19-capture matrix. At that release, the main preview remained open and the isolated capture server was closed. The documenter checked build references, dimensions and public-copy identity without repeating the visual review.

DESIGN.md and `.impeccable/design.json` retain their authority hashes; original Pip/trail assets and provenance remain intact. The existing hook was active and suppressed repeated hints on `Prayers.tsx`; no separate detector ran. These checks do not certify physical-device, Safari/WebKit, VoiceOver, full accessibility or real service/alarm behavior.

## Historical Today refinement

This preceding release established the retained Today behavior. Its build, 80-check result and narrow F1/F2 review below belong to that release, not the current Russian matrix.

### Today automated results

- Production build passed: `index-YrJDMdMO.js / index-BNJQMM-t.css`.
- **53 domain tests passed** — 14 habit, 13 prayer, 19 development and 7 Daily life tests. Domain source remained unchanged through the final corrections.
- **27 browser scenarios passed** — 11 balanced, 12 Daily life and 4 Today scenarios, against the final production build in Chromium on isolated port 4180. The final run passed in 16.9 seconds after the reviewer corrections.
- **80 automated checks total.** The four Today scenarios cover keyboard disclosures and completion/reload; compact full/tiny/upgrade/Undo and stable priorities; a twelve-habit routine at 375/393/430 with 200% text; and a milestone preceding an unfinished habit, with readable controls and no milestone XP.

These are the implementation owner’s execution results in `.impeccable/review/today/verification-notes.md`. The finish reviewer and documenter inspected source and evidence without rerunning tests or opening a browser. No browser-console errors were reported.

### Today evidence

`.impeccable/review/today/manifest.json` identifies **19 final JPEGs**, captured from build `index-YrJDMdMO.js / index-BNJQMM-t.css` at `2026-10-20T14:16:57.981407+00:00`. All have byte-identical copies in `screens/today-clarity/`; see [the screenshot guide](screens/README.md).

Coverage includes 375/393/430 × 852, desktop 1440 × 1000, the actual 703 × 753 user viewport, collapsed/open routine-family-goals sections, twelve-habit routine, due prayer, private pause, evening Fajr, empty/completed priorities, dark appearance, 200% root text at top and lower sections, and mixed milestone/habit priorities. All 19 exports match their recorded viewport dimensions. The lower-section captures intentionally begin partway down the scrolling panel.

Prayer context leads into the priorities. The first unfinished habit stays expanded even after a milestone/task; completed selections remain complete. Quiet reward rows follow the priorities, and My routine, Family and Your goals open inline. Rewards are no longer required to fit before the priorities or in the first viewport. A due prayer has primary emphasis. The single Fajr entry rises below prayers from Maghrib, an active prayer break stays prominent, and a completed return note is lower.

Fixtures and captures used isolated port 4174. The implementation owner reports that the user’s port-4173 profile retained all saved changes and was reopened on Today; the temporary capture server was stopped. Native disclosure behavior and visible-focus styles are present in source. The documenter opened eight representative final captures and checked all 19 screenshot copies for identity; this was documentation validation, not another broad visual audit.

### Today finish and documentation

The fresh finish review initially found F1, compact milestone width overridden by a legacy rule, and F2, a non-habit priority preventing the first unfinished habit from expanding. One batch corrected both and added the mixed-priority regression. The full capture matrix was refreshed and the mixed-priority scene added. The final **narrow verdict is ship — F1/F2 resolved**, based on corrected source/test and the final mixed-priority image. The reviewer did not repeat a broad cosmetic review of the refreshed matrix.

The brief is `.impeccable/briefs/today-clarity.md`; its reports are `.impeccable/review/today/finish-review.md` and `documentation-check.md`. DESIGN.md and `.impeccable/design.json` retain their authority bytes/hashes, and original Pip/trail artwork and prompt sidecars remain. No new visual world or raster artwork was introduced. The hook remained active with no outstanding new findings; repeated hints on Development.tsx were suppressed and no second detector ran.

All prototype boundaries remain: authored prayer times, local alarm/readiness/reminder and membership simulations, no real notification permission/delivery, external messages, server or cloud sync. The evidence does not establish production readiness, physical-device, Safari/WebKit, VoiceOver or full accessibility certification.

## Historical Daily life record

The following is the earlier Daily life release record, including its 53/23 results, 18 captures and separate accessible-name F1. Its former first-viewport ordering is historical. The later Today findings F1/F2 above belong to a separate review.

Verified 20 October 2026, Asia/Tashkent. The labelled demo calendar remains frozen at 19 October. Tests and captures use synthetic fixtures and isolated profiles. This record distinguishes the build thread’s execution results from the independent review and documentation checks.

### Automated results

- `npm run build`: TypeScript and Vite production build passed.
- `npm test`: **53 passed** — 14 habit, 13 prayer, 19 development and 7 Daily life domain tests.
- `npm run test:browser`: **23 passed** — 11 retained balanced-day scenarios and 12 Daily life scenarios, against the production build in Chromium on port 4180.

These final results passed together after the accessible-name correction. No product source changes followed those runs. The finish reviewer and documenter inspected evidence/source without repeating the suites. The execution record is `.impeccable/review/life/verification-notes.md`.

#### Domain coverage

The retained 46 tests cover original fixture accounting; full/tiny/upgrade/Undo; cosmetics; rest and missed days; next-date edits; historical denominators/archives; timers; prayer windows/statuses/future guards and unresolved gaps; overnight Isha; timetable validation and recorded snapshots; Fajr preparation; work-break persistence; timezone/demo separation; v1/v2 migration; unlimited habits; stable priorities; goal corrections/pause/archive; weekly calculations; and reward eligibility, correction and separate retry attempts.

The seven new tests cover lossless schema 3 → 4 migration/idempotence with empty new activity collections; pause holding streaks without records/misses/XP; preserved recorded prayers and explicit resume semantics; earlier unresolved gaps and paused overnight Isha; repeated dated task completion/Undo and independence from habit counts/XP; authored city setup with preserved recorded snapshots and preview wake times; and empty personal groups with an owner-only new group.

#### Browser coverage

The 11 retained scenarios cover Today hierarchy; persisted priorities without replenishment; full/tiny/upgrade/Undo across tabs; shared weeks; goal/reward flows; drafts while a prayer becomes due; history correction; reward retries; a thirteenth habit; same-key migration; export and clearing.

The 12 Daily life scenarios cover:

1. City/source setup, reminder preferences, nested drafts and reload.
2. Fajr stop, backup and acknowledgment without prayer logging.
3. Pause/resume on Today and Progress without changing habits.
4. Task drafts, assignment, repetition, pinning, completion and Undo without XP.
5. List creation, item editing/reordering/checking and persistence.
6. Explicit squad snapshots, optional fields, reactions, edit/republish and withdrawal.
7. Invitation simulation, member controls, settings/archive and language persistence.
8. Readiness examples, empty entry points and modal keyboard focus without device permissions.
9. 375/393/430 widths at 200% root text, prayer-strip reflow, no tested Today-panel horizontal overflow and persistent simulation labels.
10. Task assignment/schedule edits, archive/restore retaining history, and list uncheck.
11. Owner transfer enabling leave, hidden shared content and retained personal progress.
12. English/Uzbek accessible names, including optional prayer sharing.

The final scenario resolves F1 through UI interactions and role/name assertions for five prayer offsets, ten reminder switches, readiness, seven repeat-day buttons, list reorder, group name/notifications/member removal/ownership, all three sharing switches and shared navigation. Screenshot pixels alone cannot prove an accessible name.

### Daily life visual evidence (historical)

`.impeccable/review/life/manifest.json` identifies **18 required captures**, refreshed after the correction using the Codex in-app browser. Each has a matching JPEG in `screens/`.

| Evidence | Coverage |
| --- | --- |
| `daily-life-375.jpg`, `daily-life-393.jpg`, `daily-life-430.jpg` | Today at 375/393/430 × 852, both reward cues and a complete first priority above navigation. |
| `daily-life-desktop.jpg`, `daily-life-dark-393.jpg` | Desktop 1440 × 1000 and dark phone appearance. |
| `large-text-today.jpg`, `large-text-family.jpg` | 393 × 852 with review-only 200% root text. |
| `prayer-setup.jpg`, `family-planning.jpg`, `shared-list.jpg`, `invitation-preview.jpg` | Source disclosure, family planning, lists and local invitation simulation. |
| `fajr-alarm.jpg`, `alarm-readiness.jpg` | Wake-up and waiting-device simulations in dark appearance. |
| `prayer-pause-today.jpg`, `prayer-pause-progress.jpg` | Private pause and excluded counts in dark appearance. |
| `squad-share-preview.jpg` | Chosen snapshot with explicit local publish. |
| `uzbek-people.jpg`, `uzbek-family.jpg` | Uzbek new-flow labels with authored content retained. |

Fajr alarm/readiness had a confirmed DOM viewport of 393 × 852; the screenshot API exported original JPEGs at **389 × 843 pixels**. The manifest records this distinction. No resizing or image editing was applied. Other viewport/appearance details are in the manifest.

The reviewer and documenter opened all 18 final images. They show valid named states, readable wrapping, incumbent composition and visible simulation labels. This is bounded visual inspection, not full contrast/accessibility certification. Additional JPEG walkthrough captures in `screens/` are supplementary, outside the 18-image review matrix.

### Finish review and documentation

The independent finish review first returned **fix** for one P2 finding, F1: English-only accessible names on new Uzbek controls. One bounded batch applied the existing translation helper to those names and shared navigation, added a bilingual scenario, and refreshed all 18 captures.

The final narrow verdict is **ship — F1 resolved**, in `.impeccable/review/life/finish-review.md`. It covers F1 and refreshed evidence validity, not a new whole-surface audit. No review correction remains.

`.impeccable/review/life/documentation-check.md` compares final source/captures against the direction contract and incumbent authority. `DESIGN.md` and `.impeccable/design.json` retain their original bytes/hashes. Pip/trail assets and provenance remain. No new design world, approved image comp or generated raster was introduced.

The active hook reported no deterministic findings; later hints on frequently edited files were suppressed. This is not blanket design/accessibility certification.

### Historical evidence

The balanced-day release passed 46 domain tests and 11 browser scenarios and received its own ship verdict. Its 32 confirmation captures, layout reports and documentation check remain in `.impeccable/review/balanced/`. Earlier Salah and original prototype evidence also remains.

`balanced-flow.jpg`, `salah-flow.jpg`, `screen-gallery.jpg`, `screens/balanced-*` and older PNGs are historical, not current-release captures. Some older galleries show retired Plus screens. Original reports and provenance are preserved.

### Limits

Automated checks use Chromium and pure domain tests. No physical-device, Safari/WebKit, VoiceOver, exhaustive WCAG audit, real permission/native-alarm/push delivery, external invitation/message, live timetable or backend behavior is certified.

English/Uzbek coverage is shared navigation and new Daily life controls. Older screens can remain English; authored content is not translated. The city options are Tashkent, Samarkand and Bukhara, using authored illustrative times in Asia/Tashkent. Readiness states are examples rather than measured status.

LocalStorage contains the full private state, including pause ranges and drafts. Structured squad snapshots omit those fields and include only chosen content; this is not production authentication or multi-user authorization. The personal backup outside the app root is excluded from the ZIP.


## 21 October 2026 — real prayer times and notification delivery

The web production build and Capacitor sync succeeded for the iPhone and Android projects. All 71 domain tests and 69 Chromium browser scenarios passed (140 total; browser suite 39.6 seconds). The executing-browser Fajr test waits for application/permission readiness before advancing its virtual clock. It confirms one wake alert and suppression of the backup after acknowledgment, without recording a prayer. A final targeted check also verifies the real wake dialog title and the retained preview's independent behavior.

The independent Impeccable review requested two fixes: obsolete simulation-only PRODUCT.md claims and a blocked-permission primary action that repeated the permission request. Both were corrected. Its final disposition was **ship for those two scored fixes**, with no visible regression in the correction batch; this was not a new whole-surface review. The documenter updated PRODUCT.md and recorded evidence in `.impeccable/review/prayer-live-documentation.md`, preserving DESIGN.md and its sidecar.

Native scope is source/configuration plus successful sync, not a compiled or installed phone app. Full Xcode, Java and Android SDK tooling are absent here. IPA/APK compilation, signing, native rendering, locked/background/killed-app delivery and physical-device checks remain unverified. Fajr uses scheduled notifications, with no AlarmKit, critical alerts, full-screen Android alarm service, or promise of sound through silent/Focus modes. Browser reminders require an executing, awake page. README.md documents setup, the 60-event queue/refresh limit and device checks.


## 21 October 2026 — production foundations FND-01 and FND-02

The [foundation evidence report](docs/evidence/foundations-2026-10-21/README.md), [verification record](docs/evidence/foundations-2026-10-21/verification.json) and [visual manifest](docs/evidence/foundations-2026-10-21/visual-manifest.json) record the new baseline. `npm ci` and `npm run check` passed with 72 tests (71 existing domain tests and one isolated test-server regression), lint, application/test/configuration types and a production build. The existing bundle-size warning remains.

The behavioral suite passed all 207 cases: 69 each in Chromium, WebKit and Firefox. The visual suite passed 48 combinations covering 720 exact screenshot comparisons in English/Russian/Uzbek, light/dark, 100%/200% text and four widths. No golden image was changed during comparison. The original design authority, CSS and artwork hashes are unchanged.

Extending browser coverage found a real WebKit keyboard-focus escape; Sheet now cycles visible enabled targets in both directions. A Firefox geometry assertion accepts only measured subpixel rounding. Separate output directories and temporary build copies prevent evidence/server races. The report retains the original failures and the subsequent passing results.

Tests use fresh contexts on isolated loopback ports and block external requests. The existing personal profile on port 4173 was not seeded or reset. Exact Node/npm/dependency pins and a read-only GitHub Actions browser matrix are configured locally; hosted CI has not run because this folder has no Git remote. This batch does not certify physical phones, production persistence, accounts, remote push, real collaboration or deployment.


## 21 October 2026 — validated commands and production entry

FND-04 and WEB-01 are recorded in the [command/entry evidence](docs/evidence/commands-entry-2026-10-21/README.md) and [verification JSON](docs/evidence/commands-entry-2026-10-21/verification.json). `npm run check` passed with 81 domain/tooling tests, lint/types and both build variants. The existing journey suite passed 207 cases, production-entry coverage passed 21 cases, and 720 strict screenshot comparisons passed across 48 variants. CSS, artwork and design-authority hashes remain unchanged.

Production first use is empty and follows the real calendar. A separate loopback review build retains the original fixtures and design tools; queries cannot enable them in production. Browser coverage confirms onboarding, tiny/full/Undo/reload, legacy versions 1–4 and preservation of unreadable source data for recovery. Production migration does not create prayer accomplishments in a habit-only legacy profile.

Validated record commands and a transaction/replay/revision contract now exist, with a tested non-durable memory adapter and the Today check-in wired through the command boundary. Existing form/draft paths and localStorage persistence remain pending DATA-01/DATA-03. Full stored-state validation, provenance migration, restore and real IndexedDB failure/multi-tab acceptance are not claimed by this batch. Hosted CI, physical devices, backend/auth/sync, PWA, remote push, real collaboration and deployment remain unverified. The personal preview/profile on port 4173 was not used for tests.

## 21 October 2026 — DATA-01 durable storage and safe migration

RISE now uses the real IndexedDB adapter for its personal profile. Legacy schema versions 1–4 retain their exact original source and authored data, with worker validation, atomic candidate installation and separate readback verification. State changes and local operation receipts commit together. Conflicts, invalid data, quota failures and unsupported versions expose recovery without silently resetting or overwriting the previous committed profile.

`npm run check` passed: pinned toolchain, lint, app/tooling types, 88 domain/migration/tooling tests and both builds. The full browser suite passed 234 cases in Chromium/WebKit/Firefox. After the final startup/invalid-edit/refresh guards, the focused real-storage suite passed all 33 cases and production-entry suite passed all 24 cases in those engines. The frozen visual suite passed 48 variants and 720 exact screenshot comparisons; no golden was updated. Recovery reflow was checked at 320/375/393/430 px with 200% text. Quota/abort failures were injected into real browser transactions; this is not physical disk-exhaustion or iPhone certification.

The original localStorage document remains the recovery source; ongoing changes use IndexedDB. Settings → Your data shows the migration summary and save status. All records remain local and cloud-ineligible. DATA-02 restore, DATA-03 individual command wiring, PWA packaging, accounts/sync and deployment are not marked complete. Tests used isolated synthetic origins, without accessing the saved 4173 profile. See the [dated evidence and recovery instructions](docs/evidence/storage-2026-10-21/README.md) for exact build/source hashes, cases and limitations.


## 21 October 2026 — DATA-02 validated backup and restore

Implemented known-field versioned private exports, strict UTF-8/JSON worker validation with cancel, previewed full replacement, read-only local collaboration archives and atomic pre-import recovery/rollback. Repository format 2 guards older-client compatibility; database version 1/domain schema 4 remain. The exact legacy source is retained until explicit clear. Personal dates, XP, corrections, plans and supported drafts round-trip; portable imports cannot create real membership or inherit device delivery permissions.

`npm run check` passed with 97 unit/domain/tooling tests, lint/types and both builds. The final complete browser suite passed all 276 cases in Chromium/WebKit/Firefox, including 36 backup cases; production passed all 27. The visual suite passed 48 variants/720 exact image comparisons, with no golden updates. New restore/recovery states were checked in three languages, both appearances, 320/375/393/430 px and 200% text. The two-year/100-habit test preserves all 73,100 check-ins through real IndexedDB restoration.

Initial failures identified historical habit-version fields, a nested-disclosure test selector, checkbox reflow and older test helpers navigating before save acknowledgment. These were corrected and the complete suites rerun; no product assertion was weakened. Quota/abort/readback faults use actual browser transactions, not physical disk-exhaustion evidence. All fixtures were isolated from the personal 4173 profile. Accounts, server authorization/deletion replay, sync, PWA delivery and deployment remain separate work. See the [full report, hashes, screenshots and limitations](docs/evidence/backup-2026-10-21/README.md) and [backup/restore guide](docs/BACKUP-RESTORE.md).


## 21 October 2026 — DATA-03 durable personal commands

Personal actions now use runtime-validated local commands with stable operation/entity IDs and captured action dates, timezones and instants. The profile and receipt commit together; retry does not duplicate records or move their dates. Timer completion and its explicit check-in are atomic. New/edit habit, goal, reward, priority, reflection and onboarding drafts survive navigation/reload, alongside the existing saved prayer/shared drafts and work notes. Progress, XP, history, fixed-week rewards and explicit prayer/Fajr semantics remain. Success toasts, explicit form confirmations and delivery rescheduling wait for a saved session.

The final `npm run check` passed 104 unit/domain/tooling cases, lint/types and both builds. All 297 browser journeys and 27 production checks passed in Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0, with no skipped/flaky cases. The final project-folder visual run matched all 720 screenshots across 48 variants exactly; no golden changed. CSS, artwork, design authority and dependencies are unchanged. Database version 1, repository formats 1/2 and domain schema 4 remain compatible; newer command receipts require compatible application assets on rollback.

Failure tests use real IndexedDB transactions and cover queued retry, lost commit response, conflicting sessions, exact legacy retention, draft reload and timer recovery. An initial goal-save failure caused by undefined optional dates was corrected and the unchanged browser scenarios rerun. No physical-device, cloud-sync, PWA/background-delivery or deployment claim is made. The personal 4173 profile was not accessed. Local collaboration simulations/review retain their compatibility setter. See the [DATA-03 report](docs/evidence/personal-commands-2026-10-21/README.md) and [machine-readable verification](docs/evidence/personal-commands-2026-10-21/verification.json), including the earlier temporary verification workspace used during iCloud offloading and final project-folder runs with source/build hashes.


## 21 October 2026 — PRAY-01 timetable, travel and manual dates

PRD-09 verification now covers 403 pinned Adhan reference dates (2,418 solar-time comparisons), all offered settings, DST/fractional/date-line cases, launch-region offsets, five host zones, rolling 30-date coverage and unavailable solar events. Manual saves own one date/zone, clear calculation keys and rebuild unchecked UTC windows. Checked/manual snapshots and original recovery sources remain. Travel prompts explicit review; live status/recording uses actual instants. Ambiguous legacy clock-only differences remain saved and await manual review, retaining unresolved streak gaps.

`npm run check` passed **126 unit/tooling tests** and both builds. The broad three-engine suite passed **342 journeys**. After the final legacy-review phase/detail guard, **75 focused prayer/delivery browser checks**, **39 production-entry checks** and **720 exact visual comparisons** passed on the completed build, with zero failed/skipped/flaky browser cases or regenerated references. A scoped manual-form reflow correction fixes large Russian text at 320 px. Existing design authorities/artwork remain unchanged. [Evidence, versions, source/build hashes and precise run scope](docs/evidence/prayer-timetable-2026-10-21/README.md).

The main 4173 profile was not used for fixtures or verification. No database/repository/domain/backup format or dependency version changed. This is local browser/calendar evidence, not physical-device, remote-push, offline-cold-start or complete product-release certification. PRAY-02 remains the next task.


## 21 October 2026 — PRAY-02 records, private pause and dated Fajr

PRD-10–12 local behavior is hardened: saved UTC windows govern streaks and wake clocks; explicit reports remain correctable after a backward clock change; an invalid resume cannot erase a pause; new dated Fajr saves retain independent backup choices and unfinished draft dates; real-profile preview stages cannot alter live acknowledgment. Overnight work expiry retains its note/date and rejected recording cannot complete the break. Prayer/pause/wake actions never grant habit XP or auto-record prayer. Existing data and schema versions remain.

`npm run check` passed **137 unit/tooling tests**, lint/types and both builds. The focused prayer suite passed **36 checks** across Chromium/WebKit/Firefox. The broad run passed **375 journeys**; the same dated-draft scenario in three engines still expected the old date-rebinding behavior. Its expectation now retains the original date and all **3 targeted rechecks passed**, for **378 verified unique journey cases** on the unchanged application/build. Final test types/lint passed after that assertion update. Production checks passed **39**. Visual verification covers **48 variants / 720 exact comparisons**, with 47 passing in the matrix and one unchanged-build repeat passing after a capture timeout. No references were regenerated.

The scoped reflow fix retains the frozen design and handles actual 200% text at 320 px. Supplemental before-midnight Fajr acknowledgment confirms the following morning's date is canceled while later dates, prayer history and XP remain separate. The personal 4173 profile was not accessed. This remains local mobile web evidence; cloud sync, remote cancellation, background push, PWA lifecycle and physical-device certification are separate release tasks. [Report, source/build manifests, original failures and final scopes](docs/evidence/prayer-records-2026-10-21/README.md). Next: WEB-02.


## WEB-02 — PWA implementation, 21 October 2026

Local install/offline/update implementation is complete and recorded as REVIEW pending physical iPhone/Android acceptance on the HTTPS release host. Final checks pass 146 unit/tooling cases, 42 real-worker PWA cases, 39 production cases and 720 zero-difference visual comparisons. The earlier complete 378-case journey regression is followed by six focused notification/Settings confirmations after the final worker/support-state batch; counts and exact scope are documented in the [WEB-02 evidence](docs/evidence/pwa-2026-10-21/README.md). No persistence schema, original public art, design tokens or frozen visual reference changed. See the [PWA/device procedure](docs/PWA.md).

Latest local queue/retention evidence: [PUSH-02/PUSH-03, 23 October 2026](docs/evidence/push-retention-2026-10-23/README.md). Hosted and physical-device gates remain open.

## GROUP-01 local backend increment — 23 October 2026

The membership/invitation/ownership API and account-suppression hooks now have local evidence: 219 unit/tooling tests, 105 database integration tests, 12 lifecycle browser checks across Chromium/WebKit/Firefox and clean local/test advisors. GROUP-01 remains IN PROGRESS for real browser integration; no real shared-task/squad UI or hosted release is claimed. [Exact scope, commands, source preservation and recovery](docs/evidence/group-membership-2026-10-23/README.md).

## GROUP-01 local browser integration — 23 October 2026

Real group creation, explicit invitation/nickname consent, member/owner controls, recent-auth deletion and durable retry recovery now connect to the local/test backend. Invitation secrets stay transient; non-secret pending intent uses the existing account store and participates in logout/session-only safeguards. Stale forms retain their edits for explicit review. Group headers handle enlarged text and nested sheets restore focus. A real-worker logout regression also fixes subscription lookup when notification permission was never granted.

Final checks pass 227 unit/tooling cases and both builds, 12 database/BFF cases, 27 group browser cases, 54 push cases and 33 account sync/lifecycle cases across Chromium, WebKit and Firefox. Group layouts cover 1,440 states with 48 synthetic captures. The earlier same-increment navigation (21), production (54), PWA (42) and 720 exact visual comparisons have their precise pre-final-fix scopes recorded in [the report](docs/evidence/group-ui-2026-10-23/README.md). No golden, original artwork, personal domain/persistence source, migration or dependency lock changed. The personal 4173 profile was not used.

GROUP-01 is now REVIEW for hosted acceptance; its local contract is available to GROUP-02/03. Shared tasks/lists, squad snapshots, group notifications and full content lifecycle remain unfinished. Cloud provisioning and physical-device acceptance stay pending; this is not complete-product release certification.


## GROUP-02 local family browser acceptance — 23 October 2026

Account-selected task/list controls, dated completion/Undo, private priority replacement, durable conflict recovery and complete-page loading states now use the real local/test membership API. The account session also serializes local saves with sync acknowledgments/pulls, preserving original operation identity and genuine stale-write recovery. No schema, dependency, server implementation, original artwork or visual golden changed.

Final checks: **247 unit/tooling tests**, **54 group browser cases** and **69 account sync/recovery/lifecycle cases** passed. The group matrix covers **3,060 layout states** across three languages, both appearances, 320/375/393/430/1440 px and 100/200% text; **55 safe captures** are recorded. Earlier scoped checks in this increment passed 27 journey/navigation cases, 24 production-entry cases and 48 visual scenarios/720 unchanged frozen comparisons. Their earlier build scope is distinguished from the final account/pagination checks.

[The report](docs/evidence/shared-content-ui-2026-10-23/README.md), [verification manifest](docs/evidence/shared-content-ui-2026-10-23/verification.json), [visual manifest](docs/evidence/shared-content-ui-2026-10-23/visual-manifest.json) and [preservation audit](docs/evidence/shared-content-ui-2026-10-23/preservation.json) retain exact commands, dates, browsers, fixes and limits. GROUP-02 is in REVIEW for hosted acceptance. GROUP-03–05, quality/operations/release work and physical-device acceptance remain open; cloud provisioning stays pending. The wider goal is active.


## GROUP-03 exact squad snapshot acceptance — 24 October 2026

Account-selected squad previews, explicit publication, author edits, encouragement, withdrawal and owner removal now use the real local/test backend. The stored payload exactly matches the reviewed private preview and does not change after later personal edits. Membership, author permissions, forced RLS, durable retry/conflict recovery and populated account suppression/backup-replay erasure have local evidence. Two additive migrations preserve earlier schema history; the second fixes group cascade ordering without weakening final member references.

Final checks pass **256 unit/tooling**, **139 database/BFF**, **81 group browser**, **69 account sync/recovery/lifecycle** and **27 navigation cases**, plus **48 visual scenarios / 720 unchanged frozen comparisons**. Production entry verifies **24 unique cases** across an initial 23-pass/one-Firefox-save-timeout run and a passing unchanged-build focused rerun. Both local/test advisors report no issues. Group reflow totals **4,680 states**; **54 new safe captures** record squad states in three languages, both appearances and enlarged text. No CSS, artwork, dependency, prior migration, cache format or visual golden changed; the personal 4173 profile was not accessed.

[The report](docs/evidence/squad-snapshots-2026-10-24/README.md) records exact commands, browser versions, source/build/log hashes, original failures and recovery limits. GROUP-03 is in REVIEW for hosted acceptance. GROUP-04/05, quality/operations/release and physical-device gates remain open. Cloud provisioning stays pending by the user's direction; the wider goal remains active.


## GROUP-04 optional notification acceptance — 24 October 2026

Default-off group opt-in and independent device consent now connect task assignment edits and explicit squad publications to bounded generic delivery. Mandatory group quiet hours, current membership/source/session checks, cancellation and recipient/source deletion suppression use the existing isolated sender and occurrence ledger. Two additive migrations preserve applied history. The new device sheet reuses existing controls with a scoped flexible header at enlarged text sizes.

Final checks pass **263 unit/tooling**, **156 database/BFF**, **93 group browser**, **54 push**, **69 sync**, **42 PWA**, **54 production** and **378 existing-app browser cases**. The frozen visual suite passes **48 cases / 720 unchanged comparisons**. Group layouts cover **5,940 states** across three languages, two appearances, five widths and two text scales in three engines; **45 new safe captures** plus the equivalent pre-fix header image are recorded. Both retained installations apply both migrations and report no advisor issues. Guest/account cache and backup formats, artwork, dependencies, old migrations and historical evidence remain unchanged; the saved 4173 profile was not accessed.

[The evidence](docs/evidence/group-notifications-2026-10-24/README.md) preserves exact commands, browsers, hashes, suppression/layout failures and their fixes, synthetic fixture cleanup and the local duplicate-migration-file recovery. GROUP-04 is in REVIEW for hosted/device acceptance. GROUP-05 proceeds with explicit authorized shared export and integrated deletion/cache/restore checks. Cloud provisioning remains pending by user direction; physical delivery and the wider goal remain open.

## 24 October 2026 — GROUP-05 local shared export and integrated lifecycle

[The dated acceptance report](docs/evidence/group-lifecycle-2026-10-24/README.md) records the shared archive, real database authorization/deletion/backup replay and three-engine browser/cache checks. Private export/cache formats, saved profiles, original assets, applied migrations, earlier evidence and frozen visual references are preserved. Initial oversized-query and sensitivity-label failures and their verified fixes are retained in the report. GROUP-05 is locally verified and remains REVIEW for hosted operation/device acceptance; this is not a complete-release verdict.


## 24 October 2026 — QUALITY-01 localization and parity acceptance

The older Uzbek interface now has a complete audited catalog, localized calendar labels, measurements, errors, accessible names and recovery summaries. Authored text and complete saved journeys survive language changes; tiny/full/Undo and non-habit XP invariants remain. Capability copy distinguishes preferences from device consent. A narrow-screen family control wraps at 320 px/200% text.

Final source checks pass **272 unit/tooling tests**, lint/types and both builds. The full browser run passes **382/390**, with the six obsolete translated-label assertions and two Firefox timeouts resolved by **60 passing affected journeys** and **two passing targeted reruns**. Production passes **54 cases**. Group/recovery layout checks pass **nine cases each**, covering **1,620/162 states**. **900 captures** pass bounds checks; **480 English/Russian and 34 Uzbek references remain identical**, with **206 reviewed Uzbek updates** and all originals preserved by hash. Normal visual verification passes 46 cases plus two targeted timeout reruns; no image mismatch remains.

[The report](docs/evidence/localization-2026-10-24/README.md) records exact build scopes, commands, browser versions, initial test/audit errors and their resolutions. QUALITY-01 is DONE for its local language/parity scope. Physical accessibility/mobile acceptance is QUALITY-02, and the wider goal remains active. Original artwork, dependencies, migrations, historical evidence and the saved 4173 profile are preserved. Cloud provisioning remains pending.


## 24 October 2026 — QUALITY-02 local accessibility acceptance

Priority, weekday and original-recovery download targets, enlarged habit columns, wrapping sheet titles, closed-disclosure keyboard order, short-viewport focused-field visibility and WebKit clicked-opener restoration now pass local checks. The four tabs, original artwork, domain behavior, data formats and exact legacy recovery payload remain intact.

The final sequential source gate passes **272 unit/tooling tests**, lint/types and both builds. Three-engine checks pass **39 focused accessibility cases**, **51 existing navigation/language journeys**, **21 account cases**, **21 real shared-content/membership cases** and **54 production cases**. Final capture and normal visual runs each pass **48 cases / 720 images**. **676 references remain identical; 44 inspected enlarged-text header updates have hash-verified originals.** The earlier 27-case group layout run covers 6,480 states on its recorded layout build.

[Evidence](docs/evidence/accessibility-2026-10-24/README.md) records exact commands/build scopes, initial failures and resolution, and retained source/reference hashes. One renewal-test timeout passes in isolation and then in the sequential 272-case run without changing its source/deadline; an unavailable Docker socket interrupted account startup before tests and was resolved using the existing local runtime. No data reset or policy weakening was used.

QUALITY-02 is REVIEW for the pending [physical acceptance matrix](docs/MOBILE-ACCESSIBILITY.md), not a WCAG or device certification. Cloud provisioning remains pending, and the wider goal continues with performance/resilience, security and operations work. The 4173 saved profile was not accessed.

## 24 October 2026 — QUALITY-03 performance increment 1

Account reconstruction, bounded JSON validation and pure check-in avoid repeated work without changing persisted formats or the interface. On a synthetic 100-habit/two-year profile, Node hydration falls from 425.4 to 57.5 ms and parsing from 230.9 to 76.0 ms; Chromium's durable check median falls from 691.9 to 399.6 ms. These three-sample desktop measurements remain above the 250 ms durable target and are not physical-device or p95 acceptance.

Final application checks pass 277 unit/tooling tests, three dense-profile browser cases, 16 real database cases, 54 storage/recovery journeys and 48 visual cases / 720 unchanged comparisons. The initial Firefox fixture-transfer timeout is preserved; JSON text transport fixes the benchmark boundary without changing application code or the deadline. [The report](docs/evidence/performance-2026-10-24/README.md) records exact commands, source/build scopes, browser versions, samples, failures and preservation. QUALITY-03 stays IN PROGRESS. Cloud and physical acceptance remain pending, and the saved 4173 profile was not accessed.

## 24 October 2026 — QUALITY-03 performance increment 2

Trusted schema field lists and short-string/ID validation avoid repeated allocations while retaining Unicode limits and malformed-input rejection. The final source gate passes **279 cases**, with **3 dense-profile browser**, **54 storage/recovery** and **16 real database cases** passing. Median durable check-in is now **335.6/393/667 ms** in Chromium/WebKit/Firefox. These remain above the target; no p95 or physical acceptance is claimed. [Exact evidence and preservation](docs/evidence/performance-2026-10-24/increment-02/verification.json) and [measured limitations](docs/evidence/performance-2026-10-24/README.md) keep QUALITY-03 IN PROGRESS. All 720 visual references, CSS, artwork, saved formats and historical evidence remain unchanged; the visual run itself retains increment 1's build scope.

## 24 October 2026 — QUALITY-03 performance increment 3

The local repository transfers its adapter's detached state without a second full-history copy. Source and real IndexedDB tests preserve callback/read/result/replay isolation and durable history. Checks pass **280 unit/tooling**, **6 large-profile**, **57 storage/recovery**, **3 production feedback** and **54 production-entry cases**. [The increment report](docs/evidence/performance-2026-10-24/increment-03/README.md) records exact commands, before/after phases, source/build hashes and the initial review-build probe failure corrected by production isolation.

Durable check medians are **300.6/346/608 ms** in Chromium/WebKit/Firefox; production DOM completion samples are **146.6/136/239 ms**. Neither target is met, and these samples do not establish p95 or physical paint/INP acceptance. Formats, UI, CSS, artwork, frozen references and the saved 4173 profile remain intact. QUALITY-03 stays IN PROGRESS; cloud provisioning remains pending.

## 24 October 2026 — QUALITY-03 performance increment 4

Group management/editing screens load on demand while Today rows remain eager. The initial production entry is **96,228 bytes smaller (7.5%)**. The complete worker shell still precaches all public screens; the split adds a small overall code overhead and does not establish mobile Web Vitals. Existing screen bodies, CSS bytes, saved formats, artwork and all frozen references remain unchanged. Localized loading/error/retry and close-during-load focus use the existing sheet.

Final checks pass **280 unit/tooling**, **66 production**, **45 real-worker PWA**, **48 local family/squad/You journeys**, **108 account-backed group cases** and **48 visual cases / 720 comparisons**. [The evidence](docs/evidence/performance-2026-10-24/increment-04/README.md) records exact builds, commands, extraction checks, download/offline recovery, initial stylesheet/probe corrections and the protected-file audit. Types/lint also pass with the final tests. No visual reference was regenerated and the saved 4173 profile was not accessed. QUALITY-03 remains IN PROGRESS for outstanding latency, capacity/resilience and hosted/physical acceptance; cloud provisioning stays pending.

## 24 October 2026 — QUALITY-03 performance increment 5

Freshly parsed JSON avoids redundant descriptor inspection while arbitrary object inputs keep full accessor checks. Command preparation reuses its validated serialized result for no-op comparison. Exact UTF-8/depth/record limits, unsafe-key rejection, unknown safe extensions, zero additional no-op receipts/revisions and original recovery data are verified. No UI, CSS, asset, dependency, migration or saved-format changes.

Checks pass **282 unit/tooling**, **6 dense-profile**, **3 production feedback**, **105 storage/backup/recovery**, **21 real database**, **15 export/deletion browser**, **66 production** and **45 real-worker PWA cases**. Completed DOM samples improve to **128.3/119/192 ms** in Chromium/WebKit/Firefox, but all remain above 100 ms. Durable medians remain above 250 ms; some Undo/draft measurements worsen and are retained. [Full evidence](docs/evidence/performance-2026-10-24/increment-05/README.md) records before/after samples, exact commands/builds, the report-copy path correction and preservation. Prior visual results retain increment 4's build scope. QUALITY-03 remains IN PROGRESS; cloud provisioning remains pending and the 4173 profile was not accessed.

## 24 October 2026 — QUALITY-03 account capacity baseline

The fixed-test 100-account workload retains 100 habits × 730 dates per account (7.3 million occurrences). Its full/Undo bursts fail the local capacity gate: 11 of 200 first attempts succeed; 189 return 503; accepted p95 is 4,335.7 ms. All 189 exact retries, immutable receipt replays, complete relational-history/XP readbacks and owner-scoped cleanup pass. Overlap and SIGTERM cleanup guards pass. The new diagnostic passes server type checking and focused lint. No application/server/schema/security configuration changed, and increment 5's source/build hashes remain unchanged. A separate single-account CPU profile identifies repeated canonical serialization as substantial work. [Exact commands, samples, corrections and preservation evidence](docs/evidence/performance-2026-10-24/increment-06/README.md). QUALITY-03 remains IN PROGRESS; mixed/shared load, integrated resilience, physical devices and hosted acceptance remain open. Cloud provisioning stays pending.

## 24 October 2026 — QUALITY-03 validated account comparison

The account writer now compares validated JSON values directly for row-change detection while preserving canonical row keys, import/replay fingerprints, validation, SQL and transaction boundaries. `npm run check` passes 282 source/tooling cases; the personal/sync/recovery/lifecycle/group-export database command passes 48 cases, including no-op revision/barrier preservation and isolated nested edits. Single-account full/Undo samples improve to 657.1/624.2 ms. The repeated 100-user burst still fails: 20/200 first attempts succeed, 180 return 503, and accepted p95 rises to 4,861.0 ms. All exact retries, full-history/XP readbacks and cleanup pass. All 52 prior frontend build files remain byte-identical. [Exact commands, CPU profiles, samples and preservation evidence](docs/evidence/performance-2026-10-24/increment-07/README.md). QUALITY-03 remains IN PROGRESS; no hosted, physical-device or complete-product acceptance is claimed.

## 24 October 2026 — QUALITY-03 mixed account/group capacity

The new fixed-test mixed diagnostic uses 100 dense accounts, 50 joined synthetic families and the actual `SharedContent` reader. Four 30-second rounds schedule 400 personal and 200 shared mutations; metadata refresh follows the foreground 15-second cadence. **Capacity and convergence fail**: 359/600 first attempts succeed, 65 return 503 and 176 are deferred. Accepted personal/shared p95 including scheduling lateness is 5,348.9/4,936.7 ms. Of 110 accepted shared updates, 94 are observed; 13 exceed 15 seconds and 16 are missing. All 241 failed/deferred intentions recover with identical IDs/bodies and exact receipt replay; full histories/XP and both members' final shared snapshots match. Cleanup passes for full, smaller and interrupted runs. The original smoke mode passes. `npm run check` passes 282 cases; final types and focused lint pass. [Commands, complete samples, preservation and limitations](docs/evidence/performance-2026-10-24/increment-08/README.md). No application, schema, pool, timeout or UI change; all 52 frontend build files remain byte-identical. QUALITY-03 stays IN PROGRESS; cloud provisioning and physical-device acceptance remain pending.

## 24 October 2026 — QUALITY-03 occurrence read projection

Increment 9 selects dense occurrence columns directly while preserving JSON civil dates, owner filtering, bounds and all validation/transaction rules. Checks pass 282 source cases, 49 database cases and date-format/process-timezone parity. Isolated 73,000-row reads improve from 174.9–241.4 to 86.6–108.0 ms. The identical single-thread mixed workload accepts 377/600 first intentions, with 66 HTTP failures and 157 deferred. Accepted personal/shared scheduled p95 is 5,631.2/4,913.1 ms. Of 121 accepted shared updates, 10 observations are late and 23 remain missing. All 223 failed/deferred intentions recover exactly; every history/XP/shared snapshot and cleanup check passes. Frontend builds are unchanged; QUALITY-03 remains IN PROGRESS. [Exact commands, query/load samples, corrections and preservation](docs/evidence/performance-2026-10-24/increment-09/README.md). Cloud provisioning remains pending.

## 24 October 2026 — QUALITY-03 occurrence writer comparison

Increment 10 pairs equal-length, ordered occurrence identities and compares every value before constructing key maps only for changed rows; mismatches retain the existing path. CPU-only writer medians fall from about 109–111 to 23–24 ms with identical SQL/parameters. Checks pass 282 source cases and 50 database cases, including row versions, reindexing and old-receipt/barrier preservation. The unchanged mixed workload accepts 542/600 first intentions, with 20 HTTP failures and 38 deferred. Accepted personal/shared scheduled p95 is 4,715.8/4,599.1 ms. Of 177 accepted shared updates, 25 observations exceed 15 seconds and 11 remain missing. All 58 failed/deferred intentions recover exactly; complete histories, XP, shared snapshots and cleanup pass. Frontend builds are unchanged; QUALITY-03 remains IN PROGRESS. [Exact commands, samples, corrections and preservation](docs/evidence/performance-2026-10-24/increment-10/README.md). Cloud provisioning remains pending.

## 24 October 2026 — QUALITY-03 BFF concurrency and real HTTP

A subsequent concurrency experiment accepts all 600 mixed intentions through five BFF execution threads, with personal/shared scheduled p95 583.4/520.7 ms and all 200 shared updates observed within 15 seconds. The same total five connections through a real-HTTP, five-process cluster accepts 565/600; personal/shared p95 is 4,763.2/4,030.5 ms, with 29 late and eight missing observations. All 35 exact recoveries, every receipt/history/XP/shared readback and cleanup pass. These runtime/transport experiments do not isolate the cause of the difference; connection affinity is a follow-up hypothesis. No production runtime change is adopted. A separate same-revision transient-reader failure is reproduced and remains unfixed. [Exact commands and reports](docs/evidence/performance-2026-10-24/bff-concurrency-discovery/README.md). Cloud provisioning remains pending.

## 24 October 2026 — QUALITY-03 shared-read recovery

Increment 11 lets unavailable family/squad reads recover after fresh authorized metadata at the same revision; owner invitation failures restore the new authorized first page. Busy/receipt updates cannot cause retry loops, and authority/late-response/account fences remain. Checks pass 290 source cases, 21 reader cases and 33 three-engine browser journeys, including a previously failing timer-only recovery. Stabilized equivalent-state captures are pixel-identical in all 96 comparisons. The normal dense mixed run still fails: 481/600 first intentions accepted, personal/shared scheduled p95 5,501.1/5,347.8 ms, with 18 late and nine missing observations. All 119 exact recoveries, complete histories/XP/shared snapshots and cleanup pass. A prior controlled HTTP run also shows that disabling connection reuse is insufficient. No server runtime, schema, CSS or persisted-format change is adopted; QUALITY-03 remains IN PROGRESS. [Exact commands and evidence](docs/evidence/performance-2026-10-24/increment-11/README.md). Cloud provisioning remains pending.

## QUALITY-03 HTTP admission discovery — 24 October 2026

Two real-loopback-HTTP experiments use the unchanged increment-11 application, 100 dense synthetic accounts, 50 families, actual shared reader and five total restricted BFF connections. The least-pending request gateway and one-active-request-per-worker FIFO variant both accept 600/600 first intentions. Both pass exact receipt replay, complete original history/XP, final shared snapshot comparison and exact fixture cleanup; all workers/listeners close. Smoke runs exit 0. Both full runs exit 1 for timing: personal/shared scheduled p95 is 1,637.4/1,204.6 ms versus 7,123.1/6,627.9 ms, with one versus 26 observations beyond 15 seconds. No shared observation is missing.

The serial queue reaches 138 waiting requests and is not adopted. The next check is bounded request-phase profiling. These are diagnostic gateways without trusted source-IP forwarding, complete production transport hardening or failure supervision; login/seeding remains injected setup. No authentication-quota, hosted, browser-paint or physical-device acceptance is inferred. [Complete results, commands, scope and preservation](docs/evidence/performance-2026-10-24/bff-http-admission-discovery/README.md). Source/builds, policies, dependencies, design and saved data are unchanged. QUALITY-03 remains IN PROGRESS; cloud provisioning remains pending.

## 24 October 2026 — QUALITY-03 request-phase discovery

The isolated request-phase capture records 3,459 matching gateway/worker requests with no drops. Capacity still fails: 284/600 first intentions are accepted; personal/shared scheduled p95 is 6,319.4/4,941.2 ms, with 19 late and ten missing shared observations. All 316 exact recoveries, complete histories/XP/shared readbacks and fixture cleanup pass. Shared mutation pool-acquisition p95 is 4,829.9 ms versus 4,963.6 ms overall; owner-lock time averages 1.8 ms. Host memory pressure and duplicated worker heaps are also observed, without isolating causality. A five-round ordered JSON-aggregate query is rejected: median read time is 232.3 ms versus 129.5 ms for current direct columns. No application change is adopted. Next: compare fewer execution threads with the same five restricted connections and overlapping requests. Instrumentation/host load limit comparison with earlier runs. The initial full phase-capture failure and successful repair are retained. [Commands, phases, rejected query and scope](docs/evidence/performance-2026-10-24/bff-phase-discovery/README.md). QUALITY-03 remains IN PROGRESS; cloud stays pending.

## 24 October 2026 — QUALITY-03 pool partition discovery

The two-thread/3+2-connection follow-up retains the same total five restricted connections and overlapping requests. It still fails capacity: 337/600 first intentions succeed, personal/shared scheduled p95 is 6,201.6/4,950.8 ms, and 33 shared observations are late with 11 missing. All 263 exact recoveries, complete histories/XP/shared readbacks and cleanup pass; 3,578 gateway/worker records match with no drops. Shared pool-acquisition p95 remains 4,812.5 ms. Per-thread CPU and heap maxima rise, and host-wide swapping continues. The partition is not adopted; these shared-host runs cannot isolate thread-count causality. Before another full runtime experiment, use a smaller diagnostic to separate pool hold time, same-session waits and per-request allocations. [Evidence and limits](docs/evidence/performance-2026-10-24/bff-pool-partition-discovery/README.md). Application, builds, design and saved data remain unchanged; QUALITY-03 stays IN PROGRESS and cloud stays pending.

## Bounded session admission — 24 October 2026

Increment 12 prevents concurrent requests for one session from exhausting the restricted connection pool while waiting on that session's row. A bounded in-process FIFO admits work before database acquisition and rechecks current authorization afterward; SQL/RLS, receipts, connection budgets, deadlines and UI remain unchanged. The old class fails the new contention regression; the implementation passes 294 source/tooling cases, 24 focused database cases, 21 auth and 69 sync browser cases. The complete database recheck passes 169 cases; an initial large invitation-transfer 503 remains recorded as an unresolved timing-sensitive observation. The normal 100-account mixed capacity run is worse: 130/600 first intentions succeed, personal/shared scheduled p95 is 9,359.1/6,121.3 ms, with five late and two missing shared observations. All 470 exact recoveries, complete histories/XP/shared readbacks and cleanup pass. This is a narrow contention fix, not demonstrated capacity acceptance. QUALITY-03 remains IN PROGRESS and cloud stays pending. [Evidence, regressions and limits](docs/evidence/performance-2026-10-24/increment-12/README.md).

## Account projection increment — 24 October 2026

Increment 13 removes per-object temporary filter/map/pair arrays from the fixed-field account projection. Own/defined allowlisted values, privacy exclusions, record order and stored formats are preserved. Two alternating-order dense-profile experiments reduce median projection wall time from 30.2–30.7 ms to 13.0–13.7 ms; this is a pure-function result, not API/device capacity. Checks pass 295 source/tooling cases, 39 targeted real-database cases and 69 three-engine sync cases with no flakes. CSS and screen code remain unchanged. No new 100-account capacity result is claimed; QUALITY-03 remains IN PROGRESS and cloud stays pending. [Evidence and limits](docs/evidence/performance-2026-10-24/increment-13/README.md).

## SAFE-01 integrated local security review — 24 October 2026

Local acceptance is complete against release `f10c7d5e178eb33c3fd4`; SAFE-01 is REVIEW for hosted/device gates. The BFF now enforces CSP/framing restrictions and limited feature permissions, preserving the existing style attributes. Browser policy enters the PWA fingerprint so policy-only changes use the compatible update flow and refresh offline headers. No screen/CSS/public-asset, schema, dependency or storage-format change was made. Application JS/CSS and every review-build file remain byte-identical to increment 13; only production HTML/generated worker release metadata changes. Saved user profiles were not opened or reset.

Checks pass 296 source/tooling cases, 173 real database/BFF cases, 21 backend, 21 auth, 69 sync, 54 push, 66 production-entry and 45 PWA browser cases. The complete group run passed 110 cases and exposed one squad-layout detached-control race; all nine affected cases pass after a bounded test-only repair. The earlier family layout race was likewise repaired and passes across the three languages/engines. All 48 visual matrix cases pass their 720 frozen comparisons with no baseline regeneration. Lint/types pass after the final test correction. The npm audit reports zero vulnerabilities, and both local/test environment verifications and security advisors pass after the database suites.

[Evidence, original failures, exact commands, hashes, runtime versions and rollback limits](docs/evidence/security-2026-10-24/README.md); [local security contract](docs/LOCAL-SECURITY.md). Hosted HTTPS/HSTS, proxy/cookie/key/backup operations, physical-device notification privacy and SEC-07 operational ownership remain open. QUALITY-03 capacity remains IN PROGRESS. Cloud provisioning remains pending.

## OPS-02 local server recovery — 24 October 2026

Encrypted backup/expiry, retention/purge commands, freshness alerts and real isolated restore/replay are implemented. `npm run check` passed 306 tests plus type/lint/build gates; `npm run test:infra` passed 178 real database/runtime checks, with final focused recovery/retention checks and CLI watcher/lock/shutdown verification passing. The populated synthetic drill measured a 2.974-second-old recovery point and 7.013 seconds to restore/reconcile/validate. All 62 local application tables and original protected configuration survived backup unchanged; all app/assets/schema/lockfile source and the web release are unchanged. [Full evidence and limits](docs/evidence/backup-recovery-2026-10-24/README.md). Continuous/off-site/lost-source/hosted recovery and cloud provisioning remain pending; OPS-02 is REVIEW, not public-release acceptance.

## OPS-03 local rollout and rollback — 24–25 October 2026

[Evidence](docs/evidence/local-rollout-2026-10-24/README.md) records sealed builds, candidate admission/health, failed-start restoration, exact pending-outbox replay through a newer service worker and compatible rollback, stale-selection fencing and repeated-interrupt cleanup. Checks: 311 unit/tooling, 178 database, 1 additional runtime regression, 6 rollout, 45 PWA, 66 production, 21 backend, 21 auth and 69 sync cases; types/lint/docs pass. Ordinary production release `14b94acfaeaf38b5f855`, all 202 protected source/asset/migration/lock files and the local database/configuration preservation checks remain unchanged. No visual reference update, schema migration, real delivery or cloud provisioning occurred. Hosted operations and public release acceptance remain pending.

The final parallel unit repeat hit the existing renewal test’s two-second deadline. Its focused 13 checks and all 311 sequential checks passed without altering the test timeout or application behavior; final builds and the real runtime regression also passed. This limitation is recorded in the OPS-03 evidence.

## OPS-04 — Local help, policies and rights inventory · 25 October 2026

[Evidence and limitations](docs/evidence/launch-policies-2026-10-25/README.md) record 312 unit/tooling checks, 75 production checks, 54 real-worker PWA checks, 18 diagnostic checks and 720 visual comparisons passing on the final local implementation. An intervening WebKit five-second save-wait timeout under concurrent browser work is recorded; the complete sequential production rerun passed unchanged. New Help-row references are separate; all historical visual files and protected data/domain/backend/assets/lockfile remain unchanged. Localized notices and license attribution are available offline; no consent, saved-data format, backend behavior or provisioning change is introduced. OPS-04 remains REVIEW for public contacts/operator/provider/legal/rights approvals. Cloud provisioning and hosted/physical-device acceptance remain pending.


## RELEASE-01 local rehearsal — 25 October 2026

[The dated release evidence](docs/evidence/release-rehearsal-2026-10-25/README.md) records the full synthetic functional matrix, accelerated production day-boundary test, corrected Settings test selectors and bounded PWA timeout fix. It retains the original failures and exact subsequent results. Chromium's intermittent sealed-package activation stall remains unresolved despite passing reruns; RELEASE-01 stays IN PROGRESS. The current local database/configuration preservation comparison is separate from test-stack mutations. No human feedback, elapsed-day retention, physical-device acceptance or public release is claimed; QUALITY-03 and cloud provisioning remain pending.


## Local Chromium activation correction — 25 October 2026

[New activation evidence](docs/evidence/worker-activation-2026-10-25/README.md) records the original failure, discarded experiments, original-code failing handoff regression and the focused correction. Approved replacement drains private response bodies and pauses new requests and optional worker messages after required durability. All existing deadlines and saved-data formats remain. The final source check passes 315 tests; PWA passes 63, production passes 78, visual passes 48 cases/720 comparisons, and sealed rollout passes all six cases across Chromium, WebKit and Firefox. The linked verification record contains additional API and repetition outcomes, including the separately retained pre-update sign-in failures, group test-queue isolation failure and interrupted run. Local database/configuration, previous evidence and visual references are preserved. RELEASE-01 remains IN PROGRESS for remaining gates. Cloud provisioning remains pending.
