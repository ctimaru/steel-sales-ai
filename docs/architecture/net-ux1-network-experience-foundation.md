# NET-UX1 — Network Experience & Free Social Graph Foundation

**Decision and implementation date:** 2026-10-16  
**Scope:** audit, target experience, product permission contract, role discovery, social graph boundaries, acceptance prerequisites.  
**Release status:** foundation in PR; **not** a free-directory rollout; no production migration or entitlement grant in this block.

## Product decision

Network core becomes Free for registered, approved, active organizations, **after** a separate backend-authorization migration and acceptance. Network Pro monetizes advanced technical/commercial filters, intelligence and professional workflows. RFQ Marketplace entitlements remain separate. Public anonymous visitors only receive a curated privacy-reviewed preview, not the authenticated directory.

**Never make Commercial Memory, private contacts, procurement, RFQ payloads, prices or governance evidence public.** Only published Shared Network information can be returned from approved public-safe read models. Existing claim and verification remain separate.

## Actual state (read-only production audit, 2026-10-16)

- `network_companies`: 33 total, **31 published**, all 31 with country IT.
- Published roles (companies may have multiple roles): processors 15, producers 10, traders/distributors 10, end users 0.
- Published facilities: **3**, all have region, 2 in Lombardia and 1 in Emilia-Romagna.
- Discovery candidates: **162** staging-only (never display as published).
- Active organization-company links: **3**.
- Current `/network` is workspace-authenticated and additionally requires `pa1_3_network_access_state.can_access_network`.
- Supabase has PA1.3 **restrictive** SELECT policies for `network_companies`, `network_facilities`, `network_company_role_assignments`; these require `private.pa1_3_current_network_access_allowed()`.
- `p3_7c_public_company_profile` requires `private.pa1_3_require_current_network_access()`; existing follow/save and richer actions are separately guarded.
- `m6_search_network` and `m6_search_network_geo` are invoker functions without their own entitlement checks; **RLS still applies**. Skipping the Next.js gate alone does NOT make Free read work.
- Existing UI and regression tests encode premium-only access. Do not bypass frontend, sidebar, RPC or RLS independently.

These counts are a dated baseline, **not** claims about current users or actual market coverage. The map must not pretend that 31 published companies have verified regional coordinates.

## Proposed information architecture

1. Public landing: value proposition, four roles, **curated** regional preview (after legal gate), registration and claim.
2. Free authenticated discovery: Italy map (NET-UX2), selectable region, searchable published basic profiles, province/city when trustworthy. No fabricated pins or geographies. Fallback list for missing geo.
3. Pro tools: advanced technical segmentation, intelligence, lists and professional signals.
4. Company pages: identity, roles (primary and secondary), product families, facilities, capabilities, source/trust semantics, claim. Role recommendation only changes ordering, never excludes competitors or other supply-chain roles.
5. Social graph: organization-to-organization connections, request/accept/decline/withdraw/remove/block, permissioned notifications, audit; not `network_company_follows`, `network_saved_companies` or `network_inquiries`.

## Progressive rollout contract

**NET-UX1 (this PR):** `lib/network-experience.ts` pure role priority, guarded Free/Pro policy, connection-request eligibility, regression tests. No production behavior change.

**Free-read migration prerequisite (before any Free UI activation):**
- Explicit feature scope: published basic identity, type, location and declared product summaries only; validate every field for privacy.
- Add **new** Free read RPCs or appropriately separate basic-profile RLS from premium read paths. Keep premium RPCs, profile extras and governance restricted; do not broaden `anon` grants.
- Bind every authenticated request to verified session, active organization and current membership at the database; authenticated alone is insufficient.
- Distinguish account registration from approved organization activation and approved claim. Respect suspended/archived publication.
- Preserve `network_access` entitlement for PA1.3-gated Pro features, and keep `marketplace_access` independent.
- Dual-role positive + negative integration tests for viewer from different organizations, pending/suspended accounts and URL/RPC forgery.
- Check existing PA1.3 regression tests and rewrite only where product policy deliberately changes; no blanket removal.
- Gate actual Free activation behind an explicit feature switch **and** confirmed server-side migration/acceptance.

**NET-UX2 map prerequisite:** use 20 official regional polygons with accessible keyboard selection. The region label does not equal a point coordinate. Link published sites from verified or governed normalized geo, keep unlocated companies in unlocated list, distinguish empty/data-missing states. Extend crawler governed enrichment and accepted identity/geo review. No synthetic company counts.

**NET-UX6 social graph prerequisite:**
- `source_organization_id`, `target_organization_id` are distinct; both active with approved authoritative `organization_network_company_links`. Unclaimed seed candidates receive no request.
- Require authorized organization-admin/authorized staff action, no employee-to-employee graph. Verify target eligibility and publication state for each request.
- States: pending, accepted, declined, withdrawn, removed and blocked; unique normalized pair for active/accepted connections, no duplicated pending inversion. Audit every transition; use idempotent RPCs with rate limits and moderation.
- Notifications go to recipient organization workspace only using NC domain/outbox; never platform bell, never disclose private data or notify a non-activated company.
- Connections reveal only mutual status and otherwise-published profile attributes; no implicit sharing of Commercial Memory, contacts, RFQs, pricing or orders.
- Server RLS and transaction checks are the authority; frontend `connectionRequestEligibility` is only for display logic.
- Connection-request email and private chat are explicitly **out of scope** until after pilot.

## Acceptance checklist

- [x] Read-only production baseline and current access boundary documented.
- [x] Canonical four-role priority and non-exclusive matching modeled.
- [x] Pure social graph eligibility rejects self/duplicate/blocked/unclaimed.
- [x] Contract ensures Free does not open without explicit verified backend.
- [ ] Free read RPC/RLS migration + multi-role authenticated QA (next block).
- [ ] Actual map and region-click results (NET-UX2).
- [ ] Multi-company connection state machine, outbox, RLS, anti-spam (NET-UX6/7).
- [ ] Production rollout explicitly approved after CI/security acceptance.

## Operational guardrails

No prod SQL write in NET-UX1. No browser implementation requiring new map libraries. Keep CI runs on GitHub Actions; avoid unnecessary Vercel preview/production deploys. Do not merge until mandatory CI is green. The current page and paid behavior intentionally remain unchanged until Free-read data-access design is secured.
