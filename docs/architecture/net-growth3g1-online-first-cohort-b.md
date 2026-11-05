# NET-GROWTH3.G.1 — Second online-first 50-company cohort (Nov 5, 2026)

## Production result (independently observed, not just research)

**Target achieved: 736 → 786 directory backing records.** This is **278 canonical published + 508 provisional**; the prior state was 278 + 458. The batch `NET-GROWTH3D-ONLINE-20261105-B` was inserted through the already deployed `public.netgrowth3d_stage_industrial` using a 50-record, all-or-nothing service-role RPC. A separate **ROLLBACK** preflight on the same payload returned 50 accepted, 0 duplicate, 0 invalid, 0 published. A later protected **COMMIT to staging** returned the same counts.

Subsequent readback verifies 50 `public.network_core_target_leads` rows with `needs_review` status, 50 unique domains, **1 tube producer** and **49 tube processors/subcontractors**, alongside **50/50 corresponding provisional directory rows**, roles matched.

**This is NOT the same as 50 newly canonically published or verified suppliers.** Directory provisional records remain `unclaimed`, `unverified`, `unconfirmed`; do not imply active stock, ability to supply an RFQ, or a genuine relationship.

## Source and duplicate logic

We researched Italian business-operated sites for steel/metal tube production and laser cutting, bending, calendering and CNC subcontracting. We compared each selected domain **and exact normalized company name** across six production registries: canonical, core-target leads, discovery, structured licensed/CC0 sources and suppressed domains. 50 passed the exact checks before the test and staging. This is not a guarantee against all legal-group aliases; such issues remain remediable via moderation and owner claim.

The list contains **1 producer and 49 processors**. Prioritize new producers and traders as the next tranche so the Network doesn't overrepresent fabricators. Some pages are from company blogs or broader process sections and their specific technical claims remain unverified; use only the conservative one-sentence source-led summaries. No mandatory corporate visura, no implied copyright permission on company catalogs, no personal contact harvesting.

## Claim-first product journey

Every provisional card should present a compact name, web URL, short sourced industrial summary, source/capture date, label **“Non rivendicata · Dati da fonti pubbliche”**, and a single **“Rivendica azienda”** call to action. The owner must demonstrate control before changing company-only data, and may then add technical capabilities, actual standards, products, certifications, supported dimensions and commercial contact preferences.

AI must distinguish: `public_web_sourced_company` vs `owner_claimed_profile` vs `independently_verified_supplier`. Do not use the original source claim to infer S235/S355, EN 10219, pricing, stock, terms, production capacity or genuine verified readiness.

