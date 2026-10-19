# SCHOOL-UNIFY2B — Explorer Localization and Authenticated Multi-Role Acceptance
October 19, 2026

## Delivery
- English, German, French, Spanish and Italian: 51 interface keys per locale, including examples, filter names, commercial item-role labels, dimension and source selectors, dates, result count, evidence, empty state and generic known errors. Underlying technical field names and submitted values remain invariant (worker API compatibility).
- Never translate source excerpts, filenames, original company records or unrecognized worker errors. The read-only server action and tenant-owner ID logic are unchanged.
- Chrome local / production Next demo-mode 5 locales x 390/1440px: translated labels, stable role filter values and request fields, source UI alignment and 10 screenshots with no personal data.
- Authenticated production **manual only** workflow against seven pre-existing RQG32 synthetic users, explicitly requires approval phrase and production-qa environment, read-only browser GET/HEAD after legitimate password login, no search POST, screenshot, cookies, trace, data dumps, fixture writes or exports. It tests actual login and whether the protected School page is accessible/denied for each identity. It is **not** a cross-tenant search/RLS data proof.

## Governance and release
1. Merge PR only after required source/unit/typecheck/build, UI-SYSTEM2 action contrast and PERF2.1 Chrome.
2. Vercel Production READY with merge SHA, anonymous requests to /school/explorer?lang={lang} remain login_required.
3. Run new workflow on GitHub Actions > SCHOOL-UNIFY2B Authenticated Multilingual School > Run workflow, main branch, input: SCHOOL_UNIFY2B_APPROVE_SYNTHETIC_READ_ONLY. It requires already-configured RQG32 synthetic passwords in production-qa. Owner approval and real credential readiness must be documented before running.
4. For actual owner/Company cross-tenant search result isolation, use a **separately approved** scoped pilot. This test intentionally does not submit form (server action POST) and cannot assert RLS on private documents.
5. If production-qa is unavailable / credentials unset / login refused, report **BLOCKED**, not PASS; do not create new users or bypass Vercel protection.
