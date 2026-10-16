# CALC-INT3E.6 — Page-first language architecture

## User flow (five language entry points)
- Italian homepage `/` → Italian calculator `/knowledge/tubes` → Italian RFQ `/distinta`
- English homepage `/en` → English calculator `/en/knowledge/tubes` → English RFQ `/en/distinta`
- German homepage `/de` → German calculator `/de/knowledge/tubes` → German RFQ `/de/distinta`
- French homepage `/fr` → French calculator `/fr/knowledge/tubes` → French RFQ `/fr/distinta`
- Spanish homepage `/es` → Spanish calculator `/es/knowledge/tubes` → Spanish RFQ `/es/distinta`

Language is selected in the **page/header**, never inside the EU/US mass calculation form. Homepage language switches navigate to corresponding homepage URLs; calculator language switches navigate to corresponding published calculator URLs. Navigation is explicit (no auto-redirect or geo/cookie inference). Clean URLs are canonical; old IT/EN URLs and parameterized calculator links remain routable and maintain existing robots/noindex handling.

## Visual hierarchy
1. Smart Steel Sales site masthead + compact language menu (full label desktop, language code mobile).
2. Calculator landing heading and condensed, cinematic EN/USA segmented control (keeps region state and previous input while toggling).
3. Actual calculator dimensions, norm, shape and result. No five-flag row, PWA install or save-calculator buttons competing with the single commercial action.
4. Add to RFQ bill stays prominent; calculator and RFQ technical safeguards stay untouched.

DE/FR/ES homepage entry is intentionally scoped to public calculator + RFQ and the platform vision. English-only registration is clearly labeled as such; private workspace and some legal pages remain Italian. No unsupported claims about full five-language platform translations. Public RFQ is not sent automatically or carried into a registered private workspace.

## SEO boundaries
- Add self canonical + five-language reciprocal hreflang (+ x-default) on root home cluster.
- Add `/de`, `/fr`, `/es` once to sitemap and keep IT and EN homepage, all calculator and bill URLs.
- Preserve existing `/knowledge/tubes?source=home&surface=header#calcolatore-pesi` navigation and existing calculator→RFQ validated same-tab browser queues; no API, DB or numerical engine changes.

## Release boundary
This is currently a **source branch only**. The user asked to focus on interface rather than test cycles. No manual tests, PR-generated preview deployment or merge were initiated for this continuation. Before production release, run the repository's ordinary protected P0/build/browser checks and merge only after they pass; confirm live SEO and navigation post-release.
