# NET-GROWTH3.E — Role-correct Industrial Expansion (first 50)
Date 2026-11-05. The first mixed industrial cohort is **10 tube producers** and **40 tube-processing subcontractors**. Source of truth: `services/worker/data/netgrowth3e_industrial_cohort_20261105.json`.

## Role and source model
- All 50 have first-party company-owned HTTPS product/work page evidence; role evidence and identity link. No personal contacts, email/phone, PII, claim, connected account, offers or automated invitations captured.
- `producer`: manufacturing steel tubes including welded carbon steel, stainless, precision, drawn, and special tubing. `processor_service_provider`: independent tube processing such as tube laser cutting, bending, profiling, rolling, chrome/finishing or industrial subcontract fabrication. Both are industrial roles, **neither is silently relabelled `trader_distributor`**.
- Self-published industrial-service claims are evidence of offered services, **not legal proof of incorporation, quality certification or verified supplier eligibility**. All new records remain `needs_review` and must not be counted as verified producers or supplier partners.
- Excluded existing entities already present in any six Network registries including Acciaitubi, Alessio Tubi, Marcegaglia, Padana Tubi, Tubificio del Friuli, Tecnocurve, CMM Laser and many others. Also excluded direct `tubisteelsrl.com` because source retrieval is still blocked; it remains in the original research manifest with HOLD, not this approved cohort.
- Avoid counting group brand sites, sister-company websites and subsidiaries as different legal companies without independent identity evidence. The source and legal-name audit is a prerequisite to each import.

## Gates and scope
- Use existing, already migrated **`public.netgrowth3d_stage_industrial(jsonb,text)`** (`SECURITY INVOKER` and service-role execute only), contract `netgrowth3d-industrial-atomic-v1`. No additional database migration, no RLS expansion, no frontend, School, Commerciale or RFQ changes.
- Its batch key retains prefix `NET-GROWTH3D-` required by the deployed SQL contract: `NET-GROWTH3D-IT-INDUSTRIAL-20261105-B`. This is intentional **contract compatibility**, though the feature milestone is NET-GROWTH3.E.
- Offline tests validate exact 10/40 roles and 50 distinct first-party domain/company keys, zero holds, no trader role leakage, no unsafe source hosts, no sub-50 or held write, no write during dry-run.
- Read-only live preflight must screen **six registries**, plus normalized legal names in canonical/lead/discovery. Transactional production RPC proof must use `BEGIN; SET LOCAL ROLE service_role; ...; ROLLBACK;` and independently confirm no changes.
- Only after PR P0 and FLOW1 SUCCESS on the final head, protected main merge and unchanged 50 reviewed records may a single governed RPC import be committed. No direct table inserts; no blind retries.
- Baseline before this candidate cohort: **278 published canonical + 357 provisional visible = 635**, 559 core leads. If 50 new records commit and appear in `private.netfast_discovered_records`, the **conditional** goal is **685**; do not claim it until verified with independent readback: 50 `needs_review`, 10 producers + 40 processors, distinct domains and visibility; canonical unchanged.
- Vercel ignore/canceled frontend deployment may persist because this PR changes no `apps/web` files. Database reader readback is not proof of authenticated public UI visual acceptance.
