# SCHOOL-UX6 — Learning-first authenticated School

Status: **Implemented in branch; pending protected CI and production acceptance**.
Dependency: SCHOOL-NAV2 PR #1025 merged, GitHub main commit `33bbd976`.

## User goal

Make the authenticated School feel like a technical learning environment rather than a second commercial dashboard. Keep the industrial steel image, dark-green/white high-contrast style and dense touch-ready controls.

## Scope implemented

- Compact photographic hero on the private School only, with one featured entry to the published-evidence **Professore** (not an unverified generative AI chat) and a secondary scroll link to technical search.
- Standards and steel grades search remain visible directly after the hero. Five language states preserve locale in query and target route; Professor content is explicitly labeled as Italian where not translated.
- Calculator remains **one click away** from School, inline as a utility row under technical search. No mass/quantity formula changes, engine copies or competing calculator panels.
- IT/EN/DE/FR/ES authenticated School removes duplicated large commercial-first journey cards; published geometric reference diagrams and favorites/recent resources remain in disclosures.
- Norms/grades authenticated indexes reuse published K2 technical catalog component in all five languages (including IT); compact headings, query/filter and cards, source notices remain. Public SEO catalog pages, metadata, URLs, canonical and articles remain unchanged.
- Supabase permissions, Commercial Knowledge Explorer, /commercial/knowledge, /school/explorer backward compatibility, Distinta/RFQ and all existing pilot gates remain unchanged.

## Acceptance

1. P0 tests/typecheck/build, PERF1 tenant/GoTrue, PERF2.1 mobile/visual, UI contrast and FLOW1 all PASS on one branch head.
2. Five languages in Chrome at 390/1440 px: one professor hero entry, full technical search and calculator in one click, no horizontal overflow.
3. Direct authenticated references `/school/norme`, `/school/gradi`, `/school/professore`, `/school/guide`; verified published K2, no private Commercial Memory on School.
4. Public School and SEO catalogs unaffected: existing indexability/robots/canonical and public pages unchanged.
5. Protected merge only when checks pass, then Vercel Production READY on exact merge SHA; do not represent this as real-company pilot GO.

## Out of scope

No new chatbot, avatar, voice, trained AI claims, API call with raw question, calculator algorithms, pricing, customer documents, database migrations or participant onboarding.
