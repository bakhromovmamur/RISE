# Real prayer times and delivery — documentation evidence

2026-10-21. Ordinary extension of the incumbent RISE system. This pass changes only `PRODUCT.md` and this evidence note. It corrects blanket simulation-only claims while retaining the demo, local-sharing and privacy boundaries.

## Evidence checked

- Read `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, the shipped Impeccable documenter instructions and `reference/document.md`.
- Compared `src/styles.css`, `src/life.css` and shared `Button`/`TabHeading` definitions with the recorded palette, font, spacing and component patterns. The new `PrayerLive.tsx` surfaces reuse the existing form, grouped row, button, toggle and readiness styles.
- Read `src/prayerCalculation.ts` and `src/prayerSchedule.ts`: Adhan calculation, local time-zone lookup, settings validation, rolling 30-day refresh, checked/manual snapshot retention, demo/sample guards, Fajr acknowledgment and OS-queue reconciliation.
- Read `src/prayerDelivery.ts`, `src/PrayerDeliveryProvider.tsx`, `src/PrayerLive.tsx` and the relevant `src/Life.tsx`/`src/App.tsx` paths: explicit permissions, queue read-back, lifecycle refresh/cancellation, browser execution limits, live-versus-preview acknowledgment, blocked-permission Refresh status and native empty first launch.
- Read README.md’s real-prayer section, `capacitor.config.ts`, Android manifest/channel setup and the iOS Info.plist/Swift Package dependencies. These show native source/configuration, not a compiled or device-tested application.
- Opened supplied captures `.impeccable/review/mobile.png`, `user-375-delivery.png`, `desktop.png` and `russian-large.png`. They show the existing single-column setup/readiness composition, incumbent palette and type, the corrected blocked-permission primary action and enlarged Russian wrapping. No browser interaction was performed by this pass.

## Verification boundary

The owner reports a successful final `build:native` web build plus Capacitor sync, all 71 domain cases passing and all 69 Chromium browser scenarios passing: 140 total. The final browser run took 39.6 seconds. Owner-supplied logs are `/tmp/rise-domain-final.log` and `/tmp/rise-browser-final.log`; the documenter did not rerun the checks. The virtual-clock Fajr case now waits for the real readiness heading before advancing time and verifies actual executing-browser notification delivery exactly once plus backup suppression after acknowledgment. The browser suite comprises 59 prior scenarios and ten feature scenarios.

The reviewer’s final disposition is ship, limited to the two scored fixes: PRODUCT.md’s capability truth and denied-permission recovery through the primary Refresh status action. Both were resolved, with no visible regression in the correction batch. This is not a new whole-surface review and does not verify native rendering or physical-device delivery.

Native delivery is notification-based, with a read-back queue of up to 60 events that requires reopening the app before exhaustion. Android backup wake alerts are at least ten minutes apart. Browser delivery requires an executing, awake page. No Apple AlarmKit, critical-alert entitlement or Android full-screen alarm service is implemented. There is no guarantee of sound through device restrictions. The machine lacks full Xcode, Java and Android SDK tooling, so no IPA/APK compilation, signing, installation or native/physical-device delivery is established.

## Incumbent design retained

Porcelain surfaces, forest action/ink and mint selection remain unchanged. The system sans stack and shared rem type hierarchy remain; prayer setup uses the existing 1.75rem introductory heading, 1rem fields and smaller supporting labels. The single-column mobile shell, rounded controls, tonal readiness surface, focus treatment and reduced-motion behavior are reused. The Paired Action, Familiar Voice and Quiet Depth rules remain authoritative.

`DESIGN.md` and `.impeccable/design.json` were not edited. Their SHA-256 values are `76423b11a448863fa80125d13e5a3c9d56f3b04f5d51e8414e90cbfd58ec5767` and `9cd451a5ed4e571eacef8c3ffbf6e8526f5d2dda3681490eb0b42234a1744aec` respectively.

Pre-existing drift was not repaired: DESIGN.md and the sidecar still describe the 2.125rem headline as the primary greeting, while the shared `TabHeading` now uses 1.75rem. That wording predates this extension; no new visual rule or defect was canonized to resolve it. No new design world, comp or quality card applies.
