# Historical implementation guide — 21 October 2026

This preserves the README before the mobile-web production planning pass. Dates, ports, saved-profile descriptions, package versions and test counts below are historical evidence, not live deployment status. Use [the current README](../../README.md) and [PRD](../../PRD.md) for the active release scope. Relative documentation links have been adjusted for this archive location.

---

# RISE — Daily life around salah

A local React + TypeScript mobile prototype for five daily prayer anchors, unlimited habits, three daily priorities, milestone-based goals, personal rewards, family plans and private squad updates. The four tabs remain **Today, Journey, Progress and You**.

Today holds the next prayer and immediate actions; Journey owns unlocks and personal rewards; Progress explains prayer, habit and goal history; You holds preferences and people. Shared headings and spacing keep the tabs consistent. Bottom navigation preserves each tab’s reading position, open sections and selected Progress week/view. Explicit shortcuts arrive at the destination’s top and focus its heading.

Fresh browser storage opens **Daily life**, a labelled, fictional Monday 19 October 2026 at 14:00 in Asia/Tashkent. Prayer times, other members and their activity are illustrative. Existing profiles migrate in place; migration never inserts sample people, tasks, lists, updates or pauses.

## Run

```sh
npm install
npm run dev -- --port 5173
```

Open [the development app](http://localhost:5173/), or serve the production build:

```sh
npm run build
npm run preview -- --port 4173
```

[Open the Daily life preview](http://localhost:4173/?v=daily-life). The `v=daily-life` query is a release label; it **does not reset an existing profile**. Use Reviewer controls to install a scene. Serve `dist/` over HTTP, not by opening its HTML as a file. No API key, account or cloud service is needed.

## Use Russian

Choose **You → Settings → Language → Русский**; in Russian the path is **Вы → Настройки → Язык**. The selection persists after reload. [RISE на русском](../../RUSSIAN-LANGUAGE.md) explains the entry path and translated demo scenes.

Russian covers all four tabs, onboarding, older habit/goal/reward/history screens, prayer and Fajr flows, family lists and squads, settings, help, validation, accessibility names and reviewer controls. Dates, quantities and plural forms use Russian formatting. **Saved names, notes, reflections and other authored content stay as written**, including existing English demo names. Switching language changes the language preference without rewriting progress or content. English and the existing Uzbek paths remain available; generic Uzbek dates keep their stable English month labels, while the Uzbek Fajr-plan date retains day.month.year.

The [main saved profile](http://localhost:4173/?v=daily-life) is open on Today in Russian, with three completed tiny priorities, 260 XP, planned Asr at 15:50, the October 20 Fajr plan and the original work note preserved. It was never reset. The separate [Russian Daily life rehearsal](http://localhost:4174/?v=russian) is also on Today: October 19 at 14:00, 240 fictional XP, Russian built-in examples, one of three tiny priorities completed and an illustrative October 20 Fajr plan. Both origins remain open; the `v` queries are labels and do not install fixtures.

Explicitly loading a demo scene retains the selected language and creates localized built-in examples. It replaces only that origin's saved data. The walkthroughs and scene table below retain their English labels for replay; the Russian guide supplies Russian entry points. Earlier full-day and difficult-day live-state reports describe their releases, not the current port-4174 scene.

## Try a difficult day

[Follow the difficult-day walkthrough](../../DIFFICULT-DAY-WALKTHROUGH.md) through missed Fajr, a vibecoding session that runs past Asr, unfinished habits, one small check-in and the next morning. That recorded rehearsal finished on Wednesday, October 21 at **05:35 with 290 XP**. The shared [rehearsal origin](http://localhost:4174/?review=1) now holds the Russian Daily life scene described above; select and load Difficult day to replay it. The [main profile](http://localhost:4173/?v=daily-life) remains preserved.

To replay, select **Difficult day · one small step** in **Review the prototype**, then **Load selected fixture** on port 4174. Load it once. It begins Tuesday, October 20 at 08:00 with unrecorded Fajr and labelled prior fictional accomplishments: 280 XP, Monday’s five on-time prayers, three check-ins, one goal milestone, Pip’s scarf and an earned coffee. Loading replaces only that browser origin’s saved prototype data. Use **Day checkpoint** and **Advance one local day** to move time while retaining actions and drafts; neither records activity.

- **Missed or later prayer → Today:** an honest streak explanation, a direct **Back to Today** action and clearly labelled correction choices help you continue. Earlier prayer records, habit XP, goal progress and earned rewards stay.
- **An expired work break:** the open save form updates when the prayer window ends. The note remains saved; choose **Record Asr** or return with the prayer still unlogged. A later record is shown accurately on return.
- **A smaller day:** Today offers the tiny action first and **Make today lighter** opens the existing priority editor. Removing a priority completes nothing. At bedtime, the explanation makes clear that unfinished habits stay in that date’s history; tomorrow receives its own scheduled plan without an extra backlog.

The rehearsal finished with just one page of reading (+10 XP), the earlier earned coffee still available to enjoy, a saved dated Fajr plan, and an explicit on-time Fajr record the next morning. Fajr restarted at one while its best of three remained. See [the recovery captures](../../screens/README.md) for the recorded states.

## Walk a full day

[Follow the Fajr-to-bedtime walkthrough](../../FULL-DAY-WALKTHROUGH.md) to connect Today’s actions, Journey’s rewards, Progress’s records and You’s preferences and family spaces. Its completed-day captures document the preceding rehearsal. Port 4174 is a shared rehearsal origin and currently holds Russian Daily life; select and load the Full day fixture to replay it.

To replay, select **Full day · Fajr to bedtime** in **Review the prototype**, then **Load selected fixture** on port 4174. Load it once. Use **Day checkpoint** to move from wake-up to bedtime without resetting actions or drafts. Loading replaces that browser origin’s saved prototype data; merely selecting a scene or checkpoint never records activity.

Four handoffs were corrected:

- **Fajr acknowledgment → Today:** the alarm screen reflects the actual prayer record, including corrections, and returns directly to Today. **I’m up** still records no prayer or XP.
- **Work break → Today:** **Back to Today** selects and focuses Today even when the reminder began in You; the saved return note remains available.
- **Family task → shared list:** task details open that family’s Lists section directly, with the back path to the task retained.
- **Bedtime → next Fajr:** the plan names its target date, keeps that date while open, and shows saved status while its values match the saved plan. Its return action opens Today.

At 200% text, Fajr and wake-up times stack without splitting digits and the sheet header grows to fit its heading. The Uzbek target date uses a numeric day.month.year format.

## Try Daily life

1. **Today:** prayer context leads into **Your priorities**. The first unfinished habit shows full/tiny actions, even when a milestone or family task comes before it. Other priorities are compact rows with direct completion controls; tap a habit for tiny, upgrade, Undo and linked goals. Completed priorities stay completed. Two quiet reward rows follow the priorities. Under **The rest of your day**, expand **My routine**, **Family** or **Your goals** inline; each shows a summary or count. Family appears when a family space is available.
2. **Prayer setup:** open the city/source row or **You → Prayer preferences → Prayer times**. Choose Tashkent, Samarkand or Bukhara, a labelled source preview and planned offsets. Save installs authored sample times for today and the next seven dates, preserving already-recorded prayer snapshots. Both source choices use fixtures; neither downloads nor calculates real times. The manual per-date timetable form remains available.
3. **Prayer reminders:** choose the preparation lead time and per-prayer preparation/due-time preferences, which save automatically. Preview both prompts. **Save & step away** opens the retained return-note flow with its optional single wrap-up minute.
4. **Prepare for Fajr:** the single Today entry sits below the secondary sections during the day and moves directly below prayers from Maghrib. The plan shows its target date. Save bedtime, wake lead, phone placement, a message and optional backup interval; the saved confirmation persists while these values match the saved plan. **Save & preview wake-up** opens the primary alarm simulation. Try **Stop this alarm**, **Preview backup alarm**, then **I’m up**. Acknowledgment dismisses the backup in the preview and never records a prayer.
5. **Alarm readiness:** inspect ready, permission-needed, more-times-needed and waiting-for-iPhone examples. Simulation buttons change local state; they do not inspect a device, request permission, refresh a live timetable or schedule an alarm.
6. **Period mode:** open **You → Prayer preferences → Period mode**, select a date and starting prayer, then pause. Today and Progress show the private pause. Existing records remain; affected unrecorded prayers are excluded from completion/miss counts and hold streaks without growing them. Earlier unresolved gaps remain unresolved. Resume from a chosen prayer with an explicit include-current-prayer choice.
7. **Family planning:** open **You → Family → Our family**. Create/edit a task, assign it to yourself, a fictional member or anyone, and choose a date/time and optional repeat days. Pin it to your three priorities, complete it and undo. If all slots are occupied, choose a priority to replace. Each recurring date has its own completion. Archive/restore preserves history; tasks award no habit XP.
8. **Shared lists:** inside the family space choose **Lists**, or use **Family shared lists** from a task to open that family’s lists directly. Create/rename a list; add, edit, reorder, check, uncheck or remove items with quantities/notes. Archive or restore the list. All changes stay in this browser.
9. **Squad reflection:** in **You → Squads**, open the demo squad and **Share my week**. Write a reflection and opt into a habit count, completed milestone titles or a prayer total. New updates start with these switches off. Preview the exact snapshot, then explicitly **Publish to demo squad**. React, edit/republish or withdraw. Published values do not change automatically with later personal activity.
10. **Membership/settings:** try sample invitations, local acceptance by a fictional member, revocation and member removal. Rename a group, save notification preferences/quiet hours, transfer ownership, leave or archive/restore. Owners must transfer ownership before leaving. Invitation codes have no external destination; nobody is contacted.
11. **Language:** **You → Settings → Language** offers English, Uzbek Latin and Russian. Russian covers the complete interface, including older screens, forms, errors and accessibility names. Existing English/Uzbek behavior remains; Uzbek coverage is still shared navigation and newer Daily life controls. User-authored names, notes and content remain as written.
12. **Progress:** start with three closed native summaries: **Salah, Habits and Goals**. Open a row for its breakdown or use the existing views for deeper history. One **Rewards in Journey** row reports current availability and opens Journey; it stays separate from the selected week and replaces repeated reward detail cards. One quiet reflection entry follows.
13. **Journey:** start with one Pip unlock and the clearly named **Personal rewards** section featuring one reward. Open the unlock to preview or claim it; its target uses **lifetime habit XP**. Open the personal reward to see its named goal or dated weekly check-in condition, then explicitly mark an earned reward as enjoyed. Use **Feature on Today & Journey** to select a reward; earned rewards appear first. Expand **All rewards & history** for management and **Explore Pip’s trail** for the full trail, or open **Pip’s collection** to revisit keepsakes.
14. **You:** a compact profile opens Pip’s collection. Four rows lead to **Prayer preferences**, **Family**, **Squads** and **Settings**. Family/Squads open their matching hub view directly. Prayer preferences groups times, reminders, Fajr, readiness and private period mode. Settings keeps name, language and habits near the top; expand **Appearance & comfort**, **Habit reminders** or **Your data** only when needed. Settings and new navigation support English, Uzbek and Russian.

[Current screenshot guide](../../screens/README.md) · [Design board](http://localhost:4173/?design=1)

A due prayer has the strongest action; the expanded habit action becomes secondary. An active prayer break stays near the top, while a completed return note sits lower. At the reviewed normal phone sizes and 703 × 753 preview, the first unfinished habit remains actionable; rewards may require scrolling.

Today has one city/source timetable entry, with **Record** retained when available. The timetable button’s accessible name includes its complete visible label in English, Uzbek and Russian. Navigation alone never records activity, awards XP or claims a reward.

## Retained complete-day flows

- **Habits/priorities:** full/tiny/upgrade/Undo, unlimited habits and persisted ordered priorities remain. Completed priorities stay completed without automatic replacement; other scheduled habits remain reachable on Today.
- **Goals:** create an outcome with ordered milestones and linked habits, then complete, correct, pause or archive it. Habit check-ins never automatically complete milestones.
- **Progress:** Overview, Salah, Habits and Goals share one Monday–Sunday week selector. Prayer calendars and daily habit charts remain available; prayer milestones, individual habits and lifetime statistics open on demand. Current-week habit denominators stop at today. Goals distinguish selected-week movement from current overall progress. The single Journey link reports rewards available now; full reward conditions and lifetime XP remain in Journey. Opening a summary changes no saved records.
- **Journey/rewards:** the first view shows an earned, unclaimed Pip unlock before the next threshold, with a matching lifetime-XP target. One personal reward is featured: earned first, then the selected or another active reward, with its goal or fixed-week condition. Native disclosures retain the full reward list, enjoyed/archived history and original illustrated trail; at 200% text the trail becomes a static vertical list. Creation, editing, claim/equip, selection, enjoyment, corrections and archive/restore remain available. **Try next week** creates a separate attempt for the following week. Opening disclosures, claiming cosmetics and enjoying rewards add no XP.

## Demo scenes

Reviewer controls are outside product navigation in the desktop sidebar. On phones use [review mode](http://localhost:4173/?review=1). **Load selected fixture replaces this browser’s saved prototype data. Export first to retain a personal profile.** Merely selecting an option does not load it.

| Scene | What to explore |
| --- | --- |
| Difficult day · one small step | Tuesday starts at 08:00 with unrecorded Fajr and 280 XP from labelled prior accomplishments; rehearse missed/later records, a lighter plan and the next morning. |
| Full day · Fajr to bedtime | Cumulative rehearsal from 05:10 to 22:00, with unfinished current-day actions, labelled prior history and a three-check-in demo coffee reward. |
| Daily life · prayer, habits & family | Default complete day with source/readiness, family tasks, a shared list and squad alongside goals/rewards. |
| Family planning · tasks & lists | Opens the fictional family’s task/list space. |
| Squad reflection · share your week | Opens the squad feed and opt-in weekly sharing. |
| Fajr morning · alarm simulation | Primary wake-up preview; prayer records remain separate. |
| Prayer pause · private space | Pause beginning at Asr, retaining earlier records. |
| Needs attention · device preview | Waiting-for-iPhone readiness example. |
| Balanced day · goals & habits | Retained reading, exercise, learning and vibecoding; three priorities, two linked goals, 10 XP to Pip’s scarf and 1/5 reward check-ins. |
| Busy day · 12 habits | All habits remain reachable, including a long name. |
| Prayer due · Asr pause | Asr at the illustrative planned time with save-and-stop. |
| Three priorities complete | Completed priorities remain; other actions stay available. |
| A personal reward earned | A reward awaits explicit enjoyment. |
| Ten minutes before Asr | Preparation before the planned time. |
| Fajr · wake-up | Retained early-morning prayer scene. |
| Evening · prepare for Fajr | Fajr preparation below the prayer overview. |
| All five on time | Explicitly recorded prayer completion. |
| An unconfirmed Fajr | Unresolved history and streak gap. |
| Fresh Start · onboarding | Personal onboarding using the device date/timezone. |
| Returning after a missed day | Retained recovery fixture. |
| All checked in · mixed | Retained full/tiny habit fixture. |
| Planned rest day | Retained scheduled-rest fixture. |
| Empty · set up your day | No invented habits, goals, people, achievements or prayer history; working setup actions. |

The demo clock, **Day checkpoint** and **Advance one local day** make timing inspectable without changing the operating-system clock. Checkpoints are ordered chronologically, change only the demo time and keep actions and drafts; do not reload the fixture between checkpoints. The after-Asr checkpoint follows that date’s window end. The three-check-in coffee condition belongs to the explicit Full day and Difficult day rehearsal fixtures. `?text=large` is a review-only 200% root-text option, not a saved product preference. In that mode, bottom navigation uses two roomy rows and content scrolls above it.

## Rules that keep progress honest

- **Salah:** explicit on-time, later or missed records. Unlogged expired prayers stay unresolved. Recording opens when the prayer window begins. Later or missed records break that prayer’s on-time streak; other prayer streaks, earlier records, habit XP, goal progress and earned rewards remain. Corrections remain explicit. Prayers, Fajr preparation, alarm acknowledgment and return notes award no habit XP.
- **Private pause:** recorded prayers remain unchanged; excluded prayers are neither completed nor missed. Pause does not repair gaps, add all-five days or advance streaks. In demo mode it suppresses previews. In live mode it reconciles the phone queue to cancel affected RISE reminders and Fajr alerts; other apps’ alarms are untouched.
- **Habits:** full = 20 XP, tiny = 10 XP, upgrades add the remaining 10; maximum 20 per scheduled occurrence. Weekly rewards count full/tiny once, including retained archived history. Future actions are upcoming. Unfinished occurrences remain on their original date; tomorrow gets its own scheduled occurrences without automatic catch-up tasks.
- **Priorities/goals:** priorities reference existing habit, milestone or task state; selecting one logs nothing. Goal progress is completed milestones divided by total milestones, with no additional habit XP.
- **Family tasks:** dated, reversible completions stay independent of habit totals, prayer records, XP and personal reward eligibility. Editing a task retains completion records.
- **Squad snapshots:** membership shares no private records. Only the reflection and enabled aggregate/title fields are copied. Structured updates contain no individual prayer dates/statuses, missed records, pause fields, private habit names or saved work notes. A typed reflection is included as written.
- **Rewards:** Working toward → Earned → Enjoyed, using a specific goal or Monday–Sunday week in the configured timezone. No currency or purchase. Later misses do not revoke earned rewards; explicit corrections can recompute eligibility before enjoyment.

## Persistence and compatibility

Schema **4** retains the `rise.local.v1` LocalStorage key. Versions 1–3 migrate without replacing habits, historical occurrences, prayers, XP, cosmetics, reflections, settings, timers, work notes, goals, rewards or priorities. Legacy entitlement data remains for compatibility; the habit limit, upgrade route and pricing UI remain removed.

The new `life` collection contains language, prayer setup, reminder preferences, readiness/alarm preview state, private pauses, groups, tasks, lists, squad updates and form drafts. Migration initializes new collections empty with default preferences. It does not install demo content. Today may still suggest a date’s initial priority plan from the profile’s own actions.

`useLifeDraft` preserves edited prayer setup, Fajr plans, pause selections, group creation, tasks, list creation/names/items and squad composition through nested sheets and reload. Reopen the relevant form after reload; the sheet stack and snapshot preview are not restored. Group settings save as edited. The temporary fictional invitee name is not a persistent draft. Older goal forms stay mounted under nested sheets, and new-habit drafts persist, but not every older unsaved form survives reload.

JSON export includes the full schema 4 state, including private pauses and drafts. Confirmed clearing returns to an empty personal profile. Storage is local to the browser origin/profile with no synchronization.

## Architecture

- `src/model.ts`: state, scheduled habits, XP, history correction, timers and original fixtures.
- `src/prayerModel.ts`: prayer timing/records, pause-aware streaks/summaries, Fajr and work breaks.
- `src/developmentModel.ts`: migration, goals, rewards, priorities and shared selectors.
- `src/lifeModel.ts`: life types/defaults, authored city fixtures, pauses, dated tasks and Daily life fixtures.
- `src/Life.tsx`, `src/LifeUI.tsx`: setup, reminders, Fajr/readiness, period mode, language selection/context, preview labels and drafts.
- `src/messages.ru.ts`, `src/i18n.ts`: 1,537 Russian message keys and render-time translation, dates, numbers, units, plural forms and known validation messages; stored user content is not passed through the translator.
- `src/Groups.tsx`: tasks/lists, squad snapshots and simulated membership/settings.
- `src/App.tsx`, `src/demo.ts`: routing, persistence, shared navigation and explicit fixture loading.
- `src/Balanced.tsx`, `src/Today.tsx`, `src/Habits.tsx`: Today hierarchy, compact/expanded habits, inline disclosures, habit details and the shared-week Progress overview.
- `src/Development.tsx`, `src/Prayers.tsx`, `src/Explore.tsx`: goals/rewards, prayer/history, Journey flows.
- `src/You.tsx`, `src/Personal.tsx`: compact personal hub, prayer-preference navigation, disclosed settings and retained collections.
- `src/styles.css`, `src/prayers.css`, `src/balanced.css`, `src/life.css`, `src/journey.css`, `src/you.css`, `src/components.tsx`: incumbent visual tokens, controls and feature composition.

`DESIGN.md` and `.impeccable/design.json` remain authoritative and unchanged. Original Pip/trail PNGs retain their provenance and prompt sidecars; no new artwork was generated. The [Russian manifest](../../.impeccable/review/russian/manifest.json) records **16 actual browser captures**, with byte-identical public copies in `screens/russian/`: the original 13-image matrix, its replaced prayer-setup image and three added focused confirmations. Phone exports are 375/393/430 × 852; the desktop request of 1440 × 1000 exported at 1436 × 997. The manifest retains each capture's build rather than presenting earlier unchanged regions as final-build captures.

The owner opened the original matrix, made one bounded localization layout/copy correction, and recaptured affected regions. The independent reviewer opened all 13 original images and requested two material fixes: keep the animated long-form header and exit controls inside the viewport, and preserve stable generic Uzbek dates. After the correction, the same reviewer opened all four focused confirmation images. Its [final verdict is ship for those two resolved findings](../../.impeccable/review/russian/finish-review.md); this was not a second whole-surface review. Automatic design hooks remained active; no additional detector ran.

Historical difficult-day evidence remains in `screens/recovery-day/`: 14 captures, 103 passing checks and a scoped ship verdict. Its recorded next-morning state is retained in [DIFFICULT-DAY-WALKTHROUGH.md](../../DIFFICULT-DAY-WALKTHROUGH.md). Historical full-day evidence remains in `screens/full-day/`: 18 captures, 100 passing checks and an independent ship verdict, with replay in [FULL-DAY-WALKTHROUGH.md](../../FULL-DAY-WALKTHROUGH.md). Historical four-tab/You/Journey/Progress/Today releases retain their 29/15/13/19/19-image sets and 97/93/89/84/80-check records. Earlier Daily life, balanced-day, Salah and initial galleries also remain historical, including some retired Plus screens. Their detailed results are retained in [VERIFICATION.md](../../VERIFICATION.md) and [the screenshot guide](../../screens/README.md).

Release packages include source, production `dist/`, tests, docs and screenshots. The personal profile backup stays outside the app root and must remain excluded.

## Verify

```sh
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:browser
```

Before the real-prayer milestone, the production build **`index-BOnYvotb.js / index-D4SQdtSZ.css`** passed; **57 domain tests and 59 Chromium browser scenarios passed: 116 total**. The full browser run took 36.7 seconds. The nine Russian journeys cover content/state preservation, the four tabs, prayer/Fajr and saved notes, habits/goals/rewards, family/squads, empty setup/onboarding, validation, keyboard focus, light/dark appearance and responsive text. The motion-enabled long-form regression checks 375/393/430 px at normal and 200% text, with the full header and Close inside the viewport and the app shell at scrollTop 0.

These are the implementation owner's recorded results in [the verification notes](../../.impeccable/review/russian/verification-notes.md); the reviewer and documenter did not rerun them. The existing Vite 500-kB bundle advisory remains (619.77 kB JavaScript, 183.50 kB gzip), with no build error. See [VERIFICATION.md](../../VERIFICATION.md) for the evidence and scope of the final reviewer verdict.

## Prototype boundaries

The retained demo setup uses illustrative times. The separate real-prayer setup uses Adhan astronomical calculations, coordinates and an IANA time zone, with daily refresh. Switching into live mode is explicit; demo mode and sample days can never schedule real alerts. Manual timetables remain date-specific; yesterday’s solar times are not automatically reused as a trusted timetable.

External invitations/messages, authentication, servers, billing, cloud synchronization and purchases remain unimplemented. Browser reminders run only while RISE is executing. Native local notifications are implemented for iPhone and Android, but physical-device behavior has not been verified on this machine. These are notification-based wake alerts, without Clock-style full-screen alarms, Apple AlarmKit, critical-alert entitlements, or a guarantee of sound through silent/Focus modes. A return note does not save editor files or block apps. Privacy statements describe local UI and snapshot fields, not an authenticated multi-user security system. Physical iPhone, Safari/WebKit, VoiceOver and native alarm behavior require separate testing.


## Real prayer times and phone alerts

Open **You → Prayer preferences → Prayer times → Set up real prayer times** from the demo. Choose a city or request a location fix, check the calculation method and Asr convention, then save. Coordinates are used locally by `adhan` and `tz-lookup`; there is no geocoding server or prayer-time API dependency. Choose a local mosque’s method and compare the result before relying on it. Custom coordinates, time zones, high-latitude rules and planned offsets are supported. Polar dates without valid solar events require a trusted manual timetable; no sample result is substituted.

Calculated coverage refreshes to 30 days when RISE opens or resumes. Previously checked entries and date-specific manual timetables retain their snapshots. Existing habit records, prayer records and XP are preserved. Samples remain labeled; native first launch starts with an empty personal profile.

Enable delivery explicitly in **Alarm readiness**. Prayer preparation/due reminders and Fajr wake alerts have separate switches. Fajr supports a primary alert, an optional backup and “I’m up,” which cancels that date’s remaining wake alerts without recording a prayer. Preview actions never acknowledge live alarms. A private pause, recorded prayer, changed plan/location, or disabled delivery reconciles pending native alerts. Permissions are checked again on resume; settings changes do not silently request permission.

The native queue is read back before displaying confirmation. Up to 60 events are queued, with headroom under iOS’s 64-event limit, accounting for other pending notifications. The last queued alert is displayed: open RISE before that point to refill coverage. Android requires notification permission and exact-alarm access; backups are at least 10 minutes apart because idle-mode delivery is restricted. Notification sound follows the user’s system channel, volume, silent/Focus and battery choices. Revoked permissions, scheduling failures or exhausted coverage are shown rather than treated as ready. Browser delivery is explicitly limited to an executing, awake page; its service worker displays notifications and handles clicks, and does not schedule background alarms.

### Build for iPhone and Android

```sh
npm ci
npm run build:native
npm run open:ios
# or
npm run open:android
```

`capacitor.config.ts` uses `app.rise.habits`, display name RISE, and the bundled `dist` folder. Both native projects include the location/notification setup. Android creates separate audible/silent channels and supplies a status-bar icon. Its plugin restores pending schedules after reboot; verify that behavior on supported devices. No background-location permission or server is needed.

For iOS, install the full Xcode toolchain, select a signing team and run on a device. For Android, install Android Studio, its SDK and a supported Java runtime, then build/run the generated project. Follow the [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup). Neither IDE/toolchain is installed on this machine, so `cap sync` succeeds but an IPA/APK build, signing and physical-device tests have not been performed.

Before release, exercise foreground/background/killed-app delivery on both phones, locked screens, notification and exact-alarm revocation, device reboot, quiet mode, Focus/Doze, timezone changes, pause/disable cancellation and a real Fajr acknowledgment. Check primary and backup times against the displayed queue. Apple AlarmKit or a dedicated Android alarm service remains a separate enhancement if Clock-style wake-up behavior is required.

Implementation: `src/prayerCalculation.ts` owns offline calculation; `src/prayerSchedule.ts` owns the pure event plan and queue reconciliation; `src/prayerDelivery.ts` adapts browser and phone delivery; `src/PrayerDeliveryProvider.tsx` manages lifecycle and cancellation; `src/PrayerLive.tsx` provides setup/readiness in English, Uzbek and Russian. New domain and browser tests cover these interfaces. The CLI’s transitive `xcode` dependency is constrained to patched `uuid@11.1.1`; installation audit reports zero vulnerabilities.

Verification on 21 October 2026: `npm run build:native` passed (production web build and both native syncs); all **71 domain tests and 69 Chromium browser scenarios passed — 140 total**. The browser suite took 39.6 seconds. A virtual-clock test now waits for app/permission readiness before advancing time, and verifies one Fajr delivery followed by backup suppression. The independent UI verdict is **ship for its two scored corrections**: current product documentation and the blocked-permission recovery action. This is not a native build or physical-device certification. The existing Vite bundle-size advisory remains; it is not a build failure.

References: [Adhan calculation library](https://github.com/batoulapps/adhan-js), [Capacitor local notifications](https://capacitorjs.com/docs/apis/local-notifications), [location permissions](https://capacitorjs.com/docs/apis/geolocation). These sources explain the library and OS constraints; they do not substitute for device testing.
