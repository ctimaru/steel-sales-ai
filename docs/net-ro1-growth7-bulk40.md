# NET-RO1.GROWTH7 — Romania 131 → 171, one controlled 40-company wave

**Status (2026-11-08): PREPARED IN PR, NOT PUBLISHED.**

## Goal / founder direction

Continue expanding Smart Steel Sales's claimable Romania Network with first-party online sources, prioritizing **producers and steel subcontractors** over general retailers. No blanket company-register requirement for an unverified minimal sourced profile. Do not count research records as already-public directory companies.

**Production baseline (read-only):**
- **131** published RO company profiles, **256** private research records (including existing published seed sources).
- **125** research leads had remained outside the public directory. This wave pins **40** of them; **85** remain for review or identity reconciliation if no other changes occur.
- Distribution for this wave: **2 proposed producers, 26 industrial processors, 12 traders**.
- The source-backed role is provisional. Published profiles must remain **unclaimed/unverified**, with an owner claim CTA and no inferred standard, capacity, stock, price, certification or RFQ permissions.

## First-party spot-checks

The current public sources support some representative industrial use cases:
- **EST METAL CAB**, `estmetalcab.ro` — describes an operating zinc-coated rectangular tube production line and steel fencing products. Source: https://www.estmetalcab.ro/despre-noi/
- **Girometal**, `girometal.ro` — site presents welded round/square/rectangular steel tube offerings and describes manufacture from sheet. Source: https://girometal.ro/. Proposed producer role remains owner-unverified.
- **ROMNEF**, `romnef.com` — steel pipes and mechanical pipe/profile cutting services: https://romnef.com/mechanical-cutting.html.
- **STEEL PROFILE**, `steelprofile.ro` — CNC tube/bar bending, mechanical cutting and welding: https://steelprofile.ro/en/services/.
- **MM Industry**, `mmindustry.ro` — tubes, welded hollow profiles and metal long-product catalog: https://mmindustry.ro/en/products.html.
- **Adiana Com**, `adianacom.ro` — online EN 10219 S235 tube sales, as *trader* rather than tube mill: https://adianacom.ro/produs/teava-rectangulara-otel-60x40x2-mm/.
- **COMELF**, `comelf.ro` — industrial steel fabrication and profile cutting: https://comelf.ro/en/dotari-tehnice/. No assumption of tube manufacturing.

Other entries have the first-party web source and review lane preserved in the 40-company pinned SQL manifest; broad steel processors without explicit tube evidence remain **company/role searchable without tube-product classification**.

## Protected database operation

Migration: `supabase/migrations/20261108110000_net_ro1_growth7_bulk40.sql`.

It defines `private.network_ro1g_publish_bulk40(p_commit boolean default false)` and **does not insert records when installed**.

Safety conditions before publish: existing Romania public baseline exactly **131**; exactly **40 pinned unique domains**, matching **roles AND original review lanes**; source kind first-party, URL HTTPS, nonempty name/summary, research unclaimed/unverified/not-published, active role, no domain/name collision with public records, no normalized-name collision in private research, no suppression/opt-out, no previous crosswalk. New tube family assignments are deliberately limited to a vetted subset of 15 source-backed domains, rather than guessed from vague steel activity.

Single-wave sequence after green CI + owner-approved release window + live browser visual acceptance:
```sql
-- After applying the migration through the approved protected migration process:
SELECT private.network_ro1g_publish_bulk40(false) AS preview;
-- Require status preview_only, eligible=40, suppressed=0, created_now=0,
-- already_public_ro_expected=131, expected_total_public_ro=171.

-- Only then, explicitly authorize and run exactly once via privileged connection:
SELECT private.network_ro1g_publish_bulk40(true) AS publication_result;
```
The operation locks the canonical directory for a single atomic transaction and uses existing `private.network_ro14c_publication_links` as crosswalk, tagged `NET-RO1.GROWTH7-BULK40`. User roles `anon`/`authenticated` are **not granted execution**.

Readback:
```sql
SELECT count(*) FROM public.network_companies
WHERE country_code='RO' AND publication_status='published';
SELECT count(*) FROM private.network_ro14c_publication_links
WHERE publication_wave='NET-RO1.GROWTH7-BULK40';
```
Target **171 public, 40 new-wave crosswalk entries**, all newly published unclaimed/unverified, no owner claims/certifications auto-generated. Verify the Network rendered count and one profile on desktop + small mobile. Never publish if preview differs.

## Avoid duplicate manual work

Do **not** replay NET-RO1.4.E BULK122 or the old D WEB20; both waves already completed or superseded. The next growth wave should consolidate the **85 remaining exceptions** and acquire **new web-first producer/processor leads**, using claim → enrichment → verification. The explicit identity/alias holds and multinational shared-domain cases stay private until correctly modelled, not auto-imported as extra legal companies.

**No publish/merge or production deploy in this preparatory PR until guarded acceptance.**
