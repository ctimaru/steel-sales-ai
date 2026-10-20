# NET-UX EUROPE1B — Interactive European Country Map

## Delivery — 20 October 2026
Replace the contextual Italy-only card in the compact Free and Pro Network with a selectable map of all **27 European Union member states**.

- Countries are vectors from **Eurostat GISCO NUTS 2024 level 0, 60M**. The derived static paths are deliberately clipped to a European overview (overseas and remote Atlantic islands are not drawn). The underlying company country filters are not clipped.
- EUPL 1.2 upstream license, full notice included in `docs/licenses/nuts2json-EUPL-1.2.txt`; the geometries are clearly marked as a modified projection. Eurostat source is attributed in the UI and source code.
- SVG clickable country outlines with native href, focus styling and screen reader names; Greek NUTS code EL converted to legal-entity ISO GR.
- Expanded native dialog, Escape/close, zoom to country and reset to European extent, 27-country textual navigation.
- Country click preserves the current search, role, persona and technical facets but **discards** the previous region, city, province and page. The resulting Free/Pro query remains tenant and RLS guarded.
- No choropleth business counts, artificial density, geocoding or inferred headquarters.
- Existing Italy regional map remains available by link and in other existing Network routes. Foreign region filters are still disabled pending **EUROPE1C**, so map click is at country level only.
- Mobile compact map is in a disclosure; desktop is visible next to the page header.
- Next **EUROPE1C** will use a versioned regional/administrative taxonomy and server filtering before activating clickable regional outlines for other countries.

## Acceptance
- [ ] P0 Required Gate (frontend tests, typecheck, build) green
- [ ] UI-SYSTEM2 contrast guard green
- [ ] Browser Free/Pro desktop and mobile: map interactions, modal Escape, normal/modifier-click links, 27-country navigation, filter sync and Italy region fallback
- [ ] Vercel production deployment READY on the merged commit

## References
- Eurostat: https://github.com/eurostat/Nuts2json
- Data source: https://raw.githubusercontent.com/eurostat/Nuts2json/master/pub/v2/2024/4326/60M/nutsrg_0.json
- Local license: docs/licenses/nuts2json-EUPL-1.2.txt
- Prior blocks: EUROPE1A, NET-UX COMPACT5B, NET-UX2.
