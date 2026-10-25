# PUSH-02/PUSH-03 local queue and retention verification

23 October 2026 · macOS · existing retained local/test installations. Cloud provisioning remains pending by the user's direction. Scope: PRD-11/19, NFR-05 local fixture, SEC-04/05. No real-person email or Web Push was sent. The frontend profile on 4173 was not used for fixtures.

## Result and boundaries

Four bounded sender lanes now process due reminders without holding connections behind a busy owner's dispatch. Database leases, current authorization, cancellation ordering and expiry remain authoritative. Cleanup is bounded. Seven-day plan/cancellation receipt retirement uses a narrowly granted private function and an owner retention marker; it cannot read receipt payloads or personal/provider data. New cancellation requests durably bind their generation before POST. Lost replies after cleanup cannot cancel a replacement plan. Unverifiable legacy intent retains its original request and requires an explicit current-plan choice in the existing localized notification sheet.

The local load fixture submitted all 200 simultaneously due reminders across 100 synthetic accounts/two installations each. With an injected 100 ms provider response, database due-to-submission p95 was **7,322 ms** (p50 3,269 ms; max 7,716 ms), with four concurrent submissions and all 200 accepted. This meets the 30-second threshold for this stated local fixture. It is not physical delivery or hosted-capacity acceptance.

Files: `server/push/{jobs,worker,runtime,plans,cancellation}.ts`; `scripts/infra/{push,check-push-load,serve-test-backend}.ts`; `src/contracts/pushCancellation.ts`; `src/push/{client,store,PushSettings,text}.ts(x)`; the accepted auth-error list; associated unit/database/browser tests and command registration. Additive migration: `20261023115410_bounded_push_queue_retention.sql`, applied without resets to both retained installations. No CSS, artwork, service-worker receiver or personal-domain calculations changed in this increment.

## Verification

| Command | Result |
| --- | --- |
| `npm run check` | 218 unit/tooling tests; lint, app/test/server types, production and review builds pass |
| `npm run test:infra` | 94 real database integration tests pass |
| `npm run check:push-load` | 100 owners, 200 jobs, p95 7.322 s; zero external provider requests |
| Local/test `supabase db advisors --type all --level warn --fail-on warn` | Both installations report no issues |
| `npm run test:visual` | 48 matrix cases / 720 unchanged frozen screenshots; references not regenerated |
| Impeccable detector on changed notification component | No findings |
| `npm run test:push` plus `npm run test:push -- cancellation.push.spec.ts live-sender.push.spec.ts` | 54 unique cases pass across full/focused runs; final focused 12/12 |

Browser verification uses Chromium 156.0.8078.4, WebKit 27.2 and Firefox 157.0 through Playwright 1.64.1. Node 24.16.0/npm 11.13.0. The first full push run passed 52 cases and caught two fixture-isolation failures: the new lost-reply test intentionally left a replacement plan scheduled and initially omitted its own sign-out cleanup. Cleanup was added without weakening the sender's guard against other owners' work. The second full run passed 53 cases; Firefox's simultaneous authorized read caused the new deliberate busy-owner deferral, invalidating the former one-tick acceptance assertion. That test now drives bounded subsequent ticks and requires exactly one provider submission. The final focused run passed all 12 cancellation/sender cases across the three engines on the final build. Combined with the full run, **all 54 unique push cases pass**; a single clean 54-case run is not claimed.

Database coverage includes bounded deletes/current-row preservation; owner/public/worker grant denials; immutable legacy and generation-bound replay; concurrent owner locks; no attempt consumed on deferral; cleanup rollback; and owner-root marker cascade. Existing cancellation-versus-send races, account suppression, revocation, expiry, retries, takeover and historical personal-data regressions also pass. New browser cases use the real BFF, Auth, Postgres and IndexedDB for both lost-reply replay after cleanup and explicit legacy recovery; only OS subscription/provider delivery remains synthetic.

Layout checks cover English, Russian and Uzbek Latin; light/dark; 320/375/393/430 px at 100%/200% text, plus desktop. Manual inspection of the English, Russian-large-text and Uzbek captures found readable wrapping and accessible scrolling; no source text, font or layout substitution was used. The unchanged cancellation scene was retained for comparison. [English recovery](push-review-en-light-393-100.png), [Russian 320 px / 200% dark](push-review-ru-dark-320-200.png), [Uzbek recovery](push-review-uz-light-393-100.png), [existing cancellation scene](push-cancel-en-light-393-100.png).

## Evidence and recovery

[Check log](check.log), [final full push run](browser-final.log), [final focused browser run](browser-focused.log), [visual matrix](visual.log), [database integration](infra.log), [load measurements](load.log), [local advisor](advisors-local.log), [test advisor](advisors-test.log), [mechanical design check](design-detector.json), [initial failing browser run](browser-first.log), [original failing receipt check](red-receipts.log), [original unbounded cleanup failure](red-cleanup.log). Logs contain synthetic identifiers/aggregate status only; protected infrastructure files, tokens, usable email codes and real profiles are excluded.

The first cleanup fixture also exposed its own inconsistent use of two `clock_timestamp()` calls around the exact two-minute constraint; it was corrected to a single transaction-stable instant before evaluating the intended bounded-delete failure.

Keep `rise-push-device` version 1, owner-scoped controls and original pending IDs. Receipt deletion is not reversible by application rollback: retain the generation/floor-aware API after cleanup has run. Stop sending during restore and reconcile generations, retained markers and the account-deletion ledger before activation. Hosted supervision, deadline monitoring, backup replay, provider latency and physical HTTPS devices remain open. Full release is not accepted by this increment. The [current contract](../../PUSH-RETENTION.md) records these limits.

Implementation consulted the official [PostgreSQL locking reference](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security); real restricted-role tests and advisors verify the applied grants rather than relying on those references alone.

[Visual capture metadata](visual-matrix.json), [source preservation manifest](preservation.json) and [document validation](documents.log) accompany the logs. Compared with the start-of-goal hash inventory, no existing files are missing; personal-domain modules, design sources, CSS and the service-worker receiver are unchanged. The manifest includes the earlier local-browser/document increment and the retained automatic Impeccable hook cache.
