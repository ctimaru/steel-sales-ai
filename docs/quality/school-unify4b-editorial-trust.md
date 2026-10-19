# SCHOOL-UNIFY4B — Technical Content Expansion & Editorial Trust
Release candidate · 2026-10-19

## Editorial coverage (public knowledge, not customer private data)
Existing SCHOOL-UNIFY4 Phase A: three standards and two grades per German, French and Spanish locale (15 individual articles). Expansion adds **three standards and eight grades** per locale: **33 additional original summaries**. The final authored coverage is **6 standards + 10 grades per locale × 3 locales = 48 DE/FR/ES technical articles**, and six searchable catalogue indexes.

New standards:
- EN 10217-1 — welded non-alloy circular pressure tubes with room-temperature properties (incl. distinct TR1/TR2 qualities).
- EN 10217-2 — electrically welded non-alloy/alloy pressure tubes with elevated-temperature properties; *not* the same manufacture as seamless EN 10216-2.
- EN 10224 — non-alloy steel tubes and fittings for conveyance of water and other aqueous liquids; separate service, project and protection requirements.

New grades: S355NH, S355NLH (structural hollow-section context), P235GH, 16Mo3 (elevated-temperature pressure context), P235TR1, P235TR2, P265TR1, P265TR2 (welded pressure tube quality context). Existing S355J2H, P265GH maintained. Material name ≠ complete product standard, design pressure, test certificate or equivalent substitute.

## Publication & trust governance
- Every URL under `/[locale]/knowledge/standards|grades/[slug]` resolves only when the corresponding K2 **publicly published** standard/grade exists; otherwise a 404. Indexes, home cards, related references and sitemap filter against the same public published data; no undocumented public/private bridging.
- Original editorials in all three languages; no unlicensed numeric design tables, certification guarantees, ASTM/EN grade equivalences, source PDF reproduction or customer records.
- **Trust panel explicitly distinguishes three items**: a public standard publisher overview URL (editorial scope reference), the public K2 source record and its `last_reviewed_at`, and the editorial text preparation date. The former two are NOT an automatic human review of translation, a current-edition warranty, or conformance/certification.
- The expandable five-term glossary per locale covers CHS/SHS/RHS, seamless vs welded, TR1/TR2, N/L/H suffixes and inspection documentation/EN 10204. Procurement reminder: verify edition, scope, grade, manufacturer, dimensions and certificate.
- Related references use fixed, editorially selected *discovery* mappings, not machine-inferred compatibility and **each target is K2-published-gated**. EN 10224 correctly has no material-grade link inferred by default.
- Sitemap and per-page technical article dateModified reflect editorial preparation when newer than the K2 source review, while the actual K2 review date is preserved separately. Self canonical, 5-locale hreflang pairs only for the 6+10 matching authored keys; noindex for parameterized search pages; existing SEO/private robots retained.

## Evidence sources consulted 2026-10-19 (scope summaries, not reproduced standards)
- [BSI EN 10217-1:2019 publisher overview](https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties), specifically welded pressure tube scope and TR1/TR2 qualities.
- [BSI EN 10217-2 current catalogue](https://knowledge.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-non-alloy-and-alloy-steel-tubes-with-specified-elevated-temperature-properties-1), specifically electric welded elevated-temperature tubes.
- [BSI EN 10224 current catalogue](https://knowledge.bsigroup.com/products/non-alloy-steel-tubes-and-fittings-for-the-conveyance-of-water-and-other-aqueous-liquids-technical-delivery-conditions), water and aqueous liquid conveyance.
- Earlier [BSI EN 10210 series](https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210), [BSI EN 10219](https://accord-checkout.bsigroup.com/products/cold-formed-welded-structural-hollow-sections-of-non-alloy-and-fine-grain-steels-technical-delivery-requirements_hard-copy), [UNI EN 10216-2:2024](https://store.uni.com/en-10216-2-2024) retained.
- Do not use withdrawn 2002 editions of EN 10217 parts as current editions. Dates/editions may differ by national adoption; buyers must check with their national publisher.

## Required quality/release path
- Required GitHub P0 tests/TypeScript/build, UI-SYSTEM2 contrast, PERF2.1 mobile + preview READY and production READY are merge/release gates.
- An automated deterministic source-contract check verifies 6/10 coverage parity, K2 publication and sitemap contract, source domain allowlist, original text labels and non-inferred related links. This is repository CI only, **not a new manual testing campaign**.
- User has paused manual/authenticated personas; do not run RQG32 credentials/workflows or claim cross-tenant acceptance.
- Separately track old DEMOTEST2.4 English calculator disabled default CTA test; do not change RFQ UX to accommodate a pre-calculation assertion without dedicated review.
- Future: content usage measurement after enough GSC query+page data, editorial approval of national editions and structured concept glossary for AI school assistance, without inventing certification.
