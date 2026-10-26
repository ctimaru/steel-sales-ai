# CALC-CINE1C — Controls and section results

Continuation of the founder's calculator reference, after CINE1A composition
and CINE1B family photographs. The reviewable proposal remains in PR #956.

The existing native standard and family selectors and measurement fields gain
four visual step markers. Length and quantity get an explicit localized heading.
The markers are decorative, so accessible control names and native keyboard
interaction remain unchanged.

The public result panel now contains a semantic definition list of external
dimensions, wall thickness, internal diameter for round tubes, and section area.
Area comes directly from the shared calculation engine, including normative
corner radii for square/rectangular sections. The round internal diameter is
derived from the validated input as D − 2t. Invalid calculations show dashes;
they do not leave plausible geometry facts behind.

Actual bar length and quantity appear beside the existing mass summary. That
context preserves fractional input precision rather than silently rounding the
quantity to whole bars. Existing kg/m, kg/bar, total metres and total tonnes,
copy serialization, bill handoff and validation keep their existing owners.

On wide desktop containers the section facts form compact aligned rows. Mobile
and narrower floating containers use a two-column grid, with short labels and
small icons. The compact mobile primary and secondary button dimensions from
CINE1B remain intact. Copy and bill actions gain decorative document/cart icons
without changing their accessible labels or handlers.

All new presentation copy covers IT/EN/DE/FR/ES. The private compact bill builder
retains its existing presentation. No new assets, dependencies, API calls,
authentication changes, schema changes or supplier send paths are introduced.

## Verification

The twenty-case calculator browser acceptance adds checks for actual CHS
internal diameter (168.3 − 2×8 = 152.3 mm), known CHS area (4028.78 mm²), RHS area
with normative corners (140×80×5 → 2035.62 mm²), displayed length/quantity,
family-specific facts and invalid results. Existing image decoding, all three
shapes, retained three-line bill, copy privacy, contrast and Axe checks remain.
The eight home floating cases and all existing CI regressions remain enabled.
Exact commit, screenshots, Preview and outcomes are recorded in PR #956.
