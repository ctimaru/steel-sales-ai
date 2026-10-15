# CALC-INT3E.1 — Five-language Calculator Launch (DE/FR/ES)

2026-10-15. SEO foundation and localized EU calculator, fully backwards
compatible with all indexed IT/EN paths, EN 10219/EN 10210 nominal masses,
free geometry and RFQ.

## Scope and language ownership

Existing indexed and unchanged:
- `/knowledge/tubes` = Italian full calculator + EU/USA switch
- `/en/knowledge/tubes` = English full calculator + EU/USA switch

New indexable, independently authored local-language technical pages:
- `/de/knowledge/tubes` — German
- `/fr/knowledge/tubes` — French
- `/es/knowledge/tubes` — Spanish

All 5 have native flag links, self-canonicals, complete reciprocal hreflang.
DE/FR/ES include localized title, meta description, heading, page explanation,
main interactive EU calculator, normative explanation, FAQ schema/HTML,
result labels, errors, disclaimer, shape/standard controls, copy, RFQ CTA.
Root HTML `lang` exactly matches content language. All localized pages
use the **same pure CALC-INT2 engine**, not translated/reimplemented formulas.
Existing query-sharing schema `standard,family,od,width,height,thickness,
length,quantity,density` flows between languages; historical extra parameter
`target` is still accepted on established IT/EN pages but DE/FR/ES do not yet
implement the advanced target-tonnes calculator.

Query variants keep clean-page canonical and `noindex`. Only five base pages
are listed in sitemap with consistent alternates; never index combinations.

## Commercial/functional boundaries — explicit rather than misleading

- No login required to calculate in any language.
- European source-based theoretical kg/m, mass per bar and tonnes, copy result.
- DE/FR/ES RFQ CTA serializes existing `sss:calc-rfq-handoff:v1` and sends
  the browser to `/en/distinta`, visibly disclosed in DE/FR/ES.
- No claim of localized DE/FR/ES RFQ bills or of a US product-standard UI in
  those languages. The link to the detailed US API/NPS/HSS experience explicitly
  points to its English page; US calculations remain available there.
- For IT/EN EU mode, five flag links use **live input state**, not the initial
  URL, when switching. Within the US tab, flag nav is present, but the EU
  share URL cannot encode the full US product-standard selection.
- No RFQ dispatcher, price, account, Supabase DB or protected API changes.
- No changes to Italian/English original SEO slugs, geo or site-wide automatic
  language redirects.
- Subsequent CALC-INT3E.2 should translate full USA UI and advanced
  savings/reference/target-tonnes features, then CALC-INT3E.3 localize
  DE/FR/ES RFQ workspaces if product demand justifies the cost.

## Acceptance

- `npm test`, `npm run typecheck`, `npm run build` for web.
- New tests for reciprocal SEO, distinct translated content, three norms,
  three geometries and same v1 RFQ bridge.
- Chrome 360px DE/FR/ES: correct HTML lang, 200, canonical, five hreflang
  links, editable dimensions, live flag URLs, noindex query variants, RFQ EN
  bill receives the selected EN standard and shape.
- Existing Chrome calculator, USA NPS/HSS, five-language switch, BD11,
  accessibility, Lighthouse. Merge only when all CI green.
- After merge, deploy verification and Google Search Console sitemap
  recrawl are independent operations.
