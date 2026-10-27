# HOME-CINE2A.8G — Final visual acceptance evidence (2026-10-27)

**Decision: CONDITIONAL — NOT APPROVED FOR PIXEL-FIDELITY SIGN-OFF.**

## Verified
- Latest production Vercel deployment **READY**, commit `25494d2c9e2ef42ec1332d45276bf5220feca303` (HOME-CINE2A.8F).
- [Playwright CI run 40492006733](https://github.com/ctimaru/steel-sales-ai/actions/runs/40492006733), success; artifact `home-cine2a8b-visual-40492006733`, eight screenshots: IT+EN at 320, 390, 768 and 1440 px.
- Screen captures come from disposable LOCAL production build; Vercel deployment check separately establishes published commit, but these are **not production-site browser screenshots**.
- Hero photograph, primary calculator CTA, bill CTA and all five product-led cards render. No horizontal overflow was reported by scripted checks.
- Consent notice remains present with both consent choices.

## Visual findings
- Desktop 1440: hierarchy reads clearly, strong industrial factory image. Product card and decorative overlays remain visually busy; acceptable for technical release but final design reference comparison is incomplete.
- Tablet 768: headline, photo and CTAs remain present; consent overlay occupies lower initial viewport.
- Mobile 390: headline and CTAs visible above consent; fixed floating action dock competes with first-screen information and overlays some hero content.
- Mobile 320: same problem is more pronounced; fixed dock sits over the early hero/description area before the visitor scrolls. Cookie consent occupies a significant fraction of the first screen but **must not be suppressed**.
- Product-led cards: all five visibly distinct and responsive in captures.
- Original user-approved reference image bytes unavailable in this acceptance work, so a pixel-matched comparison cannot be asserted.

## Release decision
- **Functional/CI smoke:** PASS.
- **Deployment readiness:** PASS.
- **Final visual sign-off:** **BLOCKED** by first-viewport floating-tool interference at 320/390 and unavailable direct original-reference comparison.
- Next fix: `HOME-CINE2A.8G.1` keep the floating tool dock from covering the initial hero/consent areas on narrow screens; preserve discoverability and accessible calculator path. Then rerun eight-screenshot Playwright with targeted bounding-box overlap checks and re-review images. Do not touch legally required cookie controls.

Evidence must not be interpreted as UI-perfect approval or as a production-browser test.
