# HOME-CINE1E — Sharp Steel Poster (controlled desktop upgrade)

Date: 2026-10-25. Status: isolated PR, release gated.

## Decision and actual source

Re-use exactly the original locally authored cinematic steel CHS/SHS/RHS photography from HOME-CINE1A; **no external rights**, stock photo, API or private supplier imagery.
The old 640×427 WebP (6,170 bytes) is intentionally extremely compressed and visibly soft on large desktop screens; the master source is 1536×1024. Generate one additional **1360×907**, optimized WebP quality 62, **47,276 bytes**, from that same source. Git blob SHA `af445bfa3bff36b16ea073c5b37f4874858dc361`.

## Rendering and privacy

- Desktop 1024px and up loads `/home-cine1e-steel-desktop.webp`, using the exact existing composition/crop/gradients and all CINE1D typography.
- Mobile and tablet below 1024px continue loading `/home-cine1a-steel.webp`, **no added image bytes**.
- On wide screens where `prefers-reduced-data: reduce` is recognized, revert to the light asset.
- No preload or duplicate download of both image variants; CSS media select the single suitable layer.
- No new JS/Next Client component, route, lib, iframe, video or data endpoint; network and RFQ visuals remain decorative and truthful.

## Release acceptance

1. Static source tests enforce exact image sizes, valid WebP header, correct desktop gating and fallback.
2. Browser QA: 320/390/768/1440, no overflow, first CTA accessible and readable, all four Network personae and privacy.
3. Contrast + WCAG Axe severe/critical zero, keyboard and reduced-motion gates intact.
4. 3 mobile local Lighthouse samples compared with CINE1D **96/96/96, mean LCP 2.679s, CLS 0**. Require 0 CLS and no material LCP regression; desktop-only asset should leave mobile unchanged, but **measure it**.
5. Inspect production and Preview hero on 1440px before merging; high-res sharpness must be noticeable.
6. Release on a standalone PR only after green gates, review and Vercel READY. Avoid premature unnecessary deployments.

## Rollback

Revert only the WebP CSS media override and delete unused HQ image; CINE1D remains the proven fallback. Retain no external asset dependencies.

## CI path guard

The original PERF2.1 mobile workflow did not trigger on changes to cinematic CSS or local posters; HOME-CINE1E adds precise path filters for public cinematic assets. Chrome public visual QA now asserts computed-image choice at every 320/390/768/1440 breakpoint. This ensures no stale small desktop image or accidental high-resolution mobile background.
