# RISE — Gamified Habit and Self-Development App

> Historical prototype commission. The active mobile-web requirements are [PRD.md](PRD.md); retired Plus/paywall, prototype-only and native-first statements below are preserved history, not current scope.

## Master prompt for Codex or OpenDesign

Act as a senior consumer product designer, iOS interaction designer, and prototyping engineer. Create a complete, high-fidelity, interactive mobile app prototype for the brief below.

The working product name is RISE. Treat the name as a placeholder; naming availability has not been checked.

The product promise is:
“Small actions. A stronger you.”

The intended feeling is:
“I know what to do next. Starting feels easy. My effort matters. I want to return tomorrow.”

The app should combine Duolingo-inspired playfulness, visible progression, and satisfying feedback with a premium, ultra-modern Apple iOS visual language. Create an original, cohesive consumer app identity.

## 1. What to produce

Produce the actual prototype using the capabilities of this environment. Continue beyond a written plan or a single attractive home screen.

If working in a design-first environment:

- Create editable, named mobile screens with reusable components, styles, and meaningful variants.
- Connect the main user journeys into a clickable prototype.
- Provide a compact design-system board and a short interaction specification.
- Represent data-changing interactions with linked before-and-after states if live state is unsupported.

If working in Codex or a coding environment:

- Use the existing project stack if a suitable project exists.
- Otherwise, use a lightweight React and TypeScript setup for a mobile-first browser prototype. If the environment is already an iOS project, use its native stack.
- Implement functional navigation, shared application state, and local persistence.
- Use reusable components and central design tokens.
- Deliver the runnable prototype and clear launch instructions.
- Use local mock data. Describe any simulated device features accurately.

The target product is an iPhone app. A browser implementation must preserve the mobile app experience. On a desktop, present the app in a centered, approximately 393–430 px-wide preview. On a phone, use the available viewport naturally.

Keep the work at the reviewable prototype stage. Live payments, authentication services, push infrastructure, cloud synchronization, and public deployment are outside this brief.

Make reasonable design decisions autonomously. Keep the central daily flow complete and polished.

## 2. Product purpose and audience

The initial user is an adult building the app for personal use. Later, the product may offer subscriptions to other users.

Help people develop manageable routines in areas such as reading, learning, movement, focused work, and personal reflection. Support user-defined habits rather than imposing one lifestyle.

The primary problem is:
“I make plans, start enthusiastically, and then stop when life gets busy.”

Design for three moments:

1. Starting: choose a small, concrete commitment.
2. Continuing: make useful effort visible and satisfying.
3. Returning: make it easy to resume after a missed day.

The app should reward actions in the user’s life. Routine check-ins should be quick. Extended time inside the app is not the objective.

Keep the tone warm, capable, adult, and encouraging. Avoid guilt, exaggerated productivity claims, medical claims, and promises that habits form in a fixed number of days.

## 3. Visual direction

Create a distinctive premium identity: porcelain backgrounds, deep forest accents, luminous mint highlights, beautiful typography, a small original companion, and tactile illustrated milestones.

Use Duolingo as inspiration for:

- Expressive character reactions.
- A clear, playful progression path.
- Satisfying completion feedback.
- Understandable goals and visible progress.

Create original artwork, layout details, wording, iconography, and reward designs. Do not reproduce Duo, Duolingo branding, its illustrations, or its exact screen compositions.

Use an Apple iOS sensibility for:

- Clear hierarchy and generous spacing.
- Large, confident headings.
- Familiar navigation, sheets, segmented controls, and menus.
- Smooth transitions and touch-first interactions.
- Selective translucent material for navigation and floating controls.
- Legible content, accessible controls, and careful safe-area handling.

Keep the visual balance predominantly calm, with concentrated moments of playfulness around the companion, the journey, and achievements.

### Starting color tokens

Light appearance:

- App background: #F5F7F3.
- Main surface: #FFFFFF.
- Primary text: #17241F.
- Secondary text: #5B6B62.
- Primary action: #1F7855.
- Mint surface: #DDF5E8.
- Mint highlight: #7EDDB1.
- Reward gold: #F1BD58, with dark text.
- Subtle divider: #E1E8E2.

Dark appearance:

- App background: #101815.
- Main surface: #1B2721.
- Primary text: #F0F6F2.
- Secondary text: #B0C2B6.
- Primary action: #80DDB5, with dark text.
- Subtle divider: #33463B.

