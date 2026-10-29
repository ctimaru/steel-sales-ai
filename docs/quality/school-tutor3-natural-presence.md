# SCHOOL-TUTOR3 — Natural Teacher Presence & Guided Follow-up

Status: implemented in isolated feature branch, pending protected gate. Dependency: SCHOOL-TUTOR2 PR #1037, Vercel production READY.

## Product promise
The Professor is a calm companion for technical learning: ask once, read concise verified evidence, choose one natural follow-up, and go to the right technical tool. One main teacher experience, without excessive motion or simulated AI.

## Changes
- The existing SVG teacher gets restrained expressions and a presence label tied to ready/loading/other states. A small loading dot may pulse; reduced motion remains respected.
- Each published K2 source offers two deterministic next questions: Approfondisci il contesto tecnico; Che cosa devo verificare?
- The follow-up reveals only technicalContext and caution from the verified source, or an explicit generic disclaimer where specific cautions are not provided.
- Choosing a second follow-up replaces the previous one. A new question clears follow-ups and aborts any outdated lookup.
- Two accessible buttons expose expanded state and use an ARIA reference only for an existing follow-up panel.
- Three technical continuations remain: published Norme, Materiali and Calcolatrice. No commercial handoff or competing assistant.

## Source boundary
The raw question stays in the browser. Only up to two recognized technical codes are sent to the public School evidence endpoint with credentials omitted and no-store, published K2 provenance verified. A guided follow-up sends no additional request, does not call any AI, mail, Network, Commercial Memory, Distinta or RFQ.

## Release acceptance
- [ ] P0 source tests, TS typecheck, Next production build, secret guard.
- [ ] UI-SYSTEM2 contrast.
- [ ] PERF2.1 Chrome Professor at 390/1440 px, follow-up selection and no additional evidence call, focus and overflow; broader site regression and mobile Lighthouse.
- [ ] FLOW1 local synthetic end-to-end commercial journey.
- [ ] Protected merge only after required checks; Vercel Production READY on exact merge SHA; public HTTP smoke.
- [ ] Separate visual sign-off on real authenticated School desktop/mobile, with screenshots redacted; no account credentials collected.
- [ ] Pilot remains NO-GO pending legal/security/restore authorization.

No changes to calculator formulas, Distinta/RFQ architecture, storage, Supabase, AI flags, model budget or voice.