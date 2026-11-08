# NET-RO1.GROWTH8.B — Romania: first industrial end users, one protected wave

**State:** proposed protected data release. User authorized one full end-to-end publication. This PR's SQL migration is **definition-only**; the explicit service-role publish step comes only after successful CI and a real 17/17 preview.

## Objective

Increase Romanian company profiles from **171 → 188** in one atomic operation with **11 end users**, **5 metalworking service providers**, **1 welded steel tube producer** (MAIRON TUBES). Preserve existing role filters, country map, Romania SVG flag and "Rivendica azienda" model. No UI-only cosmetic changes, no outbound messages.

The goal is a source-backed industrial directory, not a verified steel-tube procurement database. A manufacturing business being an industrial end-user DOES NOT confirm it buys EN 10219 hollow sections or is ready to receive RFQs.

## Pinned 17

Publisher: `supabase/migrations/20261108131500_net_ro1_growth8b_end_users17_publisher.sql`.

The company domain, proposed role, original research lane and research_id are pinned individually. 16 have `batch_key=NET-RO1-G8-NEW25` and web-ready review; the seventeenth is MAIRON TUBES (`NET-RO1-026`) after official corporate evidence update.

### Why the category is grounded

End users include fabricators of agricultural trailers and equipment (OEHLER, AGROJET), railway rolling stock (ASTRA Vagoane, REVA, Uzina Vagoane Aiud), transport and trailer body manufacturers (Ereste Star, AXER), metal furniture and sheet-metal product manufacturers (Comerpan, MET Timișoara), industrial machinery/large welded structures (UMEM) and railway infrastructure equipment (ISAF). Their source URLs are held in the private research seed and in the final company source assertion; specific tube purchases are explicitly unverified.

Five processors: CHIULAN, Dual Man, NIMB CONSMETAL, ReNiCo Ind and SSAB-AG. Their web evidence supports structural metalwork and fabrication roles but not specific EN grades, machinery lists, audited capability or RFQ authorizations.

MAIRON TUBES is listed as a distinct producer with welded round/square/rectangular tubes in MAIRON's corporate catalogue: https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf. Its source evidence supports ONE proposed `tubes_pipes` product-family relationship (`produces`). No certifications, grades, production capacities, stocks or lengths are asserted.

## Evidence, safety and acceptance

1. Production preflight **read-only** on exactly 17 candidates confirmed 17 distinct domains and research IDs, 0 invalid source/status, 0 missing active role, 0 canonical-domain/normalized-name public or private collisions, 0 opted-out/suppressed, 0 prior publication crosswalk. Baseline: **171 public RO**, **281 private RO research**.
2. P0 Required Gate must pass against the final PR head; ancillary FLOW1 Chrome is inspected separately and any failure documented. GitHub branch rules must not be bypassed. No extra frontend deployment is necessary for a SQL-only merge.
3. Apply the migration via established Supabase migration tool; **no public inserts happen on function creation**. Check `anon` and `authenticated` cannot EXECUTE the function; `service_role` can.
4. Explicit preview:
   ```sql
   SELECT private.network_ro1g8b_publish_wave17(false) AS preview;
   ```
   Require `status=preview_only`, `eligible=17`, `suppressed=0`, `created_now=0`, `new_end_users=11`, `new_processors=5`, `new_producers=1`, `already_public_ro_expected=171`, `expected_total_public_ro=188`, `requires_explicit_commit=true`. ANY baseline drift, new duplicate, invalid source, role or opt-out aborts the entire wave.
5. With explicit user authorization (already supplied in current conversation) and ONLY after the exact preview:
   ```sql
   SELECT private.network_ro1g8b_publish_wave17(true) AS publication_result;
   ```
   One locked, atomic transaction with idempotency on wave links. **Do not publish the previous GROWTH8 research migration again**, and do not call historical WEB20/BULK122/GROWTH7 functions.
6. Independent readback:
   ```sql
   SELECT count(*) FROM public.network_companies
   WHERE country_code='RO' AND publication_status='published' AND archived_at IS NULL;
   SELECT count(*) FROM private.network_ro14c_publication_links
   WHERE publication_wave='NET-RO1.GROWTH8.B-WEB17';
   ```
   Expected: **188** Romanian public company profiles, **17** wave ledger links, **17** distinct new company domains, **17 published/unclaimed/unverified**, **11 end-user primary assignments**, **5 processors**, **1 producer**, **17 source assertions**, **1 MAIRON sourced product relationship**, **0 new owner-claims/certifications**, **281 unchanged private research seeds**.
7. Re-run `...publish_wave17(false)`; expected `already_published, created_now=0`. Check the role-filtered Romania Network and the country ticker on desktop and 320/390px mobile if an authenticated browser is available. SQL readback is not a screenshot/visual sign-off; keep those statuses distinct.

## Deliberately excluded

All **9** GROWTH8.A new held candidates are excluded, including `didicom.ro` (website-integrity concern), INTERPIPE (multinational legal mapping), Variant Profile (non-tubular profiles), Dacia, Greenbrier Europe, JPX/REPO and industrial-fit review. The pre-existing cross-border same-domain Tenaris and Van Leeuwen candidates likewise remain held.

After this wave, 281 research records minus 188 public-domain matches = **93 outstanding historical/new research records** (includes two cross-border global-domain collisions), assuming no concurrent changes. Their reconciliation and new lead sourcing should continue in grouped waves. Public profiles are claimable but not verified owners. No compulsory visura for a source-backed minimal directory card.
