# NET-COV1 — End-User & Trader Network Density

## Why this is core
Oct 16 2026: 31 published Italian Network profiles, 15 processors, 10 producers, 10 traders and **zero end users**. Existing 162 discovery candidates contain **zero** candidates whose classifier has the role `end_user`; scanning the old queue cannot fill this gap. The issue is acquisition, not SEO or map UX.

## Product scope
- Separate research lead pool for industrial firms whose **first-party company product website** documents a steel-tube-bearing finished product.
- Batch dedup against both Network companies and discovery candidates; never create a public company or new crawler candidate merely by placing a lead on the target list.
- Internal Platform queue `/platform/company-discovery/end-users`: KPI, evidence source links, a short form for new prospects, and up to 40 leads per explicitly attested human review decision.
- `ready_for_crawler` means the research lead is eligible for *possible later* authorized discovery, **not** a verified buyer, contract relationship, published profile or confirmed purchase of steel tubes.
- Optional bridge to the existing governed source registry and crawler **only if** a separately reviewed and enabled source has documented reuse rights and an authenticated Platform operator deliberately enqueues it. This creates a domain lead `pending_review`; source run linkage and company publication remain separate.
- No crawler schedule or rights override was silently introduced. Existing Free and Pro Network, marketplace and review gates unchanged.

## Initial first-party 2026 cohort (for research review; never auto-publication)

| Target | Product evidence | Signal | Vertical |
|---|---|---|---|
| Pedrali | https://www.pedrali.com/it-it/prodotti/sedie-design/kuadra-1151 | Finished chair with Ø16 mm steel tube legs | Furniture |
| EMU Group | https://www.emu.it/p/sgabello-giardino-esterno-acciaio-riviera-436/ | Steel Fe360 tubular chair frame | Furniture |
| SCAB Design | https://www.scabdesign.com/image/data/prodotti/chairs/si-si%20barcode/Scheda%20tecnica/SCAB_TS_si-si_barcode.pdf | Product technical PDF details Ø20 mm tubular-steel frame | Furniture |
| Metalco | https://www.metalco.it/product/ciclos-portabici-urbano-acciaio/ | Finished bicycle stand made with tubular steel | Urban furniture |
| Magis | https://www.magisdesign.com/product/substance-chair-and-armchair/ | Finished chair with powder-coated steel tube frame | Furniture |
| GBM Building Equipment | https://www.gbmitaly.it/ponteggi/perni | Finished scaffold uses S235JR steel tube | Scaffolding |
| Arper | https://www.arper.com/en_GB/blog/technology-for-the-senses.html | Official product manufacturing note on hydroformed steel tube legs | Furniture |
| RIMA | https://www.rimaspa.com/prodotti/componenti-agri/ | Industrial equipment and hydraulic cylinders; steel-tube feedstock **not yet confirmed**; must be researched separately | Agricultural equipment |

Research records reflect declared products, **not verified procurement**, relationship or commercial intent. RIMA remains unqualified for crawler readiness until direct material evidence is obtained.

## Technical trust boundaries
1. First-party HTTPS evidence host must exactly match the normalized source company domain; URL cannot include credentials, private address or suspicious content. No arbitrary external directory proof.
2. SQL Core staging is private SECURITY DEFINER in private schema; public RPC wrappers remain SECURITY INVOKER. Service cohort seed can never review or publish.
3. Every manual Platform cohort approval needs `discovery.governance_review`, a nontrivial reason, a real `auth.uid()`, explicit attestation, and a first-party steel-tube material signal. Existing company and crawler-candidate duplicate checks run again before review.
4. Bridge to crawler requires `discovery.run` **and** governance permission plus an independently approved, enabled, properly rights-attested source registry entry. Wikidata is explicitly not a source for arbitrary first-party inputs.
5. Source discovery run permissions, intake, review and publication are left to their existing gated flows. Avoid claiming any increase in published Network companies until independently verified.
6. Platform queue includes no personal contacts, RFQs, tenant Company Memory or unreviewed public claims. Batch ledger and targets have RLS and deny client access.

## Commercial rollout and KPIs
Track separately `research targets`, `ready_for_crawler`, `crawler leads`, `discovery candidates`, `published end_user profiles`, `registered active users`. The first success is **a live pipeline of 8 research targets**, not eight added companies.

Next core priorities: NET-COV2 verified source review + run a permitted worker crawl for qualified target domains; NET-UX5 company profile growth; NET-UX6 bilateral connections; NET-UX9 RFQ bridge. Batch manual visual QA into later releases.
