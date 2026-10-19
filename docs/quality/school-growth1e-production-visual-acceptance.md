# SCHOOL-GROWTH1E — Production Visual & SEO Acceptance

Scope: real Chrome render and binary network acceptance of the public Smart Steel Sales School, complementing source tests. No new feature, schema, tracking or authenticated workflow.

## Two independent quality gates
1. Before merge / local production build. PERF2.1 already builds Next.js, launches a disposable HTTP server on 127.0.0.1:3000 and installs Chrome. SCHOOL-GROWTH1E checks the freshly built Scuola at 390px and 1440px, screenshots to /tmp/school-growth1e, computes WCAG text contrast for school-primary-action and school-secondary-action, checks horizontal overflow, article image loads, SSR metadata, SEO canonical and indexability, and fetches all 7 image binaries (three SVG and four PNG). One mobile Lighthouse diagnostics sample of /knowledge supplements the existing homepage samples. Artifacts retained 7 days.
2. After Production deploy. Workflow school-growth1e-production.yml listens for successful Production deployment_status or manual dispatch, always audits https://www.smartsteelsales.com (not a protected preview), captures public-only screenshots/JSON and checks actual image Content-Type, HTTP 200 and PNG IHDR dimensions 1200x630. Secrets are not used.

## Validated pages
- /knowledge canonical self, index/follow, calculator conversion CTA and original diagrams
- /knowledge/articoli index/follow, 3 original SVG covers, OG PNG
- /knowledge/articoli/{slug} for three known editorial slugs: index/follow, one editorial cover and figure caption, og:image, Twitter large image to a valid per-slug PNG
- /knowledge/tubes?source=school&surface=home_card: noindex/follow, canonical /knowledge/tubes; calculator interactive in PERF2.1 browser acceptance

## Binaries
- /school/visuals/{slug}.svg x3: HTTP 200, image/svg+xml, valid inline 1200x675, under 16 KB.
- /api/school-og and /api/school-og/{slug} x3: HTTP 200, image/png with PNG signature and IHDR 1200x630, under 500 KB.
- Text-only fetch returning empty_content on a binary URL is not proof of HTTP 200, correct MIME or pixel quality; use the Chrome/Node audit.

## Known CI coverage boundary
UI-SYSTEM4 Vercel Preview Contrast attempts to browse a protected preview. It cannot verify that preview until the GitHub Actions environment has a legitimate VERCEL_AUTOMATION_BYPASS_SECRET matching the Vercel Deployment Protection bypass secret. Keep Deployment Protection enabled. Never put bypass secrets into logs, repo files, app code or public URL. The standalone production-only workflow provides an independent audit of the public alias; it does not imply protected-preview acceptance.

## Interpretation
- Automated computed-action contrast samples at 4.5:1 do not guarantee every text/pseudo-element/overlay, dark theme or AT interaction.
- Lighthouse localhost synthetic results are not PSI field Core Web Vitals. Record LCP, CLS, TBT, transfer weight and score as diagnostic. For field CWV use CrUX/GSC after sufficient traffic.
- Screenshots are public-only, no person/customer data. Retain artifact for 7 days.
- Do not claim an SEO ranking or click uplift from deploying visual assets; query/page GSC evidence must be kept separate.

## Acceptance
- PRE-MERGE: P0 Required Gate, action contrast guard, PERF2.1 including local real-browser check all PASS; Vercel preview READY.
- POST-MERGE: Vercel Production READY at the same merge SHA; production-school workflow green with report/screenshot evidence.
- OPEN: protected-preview UI4 blocked pending legitimate secret, label unverified rather than passed.
