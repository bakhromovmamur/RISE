# RISE command and production-entry implementation evidence

**Date:** 21 October 2026  
**Tasks:** FND-04 and WEB-01  
**Requirements:** PRD-01, PRD-02; foundation for PRD-04 and SEC-03/06  
**Implementation and verification:** Codex, local workspace; no deployment

## Scope

This batch builds on [FND-01/FND-02](../foundations-2026-10-21/README.md). It adds the initial validated personal record commands and repository contract, breaks domain import cycles, and separates production startup from scenario-review tooling. It retains AppContext-compatible screens and the existing localStorage bridge. It does not implement the IndexedDB/outbox migration, full backup validation, accounts, server authorization or background push.

## FND-04: command and storage boundaries

- [Command schemas](../../../src/contracts/commands.ts) accept a discriminated set of habit check/correction/archive, priority, goal milestone/status, reward enjoyment, prayer record/pause/resume and Fajr acknowledgment intents. Runtime parsing checks dates, enum values, identifiers, booleans, revisions and priority cardinality/uniqueness. Unknown fields/kinds, non-JSON objects, accessors, prototype-pollution keys, excessive nesting and mutations over 64 KiB are rejected.
- [Domain command application](../../../src/domain/commands.ts) checks record references and delegates to existing calculations. Today's habit check-in uses it. Check, tiny/full upgrade, Undo and correction keep their existing XP/reward semantics. Prayer, pause, goal and Fajr intents remain separate from habit XP.
- [The local repository](../../../src/data/repository.ts) validates an operation before calling a storage adapter. The adapter contract requires serialized atomic transactions. Stable operation IDs and receipts make retries idempotent; changed content under the same ID is rejected. A stale base revision returns a conflict without silently overwriting the winner. Failed commits report failure rather than a save.
- The provided in-memory adapter is non-durable. Tests verify detached reads, failed commit preservation and a concurrent check/Undo conflict followed by an explicit retry. There is no active cloud outbox or production database claim.
- Calendar/habit-calendar and prayer-ID/pause functions moved into small shared modules with existing function bodies retained. Model re-exports preserve screen imports. [The boundary inventory](module-boundaries.json) records an acyclic runtime graph with no UI modules. Existing fixture construction moved to review code; production empty-profile construction has its own module.

The migration is intentionally staged: remaining AppContext `setState`, forms and drafts still use their current paths. DATA-01 supplies the real durable adapter and stored-profile validation/recovery; DATA-03 moves the remaining personal journeys. FND-04 establishes and exercises the contract rather than claiming those dependent tasks are complete.

## WEB-01: production versus review

| Build | Startup | Tooling/origin |
| --- | --- | --- |
| `npm run build` → `dist/` | Empty personal profile, real device date/time and the existing onboarding | No reviewer or design modules; URL parameters cannot activate them |
| `npm run build:review` → `dist-review/` | Existing Daily life fixture and existing scenario chooser | Loopback ports 4174, 4180 or 4182 only; origin checked before state loads |

The production build plugin fails if `src/review/`, `src/demo.ts` or `src/DesignSystem.tsx` reaches a generated chunk. The review build refuses the personal preview on 4173, the production test origin on 4181, public domains and LAN origins. This guard complements separate output directories; it is not authentication or a substitute for deployment controls.

Manual review uses `npm run preview:review` or `npm run dev:review` on 4174. The historical walkthroughs remain useful there. New production storage contains no people, groups, XP, checked history, rewards or timetable snapshots. Habit suggestions remain opt-in during the unchanged onboarding.

Existing schema 1–4 profiles open with authored content and recorded habit/prayer history retained. Production migration of a habit-only profile no longer invents prayer accomplishments. Existing mixed/sample history is retained without silently reclassifying or uploading it; provenance review remains DATA-01/SYNC-01 work. Malformed JSON and unsupported versions remain byte-for-byte in localStorage, with the existing recovery download available and automatic overwriting disabled. This is bounded startup evidence, not completion of the full malicious/corrupt/quota/multi-tab import and migration matrix.

## Design and privacy

No CSS, design-authority file or artwork is changed. Equivalent-state comparisons reuse all 720 frozen golden images; reference files are never regenerated for this batch. The only intentional startup difference is the required empty production entry. Desktop review controls remain available in the isolated build; production has a localized device-private footnote. Existing tabs, sheets and personal flows retain their composition.

All tests use synthetic data in fresh browser contexts. External origins are blocked. The saved personal profile on port 4173 is not opened, seeded or reset. No production service, domain, account, email or invitation is configured or contacted.

## Verification

Run `npm run check` first. It includes toolchain/lint/type checks, domain/tooling tests and both builds. Then run `npm run test:browser`, `npm run test:production` and `npm run test:visual` against immutable temporary build copies on ports 4180, 4181 and 4182 respectively. Do not overlap the unit/tooling phase with production browser tests because the test-server regression reserves 4181 briefly.

The GitHub Actions workflow now builds and checks both variants in each browser job. It remains a local configuration with no hosted run: the workspace has no Git repository or remote. Physical-device/PWA, IndexedDB, auth/sync, Web Push and real collaboration acceptance remain open in TASKS.md. Existing bundle-size warnings remain assigned to the performance task.

### Final local result

| Check | Result |
| --- | --- |
| Toolchain / lint / application, tests and config types | Passed |
| Domain and tooling tests | **81 passed**: 71 existing, 7 command/repository, 2 entry-isolation and 1 test-server regression |
| Existing browser journeys | **207 passed**: 69 per engine, no failures, skips or retries |
| Production entry | **21 passed**: 7 per engine, no failures, skips or retries |
| Visual parity | **48 configurations / 720 exact image matches**, zero allowed different pixels, original references retained |
| Production and review builds | Passed; all final served files match the tested build bytes |
| CSS, design authority and artwork | Original hashes unchanged |
| Deployment / hosted CI | Not run |

The [machine-readable verification record](verification.json) stores versions, report statistics, final source/build hashes and explicit limitations. A final unused-import cleanup produced identical served files; rebuilding also cleared unreferenced generated copies from `dist/`. Browser verification used Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0 on macOS 26.6.2 (25G83), Playwright 1.64.1, Node 24.16.0 and npm 11.13.0. The earlier foundation record remains dated evidence for its own build.
