# SUPA-LEDGER4E — Private price list & WC3.1 weight integrity

**Captured:** 21 October 2026 · GitHub `ctimaru/steel-sales-ai`, production Supabase `ecrafjdummcdfycznitx`.  
**Restricted material:** The supplier price-list dataset is **PRIVATE / internal**. This audit records **counts, DDL/function names, boolean invariants and noncommercial algorithm identifiers only**; no supplier prices, discount rates, financial values, source file content or credentials are included. This file does **not** authorize publishing a price list, license-dependent source material or source observations.

**Safety:** Production Supabase used exclusively for catalog/aggregated SELECT queries. No Railway use, PostgreSQL password change, `db push`, migration repair, DDL, DML, explicit user impersonation, public publication or Vercel app release.

## Two historical SQL token differences

| Migration | Exact historical divergence | Current live evidence | Adjudication |
|---|---|---|---|
| `pl1_5_padana_full_import_promotion` | Historical SQL recorded remotely inserts explicitly into `public.steel_geometries.geometry_key` and selects `i.geometry_candidate_key`. GitHub's historical file **omits the explicit generated column and matching SELECT**; the SQL token difference is this projection pair. | Current `steel_geometries.geometry_key` is a **STORED GENERATED** field with deterministic geometry canonicalization. All **977** geometries have nonempty, unique keys. Current `private.pl1_promote_import` uses the new approach (omits explicit generated column), retains source row trace and review decisions, requires review-ready status. **1,828** private items; **266** import review decisions accepted as source or accepted with unresolved identity. | **Current-state algorithm matches the GitHub source.** The historical explicit insert is **not safe to replay against the current generated column**. This is a genuine historical SQL change, NOT cosmetic; no proof of clean-build migration equivalence, and do not auto-repair ledger history. |
| `pl1_5_wc31_weight_resolution` | Historical remote `UPDATE ... FROM` uses an explicit `JOIN public.steel_geometries g ON g.id=wl.geometry_id`; GitHub uses `FROM public.price_list_items i JOIN public.price_list_sections s ... , public.steel_geometries g` and the same `g.id=wl.geometry_id` in `WHERE`. | Current resolver is `private.pl1_resolve_wc31_en10219_weights`, **service_role only**; requires `EN10219`, candidate and unresolved status; records `wc3.1-en10219-v1`. **1,321** accepted WC3.1 theoretical formula links, **zero** out-of-standard, nonpositive, missing-geometry or unresolved accepted weights. | Join placement differs, but the **same equality predicate is present**; on current unique geometry-id cardinality, no behavioral difference is demonstrated for this resolver. Do **not** replay as a repair; preserve source formula provenance and test clean rebuild separately. |

## Production privacy and provenance constraints

- **1** price list, **1** version, **1** import run. The version is `review` + `internal`. The source was promoted into internal staging/structured tables, **not made public**.
- `public.pl1_version_visible_to` delegates to `pl1_private.version_visible_to`, a guarded SECURITY DEFINER function. The helper requires published version state, eligible `publication_scope`, linked source document, latest matching governance decision and structured visibility approval. **0 versions qualify for the public audience and 0 for authenticated read** at capture. This is *application-visible publication eligibility*, not a replacement for authenticated role tests.
- All **13** checked `price_list%` tables have RLS enabled. Some presentation tables expose a raw `SELECT` privilege to `anon`, but their **anon SELECT policies are filtered through `pl1_version_visible_to`**. Staging/review/anomaly rows cannot be directly selected by `anon`. Catalog checks alone cannot prove that every other RPC/view/storage bucket is safe; run negative tests before considering any publishing.
- `private.pl1_promote_import` and `private.pl1_resolve_wc31_en10219_weights` are **not executable by `anon` or `authenticated`**, but **are** executable by `service_role`. Human-facing SQL mutation must still be gated by server-side permissions.
- `private.pl1_guard_price_list_version` checks source-document and governance evidence at publish transitions; `private.pl1_guard_weight_link` protects accepted/rejected/superseded weight snapshots from mutation.
- **1,831** staging rows, **266** accepted import review decisions, **1,828** imported items, **1,739** weight links: **1,321** accepted WC3.1 formula, **417** rejected as unresolved and **1** superseded governed reference. These are internally audited aggregates only, not a publicly licensed catalogue.
- All accepted WC3.1 formula rows are tied to section weight standard `EN10219`; **zero** cross-standard formula links; no invalid/missing geometry or nonpositive weights in accepted WC3.1. **74** items have no `geometry_candidate_key`; these must not be force-resolved without trustworthy evidence. The check on declared keys in accepted links found **0 mismatches**.

## Repeatable SQL probe

[`supabase/audits/supa_ledger4e_private_price_weight_readonly.sql`](../../supabase/audits/supa_ledger4e_private_price_weight_readonly.sql) runs SELECT only and returns `area,check_name,passes`. **23/23 assertions passed** on connected Supabase production on 21 October 2026.

The script is not under `supabase/migrations` by design and must never be used as a schema-changing migration. It tests schema and current dataset invariants, not authorization from real JWT claims. Its intentionally conservative coverage prohibits assuming commercial data has an open redistribution license.

## Remaining release gates

1. **No publication** of the private source catalogue or derivatives without verified usage rights and explicit governance approval. The independent public `Crea distinta` calculator remains separate from this internal price list.
2. **Run owner/role/anon negative tests in isolated staging** for visibility of list, version, items, components, discounts, price rules, storage source PDFs and public RPCs. Audit all mapped routes; don't weaken RLS for a screenshot.
3. A clean rebuild must prove **generated geometry key vs historical explicit insertion**, as well as earlier [SUPA-LEDGER4D](supa-ledger4d-knowledge-technical-catalog.md) structural catalog and golden target differences. The current catalog check is no substitute.
4. **Global [#780](https://github.com/ctimaru/steel-sales-ai/issues/780) remains OPEN**: the **17 SQL-token-divergent historical migration names have now all been classified across SUPA-LEDGER4B/4C/4D/4E**, but this **does not** settle version-number drift, 7 ambiguous duplicate local names, 12 repo-only and 36 remote-only names, or official CLI failure from a rejected PostgreSQL password. No bulk `migration repair`/manual history writes.
5. IDENTITY2D PR #799/#801/#803 remain unreleased until migration-history reconciliation and multi-role authorization/visual acceptance. Railway is deferred by the user's direction.

**Exit:** read-only production evidence, documented historical differences and privacy caveat, CI checked, audit-only merge into main.