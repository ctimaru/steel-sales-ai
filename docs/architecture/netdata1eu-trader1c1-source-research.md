# NETDATA1-EU TRADER1C.1 — European Trader Research Expansion
**2026-10-20 — repository-only until issue #771 allows a reviewed Supabase rollout.**

15 first-party source-observed candidates added as an independent batch.
Target: **35/60 dossier in GitHub** (20 previous + 15 new), **not** 35 unique verified businesses, **0 newly published**.
25 dossiers remain for TRADER1C.2. All company legal identity, scope and publication rights await human review. `source_rights=not_assessed`; `identity_hold` on holding/mixed manufacturer records. Websites cannot authorize bulk reuse merely by being public.

| Research label | Market | First-party product/role evidence |
|---|---|---|
| Ferona a.s. | CZ | https://online.ferona.cz/ |
| Weyland | AT | https://www.weyland.at/produkte/stahl/rohre/ |
| BE Group | SE | https://www.begroup.com/about-be-group/products-and-services |
| STALPROFIL S.A. | PL | https://www.stalprofil.com.pl/dystrybucja |
| rff Rohr Flansch Fitting | DE | https://www.rff.de/de/unternehmen/ |
| Klöckner & Co | DE | https://www.kloeckner.com/en/ |
| Lemvigh-Müller | DK | https://www.lemu.dk/da/viden-inspiration/udvalgt-sortiment/staal-og-metal |
| Damstahl a/s | DK | https://www.damstahl.com/en/shop/stainless-steel-66370/tubes-82979/ |
| Arabesque | RO | https://arabesque.ro/public/servicii/portofoliu-complet |
| Heiton Steel | IE | https://www.heitonsteel.ie/product-category/tube/unpainted-square/ |
| STAPPERT Fleischmann GmbH | AT | https://fleischmann.stappert.biz/ |
| MAIRON Group | RO | https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf |
| Tibnor | SE | https://www.tibnor.se/stal/stalror/konstruktionsror/c/50_r%C3%B6_kr |
| Stena Stål | SE | https://www.stenastal.se/vad-vi-erbjuder/stal/ror/ |
| Hierros Gil | ES | https://hierrosgil.com/producto/tubos-din-2440/ |

## Location assertions
Only source-observed **private** cities, not live facilities, legal domicile or automatic NUTS:
- CZ Prague office — https://www.ferona.cz/ferona-a.s
- SE Malmö office — https://www.begroup.com/contact
- PL Dąbrowa Górnicza warehouse — https://www.stalprofil.com.pl/dystrybucja
- DK Kolding warehouse — https://www.lemu.dk/da/kontakt/find-os/centrallagre
- DK Skanderborg office — https://www.damstahl.com/en/contact/
- RO Brașov warehouse — https://arabesque.ro/public/depozite-si-magazine-arabesque
- IE Dublin office — https://www.heitonsteel.ie/
- AT Teesdorf office — https://fleischmann.stappert.biz/
- SE Göteborg office — https://www.stenastal.se/om-oss/kontakta-oss/

## Dedup and safety
- Production read-only canonical/discovered/leads check found **0 exact-domain collisions across 15** before preparing this batch. Group-level entities still require reconciliation, especially BE Group, STAPPERT, Tibnor, Damstahl, Klöckner, Mairon.
- Do not conflate production (MAIRON, others) with distribution; `trader_distributor` remains a researched candidate, never verified automatically.
- Sites for excluded candidates in this wave, particularly industrial hose specialists, should not be construed as structural steel tube distributors.
- SQL requires migrations `20261020160000`, `20261020160500`, `20261020161000` in order; this file `20261020161500` comes last.
- If authorized DB rollout completes all 4 batches: expect **35 private research records and 19 private place observations** (10 previous + 9), no public company or facility mutations. Baseline live public network must be checked independently.
- Issue #771 remains open until audited service-role staging, grants and reference rights are reviewed.
