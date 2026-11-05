# NET-GROWTH3.F.1 — First-party Industrial Evidence Seed (Research Only)

**Observed:** 2026-11-05 · [GitHub tracking #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).

## Scope

This commit adds **10 domain-screened Italian research candidates**, not 10 new public profiles and **not** a 50–100 company import batch. Five source sites describe actual steel tube production and five describe tube-processing services. Each technical claim carries its own company-owned URL. There are zero new account claims, buyers, quotes, company publications, invitations or production writes.

The authoritative research dataset is `services/worker/data/netgrowth3f_first_party_research_20261105.json`. It is intentionally **not compatible** with the 50–100 atomic production RPC: the object contains candidate evidence, a research-only mode, and no valid production batch key.

## What was checked

1. First-party industrial pages were manually screened for evidence; no norms, materials, manufacturing roles or dimensions were inferred from a company name.
2. Direct Supabase **read-only** checks on 2026-11-05 found **zero domain collisions across six registries** for these ten domains: `network_companies`, `network_core_target_leads`, `network_company_discovery_candidates`, `network_netfast2_structured_entities`, `network_netfast3_entities`, `network_netfast3_suppressed_domains`. Exact normalized company name checks on canonical/leads/discovery also found no match for the proposed names.
3. No independent legal register check has been completed. Legal identity, first-party source usage rights, group/sister-company aliases, and industrial role classification require renewed review immediately before any future 50–100 batch.
4. Never confuse company self-reported product capability with independent certification, audited production capacity, reliable stock, commercial participation or supplier qualification.

## Three queues, not one

- **Net-new research** (10 candidates): source-backed technical evidence is recorded but no company row is created.
- **Existing enrichment** (3): `tubi-spa.com` and `offborsari.it` were already canonical; `ati-italia.com` already existed in discovery. Route source evidence to existing identity review, never create duplicates.
- **Manual holds** (3): `arvedi.it` is shared across group/legal entities and was previously rejected; `metaltubispa.it` belongs to a business described by the group as *commercialization and cutting*, not automatically a tube manufacturer; `fasb2.it` appears with malformed rejected legal names. No import/promotion for holds.

## AI-readiness: evidence is structured, not invented

Each research record carries `role`, `claims[]` with `type` / `value` / `url`, `evidence_status`, `legal_identity_status`, and `rights_status`. Norms such as EN 10219 or EN 10305 appear **only** where the official product page states them. A missing standard/steel grade/diameter/maximum thickness stays unknown; the AI must not infer availability from capability or send RFQs to unverified, non-member companies.

## Release gates before any actual import

- Collect at least 50 **genuinely new legal entities** in an exact reviewed 50–100 manifest; do not pad with the 3 existing records or 3 holds, and do not reuse the already-committed NET-GROWTH3.E batch.
- Resolve legal aliases/group identity, rights and opt-outs, then repeat six-register and name dedup with production data.
- Offline tests + service-role transactional preflight with explicit `ROLLBACK`, readback zero writes; protected PR with P0 and FLOW1 green.
- One governed atomic production RPC write only after protected merge and authorization; independent batch readback and separate 320/390/1440 authenticated browser acceptance.
- Keep the global publisher OFF; do not modify Network UI, School or Commerciale for F.1.

**Baseline recorded in research:** 278 canonical published + 408 provisional = 686 discoverable in database reader on 2026-11-05; this can change and must be reread before each batch.
