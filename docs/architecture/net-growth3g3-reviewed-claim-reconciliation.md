# NET-GROWTH3.G.3 — Reviewed Claim Reconciliation & Owner Enrichment

Status: Protected draft PR, not merged. No migrations or new UI applied to production.

## Live baseline and pre-existing permissions
836 directory backing profiles = 278 canonical published + 558 provisional (source-based, not verified). Canonical claims already require active organization admin, independent proof verification and Platform approval; P3.7 already permits owner-only product, technical and presentation enrichment after approved ownership.

## G.3 implementation
1. Authenticated Organization Admin gets the direct provisional-to-review entry; other visitors still follow company registration.
2. Source UUID, domain and first-party URL are saved in a private RLS ledger by an authenticated admin with an explicit representation confirmation; never as a canonical claim.
3. Platform review is required. To proceed, the discovery and an activated registration for the requesting organization must have match_state strong_evidence, a verified email, exact corporate name and website domain and unique non-ambiguous domain. Ambiguous identity is blocked; no visura required for initial discovery.
4. The reviewer explicitly approves an exact match, reuses an exact canonical profile or creates a minimal public canonical identity with claimed_status unclaimed, verification_status unverified and no assumed inventory, product standards, certification, relationship or supplier trust.
5. No claim, organization-company active link or verification is created automatically. Owner follows the existing /network/{canonical-id}/claim proof flow; only then, after another Platform approval, can the owner edit using existing protected P3.7 managed profile tools.
6. All original public web-sourced claims and later owner assertions remain separately traceable. Verified supplier is never implied by registration, reconciliation or self-declared technical values.

## Security/test/release gate
- Private storage, RLS, no direct anon/auth grants; public RPC invoker wrappers; private definer handlers enforce active org admin and platform claims permissions.
- Deny forged discovery IDs, cross-organization requests, active prior owner links, ambiguous names/domains, unconfirmed email, unactivated registrations and replayed review outcomes.
- SQL schema tests + frontend Node checks, isolated DB migration test and live authenticated Free/Pro + Platform review QA at 1440/390/320px.
- Only after CI and review: apply the SQL migration before front end deploy. Protected merges in #1149 -> #1150 -> #1151 -> G.3 order; keep one planned Vercel deploy per day.
- No direct production writes executed by this PR creation. Existing 836 stays unchanged until real reviewed company reconciliation.
