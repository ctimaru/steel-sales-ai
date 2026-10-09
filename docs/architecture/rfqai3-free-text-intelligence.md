# RFQAI3 — Free Text Intelligence

## Scope
Implements an authenticated **text → AI Gateway → RFQAI1 candidate v1 → human review → BD10 Distinta** flow in private `/rfq-hub/distinta`. Public `/distinta` remains free/manual, file and email tabs remain inactive pending RFQAI4+.

### Architecture
- `apps/web/app/(workspace)/rfq-hub/distinta/ai-actions.ts`: server-only action, executes existing `requireWorkspaceWriteRole("/rfq-hub")`, validates text, gates by availability of AI Gateway API key or Vercel OIDC token, applies per-instance 3/min burst brake, calls Gateway's Chat Completions JSON mode with 25-second abort and max 3,500 output tokens, no browser credentials.
- `apps/web/lib/rfq-ai-free-text.ts`: untrusted-text prompt and defensive JSON shape parser; 12k character/30 candidate hard limits; all source excerpts must be verbatim substrings. Model-supplied source/tenant IDs, quoted prices, weights, confidence and approval state are discarded. Weights/norms/units recalculate using `rfqai-intake/v1`.
- `apps/web/components/rfq-ai-text-review.tsx`: per-row review with editable grade, norm, amount, unit and bar length, explicit human checkbox, rejection of supplier quotes, invalid geometry and unverifiable source snippets, and manual insertion into the same BD10 preview. Changing any field resets the confirmation.
- `apps/web/components/rfq-ai-intake-ux.tsx` and `buyer-distinta-builder.tsx`: live user-triggered action; original manual, file and email modes and RFQ save/copy/send remain. No auto dispatch, no campaign creation, no async background ingestion.

### Authorization, privacy & launch
- All AI calls are on **authenticated server actions**, not on public endpoints or the browser. User and organization context comes only from the existing Supabase workspace guard. Public guests and unapproved workspace users cannot invoke extraction by changing client state.
- Text is transmitted to an external AI model only after clicking **Analizza**. Personal/customer data may be present; confirm your provider data processing terms, settings, geographic region and project Gateway budgets before a broad pilot. No text or AI output is written to database by this feature; drafts exist only in React state. Final confirmed lines still use the original server-side save permissions/validation.
- Model: by default a currently listed text+structured-output, zero-data-retention eligible Gateway model `alibaba/qwen-3-14b`, configurable by `RFQAI3_MODEL`. Runtime uses `AI_GATEWAY_API_KEY` or Vercel's server-side `VERCEL_OIDC_TOKEN` (no secret committed). If neither exists or `RFQAI3_ENABLED=false`, the page shows an explicit configuration error; **no fake AI result**.
- **Important:** the 3/min safeguard is per warm server instance, not a distributed billing quota. Enforce Vercel AI Gateway project/key budgets and limits before wide release; add persistent per-company quotas, billing and usage/audit in RFQAI11.
- Never treat an email/text instruction as an AI instruction, infer missing length or standard or map supplier prices to buyer targets.

### Known RFQAI3 limits / RFQAI4+ backlog
- The model provides geometry from unstructured text; invalid/missing geometry is blocked, to be recreated manually. The review currently edits commercial fields, not shapes.
- No source file/attachment ingestion, mailbox integration, server-side retained review history, OCR, multi-step extraction, distributed quotas or independent E2E real-model benchmark yet.
- Extraction quality depends on the selected model and provider availability. The CI covers deterministic and mocked data; live AI integration with real billing/provider permissions must be tested in the pilot.
