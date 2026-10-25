# Localization and equivalent-state review

24 October 2026 · QUALITY-01 / PRD-01, PRD-17 and the localized capability guidance in PRD-19. Local macOS, isolated review/production builds and retained local/test BFF. Local language/parity acceptance passes. Cloud provisioning remains pending. The personal profile on 4173 was not accessed.

The older interface had many English fallbacks in Uzbek despite the newer account/group modules having three-language copy. The new Uzbek catalog shares 1,569 keys with Russian and retains explicit inline translations. Known measurements, prayer/city/method names, sheet titles, errors, accessibility names and recovery summaries now localize without translating authored names, notes, reflections or custom units. Language changes preserve the complete saved journey. No domain IDs, calculations, persistence formats or server authorization changed.

Chromium's Uzbek date formatting exposed `M10` instead of a month name. The shared display formatter supplies Uzbek calendar labels while preserving the instant and requested timezone; English/Russian output remains unchanged. Existing capability guidance now describes separate notification setup and implemented account/group access. A saved reminder preference is not delivery consent.

The visual review found family Tasks/Lists labels clipping at 320 px and 200% text. The existing segmented control now wraps. This fixes legibility without changing tokens, fonts, artwork or the four-tab design.

## Visual evidence and preserved references

The full capture matrix covers 15 equivalent scenes, English/Russian/Uzbek, light/dark, 320/375/393/430/1440 px and 100/200% text: **900 images in 60 passing cases**. Shell/sheet bounds, visible sheet exits and segmented-control text bounds pass. All scene types were inspected in representative phone/desktop contact sheets, with native-resolution Today and the narrow family before/after images.

Of the original 720 frozen comparisons, **480 English/Russian and 34 Uzbek images remain identical**. **206 Uzbek images intentionally change** for completed translations and readable dates. Their original bytes are retained under `before/`; updated Uzbek and additional 320 px images are under `captures/`. The [visual review manifest](visual-review.json) identifies every image and hash. The accepted Uzbek-only update passed 16 cases; normal verification passed 46 cases and two unchanged-build targeted reruns resolved timeouts, with no image mismatches. This is not represented as a single clean 48-case run.

An early manifest scan began before capture completion and counted only 172 changed references. The post-run audit corrected the count to 206. The 34 omitted originals were recovered using the saved pre-task sources and unchanged assets on isolated port 4182. All 60 recreated images matched their original SHA-256 hashes exactly; all 206 prior references are now preserved and verified. The manifest records this recovery rather than concealing the initial incomplete audit.

Capture build: review `index-D4zCw1VR.js`, CSS `index-VATQKOLD.css`. The later recovery-summary localization is absent from those 15 scenes and has separate public-interface and three-engine conflict-layout checks. Final build: production `index-D0h5wlbt.js`, review `index-D1RQeLZe.js`, same CSS.

## Verification scope and limits

The final source check passes pinned toolchain, lint, app/test/server types, **272 unit/tooling tests** and both builds. Nine localization unit cases include date/timezone behavior, explicit overrides, interpolation, known/custom measurements, authored content and recovery command preservation. The expanded browser checks exercise tiny/full/Undo XP, goal/reward independence, translated validation, language changes/reload and narrow family navigation.

The full existing-app run passed 382 of 390 cases. Six failures were stale assertions for newly translated city/prayer labels; two were Firefox timeouts. All 60 corrected affected journeys pass in three engines, and both focused Firefox reruns pass without a source change or increased timeout. Initial Uzbek test development also corrected a fixture-derived tiny target and a locator that matched a preserved hidden tab. These were test errors, not changes to XP or tab preservation.

| Command | Result |
| --- | --- |
| `npm run check` | Toolchain, lint, types, 272 unit/tooling cases and both builds pass |
| `npm run test:browser` | 382 pass; six obsolete label assertions and two Firefox timeouts, resolved below |
| `npm run test:browser -- 'tests/(life\|navigation\|uzbek).browser.spec.ts$'` | 60 pass, including the corrected label assertions and enlarged family controls |
| `npm run test:browser -- 'tests/prayer-live.browser.spec.ts$' --project=firefox --grep='executing browser\|render at 393px'` | Both prior Firefox timeouts pass |
| `npm run test:production` | 54 production-entry, migration, prayer and habit-reminder cases pass |
| `npm run test:groups -- 'tests/groups/content-layout.groups.spec.ts$'` | Nine cases / 1,620 layout states pass |
| `npm run test:sync -- 'tests/sync/recovery-layout.sync.spec.ts$'` | Nine cases / 162 conflict-review layout states pass |
| Temporary isolated capture runner using the existing visual scenes | 60 cases / 900 captures pass; temporary test removed |
| `npm run test:visual:update -- --grep='uz-(light\|dark)'` | 16 cases pass; 206 reviewed Uzbek references updated |
| `npm run test:visual` | 46 pass and two timeouts; no image mismatch |
| `npm run test:visual -- --grep='uz-light-1440x1000-200\|uz-dark-375x852-100'` | Both timeout cases pass unchanged |
| `npm run lint`, `npm run typecheck`, `npm run check:docs` | Final test/document changes pass |

Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Browser journeys use 4180, production entry uses 4181, visual comparisons use 4182, and account/group layout checks use 4191 sequentially. Synthetic layout metadata has no usable authentication and blocks service workers. These checks do not certify physical Safari/iPhone/Android, VoiceOver/TalkBack, HTTPS delivery or a complete production release; QUALITY-02 and the existing release gates retain those requirements.

Rollback may restore the prior display code/catalog and matching references without migrating or clearing data. Preserve the original reference archive and historical evidence. Restoring untranslated text would restore the observed localization defects. No real email, invitation, push, cloud provisioning or deployment was performed.


QUALITY-01 is DONE for the local language/parity scope. The remaining physical accessibility and complete settings/help release requirements remain assigned to QUALITY-02 and OPS-04. [Verification/source/build hashes](verification.json), [preservation audit](preservation.json), [visual manifest](visual-review.json), [full browser run](logs/browser-full.log), [affected journeys](logs/browser-affected.log), [Firefox reruns](logs/firefox-timeouts.log), [production entry](logs/production.log), [final visual run](logs/visual-final.log) and [visual timeout reruns](logs/visual-timeout-rerun.log).
