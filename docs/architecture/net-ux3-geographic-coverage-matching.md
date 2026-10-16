# NET-UX3 — Geographic Coverage Expansion & Region-to-Company Matching

## Baseline audit (16 October 2026)
- 31 Italian Network companies published; 3 with published region, **28 location gaps**.
- **0** records in `network_it_municipalities`; province code and precise ISTAT reconciliation are unavailable and **must not be fabricated**.
- **0** records in `network_it_geo_evidence_candidates`; previous discovery staging is not equivalent to verified geography.
- 162 company discovery candidates exist but only 3 have `facility_candidates`; none match a published company with a location gap.
- Every one of 28 unlocated published companies has an official website domain; source URL still needs human validation.

## Implemented governance pipeline
1. Platform > Company Discovery > Geo Review shows **28 missing-region company profiles** (derived from live published table, not static seeds), official-site links, stage form, progress counters. Role `discovery.read`.
2. Operator `discovery.enrich` captures a city, one of exactly 20 Italian region labels, URL on the company's registered site domain, and explicit supporting text including city; stored in existing `network_it_geo_evidence_candidates` with status `pending_review` and **no public facility**.
3. Independent `crawl_it61_review_geo_evidence` already exists, requiring `discovery.governance_review`, human reason, and moves only to `approved_for_facility_review`.
4. New `netux3_publish_reviewed_geo` requires BOTH `discovery.publish` and `discovery.governance_review`, a second justification, source revalidation, approved evidence identity and status, a strict published company target, and idempotent publication ledger. Inserts a published facility with city and region, always `verification_status=unverified`; adds public-web data assertion with source reference. No guessed coordinates, postal code, province or exact address.
5. Existing NET-UX2 `netux2_region_coverage` and NET-UX1.1 Free directory read the newly published facility **only after step 4**. No RLS changes; no crawler queue publication.
6. Missing region worklist recalculates dynamically after each approved published facility. Reactivation of the real ISTAT municipalities import is a separate prerequisite for verified province/city normalization.

## Security and legal rules
- Official site evidence must match canonical company website_domain (exact host or verified subdomain), be HTTPS, and state the city explicitly.
- All SQL functions require platform permissions; `anon` execution revoked; ledger RLS enabled, no direct authenticated inserts.
- No mutation of Network Pro entitlements or Marketplace; no cross-tenant private CRM or personal contact enrichment.
- Publication is an active human decision, not implied by staging or geo evidence approval; record accepted source with publication note.
- This step builds a safe pipeline and prioritizes the 28 gaps; **does not publish unverified real-world city/region data automatically**.

## Acceptance
- P0 local Supabase migration + `supabase/tests/netux3_geo_governance.sql` negative access checks.
- Frontend Node tests, typecheck and build.
- Positive flow: operator submits known official-site address, reviews, publishes and views regional count after separate review. A controlled authenticated browser acceptance remains necessary.
- No invented company locations in the database; unchanged map counts until a reviewed publication occurs.

## Follow-ons
- NET-UX3A ISTAT 2026 actual municipality import and province lookup: official reviewed dataset required; do not seed arbitrary codes.
- NET-UX3B controlled evidence extraction on approved first-party company sites, with explicit operator gates.
- NET-UX4 role-personalized recommendations; NET-UX6 bilateral company graph.