Treat these as a coherent starting palette. Adjust values where necessary for contrast and visual quality.

### Typography and layout

- Use the system font with SF Pro where available and suitable fallbacks elsewhere.
- Use approximately 32–34 pt large titles, 22–24 pt section headings, 16–17 pt body text, and 13–14 pt supporting labels.
- Use tabular numerals for timers and changing statistics.
- Avoid tiny text and excessive all-caps labels.
- Use a consistent spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Use approximately 20 pt horizontal screen padding.
- Use 20–24 pt corners for important cards, with smaller nested radii.
- Make primary buttons approximately 52–56 pt tall.
- Use fine borders and soft, restrained shadows where elevation helps.
- Keep dense form and settings content in grouped rows rather than putting every item in a separate card.

Reserve Liquid Glass-inspired effects for appropriate navigation or floating controls. Keep habit content and charts on readable surfaces. Avoid stacked glass layers and low-contrast text over busy artwork.

## 4. Original companion and illustration system

Create an original companion named Pip: a small, rounded seed-like creature with expressive eyes, tiny limbs, and a sprout-shaped tuft.

Its personality is calm, curious, and quietly enthusiastic. It should appeal to adults while remaining memorable.

Create consistent expressions:

- Welcoming.
- Focused.
- Celebrating.
- Resting.
- Encouraging a return.

Use soft, dimensional illustration with simple shapes and restrained shading. The companion should look like a designed brand asset, not an emoji, generic stock graphic, or an unrelated illustration pasted into the interface.

Use the same proportions, colors, lighting, and visual treatment across the app.

Place Pip purposefully:

- Welcoming the user during onboarding.
- Beside today’s next action.
- At the current journey milestone.
- Celebrating a meaningful milestone.
- Offering a small restart after a missed day.

Keep the companion visible without pushing daily habits far below the fold. It should never look disappointed, ill, abandoned, or angry because a user missed a habit.

If image-generation tools are available, create cohesive assets. Otherwise, use carefully crafted local vector artwork that remains sharp and consistent.

## 5. Navigation and information architecture

Use four bottom tabs:

1. Today.
2. Journey.
3. Progress.
4. You.

Use an icon and short label for every tab. Preserve each tab’s state when switching.

Today contains the daily plan and access to habit creation and management.  
Journey contains accumulated progress and milestone rewards.  
Progress contains history, understandable trends, and weekly reflection.  
You contains the companion collection, preferences, and optional Plus access.

Use navigation pushes for deeper information and bottom sheets for short decisions or edits. Keep back, close, cancel, and save behaviors predictable.

A habit’s full or tiny completion must be accessible in one or two taps from Today. Optional timers may take the user into a focused session.

## 6. Habit model and daily loop

The main loop is:

Open Today → choose a scheduled habit → perform the action → log a full or tiny completion → see a brief reward → continue with the day.

Each habit contains:

- Name.
- Icon and accent.
- Optional focus area and short personal reason.
- Type: simple check-in, count, or duration.
- Full target and unit.
- Optional tiny alternative.
- Schedule: every day or selected weekdays.
- Optional reminder time and cue.
- Active or archived status.

Examples:

- Read 10 pages; tiny version: read 1 page.
- Walk for 20 minutes; tiny version: walk for 2 minutes.
- Practice English for 5 minutes; tiny version: practice for 1 minute.
- Write a short reflection; tiny version: write one sentence.

Allow a cue such as “After breakfast” or “After I close my laptop.”

Start new users with one to three habits. Recommend a manageable plan without forcing them to accept all suggestions.

Only habit occurrences scheduled for the selected date belong in its plan. Unscheduled dates must not appear overdue or inflate totals. Preserve historical occurrences even when the corresponding habit is later archived.

Logging is self-reported. The prototype does not verify that a user performed an action.

### Full and tiny completion

A tiny completion represents a smaller action, and the interface must say so clearly.

Show:

- “Full target completed.”
- “Tiny version completed.”
- “Upgrade to full target.”
- “Undo check-in.”

Use an inclusive daily summary such as “1 of 3 habits checked in,” with full and tiny counts available beneath it. Do not label a tiny version as reaching the full target.

Keep completed habits visible in a compact section so users can review or undo them.

### XP rules

