# CALC-CINE1A — Technical cinematic calculator composition

Reference: founder-supplied technical calculator image, 26 October 2026. Scope is
phase 1A of the agreed visual transformation, delivered as a reviewable Preview.
Production release and final visual acceptance follow review of the composition.

## Implementation

- The existing public European calculator gains a scoped dark emerald skin. Its
  controls, live technical view and results become three aligned columns when
  the actual calculator container is at least 1000px wide. Tablet containers use
  two columns; narrow containers stack controls and results before the diagram.
- The home floating panel loads the same route and therefore the same real UI.
  The compact embedded buyer/bill builder keeps its existing layout.
- Existing parametric SVG geometry and dimension labels move to the center of
  the public calculator. Shape, thickness, standard and area follow existing
  validated state. Invalid geometry suppresses the plausible-looking diagram.
- A direct Copy results action reuses the original result serialization and
  clipboard helper. Its feedback is translated before it reaches the inline
  public bill's feedback region. Private prices remain outside this result.
- New presentation copy covers IT/EN/DE/FR/ES. There is no new math engine,
  dependency, API, authentication policy, migration or supplier-send path.

## Asset and performance scope

Reuse the repository's existing decorative factory WebP assets:
`home-cine2a2b-factory-desktop.webp` (79,680 bytes) and
`home-cine2a2b-factory-mobile.webp` (10,714 bytes). Their provenance and illustrative
AI-generated nature are documented in `home-cine2a2b-factory-asset.md`.

The stage uses CSS backgrounds, a subtle static grid and the existing live SVG;
there is no autoplay, WebGL, animation library or image of a fake functioning UI.
Reduced-data mode uses a plain gradient. The photograph-specific tube treatment
for CHS/SHS/RHS belongs to phase 1B; this phase does not claim to reproduce the
reference's central photorealistic tube or its unavailable AI/stock controls.

## Acceptance

`calc-cine1a-chrome-acceptance.mjs` checks five languages at 320/390/768/1440:
actual column positions, text contrast, a known real CHS mass (168.3×8), live
CHS/SHS/RHS dimensions, retained three-row bill, result copying without private
prices, no overflow/page errors, and invalid geometry without a false drawing.
Axe runs at 390/1440. Screenshots are uploaded by PERF2.1.

The existing floating-panel, private calculator, bill persistence, privacy,
keyboard and full commercial-flow gates remain enabled. Current validation
results, CI runs and Preview URL are recorded in the PR after execution.
