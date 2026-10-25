# PRAY-01 — prayer timetable, travel and manual-date verification

Implementation date: 21 October 2026. Scope: PRAY-01 / PRD-09, with the existing privacy and storage requirements. Completed with the results and scope recorded below. Existing design tokens/assets, checked records, manual snapshots and recovery sources are preserved.

## Observable behavior

- Startup, resume, explicit refresh and settings changes maintain 30 dates from the selected calculation timezone without pruning history.
- Adhan/method/Asr/high-latitude choices and planned offsets remain. Solar starts stay unchanged by offsets; Fajr ends at sunrise and Isha at the following date's Fajr.
- Date-line locations recalculate the adjacent solar UTC date whose noon falls on the requested local date. No synthetic fallback instants are inserted.
- Manual saves own one date and timezone, remove calculation keys, rebuild unchecked instants, reject invalid/gap dates and retain prior checked entries. Legacy identifiable manual edits retain their complete saved snapshots and use authored clocks rather than stale calculated timestamps.
- Device-timezone observation prompts explicit review and never changes coordinates or selected planning timezone. Review survives reload; keep-location and save-location are explicit commands. Observation metadata is device-local and excluded from portable backups.
- Live prayer status, preparation, recording guards and work-break expiry compare actual instants. Saved manual travel windows and the second repeated DST hour stay consistent with the alert plan.
- First setup in a timezone still on yesterday extends the prayer tracking boundary to that actual date, preserving record identities and enabling a truthful current record.
- A complete manual date with an unresolvable clock cannot create a partial alert plan. Missing or polar calculation dates have manual recovery; no sample substitutions or automatic prayer records/XP appear.

## Reference and runtime provenance

[Published vectors](../../../tests/fixtures/prayer-references.README.md): 403 dates and 2,418 solar-time comparisons from Adhan JS v4.4.6, pinned to commit `b6e04cd9da28fffc66773404a0a2e9c739370baf`. London/Makkah/Raleigh retain exact matching; Tehran retains one minute and Singapore two minutes of the original upstream tolerance. Expected values were not regenerated from RISE.

[Runtime environment](environment.json): Adhan 4.4.6, tz-lookup 6.1.25 (installed boundary rebuild source 2019b), Node 24.16.0, npm 11.13.0, ICU 78.3, Node tz-data 2026b and macOS tz-data 2026c. Browser versions: Chromium 156.0.8078.4, WebKit 27.2, Firefox 157.0. Browser Intl does not expose its tz-data version; the versioned engines and explicit offset probes are recorded instead. Boundary lookup and runtime UTC-offset data are separate sources.