XP is the only earned resource:

- Full scheduled completion: 20 XP.
- Tiny scheduled completion: 10 XP.
- Maximum per habit per scheduled date: 20 XP.
- Upgrading tiny to full adds only the remaining 10 XP.
- Repeated taps do not award additional XP.
- “Undo check-in” removes the entire date’s check-in and its XP, including any upgrade. After tiny-to-full, this removes 20 XP. Use this explicit label consistently.
- Reminders, opening the app, reflections, and claiming rewards do not generate extra XP.

Use one source of truth for logs and derive totals consistently. For a coded prototype, prevent double submission and persist changes.

XP represents logged effort within the app. It is not a score for health, intelligence, or personal worth.

### Planned-day streak

Label the streak honestly: “7 planned days in a row.”

A planned date qualifies when at least one scheduled habit receives a full or tiny completion.

- Increase the streak at most once per qualifying date.
- A date with no scheduled habits preserves the streak without increasing it.
- Today’s unfinished plan does not break the streak before the day ends.
- An elapsed planned date with no check-in breaks the current streak.
- Keep lifetime XP, history, earned progress, and the longest streak after a missed day.

The streak measures showing up, while the daily summary measures how much of the plan was checked in. Make this distinction available in a short explanation.

Use one user timezone for daily boundaries. Default to the device timezone; use Asia/Tashkent for the supplied demo fixture. Preserve historical dates and target snapshots when settings change.

Schedule and target edits take effect on the next local date; show when they become effective. Name and icon changes may appear immediately. Archiving takes effect now: remove today’s still-unlogged occurrence and future occurrences, while retaining all elapsed dates and any check-in already logged today. Explain any change to Today’s count in the archive confirmation. Preserve history and its original denominators.

### Recovery

Use a supportive return state:
“Your progress is still here. Start with something small.”

Show the tiny version of a scheduled habit as an immediate action. Offer an easy way to reduce an unrealistic future target.

Do not sell streak repairs or punish missed days by removing accumulated progress. Avoid loss countdowns, shame-based notifications, negative XP, and distressed character reactions.

## 7. Journey and rewards

Create an elegant, vertically scrolling illustrated path called the Momentum Trail.

The path crosses a stylized landscape of soft hills, stepping stones, small plants, and warm light. Keep decoration controlled so milestone labels remain legible.

Journey progress comes from lifetime XP:

- 100 XP: First Steps.
- 250 XP: Finding Rhythm.
- 500 XP: Growing Stronger.
- 800 XP: Steady Progress.
- 1,200 XP: New Horizons.

These are effort milestones, not promised transformation deadlines.

Use distinct states:

- Reached.
- Newly unlocked.
- Current next milestone.
- Upcoming.

Show the exact XP threshold and progress toward the next milestone. Include a “Back to current” control if the map scrolls far away.

The map must not force people to complete habits in a particular order. Habit execution remains available from Today.

Reward milestones with deterministic cosmetic unlocks:

- A small badge.
- A companion accessory.
- A landscape decoration.
- An optional alternate background.

At 250 XP, unlock a simple linen scarf for Pip.

Use clear reward descriptions and a short claim interaction. Claiming a cosmetic does not award additional XP. Avoid multiple currencies, random reward boxes, energy meters, lives, or a separate economy.

All screens must agree about milestone eligibility. If an explicit Undo removes the XP that unlocked a reward in this prototype, recalculate eligibility and return an ineligible equipped item to the default. Explain that a check-in was undone. Missing a later day does not revoke earned rewards.

## 8. Required screens and states

Build the following screen families. Reuse sheets and components where appropriate, while giving each screen a deliberate composition.

### A. Welcome

Show Pip, the wordmark, the product promise, and one prominent “Start small” button.

Use a beautifully composed introduction with a concise explanation of the product. Keep account creation out of the initial path.

### B. Onboarding

Use three compact steps after welcome:

1. Choose one to three focus areas.
2. Choose one to three suggested habits and adjust their full and tiny targets.
3. Review schedules and optional reminder preferences.

Show progress, back navigation, selected states, and a clear final “Create my plan” action.

Allow users to start with one habit. Notification setup is optional. Request device permission only after the user explicitly chooses to enable reminders.

Finish on a Today screen based on the actual selections.

### C. Today — the flagship screen

Make this the strongest screen in the prototype.

