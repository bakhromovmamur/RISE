# Product-document review and local browser entry

23 October 2026, Asia/Tashkent. Scope: DOC-01 consistency and the outstanding INFRA-01 local-origin follow-up; PRD-01/03/04/17 and SEC-02/03/06. This is an execution checkpoint for the active goal, not complete-product acceptance.

The user reconfirmed **“Keep cloud pending; finish local work first.”** No cloud provisioning, DNS, purchase, external email or real-provider notification was performed.

## Document audit and execution order

Reviewed the core product/specification/task/design/security documents and every current guide directly under `docs/`. Historical brief, walkthroughs, language guide, verification archive and screenshot/evidence indexes were checked for scope and provenance. Dated evidence retains its original results; historical counts were not reused as new acceptance.

The task graph contains **38 tasks: 10 DONE, 3 IN PROGRESS, 9 REVIEW and 16 TODO** at this checkpoint. Dependencies resolve without a cycle. REVIEW generally denotes verified local implementation with open hosted/device acceptance. Those tasks must not be checked complete merely because downstream local work can use their verified contracts.

Current documents contradicted later implementation in several places: account cache/sync/deletion described as absent, scheduled push described as disabled, old receipt grants/retention, proposed routes presented beside implemented routes, and the unresolved local-origin note. Reconciled these claims with code and linked evidence. Marked historical guidance explicitly; preserved domain/design requirements and dated reports. Corrected the nonexistent `PERF-01` reference to `QUALITY-03`. The deferred 15-minute habit expiry remains a proposal; the implemented protocol still uses 120 seconds.

Proceed in this dependency order while cloud remains pending:

1. Resolve the INFRA-01 local browser-entry defect and reconcile current documentation — completed locally in this checkpoint.
2. Complete PUSH-02 local receipt-retention/replay behavior, bounded cleanup and measured queue capacity/latency. Preserve cancellation and receive authorization; synthetic provider evidence cannot accept physical delivery.
3. Implement GROUP-01 membership/invitation/ownership and recent-auth/deletion resolution, then GROUP-02 shared tasks/lists and GROUP-03 exact squad snapshots, followed by GROUP-04 notifications and GROUP-05 integrated lifecycle tests.
4. Complete QUALITY-01 localization/parity, then locally executable QUALITY-02 accessibility, QUALITY-03 performance/resilience and SAFE-01 authorization/security checks after their relevant features exist.
5. Complete locally reviewable OPS-01–04 diagnostics, retention/restore, rollback and accurate help/policy preparation as dependencies become available. Named contacts, rights/legal decisions and hosted operation remain explicit external gates.
6. Run hosted/physical acceptance and RELEASE-01/02 only when their prerequisites and user direction permit. No native or retired Plus work is added.

FND-03 operating decisions, hosted INFRA/AUTH/SYNC acceptance, WEB-02/PUSH-05 physical HTTPS devices, manual assistive-technology evidence, real pilot participation and release sign-off remain open. Local progress must continue where independent of those gates; their absence does not authorize invented evidence.

## Local browser diagnosis and fix

The original smoke on port 4190 passed Chromium and failed WebKit/Firefox. A fresh-context reproduction again produced WebKit navigation timeout and Firefox interrupted navigation. The same failure occurred on the plain health JSON with service workers blocked, while a minimal page on 4192 loaded in both engines. This ruled out app startup and worker behavior. WebKit's [recorded port restriction](https://trac.webkit.org/timeline?from=2016-05-13T04%3A52%3A24-07%3A00&precision=second) identifies 4190 as ManageSieve.

`npm run server:local` now serves the retained local installation at `http://127.0.0.1:4192`. Configuration accepts only that fixed local alias. `installationOrigin` continues to verify the original 4190 database marker; HTTP Host and Origin/CSRF use the actual 4192 serving origin. Test/hosted aliases and arbitrary hosts/ports fail closed. No migration, installation/key rewrite, credential change, browser reset or data transfer occurs. Old Chromium storage remains on 4190 and the personal preview remains on 4173. Local cookies are host-scoped, so use one local entry at a time per browser profile.

`npm run check:local-browser` freezes the completed production build, refuses an occupied 4192 listener and uses ephemeral Chromium/WebKit/Firefox contexts. It checks production entry, durable empty-profile startup, uncached health, anonymous sync denial and actual service-worker-controlled reload. It loads no fixtures, signs into no account and never opens an existing browser profile.

Changed code: `server/config.ts`, `server/database.ts`, `server/local.ts`, `scripts/infra/check-local-browser.ts`, `tests/server.test.ts`, `tests/infra/isolation.test.ts`, package scripts and the document link/dependency checker. Frontend/domain/style/artwork/storage formats are unchanged.

## Verification

Local macOS/arm64, Node 24.16.0, npm 11.13.0, Playwright 1.64.1. Engines: Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Desktop engines are not physical mobile certification.

| Command | Observed outcome |
| --- | --- |
| `npm run check` before edits | 216 tests passed; lint/types and both builds passed |
| Focused local-origin regression before fix | Failed: config still selected 4190 instead of required 4192 |
| Focused config and real-database checks after fix | 7 config/server checks and the new real local-marker test passed |
| `npm run check` after code fix | 217 tests passed; lint/types and both builds passed; existing large-bundle advisory remains |
| `npm run test:infra` | 91 passed, including retained local identity, wrong-marker denial, existing owner/session security, lifecycle and push tests |
| `npm run check:local-browser` | All three engines passed entry, health, anonymous denial and controlled reload |
| `npm run test:backend` | 9 passed in three engines |
| `npm run test:auth` | 21 passed in three engines |
| `npm run check:docs` | 28 documents, 383 local links, 55 anchors, 38 task dependencies/statuses and 20 PRD mappings passed |

Database/BFF suites ran sequentially. Existing local/test stacks were started without resets; unrelated Docker stacks were untouched. No sender was started with real subscriptions for this check. Credential-flow traces/video/screenshots remain disabled. The frontend did not change, so visual goldens were not regenerated and no new visual claim is made.

Run `npm run check:docs` to reproduce current-document local link/anchor, task dependency/checkbox and PRD mapping validation. [Document results](documents.log), [code checks](check.log), [database checks](infra.log), [local browser smoke](local-browser.log), [BFF checks](backend.log), [auth checks](auth.log) and [preservation comparison](preservation.json) accompany this report. The automatic `.impeccable/hook.cache.json` metadata changed during tool execution; it was not reset. No existing file was removed, and no `src/` or public frontend file changed.

## Recovery and remaining work

Stop the 4192 process to roll back this supporting entry. Retain the original protected configuration, 4190 database marker, keys, schemas and browser-origin data. The original 4190 command remains available to Chromium. No browser storage migration or schema downgrade is required.

This resolves the local-origin follow-up only. INFRA-01 and the overall goal remain open. Push retention/capacity and GROUP work are next; hosted/physical gates remain pending.

## Follow-on local implementation

The next PUSH-02 queue/retention/load increment is now locally verified; see [its separate report](../push-retention-2026-10-23/README.md). This audit’s counts, browser-origin evidence and preservation snapshot describe the earlier audit checkpoint. The task register records the latest status without rewriting that evidence.
