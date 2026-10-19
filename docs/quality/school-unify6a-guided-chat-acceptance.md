# SCHOOL-UNIFY6A — Guided Conversational Steel Intelligence
Release candidate · 2026-10-19

## Dependency and scope
Stacked on SCHOOL-UNIFY5 PR #746 (not yet merged to main because GitHub branch protection expects `required` check, despite a successful P0 required job). This branch MUST NOT be merged into main before #746 passes the repository protections. It has its own PR into the #746 branch to avoid claiming SCHOOL-UNIFY5 is already online.

This initial block provides a **working, transparent multi-turn UI** in the authenticated School; it is a retrieval-guided assistant, **not yet a model-generated answer**. The product must never claim that a real LLM, voice transcription, supplier stock, price quote, or RFQ auto-dispatch is available here.

## UX and integration
- Route: `/school/assistant` (IT), `/school/assistant?lang=en|de|fr|es` for the other four languages. Inherits the existing `/(workspace)` layout, no public index. Same private language switch and navigation as School.
- Shared navigation tab and compact visual entry in both the Italian and all four localized workspace homes. The entry card uses centralized high-contrast `school-primary-action`/secondary contract.
- Mobile: single-column chat with a concise fact preview; desktop: chat + pinned verification panel. Input, source links, one-click sample prompts, new conversation and progressive missing-field prompts.
- Entire conversation lives **only in browser component state**, not localStorage, cookies, database, or analytics. Only extracted standards/material codes (e.g. `en10219`) are queried via `GET /api/public/school-evidence`; the user's free text, company names, pricing and customer details are never transmitted to the public retrieval endpoint.
- Pure parser `school-assistant-intent.mjs` plus type declarations, tested as executable code in Node. Recognizes explicit normative reference, curated grade, incomplete grade suffix, CHS/SHS/RHS, wall dimensions, bar count and length in five-language vocabulary. Short messages can refine already-extracted facts. It deliberately does not guess engineering values.
- Source cards show real public K2-backed editorial summary, caution and clickable citations. Absent evidence => plain no-evidence message; no hallucinated substitute.
- When verified explicit geometry + bar length/count + EN 10210/10219 are present, provide a direct link to the **existing published calculator** seeded with the validated query. It does not calculate a figure itself. `/distinta` is only an **empty manual form** here, never an automatically inserted or sent RFQ. The UI says so.

## Acceptance cases
1. `Cerco 40 tubi a 3 metri EN 10219 S235` => 40 bars, 3 metres, EN 10219, grade flagged incomplete, shape/dimensions missing, only EN 10219 retrieval, NO invented size or auto-quote.
2. Follow-up `tondi 48,3 x 3,2` => CHS Ø48.3×3.2 mm, retains prior quantity/norm/length; link to calculator after geometric entry. Still asks for **complete steel grade**.
3. Follow-up `S355J2H` => full grade captured; no normative substitute/equivalence claim, user explicitly verifies suitability.
4. `EN 10210 vs EN 10219` => retrieve **both** public editorial summaries only; no company document access.
5. `rettangolari 80x40x3` and square `50x50x3` => independent geometries; corrections to profile family clear prior dimensions.
6. Invalid wall thickness or missing shape => no geometry prefill. Unknown normative codes/grades are not fabricated.
7. Anonymous read-only K2 evidence remains separate from all private company RLS data, Network entitlements and procurement actions.
8. Test gate: `apps/web/tests/school-unify6a-guided-chat.test.mjs` plus required P0 test/typecheck/build and Vercel Preview. Manual multi-role acceptance remains paused by founder; do not imply it was run.
9. Quality: existing UI-SYSTEM2 and PERF2.1 automated gates where applicable; no visual contrast acceptance claim until the actual checks are observed.
10. Source URL metadata must never be relabeled as verified manufacturer certification, guaranteed material equivalence, or latest mandatory national edition.

## Next stage SCHOOL-UNIFY6B (not implemented here)
A *real*, metered LLM-orchestrated response using a provisioned model (AI Gateway), explicit sources, prompt injection resistance, bounded retrieval, tenant isolation and structured draft confirmation. Add voice only as an opt-in with transcript preview, consent and feature detection; no free-text private prompt to a public endpoint. Cost/rate-limit/error budgets and user entitlements are prerequisites for enabling it to end users.
