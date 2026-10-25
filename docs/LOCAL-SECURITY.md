# Integrated local security boundary — SAFE-01

24 October 2026. This contract covers the retained local/test installations, production web bundle and synthetic users. Cloud provisioning remains pending. Local verification does not close hosted, physical-device or operational security acceptance.

## Browser policy and compatible updates

The BFF applies `server/browserPolicy.ts` to public assets, API responses and errors. Its Content Security Policy defaults to no resources, then permits same-origin scripts, connections, fonts, workers and the web manifest. Images allow same-origin files and data URLs. Plugins, embedded frames, base-URL replacement and unapproved form destinations are blocked. Inline scripts and string evaluation have no exception. `frame-ancestors 'none'` and `X-Frame-Options: DENY` also reject embedding by a same-origin document.

The style-only `'unsafe-inline'` exception preserves existing React style attributes for progress widths, chart heights, Pip sizing, layout and motion. The interface does not render user HTML or accept user CSS. This exception is not permission for inline scripts. Original CSS, screen components, artwork and system fonts are retained. Permissions Policy permits same-origin geolocation and disables camera, microphone, display capture, payment and USB. It does not request any permission or enable notifications.

The policy first passed a report-only compatibility probe before enforcement. Ordinary BFF journeys and the real public worker then run under the enforced policy. Reports collected by tests contain directive names only. There is no production CSP reporting endpoint, third-party collector or private report payload.

`scripts/pwa-build.ts` includes the security headers in the public release fingerprint. A policy-only change therefore produces a new worker and shell release, even when JavaScript/CSS and the visual interface are unchanged. The existing explicit all-tab update protocol retains pending edits, drafts and recovery state. Cache Storage retains the downloaded response headers, including CSP, during offline navigation. Existing open documents and older offline shells retain their previous policy until the normal compatible update is applied; server headers alone cannot retroactively protect them. Never clear a user's profile or public cache to force adoption.

Serve a newly completed production build alongside the BFF. The direct Vite preview and isolated review/test static servers do not provide the BFF's security headers and are not a hosted security claim. HSTS remains an HTTPS deployment gate: this local HTTP task does not install it or pretend to validate a host, proxy or certificate.

## Integrated verification scope

| Control | Local evidence surface |
| --- | --- |
| SEC-01 authorization | Forced RLS on every installed application table; narrow non-login definer owners; no PUBLIC execution on privileged functions; personal/group entity denial, removed membership, exact receipts and concurrent authorization checks |
| SEC-02 sessions | Verified provider identity, ambiguous-cookie rejection, exact-Origin/CSRF mutation checks, rate limits, expiry/revocation, recent authentication, account switching and bounded session admission |
| SEC-03 browser and imports | Real-browser CSP injection/evaluation/framing probes, inert authored markup, bounded/prototype-safe JSON, migration/backup workers, public-only offline cache and production/reviewer isolation |
| SEC-04 notifications | Allowlisted canonical endpoints, connection-time public DNS/address pinning, no redirects, real payload encryption with injected outbound delivery, consent/cancellation/source authorization and generic copy |
| SEC-05 lifecycle | Export exclusions, correction/replay, account/cache cleanup, retained suppression, populated private/shared deletion and stale-backup replay |
| SEC-06 infrastructure | Local/test identity/role separation, restricted credentials, protected configuration permissions, known-secret scanning of source and both web builds, dependency audit and local runtime-role rotation regression |

The route matrix uses all ten private read routes and all 27 POST routes present in this version. It supplements entity-specific authorization tests; rejecting an empty hostile request alone does not prove correct permissions for a valid operation. Real database suites supply those owner/member/unrelated/removed-user and transactional checks.

Tests use fixed isolated origins and synthetic users/subscriptions. Outbound push is injected, email stays in the local sink, and no real invitation is sent. Browser credential suites disable screenshots/video/traces. Policy injection probes use ordinary same-origin script loading because Playwright's direct evaluation bypasses CSP; their service workers are blocked only to ensure the synthetic test script reaches the test route. A separate real-worker probe verifies online/offline compatibility and retained response policy.

## Remaining release gates and rollback

SAFE-01 remains REVIEW after local acceptance. Staging HTTPS/headers, Secure cookies, proxy/client-IP behavior, hosted key custody/rotation, secrets/network controls, production provider configuration, physical-device privacy and notification checks remain pending. PUSH-05 is still TODO; its device gate is not satisfied by the local sender or browser adapters. SEC-07 monitoring/contacts/alert routing belong to OPS-01. Operational encrypted-backup restoration and RPO/RTO belong to OPS-02. QUALITY-03 capacity remains independently open.

No new schema, storage version, key, dependency or cloud resource is required. Rollback uses compatible BFF and rebuilt public assets together, through the normal worker update flow, while retaining guest/account databases, outboxes, cancellation intent and deletion ledgers. Removing enforcement weakens browser protection and must be recorded as a security rollback; it cannot be described as equivalent acceptance. Do not change RLS, reset storage or downgrade cached data to resolve a policy violation.

See [dated execution evidence](evidence/security-2026-10-24/README.md), [security requirements](../SECURITY.md), [PWA lifecycle](PWA.md), [session custody](AUTH-SESSIONS.md#key-custody-recovery-and-rollback), and [backend isolation](BACKEND-ENVIRONMENTS.md).

## Primary references reviewed

- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [worker sources](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src), [style exceptions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src), and [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [changelog](https://supabase.com/changelog): the reviewed TLS CBC deprecation concerns future hosted HTTP APIs; the PostgreSQL minor-release notice requires deployment-specific extension/version review, not a speculative change to this task's retained local installation. No provider runtime or dependency was upgraded here.
