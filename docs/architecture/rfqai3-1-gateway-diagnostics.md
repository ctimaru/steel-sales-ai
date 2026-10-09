# RFQAI3.1 — Gateway structured output & production diagnostics

## Incident
A registered and authorized user reported **"L'analisi AI non è riuscita. Nessuna riga è stata aggiunta."** after adding `AI_GATEWAY_API_KEY` and redeploying Vercel. Production environment inspection independently confirmed the key's **presence** and successful post-change deployment, but Vercel's runtime logs API returned **403 Forbidden**; the original server action obscured all errors in one generic `catch`.

## Changes
- Prefer schema-constrained `response_format: { type: "json_schema", json_schema: { strict: true, ... } }`, instead of legacy `json_object`, ensuring all item fields are present and additional fields are disallowed.
- Explicit `reasoning: { effort: "none" }` for the default **Qwen3 14B** hybrid-thinking model; the official Gateway model description notes thinking can consume response token budget.
- Raise the abort timeout from 25 to **45 seconds**, output cap to 5,000 tokens, and use a low nonzero temperature; reject truncated response before trying to parse it.
- Robustly classify HTTP 401/403 (credentials), 402 (budget), 404 (model), 400/422 (unsupported request), 429, 5xx, and 200-success envelope problems separately. JSON parser handles strict JSON and fully fenced JSON responses, never evaluates content.
- Emit metadata-only incident logs (short trace ID, phase, status, kind) without logging customer text, model replies, access tokens, tenant/user IDs, or filenames.
- Keep `requireWorkspaceWriteRole`, 12k text / 30 row limits, existing per-instance burst limit, human review, unchanged RFQ save/dispatch privileges, and no automatic article insertion.

## Verification and remaining limitation
Regression tests exercise schema, response parsing, invalid envelopes, and all status codes. The P0 Gate runs Node tests, TypeScript and Next.js build; Chrome multi-account and mobile jobs validate existing UX. **The integration cannot be declared functionally resolved without a real authorized AI invocation**. The administrator must verify a production call and AI Gateway usage separately. A fresh error should now report the *category* instead of the previous catch-all, permitting a targeted follow-up without secret exposure.

References: Vercel AI Gateway structured output docs and the Qwen3 14B model page.
