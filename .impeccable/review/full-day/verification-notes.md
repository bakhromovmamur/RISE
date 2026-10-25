# Full-day verification

21 October 2026, Asia/Tashkent. Implementation-owner evidence, not an independent certification.

## Build and tests

- Final production build passed: `index-3O6iX_SQ.js / index-gik2u5ez.css`.
- Domain suite: **53 passed**, run during this task. Domain and schema files have not changed since that run.
- Final full Chromium browser suite: **47 passed in 26.6 seconds**, isolated profiles on port 4180. This includes the three new `full-day.browser.spec.ts` scenarios and all 44 existing scenarios.
- Total: **100 passing tests**.
- Earlier implementation checks caught a TypeScript fixture assignment (`null` where an absent check is required) and two overly strict textarea label locators. The assignment uses deletion; tests now use the textbox role and accessible name. Final runs pass without retries.
- The terminal reports Playwright's benign `NO_COLOR`/`FORCE_COLOR` environment warning. This is not a browser error.

## Continuous browser rehearsal

On isolated origin `http://localhost:4174/?review=1`, explicitly loaded Full day once, then advanced its clock without resetting actions. The primary profile on port 4173 was not loaded with fixtures.

1. At 05:10 stopped the alarm, previewed its backup, and tapped I'm up. No prayer or XP was recorded.
2. At 05:35 explicitly recorded Fajr on time, saw the updated acknowledgment, and returned to Today.
3. At 08:00 logged reading full (+20), claimed Pip's scarf at 250 lifetime XP, and logged a tiny walk (+10).
4. Recorded Dhuhr at 12:20. Opened the Asr reminder from You, saved “Connect the save button, then test the empty state.”, stepped away, recorded Asr at 15:45, and returned to Today with the note intact.
5. Logged a full building session (+20). All three priorities remained completed; total XP was 280. The three-check-in demo coffee reward became earned.
6. Recorded Maghrib at 17:45 and Isha at 19:05.
7. Opened the weekend family task, used its new direct family-lists route, checked Apples, returned and completed the task. No XP was awarded.
8. Inspected Progress: five prayers on time, three of four scheduled habits. Explicitly completed the first working-screen goal milestone; no extra XP. Followed Rewards in Journey and marked coffee enjoyed.
9. At 22:00 opened the next Fajr plan from You. Saved the Oct 20 plan: bedtime 22:30, wake 05:10, backup three minutes later, phone across the room, and “Feet on the floor. I have made room for this.”
10. Returned to Today and reloaded. Prayer/habit/family/list/milestone/reward/plan state persisted. Tomorrow's prayers remained unrecorded.

The full-day fixture retains labelled fictional prior history (230 initial XP). Only its demonstration weekly reward has a threshold of three. Other profiles and reward conditions are untouched.

## Visual inspection and corrections

Opened every final capture named in `manifest.json` using the local image viewer. The 18 public images are byte-identical to their evidence copies. The manifest records requested viewports and actual unmodified export dimensions: 375 → 371×843; 393 → 389×843; 430 → 426×844; desktop 1440×1000 → 1436×997. Do not claim these image files are exact requested dimensions.

Evidence covers dark Fajr, normal mobile 375/393/430, the whole day's handoffs, desktop replay, and Uzbek 200% text. The local browser returned an unusable `M10` month for the newly added Uzbek date, so the plan now uses an explicit numeric day.month.year. Enlarged text split clock digits and crowded the sheet header; clocks now stack intact and the full-sheet header grows with its heading. The final two large-text captures confirm those corrections. Two wrongly framed/labelled preliminary captures were replaced or removed from the deliverable.

The manifest identifies capture builds. Final CSS changes affect large-text layout and prohibit clock-digit wrapping; ordinary English and dark captures have the same rendered content. No second broad visual sweep was performed. Keyboard and focus, date freezing, explicit correction, local draft preservation, and no horizontal overflow at all three widths are covered by the browser scenarios. Reduced motion was enabled for the light rehearsal.

## Scope and limitations

No schema, storage key, domain XP/reward/prayer calculation, original artwork, DESIGN.md or design sidecar change. The active hook suppressed further hints on repeatedly edited `context.tsx`; it reported no new deterministic issue. No separate detector ran.

This is local Chromium/in-app-browser evidence, including the prototype's explicit 200% mode. It does not establish physical-device, Safari/WebKit, screen-reader or exhaustive accessibility coverage. Real alarms, notifications, timetable fetching, invitations, cloud sync and purchases remain outside the prototype.

The final main tab was reloaded from the new build: its original 14:00 day, two prayer records, three tiny priorities, unclaimed scarf, coffee at 3/5, planned Asr 15:50, saved Fajr plan and original return note remain visible. Both main and rehearsal tabs returned no browser warnings/errors. The browser viewport override was reset and rehearsal language returned to English. The two origins remain live; the rehearsal is left at bedtime on Today for inspection.
