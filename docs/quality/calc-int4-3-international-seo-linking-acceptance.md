# CALC-INT4.3 — International SEO & Internal Linking Acceptance

Date: 2026-10-16. Read-only baseline and narrowly scoped changes.
Owner: Smart Steel Sales — Weight Calculator Experience.
Prior blocks: [CALC-INT4](https://github.com/ctimaru/steel-sales-ai/pull/611), [CALC-INT4.1](https://github.com/ctimaru/steel-sales-ai/pull/613), [CALC-INT4.2](https://github.com/ctimaru/steel-sales-ai/pull/615), [CALC-UX4](https://github.com/ctimaru/steel-sales-ai/pull/617).

## Observed production baseline — no invented search metrics

Read-only inspected 2026-10-16 on actual public URLs (5 IT/EN/DE/FR/ES calculator landings; 3 national pillar technical guides; 3 market-specific satellite technical guides):

- All 11 URLs render correct language and unique, self-consistent canonical; live metadata marks them \`index, follow\`.
- Query variant \`/de/knowledge/tubes?source=test\`: clean canonical \`/de/knowledge/tubes\`, \`noindex, follow\`.
- Sitemap \`/sitemap.xml\` lists all 5 calculator pages plus 3 pillar and 3 satellite technical articles. Distinct intent satellite pages are deliberately NOT presented as DE/FR/ES hreflang equivalents. Pillars and calculators retain their appropriate language alternates.
- Each pillar links to its local satellite and back. The guides link to their localized calculator and \`/{locale}/distinta\`; this is *navigation only*, not automatic RFQ dispatch.
- **Observed gap A:** DE/FR/ES calculator landing HTML contained a direct editorial link to the local *pillar*, but **not** to the associated specific-intent *satellite*; a user/crawler had to first navigate the pillar.
- **Observed gap B:** On the 6 guides, the structured \`BreadcrumbList\` had three levels (pillar) / four levels (satellite), but the rendered breadcrumb nav stopped at home → calculator and omitted guide titles; resulting hierarchy was harder to navigate.

The public crawler/content fetch is not Google Search Console: it cannot establish Google indexing, traffic, impressions, clicks, ranking or CTR. GSC Wizard remains blocked by \`payment_required\` and CALC-INT4.2 already provides a free manual CSV evidence path. No new content decisions are based on guessed search volumes.

## Implemented interventions

**A — Crawlable deeper internal linking**
- DE/FR/ES calculator pages retain their original compact national pillar card, and gain one accessible, lightweight contextual satellite link inside that same card (locale-specific kicker/title/description already in the editorial catalog).
- Links are actual \`next/link\` anchors in server-rendered HTML. No new indexable URLs, repeated keyword blocks, SEO doorway pages, or oversized duplicate sections.
- Preserve calculator first-screen prominence, mobile ergonomics, commercial \`€/ton ↔ €/m\` preview and optional EU/USA switch.

**B — Visible breadcrumbs match JSON-LD**
- Pillar: localized home → localized calculator → current pillar.
- Satellite: localized home → localized calculator → parent pillar → current satellite.
- The final segment is nonclickable with \`aria-current="page"\`; parent links offer visible focus indicators. Wrap long technical titles on small screens; no route or canonical change.

**C — Regression contracts**
- Automated tests cover five fixed calculator URLs, direct link to both kinds of guide, locale/slug isolation, reciprocal pillar hreflang vs non-equivalent satellites, clean canonical and noindex variations, site sitemap, breadcrumb structured-data parity, retained localized bill and no backend RFQ dispatch.
- Content/sitemap use existing data, no new runtime libraries, schema migrations, tracking pixels, third-party search account access or rate-limited crawler jobs.

## Acceptance checklist

- [ ] CI front-end tests, typecheck, build and required status green.
- [ ] Chrome responsive/keyboard/consent baseline green.
- [ ] GitHub PR merged only after branch protection passes.
- [ ] Normal Vercel production release is READY for the merge SHA; no manual extra builds.
- [ ] Live 3/3 DE/FR/ES calculators expose both a pillar and a satellite link.
- [ ] Live 6/6 guides expose breadcrumb to their parent with self canonical preserved.
- [ ] Six guides and five calculators remain sitemap listed, with query variants appropriately noindexed.
- [ ] Notion closes only observed acceptance; genuine GSC impressions/clicks remain a future evidence task.

## Growth interpretation

The first technical SEO win is **discovery quality**, not a claim of higher ranking: visitors with technical purchase intent can reach more relevant content in fewer clicks and return directly to kg/m and the copy-only bill. Prioritize quality and registration conversion over proliferating pages before demand is demonstrated.

Next: **CALC-INT4.4 — Calculator → Distinta → RFQ Conversion** (privacy-first funnel). Distinguish a click to create a bill from actual successful RFQ submission and track only consented, aggregate, noncommercial attributes.
