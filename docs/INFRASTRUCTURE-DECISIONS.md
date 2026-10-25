# RISE infrastructure decisions

**Task:** FND-03 · **Updated:** 23 October 2026 · **Status:** IN PROGRESS

This record distinguishes decisions supplied by the product owner from implementation defaults and unresolved operating details. It does not represent a deployment or a purchase.

## Confirmed product constraints

| Decision | Value | Source and operating constraint |
| --- | --- | --- |
| Launch markets | Uzbekistan and Kazakhstan | User confirmation in this implementation conversation; include both markets in device, language and operational planning |
| Intended public origin | `https://habit.saraftech.com` | User owns the domain; the subdomain is not configured yet. DNS, TLS and application routing must be verified before use |
| Monthly ceiling | USD 100 | User confirmation; treat this as the combined recurring service ceiling, including any existing hosting allocation, until clarified |
| Existing resources | Domain and Hetzner hosting account already owned | User confirmed Hetzner; plan type/capabilities and server access remain unknown |
| Database organization | Owner-selected Supabase organization | User selected the connected organization for future separate staging/production projects; exact account identification is retained privately and no project has been created |
| Cloud provisioning | Pending at the user's explicit request | User chose “Keep cloud provisioning pending” after the Free-plan quote and reconfirmed “Keep cloud pending; finish local work first” on 23 October 2026; do not provision as a continuation of local work |
| Release platform | Mobile web, with the incumbent design and functionality | User direction and PRD; native store distribution remains deferred |

Do not infer the hosting provider, deployment region or account ownership from a DNS name. No credentials belong in this document or chat.

## Implementation defaults and required capabilities

The technical defaults remain in [ARCHITECTURE.md](../ARCHITECTURE.md#1-architecture-decisions): the current React/Vite interface, a same-origin Node backend, standard managed Postgres/Auth and a separately operated scheduling worker. These defaults do not approve a vendor purchase or a hosting migration.

Before adapting the existing host, verify:

- HTTPS for the intended origin, with `/api/v1/` routed to the backend on the same origin.
- A supported Node runtime and continuously available backend/worker processes, or an equivalent durable job mechanism.
- A database/Auth environment supporting the documented authorization policies, transactions and recovery requirements.
- Separate local, test, staging and production configuration; preview and fixture builds must never share production data or credentials.
- Secret storage, redacted logs, health checks, encrypted backups and a tested restoration path.
- A cost estimate covering hosting, database, authentication email, backups and monitoring within the confirmed ceiling. Unpriced usage is not assumed to be free.

If the current hosting plan only serves static files, keep it as a candidate for static assets and record a concrete backend/worker option before making a commitment. Do not change providers merely to fit a preferred template.

## Decisions still required before provisioning

| Decision | Required input or evidence | Decision owner |
| --- | --- | --- |
| Hetzner plan and access | Identify Cloud/VPS versus Webhosting, Node/process support and normal authenticated server access; the user is unsure which plan | Product owner / hosting account administrator |
| Provider account ownership | Confirm operating ownership/access for Hetzner, DNS and sender configuration; the future Supabase organization is selected above | Product owner |
| Backend/database region | Available supported regions, latency needs and reviewed data-handling obligations for the launch markets | Product owner with Operations/Security |
| Service allocation | Priced monthly operating estimate and limits under USD 100 | Product owner / Operations |
| Authentication email | Verified sender domain/address, provider and deliverability configuration | Domain administrator / Operations |
| Operational responsibility | Named deployment, support, security and incident-response contacts | Product owner |
| Audience and launch policy | Confirm the PRD's adult-audience assumption and the policies for the actual launch | Product owner / Security |
| Recovery and key custody | Backup access, restoration owner, key storage and retention configuration | Operations / Security |

The roles above are responsibilities to assign, not invented people or approved provider accounts. Local foundation, contract and personal-data work may continue according to TASKS dependencies. INFRA-01 cannot be closed until these decisions and its implementation evidence exist.

## INFRA-01 implementation boundary

Two isolated local standard Postgres/Auth stacks and the Fastify BFF are implemented and tested. They contain synthetic infrastructure identities only, and no personal profile is uploaded. See [setup, permissions and rollout](BACKEND-ENVIRONMENTS.md) and [dated verification](evidence/infrastructure-2026-10-21/README.md).

The connected provider quoted **USD 0 per project per month** on the organization's current Free plan on 21 October 2026. Separate `rise-staging` and `rise-production` projects in Frankfurt were proposed; the user kept provisioning pending. Frankfurt is not an accepted residency/region decision. No paid-plan upgrade, purchase, cloud deployment, DNS change or hosting migration is authorized by that quote. Recheck pricing/capacity when provisioning resumes and price hosting, email, backups and monitoring together under the existing USD 100 ceiling.

## OPS-04 local policy checkpoint — 25 October 2026

[The launch policy and rights review](LAUNCH-POLICIES.md) retains Uzbekistan/Kazakhstan as confirmed markets and records current official-law review flags without approving a region or processing arrangement. Local help/notices now exist. The operator, audience confirmation, dedicated contact, provider agreements and rights approval remain unresolved public-launch gates. Cloud provisioning remains pending.
