# SCHOOL-UNIFY1 — Shared School identity, workspace and 5 languages
Date: 2026-10-19. Requested by founder after SCHOOL-GROWTH1A–1E.

## IA audit and decision
- Italian public `/knowledge` is the established source for School visual identity, search, original technical illustrations and the 3 editorial articles.
- Italian authenticated `/school` is a technical productivity home with private document search; keep its corporate/private entry and do NOT re-expose private data or workspace metadata in the public site.
- English `/en/knowledge` has real English standards, grades and calculator, but older visuals and only IT/EN language selector.
- German/French/Spanish already have translated calculator, bill and technical satellite pages, but did not have `/{locale}/knowledge` home. Never pretend standards/grades/articles are translated when they are not.

## Implementation
- Shared `SchoolJourney` 4-panel high-contrast professional navigation reused by IT public, IT workspace and EN public plus new DE/FR/ES localized School homes; fixed categories in each locale, real destinations only.
- Shared `SchoolTechnicalSections` vector geometric CHS/SHS/RHS visual in IT workspace, EN and all three new hubs; the original IT public vector remains unchanged (existing validated SEO/browser contract).
- Five-way language selector on hub pages; selecting a language deliberately opens the public version, while private workspace context remains private. No persistent locale cookie or auto-redirect.
- New 3 public hub pages have localized human-readable copy, title/description, canonical, CollectionPage JSON-LD and true IT/EN/DE/FR/ES reciprocal hreflang. Sitemap gets 5 corresponding entries.
- No fabricated translations for original Italian editorial articles; their locale equivalents stay absent from sitemap and hreflang.
- Existing technical calculator and RFQ links still work. No schema, private Network, user access, or analytics identity changes.

## QA release
- PR source and typecheck/Next build; P0 Required Gate, UI-SYSTEM2 and PERF2.1 Chrome acceptance, Vercel Preview READY. Merge only if CI green.
- Production smoke: /knowledge, /school (authenticated optional), /en/knowledge, /de/knowledge, /fr/knowledge, /es/knowledge: true 200, language-appropriate headings, canonical, hreflang and no horizontal overflow. SEO indexing is declared, not guaranteed by Google.
- Separate follow-up: true locale-by-locale article translation/evidence and dedicated private authenticated UX in EN/DE/FR/ES must be intentional new content, not fabricated translated deep links.
