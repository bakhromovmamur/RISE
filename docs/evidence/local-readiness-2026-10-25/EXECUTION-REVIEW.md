# Independent local execution-runtime review

25 October 2026 · QUALITY-03, OPS-01/OPS-03 and RELEASE-01 preparation. This records source review, not a passing capacity result or hosted release approval. Cloud provisioning remains pending.

**Later disposition:** the candidate was not adopted. Its small HTTP comparison improved observed latency but failed the complete gates, and the initial full100 attempt was disk-guard blocked. A later isolated full100 run completed after disk cleanup and also failed capacity, with exact recovery/history/XP checks passing. The original runtime files are restored; the reviewed candidate and tests are preserved in [the verified proposal archive](../local-completion-2026-10-25/execution/README.md). The source-review observations below describe that archived candidate.

The review covered `server/execution/`, the normal and frozen-release entry points, their existing authentication/database boundaries, and the synthetic execution tests. The protected HTTP measurement adapter was also inspected locally; its configuration, account data and raw output remain private. No tests, builds or repository-wide scans were run by this reviewer during the reserved browser performance window.

## Findings and disposition

The initial worker implementation replaced each worker that had reached ready without a restart budget. Repeated ready/crash cycles could therefore restart indefinitely. The revised pool now allows at most three replacements per slot within sixty seconds; exhaustion leaves readiness unavailable until process restart. A dedicated regression exercises four crash rounds across five workers and requires readiness and requests to remain unavailable after exhaustion. This closes the identified finding; the implementation owner's focused verification subsequently passed, as recorded below.

The integration test initially created its execution runtime before entering its cleanup block. A startup failure could leave the surrounding test app/admin connection open. Its revised source places runtime creation under the cleanup block with an optional runtime handle, so the surrounding harness is cleaned up even when creation fails. This correction was reviewed in source; test execution is owned by the implementation run.

Source review found no additional confirmed authorization or data-integrity defect. The coordinator retains route-specific body limits and unparsed body bytes, preserves the existing normalized request headers and socket IP, and sends requests through the original worker-side Host/Origin/CSRF/session checks. Response cookie arrays and binary bytes are retained. Session digests are scheduling keys only; current authorization still runs inside the original handlers. A lost worker returns unavailable without automatically replaying a possibly committed operation. Its replacement starts after the old worker exits, retaining the five-connection restricted database budget. The bootstrap `.mjs` participates in local runtime fingerprinting and the frozen release source copy.

The reviewed tests exercise commit-before-response loss and pre-dispatch process loss, unchanged revision/receipt state where appropriate, explicit exact retry, replacement readiness, the connection budget, and zero remaining restricted worker connections after graceful close. These are observations about test coverage in source, not claims that this reviewer ran or passed them. Anonymous/Origin rejection in this test does not replace the broader unrelated-owner and RLS suites.

The implementation owner subsequently recorded **7/7 execution tests, 2/2 fixed-test real-worker integration tests, server TypeScript and focused Oxlint passing**. See [the focused execution verification](../local-completion-2026-10-25/execution/verification.json) for exact commands, timing, diagnostic attempts and scope. This reviewer read that record without rerunning the tests. Full-size normal-runtime HTTP and release regression acceptance were still pending at that verification point.

## Memory and measurement limits

The 32 MiB admission budget bounds retained request envelopes. It is **not a total-process memory cap**: ingress parsing happens before this admission, workers fully buffer injected responses, responses cross the worker boundary, and slow-client socket buffers remain outside that accounting. Hosted memory sizing and output/backpressure acceptance require separate evidence; the request budget must not be presented as proving them.

The private measurement adapter starts the normal `server/main.ts` on the fixed test loopback port after closing the harness database pool. Measured operations and final readback use actual HTTP with a separate keep-alive agent per synthetic browser. It suppresses unexpected child diagnostics and caps each collected response. Synthetic addresses identify client agents, while the real server observes loopback socket addresses. Login and seeding precede this switch, so this measures normal-runtime operations/readback, not distributed-IP signup/login capacity.

At this review point the prior full-size capacity baseline still failed and the normal-runtime 100-account HTTP result was pending. Consult the final [task status](../../../TASKS.md) and [performance guide](../../PERFORMANCE.md) for later measurements; this review does not close that gate.

## Final verification after engineering changes

The parent engineering run owns the final coordinated regression and evidence. Once all implementation and evidence edits are complete, run from the project root:

```sh
npm run check
npm run check:docs
npm run check:publication
```

Run the applicable database/BFF/browser and full-size performance checks sequentially under the existing isolation rules; the commands above do not replace them. Record exact results against the final source. Do not run capacity measurement concurrently with builds, browser performance, database suites or publication hashing.

After the owner selects and stages the intended files, rerun `npm run check:publication` and inspect the staged names/diff before committing or pushing. The checker does not initialize the project repository or alter its index. Keep `.rise-infra`, credentials, saved profiles, generated bundles and unreviewed recordings private. Its known-secret scan is not a complete unknown-secret, archive or personal-data audit. See the [handoff inventory](../../LOCAL-READINESS.md) and [publication evidence](README.md) for precise limits and outstanding human, physical-device and hosted gates.
