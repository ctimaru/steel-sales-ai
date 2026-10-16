# CALC-INT4 — Market-specific DE / FR / ES technical editorial & SEO

## Intent and baseline (2026-10-16)
CALC-INT3E.7 / 3E.7a shipped one shared EU calculator plus the already shared US mode in IT/EN/DE/FR/ES. Its translated UI, localized summary, FAQ, canonical and hreflang were not a substitute for **original, technically useful national-market editorial**. CALC-INT4 adds that layer without altering numerical logic, the existing 5 calculator URLs, search/share query policies or RFQ queues.

## Delivered
- Three individually indexable, national-topic URLs, with native vocabulary and original practical content:
  - DE: `/de/knowledge/tubes/stahlbau-hohlprofile-din-en-10210-10219`. DIN terminology; buying for Stahlbau; dimensional tolerances and the distinction between a 2026 draft and a published edition.
  - FR: `/fr/knowledge/tubes/profils-creux-nf-en-10210-10219`. NF references, consultation/devis workflow, documents de contrôle, differences in rayons d'angle and a 2026 AFNOR consultation.
  - ES: `/es/knowledge/tubes/perfiles-huecos-une-en-10210-10219`. UNE-EN national edition references, medición/compras, pedidos and differences between the EU edition year and national adoption year.
- Each guide includes distinct H1, meta description, 4 meaningful technical sections, worked idealized CHS mass example, 4-line purchasing checklist, explicit caveats, two questions and at least two official sources (DIN, AFNOR, UNE). No paid/reproduced standard tables, no claims that a draft is already current, no invented supplier certifications.
- Compact, **one-link** guide discovery below each locale's complete calculator; preserves CALC-INT3E.7 uncluttered utility-first surface and functional EU/USA switching.
- Server-rendered pages with locale-correct document lang, self canonical, reciprocal **DE/FR/ES-only** topic hreflang (no false IT/EN counterparts), parameterized noindex, organization-attributed `TechArticle`, FAQ and breadcrumbs structured data.
- Explicit sitemap entries with 2026-10-16 lastModified; no existing Italian/English calculator, article, sitemap or SEO URL removed.
- Commercial CTAs lead back to the same localized calculator and public bill. Bill is copy-only; no supplier dispatch, company records or automatic persisted RFQs.

## Source verification
- DIN published EN 10210 / 10219 editions vs 2026 Part 1 drafts:
  https://www.din.de/de/mitwirken/normenausschuesse/fes/europaeische-gremien/72366/wdc-grem%3Adin21%3A148579350%21search-grem-details?masking=true
- DIN EN 10219-2:2019:
  https://www.dinmedia.de/de/norm/din-en-10219-2/306846734
- AFNOR NF EN 10210-2 May 2019:
  https://www.boutique.afnor.org/fr-fr/norme/nf-en-102102/profils-creux-de-construction-finis-a-chaud-en-aciers-partie-2-tolerances-d/fa171253/83605
- AFNOR 2026 PR NF EN 10219-1 consultation:
  https://norminfo.afnor.org/consultation/pr-nf-en-10219-1/profils-creux-de-construction-en-aciers-soudes-formes-a-froid-partie-1-conditions-techniques-de-livraison/355989
- UNE-EN 10219-2:2019 listing, 2025 reconfirmation:
  https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma?TermId=64d4ad9d-ede1-4acd-915c-be64ad2a132d&TermSetId=68b35e67-1409-448a-b93c-10dd69a44760&TermStoreId=30422a6b-6877-4e28-82d6-96d5dac7e3b1&c=norma-une-en-10219-2-2019-n0062916
- UNE catalogue for the exact current status:
  https://www.une.org/encuentra-tu-norma/busca-tu-norma

## Acceptance / gates
1. `apps/web/tests/calc-int4-market-editorial-seo.test.mjs`: verified depth, distinct markets, URLs, references, noindex and 3-locale hreflang, structured data and source-to-calculator links.
2. From `apps/web`: `npm test`, `npm run typecheck`, `npm run build`. Protected PR CI and Vercel preview must pass before merge.
3. Browser 320/360px smoke: all 3 guide pages, readable headings, link back to matching calculator, region switch EU/USA, localized bill copy path and source link target; no shared tool regressions.
4. Production post-release: GET only, check HTTP 200, `<html lang>`, self canonicals, reciprocal hreflang, unique H1, mobile layout, XML sitemap entries. No test RFQs or artificial commercial signups.
5. Google Search Console: collect impressions/clicks for the 3 clean URLs at 7/28 days when data exists. Indexation/ranking NOT promised; monitor canonical selections without mass index requests.

## Next editorial cycle
Evaluate real GSC query clusters per locale before publishing further articles. Candidates: Germany dimensional tolerance / CHS vs SHS; France NF EN dossiers de contrôle; Spain UNE-EN 10210 vs 10219 procurement. Do not mass-generate near-identical thin pages or pseudo-localize US technical standards.
