# NET-GROWTH2C.2R — Product evidence queue: integrity remediation

Remediation of the independent audit of PR #1069 (NET-GROWTH2C.2) and of the
ChatGPT cross-review, under AI-COOP1 (#1070), lane A "Network & Trust".
Parent issue: #1068.

**Production was not touched.** No migration was applied, no evidence, company,
review status or publication state was read or changed in any hosted
environment. All behaviour below is proven on synthetic data in a disposable,
rolled-back transaction.

## 1. What changed

| Audit finding | Remediation |
|---|---|
| Named company assessments in the public branch | `docs/network/net-growth2c2-first-25-product-review.md` is **not** carried into this branch. No company name from production appears in code, tests, docs or PR text. See §3. |
| Provisional evidence whose discovery record left `private.netfast_discovered_records` was still listed (as "Identità da riconciliare", with source URL) | Quarantined: never listed, counted only. |
| Suppressed domains could still surface through stored evidence | Evidence is quarantined when the source host (or a parent domain), the company domain or the discovery domain is in `public.network_netfast3_suppressed_domains`. |
| Evidence on archived / suspended canonical companies still queued | Quarantined (`canonical_inactive`). |
| Source URL with userinfo (`https://user:pw@host/…`) parsed `user` as host, bypassing suppression (Codex review) | Host parsed without userinfo; URLs carrying credentials or without a parseable host are quarantined (`unsafe_source_url`) and never displayed. |
| `field_value` shape unverifiable; non-array silently empty | Explicit `value_format` (`text`, `string_list`, `mixed_list`, `object`). Only string entries are rendered, max 4 × 140 chars, blanks skipped; objects never rendered raw. |
| Ordering relied on `confidence` (always null in the in-repo ingestion path) | `confidence desc nulls last, fetched_at desc, company_name, id`. |
| Unnecessary `service_role` execute | Revoked; only `authenticated`, gated by `discovery.read`. |
| Out-of-range `?page=` showed an empty "N/N" page | Server redirect to the last valid page. |
| Tests only matched source strings | Behavioural SQL acceptance against the real RPC (below). |
| Source host differs from the company domain | Exposed as `source_domain_match` and shown to the reviewer ("Fonte su dominio diverso"). |

### Quarantine semantics

Quarantine is a **read-side filter**. Nothing is deleted, moved or re-statused;
the private table keeps the full historical provenance. The RPC returns, for
quarantined rows, only aggregate counts:

```
quarantined_total, quarantine_by_reason: {discovery_unresolved, suppressed_domain, canonical_inactive, unsafe_source_url}
```

No id, name, domain, URL or excerpt of a quarantined row leaves the database.
Precedence: `unsafe_source_url` > `suppressed_domain` > `canonical_inactive` > `discovery_unresolved`.

The UI enforces the same 140-character cap as PostgreSQL `left(…,140)` by
counting Unicode code points (`[...text].length`), not UTF-16 units, so an
excerpt with emoji cannot invalidate the whole page (Codex review).

A discovery record leaves the view when its domain is promoted to
`network_companies`, suppressed, rejected, loses feed grant / source rights,
or loses per-domain priority. Promoted rows therefore become
`discovery_unresolved` until their evidence is re-linked to the canonical
company by a separate, reviewed process (not in scope here).

## 2. Files and migration ordering

- `supabase/migrations/20261031183100_netgrowth2c2_product_evidence_review.sql` — from #1069, **byte-identical** (ledger safety whether or not it was ever applied).
- `supabase/migrations/20261031184000_netgrowth2c2r_product_evidence_integrity.sql` — `create or replace` of the same RPC with contract `net-growth2c2-product-review-v2`. Timestamp chosen **before** #1072's `20261031185000_*` so that, once #1072 is realigned on top of this branch, its later replacement of the RPC must carry these filters forward.
- `supabase/tests/netgrowth2c2_product_evidence_review.sql` — rewritten as behavioural acceptance (already in the P0 required gate list from #1069).
- `apps/web/.../product-evidence/page.tsx`, `apps/web/tests/netgrowth2c2-product-evidence.test.mjs`.
- Shared-lock files (`p0-required-gate.yml`, `hp13_permissions_tenant_isolation.sql`, `platform-ia-contract.ts`) carry **only** #1069's original one-line additions; this branch adds nothing else to them.

## 3. Named review document — exposure minimisation proposal (founder decision)

Facts: the repository is public; the document exists only on the #1069 branch
and on #1072, which is stacked on it. It never reached `main`. No forks existed
at audit time.

Proposed, in order of increasing irreversibility; **none executed by Claude**:

1. **Done here:** the document is excluded, so merging this branch (instead of #1069) keeps it out of `main` and out of every future clone of `main`.
2. Keep the 25-row review table only in a private space (e.g. a restricted Notion page). Do not paste it into issues, PRs or comments.
3. Founder: close #1069 as superseded by this PR; ask the #1072 owner to realign #1072 onto this branch without the document; then delete both old branches. This removes the file from branch browsing and from new clones.
4. Founder, optional: check *Insights → Traffic* for views/clones in the exposure window.
5. Founder, optional and only if the exposure is judged material: commits stay reachable through `refs/pull/<n>/head` and cached views even after branch deletion; full removal requires a GitHub Support request. No force-push or history rewrite is needed on `main`, which never contained the file.

## 4. Verification

- `supabase/tests/netgrowth2c2_product_evidence_review.sql`, executed by the P0 gate on a full local Supabase rebuild, covers: anon / tenant denial (also with invalid arguments, so no validation oracle), auditor access, `service_role` revoked, exact eligible/quarantine deltas per reason, full pagination traversal (each eligible row exactly once, no duplicates, canonical before provisional), lane filters, limits 1/25/26/0, offsets −1/10000/10001, unknown/null arguments, value formats and truncation (incl. supplementary-plane characters), userinfo URLs, `source_domain_match`, and no change to evidence, catalogue or publication counts.
- Additionally run locally on a PostgreSQL 16 harness (real enrichment DDL, real discovery view, real RBAC guard functions, both migrations; Supabase auth and tables stubbed). Mutation checks, each expected to fail and failing: original #1069 RPC; quarantine disabled; suppression check removed; userinfo guard removed; naive host parsing; permission guard removed; limit 26 allowed; 141-character cap.

## 5. Still open (not solvable from the repository)

- **Provenance of the 288 production `products` rows**: no in-repo writer emits `field_key='products'` (`network_profile_extraction.py` emits description / services / industry with `confidence = null`). Needs an authorised read-only query on `extractor_version`, `jsonb_typeof(field_value)`, `count(confidence)` and source rights. The new `value_format` makes the effect visible in the UI meanwhile.
- **Quarantine baseline in production**: how many of the 286 candidates fall into each quarantine reason is unknown until the migration is applied in a controlled release (counts before/after, no publication).
- Chrome acceptance at 320/390/1440 with a synthetic Platform auditor (pattern of #1065) is not part of this PR to avoid touching `product-flow1-e2e.yml`, which #1065 modifies.
