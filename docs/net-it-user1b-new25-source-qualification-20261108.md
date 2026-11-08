# NET-IT-USER1.B — Seconda coorte Italia: 25 nuovi prospect utilizzatori

**Data:** 8 novembre 2026 · **Tracking:** [#1190](https://github.com/ctimaru/steel-sales-ai/issues/1190) · [Prior PR #1191](https://github.com/ctimaru/steel-sales-ai/pull/1191).

## Risultato

**25 nuovi domini sorgente IT**, in ricerca industriale. **21** hanno un payload tecnico predisposto per la **coda di staging manuale Platform**, **4** sono bloccati da dubbi di identità/doppio dominio e non devono essere inseriti prima della risoluzione. Evidenza: **15 A (materiale tubo in acciaio/ferro esplicito)**, **9 B (tubolare e/o attività metallica documentati, materiale da precisare)**, **1 C (solo prodotto finito)**.

Preflight Supabase *read-only* 8 novembre: 25/25 domini distinti, nessun exact-domain match sui cataloghi canonical, CORE, discovery, provisional NETFAST2/3, CORDIS, bulk, discovery domain leads, ricerca web privata e overlay/netfast, nessun match in suppression. Alcuni domini aziendali multipli e relazioni di gruppo restano da verificare: **il preflight per dominio non prova che siano 25 persone giuridiche indipendenti**. Per gli entry A non si può inferire acquisto, volumi, norma EN10219, buyer verificato o capacità attuale.

**Non ho eseguito importazione o pubblicazione.** Le RPC `netcov2_operator_batch_stage` e `netcov1_review_targets` richiedono `auth.uid()` realmente autenticato + permessi Platform + attestazione, e non devono essere aggirate via SQL. `netcov1_seed_official_cohort` è `service_role` only. Il file payload è una **proposta non autorizzante** per l'operatore, non una prova di permesso di riuso.

## Registro nuove fonti

| # | Azienda | Segmento | Evidenza | Corsia | Evidenza original-site sintetica | Fonte |
|---:|---|---|:---:|---|---|---|
| 1 | Ramon Costruzioni Metalliche e Serre | agricultural_equipment | A | Candidate for Platform staging | Serre tunnel con colonne in tubo zincato a caldo e arcate in tubi di ferro zincato Sendzimir. | [Sito](https://serreramon.com/) |
| 2 | CTS Ponteggi | scaffolding | A | HOLD identity | Ponteggi prefabbricati in acciaio S235JR dichiarato conforme a UNI EN 10219. | [Sito](https://www.ctsponteggi.com/azienda) |
| 3 | Piscopiello Ponteggi | scaffolding | A | HOLD identity | Sito produttivo dichiara taglio e piega di tubi e profili in acciaio per ponteggi e trabattelli. | [Sito](https://piscopielloponteggi.it/produzione/) |
| 4 | Novarino Serre | agricultural_equipment | B | Candidate for Platform staging | Costruzione di serre con tubi rettangolari; materiale metallico del tubo da confermare puntualmente. | [Sito](https://serrenovarino.com/serre-professionali/) |
| 5 | Taborre & Tumbarello | agricultural_equipment | B | Candidate for Platform staging | Azienda produttrice di pali in acciaio e strutture/archi per serre e vigneti; tubo strutturale non esplicitato. | [Sito](https://www.taborre.com/) |
| 6 | Turatello Group | agricultural_equipment | B | Candidate for Platform staging | Costruzione di telai per rimorchi con acciaio tagliato, piegato e saldato; tubo/profilo cavo non confermato. | [Sito](https://turatello.com/azienda/) |
| 7 | Sottile Serre | agricultural_equipment | A | Candidate for Platform staging | Serre con arcate in tubolare di ferro zincato diametro 27 mm spessore 2 mm. | [Sito](https://sottileserre.com/serre/serra-in-ferro-zincato/) |
| 8 | Metalsiti | agricultural_equipment | B | Candidate for Platform staging | Costruzione di serre e carpenteria metallica in ferro; uso di tubolari specifici non dimostrato nella pagina. | [Sito](https://metalsiti.it/) |
| 9 | Tecnocarpenteria | agricultural_equipment | A | Candidate for Platform staging | Serre tunnel in ferro zincato con archi tubolari diametro 28/40/60 mm e correnti tubolari diametro 28 mm. | [Sito](https://www.tecnocarpenteria.it/serre/tunnel/) |
| 10 | Retissima | industrial_equipment | A | Candidate for Platform staging | Recinzioni con pali in tubolare quadro di acciaio zincato 50x50x2 mm. | [Sito](https://www.retissima.it/reti_e_recinzioni/cancellata-lima-recinzione-in-ferro-zincato/) |
| 11 | Tecno Recinzioni Radis | industrial_equipment | B | Candidate for Platform staging | Recinzioni costruite con elementi tubolari metallici saldati; specifica del materiale del tubo da approfondire. | [Sito](https://www.tecnorecinzionisportiveindustriali.it/index.php/news/item/285-recinzioni-metalliche-a-rivoli-susa) |
| 12 | MAD Urban Design | urban_furniture | A | Candidate for Platform staging | Panchina Scia con telaio in profili tubolari di acciaio S235. | [Sito](https://www.madurbandesign.it/prodotti/scia/) |
| 13 | Primula Giorgetti | urban_furniture | A | Candidate for Platform staging | Panca Liberty con seduta e schienale in tubolari ovali di acciaio zincato. | [Sito](https://www.primulagiorgetti.it/prodotto/panca-liberty/) |
| 14 | SICOS Italy | scaffolding | A | Candidate for Platform staging | Fabbricazione di trabattelli industriali in acciaio con sezioni dei tubolari in acciaio dichiarate. | [Sito](https://sicositaly.com/) |
| 15 | Italscale | scaffolding | B | Candidate for Platform staging | Fabbricazione di scale e trabattelli in inox e alluminio; uso di tubolare strutturale in acciaio da precisare. | [Sito](https://www.italscalesrl.it/azienda/) |
| 16 | Ferolab | urban_furniture | A | Candidate for Platform staging | Panchina Tubo con tubetti in acciaio zincato/inox saldati e tubolare portante in acciaio. | [Sito](https://www.ferolab.it/panchina-metallica-tubo/) |
| 17 | Lazzari Srl | urban_furniture | A | Candidate for Platform staging | Produzione panchine modello Tube in tubolari di acciaio zincato diametri 25 e 76 mm. | [Sito](https://www.lazzarisrl.it/panche-e-panchine-per-arredo-urbano/) |
| 18 | Effe.Di. Metaldesign | urban_furniture | A | HOLD identity | Panchina Jonio con tubi di acciaio zincato diametro 60 mm e doghe tubolari ovali 40x20 mm. | [Sito](https://www.effedimetaldesign.it/prodotti_dettaglio.php?ID_Prodotto=304) |
| 19 | AUG Arredi Urbani e Giochi | urban_furniture | A | Candidate for Platform staging | Panchina con supporti in tubo di acciaio zincato diametro 40 mm e doghe tubolari rettangolari 60x30 mm. | [Sito](https://www.augspa.com/shop/arredo-urbano/panchine/panchina-con-braccioli-36ea469/) |
| 20 | Giochipark | urban_furniture | A | Candidate for Platform staging | Panca Idola: supporti in tubo di acciaio zincato diametro 40 mm e seduta in tubolari ovali 40x20 mm. | [Sito](https://www.giochipark.com/prodotti/arredo-urbano/panchine/panca-idola/) |
| 21 | Idromeccanica Lucchini | agricultural_equipment | B | Candidate for Platform staging | Serra Multyhortus con piantoni e arcate in tubo zincato diametro 60 mm; materiale della parete non dichiarato in questa fonte. | [Sito](https://www.lucchiniidromeccanica.it/serre-professionali/linea-titan/serra-multyhortus/) |
| 22 | Galbusera Serre | agricultural_equipment | B | Candidate for Platform staging | Serre professionali in ferro zincato e bancali/tunnel in tubolare zincato Sendzimir; collegamento esatto ferro-tubolare da revisionare. | [Sito](https://www.serregalbusera.it/prodotti/) |
| 23 | Umbria Serre | agricultural_equipment | A | Candidate for Platform staging | Serre ombraio costruite in tubolare di ferro zincato a caldo. | [Sito](https://www.umbriaserre.it/serre-ombraio/) |
| 24 | Electric Metal — Portabiciclette Modello Verona | urban_furniture | B | HOLD identity | Produzione industriale di portabiciclette con acciai lavorati e saldati; tubo strutturale specifico non documentato. | [Sito](https://www.portabiciclettemodelloverona.it/produzione/) |
| 25 | Artemisia Srl | urban_furniture | C | Candidate for Platform staging | Produzione dichiarata di panchine, transenne, portabici e arredi in acciaio o legno; tubo di acciaio non documentato. | [Sito](https://artemisiasrl.it/) |

## Bundle per la console Platform

- Manifest di ricerca (25): `services/worker/data/net_it_user1b_source25_20261108.json`.
- Payload compatibile con i **sette campi** accettati da `netcov2_operator_batch_stage` (21 righe, massimo RPC 40): `services/worker/data/net_it_user1b_platform_stage21_20261108.json`.
- **Non eseguire il payload automaticamente**: prima autenticazione Platform, attestazione sostanziale, verifica dati/siti/diritti e deduplica alla data di esecuzione. Staging produce solo `needs_review` e non buyer confermato, crawler run o company published.
- Per i 4 hold (CTS, Piscopiello, Effe.Di, Electric Metal), non creare duplicate brand/company; controllare domini alternativi e identità commerciale.

## Prima coorte A: operatività

- Dai 14 A della precedente PR, **9** risultano già `material_signal='explicit_steel_tube_product'` e `needs_review` nel DB; il passaggio `ready_for_crawler` richiede un vero operatore Platform con attestazione, non un write SQL di sistema.
- **5** (Basso Bikes, CETA, Industria Italiana Ponteggi, Lombarda Serre, Tecnal Serre) hanno fonte esplicita nella PR precedente ma sono ancora `finished_equipment_only` nella produzione. Prima della decisione `ready_for_crawler` occorre aggiornare la fonte e il material signal tramite il percorso governato, altrimenti il guard rifiuta.
- Non confondere `ready_for_crawler` con published `end_user`: in produzione all'ultimo readback **0** aziende italiane con assegnazione canonica `end_user` published.

## Roadmap operativa

1. **USER1.B.1**: review prioritaria dei 9 A con segnale forte già coerente, e riallineamento controllato delle 5 evidenze residue (senza forzare reviewer/authorization).
2. **USER1.B.2**: importazione del payload di 21 aziende in `needs_review` da console Platform quando realmente autorizzata; recheck 11 registri, nomi/alias e opt-out, distinzione fra risultati staged, rejected e hold. Lotti più grandi di 40 non sono consentiti dalla RPC.
3. **USER1.B.3**: crescita di un successivo lotto 25–50 sui settori sera/ponteggi/rimorchi, solo fonti first-party con segnale tecnico.
4. **USER1.C**: pubblicazione claimable separata, dopo diritti, deduplica e percorso di review. No outreach, false buyer, RFQ o verifiche legali inventate.

**Nessun frontend toccato; non forzare deploy per sole evidenze. Un deploy produzione al giorno.**
