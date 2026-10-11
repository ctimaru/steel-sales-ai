# CRAWL-IT6 — Geographic Coverage Expansion

## Verified production baseline (2026-10-11)
- 32 active Network company profiles; only 3 have facility records.
- 29 active companies have no structured facility yet.
- 3 facilities have city, postal code and region. No validated province/municipality mapping in the ISTAT registry; imported municipalities: 0.
- The crawler source registry is not yet populated with approved sources; do not claim autonomous acquisition is live.

## Coverage expansion contract
1. Operator-only coverage snapshot: published company identity, whether at least one published structured city exists, pending geographic evidence, count of published facilities.
2. Add Italian geo evidence candidates **only** when a reviewed source proves the company identity/domain and physical location, preserving the exact source URL and a compact excerpt.
3. Never infer a plant from a head-office address. Classify each location appropriately at later review; avoid duplicate multi-site conflation.
4. `pending_review` geography cannot affect Network filters. Explicit review of identity, address provenance and conflict is required before proposing a facility.
5. ISTAT province codes require a validated official municipality reference. Current reference is empty, so no auto-province backfill.
6. Do not update `network_facilities` or `network_companies` in CRAWL-IT6. No direct data publication.

## Follow-on microblocks
- CRAWL-IT6.1: authenticated admin evidence review UI and controlled facility creation transaction.
- CRAWL-IT6.2: source-approved crawler enrichment of the 29 missing company locations, bounded batch size and dedupe.
- CRAWL-IT6.3: ISTAT reconciliation once original official dataset is acquired and verified.
- CRAWL-IT6.4: coverage KPI, Chrome role/access QA and staged activation.
