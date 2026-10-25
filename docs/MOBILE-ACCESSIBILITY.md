# Mobile and accessibility acceptance

QUALITY-02 owns PRD-17 and the browser/language coverage in NFR-08. The product target remains the existing mobile web app and installable PWA. Cloud provisioning is pending; local desktop-engine checks do not close physical-device acceptance.

## Local checks

Run `npm run check` before browser suites. `npm run test:browser -- 'tests/accessibility.browser.spec.ts$'` uses isolated port 4180 and synthetic profiles in Chromium, WebKit and Firefox. It checks collapsed-disclosure keyboard order, modal focus containment/restoration, visible focus, priority/weekday/recovery hit areas, complete recovery download, durable drafts during viewport resizing, and system/saved reduced-motion choices. Ordinary saved data on 4173 is outside these tests.

Use `npm run test:visual` on 4182 for the frozen equivalent-state references. Never update them simply to make a check pass. Preserve the prior image bytes, inspect intended requirement-driven differences and record their build/fixture hashes. Current dated work is recorded in [the accessibility evidence](evidence/accessibility-2026-10-24/README.md).

The local contrast probe measures direct text over opaque resolved backgrounds. It excludes gradients, images, ancestor opacity, disabled content and SVG text; it is a diagnostic, not a complete contrast or accessibility audit. Expanded switch pseudo-elements and clickable input labels must be checked as hit areas before reporting the smaller visible glyph as a failure. Closed disclosure content must be excluded from rendered-control and keyboard inventories.

## Physical release matrix — pending

At release freeze, record actual device, OS, browser/build, assistive-technology version, app release/hash, HTTPS origin, appearance, language, text scale, installation mode and tester for every result. The supported versions come from PRD.md: current/previous major iOS Safari including Home Screen mode, and current/previous Chrome on supported Android devices. Record desktop Chrome/Safari/Firefox smoke results and tablet usability separately. Do not substitute a Playwright engine version for a phone/browser version.

| Journey | Required observation | Current physical evidence |
| --- | --- | --- |
| Four tabs and shortcuts | VoiceOver/TalkBack announces current tab and destination; independent reading position survives switching | Pending |
| Settings and nested forms | Logical traversal; closed sections skipped; controls named; focus remains in active sheet and returns to its opener | Pending |
| Habit/goal/reward edits | Labels and errors announced; tiny/full/Undo remains understandable; no duplicate action on repeated activation | Pending |
| Prayer/Fajr and private pause | Readable times, explicit record choices, private-pause explanation and honest notification readiness | Pending |
| Account/recovery | Save/error status announced; expired/offline state understandable; reauthentication and recovery preserve drafts | Pending |
| Family and squad | Task/list controls, conflict review, exact sharing consent and group/member actions usable without color alone | Pending |
| Large text and keyboard | 200% text, supported OS font enlargement, 320 px equivalent reflow; focused input and sheet exit remain reachable with software keyboard open | Pending |
| Safe areas and orientation | Header/exit and tab targets avoid cutouts/home indicator; portrait/landscape changes preserve input and scroll context | Pending |
| Appearance and motion | Light/dark text and focus visibility; OS/app reduced motion preserves understandable state changes | Pending |
| Home Screen/offline | Installation mode, resume, offline edits and safe update prompts remain usable with assistive technology | Pending |

Use consented synthetic test accounts and disposable device profiles. Keep private religious records, coordinates, free text, codes, invitation secrets and credentials out of recordings. Capture unverified forms or synthetic non-secret states only. Never clear another user's data or alter notification permission outside the explicit test setup.

For each observation, record pass/fail/not-run, reproduction steps, expected/actual result, safe evidence and linked defect. Check names, reading order and live announcements by listening to the actual assistive technology; a DOM snapshot cannot prove them. A viewport-height simulation verifies layout response only, not software-keyboard or safe-area behavior on a device.

QUALITY-02 may record locally verified work while these rows remain pending. It cannot be DONE, and the product cannot claim WCAG certification or release-browser acceptance, until the required manual/physical observations and blocking-defect resolutions have evidence.
