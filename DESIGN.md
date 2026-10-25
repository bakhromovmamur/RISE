---
name: RISE
description: A calm mobile field journal for small commitments and visible effort.
colors:
  bg: "#f5f7f3"
  surface: "#fff"
  ink: "#17241f"
  muted: "#5b6b62"
  green: "#1f7855"
  on-green: "#fff"
  mint: "#ddf5e8"
  mint-bright: "#7eddb1"
  line: "#e1e8e2"
  soft: "#eef2ed"
  gold: "#f1bd58"
  danger: "#aa3a38"
  dark-bg: "#101815"
  dark-surface: "#1b2721"
  dark-ink: "#f0f6f2"
  dark-muted: "#b0c2b6"
  dark-green: "#80ddb5"
  dark-on-green: "#10271c"
  dark-mint: "#233f31"
  dark-line: "#33463b"
  dark-soft: "#233028"
  dark-gold: "#eabd68"
  dark-danger: "#ffb0aa"
  streak-ink: "#835721"
  streak-fill: "#f8ebd5"
typography:
  headline: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "2.125rem", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-1.1px" }
  title: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "1.375rem", fontWeight: 650, lineHeight: 1.2, letterSpacing: "-0.5px" }
  subheading: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "1.062rem", fontWeight: 650, lineHeight: 1.3 }
  body: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "1rem", fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "0.8125rem", fontWeight: 400, lineHeight: 1.4 }
  control: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "0.9375rem", fontWeight: 620, lineHeight: 1.3 }
  navigation: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: "0.6875rem", fontWeight: 550 }
rounded:
  card: "24px"
  habit: "21px"
  control: "16px"
  field: "12px"
  group: "18px"
  chip: "15px"
  toggle: "20px"
  sheet: "28px"
  circle: "50%"
spacing:
  compact: "4px"
  small: "8px"
  item: "12px"
  group: "16px"
  screen: "20px"
  section: "24px"
  large: "32px"
components:
  button-primary: { backgroundColor: "{colors.green}", textColor: "{colors.on-green}", typography: "{typography.control}", rounded: "{rounded.control}", padding: "13px 18px" }
  button-secondary: { backgroundColor: "{colors.mint}", textColor: "{colors.green}", typography: "{typography.control}", rounded: "{rounded.control}", padding: "13px 18px" }
  button-ghost: { backgroundColor: "transparent", textColor: "{colors.muted}", typography: "{typography.control}", rounded: "{rounded.control}", padding: "13px 18px" }
  button-danger: { backgroundColor: "{colors.danger}", textColor: "{colors.surface}", typography: "{typography.control}", rounded: "{rounded.control}", padding: "13px 18px" }
  text-field: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", rounded: "{rounded.field}", padding: "14px 13px", width: "100%" }
  bottom-navigation: { typography: "{typography.navigation}", height: "82px", padding: "9px 14px max(13px, env(safe-area-inset-bottom))" }
  xp-chip: { backgroundColor: "{colors.mint}", textColor: "{colors.green}", rounded: "{rounded.chip}", padding: "9px 11px" }
  habit-card: { backgroundColor: "{colors.surface}", rounded: "{rounded.habit}", padding: "15px" }
  weekday-chip: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", rounded: "{rounded.circle}" }
  weekday-chip-selected: { backgroundColor: "{colors.green}", textColor: "{colors.on-green}", rounded: "{rounded.circle}" }
  toggle: { backgroundColor: "#b7c3b9", rounded: "{rounded.toggle}", height: "28px", width: "46px", padding: "3px" }
  toggle-on: { backgroundColor: "{colors.green}", rounded: "{rounded.toggle}", height: "28px", width: "46px", padding: "3px" }
---

# Design System: RISE

## Overview

**Creative North Star: "A Little Daily Field Journal"**

RISE is a quiet, personal place for manageable commitments. Porcelain surfaces, forest ink, luminous mint, and a tactile seed companion make progress feel warm and adult. Familiar system typography and generous space keep the next real-world action easy to find.

The visual language combines practical lists and grouped settings with a small botanical world. Pip and the Momentum Trail add personality at deliberate moments; the interface remains useful when a day is incomplete, tiny, restful, or a return after a miss. Motion acknowledges an action and then settles.

**Key Characteristics:**
- Calm porcelain surfaces with forest text and mint action states.
- Familiar system type, clear control hierarchy, and compact mobile composition.
- Original tactile companion artwork with brief, purposeful feedback.

This documents the implemented local React prototype. Source authority is `src/styles.css`, `src/components.tsx`, and the screen components; `src/DesignSystem.tsx` provides the visual specimen. The sidecar carries extensions and standalone component previews. Its synthesized tonal ramps are preview aids, not additional implemented colors.

## Colors

