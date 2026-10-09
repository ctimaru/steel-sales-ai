# RFQAI2 — Unified Intake UX

Status: **Implemented as an inert, role-aware frontend stage. No AI, upload, webhook or parser execution is enabled.**

## Purpose and ownership

The same BD10 Distinta editor powers both:
- public `/distinta` (free manual creation, copy; authenticated users see RFQ Hub bridge), and
- authorized private `/rfq-hub/distinta` (page guarded by the existing `requireWorkspaceWriteRole`).

`RfqAiIntakeUx` is embedded **inside the existing editor column** and wraps the BD10 manual configurator and quick-search without cloning state. The right-hand `bd7-preview` remains the **only** editable Distinta list, using the existing BuyerDistintaDraftLine state, totals, document requirements, copy, save and RFQ handoff.

### RFQAI2.1 — Information architecture and responsive entry

The `role="group"` mode switcher provides four actual view choices (not separate bills):
- **Configura**: original five-step assisted builder plus catalogue fallback, free and working;
- **Scrivi o incolla**: private-only controlled text input (max 12,000 characters), local-only preparation for RFQAI3;
- **Carica file**: private-only local file selection with explicit Excel, PDF or EML allowlist and a 25 MB/positive-size check; no file content is read or transmitted (RFQAI4–5);
- **Email**: private informational panel for forwarding / connected-mailbox phases RFQAI9–10, clearly marked inactive.

All four options render a real change of view, using buttons with `aria-pressed`; the panel has a stable `aria-controls` target. Manual children stay mounted but hidden when another mode is selected, so switching modes preserves unsaved dimensions and quantity. Mobile shows two columns of choices, 44px controls and 16px text fields.

### RFQAI2.2 — Private AI entry gating

The `workspace` flag is only set by the previously guarded workspace page. On the public route, whether guest or authenticated, modes other than manual render an explanatory access panel, **never the private textarea or file input**.

- guest: register / login with a safe internal `next` path;
- authenticated visitor on public route: go to existing `/rfq-hub/distinta`, where active-organization write permissions are independently enforced.

This is UI gating, **not a new authorization boundary**. Do not replace `requireWorkspaceWriteRole` or backend owner/RLS checks with a client flag when RFQAI3/4 adds actions.

### RFQAI2.3 — Data handling and readiness

- Text is held only in component React state in the browser tab, never persisted in `sessionStorage`, shared knowledge, URLs, database or analytics.
- File selection stores only its name and size in state. The browser input is cleared by remounting it when the user clicks **Rimuovi**; no `FileReader`, `fetch`, `FormData`, storage operation, extraction or network request.
- Email mode has **no** connection, token, mailbox permissions or subscriber.
- Buttons for extraction/conversion remain disabled and **explicitly say RFQAI3 / RFQAI4–5**, avoiding success claims or sending material into `/operations/uploads` (commercial-memory ingestion, not RFQ ingestion).
- Text/file input is deliberately ephemeral. Leaving the page clears them; mode switches inside this mounted editor preserve text/selection metadata.
- Nothing unreviewed is automatically inserted into the Distinta. The only way to create a line remains the existing manual BD10 action, and the existing user confirmation/save/dispatch gates remain unchanged.

### RFQAI2.4 — Acceptance and future hook points

Tests verify visible and private modes, public CTA paths, no outbound I/O, text/file bounds, single editable preview, authenticated route guard and mobile sizing. Existing BD1–BD10/RFQ-IA tests and `npm run typecheck` / `npm run build` are the regression gates.

Future RFQAI3/4 implementations should take controlled intake content through a new server-side **authorized** endpoint, then call `makeRfqAiBatchFromParserV4` or `normalizeRfqAiCandidate`, render the per-field evidence/issue review, and only after human confirmation update the BD10 lines. The endpoint must use verified user/company context, bounds, RLS, signed file uploads and untrusted-document prompt injection defenses.

## Dependencies and release

RFQAI2 is based on RFQAI1 branch `feature/rfqai1-unified-intake-contract`; submit a stacked PR with that branch as base until RFQAI1 is merged. Merge RFQAI1 first, then re-target / merge RFQAI2 to main after acceptance. No changes to any production authentication or Supabase policies.
