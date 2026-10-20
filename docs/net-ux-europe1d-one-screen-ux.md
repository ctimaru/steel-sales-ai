# NET-UX EUROPE1D — European One-Screen UX (20 Oct 2026)

## UX acceptance
- Desktop (>=1024px): compact title + statistics, search/filter pane immediately alongside the European map (no map in header causing large blank gaps), result list full width beneath.
- Mobile/tablet: country and region remain first in the native form; map disclosure follows the filters without pushing the results off the screen on initial load.
- Visible captions on all five facets, aligned select controls and submit; one unified form. Role and optional steel-relevance ranking preserved.
- URL-driven active territory chips show official NUTS region names (or Italian admin region); click to clear region only while preserving the country and all technical constraints.
- Compact map **always** shows the full EU extent even if a country is selected; selected country highlighted. Expanded map alone supports zoom and NUTS region drilldown.
- Choosing a region in the expanded dialog closes the dialog, navigates to filtered results, and retains the canonical selected-country contract. Country selection leaves the dialog open to permit regional drilldown.
- No counts invented; tooltip coverage still refers only to matching **published** facilities; Italian legacy region and Free/Pro governance untouched.
- Existing UI-SYSTEM2 centralized action contrast classes preserved.

## Tests
- `apps/web/tests/net-ux-europe1d-one-screen-ux.test.mjs` + existing EUROPE1B/C, COMPACT5 and UI-SYSTEM2 suites.
- Required Gate tests/typecheck/build and frontend mobile diagnostics.
- Real authenticated browser visual QA Free/Pro on 390, 768 and desktop still needed if a signed-in browser session is unavailable.

## Release
PR with required CI green → squash merge on main → Vercel same SHA READY → Notion status. Avoid unnecessary deploy cycles.
