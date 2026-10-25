disposition: ship

Verdict pass: ship covers the scored fixes, not the whole surface. The original five-section review below is preserved as history with its initial fix findings; the current scoring is recorded in `verdict` and `remaining` at the end.

Inputs: no separate QUALITY BAR card or new-world FORM/seed was supplied; those are not a new direction requirement for this incumbent-system localization. No approved comp is expected for this code-led refinement. All 13 required captures were opened; no required capture remains unread.

## persistence

Pass. PRODUCT.md, the existing DESIGN.md and `.impeccable/briefs/russian-language.md` exist. The screenshots retain the documented visual system. This extension does not require a comp round, comp approval, reproduction state or comp-diff evidence. PRODUCT.md still describes the preceding release; the owner's planned documentation pass must incorporate the localization and final verification outcome.

Evidence passes. Opened `today-393.jpg`, `journey-375.jpg`, `progress-430.jpg`, `you-393.jpg`, `language.jpg`, `prayer-setup.jpg`, `fajr-plan.jpg`, `fajr-alarm.jpg`, `family.jpg`, `shopping.jpg`, `progress-large.jpg`, `desktop.jpg` and `today-375.jpg`. All show the named screen with plausible viewport dimensions and no blank or failed render. All 13 hashes match the manifest and all public copies are byte-identical. The manifest distinguishes final build `index-Cy3DKCM2.js / index-BF4I3Na_.css` captures from unchanged regions captured before the bounded correction. The clipped prayer-setup header is an actual UI defect, corroborated by the owner's dialog/header y = -36 and pageScroll = 0 observation; it is not a malformed capture and does not trigger recapture disposition.

The reported successful build, 57 domain tests and 58 Chromium scenarios, including eight Russian journeys, are supplied owner evidence; this review did not rerun them or operate a browser. The source sample covered the translator, language selection, prayer setup, Fajr dates, shared sheet and sheet styles.

## fidelity

| Element | State | Evidence |
| --- | --- | --- |
| TYPE | match | System sans, bold screen headings and restrained supporting copy retain the explicit DESIGN.md authority. Cyrillic renders clearly; no substitute display face is warranted. |
| MATERIAL | match | Original dimensional Pip remains visible on Journey, You and the desktop rail. The flat interface surfaces retain their intended medium. |
| GROUND | match | Captures retain the porcelain/forest/mint light appearance and forest dark appearance specified by DESIGN.md, without a competing palette. |
| Four tabs and reading order | match | Today leads with prayers and priorities; Journey with Pip and personal rewards; Progress with history; You with settings and people. The first viewport still communicates the next meaningful action. |
| Russian text reflow | adaptation | Equal habit-action columns and «Минимум» follow the localization brief's bounded correction. At 375 and 393 px the labels remain legible. The 200% Progress capture wraps headings and presents bottom tabs in two rows, as required by the existing accessibility behavior. |
| Russian dates, examples and language selection | match | Fajr plan/alarm dates, family tasks and shopping examples are Russian. The language picker retains English, O‘zbekcha and Русский. Its source changes only `life.language`, preserving authored fields. Native language names, RISE, Pip/Пип and XP are not untranslated interface omissions. |
| Prayer setup header and exit controls | contradicted | `prayer-setup.jpg` cuts off the title and most of the Back/Close targets above the viewport while the form body is at its opening position. This violates the existing full-screen-sheet contract and usable localized controls. |
| Existing Uzbek date behavior | contradicted | The owner reports actual `M10 19, Mon` and `M10 19–M10 25` output after the new locale mapping. `src/i18n.ts:5` and `:26–31` corroborate the change to `uz-Latn-UZ` in generic date/week formatting. This is a compatibility regression against the brief's retained Uzbek behavior. |
| Prototype truth | match | Prayer setup names illustrative times, Fajr names alarm simulation, and family names fictional membership. The inspected screens do not imply live services or real alarm delivery. |

## ceiling

No unused design device is material to this localization. The incumbent system is the finish authority; additional ornament, alternate typography, motion or a new composition would exceed the request. The two functional defects below prevent completion. No second detector was run, and the owner reported no new hook findings. Motion and exhaustive accessibility are not independently established by static captures.

## material_fixes

1. **Sheet accessibility / localization boundary:** Correct prayer-setup placement so the full title and Back/Close hit targets open inside the viewport, with the long form scrolling internally; verify normal and 200% text at the requested phone widths and replace the same `prayer-setup.jpg` evidence after the fix. The y = -36 header is a material control-access defect, not optional style polish.
2. **Existing-language compatibility:** Preserve the original stable `en-US` generic date formatting for Uzbek while retaining `ru-RU` for Russian, existing Uzbek interface copy and the numeric Uzbek Fajr-plan date in `src/Life.tsx:194`. Verify the owner-observed Today and weekly labels no longer expose `M10` in the in-app browser; do not translate or rewrite saved content to repair presentation.

## keep

Keep the porcelain/forest/mint system, original Pip, four-tab hierarchy, readable Russian action layout, explicit simulation labels and render-time localization that leaves saved personal content and achievements untouched.

## verdict

1. **Sheet accessibility / localization boundary — resolved.** The replaced `prayer-setup.jpg` visibly contains the complete title, Back and Close inside the viewport. `prayer-setup-large.jpg` shows the complete wrapped header and Close at 200% text without clipping. The supplied motion-enabled checks cover 375/393/430 at normal and 200% text; header y = 0 and shell scrollTop = 0 are owner measurements, not independently rerun measurements.
2. **Existing-language compatibility — resolved.** `uzbek-date-compatibility.jpg` visibly reads “Monday, Oct 19”; `uzbek-week-compatibility.jpg` visibly reads “Oct 19–Oct 25”, with no `M10` fallback. Saved Russian fixture names remain as written. The owner reports retained `ru-RU` Russian dates and the unchanged numeric Uzbek Fajr-plan branch.

Opened all four actual confirmation images at the exact manifest paths. All four are valid 393 × 852 captures, their SHA-256 hashes match the updated manifest, and their public copies are byte-identical. They record build `index-BOnYvotb.js / index-D4SQdtSZ.css`. The updated verification notes report a successful build, 57 domain tests and 59 Chromium tests; no tests, browser actions or detector pass were run by this reviewer.

## remaining

Clear. No regression introduced by this correction batch is visible in the four scoped confirmations. Ship covers the scored fixes, not the whole surface.

disposition: ship
