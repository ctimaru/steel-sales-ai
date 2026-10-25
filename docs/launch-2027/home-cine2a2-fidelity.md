# HOME-CINE2A.2 — Cinematic Hero Fidelity · Development release gate

Source: HOME-VISION LOCK issue #941; source gap issue #942 and documentation PR #943. Current main baseline: HOME-CONV1A; local mobile Lighthouse 94/94/95, LCP mean 2.72s, CLS 0.

## Implemented in this PR
- **Original owned steel photo retained:** 47,276-byte WebP desktop and 6,170-byte mobile poster. Increase perceived scale on desktop from 88% to 112% of hero; copy-protecting gradient and responsive mobile crop. This is a no-extra-payload fallback until a legitimate background-only industrial hall is available.
- **Connected industry motif:** replaced non-descriptive polygon with inline SVG geographic meridians, abstract continental outlines, light connection arcs and the three explanatory labels AZIENDE / CONOSCENZA / OPPORTUNITÀ. Decorative only: no live users, counts, sourcing, or functioning-AI claims. Hidden below 700px.
- **HTML-first product proof:** genuinely linked calculator preview, showing CHS/SHS/RHS, choose geometry → enter dimensions → calculate theoretical weight. No fabricated diameter, kg/m, steel grade, quantities, company or quote. Link opens actual IT/EN calculator. Distinta → RFQ → Offerte remains labelled as illustrative process.
- Preserve public calculator as the hero **first CTA** and persistent header CTA, and bill builder as second step. No changes to auth, Supabase, Railway, Network access or calculation algorithms.
- No JS/client component, extra images, external requests, WebGL, video, shader or animation library; reduced-motion/reduced-data preserved.

## Outstanding fidelity gap — do not hide
The monumental factory hall shown in references 1 and 2 is **not** yet replicated as pure, original photography. A generated attempt baked in false UI and numbers; we rejected it to protect brand truth and functioning UX. Do not substitute an illustrative screenshot into the hero. A licensed/original **image-only** factory asset remains a future separate art task after performance benchmarking.

## Acceptance
1. Frontend static source contracts, npm test, typecheck/build.
2. Chrome 320/390/768/1440: first-fold CTA, no overflow, safe language/account navigation, real proof link IT/EN.
3. Axe zero serious/critical at 390/1440, keyboard focus on new proof CTA.
4. Three mobile Lighthouse samples vs 94/94/95 baseline, mean LCP ~2.72s, CLS 0; investigate >3 score points or mean LCP +150ms.
5. Visual compare Preview with four founder references at desktop and mobile; do not invent a fidelity score. Do not merge pending visual approval.

## Browser visual correction — tablet 768px

The first genuine fullPage GitHub Chrome capture on PR #945 showed globe labels and proof card covering the text paragraph at **768px** despite automated no-overflow/Axe passing. This is an actual visual hierarchy defect. Fixed by hiding both decorative overlays between **701 and 1023px**; tablets retain cinematic metal photo and intact calculator CTA. Desktop at >=1024px keeps globe and HTML product proof; <=700px already had the simpler mobile composition. Compare the new artifact before closing the visual gate.
