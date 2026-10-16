# NET-UX4 — Role-Aware Company Discovery

## Vision and core result

Smart Steel Sales Network is not a generic directory: it helps buyers, merchants, producers and processors find relevant counterparties. Personalized discovery works for both Free registered organizations and Pro subscribers without weakening authorization, hiding published companies or inventing relevance scores.

## Product behavior
- Responsive, server-rendered role discovery appears in both Free and Pro above the Italy regional map. No new front-end mapping SDK or background jobs.
- Uses the authenticated organization's active linked Network primary role from existing server-guarded NET-UX1.1 Free read RPC (Pro requests limit 1). Missing role => unpersonalized browsing.
- Users can switch an exploratory persona using allowlisted persona query parameter; it is only a UI ordering choice and never changes organizational roles, visibility or entitlements.
- Per-role contextual category links: utilizzatore -> commercianti / terzisti / produttori; commerciante -> utilizzatori / terzisti / produttori; terzista -> commercianti / utilizzatori / produttori; produttore -> commercianti / utilizzatori / terzisti.
- Existing orderNetworkDiscovery helper applies stable ordering in default unfiltered list, retaining all published companies; explicit keyword, category and geographic filters preserve source ordering.
- Italian region map and search forms preserve persona; changing persona clears any prior role filter and retains geography.
- Soft match hint is labelled "categoria suggerita", never a verification or guaranteed supplier compatibility.

## Observed supply graph gap
October 16, 2026 production audit: 31 published Italian Network profiles. Published company role assignments: 15 processors, 10 producers, 10 traders, **0 end users** (multi-role company may count more than once). Critical product-growth constraint: a trader finding end users currently reaches no results, despite working UI. Do not manufacture records or count 162 staging candidates as published.

## Sequence of core development after NET-UX4
1. NET-COV1 — End-user density and relevant traders through verified website discovery, structured dedup and reviewed batch company publication. This is core Network liquidity, separate from minor QA.
2. NET-UX5 — Company profile as growth channel: publicly safe company detail, claim and guided owner profile completion.
3. NET-UX6 — Real bilateral organization connections, request/accept/decline and workspace notification; do not repurpose Follow.
4. NET-UX9 — RFQ recipient selection from published Network, preserving RFQ and marketplace entitlements.

## Trust boundaries and release
All data come from existing published Network read models; no SQL/schema/RLS/Pro policy changes. Persona is not a role grant. Private Commercial Memory, contacts and governance evidence never enter this view. Existing P0 CI is the only implementation gate; manual Chrome multi-role visual validation may be combined with subsequent core releases.
