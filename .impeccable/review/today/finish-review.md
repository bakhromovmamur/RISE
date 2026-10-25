# Today finish review

## Disposition

**Ship.** Both material findings are resolved. The final mixed-priority capture confirms a readable compact milestone followed by the expanded first unfinished habit. The calmer Today refinement meets the new direction at this bounded scope; no further design iteration or recapture is required by this review.

## Capture validity/coverage

The initial finish pass opened and visually reviewed all 18 then-supplied JPGs. After the two corrections, the implementation owner refreshed the same matrix and added `mixed-priorities.jpg`. The current `manifest.json` identifies build `index-YrJDMdMO.js / index-BNJQMM-t.css`, capture time `2026-10-20T14:16:57.981407+00:00`, and the isolated review origin `http://localhost:4174`; it records matching viewport and exported dimensions for all 19 images.

The final narrow pass opened `mixed-priorities.jpg` and checked it against the corrected source and regression test. The refreshed full matrix was not subjected to another cosmetic review.

| Captures | Dimensions | Coverage |
| --- | --- | --- |
| `mobile-375.jpg` | 375 × 852 | Narrow mobile, top |
| `mobile-393.jpg` | 393 × 852 | Primary mobile, top |
| `mobile-430.jpg` | 430 × 852 | Wider mobile, top |
| `desktop.jpg` | 1440 × 1000 | Desktop phone presentation |
| `user-703.jpg` | 703 × 753 | Actual user viewport |
| `rest-collapsed.jpg` | 393 × 852 | Rewards and collapsed secondary sections |
| `routine-open.jpg` | 393 × 852 | Routine disclosure |
| `family-open.jpg` | 393 × 852 | Family disclosure |
| `goals-open.jpg` | 393 × 852 | Goals disclosure |
| `busy-routine.jpg` | 393 × 852 | Nine remaining routine habits |
| `prayer-due.jpg` | 393 × 852 | Due prayer takes primary-action prominence |
| `prayer-pause.jpg` | 393 × 852 | Private pause |
| `evening.jpg` | 393 × 852 | Elevated evening Fajr preparation |
| `empty.jpg` | 393 × 852 | Empty setup |
| `completed.jpg` | 393 × 852 | Three completed priorities |
| `dark.jpg` | 393 × 852 | Dark appearance |
| `large-text.jpg` | 393 × 852 | Dark appearance, 200% root text, top |
| `large-text-rest.jpg` | 393 × 852 | Dark appearance, 200% root text, secondary sections |
| `mixed-priorities.jpg` | 393 × 852 | Compact milestone before an expanded unfinished habit |

The lower-section images intentionally begin below the top of the scrolling panel; their partial rows at the viewport boundaries are not layout defects. There is no supplied replacement comp or quality-bar image. The existing system and the new Today brief are the visual authorities.

The mixed-priority image closes the initial coverage gap: “Build the first working screen” remains readable beside a compact completion button, and “Read a little” directly below it exposes full and tiny actions. The title, both action groups and their row separation are visible at 393 × 852.

## Request and direction fit

The user asked to reduce the number of competing things in Today and place them clearly. The new brief correctly supersedes the prior Daily life first-viewport ordering.

In the reviewed captures, the prayer strip and next-prayer summary lead. At 375, 393 and 430 pixels, the first pending habit is fully actionable and the other priorities remain compact. The 703 × 753 preview also shows the complete featured habit action. The due-prayer state gives the prayer-break button the strongest emphasis and quiets the habit action. Private pause remains explicit and supportive.

Rewards are two restrained rows. Routine, Family and Your goals use readable labels, counts and consistent disclosure affordances. Their expanded contents remain inline. The completed state retains all three completed priorities and does not present replacement chores. Fajr appears once and moves higher in the evening. Source retains access to tiny completion, upgrade, Undo and linked goals through habit details, along with the active prayer-break entry and the lower saved return note.

The porcelain, forest and mint palette, system typography, original assets and familiar control shapes remain consistent with the pinned design system. The 200% text captures wrap into a longer vertical flow without visible horizontal content loss. No material style or accessibility defect is visible in the supplied captured states.

## Material findings

| Finding | Final score | Remaining action |
| --- | --- | --- |
| F1 | Resolved | None |
| F2 | Resolved | None |

### F1 — P2: Compact milestone action inherits full-row width — resolved

**Original evidence:** The later `.milestone-priority .button { width: 100%; }` rule overrode the equally specific compact `44px` rule, allowing the action to consume the row and collapse its summary.

**Resolution:** `src/balanced.css:62` now uses `.today-focus .compact-milestone .button`, so its `44px` width wins over the legacy rule at line 122. The final mixed-priority image visibly retains the milestone title and compact completion control. The added browser regression checks that the summary width exceeds twice the control width. No partial or unresolved portion remains.

### F2 — P2: A task or milestone can prevent the first unfinished habit from expanding — resolved

**Original evidence:** `nextHabit` selected the first unfinished priority of any kind. An earlier task or milestone therefore prevented a later pending habit from receiving the expanded full/tiny controls.

**Resolution:** `src/Balanced.tsx:92` now selects `p.kind === "habit" && !isDone(p)`. This excludes both task and milestone priorities while retaining saved order. The final mixed-priority image shows the pending milestone first and the expanded reading habit second. The added browser regression arranges this order, confirms the reading action remains visible, completes the milestone, and verifies unchanged habit XP and saved priorities. No partial or unresolved portion remains.

## Verification/limits

The initial independent read-only finish review covered `PRODUCT.md`, `DESIGN.md`, `.impeccable/briefs/today-clarity.md`, the capture manifest, all 18 original images, the relevant implementation in `Balanced.tsx`, `Today.tsx`, `Habits.tsx`, `Development.tsx`, `Groups.tsx`, and `balanced.css`, with supporting shared styles inspected for the findings. The Impeccable craft floor was applied subject to the pinned system. The final pass was limited to F1/F2: corrected source, current manifest, `mixed-priorities.jpg`, and the added case in `tests/today.browser.spec.ts`.

The implementation owner reports a passing final production build, all 27 browser scenarios passing in 16.9 seconds, no browser-console errors, preserved primary user storage, unchanged design authority hashes, and an active detector with no outstanding new findings. The 53 domain tests previously passed and domain source is unchanged by the final corrections. Those execution results were supplied evidence; this reviewer inspected the new regression's assertions but did not rerun tests, use a browser, run another detector, or modify implementation.

Native disclosure semantics and visible-focus styles are present in source. The existing browser scenario evidence supports keyboard behavior, but this review does not establish physical-device, Safari/WebKit, VoiceOver or full accessibility certification. Saved-state preservation and lack of new backend/notification behavior are supported by the source scope and supplied verification, not by screenshots alone.
