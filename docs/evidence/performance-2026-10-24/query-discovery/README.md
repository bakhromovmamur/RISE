# Query projection discovery — 24 October 2026

QUALITY-03 / NFR-03: no application change was selected. A fixed-test synthetic account with 100 habits and 730 dates compared `jsonb_build_object` with `json_build_object` for the existing ordered, owner-filtered, bounded occurrence query. The connection retained the restricted BFF role, verified current session claims, active-session check and RLS. No policy, index, timeout or database schema changed.

Three alternating-order rounds each read 73,000 rows and compare every returned value. Read-only `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` separately measures execution without result transfer. [All samples](samples.json), [exact probe](probe.mts).

| Construction | Request samples, ms | Database execution samples, ms |
| --- | --- | --- |
| Existing JSONB | 249.2, 178.5, 197.4 | 148.2, 116.1, 126.8 |
| Candidate JSON | 188.3, 184.4, 258.7 | 117.0, 121.2, 118.9 |

Values match exactly. Every plan reports 3,215 shared buffer hits and zero shared reads. The small warm-cache sample does not establish a consistent end-to-end improvement: candidate median request time is slightly lower, but its slowest sample is worse. Keep the existing query until stronger evidence supports changing it. This is not hosted capacity acceptance or a result for all record families.

The subsequent real command/replay/readback smoke check and exact fixture cleanup pass ([report](cleanup-and-smoke.json)). The process exited 0. No saved browser profile, unrelated account or cloud installation was modified. The experiment used the same macOS/Node/PostgreSQL environment and server implementation as [increment 7](../increment-07/README.md). QUALITY-03 remains IN PROGRESS; the next missing measurement is the defined mixed personal/shared workload.
