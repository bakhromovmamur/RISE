# Diagnostic title reflow

25 October 2026 · OPS-01 / QUALITY-02 · PRD-01, PRD-17, PRD-20 and NFR-08 · local CI correction.

Hosted run `40209551589`, WebKit job `121217667347`, failed the Uzbek diagnostic-download layout assertion: the control's scroll width was 250 px, its client width 248 px, and the unchanged permitted maximum 249 px. The hosted synthetic screenshot showed the long Uzbek diagnostic title extending beyond its text column at 320 px and 200% text. Chromium passed its full job. Wider Linux font metrics exposed a title that had no emergency word wrapping; the diagnostic detail already allowed wrapping.

`src/diagnostics/Diagnostics.tsx` adds a scoped `diagnostics-group` class. `src/you.css` applies `overflow-wrap: anywhere` only to this group's row title. No text is hidden or truncated. Strings, system fonts, spacing, icons, colors, interaction, export content and persistence are unchanged. Other group rows retain their existing styles.

`tests/diagnostics.browser.spec.ts` retains all original layout, touch-size, keyboard-download, privacy and saved-state assertions. An additional Uzbek check temporarily uses a wider monospace fallback at 320 px and 200% text in light/dark appearances, then restores the ordinary font. It checks both the original row boundary and the title's own text column with the existing one-pixel tolerance. This controlled font condition makes the hosted overflow reproducible on macOS without changing production fonts or weakening the assertion.

Local verification used macOS arm64, isolated review origin port 4180 and Playwright 1.64.1. Installed engines: Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2.

| Command / comparison | Result |
| --- | --- |
| `node_modules/.bin/playwright test tests/diagnostics.browser.spec.ts --project=webkit --grep 'uz: explicit'` with the new regression before the CSS fix | Failed as expected: scroll width 251 px, client width 248 px, permitted maximum 249 px |
| `npm run build:review` after the fix | Passed |
| `node_modules/.bin/oxlint src/diagnostics/Diagnostics.tsx tests/diagnostics.browser.spec.ts --deny-warnings` | Passed |
| `node_modules/.bin/playwright test tests/diagnostics.browser.spec.ts` | 18/18 passed, zero retries/skips, 16.3 s across Chromium, WebKit and Firefox |
| `node_modules/.bin/playwright test --config .rise-infra/local-completion-20261025/diagnostic-overflow/playwright.probe.config.ts` | Focused equivalent-state comparison passed, 1/1, 4.5 s |

The 18-test suite covers English, Russian and Uzbek, light/dark appearances, widths 320/375/393/430 px, 100%/200% text, minimum 44 px control size, keyboard activation, a redacted diagnostic download, download failure/retry and exact saved-profile/source preservation. The added wider-font checks pass in all three engines.

The focused WebKit comparison captured the same synthetic diagnostic row and state before/after applying the wrapping rule, without reload or fixture changes between each pair. All eight ordinary-font image pairs at 200% text (four widths, two appearances) were byte-identical. Under the controlled wider font, the row changed from 251/248 px scroll/client width to 248/248 px; its title changed from 219/186 px to 186/186 px. The inspected resulting light/dark ordinary-font crops preserve the existing appearance; the wider-font crop shows the complete title wrapped inside its column. No golden references were regenerated. This focused comparison does not replace the full visual matrix or physical-device accessibility acceptance.

Private synthetic reports, before/after crops and the inspected hosted artifact remain under `.rise-infra/local-completion-20261025/diagnostic-overflow/`: `red/report.json`, `green-diagnostics-report.json`, `probe-report.json`, `probe-results/` and `hosted-artifact/`. No saved user origin or database was loaded, reset or migrated. Hosted rerun status belongs in the [overall CI report](README.md). Cloud provisioning and the remaining hosted/physical release gates stay pending.
