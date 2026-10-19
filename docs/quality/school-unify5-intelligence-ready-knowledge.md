# SCHOOL-UNIFY5 — Intelligence-Ready Technical Knowledge
Implementation candidate · 2026-10-19

## Purpose
Provide a durable **public-only, machine-readable, citation-first evidence layer** on top of the already-published K2 knowledge catalog and original IT/EN/DE/FR/ES School editorials. No second copy of the technical catalog, no new database schema or Auth/RLS changes, and no pretend AI chat. This is a foundation for a later natural-language and voice assistant.

## Architecture
- Endpoint: `GET /api/public/school-evidence?q=EN%2010219&locale=it&kind=standards&limit=2`.
- Server read-model: `apps/web/lib/school-knowledge-evidence.ts`; JSON response `school-evidence.v1`.
- Input: `q` required, 2–100 characters; `locale` in `it|en|de|fr|es`; optional `kind=standards|grades`; optional `limit` 1–4. Invalid inputs yield HTTP 400.
- Candidates come **only from `listPublicStandards` and `listPublicGrades`** (existing anonymous K2 RPCs); each returned candidate is checked a second time via `getPublicStandard/getPublicGrade`. Missing/unpublished record: no output. Missing native editorial language: no output.
- Same stable `id` across languages: `standards:en-10219` or `grades:s355j2h`. Localized public URL used as primary citation. K2 source links and editorial scope links are separated by role. Editorial preparation date (DE/FR/ES) is not K2 review date and is not a claim of human-reviewed translation.
- Output fields: code, slug, title, summary, technicalContext, rfqGuidance (nullable), caution (nullable), provenance, citations, relatedForDiscovery and `reviewRequired:true`. Relations are **discovery only**, intersection of published K2 records and actually authored locale pages; not compatibility.
- Source and record publication always govern visibility; no document corpus from companies, no private Network enrichment, no embeddings service and no foreign/tenant scoped Supabase data.
- API response explicitly distinguishes `answerableFromVerifiedSources` and `items`. An empty result means absence of verified evidence **in this source**, not proof that a grade does not exist. `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` to avoid duplicating searchable SEO pages.

## Safety contract for future AI and Super Intelligence
1. Retrieve evidence before giving a technical answer, cite the precise `public_page` and source URL, and preserve edition/date distinctions. Answer only within cited scope; otherwise say insufficient evidence.
2. Never invent EN/ASTM equivalences, certification, pressure/temperature limits, density-based normative weights, stock, price, or supplier capabilities. Never treat a discovered related grade as an approved substitution.
3. Interpret user intent, but **ask for missing geometry** before preparing a calculated bill. Example: "40 tubi a 3 metri, EN 10219, S235" lacks CHS/SHS/RHS, section dimensions, thickness, full grade/edition and delivery details. Show which facts are known, which are missing and why, rather than auto-filling fictional sizes. Draft-only Distinta; no RFQ dispatch, purchase order or company connection without user review.
4. A future authenticated bridge to company documents must be **separate**, bound to the authenticated company and existing RLS; never attach tenant data to this public endpoint. Later voice transcription needs user consent and typed confirmation of parsed values.
5. The schema contains *evidence*, not model answers; no automatic AI call, no model-dependent numeric decisions. If a future LLM is added, use structured validation and manual confirmation before actions.

## Acceptance scope
- Automated regression: `apps/web/tests/school-unify5-evidence.test.mjs`.
- Project CI: P0 required checks (tests/typecheck/build), UI-SYSTEM2 action contrast and PERF2.1 mobile per existing repo workflow; Vercel preview before merge and Production READY after.
- No new manual authenticated/multi-role acceptance campaign (founder deferred SCHOOL-UNIFY2B).
- Functional acceptance after release: valid K2-published code returns localized cited evidence; unpublished or missing guide never returned; invalid/mass queries 400; route noindex; no authenticated records or actions.
- A missing external LLM integration is deliberate: next independent block `SCHOOL-UNIFY6 — Conversational Steel Assistant` (question/clarification → citations → preview Distinta, eventually optional voice).