Arrange the initial viewport around:

- Date and a short greeting.
- A compact planned-day streak indicator.
- Pip with a short, contextual encouragement.
- A clear daily progress summary.
- The next available action.
- The beginning of the daily habit list.

The next habit should be visible without scrolling on the primary reference size.

Each habit row or card includes:

- Icon.
- Name and measurable target.
- Relevant schedule or cue.
- Full or tiny completion state.
- Clear action.
- Expected XP where useful.

Provide access to “Add habit” and “Manage habits.”

Show the journey preview as a small supporting element, such as “10 XP to your next milestone,” rather than another competing hero.

Design variants for:

- Nothing checked in yet.
- A mixture of full and tiny completions.
- All scheduled habits checked in.
- No habits created.
- A planned rest day.
- Returning after a missed day.

Keep “all checked in” distinct from “all full targets completed.”

### D. Habit detail and optional focus session

Show the target, tiny alternative, personal cue, weekly schedule, and recent check-in history.

Make full completion, tiny completion, and editing easy to find.

For duration habits, offer an optional minimal timer with start, pause, resume, and exit. Confirm completion at the end; do not automatically award XP merely because the timer was opened or time elapsed.

The user can log a completed real-world action without using the timer.

In a coded prototype, preserve the timer’s correct elapsed state during navigation or refresh. Demonstration shortcuts belong in reviewer controls, not the normal timer.

### E. Create, edit, and manage habits

Use a clean mobile form with progressive disclosure:

- Habit name.
- Icon and focus area.
- Type and target.
- Tiny alternative.
- Weekday selector.
- Optional cue and reminder.

Include sensible defaults, keyboard-safe layout, validation, and clear save/cancel actions.

Reject empty names, nonpositive numeric targets, a tiny target larger than the full target, and schedules with no selected days.

Make saved changes visible in Today immediately where applicable.

Provide a manageable list of active and archived habits. Follow the archival rules above and show a confirmation. Archiving frees an active-habit slot. If reactivation is offered, enforce the same active-habit limit.

### F. Completion feedback

Use a quick checkmark transformation, an XP update, and brief encouraging copy. Ordinary check-ins should not open a blocking full-screen celebration.

Examples:

- “One small step, logged.”
- “You showed up.”
- “That’s your full target.”

Expose Undo from the completed habit detail even after a transient message disappears.

Use a larger, dismissible celebration only for meaningful milestones. Combine related rewards into one clear result.

### G. Journey and milestone detail

Build the full Momentum Trail and a milestone sheet explaining:

- Name.
- XP requirement.
- Current progress.
- Reward.
- Claim or equip action when eligible.

Place Pip near the current milestone. Future milestones should feel inviting without appearing like a lesson curriculum.

### H. Progress

Create an understandable weekly view with:

- Date range.
- A seven-day strip.
- Scheduled check-ins versus actual check-ins.
- Full versus tiny breakdown.
- Planned-day streak and longest streak.
- A calendar or compact habit history.
- A short observation derived from the displayed data.

Example:
“14 of 16 scheduled actions checked in: 10 full, 4 tiny.”

If showing a check-in rate, define it as full-or-tiny check-ins divided by scheduled habit occurrences. Unscheduled dates are excluded. Show an appropriate empty state when the denominator is zero.

Use accessible labels and restrained charts. Do not invent a proprietary productivity score, fabricated insight, or unsupported interpretation.

Provide “This week” and “Last week.” Show useful empty states for users without enough history.

### I. Weekly reflection

Create a short review:

- “What felt manageable?”
- “What would you like to make smaller next week?”

Allow optional text or simple choices, saving the reflection, and opening a habit edit from the review.

Keep reflection separate from the streak and XP requirements. A user can skip it.

### J. You and companion collection

Show:

- Local profile name.
- Pip and equipped cosmetic.
- Lifetime XP and key milestones.
- Earned badges.
- Companion accessories.
- Appearance preferences.
- Settings.
- A quiet entry to RISE Plus.

Use a compact collection sheet or child screen for accessories. Show unlocked, equipped, and locked states with a clear explanation.

Keep this organized and adult in tone. Avoid turning it into a crowded game shop.

### K. Settings and reminders

Include:

