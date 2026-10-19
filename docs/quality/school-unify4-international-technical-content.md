# SCHOOL-UNIFY4 — International Technical Content · Phase A
2026-10-19 · IT/EN/DE/FR/ES editorial development

## Audit & scope
- Existing IT Knowledge: large governed K2 standards/grades and three original industrial articles.
- Existing EN Knowledge: six curated standard summaries and ten grade summaries, already gated by published K2 public RPCs. Do not duplicate.
- Existing DE/FR/ES: original country guides on tube geometry, tolerances/inspection and localized calculator, but no public standards/grades catalogue.
- Deliver **DE/FR/ES mini-libraries**: EN 10210, EN 10219, EN 10216-2; S355J2H, P265GH. Each includes overview, practical RFQ parameters, explicit non-equivalence warning and verified public publisher link. 3 × (3 standards + 2 grades) = 15 authored technical pages plus six localized catalogue indexes. Do not imply a full translated library.

## Editorial evidence and provenance (readable scope references only)
- BSI EN 10210 multi-part series (hot-finished profiles): https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210
- BSI public description EN 10219 cold-formed welded structural hollow sections: https://accord-checkout.bsigroup.com/products/cold-formed-welded-structural-hollow-sections-of-non-alloy-and-fine-grain-steels-technical-delivery-requirements_hard-copy
- UNI EN 10216-2:2024 published scope (seamless elevated-temperature pressure tubes; verify national adoption/edition): https://store.uni.com/en-10216-2-2024
- Material grade S355J2H: present only as source-context editorial and **only when its K2 record is published**; product standard and grade both needed for conformity. Avoid numerical strength/toughness tables and non-EU equivalence claims.
- Material P265GH: a non-alloy pressure grade in the EN 10216-2 family; grade alone is not a design pressure or certification. No ASTM substitutions and no implied interchangeability with P235GH.
- Source record provenance: catalogue source_references (URL allowlist HTTPS only), last_reviewed_at and published_at from K2 RPC. The **editorial copy is not text of the standards**; the issuing publisher controls normative requirements. The BSI standards-development project pages describing 2025–2027 drafts are not treated as published editions.

## Architecture and exposure contract
- One DE/FR/ES dynamic route /[locale]/knowledge/[kind] and /[locale]/knowledge/[kind]/[slug]; only allowlisted locales and standards|grades, unknown route 404.
- Detail returns 404 unless an already-published K2 source record exists. SEO metadata returns noindex for unpublished. Index listings filter by K2 published IDs and query variants use noindex, follow.
- Canonical self; reciprocal five-language hreflang for the matching localized catalogue and selected technical detail items; sitemap contains only published detail URLs. Existing IT/EN source catalogue and editorial records remain unchanged.
- Navigation SCHOOL-UNIFY3 and international hub now link to these real local pages. Technical detail CTA links to localized calculator and bill, not straight to private RFQ dispatch or approval. Company documents remain behind /school Auth.
- No schema/RLS/private data changes; no invented SEO rankings, mandatory norm tables, price/certification values or copyrighted texts.

## Release/next phase
- Founder deferred manual multi-role tests. Use only mandatory existing CI and Vercel Preview gates, merge green, verify production and Notion.
- B phase: progressively expand only source-verified (K2-published) grades/standards in DE/FR/ES, add technical glossary / controlled editorial review, then compare Search Console query/page data after enough traffic. International English is already substantially larger.
