# DATA1-EU TRADER1A — European Trader Research Foundation
**20 October 2026 · Implementation-ready, no automatic public exposure**

## Data model
- Private `netdata1eu_trader_research` separates `target_country_code` (research territory) from `legal_country_code` (only after a dedicated official source and legal entity name).
- Domain, official site, exact first-party role/product evidence and optional EUROMETAL discovery provenance are separate columns. No unlicensed bulk copying; legal rights status default `not_assessed`.
- Private `netdata1eu_trader_facility_evidence` records a sourced location independent of the legal entity. No automated NUTS mapping or public facility creation.
- Read-only service audit flags exact domain collisions across canonical, discovered, target leads, and pilot research; a shared domain is a **manual identity hold** rather than automatic deletion/merge.
- RLS deny-all for browser roles and no public RPC. `service_role` alone can stage/review. No claim, accepted capability, warehouse mapping, RFQ or connection is created.
- Review readiness requires an explicit source-rights clearance; entering a first-party URL is **not** such clearance.

## TRADER1B Pilot
- Research first-party evidence only. Begin with BUHLMANN (DE), MCB (NL), ArcelorMittal Distribution Solutions (FR), Wuppermann (DE), Kovintrade (SI) with official role/product pages; product evidence claims only as written. Some are corporate group/brand labels, not verified standalone legal entities.
- Source discovery: https://eurometal.net/members/multi-product-proximity-steel-stockholding-distribution/ and https://eurometal.net/members/international-steel-trade-associations-companies/ — no assumed right to redistribute member directory.
- Target later: 20 unique research candidates, 60 in next expansion, with explicit 27-country source/provenance and identity reconciliation.
- Link each new first-party facility source to separate `facility_evidence`; never claim a HQ address is a warehouse.
- Everything stays `research_only` with source rights `not_assessed` until legal/use-rights review.

## Release acceptance
- P0 required frontend/worker/SQL gate and security check green.
- Supabase additive migration applied and readback counts/ACL checked; anonymous & authenticated read to private tables denied.
- Compare baseline published companies/discovered/facilities before/after; no changes.
- QA of 20-record research pilot is **not** complete until separate manual work and evidence verification.