- Profile name.
- System, light, and dark appearance.
- Reminder preferences.
- Quiet hours.
- Sound and haptic preferences.
- Reduce motion.
- Timezone display.
- Export local data.
- Clear local data, with confirmation.

Reminder controls must distinguish between a saved preference and actual operating-system delivery capability.

In a browser-only prototype, provide a transparent reminder preview if real device scheduling is unavailable. Haptics are optional and platform-dependent.

Data export and recovery are available in the free experience.

### L. RISE Plus preview

Create a premium, fully dismissible subscription screen.

Free includes:

- Up to three active habits.
- Full and tiny check-ins.
- Reminders and streaks.
- Core Journey progression.
- Basic history and weekly summaries.
- Recovery, Undo, and data export.

Plus concept includes:

- Unlimited active habits.
- Longer-term comparisons and richer filters.
- Additional companion cosmetics and visual themes.

Use illustrative pricing:

- Monthly: $5.99 per month.
- Annual: $39.99 per year, billed annually.
- If showing an equivalent monthly amount, label it approximately $3.33 per month and keep the annual total prominent.

These are prototype assumptions, not validated commercial pricing.

Show an understandable comparison, plan selection, renewal wording, and an easy dismissal.

Entry points are You and an attempt to add a fourth active habit. Count only active habits toward the limit. Preserve a fourth-habit draft when Plus is dismissed, and resume it after simulated activation. Keep upgrade prompts out of completion and recovery moments.

Use “Preview Plus” for the working prototype action. It should explicitly simulate enabling Plus without implying a charge. Include a restore-purchases preview with an honest simulated result.

Terms and privacy links should open clearly identified draft information. Do not imply that final policies or real billing infrastructure already exist.

## 9. Seeded demo data

Provide a Fresh Start mode and a Populated Demo mode. Keep reviewer controls outside normal product navigation.

Fresh Start begins with no habits, no XP, and onboarding, using real device time. Populated Demo uses a persisted, injected calendar date changed only through reviewer controls. Its focus timer measures actual elapsed time independently of that frozen calendar. Initialize fixtures only on first use or an explicit reviewer reset; never overwrite saved check-ins on refresh.

Populated Demo uses:

- Name: Mamur.
- Timezone: Asia/Tashkent.
- Demo date: Monday, 19 October 2026.
- Three active habits, all starting on 12 October 2026.
- Today’s habits initially unchecked.
- 240 lifetime XP.
- Seven qualifying planned dates in a row.
- Next milestone: 250 XP.

Habits:

1. Read 10 pages; tiny: 1 page; every day.
2. Walk 20 minutes; tiny: 2 minutes; Monday, Wednesday, Friday, Sunday.
3. Practice English 5 minutes; tiny: 1 minute; Monday through Friday.

Use this exact previous-week fixture:

- 12 October: reading full, walking tiny, English full.
- 13 October: reading tiny, English full.
- 14 October: reading full, walking full, English missed.
- 15 October: reading tiny, English full.
- 16 October: reading full, walking missed, English tiny.
- 17 October: reading full.
- 18 October: reading full, walking full.

This creates:

- 16 scheduled habit occurrences.
- 14 check-ins.
- 10 full completions.
- 4 tiny completions.
- 240 XP.
- Seven qualifying planned dates.
- An 87.5% check-in rate for that week.

On 19 October, completing the tiny reading habit adds 10 XP, reaches 250 XP, unlocks the scarf milestone, and extends the streak to eight planned dates. Upgrading that check-in to full adds only 10 more XP. “Undo check-in” after that upgrade removes the whole 20-XP record, returning the total to 240 XP and the streak to seven if it was today’s only check-in.

Derive every displayed statistic from the same fixture. Build separate clearly named fixtures for a missed-day return and an all-checked-in day.

## 10. Interaction and state requirements

Every visible control must perform its stated action, navigate to a designed destination, or explain a specific prototype limitation.

Support:

- Onboarding selections changing the actual plan.
- Switching tabs and returning to the previous position.
- Creating, editing, and archiving habits.
- Weekday selection.
- Full and tiny check-ins.
- Tiny-to-full upgrade.
- Undo.
- Consistent XP, streak, progress, and journey updates.
- Claiming and equipping eligible rewards.
- Viewing history.
- Saving a weekly reflection.
- Theme and preference changes.
- Opening and dismissing Plus.
- Simulating Plus activation.
- Local persistence after refresh in the coded version.

