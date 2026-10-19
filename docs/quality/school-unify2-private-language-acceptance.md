# SCHOOL-UNIFY2 — Private Workspace Multilingual UX
Date: 2026-10-19

## Security and scope
No new /en/school, /de/school, /fr/school, /es/school. Existing /school is under the authenticated workspace layout, including getWorkspaceContext(), tenant isolation and privateNoIndexRobots. Only lang=it|en|de|fr|es changes the presentation. Invalid locales fall back to Italian. The user explicitly follows a link to open a public calculator; company documents never leave the private Document Explorer. No new database tables, auth paths, cookie, profile language persistence, or private search endpoints.

## Localization details
Private School switch and banner, cards, norm/grade search, recently visited and favorites, Document Explorer main controls all localized in five languages. GET technical search retains lang without passing private data or company IDs. Italian default keeps previous routes and content.
English reference summaries reuse already-edited published English standard/grade material filtered against K2 public data. Other language summaries remain in source Italian with explicit origin badge. The legacy standard/grade detail page maintains its source language, with a translated contextual banner. Private Document Explorer still invokes the same existing authorization-enforced searchKnowledge server action, shows original evidence without translation; advanced technical filter helper text may remain Italian until a later polish.

## Quality gate and release
Required tests/typecheck/build; UI-SYSTEM2; PERF2.1 Chrome; public Production Smoke; Vercel preview. Do not claim live authenticated multi-tenant testing where credentials are not available. An anonymous production access smoke must continue to deny school language variants. Browser tests on CI demo-mode verify UX only, NOT production authorization.
