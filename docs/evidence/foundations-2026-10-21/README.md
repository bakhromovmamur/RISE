# RISE foundation implementation evidence

**Date:** 21 October 2026  
**Tasks:** FND-01, FND-02; decision collection for FND-03  
**Requirements:** PRD-01, PRD-17, SEC-06  
**Implementation and local verification:** Codex, in the existing project folder

## Scope and starting evidence

The first implementation batch establishes a reproducible visual and behavioral baseline and executable toolchain checks. It preserves the current application and adds one keyboard-accessibility correction discovered by extending the browser matrix.

[source-baseline.json](source-baseline.json) records SHA-256 hashes for 68 existing source, asset, design, test and configuration files before the foundation edits. This folder has no initialized Git repository or configured remote; hashes and the dated evidence identify the starting point without inventing a commit.

Before changes, `npm test` passed **71 domain tests**, `npm run build` passed, and the original Chromium suite passed **69 browser scenarios**. These results were rerun for this implementation batch.

## FND-01: parity contract and reproducible captures

The golden images are in [tests/visual/baseline/darwin](../../../tests/visual/baseline/darwin). The runner is [parity.visual.spec.ts](../../../tests/visual/parity.visual.spec.ts), with [dedicated configuration](../../../playwright.visual.config.ts). Normal comparison uses `updateSnapshots: "none"`, a zero color-difference threshold and zero allowed different pixels; missing or changed images fail instead of silently creating a new baseline.

| Dimension | Captured coverage |
| --- | --- |
| Fixture | Explicit synthetic `daily-life`, frozen at 19 October 2026; localized examples only during fixture construction |
| Viewports | 375 × 852, 393 × 852, 430 × 852, 1440 × 1000 CSS pixels |
| Languages | English, Russian, Uzbek Latin |
| Appearance | Light and dark |
| Text size | 100% and 200% root font size, verified as 16 px and 32 px |
| Browser rendering | Pinned Chromium, macOS, device scale 1; reduced motion; decoded images and loaded fonts before capture |
| Surfaces | Today, Journey, Progress, You, priorities, habit detail, personal reward, goal detail, prayer preferences, prayer setup, Fajr plan, private pause, family, squad and settings |
| Total | 48 configurations × 15 surfaces = **720 golden images** |
| Isolation | Fresh browser contexts on `127.0.0.1:4182`; no personal profile or production origin |

Images capture the application shell at the specified viewport, including the desktop phone frame. The surrounding prototype reviewer rails are not part of the product parity reference. At 200% text, scrollable sheets are captured at their initial reading position; the behavioral tests separately exercise controls and navigation. This is a browser rendering baseline, not a physical-device or assistive-technology certification.

### Explicit parity checklist

| Contract | Evidence to preserve during later work |
| --- | --- |
| Four tabs and hierarchy | Four captures per configuration; existing navigation and heading tests |
| Today prayer context, three priorities and compact completed actions | Today/priorities captures; priority, full/tiny/Undo and disclosure tests |
| Journey unlock, reward selection and history | Journey/reward captures; claim, enjoyment, selection and expanded-trail tests |
| Progress summaries and shared week | Progress/goal captures; week-selector and goal-movement tests |
| You and its four destinations | You/preferences/settings/group captures; destination and focus-restoration tests |
| Sheets, back, close and drafts | Eleven sheet captures per configuration; nested-draft and keyboard tests |
| Independent domain records | Capture assertions preserve habit/prayer days, goals and rewards; domain regressions protect XP and explicit recording |
| Colors, typography and artwork | Existing CSS, DESIGN.md, design sidecar and artwork remain unchanged |
| Equivalent state | Same named fixture, date, language, theme, viewport and scale; each run attaches the fixture hash and browser version |

Allowed future supporting additions remain exactly those in PRD-01: account/sync, installation, offline/error/conflict, invitation, privacy and security-confirmation states using existing components. Removal of simulation labels requires implemented behavior. These references do not authorize a redesign or certify simulated groups/reminders as production features.

### Known limitations of the baseline

- Uzbek coverage is still partial, as recorded before this work; the baseline preserves that fact rather than claiming translation completion.
- Initial browser entry and group/reminder simulation remain prototype behavior pending WEB-01 and later tasks.
- The existing main JavaScript bundle still exceeds Vite's 500 kB warning threshold. No warning threshold was increased to conceal it.
- System fonts vary by operating system. The checked-in references are macOS/Chromium; Linux CI executes behavioral tests and must not compare its font rasterization with macOS goldens.
- Physical iPhone/Android, native alarms, browser background push, accessibility certification and production security remain separate acceptance work.

## FND-02: reproducible tooling and checks

