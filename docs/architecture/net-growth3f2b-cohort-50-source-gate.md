# NET-GROWTH3.F.2B — 50 Industrial Research Candidates · Source, Identity and Preflight Gate

Date: 2026-11-05. This work **completes a pool of 50 distinct candidate company domains**, not an authorized production cohort. The three stacked research manifests now total **10 (F.1) + 21 (F.2) + 19 (F.2B) = 50**. Of these 50, 12 have candidate `producer` role, 38 `processor_service_provider`. All roles are first-party source research, not certified industrial capability.

## New 19-source batch
`services/worker/data/netgrowth3f2b_industrial_research_20261105.json`: 19 different domains and 19 company source claims with HTTPS URL on company-owned domain. They were checked via **read-only** production SQL on 2026-11-05 against six identity inventories: canonical companies, core target leads, governed discovery candidates (including rejected), CC0 entities, licensed entities and suppression/opt-outs. An exact normalized-name comparison in canonical/leads/discovery also returned zero matches. This is a **domain/name screening**, not legal certainty.

Important excluded already-cataloged sites: Corimef (core lead), CPM (discovery), Officine Parolin (discovery), PLAN (discovery), Mecart (canonical) and CMG (discovery). They are not padded into the 50.

## Critical acceptance distinction
- **50/50 domain candidates assembled:** TRUE.
- **50 legally distinct entities, approved first-party reuse rights and technical-role fact review:** NOT YET verified.
- **50 import-ready companies / successful production RPC dry-run:** FALSE. Do not invoke `public.netgrowth3d_stage_industrial`.
- **50 added in Network:** FALSE (production baseline remains **278 canonical + 408 provisional = 686**, subject to fresh readback).

### Identity and source-review holds
1. `dematubi.it`: first party describes DE.MA. DI BALDINI GIANCARLO (VAT 01248890426). A **separate** `dematubisrl.it` first party presents DE.MA. SRL (VAT 02794420428) with a related business/address. Must confirm legal succession/group relation to avoid ambiguous entity identity before intake.
2. `amarossi.it`: first-party corporate PDF indicates Curvatura Tubi Amarossi S.p.A. is subject to direction/coordination of Amarossi 1976 S.r.l.; this may still be distinct, but must confirm the legal entity, VAT and site domain before approval.

New batch candidates remain `legal_identity_status=pending_independent_review`, `source_rights=pending_independent_review`. The existing F.1/F.2 candidates also require the same audit, even where their source domains were distinct. User contact data, account claims, stock, supplier qualification, terms and price are not captured.

## AI-readiness
Each claim has type/product/process/dimension, exact text and `source_url`. These are **source claims**, not verified fit for the buyer's requirements. An AI query for `EN 10219 S355 100x100x6` must treat that combination as **unknown** unless source-backed evidence explicitly establishes it; a company's tube processing and diameter range do not guarantee material, grade, section, thickness or availability. Keep `rfq_allowed=false` for provisional research candidates.

## Next protected gate: F.2C — Legal Identity, Rights and 50-Company Atomic Preflight
- Verify legal identity and group/brand aliases for **each of the 50**, checking P.IVA/official company identity where feasible.
- Independently re-open and assess each source/claim; capture permitted reuse or no-publication.
- Resolve all holds, ensure roles and company type are correct, and eliminate all existing/duplicate legal entities.
- If the eligible count falls below 50, **replenish** using new companies before any write.
- Re-run cross-registry/domain+normalized-name check on the **exact approved candidate array**; only then build import-compatible 50–100 reviewed manifest.
- Complete protected CI F.1→F.2→F.2B, full required gates and provenance audit, service-only transaction with ROLLBACK + independent no-write readback; authorize production once.
- No UI, RLS, SQL migration, user auth, Commerciale, RFQ or automatic publisher change. No automatic partner invitations.

[GitHub #1139](https://github.com/ctimaru/steel-sales-ai/issues/1139) · [Notion F roadmap](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
