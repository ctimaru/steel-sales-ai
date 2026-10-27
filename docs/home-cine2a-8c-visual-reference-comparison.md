# HOME-CINE2A.8C — Visual Reference Comparison

Date: 2026-10-27

## Evidence
- [First 8-image Playwright visual acceptance run](https://github.com/ctimaru/steel-sales-ai/actions/runs/40488430044); artifact `home-cine2a8b-visual-40488430044`.
- Public Next.js production build on a disposable localhost; screenshots in Italian and English at 320x720, 390x844, 768x1024, 1440x900.
- HOME-CINE2A.8B automated checks passed; visual judgement below is separate from those automated checks.

## Observations from screenshots

| Area | Observation | Priority |
| --- | --- | --- |
| Hero desktop | Real industrial factory photo and headline dominate. Floating technical preview sits in photograph; globe/secondary graphic information adds density. | P2 |
| Hero mobile 320/390 | Headline and both CTAs are available; mobile first fold is dense with eyebrow, description, two links, quick links, decorative caption and floating tools. | P1 |
| Consent | Legally required fixed consent panel covers a large part of initial small-screen viewport. **Never suppress consent or move buttons outside its visible frame.** | P1 |
| Five tool cards | Consistent, legible and responsive, but five symbolic glyphs carry less visual product evidence than the approved cinematic concept. | P1 |
| Journey | After tool gallery, geometry proof and separate four-tile public tools reiterate technical entries; clarify hierarchy rather than remove proven conversion points. | P2 |
| Responsive | Captured all 8 pages with no reported horizontal overflow, 5 card links and genuine calculator hero link. | Pass |

## Next work: visual gap closure
1. **HOME-CINE2A.8D Product-led illustration** — replace generic card glyphs with original, lightweight mini-previews representative of actual calculator, RFQ bill, network, commercial inbox and knowledge products; no invented real metrics, actual company or customer data. Maintain IT/EN, accessibility, load and action destinations.
2. **HOME-CINE2A.8E First viewport discipline** — preserve native consent controls, visible primary calculator CTA, and compact navigation; remove only redundant decorative chrome once verified at 320/390.
3. **HOME-CINE2A.8F Page hierarchy consolidation** — differentiate gallery from geometry proof and the existing public tool shelf; keep technical pathways intact.
4. **HOME-CINE2A.8G Reference sign-off** — compare side-by-side with the exact user-approved original reference images at matched viewport widths and document pixel/layout differences.

## Limits
The screenshots are captured and reviewed, but exact original reference image bytes were not available during this run; therefore **pixel-perfect conformity is not verified**. No claim of production browser screenshots is made: these screenshots come from a production build running on disposable local Chromium. No source files, UX, analytics or access controls were changed in this review-only PR.