Provide relevant empty, pressed, selected, disabled, validation-error, and completed states.

Avoid fake loading screens for local operations. Show errors where a genuine action can fail, and provide an understandable recovery action.

For code, use stable habit identifiers and date-based completion records. Preserve historical targets and schedules rather than recomputing old records from the latest edit.

## 11. Motion and accessibility

Use restrained motion:

- Brief button compression.
- Smooth progress changes.
- A small completion bounce.
- Subtle companion reactions.
- Short celebratory particles for major milestones.
- Purposeful sheet and navigation transitions.

Ordinary transitions should generally feel approximately 160–260 ms long. Longer celebrations must remain dismissible.

Respect reduced motion and provide reduced-transparency alternatives where needed. Sound is optional and should not be required to understand feedback.

Design for:

- At least 44 × 44 pt interactive targets.
- Strong text and control contrast.
- Text scaling without clipping critical information.
- Status communicated through text and icons as well as color.
- Accessible control names.
- Logical reading and focus order.
- Keyboard operation for the browser prototype.
- Clearly labeled charts and milestones.

Design the primary reference at approximately 393 × 852 logical units. Check widths around 375, 393, and 430. Respect safe areas, the on-screen keyboard, and the home indicator.

Avoid duplicate status bars or notches when the preview environment already supplies device chrome.

Use English for this prototype. Keep strings organized for later localization, with layouts that can accommodate Uzbek Latin and Russian text expansion. Do not show language choices that have no implemented content.

## 12. Component system

Create reusable components for:

- App shell and tab navigation.
- Top navigation and sheet header.
- Habit row or card.
- Daily progress summary.
- Planned-day streak indicator.
- XP progress.
- Primary, secondary, and text buttons.
- Weekday selector.
- Form fields and grouped settings rows.
- Companion illustration states.
- Journey node.
- Reward badge and accessory tile.
- Calendar cell.
- Completion message.
- Empty state.
- Plan selector.
- Confirmation dialog.

Define shared tokens for color, typography, spacing, radius, elevation, and motion. Show meaningful component states and both appearances.

Keep the daily action interface visually quiet. Let the journey and companion carry the more expressive artwork.

## 13. Review and acceptance criteria

Review the complete main flow before handoff.

The prototype should pass these checks:

1. Within five seconds of opening Today, the next useful action is obvious.
2. A scheduled habit can be checked in from Today in one or two taps.
3. Tiny completion is visibly different from reaching the full target.
4. Repeated completion taps cannot duplicate XP.
5. Tiny-to-full upgrade adds only the XP difference.
6. Undo consistently updates Today, Progress, streak, journey, and reward eligibility.
7. Unscheduled days do not become failures.
8. A missed day preserves accumulated progress and offers a clear restart.
9. A created habit appears on its selected schedule.
10. Three free active habits and the fourth-habit upgrade path behave consistently.
11. Closing Plus returns the user to their previous context.
12. Theme changes preserve legibility.
13. Smaller phones and larger text do not hide important controls.
14. All example statistics agree with the underlying data.
15. Refresh preserves state in the coded prototype.

For a coded deliverable, run the available build checks and a small set of meaningful checks around completion, Undo, schedules, and XP. Visually inspect the core screens at phone sizes.

For a design-only deliverable, inspect links, component states, and before-and-after frame consistency. Clearly state which interactions are simulated.

Fix material issues found in review before presenting the result. Do not claim device, accessibility, or automated testing that was not performed.

## 14. Final handoff

Provide:

- The runnable or clickable mobile prototype.
- The complete core screen set.
- The reusable design system.
- A short explanation of the visual direction.
- A list of functional and simulated interactions.
- Launch or preview instructions.
- Brief notes about what would still be needed for a production subscription app.

Include a concise suggestion for a personal pilot: observe habit check-ins on scheduled days, whether the user returns after a miss, and whether the chosen targets feel manageable. Do not invent retention results or claim that the prototype proves willingness to pay.

Prioritize in this order:

1. Today and the complete check-in/recovery loop.
2. Cohesive visual craft, companion, and interactions.
3. Habit setup, schedules, and reliable state.
4. Journey and progress.
5. Plus preview and secondary settings.

The finished result should feel like a carefully designed iPhone habit companion: immediately understandable, visually distinctive, satisfying to use, and easy to return to.