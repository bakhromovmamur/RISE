# Difficult-day verification

Completed 2026-10-21 against the local prototype. The final production build is `index-B4wVnNki.js` / `index-BOhwQIzY.css`.

## Behavior and tests

- `npm test`: 53 domain tests passed (163.974 ms). Existing prayer timing, streak-gap, Fajr, habit XP, rewards and group behavior remain covered.
- `npm run test:browser`: all 50 Chromium browser tests passed (31.7 s), including three new difficult-day scenarios. The initial focused recovery run also passed all three (12.2 s).
- After the only subsequent source adjustment (review checkpoints sorted chronologically, with the after-Asr time derived from the prayer window), `npm run build` passed and the three recovery browser scenarios passed again (11.7 s).
- New coverage: explicit missed Fajr without erasing history; unchanged independent prayer streaks; priority removal without completion; expired open Asr form and saved draft; explicit later/missed/corrected records; unlogged return; one tiny check-in worth exactly 10 XP; earlier goals, claimed cosmetics and reward eligibility preserved; reload persistence; next-day scheduled occurrences without duplicates/backlog; zero-check-in day; Uzbek 200% text overflow checks at 375/393/430.

## Continuous live rehearsal

The separate origin at `http://localhost:4174/?review=1` explicitly loaded **Difficult day · one small step** once. It begins on Tuesday Oct 20 at 08:00 with labelled fictional prior history: 280 XP, Monday's five on-time prayers, three check-ins, one goal milestone, Pip's scarf and an earned coffee reward. Tuesday starts unrecorded. The main profile at port 4173 was not reset or used for the rehearsal.

Live actions: explicitly marked Fajr missed; used Make today lighter to keep only reading as a priority; recorded Dhuhr on time; saved an Asr return note and requested 60 seconds; advanced the demo clock past its window while the form stayed open; explicitly recorded Asr later; recorded Maghrib and Isha on time; left the routine unfinished until bedtime; logged just one page of reading; viewed Progress and the earned reward; marked the coffee enjoyed; saved the dated Oct 21 Fajr plan; reloaded; advanced to the next day and explicitly recorded Fajr on time. XP ended at 290. Fajr restarted at one with its best of three retained. The other scheduled habits remained uncompleted and were not duplicated as extra tasks tomorrow.

The new supportive text explains an honest streak break rather than silently forgiving or inventing completion. Family tasks and goal milestones still do not award habit XP. Returning from a stale reminder can keep the prayer unlogged; the note survives. No permission, invitation, timetable service or actual alarm was invoked.

## Visual pass

One bounded capture review covered requested phone widths 375/393/430, 1440 desktop, dark and light, and English 200% text. All 14 final captures were opened and inspected. No material product visual defect was found. Two misframed captures were replaced, and a scrolled large-text capture was added to show the recovery action. Actual exported dimensions (371×843, 389×843, 426×844, 1436×997) and build provenance are in `manifest.json`; they are not exact requested viewport dimensions.

Prior automated navigation/focus/reduced-motion coverage remains passing. The new test verifies the Today heading receives focus after recovery. Live rehearsal used Reduce motion in the demo profile. No full assistive-technology or physical-device certification is claimed.

## Scope and authority

No persisted schema, storage key, financial transaction, native notification or backend change. New fixture achievements are explicitly fictional. DESIGN.md and the design sidecar were left unchanged. Previously noted heading/navigation documentation drift is outside this task. No new detector suppression was added for these edits.

Fresh independent finish review and documentation handoff follow this owner verification; their reports record their own limits.

## Main-profile handoff

After the final build, reloaded the existing 4173 tab and inspected Today and Journey without changing its records: Monday Oct 19 at 14:00, Fajr/Dhuhr on time, Asr planned 15:50, three tiny priorities, 260 XP, scarf ready but unclaimed, coffee 3/5, saved Oct 20 Fajr plan and original work note. Returned it to Today. Reset the browser viewport and retained both deliverable tabs. The 4174 rehearsal remains at Wednesday Oct 21 05:35 after explicitly recording Fajr, with the Difficult day option selected for an optional fresh replay.
