# Accessibility and mobile acceptance

24 October 2026 · QUALITY-02 / PRD-01, PRD-17, PRD-18 recovery access and NFR-08. Local macOS and isolated synthetic browser profiles. Cloud provisioning and physical-device acceptance remain pending. The user profile on 4173 was not accessed. Local acceptance passes. QUALITY-02 is in REVIEW for the remaining physical acceptance gates.

## Changes and observable outcomes

The rendered audit found an English priority-edit target about 25 px wide, weekday buttons 38 px wide at 320 px, and an expanded original-recovery download only 20 px high. These controls now have 44 px minimum targets. Narrow weekday rows wrap, and habit form columns stack when enlarged text needs more room, preserving the selected category text. Existing switches already have expanded hit areas; their visual glyphs were not enlarged unnecessarily.

Keyboard checks reproduced closed disclosure controls entering the Settings Tab loop. The sheet now excludes those controls while retaining each disclosure summary. Long titles wrap and headers grow while keeping exit controls from shrinking. Short-viewport checks reproduced partially clipped focused fields; the active sheet reveals the field inside its own content scroller and observes resize. WebKit also reproduced a clicked opener that never received focus. Semantic click targets now receive focus before the action, so closing a sheet restores the actual opener.

The 39 focused checks pass in Chromium, WebKit and Firefox. They exercise visible keyboard focus, containment/restoration, disclosure order, actual expanded hit areas, system/saved reduced motion, durable drafts across nested forms and viewport resizing, and exact original recovery download bytes with unchanged state. A layout-viewport simulation does not establish physical software-keyboard behavior.

Changes are limited to `src/App.tsx`, `src/components.tsx`, `src/styles.css`, one recovery-button class in `src/data/StorageNotice.tsx`, the new `tests/accessibility.browser.spec.ts`, documentation (including the matching narrow weekday sample in `.impeccable/design.json`) and reviewed visual references. No domain calculation, storage format, migration, backend permission, dependency, catalog, font, artwork or four-tab navigation structure changed. [Source patch](source-changes.patch).

## Visual review

The initial audit covers 396 states: 22 scenes, three languages, light/dark, 393 px and desktop at normal text, and 320 px at 200% text. A separate synthetic shared-content audit covers 162 states. Conservative opaque-text contrast and motion probes found no failures in their covered elements; complex backgrounds and real assistive-technology behavior are outside these diagnostics. The design detector reports zero deterministic patterns; existing radius/color advisories are preserved design choices.

An intermediate 1,380-image pass covered 23 scenes at 320/375/393/430/1440 px and both text scales/appearances/languages, with no target/opaque-text/motion/missing-alt candidates. It preceded the final focus fixes and is not evidence for those fixes. Its 194 changed baseline images were mostly unnecessary title rasterization differences. Removing title flex growth narrowed the final change without removing required wrapping or exit targets.

The final capture run passes 48 cases / 720 equivalent-state images. **676 references remain byte-identical; 44 intentional changes are all at 200% text** in personal-reward, prayer-preferences and priority sheets. All changed pairs were inspected in six contact sheets; the Russian 430 px enlarged reward and new narrow habit/recovery states were also inspected at native resolution. Original bytes were hash-verified and archived under `before/` before only those 44 references were replaced. The [visual manifest](visual-review.json), [fixture/browser metadata](capture-metadata.json), [before/after contact sheets](contacts/) and [control screenshots](controls-after/) retain the review. No whole-matrix regeneration was used.

Final build: production `index-C4owHKwZ.js`, review `index-D2JwkHzn.js`, CSS `index-DM2hzASY.css`. [Complete build hashes](build-hashes.json). Earlier account/group layout runs used the preceding layout build and are recorded separately below.

## Verification and diagnostic history

| Command / scope | Result |
| --- | --- |
| `npm run check`, run sequentially before final browser checks | 272 unit/tooling cases, pinned toolchain, lint, app/test/server types and both builds pass |
| `npm run test:browser -- 'tests/accessibility.browser.spec.ts$' --workers=1` | 39 pass across three engines |
| `npm run test:browser -- 'tests/(navigation\|russian\|uzbek).browser.spec.ts$' --workers=1` | 51 pass across three engines |
| `npm run infra:verify -- test` | Existing test identity, restricted role, Auth health and loopback bindings pass |
| `npm run test:auth` on final build | 21 account and layout cases pass |
| `npm run test:groups -- 'tests/groups/(content\|membership).groups.spec.ts$'` on final build | 21 real-database shared-content/membership cases pass |
| `npm run test:production` on final build | 54 cases pass |
| Temporary isolated capture runner, copied from the existing visual scenes | 48 cases / 720 images pass; temporary spec removed |
| `npm run test:visual` against the 44 inspected updates and 676 preserved references | 48 cases / 720 exact comparisons pass |
| Earlier layout build: production entry / account flows and layout | 54 / 21 pass; not substituted for the final-build runs |
| Earlier layout build: `npm run test:groups -- 'tests/groups/(content-layout\|layout\|squad-layout).groups.spec.ts$'` | 27 cases / 6,480 synthetic layout states pass |

The initial nine-case focused run reproduced seven target-size failures. The next 36-case run exposed disclosure keyboard stalls, Russian header overflow and Firefox fractional sizing. A rendered 44 px Firefox track can report 43.999969; the assertion permits 0.01 px precision. The priority hit test moved from the fractional edge at x=1 to x=8, still inside the newly added English target.

The first short-viewport test accidentally used reviewer mode's fixed-height preview; it now uses the normal review-build entry. The corrected 39-case reproduction still failed 11 cases, including actual field clipping and WebKit opener restoration, so these needed source fixes. The earlier 90-case journey run passed 79 and failed 11; all 39 focused cases and all 51 existing journeys now pass. These earlier failures remain in `logs/` and `reports/`.

One full source run passed 271/272 and hit the existing two-second renewal-test deadline while browser suites were active. All 13 renewal tests then passed in isolation, followed by all 272 in the sequential full check. No renewal code or timeout changed. Host contention was observed but is not asserted as a proven cause. A later account run stopped before executing tests because Docker's socket was unavailable; launching the installed local runtime and verifying the retained test installation resolved startup, followed by 21 passing account cases. No database/profile reset, credential replacement or policy weakening was used.

Environment: macOS 26.6.2, Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Review journeys use 4180, production uses 4181, visual checks use 4182, and local/test BFF checks use 4191. Final suites run sequentially. Real account flows disable traces, video and automatic screenshots; captured interface states are synthetic and contain no usable codes.

Physical VoiceOver/TalkBack, supported iOS/Android release browsers, Home Screen mode, software keyboards, safe areas and actual desktop/tablet browser observations remain open in [the acceptance matrix](../../MOBILE-ACCESSIBILITY.md). These checks do not certify WCAG compliance, physical devices or a production release. The bundle-size advisory belongs to QUALITY-03.

Rollback can restore the previous four display/component files and their matching references without a data migration or clearing storage; it would restore the accessibility defects. Keep exact recovery sources and historical evidence. No real email, invitation, push, hosted provisioning or deployment was performed.

[Verification and source hashes](verification.json), [preservation audit](preservation.json), [source gate](logs/check-sequential.log), [focused accessibility](logs/accessibility-verified.log), [existing journeys](logs/journeys-final.log), [account checks](logs/auth-final.log), [shared-content checks](logs/groups-final.log), [production entry](logs/production-final.log) and [normal visual verification](logs/visual-final.log). The wider goal remains active; performance, security, operations and release work follow the task dependencies.
