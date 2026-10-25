# OPS-04 local launch-policy and help evidence

**25 October 2026 · Asia/Tashkent · OPS-04 · PRD-18–20.** Local implementation only; cloud provisioning remains pending. [Scope, policy inventory, sources and open approvals](../../LAUNCH-POLICIES.md).

## Change and preservation

Settings now contains a read-only **Help & policies** disclosure using the incumbent controls, typography and palette. English/Russian/Uzbek Latin sections describe local privacy, use, export/deletion/retention, offline/permission recovery, adult audience, Fajr limits, interim private support and original third-party notices. The actual web release is shown; unavailable metadata is labeled honestly. Opening help does not save data, request permission, accept terms or contact anyone. Support reuses the existing explicit redacted diagnostic download and error/retry behavior.

The deletion confirmation previously promised primary purge within seven days even if the local process was stopped. Its three translations now distinguish the service target from an assured deadline and explain local backup expiry. No deletion implementation changed.

New implementation: `src/help/Help.tsx`, `text.ts`, `third-party-notices.txt` and `scripts/check-notices.mjs`. Small integration changes: `src/Personal.tsx`, `src/you.css`, `src/account/text.ts`, package scripts and the browser CI check. New tests cover actual production help/reflow/storage preservation, real-worker offline cold start, and notice-checker stale/missing/version-mismatch failures. The existing visual test names the added Settings state `settings-help` to preserve every historical reference.

No dependency version, lockfile, domain/repository/cache/schema, backend, migration, worker, original image or provenance sidecar changed. No user origin was loaded/reset; no database/provisioning/release-selection command was run. Browser fixtures stayed on isolated 4180/4181/4182 with the shared outbound-origin guard. All user data operations in checks used synthetic fresh contexts. Source hashes supplement those observable preservation checks; this task does not claim a fresh production-database audit.

## Verification record

The final command results and versions are recorded in [verification.json](verification.json). Initial `npm run check` passed 311 tests before the new checker regression was added. Final `npm run check` passed **312 tests**, toolchain/notice checks, correctness lint, application/test/server types and production/review builds. Existing bundle-size and ineffective dynamic-import warnings remain; no new dependency was added.

The first complete production run passed **75/75** checks. After adding one explanatory retention sentence, the final bundle passed **75/75** with `npm run test:production -- --workers=1`. An intervening parallel run passed 74/75: WebKit’s existing migration-summary test exceeded the unchanged five-second saved-status wait while visual tests also ran. The captured page was still saving, with no reported app exception. The complete isolated sequential rerun passed without code, assertion or timeout changes; this does not claim the timing sensitivity has been fixed. The real-worker PWA suite passed **54/54**, including nine new localized help/notice offline cold starts. Existing diagnostic download/redaction/failure/retry checks passed **18/18** across three engines. The source checker covers all 12 browser notice packages and records 315 lock entries; it checks attribution freshness, not legal compatibility or full native/container licensing.

## Visual acceptance

The first full comparison against historical references produced **694 identical images** and **26 expected Settings differences**: 24 normal-text views and two English 430 px enlarged-text views. Every difference starts at or below y=593 and is confined to the added Help row/footer area; no other scene differed. This is an additive PRD-19 help control, not a redesign. [Difference bounds and original hashes](visual-changes.json) preserve the comparison.

The old `settings` files remain intact. Separate `settings-help` references are created only for this reviewed addition with `npm run test:visual -- --update-snapshots=missing`; other references are neither updated nor removed. The subsequent ordinary `npm run test:visual` run passed the full **48-variant/720-image** matrix. [Variant/build/fixture evidence](visual-verification.json) and [new reference hashes](settings-reference-manifest.json) record that acceptance. Production help tests independently exercise every section in all three engines/languages at 320/375/393/430 px, 100%/200% text, light/dark, reduced motion, keyboard open/close and restored focus. The original personal state and legacy recovery bytes are compared before/after reading and diagnostic download. Screenshots are synthetic; [selected captures](screens) show the incumbent composition.

## Rights, privacy and limits

[Dependencies](dependencies.json) retain original declared licenses and notice hashes. The 12 browser-package notices include tslib's separate copyright notice and Lucide's Feather attribution. The wider lock includes MPL-2.0, so no blanket MIT clearance is asserted. [Preservation](preservation.json) records unchanged protected source/assets/references; [secret scan](secret-scan.json) compares known local/test secret values without publishing them.

The intended markets remain Uzbekistan/Kazakhstan. Operator identity, public support/security contact, named incident coverage, actual provider/region/processor arrangements, deployment-specific privacy/terms approval, app license and artwork/distribution rights approval remain open. Prompt sidecars are provenance, not proof of rights clearance. Current official-law references identify review needs and do not approve a region or claim compliance.

Support remains the existing private project conversation; there is no dedicated public address or promised response time. No message was sent. No age verification or terms-consent database is claimed. Real HTTPS-device delivery/accessibility, supervised maintenance, hosted operation and public launch remain unaccepted. The existing backup/suppression/retention limits are disclosed rather than replaced with new promises.

## Recovery

Reverting this presentation/notice change needs no data migration or clearing. Keep compatible account/guest/push formats and use the normal safe PWA update/OPS-03 release boundary. Existing open/offline pages retain their previous notice until they update. This task has not changed the selected sealed local package or started a server/sender/cleanup process.
