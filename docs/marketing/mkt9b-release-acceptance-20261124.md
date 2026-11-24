# MKT9.B — Release acceptance

24 November 2026. Public project IT/EN; no contact intake, payments or account changes.

- Tested implementation: `eaab5115e06334f004f1db62fd7594becc27feb3`.
- Previous CI: P0 45410761108, contrast 45410761194, Chromium 45410761247, anonymous smoke 45410761095, mobile 45410761370 all successful.
- Vercel preview `dpl_CGnaZ4K6nZQ5URei7WPS5vw1KiwY` READY; HTTP 200 on /progetto, /en/project, /, /en, /investitori, /en/investors, /sitemap.xml. Navigation and locale links verified. Corrected CTA visually inspected on mobile. No runtime error/fatal matches in the preview scan.
- Main advanced by A merge `8bccc13379def172992fe05d20d1445b03c0248c`; A/B changed paths disjoint. GitHub rejected the attempted protected merge with required status check `required` expected (HTTP 405). Do not bypass the protection. This documentation-only change triggers a fresh PR check against current main. Verify the exact new head and its required check before merging.
- Founder requested release and merge. No production merge or deploy is asserted by this record. C #1586 remains separate, draft and closed to intake. After successful B merge, verify Vercel READY, actual commit and both public pages.
