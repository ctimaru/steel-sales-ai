# HOME-CINE1C — Full Homepage Visual Continuity & Product Proof

Date: 2026-10-25
Status: Implemented on isolated feature branch; review/CI/Lighthouse and visual acceptance required before merging.
Dependency: HOME-CINE1A.2 (#935) and HOME-CINE1B (#936), both on `main`.

## Product decision

The homepage is no longer just an industrial hero above generic white cards. The first screen introduces the brand; the downstream sections show *what an operator can do*, with precise access boundaries.

### Visual language

- Industrial deep steel and restrained emerald surfaces for honest technical-product proof.
- Compact technical cockpit, lightweight inline SVG illustrations of real cross-section families CHS/SHS/RHS. Geometry illustrations do **not** contain fabricated dimensions, mass, stock availability or prices.
- A short flow rail `Specifications → Calculation → Bill → RFQ` / `Specifiche → Calcolo → Distinta → RFQ`; user-controlled RFQ permissions remain separate from free tools.
- Network panel gradients and selectors use native radio controls unchanged; public company identity ≠ premium Network directory.
- Procurement Intelligence cards are denser and share common emerald top accents with their EN equivalents.
- IT company lookup and governed-registration steps use a consistent trust-surface system; EN receives a concise truthful registration band (verify + application + review).
- EN section hierarchy stays intact; natural bilingual copy, correct destination routing.

### Implementation

- `apps/web/components/public-cinematic-continuity.module.css`: shared CSS Modules; no JS, animations, WebGL, external assets, video, parallax or backdrop filters.
- `apps/web/components/public-steel-geometry-proof.tsx`: bilingual geometry and trust illustrations, static server component.
- Homepages IT and EN: compose proof and unified backgrounds; retain SEO, established tools, link attribution and privacy/consent boundaries.
- Existing PublicNetworkRoleExplorer, PublicIntelligencePillars, PublicRegistrationTrust: visual refinements only, no changed behavior or tenant endpoints.

### Technical contract

1. `/distinta`, `/en/distinta` and weight calculators remain public, with no misleading direct links to gated RFQ/Network.
2. EN/IT each have one H1, correct metadata and no new client bundle or runtime dependencies.
3. Mobile 320/390, tablet 768, desktop 1440 must have zero horizontal overflow; real CTA remains clickable and focus outline visible.
4. WCAG 2.1 AA severe/critical = 0; no contrast regressions in user-facing CTAs.
5. Local mobile Lighthouse comparison against CINE1B 97/96/96, LCP 2518/2686/2678 ms, CLS 0, with measured bytes and variance; no material regression.
6. All vendor data, RFQs and company/private memory remain inaccessible in the visual proof. Product illustrations marked examples.
7. Vercel Preview and founder visual approval before merge. No production direct edits.

### Rollout

CINE1C remains a feature PR until passing Chrome/CI and visual approval. Avoid merging a polished but poorly performing home screen. Subsequent enhancements to photographic assets/motion should be a separate measured change.
