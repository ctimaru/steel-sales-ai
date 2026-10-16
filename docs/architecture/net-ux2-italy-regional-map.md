# NET-UX2 — Interactive Italy Regional Map & Company Discovery

**16 October 2026.** Source of truth: [Notion NET-UX1.1](https://app.notion.com/p/3fbf059cecb58154bf95d3a277f63a9f), Network Product Model, NETG3 Geo Discovery; GitHub repo `ctimaru/steel-sales-ai`.

## Implementation
- Static SVG map with 20 regions generated from ISTAT-derived geographic boundaries `guglielmo/geojson-italy` (1 January 2026 geometry). License CC BY 4.0, visible attribution.
- No map SDK, geocoding SaaS, client-only hydration or package dependency. Region links are real URLs with native SVG anchors and keyboard focus, plus a region list for assistive tech.
- Each region click sets `?region=<name>` and navigates to `#network-region-results`. Clicking the selected region deselects it. Search query and role/technical filters are preserved; province/city are cleared because they cannot belong to the newly selected region.
- Shares identical map between Free and Pro directory, preserving existing premium entitlements and advanced filters. Region filtering uses the already implemented `netux11_free_directory` (Free) or `m6_search_network_geo` (Pro).
- New DB aggregate `netux2_region_coverage` exposes only aggregate counts from published companies and facilities and requires authorized `organization_network_company_links`, as in NET-UX1.1. `anon` denied; no private contacts or crawler staging leaked.
- `mapped_companies` and `unlocated_companies` are distinct and complementary; per-region counts are distinct in the region but may sum above mapped_companies for multi-region facilities (correct by design). Counts are national coverage, not additionally filtered by product/role.
- If coverage RPC fails, no zero claims are shown: map still supports navigation with counts marked —. Companies without published facilities remain on national directory lists.

## Baseline data (read-only Supabase check, 2026-10-16)
- 31 published Italian company profiles.
- 3 with published facilities and regional labels (Lombardia: 2; Emilia-Romagna: 1), therefore 28 unlocated region-wise.
- 162 crawler discovery candidates at earlier audit: no unreviewed candidates are published. No artificial coordinates or approximate pins.

## Accessibility & performance
- 20 exact SVG paths simplified to roughly 40 KB TS static source; responsive viewBox 800×875.
- Native anchors and text-list fallback permit keyboard activation without JS. Selected state is reflected by `aria-current`, focus ring, and label.
- Design contrast tested at build level; browser authenticated multi-role QA remains an acceptance check.
- Direct query links enable shareable region filters and are compatible with existing Network routes.
- Source attribution visible beneath map (ISTAT via guglielmo/geojson-italy, CC BY 4.0).

## Acceptance
- [x] 20 documented regions, no fabricated geo/counts.
- [x] Map in both Free and Pro, preserve role/name and technical searches.
- [x] Database regional aggregate only uses published and active-company authorization.
- [x] Fallback for missing counts / missing regional records.
- [ ] Automated P0 Required Gate: migration compile, frontend tests/typecheck/build and regression.
- [ ] Production migration applied and checked (auth/anon and totals).
- [ ] Multi-role Chrome/mobile production acceptance (after deploy; do not claim until done).

## Follow-on
NET-UX3: sourced and governed enrichment of existing published company regions/provinces/cities; controlled reuse of ISTAT geo review. Do not auto-publish the pending crawler queue. NET-UX4: personalize discovery ranking without hiding categories.
