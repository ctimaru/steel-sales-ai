# HOME-CINE2A.2B — Definitive industrial hall artwork

Date: 2026-10-26. Scope: image only, on draft PR #945. Issue #946. No five-card redesign.

## Provenance and accuracy

This image is an **original AI-generated synthetic visualization**, generated within the founder's ChatGPT project. It is NOT a documentary photograph of a real or named plant, manufacturer, or warehouse. Do not imply customer or factory endorsement.

The source PNG is 1672×941 and depicts a spacious steel industrial hall with steel tube and hollow section silhouettes, heavy trusses, gantry cranes and controlled emerald lighting. Left dark negative space is intentional for the independent HTML headline. The bitmap has **no embedded user interface, text, buttons, quantities, companies, measurements, prices or claimed AI outputs**. The form of tubes in the image is visual only, not dimensional product data.

### Production-ready candidates

- `apps/web/public/home-cine2a2b-factory-desktop.webp`: 1536×865, **79,680 bytes**, WebP. SHA256 `efefe29a7e81d77a470bfaf0bb8098598ef39f6dda78a665131d4d40233b2ddb`.
- `apps/web/public/home-cine2a2b-factory-mobile.webp`: 600×338, **14,860 bytes**, WebP. SHA256 `ac8e6462c64ccb492ee836915a4a48ebd4ee491dc612df691326fa26fa6beb9c`.
- A **6,170-byte existing poster** is retained for `prefers-reduced-data`. All poster selection is via responsive CSS; no JS, LCP preload, videos or external network requests.
- Independent SVG globe and real HTML calculator proof stay in the same document; the new image replaces background only. No extra framework or library.

A real Pexels photograph of steel warehouse, photographer Zakhar Vozhdaienko, was considered (Pexels #36878027, Pexels License permits commercial website use subject to no implied affiliation), but it was not downloaded or included. This implementation uses the synthetic artwork described above.

## Must pass before merge

1. Build/typecheck/test, source contracts including WebP magic bytes and exact budgets.
2. Chrome images at 320/390/768/1440 for actual image selection, first fold CTA and no collisions; compare with 4 founder reference PNGs.
3. Axe zero serious/critical, usable keyboard and link focus, reduced-motion/data.
4. 3 Lighthouse mobile runs vs PR #945 prior reference scores 97/96/95, LCP mean 2.642s, CLS0, and production baseline 94/94/95, mean LCP 2.72s.
5. Visual approval: warm industrial crane depth and steel should be visible, calculator actual UI legible, no cookie interception.
6. PR remains draft and production unchanged until acceptance. Five feature cards are explicitly out of scope.
