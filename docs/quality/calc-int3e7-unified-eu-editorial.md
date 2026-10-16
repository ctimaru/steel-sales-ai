# CALC-INT3E.7 — Unified EU Calculator & Editorial Cleanup

## Audit and cause
The published /de/knowledge/tubes, /fr/knowledge/tubes and /es/knowledge/tubes routes were indexable and their server-rendered descriptions, method notes and FAQ were localized. Their **EU calculation mode** mounted a separate `InternationalSteelCalculator` with fewer features. The USA mode was shared. The server-rendered localized page component does not import Italian article collections; the visible lower paragraphs were technical editorials, not Italian blog cards.

## Remediation
- `CalculatorRegionSwitch` now mounts `PublicTubeWeightCalculator` in **all five locales**. It retains the same one shared theoretical-mass engine, EN10210/EN10219 geometry and visual calculator, bar presets and inverse target tonnage, proportional SVG, favorites/recents, copy/share, and add-to-bill. `InternationalSteelCalculator` remains as a legacy source/type for now but is not rendered; do not maintain or ship a second EU variant.
- `internationalEuInitialValues` maps legacy DE/FR/ES query keys into the standard complete calculator values, with allowlists for norm and shape, including target tonnage. Parametrized URLs retain noindex with self canonical clean route.
- `TubeCalculatorLocale` is extended to IT EN DE FR ES; comprehensive localized text maps include advanced options, validation, labels, diagram accessibility, clipboard feedback, installed web app guidance and commercial actions. The language is a prop, never a numerical-engine fork.
- New international EU handoffs use the existing validated `sss:calc-rfq-handoff:v1` same-tab queue and route to `/{locale}/distinta`, never /distinta IT for foreign visitors. USA NPS / Schedule and HSS remain unchanged.
- With no localized/corroborated product references attached to international pages, the calculator hides the empty catalog references block (prevents exposing Italian record links as translated articles).
- DE/FR/ES calculator editorial and FAQ remain localized in static HTML and JSON-LD, but method/USA/FAQ detail is **collapsed** to avoid repetitive long after-content. There is no imported Italian blog list.

## Integrity
- Existing IT EN pages, URLs, share links, old sitemap entries, canonical and five-way hreflang are retained.
- Existing API/ASTM product intent and AISC/HSS caveats unchanged; theoretical mass not presented as certified or supplier verified.
- No new database migrations, server API, scheduled jobs, telemetry payloads, Vercel services or added dependencies. Public RFQ creation still does not send or persist a commercial request.

## Acceptance criteria
- Localized DE FR ES full EU workflow: switch norm, shape, change dimensions, diagram, bar quantity and target tonnage, copy to clipboard and add to bill in matching language.
- 320px mobile UI, keyboard accessibility, retained EU / USA state and US NPS/HSS routing.
- Check all translations, alt labels and status messages for visible Italian leaks.
- Canonical/hreflang + noindex on parameterized routes, no Italian articles in new locale pages.
- Protected gate passes test/typecheck/build and existing Chrome QA; merge only CI green. Do not generate real supplier RFQs or customer records in production.
