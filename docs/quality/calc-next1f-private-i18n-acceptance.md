# CALC-NEXT1F — Private Buyer International and Authenticated Acceptance
2026-10-21. Scope: improve private buyer cart and RFQ builder's critical paths in IT/EN/DE/FR/ES without changing server auth or publishing private data.

## Code
- Source-controlled, allowlisted five-language copy and deterministic language selector in the existing Buyer Distinta component; no new role bypass or independent RFQ engine.
- Private route `/rfq-hub/distinta?lang=en|de|fr|es|it` validates the locale **after** `requireWorkspaceWriteRole`; no locale parameter passed to any write RPC. Language can switch in React without discarding the active unsaved draft.
- Key commercial journey labels (calculator, private technical cart, RFQ create, save, optional supplier email, line editing, required global documentation, status/progress) translated.
- Calculator EU interface follows selected private locale; mass methods and numeric geometry are unchanged. Server-generated technical content, existing guided creator, AI intake, network handoff and some advanced line-details stay IT pending explicit localization QA. This is **not** a claim of all existing private copy being translated.
- No migrations, no anonymous authenticated bypass; no price list disclosure or automated dispatch.

## Auth and ownership guards
- `requireWorkspaceWriteRole` remains mandatory on private route before retrieving any catalog.
- Public /en/de/fr/es/distinta pages remain public email-copy tools, not an implied company workspace or auto-handoff.
- Save and RFQ actions obtain `supabase.auth.getUser`; saved campaign reads are owner-filtered; saved company snapshot reads remain organization-filtered + RLS, and create action checks ownership. Guard mutations on the server, never trust locale or UI.
- Session draft uses existing owner-specific tab key; changing language does not serialize price/supplier addresses into URL.
- Authenticated cross-company acceptance with distinct signed-in test users is a **manual staging gate** until approved test accounts/fixtures exist. Avoid inventing verified tenant test results.

## CI
- New NEXT1F key coverage + route role/static backend authorization checks.
- BD11 Chrome smoke for seamless in-page language switch, cart and full RFQ fields, 390 and 1440 px. Existing P0 and PERF Chrome suite verifies language/public/guest regressions.
- UI-SYSTEM2/UI-SYSTEM4 styling, Vercel git-integrated preview, manual authenticated production test remains outstanding.
