# Recovery-day independent finish review

Reviewed 2026-10-21. Verdict: **Ship the scoped refinement. No material findings.**

This was a fresh, independent review of the difficult-day brief, DESIGN.md, the design sidecar, the capture manifest and verification notes. The reviewer read the relevant changes in `Prayers.tsx`, `Balanced.tsx`, `Today.tsx`, `demo.ts`, `App.tsx`, `prayers.css`, `balanced.css`, and `tests/recovery.browser.spec.ts`, comparing the seven product files with `work/recovery-before/src`. Supporting navigation and domain code was read to trace the affected behavior. No product source, design authority, or other documentation was changed.

## Material findings

None found within the requested recovery-day scope.

- A missed or later prayer remains explicit and correctable. The recovery message leads with a useful Today return while retaining the honest streak break and earlier records. It does not invent prayer completion or spiritual judgment.
- An expired save form replaces the obsolete step-away/countdown prompt with a record-or-return choice. The note is still bound to saved state. Returning without a record changes only the break stage; recording a matching prayer updates the return state and its status copy. The existing Today shortcut clears sheets, returns to the top, and focuses the heading.
- Today offers the existing priority editor and promotes an actual tiny check-in when one is available. Removing priorities does not mark habits complete. The bedtime explanation distinguishes unfinished history from tomorrow's scheduled plan; the completed-priority message is appropriately limited to priorities while the routine still reports unfinished work.
- The explicit Difficult day fixture supplies fictional prior achievements and leaves the new day's prayer and habit records uncompleted. Reviewer checkpoints only move time. The changed UI paths do not modify XP, reward, goal, or occurrence rules.

The recovery tests exercise meaningful state and user outcomes: an explicit miss, independent prayer streaks, priority removal without completion, expiry while a form is open, saved drafts, later/missed/corrected records, an unlogged return, exactly 10 XP for a tiny check-in, preserved earlier earnings and goals, reload, next-day scheduling without duplicate backlog, and a zero-check-in day. Their assertions support the brief rather than merely repeating rendered copy.

## Capture validity and identity

All **14 supplied JPEGs were opened individually at original detail and visually inspected**. JPEG dimensions were independently read from the files. Every measured size matches `exportedPixels`; every SHA-256 matches the manifest; every corresponding `screens/recovery-day` copy is byte-for-byte identical.

| Capture | Actual pixels | Visible evidence and result |
| --- | --- | --- |
| `missed-fajr.jpg` | 389 × 843 | Dark missed-Fajr record for Oct 20, supportive streak explanation, Today action, and explicit corrections. Valid. |
| `small-step-375.jpg` | 371 × 843 | Dark Today at 08:00, retained-progress copy, lighter-plan action, and a one-page/+10 primary step. Valid. |
| `expired-asr-note.jpg` | 389 × 843 | Expired 17:45 Asr window, intact return note, Record Asr and Back to Today, with unlogged-return explanation. Valid. |
| `later-asr-return.jpg` | 389 × 843 | Asr explicitly shown as prayed later, saved note, copy action, and Today return. Valid. |
| `bedtime-unfinished.jpg` | 389 × 843 | Oct 20 at 22:00, permission to leave the rest, history/no-backlog explanation, and a still-uncompleted tiny reading action. Valid. |
| `one-priority-done.jpg` | 389 × 843 | Deliberately scrolled: reading marked tiny complete, earned coffee, and two routine items still to do. Valid. |
| `honest-progress.jpg` | 389 × 843 | Eight on-time prayers, four of seven habit check-ins, one milestone, one earned reward, and fictional-history disclosure. Valid. |
| `prayer-history.jpg` | 389 × 843 | Tuesday missed Fajr and later Asr remain visible; Wednesday Fajr is on time and its current streak is one. Valid. |
| `earned-reward-430.jpg` | 426 × 844 | Coffee still earned on Oct 19, four of three qualifying check-ins, and explicit Mark as enjoyed action. Valid. |
| `tomorrow-ready.jpg` | 389 × 843 | Oct 20 at 22:00, saved Oct 21 Fajr plan, and tiny priority completion remain visible. Valid; reload, 290 XP and enjoyed-reward persistence are runtime assertions, not independently visible in this frame. |
| `next-morning.jpg` | 389 × 843 | Oct 21 at 05:35, on-time Fajr and fresh uncompleted scheduled priorities. Valid; exact XP and complete historical state rely on the runtime evidence. |
| `desktop-recovery-review.jpg` | 1436 × 997 | Intact desktop phone preview and Pip, labelled Difficult day reviewer fixture, next morning state, and 290 XP. Valid. |
| `missed-fajr-large.jpg` | 389 × 843 | Enlarged-text missed-Fajr record; date, status, time columns and recovery heading wrap within the sheet. Valid as the upper part of the paired view. |
| `missed-fajr-large-action.jpg` | 389 × 843 | Deliberately scrolled enlarged-text recovery explanation and Today/correction actions remain readable within the sheet. Valid. |

The exports are smaller than the requested viewport sizes: 371 × 843 for requested 375 × 852; 389 × 843 for 393 × 852; 426 × 844 for 430 × 852; and 1436 × 997 for 1440 × 1000. The manifest reports that distinction accurately. These are valid visual references, not proof of exact pixel dimensions in the browser viewport.

The images preserve RISE's porcelain/forest/mint roles, paired dark action colors, familiar system typography, rounded controls, sheets, four-tab shell, and original Pip. The new CSS adds restrained spacing and type treatment using existing tokens. No material clipping, overlap, illegible recovery action, or competing visual direction was found in the supplied views. The enlarged-text pair shows the recovery action after scrolling; it does not purport to fit the entire sheet into one viewport.

## Evidence limits

The reported 53 passing domain tests, 50 passing Chromium browser tests, final successful build, and final focused three-test recovery pass are **supplied owner evidence**, not reruns by this reviewer. The final build is reported as `index-B4wVnNki.js` / `index-BOhwQIzY.css`. Nine captures use the prior `index-BODIVMPg.js` build; five use the final build. The manifest attributes the intervening source adjustment to chronological reviewer checkpoints and deriving the after-Asr time from its window. The reviewed diff is consistent with that limited adjustment, but build provenance and continuous live actions were not independently reproduced.

Screenshots establish visible state and presentation, not persistence, primary-profile isolation, full keyboard behavior, or all data invariants. Those conclusions additionally depend on the inspected implementation and supplied execution evidence. This review did not open a browser, run tests/builds/servers/detectors, access agent definition files, inspect a physical device, or perform assistive-technology certification. Uzbek enlarged-text coverage is supplied automated overflow evidence; the supplied enlarged-text images are English.

The review stayed within the difficult-day refinement. Existing documentation drift, broader localization, unrelated screens, and new product design directions were not evaluated or changed. No additional polishing or redesign is requested.
