# NET-UX COMPACT4 — Locality source coverage

## Production baseline (2026-10-19)
- Network inventory: 32 published company records and 469 additional discovered companies (501 total).
- Published facilities: 3 company records with city and region.
- Official-company geographic evidence candidates: 8, of which **7** have pending-review status and match the company's registered website domain **and** have no published facility. **1 conflicting candidate must not be surfaced.**
- Existing provisional, source-observed discovered-company geography: **21** with city, region and HTTPS source.
- Potential geographic display after the new overlay: **up to 31 distinct company entries** (3 published + 7 sourced canonical + 21 sourced discoveries) rather than 3 published + 21 provisional. These are coverage inputs, not an authenticated production screen test.

## Rules
1. Never convert a source-observed locality into a verified registered office. Canonical published facilities win over candidate geography.
2. Every candidate must have HTTPS evidence; canonical candidates must match the canonical company's known website domain and be in `pending_review`, never `conflict`.
3. Free users must belong to an active company; Pro users must pass PA1.3 Network access validation. The RPC is bounded to 24 company IDs. Anonymous execution is revoked; HP13 security contract is reviewed.
4. Source links are HTTPS-validated again before rendering. The UI labels unverified locations as `Località indicativa`; unknowns remain `Località da integrare`.
5. The published region filter considers candidate localities only when their source domain matches the company, status is pending-review, a city is recorded, and no published facility is present. It does not promote any data.
6. Page-level completeness KPI counts only actual city/region displayed among the current six visible companies, not an extrapolated count for the whole Network.
7. No online geocoding, arbitrary website inference, contact/address harvesting, or scheduled crawling is introduced by this block.

## Acceptance
CI frontend + Supabase foundation + HP13 green; apply both migrations in order; verify grants and counts through SQL; verify an authenticated user in Chrome on desktop (1366×768) and mobile (390px): a canonical company with sourced candidate (e.g., Alessio Tubi, La Loggia) shows `Località indicativa · Fonte`, a published-facility company shows city/region without candidate label, and a discovery with source-observed geography retains its indicativeness and provenance. Confirm Piemonte regional filter includes the documented canonical candidate while conflicting candidates remain hidden.

## Next small batch
After this UI release, NET-UX COMPACT4B can expand geographic density by selecting 25 official company contact pages, extracting locality with explicit source URL and evidence excerpt, storing only candidate rows, and calculating new coverage. Do not automatically write `network_facilities` or increase "verified office" counts.
