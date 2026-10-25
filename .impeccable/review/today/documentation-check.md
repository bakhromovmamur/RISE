# Today simplification — documentation check

Checked 20 October 2026. **Verdict: documentation aligned with the completed Today refinement.** The independent finish review’s final narrow verdict is **ship — F1/F2 resolved**. This pass does not extend that verdict into a new broad audit.

## Authority and evidence

Read the Impeccable skill and `reference/document.md`, both PRODUCT.md copies, DESIGN.md, `.impeccable/design.json`, the Today and historical Daily life briefs, and the current manifest, verification notes and finish review. The explicit scope preserves the pinned design authority; no design-refresh or new-world workflow was invoked.

Inspected the final Today composition in `src/Balanced.tsx`, compact habit controls in `src/Today.tsx`, habit details in `src/Habits.tsx`, milestone presentation in `src/Development.tsx`, family disclosure/task controls in `src/Groups.tsx`, the supporting `src/balanced.css`, and the four scenarios in `tests/today.browser.spec.ts`. The corrected `nextHabit` predicate selects an unfinished habit, and the scoped compact milestone width wins over the legacy full-width rule.

Opened eight representative final captures: `mobile-393.jpg`, `rest-collapsed.jpg`, `mixed-priorities.jpg`, `completed.jpg`, `prayer-due.jpg`, `evening.jpg`, `large-text-rest.jpg` and `user-703.jpg`. They support the documented hierarchy, completed state, mixed-priority correction, prayer emphasis, evening Fajr placement and enlarged-text flow. All 19 files listed in the current manifest have byte-identical copies in `screens/today-clarity/`. The manifest records final build `index-YrJDMdMO.js / index-BNJQMM-t.css` and matching viewport/export dimensions.

The implementation owner reports a passing final production build, 53 domain tests and 27 browser scenarios (80 total). The final browser run followed the corrections; domain source was unchanged. This documenter did not rerun tests, use a browser, recapture screens, run a detector or package the deliverable.

## Alignment

- Prayer context comes first. The first unfinished priority habit expands full/tiny controls even after a milestone or family task; other priority rows remain compact with direct completion controls. Habit details retain tiny, upgrade, Undo and linked goals.
- Completed selections remain complete without automatic replacement. Two quiet reward rows follow priorities; the previous requirement to put both rewards before priorities or within the first viewport is superseded.
- My routine, Family and Your goals use native inline disclosures with summaries/counts. Family is conditional on an available family space. The single Fajr entry moves below prayers from Maghrib. Active prayer breaks stay prominent and completed return notes sit lower.
- Due prayer controls take primary emphasis while the habit action becomes secondary. The system font, porcelain/forest/mint tokens, paired action colors, control shapes and original artwork remain the incumbent vocabulary. These are local composition changes, not new global tokens.
- Schema 4 and local simulation boundaries remain explicit. The docs preserve the distinction between release labels and destructive fixture loading, local snapshots and external sharing, and alarm previews and actual device behavior.

## Documentation changes

Updated README’s current walkthrough and evidence claims, aligned the two PRODUCT.md copies, added current verification and screenshot-guide sections, and retained the earlier Daily life records as labelled history. Added the Today finish record and a short supersession notice on the Daily life brief. Corrected verification-notes wording from three to four new Today scenarios.

No source, tests, styles, assets, design authority or other review findings were changed. Packaging remains the parent delivery step. The existing design sidecar’s earlier component specimens do not enumerate every current Today composition; that scope does not warrant replacing the preserved authority.

## Preservation

Both authority hashes measured in this pass match the supplied values. Neither file was written:

| File | SHA-256 |
| --- | --- |
| `DESIGN.md` | `76423b11a448863fa80125d13e5a3c9d56f3b04f5d51e8414e90cbfd58ec5767` |
| `.impeccable/design.json` | `9cd451a5ed4e571eacef8c3ffbf6e8526f5d2dda3681490eb0b42234a1744aec` |

Original `public/assets/pip.png`, `trail.png` and both prompt sidecars remain present and untouched. Their hashes were recorded; this pass made no asset writes. No generated artwork was added.

This check establishes documentation alignment for a local prototype. It does not establish production readiness, religious validity, real device/alarm behavior, authenticated multi-user security, physical-device, Safari/WebKit, VoiceOver or full accessibility certification.
