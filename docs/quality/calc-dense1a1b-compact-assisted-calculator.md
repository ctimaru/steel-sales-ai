# CALC-DENSE1A + DENSE1B — Compact assisted calculator (21 October 2026)

## Scope
Replace the tall form and always-visible source cards with a compact workbench:
- one-row calculator heading; standard + shape in a shared compact band (tablet/desktop)
- narrower parametrical preview and result column, single strip with 3 live metrics
- tonnes-from-target as a progressive disclosure (automatically open if a target has been supplied)
- optional price and copy/share/favourites as progressive disclosures, while **Add to bill** remains primary and visible
- instant local-size search, no default eight-result grid; 44px mobile search, filters and keyboard Enter to select first visible match
- source-backed provenance only; selecting a size updates geometry, not norm/quantity/prices
- shared existing public/inline calculators for IT/EN/DE/FR/ES. USA calculator remains unchanged.

## Safety contracts
No new API, Supabase, prices in URLs, external dispatch or database migrations. Prices are ephemeral and buyer target still requires explicit bill-line opt-in. Geometry/weight formulas, existing session cart and RFQ handoff are untouched.

## Acceptance
- [ ] Typecheck, Next production build, frontend node tests and new `calc-dense1a1b` regression.
- [ ] Chrome 390/1440: no horizontal overflow, 44px mobile targets, exact dimensions and quantity update.
- [ ] Search type, Enter select, clear, family and thickness filters; no selection from simple typing.
- [ ] Hidden secondary pricing expands and existing `calc-int4-4c-chrome-private-target` still passes.
- [ ] Private/public cart, quantity, add/edit/duplicate, RFQ guest, multi-language and USA flow.
- [ ] UI-SYSTEM2/4 computed contrast and keyboard focus.
- [ ] Merge only after green gates and manual visual review. Use Vercel integration only, no manual deploy.

## Follow-up
DENSE1C editable bill grid and compact cart footer; DENSE1D AI assisted natural-language intake under user review.
