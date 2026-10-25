# Shared archives and integrated group lifecycle

24 October 2026 · GROUP-05 / PRD-03–04, PRD-13–15, PRD-17–18; SEC-01, SEC-03 and SEC-05. Retained local/test Postgres/Auth/BFF on macOS. Cloud provisioning stays pending. Only synthetic accounts/subscriptions were used; no external email, invitation or push was sent. The saved profile on 4173 was not accessed.

The audit found a portability gap: the strict private account export intentionally contained no live shared records. Group settings now offer an explicit separate `rise.group-archive` v1. Recent authentication, current membership and the reviewed group revision protect every bounded page and final check. The validated complete file includes authorized family history or published squad snapshots. Private backup/cache formats stay unchanged; a shared file cannot restore membership. [Contract, exclusions and recovery](../../GROUP-LIFECYCLE.md).

| Command | Result |
| --- | --- |
| `npm run check` | Toolchain, lint, app/test/server types, 267 unit/tooling tests and both builds pass |
| `npm run test:infra` | 164 real database/BFF cases pass, including eight new archive/integrated lifecycle cases |
| `npm run test:groups` | 108 cases pass in Chromium, WebKit and Firefox |
| `npm run test:sync -- 'tests/sync/lifecycle.sync.spec.ts$'` | 12 private export, reauthentication, cleanup, lost-reply and stale-cache lifecycle cases pass |
| `npm run test:pwa` | 42 real-worker offline/update/private-cache cases pass |
| `npm run test:production` | 54 production-entry cases pass |
| `npm run test:browser -- navigation.browser.spec.ts` | 12 unchanged four-tab/shortcut/focus cases pass |
| `npm run test:visual` | 48 cases compare all 720 unchanged frozen references successfully |
| `npm run check:docs` | Current-document links, anchors, task dependencies and requirement mappings pass |

Node 24.16.0, npm 11.13.0, Playwright 1.64.1; Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. BFF/database suites ran sequentially on 4191 with credential captures disabled. Independent public-only PWA/navigation checks used 4181/4180; production followed PWA on 4181. Visual comparisons used 4182. These desktop engines are not physical Safari/iPhone/Android certification. Existing large-bundle advisories remain assigned to performance work.

Database checks cover exact family history/Undo and archived records; exact published squad choices and encouragement; exclusion of removed/withdrawn/private text; owner/member/unrelated/removed/left/expired-session permissions; Origin/CSRF/account assertions; stale revisions; corrupt stored history; complete 201-row pages of each family collection; concurrent edits/removal between pages; and oversized Unicode history with no partial file. No elevated role, RLS exemption, migration or timeout relaxation was added.

The combined lifecycle scenario populates private history, family/squad memberships, sole ownership, previews, posts/reactions, synthetic subscriptions and assignment/publication jobs. Last-owner deletion is refused until explicit transfer/group deletion. Injected suppression failure rolls everything back. Accepted deletion returns an exact terminal retry, rejects old JWTs and exports, retains deidentified family history, and erases authored squad data and recipient/source jobs. Restored stale memberships/content/preferences/subscriptions/jobs cannot override the retained ledger; the real isolated lifecycle worker repeats cleanup and verifies provider purge. A private export restores only personal data; a shared archive is rejected before mutation.

Browser checks exercise the real download worker/API, explicit confirmation, no private/guest/cache mutation, recent-authentication return to a second deliberate download, stale review, lost replies, cancellation/focus restoration, and no late file. The new two-tab deletion case dismisses shared forms, removes account data and rejects a restored stale cache even when its active-account pointer is reinserted. An authorized remaining member still exports retained family history without the deleted member's name.

Eighteen membership/settings scenes cover three languages, two appearances, five widths (320/375/393/430/1440) and two text scales in three engines: 3,240 states. Three new export states add 540; with task/list/priority and squad scenes, the complete group matrix covers 6,480 states. Fifty-four safe export screenshots and six initial failing captures are retained. All screenshot fixtures use unverified metadata without usable sessions or codes.

[Consent before the fix](screens/before-groups-export-family-controls-en-light-393-100.png), [consent after the fix](screens/groups-export-family-controls-en-light-393-100.png), [Russian enlarged controls](screens/groups-export-family-controls-ru-dark-320-200.png), [Uzbek enlarged controls](screens/groups-export-squad-controls-uz-dark-320-200.png).

The first large-history query timed out at the unchanged two-second statement limit. Its outer-group correlation hid the requested group's distribution, so PostgreSQL sorted the full history before LIMIT. After controlled comparison with the same analyzed synthetic data, an explicit inner group parameter used the existing date index and reached the correct whole-file size rejection. The original correlated query still failed with those statistics. Temporary diagnostic logging was removed; no authorization predicate was weakened.

Screenshot inspection then caught the export checkbox inheriting a full-width text-input rule. A direct sensitivity-label bounds check reproduced the clipping even though the outer dialog had no overflow. Existing confirmation spacing and scoped native-checkbox sizing now preserve the entire consent text at 320 px/200% text. The full three-language/engine matrix passes. The earlier expanded browser run was intentionally interrupted after finding this problem: nine passed, one interrupted and 32 unrun; it is not counted as acceptance. Early synthetic fixtures also had a duplicate same-week squad post and an incorrect notification-column name; those fixture errors were corrected before final acceptance.

Changes add the shared archive contract/server route, reuse exact screen projections, add a cancellable browser worker, extract the existing reauthentication form, localize explicit review/download states, and add integration/layout tests. Original artwork, design tokens, dependencies, private storage formats, applied migrations, historical evidence and frozen references remain unchanged. No data reset or cloud action was performed.

Rollback can remove the archive button/route while retaining current data and lifecycle hooks. Keep deleted-owner markers, the authoritative suppression ledger, all installed cleanup hooks and compatible private formats. Downloaded files cannot be remotely recalled. GROUP-05 is locally verified and in REVIEW for hosted backup operations and physical-device acceptance; this is not a production release verdict. QUALITY-01 is the next dependency-ready local task.

[Verification/source/build hashes](verification.json), [preservation audit](preservation.json), [safe visual manifest](visual-manifest.json), [complete database log](logs/infra-final.log), [complete group browser log](logs/groups-final.log), [correlated query failure](logs/export-size-correlated-statistics.log), [indexed query pass](logs/export-size-indexed-statistics.log), [layout failure](logs/export-layout-repro.log), [focused layout fix](logs/export-layout-fixed.log), [unchanged visual comparisons](logs/visual-final.log).