- Node **24.16.0** is pinned in `.nvmrc` and package engines; npm **11.13.0** is pinned in engines and `packageManager`. `.npmrc` enforces engine compatibility and exact future package saves.
- Existing direct runtime libraries retain their resolved versions. The lockfile remains the source of transitive resolution. Node typings are aligned with Node 24, and Oxlint 1.89.0 provides correctness linting without replacing TypeScript 7 or its build.
- `check:toolchain` verifies runtime versions, exact direct dependency versions and package/lockfile agreement. `typecheck` covers application, tests and configuration; `lint` covers source, tests, scripts, worker and configuration.
- Linting intentionally excludes unused-symbol cleanup and React Compiler migration rules. It does not require unrelated source cleanup or claim a complete React/security audit. New behavioral work still needs the tests required by AGENTS.md.
- The browser suite now has Chromium, WebKit and Firefox projects. Each server takes its own temporary copy of the finished build, binds loopback, uses a fixed isolated port, refuses an existing server and fails if that port is occupied. The temporary copy is removed on normal shutdown.
- A shared test fixture rejects non-test base URLs and aborts page/context requests to another origin. Test-only ports are 4180/4181/4182; the user's 4173 profile is never seeded by this suite. Visual and behavioral runs have separate output directories.
- The GitHub Actions workflow uses read-only permissions, exact action commit pins, no persisted checkout credentials, a pinned toolchain, a three-browser matrix and short-lived synthetic failure artifacts. No production secret or deployment step is included.

The workflow file exists locally. This workspace has no Git repository or configured remote, so hosted CI has not run. Its commands are validated locally; connecting a repository and enabling hosted checks remains an operating step.

### Failures found and resolved

[initial-cross-browser.json](initial-cross-browser.json) preserves the first expanded matrix result: 136 passes and two failures across WebKit and Firefox.

1. **WebKit modal focus escape.** The existing goal-form test failed twice at the sixth Tab key: focus reached the document body because WebKit skipped button targets in its native tab order. A boundary-only focus trap never saw its expected last button. `Sheet` now advances through visible, enabled, non-inert tab targets explicitly in either direction. The existing regression now checks forward and reverse traversal. Screen markup, styles and business behavior are unchanged.
2. **Firefox fractional geometry.** Adjacent trail rows returned a shared edge as `1177.1000213623047` and `1177.0999755859375` CSS px. The non-overlap assertion now allows **0.001 CSS px** of numerical noise and still fails visible overlap; no layout assertion was removed or skipped.
3. **Previously unchecked test types.** A two-value prayer-fixture loop is now a literal tuple. Runtime behavior and its assertions are unchanged.
4. **Concurrent evidence output collision.** Early capture teardown lost temporary trace files because the original browser runner cleared the parent output directory. The runners now own separate output directories; the complete comparison is rerun before accepting the baseline.
5. **Mutable build output.** An overlapping build temporarily removed `dist/index.html`, causing one Chromium test to receive HTTP 404 ([record](build-race.json)). Each test server now serves a frozen temporary build copy. A new tooling regression deletes and replaces a separate synthetic source directory and verifies that the running server continues to return the original page; it never modifies the application's build or personal preview.

## Verification and maintenance

Run `npm ci`, `npm run check`, `npx playwright install chromium webkit firefox`, and `npm run test:browser`. After building, run `npm run test:visual` on the baseline platform. These commands use synthetic data and do not contact the intended public domain.

`npm run test:visual:update` deliberately replaces golden images. Use it only for an accepted visual change, inspect the differences, and record the corresponding requirement and new fixture/build metadata. Never update goldens merely to make a failing comparison pass.

The final [machine-readable verification record](verification.json) and [capture inventory](visual-manifest.json) accompany this report. FND-03's confirmed inputs and unresolved hosting decisions are in [the infrastructure decision record](../../INFRASTRUCTURE-DECISIONS.md).

Tooling references checked during implementation: [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config), [typescript-eslint compatibility/setup](https://typescript-eslint.io/getting-started/), and the pinned releases for [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) and [upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2).

### Final local result

| Check | Result |
| --- | --- |
| Clean install | 140 packages installed; audit reported zero findings |
| Toolchain, lint, types and build | Passed |
| Domain/tooling | 72 passed: 71 domain cases and the test-server race regression |
| Browser behavior | 207 passed: 69 each in Chromium, WebKit and Firefox; no skipped or flaky cases |
| Visual comparison | 48 configurations / 720 images; zero changed pixels; references unchanged |
| Design/artwork | Original hashes unchanged |
| Hosted CI / deployment | Not run; no Git remote or production environment configured |

Browser verification used Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0 on macOS 26.6.2 (25G83), with Playwright 1.64.1, Node 24.16.0 and npm 11.13.0. This is dated evidence for the foundation batch, not acceptance of later application changes.
