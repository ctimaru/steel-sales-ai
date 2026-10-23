# TRUST-AUDIT1C.2G.2 — Rights Evidence Capture & Allowed-Use Matrix

Date: 2026-10-23. State: **PRIVATE RIGHTS LEDGER & MATRIX IMPLEMENTED; NO REAL PERMISSIONS GRANTED**.

## Product rationale
Smart Steel Sales' independent crawler discovers industrial company facts. An observed website, crawl governance or source provenance does not authorize commercial redistribution, substantial source-text copying, AI training, AI retrieval or a paid Network. Track a *specific legal/contractual use* and its supporting evidence.

## Seven separate use scopes
1. `discovery` — discover/identify sources (subject to access/terms).
2. `factual_profile` — compose factual company profiles.
3. `excerpt_republication` — reproduce source text/images/excerpts.
4. `ai_retrieval` — RAG/indexing/query-time AI use.
5. `ai_training` — model training/finetuning (distinct from retrieval).
6. `bulk_redistribution` — export/license a compiled dataset.
7. `paid_network` — include third-party-derived data in paid products.

Do not assume permission transfers between scopes. Source rights should be evaluated for each of these independently.

## Schema and enforcement
- `private.trust_c2g2_rights_decisions`: an **append-only** source evidence + specific use decision ledger. Valid decision values: `needs_review`, `allowed`, `limited`, `blocked`, `revoked`. No initial records, no automatic inference.
- An `allowed`/`limited` entry requires a source-linked evidence kind/ID, specific use, rights basis, HTTPS proof URL, terms/license version, reason, reviewed-by existing Auth user, reviewed-at, and effective/expiry dates as applicable. Constraints and trigger reject unlinked sources and missing proof. A later decision supersedes an earlier one without overwriting it, preserving audit history.
- Direct write access is **not** granted to service_role or browser users: only controlled database administration can record approvals at present. The future UI needs a separately designed server-side superadmin approval RPC with actor authorization and signed session validation. Never allow routine worker ingestion to grant its own rights.
- `private.trust_c2g2_evidence_use_matrix` derives all 7 scopes per evidence and applies the newest decision; expired or not-yet-effective grants do not count as allowed.
- `private.trust_c2g2_company_allowed_use_matrix` conservatively aggregates every linked evidence for each company/use, shows holds/coverage and defaults `not_assessed`. Holds take priority; an explicit block cannot be converted to allowed without a new, documented and valid review. The matrix is **advisory and not connected to public/AI access gates**.
- All three objects reside in the private unexposed schema, RLS enabled on the ledger, no grants to `anon`/`authenticated`, service_role SELECT only.
- Existing 9 holds, public company statuses, knowledge quarantine, data source registry and crawler remain unchanged. No source file, price or commercial data copied into the repository.

## Initial acceptance and caveats
Expected initial decision count: **0**. Every company must have 7 matrix rows (34 companies = 238 rows). Every evidence link must have 7 rows (150 links = 1,050 rows). All 238 company states must remain non-allowed initially.
The staged test tries and rejects incomplete permission, unknown evidence and mutable prior decisions; a synthetic block becomes visible before test rollback. Production test follows only after staging passes.
Security advisors, branch protection and strict clean rebuild remain separate review gates. A valid HTTPS rights link and reviewer identity alone do not make a legal judgment true: counsel/data controller must establish terms, intended purpose and source rights.

## Next product step
Build a compact superadmin rights console (source evidence → allowed scopes → proof/version → reviewer → confirm) with explicit human approval only for cases demanding a rights decision; automated classification may propose `needs_review` but must never create `allowed`. Filter by no evidence, governance mismatch, rights held and expiry. The ingestion pipeline and any paid/AI data release must use a separately accepted permission check before activating actual usage.

## Open
Legal IP/retention and controlled erasure remain open. Merges must follow the stacked TRUST PR chain after required CI, migration ledger reconciliation, staging strict rebuild, browser JWT verification. No production UI or deployment assumed from SQL success.
