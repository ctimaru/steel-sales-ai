# NET-IT-GROWFAST3 — Primo lotto reale di 50 candidati italiani (8 novembre 2026)

**Tracking:** [GitHub issue #undefined](https://github.com/ctimaru/steel-sales-ai/issues/1208) · release separata [NET-IT-RELEASEBULK1 #1202](https://github.com/ctimaru/steel-sales-ai/issues/1202).

## Conferma effettiva di produzione

- Database `private.network_web_research_seeds`, batch `NET-IT-GROWFAST3-PRIVATE50-20261108`.
- **50 record distinti** con 50 `research_id` e 50 `canonical_domain` distinti.
- Ruoli proposti: **26 terzisti/processor, 21 utilizzatori/end-user, 3 commercianti**. Attività da riconfermare per persona giuridica e qualità materiale.
- **10** in `web_profile_review_pending`, **40** in `industrial_fit_review`.
- Readback 0 stati impropri, 0 collisioni canonical o CORE per domini.
- Tutti `unclaimed`, `web_sourced_unverified`, `not_published`; non attribuire falsi buyer, volumi, certificati, materiali EN10219 o capacità produttive non osservate.
- Totale privato IT dopo il write **343**, rispetto a 293 prima del lotto: incremento attribuibile al batch **+50**. Canonical IT pubblicate **278**, end_user pubblicati **0**, invariati.

## Protocollo dei lotti

Discovery su 4 gruppi di query web first-party → dedup multi-registri (canonical, CORE, discovery, NETFAST, bulk, suppression) → 55 selezionate → 52 risposte reali con retry → 2 scartate per source URL non HTTPS → 50 ammesse. La prima transazione su 52 ha fallito in sicurezza per 2 URL non HTTPS, senza alcun inserimento parziale; la seconda transazione a 50 è riuscita. Nessuna visura obbligatoria per il singolo record privato. Nessun contatto personale copiato o invio RFQ.

### Elenco di nuova acquisizione

| # | Azienda di ricerca (non identità legale verificata) | Ruolo proposto | Corsia | Sito della fonte |
|---:|---|---|---|---|
| 1 | Gruppo Pontiggia | `processor_service_provider` | `web_profile_review_pending` | [gruppopontiggia.it](https://www.gruppopontiggia.it/lavorazioni/taglio-laser/) |
| 2 | Losa Pier Luigi | `processor_service_provider` | `web_profile_review_pending` | [losapierluigi.it](https://losapierluigi.it/) |
| 3 | OMR Automotive Steel Components | `processor_service_provider` | `web_profile_review_pending` | [omrspa.com](https://omrspa.com/reparto/piegatura-tubi/) |
| 4 | SamTek | `processor_service_provider` | `industrial_fit_review` | [samtek.it](https://samtek.it/lavorazione-lamiera/taglio-laser-lamiera/) |
| 5 | Marietta Costruzioni Metalliche | `processor_service_provider` | `industrial_fit_review` | [mariettacostruzionimetalliche.com](https://www.mariettacostruzionimetalliche.com/carpenterie-metalliche) |
| 6 | Carpenteria Astegiano | `processor_service_provider` | `industrial_fit_review` | [astegianocarpenteria.it](https://www.astegianocarpenteria.it/taglio-laser.html) |
| 7 | LaserCutting | `processor_service_provider` | `web_profile_review_pending` | [lasercutting.it](https://lasercutting.it/tag/taglio-laser-tubi-friuli/) |
| 8 | Metalcarp | `processor_service_provider` | `industrial_fit_review` | [metalcarp.com](https://metalcarp.com/novita-della-metalmeccanica/taglio-laser-e-carpenteria-a-brescia-soluzioni-professionali-per-la-tua-azienda/) |
| 9 | Carpenteria Leuzzi | `processor_service_provider` | `industrial_fit_review` | [carpenterialeuzzi.it](https://www.carpenterialeuzzi.it/) |
| 10 | Mhamed S.r.l. | `processor_service_provider` | `industrial_fit_review` | [mhamedsrl.it](https://www.mhamedsrl.it/carpenteria-e-saldature-lavorazioni-e-manodopera-conto-terzi-a-Mantova.html) |
| 11 | SVS Sandri | `processor_service_provider` | `web_profile_review_pending` | [calandraturasvs.com](https://www.calandraturasvs.com/) |
| 12 | Tromba Maurizio | `processor_service_provider` | `web_profile_review_pending` | [trombamaurizio.it](https://www.trombamaurizio.it/) |
| 13 | Farè & Spagarino | `processor_service_provider` | `web_profile_review_pending` | [farespagarino.com](https://www.farespagarino.com/calandratura/) |
| 14 | Gherardi | `end_user` | `web_profile_review_pending` | [gherardi.it](https://www.gherardi.it/puntelli) |
| 15 | Rimorchi Muzio | `end_user` | `industrial_fit_review` | [rimorchimuzio.it](https://rimorchimuzio.it/) |
| 16 | FAST Fabbrica Autotelai Speciali | `end_user` | `industrial_fit_review` | [fastenginery.com](https://www.fastenginery.com/) |
| 17 | Bartoli Rimorchi | `trader_distributor` | `industrial_fit_review` | [bartolispa.com](https://www.bartolispa.com/azienda/semirimorchio-schmitz-bartoli/) |
| 18 | SO.CO.M. | `processor_service_provider` | `industrial_fit_review` | [socomsrl.com](https://www.socomsrl.com/carpenterie-metalliche) |
| 19 | Mazzero Carpenteria | `processor_service_provider` | `industrial_fit_review` | [mazzerocarpenteria.it](https://mazzerocarpenteria.it/settori/agricoltura-movimento-terra/) |
| 20 | Belleri Luigi & C. | `processor_service_provider` | `industrial_fit_review` | [belleri.it](https://belleri.it/carpenteria-metallica/carpenteria-macchine-agricole/) |
| 21 | SIBO | `processor_service_provider` | `industrial_fit_review` | [sibo.eu](https://www.sibo.eu/carpenteria/) |
| 22 | OM Costruzioni Meccaniche | `end_user` | `industrial_fit_review` | [om-costruzionimeccaniche.com](https://www.om-costruzionimeccaniche.com/) |
| 23 | MPM S.r.l. | `end_user` | `industrial_fit_review` | [mpm.srl](https://www.mpm.srl/recinzioni-e-piantoni/) |
| 24 | Inox Kit | `end_user` | `industrial_fit_review` | [inoxkit.it](https://www.inoxkit.it/) |
| 25 | LL53 | `end_user` | `web_profile_review_pending` | [ll53.it](https://ll53.it/arredo-urbano/portabici-arredo-urbano/) |
| 26 | Alba | `end_user` | `industrial_fit_review` | [alba.it](https://www.alba.it/it/) |
| 27 | STF Sedie | `end_user` | `industrial_fit_review` | [stfsedie.it](https://stfsedie.it/) |
| 28 | MZ S.r.l. | `processor_service_provider` | `industrial_fit_review` | [mzsrl.it](https://www.mzsrl.it/carpenteria-metallica-industriale-pensiline-rampe-recinzioni/) |
| 29 | Omniasystem | `end_user` | `industrial_fit_review` | [omniastrutture.it](https://www.omniastrutture.it/pensiline-tettoie-in-ferro-acciaio) |
| 30 | SACE S.r.l. | `processor_service_provider` | `industrial_fit_review` | [sacesrl.eu](https://www.sacesrl.eu/coperture-per-tetti/pensiline-e-strutture-metalliche/) |
| 31 | Selvolina | `processor_service_provider` | `industrial_fit_review` | [selvoline.com](https://www.selvoline.com/it/aziende) |
| 32 | SICOM Containers | `end_user` | `industrial_fit_review` | [sicom-containers.com](https://www.sicom-containers.com/prodotti/) |
| 33 | Metella Container | `end_user` | `industrial_fit_review` | [metellacontainer.com](https://metellacontainer.com/) |
| 34 | Gruppo Carnovali-CBS | `end_user` | `industrial_fit_review` | [carpenteriacarnovali.it](https://carpenteriacarnovali.it/) |
| 35 | EuroScaf | `end_user` | `industrial_fit_review` | [euroscaf.it](https://www.euroscaf.it/it/telai-intelaiature/) |
| 36 | Rollawaycontainer | `trader_distributor` | `industrial_fit_review` | [rollawaycontainer.it](https://www.rollawaycontainer.it/) |
| 37 | SIB Case Mobili | `end_user` | `industrial_fit_review` | [sibcase.com](https://sibcase.com/) |
| 38 | Poppi S.r.l. | `processor_service_provider` | `industrial_fit_review` | [poppisrl.it](https://www.poppisrl.it/) |
| 39 | Metal P | `processor_service_provider` | `industrial_fit_review` | [metal-p.it](https://www.metal-p.it/produzione-componenti-carter-macchine-agricole-forestali-reggio-emilia-maranello/) |
| 40 | Somale Carpenteria | `processor_service_provider` | `industrial_fit_review` | [somalecarpenteria.it](https://somalecarpenteria.it/produzione-di-macchine-agricole/) |
| 41 | Metal.co | `end_user` | `industrial_fit_review` | [metal-co.it](https://www.metal-co.it/it/azienda-metal-co.html) |
| 42 | LamaLaser | `processor_service_provider` | `industrial_fit_review` | [lamalaser.it](https://www.lamalaser.it/) |
| 43 | Barnobi | `processor_service_provider` | `industrial_fit_review` | [barnobi.it](https://barnobi.it/quali-sono-alcune-lavorazioni-di-carpenteria-metallica-che-si-possono-fare-solo-con-il-laser-tubo/) |
| 44 | Enerbuilding | `processor_service_provider` | `industrial_fit_review` | [enerbuilding.com](https://www.enerbuilding.com/strutture-per-uso-civile) |
| 45 | MCT Scaffalature | `end_user` | `industrial_fit_review` | [mctscaffalature.com](https://www.mctscaffalature.com/strutture-metalliche/) |
| 46 | Trefil | `trader_distributor` | `web_profile_review_pending` | [trefil.it](https://www.trefil.it/strutture-metalliche-tubolare-ferro) |
| 47 | Starmodul | `end_user` | `industrial_fit_review` | [starmodul.com](https://starmodul.com/it/strutture-metalliche-su-misura/) |
| 48 | Centro Reti | `end_user` | `industrial_fit_review` | [centroreti.com](https://www.centroreti.com/) |
| 49 | Euro-Fer | `end_user` | `industrial_fit_review` | [eurofer.com](https://www.eurofer.com/it/prodotti/cancelli) |
| 50 | Chironna Officine | `end_user` | `industrial_fit_review` | [chironnaofficinesrl.com](https://chironnaofficinesrl.com/) |

I nomi sono etichette di ricerca, non necessariamente denominazioni legali; taluni operatori sono produttori di manufatti adiacenti alla filiera tubolare e richiedono validazione industrial fit. Nessuna di queste 50 schede è stata aggiunta al Network pubblico.

**Prossimo intervento:** GROWFAST4 nuovi 50–100; RELEASEBULK1 autorizzazione e source rights prima di pubblicazione della prima coorte, con readback separato.
