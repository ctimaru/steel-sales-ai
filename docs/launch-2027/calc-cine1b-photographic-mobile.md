# CALC-CINE1B — Product photography and compact mobile controls

Continuation of CINE1A, stacked on PR #953. The public European calculator now
shows an illustrative steel tube photograph matching the selected round, square
or rectangular family. Live dimensions and normative mass still come from the
existing calculator state and engine; the adjacent proportional SVG remains the
technical reference. Invalid dimensions hide both the photograph and drawing.
All five locales explicitly label the photograph as illustrative.

## Assets and delivery

Three original AI-generated product scenes were created with image generation
on 26 October 2026, then encoded to WebP at 384 and 768 pixels. No third-party
photographs, supplier inventory claims, baked-in numbers or fake controls appear.
The source PNGs remain in the session's generated-images directory; the six
deployable derivatives are in `apps/web/public/calculator/`.

| Family | 384px | 768px |
| --- | ---: | ---: |
| Round | 7,428 B | 24,046 B |
| Square | 6,122 B | 23,560 B |
| Rectangular | 8,718 B | 31,498 B |

Native picture/srcset delivers a single local, lazy-loaded decorative photograph
for the current family. Explicit dimensions and a fixed 3:2 frame reserve space.
Reduced-data preference selects the smaller source. No animation, WebGL, new
dependency, API request or preload of all families. The old factory background
is removed from the calculator stage, avoiding a second image download there.

## Mobile sizing

Container queries apply the calculator's compact layout below 680px, including
inside the floating panel. Primary actions are 44px rather than desktop 48px;
secondary buttons have smaller type, padding and painted surfaces within 44px
touch targets. Length and quantity share a row only when their actual container
has enough room. At the narrowest sizes they stack without truncating values.

The home floating dock is also narrower, with 11px labels and 15px icons; its
44px touch targets stay intact. The modal header and close button have less
visual bulk. Existing cookie avoidance, safe-area handling, native modal focus,
Escape behavior and retained calculator/bill state are preserved.

## Acceptance

The existing twenty-case calculator browser acceptance now decodes the actual
selected-family image for CHS/SHS/RHS, checks compact mobile control dimensions,
and checks that invalid geometry removes the photograph. Italian captures cover
all three families at 320/390/768/1440; the other four locales retain round shots.
The eight floating-tool cases additionally check dock dimensions and touch areas.
Existing math, bill, copy-without-prices, accessibility and commercial-flow gates
remain enabled. Exact results and Preview URL are recorded in the pull request.

This remains a review Preview. Final graphical acceptance and production release
are separate from these implementation checks.
