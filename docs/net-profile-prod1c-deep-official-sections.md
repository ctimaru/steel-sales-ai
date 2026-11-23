# NET-PROFILE-PROD1.C — Official technical sections and activities

**Founder direction, 23 Nov 2026:** enrich company pages automatically with source-linked products and performed workings; never infer from navigation keywords, selling equipment, or ATECO alone.

## Baseline

Previous PROD1.B reads just one processed first-party product page and the homepage. Existing verified producer-crawler table has multiple pages on many sites (Tomatis Lamiere 6, Officine Ruboni 5, Trafilcentro 4). These are source candidates only, not accepted manufacturing facts.

## Implementation

1. The existing private, service-only claim returns a list of up to 6 first-party HTML product/production/working source URLs, previously processed with SHA, plus its backward-compatible single product_url. It rejects privacy, quality/certification and PDF paths.
2. Within the existing Railway producer cron, first fetch the official homepage for menus, then up to four product, production and working pages. Follow links from first-level technical sections to second-level relevant first-party HTML pages without exceeding the FIVE PAGES per-company hard cap. No extra scheduler, offsite URLs, unverified redirects, ports, media, query strings or fragments. Respect existing robots, DNS and SSRF checks.
3. Extract production families only from positive manufacturer-object clauses. Extract processes separately as services ONLY from first-party process-execution clauses such as "Eseguiamo taglio laser" or "Siamo specializzati nella saldatura". Do not infer a process from mere navigation or a machine supplier.
4. Each product/process family gets a literal short support excerpt. One page may yield product labels, one original description, and service labels, MAX THREE facts. The private complete function has a strict service family allowlist. No company-owned narrative, stock, SKUs, standards, pricing, or claimed profile mutations.
5. The existing company profile evidence reader supports services; no new page or distracting cards needed.

## Release and acceptance

- P0 foundation and worker negative tests: machinery makers, aluminium/brass, supplier quotations, privacy/offsite/foreign domains, nested pages, bounded page visits, and security grants/RLS.
- Roll out only after checks and migrations; first five-company canary measured against published evidence reader. Do not treat crawled pages as verified facts.
- No reactivation of DATA2, paused by founder.
