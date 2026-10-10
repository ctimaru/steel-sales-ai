# PLR3 — Platform Operational Cockpit

Status: implemented in PR, acceptance pending. Date: 2026-10-10.

## Behavior

- The Platform homepage presents authorized operational status, action queues, then the PLR1/PLR2 grouped management areas. Tenant Workspace is entirely separate.
- Read only granted domains. Each of the five RPCs is called with p_limit:1 and returns database-side aggregate counts independent of the display row limit.
- No new schema, migrations, public endpoints, client poller, tenant commercial joins, or actions.
- Errors or absent/malformed count fields return unavailable; an unavailable result never becomes 0. A zero means the server returned a validated zero count.
- Partial failures preserve other healthy signals and explicitly identify the domains unavailable. No all-clear if data is missing.
- Metrics displayed are server-side aggregates with a server read timestamp in Rome time, NOT a claim that the source data was updated at that moment.
- Permission checks happen before each domain RPC. The RPC itself also checks its exact permission. A role without domain access cannot see its metrics or links.
- Staff with read-only capabilities get Consulta instead of Gestisci for the priority link. All mutations still live in existing guarded detail actions.
- All routes in the original IA remain stable.

## Data contract verified against production SQL on 2026-10-10

| Signal | Database-side field | Scope |
| --- | --- | --- |
| Registration review | hp6_registration_operations_queue.summary.pending_review | All pending applications |
| Registration activation | hp6_registration_operations_queue.summary.ready_activation | All approved applications requiring activation |
| Registration identity conflicts | hp6_registration_operations_queue.summary.identity_conflicts | All pending or approved applications with ownership conflict |
| Claim proof | p3_6_admin_claim_queue.proof_pending | Pending proof across all claim statuses |
| Discovery | p3_admin_discovery_queue(p_status=pending_review).total | All pending candidates |
| Network identity | sa8_network_trust_queue.counts.open_identity_candidates | All active open candidates |
| Knowledge editorial | sa7_knowledge_queue.in_review | All pages in review |

The corresponding private function definitions were checked. Summary or count computation is not limited by p_limit. Registration needs_information is not treated as an actionable owner task while the applicant response is pending.

## Acceptance criteria

1. Required frontend tests, TypeScript/build, inherited PLR1/PLR2 RBAC tests.
2. Chrome multi-account and mobile responsive 320/390/768/1440, no private tenant data exposure.
3. Missing/error response is rendered as Dato da verificare; healthy zero is rendered as zero.
4. Only allowed capabilities fetch domain data and produce navigation; read-only staff do not see owner strategy shortcuts.
5. One Vercel production build after PR checks; post-deploy read-only HTTP and Chrome production smoke.

Next: PLR4 — Governance Workspaces.
