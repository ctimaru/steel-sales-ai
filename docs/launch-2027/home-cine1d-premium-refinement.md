# HOME-CINE1D — Premium Visual Refinement

Date: 2026-10-25
Status: implemented in dedicated review branch; requires acceptance before production.
Dependencies: released HOME-CINE1A.2 #935, CINE1B #936, CINE1C #937.

## Reference comparison

Source of truth: the original **Steel Awakening + Living Steel Network + Intelligence Cockpit** storyboard in `home-cine1a-art-direction.md`, and current production repo assets. Public web search caches may lag the confirmed Vercel production SHA; compare GitHub `main` and live Vercel deployment for acceptance.

| Visual constraint | CINE1C shipped | HOME-CINE1D improvement |
| --- | --- | --- |
| Photographic steel 60% | 640x427 6,170-byte owned WebP scaled to full-bleed desktop background, can soften on wide displays | Show the same asset in a right-weighted, smaller stage with less forced upscaling and more exposed steel. No added requests or bytes. Future high-resolution asset must be separately cleared and budgeted. |
| Intelligence network 25% | Decorative overlay sometimes competes with metal reflections | Overlay opacity reduced from .70 to .54; no additional particles. |
| Product proof 15% | Floating RFQ hint and large industrial headline compete with image | Smaller 242px RFQ panel and condensed headline; retain illustrative label and all tool CTAs. |
| Proportions | 704px tall desktop hero, 820–850px mobile, 94px transition rail | 660px desktop, 764–790px mobile, 76px desktop transition rail; preserve clear CTA priority. |
| Downstream style | Strong dark tools panel, accents and long card sequence | Condense product area 56→48px, technical H2 maximum 43→39px, reduce heavy section striping. |
| Performance | CI baseline mobile Lighthouse 95/95/95, mean LCP 2.716s, CLS 0 | No additional images/JS/fonts/layout shift. Acceptance still measured via three mobile Lighthouse samples and Chrome four breakpoints. |

## Hard gates

- Existing public tool routes, access control disclosures, registration and content preserved, in IT/EN.
- No changes to backend, Supabase/Railway, OAuth, RFQ schema, or private Network data.
- Full-page screenshot QA 320/390/768/1440, heading not clipped, first CTA visible and focusable; no horizontal scroll.
- Chrome Axe no serious/critical violations, actual hero contrast and keyboard navigation pass.
- Use unchanged 6,170-byte WebP asset; no added fonts, packages, scripts or new network dependencies.
- Lighthouse mobile: repeat 3 local CI runs; prioritize CLS=0, compare LCP and score to CINE1C. A material negative shift blocks merge.
- Founder visual acceptance on Vercel Preview and explicit merge only after checks green; production unchanged until then.

## Next measured decision

If the user still sees unacceptable softness on large screens, independently test a local original high-resolution WebP with mobile/desktop media strategy, document rights and a strict responsive image budget, and compare Lighthouse. Do not silently replace optimized imagery during this typography/layout refinement.