The palette is botanical and restrained: clean surfaces hold the information, while green and mint identify action and accumulated effort.

### Primary
Forest action (`green`) colors primary controls, progress, selection, and focus. Its foreground is always the paired `on-green`; dark appearance reverses this relationship to a light mint action with deep text.

### Secondary
Soft mint (`mint`) carries secondary actions and selected navigation backgrounds. Mint light (`mint-bright`) distinguishes tiny contributions and outlines the tiny completion mark.

### Tertiary
Reward gold (`gold`) appears in milestone confetti. Badge illustrations have their own fixed botanical and gold palettes. The streak uses the separate warm `streak-ink` / `streak-fill` pair; preserve its readable foreground.

### Neutral
Porcelain (`bg`) is the app canvas; `surface` is the card and field layer. Forest ink (`ink`) supports main text, `muted` supports secondary copy, `line` divides groups, and `soft` holds subdued controls and notices. `danger` is reserved for destructive actions and validation feedback.

Theme switching replaces the shared CSS variables inside `[data-theme="dark"]`; it does not apply a blanket inversion to the artwork.

| Runtime token | Light frontmatter token | Dark frontmatter token |
| --- | --- | --- |
| `--bg` | `bg` | `dark-bg` |
| `--surface` | `surface` | `dark-surface` |
| `--ink` | `ink` | `dark-ink` |
| `--muted` | `muted` | `dark-muted` |
| `--green` / `--on-green` | `green` / `on-green` | `dark-green` / `dark-on-green` |
| `--mint` | `mint` | `dark-mint` |
| `--mint-bright` | `mint-bright` | `mint-bright` |
| `--line` / `--soft` | `line` / `soft` | `dark-line` / `dark-soft` |
| `--gold` / `--danger` | `gold` / `danger` | `dark-gold` / `dark-danger` |

**The Paired Action Rule.** Use the current appearance's action and on-action tokens together; do not hard-code white text onto every green control.

## Typography

One system sans stack serves every interface role. The requested Apple-like character comes from scale, weight, spacing, and hierarchy; the implementation does not load a custom font.

- **Headline:** the large greeting uses the headline scale, equivalent to 34 px at the default 16 px root. Other page headings intentionally use smaller screen-specific sizes.
- **Title / subheading:** section headings and compact component titles use the two intermediate roles. Heading text balances; habit names and editable content may wrap.
- **Body:** default prose and form input text remain readable at the body scale. Supporting copy commonly uses the label scale, with line height retained.
- **Control / navigation:** action labels are moderately weighted; the selected tab increases its label weight to 700. Uppercase tracking belongs to the desktop preview captions, not everyday mobile copy.
- **Numbers:** streaks, XP summaries, charts, and the focus timer use tabular numerals where specified. The timer is an observed display exception at 4rem with weight 450.

**The Familiar Voice Rule.** Preserve the system font stack and rem-based core type sizes; use hierarchy and whitespace before introducing another typeface.

## Layout

The product is a single-column mobile app with four persistent tabs: Today, Journey, Progress, and You. The main content scrolls above a fixed bottom navigation region. Screens normally use a 20 px horizontal inset; at widths of 380 px and below, that becomes 18 px. The shared spacing vocabulary is recorded in frontmatter; component-specific spacing remains intentional rather than forced onto a strict grid.

At widths up to 500 px, the shell fills the viewport (`100dvh`) with no frame, border, or shell shadow. Safe-area insets extend the bottom navigation and full-screen sheet headers. The saved visual references include 375, 393, and 430 px widths and a larger-text view.

Above 500 px, the prototype uses a 413 px outer phone preview with a 6 px border and a maximum 852 px height. Below 900 px the side presentation rails disappear. At 1100 px and 1500 px the desktop grid spacing changes; these are preview-shell adjustments, not new product layouts. The standalone design board stacks at 700 px.

Primary controls have a minimum height of 52 px. Compact habit actions, icon buttons, week controls, and the return-to-current action use 44 px minimum heights. At narrow widths, weekday buttons wrap with 44 px minimum widths; wider flex rows retain their 40 px CSS minimum and grow with available space. Priority-edit and recovery-download targets are at least 44 px. The switch has an expanded pseudo-element hit region. These are implementation facts, not a blanket accessibility certification.

## Elevation & Depth

Depth is mostly tonal. White or dark-green surfaces sit on the canvas, grouped rows use thin separators, and the navigation uses a translucent surface with a 16 px blur. Resting habit cards use a faint ambient shadow; completed cards replace it with a border. The featured pending card has an inset outline made by mixing action green into the surface.

The sidecar records the exact light/dark card shadows, selected-segment shadow, sheet lift, toast shadow, and desktop frame shadow. Trail nodes deliberately have a firmer stacked depth to read as landmarks. Full-screen mobile shells remove decorative frame elevation.