No UI changes, new deployment or canonical publishing occurred in this batch. GitHub documentation PR is stacked on G (#1149), separately controlled by worker/required CI.

## 50 captured sources

| Company | Domain | Proposed industrial role | Source |
| --- | --- | --- | --- |
| Aldegani | aldegani.it | processor_service_provider | [first-party](https://aldegani.it/prodotti/taglio-laser-tubi/) |
| AR.MET S.r.l. | armetsrl.it | processor_service_provider | [first-party](https://armetsrl.it/tecnologie-e-servizi/laser-tubo/) |
| Arredometallica | arredometallica.eu | processor_service_provider | [first-party](https://www.arredometallica.eu/) |
| Carpenteria Sinergy | carpenteriasinergybologna.it | processor_service_provider | [first-party](https://www.carpenteriasinergybologna.it/lasertubo-gallery) |
| Sorti Flaminio | carpenteriasorti.com | processor_service_provider | [first-party](https://carpenteriasorti.com/curvatura-tubi/) |
| Cazzin S.r.l. | cazzinlavorazionelamiere.com | processor_service_provider | [first-party](https://www.cazzinlavorazionelamiere.com/lavorazioni/taglio-laser-lamiere-tubi/) |
| Cerri S.r.l. | cerrisrl.it | processor_service_provider | [first-party](https://cerrisrl.it/) |
| C.M. Carpenteria | cmcarpenteria.com | processor_service_provider | [first-party](https://www.cmcarpenteria.com/taglio-laser-tubo.php) |
| Dimensione Laser | dimensionelaser.it | processor_service_provider | [first-party](https://www.dimensionelaser.it/) |
| Fratelli Ferrara S.r.l. | fratelliferrara.org | processor_service_provider | [first-party](https://fratelliferrara.org/) |
| FROM S.r.l. | fromsrl.it | processor_service_provider | [first-party](https://www.fromsrl.it/index.html) |
| Gaddi Sergio S.n.c. | gaddisergiosnc.it | processor_service_provider | [first-party](https://www.gaddisergiosnc.it/servizi) |
| Galati S.r.l. | galati.it | processor_service_provider | [first-party](https://www.galati.it/taglio-tubi/) |
| Galdiolo S.a.s. | galdiolo.com | processor_service_provider | [first-party](https://www.galdiolo.com/taglio-laser-tubi-a-venezia/) |
| Giorni Ferdinando & Roberto S.p.A. | giorniferro.it | processor_service_provider | [first-party](https://www.giorniferro.it/lasertubo.html) |
| GM Meccanica | gmmeccanica.com | processor_service_provider | [first-party](https://www.gmmeccanica.com/lavorazioni-curvatura-tubi/taglio-laser-tubi/) |
| Metallbau Gobbi | gobbi-laser.it | processor_service_provider | [first-party](https://www.gobbi-laser.it/it/taglio-laser/) |
| G.Z. Trasformazione Lamiere | gzsrlud.it | processor_service_provider | [first-party](https://www.gzsrlud.it/cutting-tubes-gallery) |
| HRK Zanon | hrkzanon.it | processor_service_provider | [first-party](https://www.hrkzanon.it/lavorazioni/taglio-laser-tubi/index.html) |
| IMG S.r.l. | imgsrl.it | processor_service_provider | [first-party](https://www.imgsrl.it/piegatura-reggio-emilia/) |
| Officine Impero | impero1979.com | processor_service_provider | [first-party](https://impero1979.com/taglio-lasertubo/) |
| John Metal Work | jmwsrl.it | processor_service_provider | [first-party](https://www.jmwsrl.it/lavorazioni/taglio-laser-tubo/) |
| Lasemilia S.r.l. | lasemilia.it | processor_service_provider | [first-party](https://www.lasemilia.it/) |
| Carpenteria Manessi | manessi.it | processor_service_provider | [first-party](https://www.manessi.it/produzione-carpenteria-metallica/taglio-laser-tubi/) |
| Max Assemblaggi | maxassemblaggi.com | processor_service_provider | [first-party](https://www.maxassemblaggi.com/servizi/piegatura-curvatura-tubi.html) |
| MECC Carpenteria | mecc-carpenteria.it | processor_service_provider | [first-party](https://mecc-carpenteria.it/lavorazioni/curvatura-tubo) |
| M.M. Montanari Massimo S.r.l. | mmtubi.it | producer | [first-party](https://www.mmtubi.it/) |
| Motta & Rossi | mottagroup.net | processor_service_provider | [first-party](https://www.mottagroup.net/it/curvatura-piegatura-rastrematura.php) |
| Nova Tek S.p.A. | novatek-spa.com | processor_service_provider | [first-party](https://www.novatek-spa.com/lavorazioni-di-precisione-su-qualsiasi-tubazione-casaloldo-mn/) |
| Nuova Inox S.r.l. | nuovainoxsrl.it | processor_service_provider | [first-party](https://nuovainoxsrl.it/lavorazioni/) |
| Officine GSP | officine-gsp.it | processor_service_provider | [first-party](https://www.officine-gsp.it/it/lavorazioni) |
| Officine Mattiello | officinemattiello.it | processor_service_provider | [first-party](https://www.officinemattiello.it/piegatura-lamiera-profilati-tubi) |
| OGB S.r.l. | ogb.it | processor_service_provider | [first-party](https://ogb.it/service/taglio-laser-tubi-metalli-inox-acciaio-ferro-rame-ottone/) |
| Ommec Moderna | ommecmoderna.com | processor_service_provider | [first-party](https://ommecmoderna.com/ommec/taglio-laser-tubi/) |
| Paluan Carpenteria | paluancarpenteria.com | processor_service_provider | [first-party](https://www.paluancarpenteria.com/reparto-laser-tubo) |
| Piping System S.r.l. | pipingsystemsrl.it | processor_service_provider | [first-party](https://www.pipingsystemsrl.it/lavorazioni/) |
| RCM Center | rcmcenter.com | processor_service_provider | [first-party](https://www.rcmcenter.com/2023/05/10/tubi-e-profili-metallici-come-lavorarli/) |
| Ricos S.r.l. | ricos.it | processor_service_provider | [first-party](https://ricos.it/curvatura-tubi/) |
| Rollo Massimo Costruzioni Meccaniche | rollomec.it | processor_service_provider | [first-party](https://www.rollomec.it/it/taglio-laser-tubo) |
| S.C.M. Riolo Terme | scmriolo.it | processor_service_provider | [first-party](https://www.scmriolo.it/le-lavorazioni) |
| SirolMec | sirolmec.it | processor_service_provider | [first-party](https://www.sirolmec.it/curvatura-tubi/) |
| Steller S.r.l. | steller.it | processor_service_provider | [first-party](https://www.steller.it/macchinari-lasertube/) |
| StoX S.r.l. | stox.it | processor_service_provider | [first-party](https://www.stox.it/lavorazioni/deformazione/curvatura-manuale-cnc/) |
| Sun Mac | sun-mac.it | processor_service_provider | [first-party](https://www.sun-mac.it/lavorazione-tubi-in-lombardia/) |
| Taglio Laser Sicilia | tagliolasersicilia.it | processor_service_provider | [first-party](https://tagliolasersicilia.it/) |
| Tecnotubi S.r.l. | tecnotubi.eu | processor_service_provider | [first-party](https://www.tecnotubi.eu/it/lavorazioni/taglio-laser) |
| Toscana Metalli | toscanametalli.it | processor_service_provider | [first-party](https://www.toscanametalli.it/macchinari) |
| Unifer S.r.l. | unifer.net | processor_service_provider | [first-party](https://www.unifer.net/lavorazioni/) |
| Wolfsgruber | wolfsgruber.it | processor_service_provider | [first-party](https://www.wolfsgruber.it/it/c/lavorazione-tubi/) |
| WS S.r.l. | wsmaranello.com | processor_service_provider | [first-party](https://www.wsmaranello.com/portfolio/curvatura-tubi-cnc/) |


## Next measured goal

**786 → at least 836**, beginning with manufacturers of steel and stainless tubes and steel-tube distributors that are not already in the six registries. Use appropriate role-specific, online-first ingestion: the industrial RPC only accepts `producer` / `processor_service_provider`, while trader/distributor intake uses its separate governed path. Preserve the single-deployment/day preference and review opt-outs.
