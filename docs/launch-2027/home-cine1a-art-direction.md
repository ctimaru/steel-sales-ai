# HOME-CINE1A — Cinematic homepage art direction and hero baseline

Date: 2026-10-25  
Status: Implemented on isolated GitHub branch; PR, CI and browser approval required before merge.  
Scope: public homepage IT `/` and EN `/en`. No private workspace, migration, backend, data sources or auth flows touched.

## Decision

**Steel Awakening + Living Steel Network + Intelligence Cockpit.** The opening scene must feel like the new interface of the steel industry, not a steel mill brochure or a speculative autonomous AI product.

Visual priority: 60% cinematic industrial material, 25% network/data visualization, 15% recognizable commercial workflow.

## Storyboard

| Beat | Visual | User-facing outcome | Delivery |
| --- | --- | --- | --- |
| 01 — Material | Deep-black/emerald stage, realistic CHS/SHS/RHS profiles and soft reflections; large headline | Recognize the steel/tube industry in one glance | HOME-CINE1A SVG static concept |
| 02 — Intelligence | Fine, restrained emerald connections over the steel geometry | Understand that information and people connect | HOME-CINE1A static network overlay |
| 03 — Product | Small explicitly illustrative Distinta → RFQ card, no tenant data | See a clear commercial use case | HOME-CINE1A static UI cue |
| 04 — Useful action | Primary no-account bill builder; secondary approved company registration; calculator, Network, Scuola | Use the platform instead of scrolling through explanations | HOME-CINE1A |
| 05 — Next chapter | Network explorer and existing product/knowledge sections remain below the fold | Preserve conversion and trust boundaries | Existing sections retained |
| 06 — Motion | Refined atmospheric movement, cinematic video variants and scroll progression | Optional progressive enhancement | HOME-CINE1B only, not included here |

## Copy and conversion

- IT H1: **L’acciaio ha una nuova intelligenza.**
- EN H1: **Steel has a new intelligence.**
- Primary CTA: `/distinta` / `/en/distinta` — a genuine public tool.
- Secondary CTA: `/register` / `/en/register`, explicitly subject to company verification.
- Direct utilities: weight calculator, Network overview and technical knowledge.
- AI positioning: `Super Intelligence Ready`, not a claim of autonomous procurement or real-world decision-making.
- The demo panel is labelled **illustrative, not live data**. No fake prices, material masses, network counts or commercial records.

## Art direction

- Base: `#061310` (deep steel), luminous accent `#6FE9B8`, action green `#159767`, muted text `#C4D5CB`.
- Hero type: very large, bold but compact; all other text compressed and legible. Mobile first-line hierarchy preserved.
- Metallic profiles: CHS (circular), SHS (square), RHS (rectangular); dark interiors, brushed steel reflections, physically grounded geometry.
- Fine visual network lines, not generic floating icons or sci-fi particle overload.
- Current static implementation is an original inline SVG using gradients and modest CSS, with no external tracking, imagery, animation or dependencies.

## Responsive and performance

- Desktop target: 1440×900 and 1280×800: hero message/CTAs readable within first viewport with large industrial composition on right.
- Tablet: 768×1024: visual extends behind and fades to protect readable copy.
- Mobile: 390×844 and 320×720: title and CTA first; tubes form the lower part of the scene, not an obstacle to interaction.
- Responsive artwork uses one vector source, avoiding layout-shifting media and unauthorised image downloads.
- `prefers-reduced-motion: reduce` supported; no autoplay, background video, forced scrolling, expensive WebGL, or browser-side data loading.
- In HOME-CINE1B a photographic optimized background may replace the vector *only* with authored/cleared usage rights, responsive crops, explicit bytes/LCP targets and non-motion fallback.

## Acceptance / release gates

1. Build/typecheck and source-contract tests, including the updated legacy homepage assertions.
2. Chrome screenshots: 320, 390, 768, 1440 px; no horizontal overflow, clipped title or inaccessible CTA.
3. WCAG serious/critical axe violations: zero on 390 and 1440; keyboard focus visibly clear.
4. Both IT/EN: exactly one H1, intact canonical/hreflang and correct localized CTA destinations.
5. No unexpected navigation to protected Network, tenant data leaks or unearned capabilities.
6. PageSpeed/mobile LCP and CLS not regressed; compare before/after instead of guessing metrics.
7. Preview approval **before** merge/deploy; production currently unchanged.

## Traceability

Previous constraints: UXF4 public home focus, HOME-SI2/SI3/SI5 truth and performance, WC5 calculator discovery attribution.  
Next: HOME-CINE1B — photo/video candidate selection, cinematic sequencing and visible product proof; no change to private workflow.