**The Quiet Depth Rule.** Use tonal separation for ordinary information and reserve stronger depth for the trail, overlays, and transient feedback.

## Shapes

Soft geometry distinguishes roles: the card token is 24 px, habit cards use their observed 21 px radius, main controls use 16 px, text fields use 12 px, and grouped settings use 18 px. Compact habit actions also use 12 px. Bottom sheets have 28 px upper corners; full-screen sheets remove corner rounding.

Circular forms belong to companion orbits, completion marks, weekdays, and reward badges. Habit category icons use rounded squares and their observed muted category colors. Keep artwork clipped to its scene; do not stretch the transparent sprite to fit a different aspect ratio.

## Components

### Buttons
Primary, secondary, ghost, and danger are the four `Button` variants. Shared minimum height, typography, and spacing come from the control system. Hover subtly reduces brightness; press scales to 0.975; keyboard focus draws a 3 px action-colored outline with a 3 px offset. Disabled buttons use 0.45 opacity and a disabled cursor. Compact habit actions override the shared size, padding, and radius to fit the card.

### Habit cards and completion
Each pending card pairs a rounded category icon, name, target, and cue with full and optional tiny actions. The first pending card receives the featured outline and stronger primary action. Completed cards remove the action row and shadow, use a border, and show a solid check for full or a mint sprout for tiny. Tiny completion retains an upgrade action; the detail sheet exposes Undo. Return mode can promote the tiny action without changing the component's visual grammar.

### Inputs and selection
Fields use a surface fill, thin line border, body-sized text, and the shared focus outline. Placeholder text uses `muted` at opacity 1. Disabled inputs use `soft`; validation is a separate danger-colored message rather than an invented red field state. Weekday buttons use `aria-pressed` and invert to action/on-action when selected. Week segments use a raised surface for the selected option. The visible switch is 46 × 28 px, with a 22 px knob translated 18 px when on.

### Navigation and grouped rows
The bottom bar has four icon-and-label tabs with a mint capsule behind the selected icon. Tab buttons are at least 58 px tall; active icon strokes and label weight increase. The implementation supports arrow, Home, and End navigation. Settings groups contain 65 px minimum-height rows, muted icons, optional explanatory text, separators, and trailing controls or chevrons.

### Chips and progress
The noninteractive XP chip is a compact mint badge; the warm streak chip is a button that explains planned days. Both pair icon and text. Progress bars are 7 px high and animate their inner scale; full and tiny contributions remain separately identifiable in the weekly chart. Do not use color as the only explanation of a completion state.

### Sheets and feedback
Bottom sheets use a dim backdrop, centered title, grabber, scrollable body, and Close. Longer tasks use full-screen sheets. Nested sheets preserve the preceding sheet; Back, Close, Escape, and backdrop dismissal remove the top sheet. The implementation focuses the active dialog, skips closed disclosure content in its Tab loop, and restores the preceding control on cleanup. Headers grow and wrap long titles while retaining the exit target. Focused fields are revealed within the sheet body when its viewport shrinks; enlarged form columns stack when needed.

Control transitions use the shared 200 ms duration and easing; press transforms use 160 ms, sheet entry 240 ms, backdrop entry 180 ms, completion marks 250 ms, and progress 360 ms. Milestone confetti runs for 1400 ms. Toasts occupy a region above the tab bar and expose polite status feedback. System and in-app reduced motion disable CSS animation, transitions, and CSS smooth scrolling; reduced transparency removes navigation blur.

### Pip and the Momentum Trail
Pip is the original generated transparent six-pose sprite at `public/assets/pip.png`, arranged as three columns and two rows: welcome, focus, celebrate, rest, return, and scarf. The component selects a square crop through background positioning and provides a pose-aware image label. The original generated landscape at `public/assets/trail.png` supports the journey; SVG route strokes and interactive reward nodes sit over it. Prompt sidecars beside both images record provenance. Use the supplied assets and calm scene scale; do not substitute emoji or unrelated mascots.

## Do's and Don'ts

### Do:
- Do preserve the porcelain, forest, and mint roles in both appearances.
- Do keep full and tiny actions understandable through labels and distinct completion marks.
- Do retain visible focus, fully opaque placeholders, wrapping text, and reduced-motion behavior.
- Do use Pip's supplied poses and the original trail artwork with their provenance sidecars.
- Do check new screens at 375, 393, and 430 px and with enlarged text.

### Don't:
- Don't replace the system typography or introduce a competing mascot style.
- Don't make a tiny action or a return after a miss look like an error.
- Don't reuse reward gold as the ordinary primary-action color.
- Don't add continuous celebration or motion that prevents the interface from settling.
- Don't infer unimplemented services or guaranteed accessibility compliance from this visual specification.
