# SCHOOL-TUTOR2 — One Teacher Journey
Status: implemented on feature branch, pending protected acceptance.

## Product objective
One memorable, trustworthy professor for Smart Steel School: a question, a concise published-source response, a citation and up to three ways to deepen technical knowledge. Avoid a competing "company assistant" call to action and the RFQ preview. Preserve the private Commercial workspace, public editorial pages, calculator and RFQ flows.

## Implemented
- Shared `SchoolTechnicalTutor` for public `/knowledge/professore` (noindex) and authenticated `/school/professore` (private noindex).
- Stronger visual teacher identity: compact portrait-style SVG and dark-green cinematic hero; a single ask form and grounded examples, accessible on desktop/mobile with visible keyboard focus.
- Published K2 responses now use one full-width reading column: brief summary, optional expanded technical context, K2 review date, cautions, and links to the actual sources. No fabricated equivalences or material compliance.
- Removed the competing `/school/assistant` CTA from the Professor surface only. The experimental assistant implementation and all AI/voice flags remain unchanged and **off**: no implicit activation, no private data lookup or alternate teacher in the main journey.
- Existing public standards, grades and calculator deep links remain explicit human-controlled navigation, never automated RFQ.
- Reduced private Professor topbar spacing; non-Italian workspace receives an honest Italian-only availability note.
- Updated the existing SCHOOL-AI1 source-contract and Chrome 390/1440 tests, plus SCHOOL-TUTOR2 one-teacher/privacy source contracts.

## Privacy / trust
Browser-only question text. `parseSteelAssistantInput(text).codes.slice(0,2)` and `matchSchoolTutorTopic` remain the only routing input. Requests to `/api/public/school-evidence` use recognized codes only, `credentials: omit`, `no-store` and abort on changes. K2 published provenance and safe cited HTTPS links are required. No AI calls, Supabase writes, tenant documents or pricing in tutor.

## Protected acceptance
- [ ] P0 npm tests, TS typecheck, Next production build, secret scan.
- [ ] UI-SYSTEM2 contrast, PERF2.1 mobile Chrome and Lighthouse, FLOW1 RFQ commercial continuity.
- [ ] Professor screenshot at 390 and 1440 px public and authenticated (demo/synthetic for CI): one H1, one teacher entry, three learning links, K2-only request, long text progressive disclosure and no overflow.
- [ ] Confirm no regressions in School IT/EN/DE/FR/ES and existing public canonical/noindex.
- [ ] Merge only after all required gates; production Vercel READY on exact merge SHA and public HTTP smoke.
- [ ] **Separate, not automated:** founder visual sign-off using own authenticated browser, with screenshots of `/school` and `/school/professore` at desktop/mobile. No credentials collected by ChatGPT, no claims of real-tenant QA without that evidence.

## Out of scope
AI Gateway / Voice switches, generated explanations, avatar animation, budget and database changes, RFQ/Distinta engines, commercial memory, new pilot companies. Pilot remains NO-GO pending Launch 2027 legal/security/restore/authorization.