[IANA explains the update model](https://www.iana.org/time-zones); the application does not embed an invented or permanently current set of UTC offsets. Automated Kazakhstan probes cover the 2024 change as well as the launch-region cities. Browser/device software updates remain relevant.

## Preservation and scope limits

All app tests use synthetic data and isolated loopback origins 4180/4181/4182 with external requests blocked. The personal preview/profile on 4173 was not opened or seeded. Coordinates stay local and geolocation remains an explicit user action. No dependency version, database version, repository format, domain schema, backup format or cloud service changes are introduced.

Checked entries, existing manual snapshots and the immutable legacy source remain preserved. Recognizable legacy manual edits are detected from their authored source differing from the original calculated key. Clock-only mismatches with the calculated source are ambiguous with timezone-rule drift: they remain saved and require explicit manual review before active windows or alerts. Unreviewed past/current entries remain unconfirmed and keep streak gaps pending; detail views offer manual recovery while checked records retain their snapshots. An old manual save with exactly the same calculated source/times has no distinguishable authorship marker; the original recovery source remains available. Generic raw keys/unknown extensions are not treated as trusted remote identities.

The only style correction allows the dated manual form's long heading and header to reflow at 320 px/200% text. Existing tokens, type scales, artwork and navigation remain. A first screenshot inspection found clipping; one correction and one confirmation inspection are recorded. Contact sheets are QA montages of unmodified source captures, not visual references.

This verifies local calendar and browser behavior. It does not certify a current mosque timetable, physical iPhone/Android delivery, background Web Push, offline cold start, accounts, sync or deployment. Those remain separate tasks. Existing web notifications retain their best-effort behavior.

## Recovery and compatibility

There is no database or domain-schema migration in this batch. Keep database version 1, repository formats 1/2, domain schema 4 and backup version 1. The new timezone observation/review intents require a client that understands their command fields; older clients must fail closed on unsupported receipts. Do not delete receipts or reset storage to make an older application open the profile. Use the existing raw recovery export or a compatible build, and retain portable backups before a deliberate downgrade.

For new manual saves, their rebuilt UTC windows are authoritative, including a prior checked window retained after a timezone edit and subsequent Undo. Legacy manual edits identifiable by their authored source and retained calculation key use authored clock values to avoid stale timestamps. These compatibility cases are tested separately.

## Verification history

During implementation, focused failures exposed test-harness assumptions: exact labels containing select options, a timezone proxy missing the callable Intl constructor path, a virtual clock advancing milliseconds, a late-day recovery action with a different valid label, and Escape returning through a stack of sheets. The fixtures now model those conditions explicitly; existing behavior assertions were retained. The first-setup westward-date issue and the checked-window/Undo issue received domain regressions and implementation fixes.

The first full browser regression passed before the form reflow fix; another passed before the date-boundary/UTC-history corrections. Those dated intermediate logs are retained under names beginning `browser-before-`. They are historical runs, not substitutes for the final checks below. Initial focused failures are retained with descriptive names.

The Impeccable context loader also reports the older mixed platform metadata in PRODUCT.md. The authorized target is mobile web; a separate metadata update can align that tool field. No unrelated product metadata repair was included. Its mechanical detector reported no deterministic findings. Pixel inspection, bounds assertions and the frozen visual matrix provide the separate rendered evidence.

## Completed verification

| Command / scope | Result | Evidence |
| --- | --- | --- |
| `npm run check` | 126 unit/tooling tests; toolchain, lint, type checks and both builds passed | [check.log](check.log) |
| `npm run test:browser` | 342 full journey regressions, three engines; zero failed/skipped/flaky | [full report](browser-full-report.json), [log](browser-full.log) |
| `npx playwright test tests/prayer-timetable.browser.spec.ts tests/prayer-live.browser.spec.ts` | 75 final prayer/delivery checks, three engines; zero failed/skipped/flaky | [final report](browser-prayer-final-report.json), [log](browser-prayer-final.log) |
| `npm run test:production` | 39 final production-entry checks; zero failed/skipped/flaky | [report](production-report.json), [log](production.log) |
| `npm run test:visual` | 48 variants × 15 screens = 720 exact comparisons; zero changed pixels, references not regenerated | [report](visual-report.json), [log](visual.log) |

The full journey run precedes one final guard in `prayerModel.ts` / `Prayers.tsx`, plus its unit assertion: an unreviewed legacy date stays unconfirmed/pending rather than becoming an upcoming gap, and its unrecorded detail offers manual recovery. The final 126 unit/tooling tests, 75 prayer/delivery browser checks, 39 production checks and 720 visual comparisons ran against the completed build. No other application/test/configuration inputs changed between the full run and that guard. [Machine-readable results](verification.json), [full-run inputs](browser-full-inputs.json), [full-run builds](browser-full-builds.json), [final inputs](verification-inputs.json) and [final builds](builds.json) preserve that distinction.

Coverage includes five published reference sets; all eight offered methods, both Asr conventions and all three high-latitude rules; London/New York/Sydney DST spring/fall and Lord Howe half-hour behavior; Kathmandu/Chatham offsets; Kiritimati/Chatham date crossings; Tashkent/Samarkand/Almaty/Astana and Kazakhstan's 2024 offset change; five host timezones; 30-date startup/resume; invalid coordinates/dates/zones and polar summer/winter; gap/repeated-clock manual input; explicit travel review/reload; denied geolocation; independent manual dates; checked-window preservation/Undo; and first setup west of the device date.

Production tests use the actual production entry with review tooling excluded. The offline calculation check uses an already loaded app; it does not claim an offline cold start. Real IndexedDB migration, backups, quota/retry, concurrency and raw-source preservation remain covered by the broader retained regression suite.

### Visual and source preservation

The two contact-sheet pairs show the first inspection and the bounded reflow confirmation: [travel before](travel-review-before-reflow-contact-sheet.png), [manual before](manual-timetable-before-reflow-contact-sheet.png), [travel confirmation](travel-review-contact-sheet.png), [manual confirmation](manual-timetable-contact-sheet.png). Unmodified source captures are retained under `screens-before-reflow/` and `screens/`. The six variants cover 320/375/393/430/1440 px, both appearances, English/Russian/Uzbek and 100%/200% text; bounds/keyboard assertions run in all three engines. The confirmation fixes the 320 px large-Russian header/heading clipping without changing the frozen design matrix.

All 720 reference images, public artwork and design authorities retain their starting hashes. `src/prayers.css` is the only changed stylesheet, with three rules scoped to manual-form heading/header reflow. [Before hashes](before.json), [change inventory](changes.json) and [existing-file diff](changes.patch) support the source comparison. No files from the starting manifest were deleted, and dependency manifests/versions are unchanged.
