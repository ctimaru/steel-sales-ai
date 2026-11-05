# NET-GROWTH3.D — Industrial Expansion & Role-Correct Intake

**State: implementation PR, not a production import. Date: 2026-11-05.**

## Goal and business decision

Scale Smart Steel Sales' corporate Network toward **1,000 unique companies**, in repeatable cohorts of **50–100 true companies per import**. Prioritize Italian steel-tube **traders/distributors**; open a distinct supplier classification pipeline for **steel tube producers** and **tube processing/subcontracting providers**. No UX redesign, no new marketplace claims, no PII or outreach.

**Starting production readback** from NET-GROWTH3.C: **585** discoverable, consisting of **278 canonical + 307 provisional**. Additional companies require a real production post-write readback; discoveries, source reviews and SQL fixtures do not increase this number.

## Critical schema gap discovered

- `private.netfast_discovered_records` already renders `producer` and `processor_service_provider`; the existing view has no reader change requirement.
- `public.network_core_target_leads_proposed_role_check` only permitted `end_user` and `trader_distributor`.
- `private.netcov1_stage_core` also limits roles to those two; `public.netdensity3_seed_first_party` delegates to that function and runs only with `current_user=service_role`.
- **Do not widen the legacy trader/end-user stage function** and risk changing established routes. Instead add `public.netgrowth3d_stage_industrial(jsonb,text)`, a separate `SECURITY INVOKER` RPC with explicit restricted EXECUTE. Change only the table's role CHECK to cover the four existing UI classification values.
- Business semantics: `producer` means it **manufactures steel tubes**; `processor_service_provider` means it **processes steel tubes**, e.g. cutting, bending, coating or chrome-plating for third parties. An agent/reseller is not a factory simply because a group owns a factory. Never label anyone as a verified supplier/buyer without a separate verified lifecycle.

## Security and governance

- The industrial SQL RPC only accepts **50–100**, company-owned HTTPS pages, **7 exact business fields**, `segment=other`, `material_signal=explicit_steel_tube_product`, `role in ('producer','processor_service_provider')` and a `NET-GROWTH3D-...` batch.
- It checks six existing domain catalogs: canonical, core target leads, governed discovery, CC0 structured, licensed feed and suppressed/opt-out domains. Any conflict **fails closed**, including archived, opt-out and previously staged domains. Same normalized legal name in canonical/lead/discovery tables also fails to allow group/alias scrutiny.
- The SQL import is **atomic**: one invalid late item causes the whole batch transaction to fail. It inserts only `status=needs_review` into private-first discovery leads: no canonical companies, RLS grants, verified buyer accounts, invitations, RFQs, license grants or public content publishing.
- Only `service_role` may EXECUTE. `anon` and `authenticated` are explicitly revoked; no `SECURITY DEFINER` endpoint. `service_role` already has INSERT on the target table; do not grant any more table privileges.
- Existing trader route `netdensity3_seed_first_party` remains unchanged and retains its long-proven validation, cross-source preflight and no automatic publication.
- Both new manifest types require `role_evidence_url` and `identity_evidence_url` as first-party links, plus `source_status=first_party_screened`. This means *a public company site was checked*, not legal registration/claim verified.
- The worker has explicit offline `--dry-run`, live read-only `--preflight`, and separate guarded `--apply`. **Research with fewer than 50 records, or with any review hold, can never write**, even by manual dispatch. The importer never scrapes sources or reads private contacts.

## Source review: early research seeds (not imported)

`services/worker/data/netgrowth3d_traders_research_20261105.json`: four sourced **traders**:
- `eurotrade.bg.it` (Eurotrade S.r.l., official first-party 304/316 stainless tubes stock)
- `mecsud.it` (MECSUD 2.0 S.R.L.S., official first-party inox tubes distribution)
- `tubicondotte.it` (Tubi S.n.c., official first-party large-diameter steel water/gas pipeline tubes supply)
- `sicgorizia.it` (SIC S.r.l. wholesale trader in Gorizia, official page confirms mechanical, structural and commercial EN 10210/10219 tubes)

`services/worker/data/netgrowth3d_industrial_research_20261105.json`: four distinct business-only sources:
- `profiltubi.it`, **producer**, official site claims HF electric-resistance-welded carbon steel tube production in Reggiolo. `profiltubi.com` is a separate, already listed Rome distributor; cross-check the different legal entities before final approval.
- `eurocromo.net`, **processor_service_provider**, official site states grinding and chrome-plating of steel tubes and bars.
- `inpipe.it`, **producer**, official factory site states welded round stainless/alloy tube production made-to-order in Piozzano.
- `tubisteelsrl.com`, proposed **producer**, official source search describes stainless welded tube manufacturing but direct automated site verification was blocked: deliberately on `review_hold_domains`. Do not clear until a primary source is re-confirmed.

These **eight** early research identities are NOT the 50–100-company import, NOT verified legal entities/accounts, and NOT new production records. Some websites are inaccessible to automatic reading; do not infer absence or false identity from a timeout. Grow the first trader research file from 4 to at least 50 **fully documented unique official sources** with accurate role and legal identity; continue industrial independently. Check every potential company against production six-register dedup and the normalized legal-name guard. On an existing canonical record or lead, do not re-import the business under an alias domain.

## Tests and release

- Python: `services/worker/tests/test_netgrowth3d_role_correct.py` asserts role segregation, official HTTPS identity/role sources, duplicate/hold failures, sub-50 write rejection, no-write offline research, and a 50-record synthetic schema fixture.
- SQL: `supabase/tests/netgrowth3d_role_correct_intake.sql` runs in `BEGIN ... ROLLBACK`; validates anon/auth rejection, service-only grant, invoker security, atomic failure on item 50, correct retention of 25 `producer` and 25 `processor_service_provider`, provisional view visibility, and no canonical publication.
- GitHub Action `netgrowth3d-role-correct-intake.yml` is **manual-only**, on `main`, requires a selected manifest, `apply=false` by default. It uses existing production service-role secret only for `--preflight` and explicit `--apply`.
- **Protected CI P0/SQL & FLOW1** before merge; migration must land through the same reviewed deploy process (no manual live schema shortcuts). Respect **one ready Vercel production deployment per day**, frontend path guard and avoid another UI deploy.
- First approved complete trader cohort: mandatory live read-only preflight; select manual `apply=true`; then independent production SQL readback of published/provisional/batch distinct domains and source roles. Do not claim growth until committed and visible.
- After traders, expand industrial cohorts as independent import transactions with role verified from each company's own descriptions, never downcast `producer` or `processor_service_provider` to trader to satisfy a legacy constraint.

**Remaining goal from current production baseline: 415 unique companies.** A 50-company first import would reduce the gap to 365, but only after actual database insertion; not in this PR.
