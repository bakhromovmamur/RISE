# Daily life finish review

Disposition: **ship** — narrow verdict on F1; resolved.

Review date: 2026-10-20. Independent bounded finish review of the daily-life extension, followed by one verdict pass on F1 only.

## 1. Evidence and scope

The authority is `.impeccable/briefs/daily-life.md`, the pinned `DESIGN.md` and `.impeccable/design.json`, and the incumbent screenshots. This is a code-led extension of an established Operate interface. An approved comp is neither supplied nor required.

Opened and inspected all 18 required images from `manifest.json`: Daily life at 375, 393, 430 and desktop 1440; dark 393; large-text Today and family; prayer setup; family planning; shared list; invitation preview; Fajr alarm; readiness; paused Today and Progress; squad preview; Uzbek people and family. Every image shows its named state, with no blank or malformed regions. Also inspected the incumbent balanced and salah mobile captures for continuity.

Read the craft floor and relevant new-flow source, including `Life.tsx`, `LifeUI.tsx`, `Groups.tsx`, `lifeModel.ts`, `life.css`, and the shared prayer/progress/navigation integration. Source substantiates behavior that still images cannot demonstrate. The supplied verification record reports a successful production build, 53 domain tests and, following the final packet update, 22 browser scenarios. These runs were not independently repeated. The active hook reported no deterministic findings; later hints on frequently edited files were suppressed.

For the verdict pass, reopened all 18 refreshed captures and checked the F1 source changes and the new bilingual browser scenario. The final verification record reports the production build, all 53 domain tests and all 23 browser scenarios passing together. The final test visits the affected controls in both English and Uzbek and selects them by their accessible names.

All refreshed captures show valid named content. The manifest now distinguishes browser viewport from exported raster: Fajr and readiness were captured with a reported DOM viewport of 393 × 852, while the screenshot API exported their original JPEG bytes at 389 × 843. I independently confirmed those raster dimensions and reopened the two final files after the capture recheck. They are legible, complete viewport captures; this export scaling does not invalidate F1's source and accessibility-name evidence. Their dark appearance, and the dark pause captures, are recorded in the manifest.

This review does not certify backend behavior, real alarm delivery, external messaging, live timetables, or an exhaustive accessibility audit.

## 2. Direction and craft

The porcelain, forest and mint roles, system typography, rounded controls, grouped rows, fine dividers, sheets and four-tab shell remain consistent with the incumbent. The desktop framing also retains the existing preview composition and Pip artwork.

At all three normal phone widths, Today shows both reward cues and a complete actionable priority above the navigation. The new source/readiness row occupies the old compact prayer context without displacing that hierarchy. Family tasks and lists use straightforward rows, while Fajr gives the primary acknowledgement enough visual weight. Squad preview makes the exact shared content and the explicit publish action easy to distinguish.

No material visual-direction or layout correction is requested.

## 3. Usability and accessibility

The required captures show readable wrapping and no horizontal clipping at 375–430 px. The large-text captures reflow the prayer strip and family content rather than compressing the enlarged text. Dark appearance retains clear text and action hierarchy. The screenshot set supports visual readability, not measured contrast certification.

Simulation labels are visible in the focused flows. Pause is presented privately on Today and separately in Progress; it does not masquerade as prayer completion. The squad builder creates an explicit allowlisted snapshot, and the alarm acknowledgement changes the preview state without recording a prayer. Existing controls provide labelled inputs, checkbox/switch semantics and minimum hit areas; the supplied browser checks cover modal keyboard focus.

The Uzbek captures demonstrate translated navigation and visible new-flow copy. The initial review found several new controls overriding that translated copy with English-only accessible names. The verdict pass scores that gap resolved as detailed below; it does not reopen the rest of this review.

## 4. Material findings and actionable fixes

### F1 — P2: Complete the accessible names in Uzbek for the new flows — resolved

**Initial evidence:** `src/Life.tsx:71` used the English `${name} planned offset` name; line 94 gave the reminder switches English labels; line 147 overrode the translated readiness field with `aria-label="Preview device state"`. In `src/Groups.tsx`, line 138 named weekdays `Repeat Mon` etc.; lines 205–206 named reorder actions in English; lines 276–278 named the sharing switches `Include habit count`, `Include milestones` and `Include prayer total`; lines 294–300 retained English group-name, notification, removal and ownership-control names.

**Impact:** With the document language set to Uzbek, assistive technology receives English control names even where the visible label is Uzbek. This particularly affects the opt-in prayer-total switch: a user navigating by controls needs the same clear sharing choice as a sighted Uzbek reader.

**Bounded fix:** Use the existing `t(en, uz)` helper for those accessible names, or remove a redundant English `aria-label` where the translated enclosing label already supplies the correct name. Keep user-authored names, notes and task/list content untouched. This does not request localization of older screens.

**Acceptance:** In Uzbek, verify the accessible names for prayer offsets/reminders, readiness, task-repeat days, list reorder, all three sharing switches and the listed group controls. Confirm the English names still work in English. Return the same required screenshot matrix after the batch, with a focused DOM accessibility-name assertion for these controls; screenshot pixels alone cannot prove this fix.

**Verdict evidence:** Every named location now uses the existing `t(en, uz)` helper, including all three sharing switches. The shared navigation label is localized as well. The new browser scenario checks all five prayer offsets, ten reminder switches, readiness, seven repeat-day buttons, both list-reorder actions, group name/notifications/member removal/ownership and all three sharing switches in both languages. User-authored content is retained. The fix matches the requested scope and the English branch remains intact.

| Finding | Score | Remaining action |
| --- | --- | --- |
| F1 — new-flow accessible names in Uzbek | Resolved | None |

## 5. Disposition

**ship** — the reviewer scored F1 resolved. This verdict covers that single finding and the refreshed evidence's validity; it is not a new whole-surface audit or a blanket accessibility certification. No further correction is owed from this review. Documentation and final packaging remain the build thread's delivery steps.
