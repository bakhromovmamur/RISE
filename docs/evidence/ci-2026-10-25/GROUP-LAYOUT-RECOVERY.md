# Invitation error-layout fixture and automatic recovery

25 October 2026 · GROUP-01 / GROUP-04 / QUALITY-02 / FND-02 · PRD-14, PRD-17 and NFR-08.

Hosted [run 40211768434](https://github.com/bakhromovmamur/RISE/actions/runs/40211768434), source `66ba9fd`, infrastructure job `121224673257`, passed 105/111 group cases. Six failures were confined to the synthetic group-layout scenario: all WebKit languages and Firefox Russian waited for a reload button that was no longer present; Firefox English/Uzbek encountered a detached button during the error-layout matrix. All 37 Chromium group cases passed.

The fixture returned HTTP 503 `unavailable` for invitation paging while continuing to return fresh valid owner metadata from `/api/v1/groups`. The documented `GroupInvitations` recovery behavior deliberately replaces an unavailable invitation page with the first authorized page when fresh owner metadata arrives. `GroupProvider` performs this read every 15 seconds and on focus/online/visibility events. The old test incorrectly required the temporary error scene to remain present throughout its long layout matrix. Successful recovery could therefore remove the expected reload control or replace the button being scrolled. This was a fixture assumption, not a reason to suppress production refresh or recovery.

A deterministic local reproduction inserted a focus refresh immediately after the original 503 page failure. WebKit English then failed the error-visible assertion in 14.3 seconds because fresh metadata correctly cleared that error. The reproduction command was `npm run test:groups -- layout.groups.spec.ts --project=webkit --grep '· en' --max-failures=1`; the broad filename expression also selected other layout files, so its aggregate was one passing content-layout case, one failing target case and one unrun case.

Only `tests/groups/layout.groups.spec.ts` changes. The persistent visual error scene now uses a synthetic HTTP 429 `rate_limited` paging error, which the existing reader retains across same-revision metadata refreshes until explicit reload. This is a fixture response, not verification of a real endpoint's rate-limit configuration. A forced focus refresh verifies that scene remains present. Every error-matrix iteration asserts the localized error, enabled reload button and absence of stale revoke actions, in addition to all existing overflow, header, scrolling, close-control, screenshot and focus checks. Successful explicit reload restores 20 invitation actions, disables previous-page navigation and enables older-page navigation.

A separate 503 case preserves automatic recovery coverage. It waits for the exact invitation endpoint's completed 503 response, forces a fresh owner-head read while the paging endpoint remains unavailable, and verifies that the error/reload control disappears, 20 authorized first-page actions return, and navigation resets. It does not require a transient error to remain visible long enough for a slower runner to inspect it. Product code, timers, refresh listeners, permission checks, strings, styles, state formats and test timeouts/retry settings remain unchanged.

Independent read-only review checked the distinction between the persistent visual error and temporary outage recovery. The review caught and removed a transient-DOM visibility prerequisite in the new 503 branch before final verification. An intermediate run was deliberately stopped after one Chromium pass to apply that correction; it is not reported as a completed regression run.

Local verification uses macOS arm64, Node 24.16.0, npm 11.13.0 and Playwright 1.64.1 on isolated port 4191. Browser manifest versions: Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0.

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/group-invitations.test.ts` | 7/7 passed; includes unavailable recovery, busy-state non-recovery, authorization errors and ownership loss |
| `node_modules/.bin/oxlint tests/groups/layout.groups.spec.ts --deny-warnings` | Passed |
| `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json` | Passed |
| `npm run test:groups -- 'tests/groups/layout.groups.spec.ts$'` | 9/9 passed, zero failures/skips/retries, 4.9 min across all three languages and engines |

The matrix retains English/Russian/Uzbek, light/dark, widths 320/375/393/430/1440 px and 100%/200% text. Only unverified synthetic metadata is used; service workers, traces, video and automatic failure screenshots remain disabled. Existing explicit synthetic layout screenshots are retained by the test. The inspected English 320 px / 200% dark screenshot contains the complete error, reload control and privacy copy within the layout. No golden files, actual invitations, saved user origins, production application code or cloud resources are changed. Private red/intermediate/final reports are retained under `.rise-infra/local-completion-20261025/group-layout-recovery/`. Hosted rerun status belongs in the [overall CI record](README.md); cloud provisioning and remaining release gates stay pending.
