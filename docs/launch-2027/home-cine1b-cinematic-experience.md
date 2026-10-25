# HOME-CINE1B — Cinematic Experience / controlled motion

Date: 2026-10-25
Status: Implemented in isolated stacked branch, acceptance pending; no production merge.
Depends on: HOME-CINE1A.2 draft PR #935.
Stacking: `feat/home-cine1b-cinematic-experience` is based on `feat/home-cine1a-hero-art-direction`. Merge CINE1A first, then retarget CINE1B to main only after review.

## Product outcome

Deliver a striking first-screen and an emotionally coherent transition into the existing Network content, without increasing onboarding friction or advertising unavailable AI capabilities.

### Visual narrative

1. **Steel**: original, locally-hosted cinematic steel image remains visible from first paint; no new image bytes are introduced in this increment.
2. **Connections**: low-complexity SVG network with seven static nodes, two subtly breathing nodes, no real-world company coordinates or fabricated Network totals.
3. **Commercial control**: a small illustrative panel accurately shows Distinta → RFQ → Offerte (EN: Bill → RFQ → Offers).
4. **Transition**: compact dark story rail connects Conoscenza tecnica → Distinta e RFQ → Relazioni commerciali (EN translated) before the existing role-aware Network section.

### Performance decisions

- No video, GSAP, Three.js, Framer Motion, Lottie, WebGL, canvas, autonomous browsing or network fetch.
- Remove the older heavy steel SVG/filter from server-side markup, retaining a smaller vector network overlay.
- Animate only four decorative layers via CSS opacity/transform at desktop viewports 1024px and larger, with deliberately long durations; all text and CTA are static on first paint.
- On mobile/tablets, decorations stay static or are hidden; no animation and no viewport scroll-lock.
- Honor `prefers-reduced-motion: reduce` and `prefers-reduced-data: reduce`, including print fallback.
- Remove `backdrop-filter` from the hero panel to reduce GPU composition cost.
- Keep optimized CINE1A image and SEO metadata, including the exact links that attribute calculator discovery.

### Acceptance gates

- Typecheck/build/unit source contract; all GitHub required frontend gates green.
- Responsive screenshot acceptance at 320, 390, 768, 1440 px; H1/CTAs fully legible, no horizontal overflow.
- WCAG 2.1 AA critical/serious violations: zero; focus visibly distinct, including keyboard access.
- UI contrast on hero CTA and navigation pass in normal, hover, focus states.
- Browser verify motion: default desktop animation present; at `reducedMotion=reduce` active animations are zero; at 390px active animations are zero.
- Baseline PageSpeed/Lighthouse before/after for mobile, especially LCP/CLS. Any material regression blocks merge.
- Entire homepage remains statically generated and localized (IT/EN); all illustrated Network and RFQ figures are explicitly examples.
- PR approval + separate merge after parent CINE1A; no auto-merge or force deployment.

### Exclusions

No changes to underlying RFQ calculations, supplier data, personal memories, Network permissions, registration, login or production credentials. No new asset pack or video until there is a measurable benefit backed by visual approval and budgets.
