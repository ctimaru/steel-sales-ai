# CALC-INT4.1 — International Topic Clusters & Search Intent

Date: 2026-10-16
Status: branch implementation; merge only after protected green CI + production read-only check.

## Current data limitation
GSC Wizard `list_sites` refused reads with `payment_required: trial ended / no active subscription`. **Do not infer property absence, ranking, search volume, CTR or impressions from that error.** The user has separately reported Search Console access and a processed sitemap. No GSC searchAnalytics API export was available to this task. All keyword candidates below are **editorial hypotheses**, not observed query demand.

If GSC API is unavailable, use manual Search Console Performance → Search Results → date 28 days → Country (Germany/France/Spain) → Page URL contains `/de/knowledge/tubes`, `/fr/knowledge/tubes`, `/es/knowledge/tubes`; export Queries + Pages by each country. Note that country is the searcher's country, not the `/de/` language. Also inspect country/locale cross matches; do not treat locale as geolocation or assume visitors are in that country. Repeat at 7/28 complete days. Record 0 vs no-data separately, no invented baseline or target. Do not buy a plan automatically.

## Intent matrix

| Locale | Pillar route | Topic query (hypothesis) | User job | Satellite route |
| --- | --- | --- | --- | --- |
| DE | `/de/knowledge/tubes/stahlbau-hohlprofile-din-en-10210-10219` | `DIN EN 10219-2 Toleranzen Hohlprofile` | Select correct geometry/tolerance reference for a procurement request | `/de/knowledge/tubes/din-en-10219-2-toleranzen-masse-hohlprofile` |
| FR | `/fr/knowledge/tubes/profils-creux-nf-en-10210-10219` | `certificat matière 3.1 EN 10204 profil creux` | Specify product norm separately from inspection document for a quote | `/fr/knowledge/tubes/certificat-matiere-en-10204-31-profils-creux` |
| ES | `/es/knowledge/tubes/perfiles-huecos-une-en-10210-10219` | `UNE EN 10210 10219 diferencias perfiles huecos` | Interpret national published years, estimate kg/m and request suitable material | `/es/knowledge/tubes/une-en-10210-10219-ediciones-peso-pedido` |

Each article is authored in the market's professional language with a distinct user task, four substantive sections, purchasing checklist, actionable example, FAQs, commercial caveats and official norms-body references. Content contains **no normative tolerance numerical tables**, avoids claims that mass is certified, and distinguishes reference/source documents from manufacturer evidence.

## Internal linking and technical SEO
- Existing **five** calculator URLs and EU/US switch, weight engine, indexed IT/EN catalog routes and existing main market guides preserved.
- Existing 3 market pillar routes remain the hub. Each links to its **own** single locale-specific satellite. Satellites link back to their market pillar, calculator and copy-only RFQ bill. Calculator keeps the compact link to national pillar (no noisy mega-list).
- Satellite routes reuse existing `/[locale]/knowledge/tubes/[topic]` static page with strict slug allowlist. Invalid locales and slugs 404, parameterized variants are noindex, self canonical remains clean.
- Satellite topics are **not language-equivalent** pages (German tolerances vs French documents vs Spanish adopted standards). Therefore **no hreflang cluster between satellite URLs**. Old pillar 3-way reciprocals remain intact.
- New pages added to sitemap with `changeFrequency: monthly`; no extra reruns, tracking, crawlers or dependencies.
- TechArticle, FAQPage and BreadcrumbList reuse existing article infrastructure; don't promise FAQ rich results or instant indexing.

## Factual sources reviewed
- DE DIN Media DIN EN 10219-2:2019-07 (current): https://www.dinmedia.de/en/standard/din-en-10219-2/306846734
- DE DIN Media DIN EN 10210-2:2019-07 (current): https://www.dinmedia.de/en/standard/din-en-10210-2/306846700
- FR AFNOR NF EN 10204:2005 current: https://www.boutique.afnor.org/fr-fr/norme/nf-en-10204/produits-metalliques-types-de-documents-de-controle/fa111300/24547
- FR AFNOR NF EN 10219-2:2019 current: https://www.boutique.afnor.org/fr-fr/norme/nf-en-102192/profils-creux-de-construction-soudes-formes-a-froid-en-aciers-partie-2-tole/fa177343/83616
- ES AENOR UNE-EN 10219-2:2019: https://tienda.aenor.com/p/norma-une-en-10219-2-2019-n0062916
- ES AENOR UNE-EN 10210-2:2020, identical to EN 10210-2:2019: https://tienda.aenor.com/p/norma-une-en-10210-2-2020-n0063229
- Google people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google hreflang: https://developers.google.com/search/docs/specialty/international/localized-versions

## Gate
- [ ] `npm test` includes CALC-INT4 and CALC-INT4.1 contract tests.
- [ ] `npm run typecheck` and `npm run build`.
- [ ] PR Vercel preview READY and project protected required green.
- [ ] Chrome responsive / keyboard existing QA and anonymous HTTP smoke; new routes should be reviewed in a read-only production pass after merge.
- [ ] One protected CI-green squash merge, one normal Vercel main deployment. No manual extra redeploy.
- [ ] All new production URLs 200, proper <html lang>, per-page canonical, 3 new sitemap entries and internal links; no new RFQ writes or signup tests.

## Measurement & next decision
- Date-scoped GSC comparison starting **after pages first become crawlable**. Log weekly 7/28 complete days: each page's indexability, impressions, clicks, CTR, position, query group, and any page cannibalization against its pillar (same query landing on competing pages).
- Segment `country = DE/FR/ES` independently of page `/de/ /fr/ /es/`. Compare demand via real query+page pairs when GSC access works again. Vercel consented funnel events can evidence click intent, not Google query rank or full conversions.
- Gate next expansion on real non-branded impressions, meaningful qualified traffic, original publishable technical evidence and lack of pillar cannibalization; **never create massive pages automatically**. If signals are absent, improve existing content and internal links, don't claim traffic lift.
