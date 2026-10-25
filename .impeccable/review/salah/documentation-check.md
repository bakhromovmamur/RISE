# Salah extension — documentation check

Reviewed 20 October 2026. **Outcome: conforms to the incumbent RISE design system.** This is an ordinary extension of the approved visual identity; it does not establish new durable design tokens or require a replacement design document.

## Authority and scope

The review used `DESIGN.md`, `.impeccable/design.json`, the updated `PRODUCT.md`, and the direction contract at `../../.impeccable/surfaces/outputs-rise-src-app-tsx.md` relative to the project root. The Impeccable document playbook was read. Its extraction guidance was applied as a conformity check because the task expressly preserves the existing design files and authorizes only this report.

Source inspection covered `src/Prayers.tsx`, all of `src/prayers.css`, prayer connections in `App.tsx`, `Explore.tsx`, `Personal.tsx`, and `Onboarding.tsx`, the stylesheet import in `main.tsx`, and the shared styles and components. Existing captures `mobile.png` and `dark-work.png` in this review folder were inspected directly. The finish review records the wider 21-capture pass and the final verdict on eight affected recaptures. No browser session, implementation edit, or new runtime test was performed for this documentation check.

## Checked evidence

| Area | Evidence and result |
| --- | --- |
| Palette and theme | `prayers.css` uses the incumbent `--bg`/`--surface`, `--ink`/`--muted`, `--green`/`--on-green`, `--mint`, `--soft`, and `--line` vocabulary through shared and local styles. It declares no new color literals or root tokens. Current prayer and on-time calendar states use paired action/foreground tokens. The dark work capture preserves the documented mint-on-deep-green relationship. |
| Type and hierarchy | The new screens inherit the existing system font stack and use rem-based sizes. The 2rem prayer hero and local form/display sizes remain surface-specific hierarchy, consistent with DESIGN.md's allowance for screen-specific headings. `Prayers.tsx:73` integrates the prayer name into the `h2`; no separate hero kicker remains. The current mobile capture reads “Time for Asr.” as one heading. |
| Forms and controls | `Prayers.tsx:7` reuses `Button`, `GroupRow`, `ProgressBar`, `SectionTitle`, and `Toggle`; it reuses `HabitCard` below the prayer flow. Main actions inherit the established 52px height, 16px radius, control type, action colors, focus outline, hover, press, and disabled treatments. Timetable and Fajr forms reuse the existing field language. Local 44px action targets and calendar controls follow the compact-control pattern. |
| Surface, depth, and layout | The prayer hero uses the existing 24px card token and mint fill. Forms, notes, and calendar cells use the established 12px/16px rounded geometry, tonal fills, and thin separators. The extension adds no shadow or animation vocabulary. Shared `.screen`, phone shell, bottom navigation, sheets, safe-area behavior, and reduced-motion rules remain in effect. The additional 374px media query is a local content adjustment, not a replacement global breakpoint scale. |
| App integration | `App.tsx:116` routes prayer details, timetable, Fajr, wake, and work-break views through the existing sheet mechanism; Today renders `SalahToday` at line 372. `Explore.tsx:59` adds the cumulative prayer garden and line 178 makes prayer history the Progress entry. `Personal.tsx:71` uses existing grouped settings. `Onboarding.tsx:107` changes the purpose and entry action while retaining the established screen and control system. Four persistent tabs and access to original habit screens remain. |
| Product-specific expression | Five named prayer anchors, Fajr preparation, the saved return note, explicit prayer recording, and separate streak/history explanations fit the approved direction contract. `WorkBreakFlow` contains no Pip, XP reward, or confetti component. Shared icons and the quiet progress garden extend the botanical vocabulary. Preview labels and truthful local-only messaging are product content, not new global visual rules. |

## Retention and preexisting drift

The pre-extension `outputs/RISE-prototype.zip` was compared with the current project before repackaging. `src/styles.css`, `public/assets/pip.png`, and `public/assets/trail.png` matched byte-for-byte. The only shared-component change was `type="button"` on `Toggle`; the only `Today.tsx` change was exporting `HabitCard` for reuse. Neither changes visual styling.

No material preexisting visual-system drift was established in this bounded comparison. The incumbent sidecar's original habit-oriented specimens and the design document's original habit examples remain valid reusable patterns. Their omission of prayer-specific compositions does not require treating those compositions as durable system tokens. The sidecar's synthetic tonal ramps remain preview aids as already documented. No drift repair was made.

The recorded finish review has `disposition: ship`: its single hero-hierarchy fix is resolved across the affected captures. `detect.json` contains an empty finding list. The parent reports a successful build and 27 passing domain tests; those checks were not repeated here. Still images and source inspection do not establish a separate motion or accessibility certification.

## Unchanged design-file hashes

Both files matched their pre-extension archive bytes and were rechecked after this report was written.

| File | SHA-256 |
| --- | --- |
| `DESIGN.md` | `76423b11a448863fa80125d13e5a3c9d56f3b04f5d51e8414e90cbfd58ec5767` |
| `.impeccable/design.json` | `9cd451a5ed4e571eacef8c3ffbf6e8526f5d2dda3681490eb0b42234a1744aec` |

This finish step created only `.impeccable/review/salah/documentation-check.md`. `DESIGN.md`, `.impeccable/design.json`, implementation files, README, and PRODUCT.md were preserved.
