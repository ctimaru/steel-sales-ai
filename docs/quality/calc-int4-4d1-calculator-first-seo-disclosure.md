# CALC-INT4.4D.1 — Calculator-First Layout & SEO-Safe Editorial Disclosure
16 ottobre 2026 · Focus UX before CALC-INT4.4E

## Decision
The Italian indexable calculator page `/knowledge/tubes` must show **only the calculator and its in-place Distinta** as the principal content. Preserve the EU/USA cinematic switch, small language selector and private RFQ action. The legacy editorial material may be consulted through explicit, **closed by default** native HTML `<details>` sections, not hidden via robots/user-agent targeting, CSS display-none, noindex, client-only loading or removal from the server HTML.

## Implementation
- `apps/web/app/(italian)/(public)/knowledge/tubes/page.tsx`: remove redundant heading, tighten spacing and keep language selector. The existing catalog-family cards, calculation formulas, FAQ, referenced sources, applicable standards and warnings are all preserved and rendered inside one native semantic disclosure `data-testid=calculator-editorial-disclosure`. `EnStructuralMethodEvidence` is included in this section rather than creating a permanently visible card under the EU calculator.
- `apps/web/components/public-tube-weight-calculator.tsx`: restore primary UX priority: calculator and its result; the existing source-reference panel and device-options disclosure remain fully available but live inside a secondary native disclosure `data-testid=calculator-technical-disclosure` on *Italian inline calculator only*. Other locales and the existing builder /distinta retain behavior.
- `apps/web/components/calculator-inline-distinta-experience.tsx`: pass bill using new optional `inlineBill` ReactNode slot so the **bill is directly after calculator and before secondary reference content**, not buried below catalog data.
- Unchanged public URL, title/description, canonical, IT/EN/DE/FR/ES hreflang, FAQPage/TechArticle/WebApplication/BreadcrumbList JSON-LD, public link graph `/knowledge/tubes/*`, robots for query-specific variants and actual technical content.
- Native details remain available to all users (not bot-only), with 44px summary tap areas and keyboard access; SEO preservation is a design constraint, not a guarantee of unmodified Google rankings.

## Verification
- [ ] P0 Required Gate (frontend tests, typecheck, build) success.
- [ ] Chrome 390/1440: only primary controls visible on load; calculator→bill→secondary disclosures ordering, full editorial and source references accessible on expansion, no mobile overflow.
- [ ] Existing CALC-UX1, EN/USA, RFQ, intl regression green.
- [ ] Merge protected, Vercel READY, live read-only DOM SEO/title/accordion validation.
- [ ] Notion updated and evidence recorded.

## Deferred
4.4E remains separate: locale parity for inline bill, not part of this change. Full SEO post-release indexing/search-impact observation must be done through GSC when new crawl data becomes available. Do not claim static HTML equivalence guarantees identical rankings.

[Parent CALC-INT4.4](https://app.notion.com/p/3fbf059cecb581528fcad191b369b266) · [4.4D](https://app.notion.com/p/3fbf059cecb5810eb6bce47ffeb58494).
