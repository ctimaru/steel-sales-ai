# NET-IT-USER1.C — Prima coorte di 5 utilizzatori: pacchetto revisione Platform

Data: 8 novembre 2026. Parent issue [#1190](https://github.com/ctimaru/steel-sales-ai/issues/1190) e PR di lavoro [#1193](https://github.com/ctimaru/steel-sales-ai/pull/1193).

## Effettivo readback di produzione

Da 21 record IT privati `NET-IT-USER1B-PRIVATE21-20261108`, in `private.network_web_research_seeds`:

- **5** `web_profile_review_pending` con identità legale e prodotti tubolari sufficientemente documentati da presentare a un revisore autentico.
- **2** `brand_legal_identity_review`: Dimo Group S.r.l. (marchio Giochipark), MAD S.r.l. (marchio MAD Urban Design) — non creare canonical duplicati per marchio.
- **4** `legal_identity_review`: FeroLab, Primula Giorgetti, Ramon, Umbria Serre — le prove dei prodotti non bastano per la riconciliazione della persona giuridica.
- **10** `industrial_fit_review`: materiale o prodotto tubolare ancora da dimostrare.

Correzioni eseguite in produzione solo nel **registro privato** (7 righe di triage, poi 4 denominazioni legali, 11 aggiornamenti in totale), con transazioni fail-closed; tutte le 21 righe risultano ancora `unclaimed`, `web_sourced_unverified`, `not_published` e con `proposed_role=end_user`. Italia canonical published 278; published canonical `end_user` 0.

## Coorte 5 con prove di applicazione

| # | Azienda legale sul sito | Regione | Tubolari usati nei prodotti | Fonti first-party |
|---:|---|---|---|---|
| 1 | AUG Arredi Urbani e Giochi S.r.l. | Trentino-Alto Adige | tubo tondo acciaio zincato Ø40; sezione rettangolare 60×30 mm | [Scheda prodotto](https://www.augspa.com/shop/arredo-urbano/panchine/panchina-con-braccioli-36ea469/) · [Identità](https://www.augspa.com/contatti/) |
| 2 | Lazzari S.r.l. | Puglia | tubolari acciaio Ø25 e Ø76 mm | [Scheda prodotto](https://www.lazzarisrl.it/prodotto/panchina-tube/) · [Identità](https://www.lazzarisrl.it/contatti/) |
| 3 | Retissima S.r.l. | Lombardia | pali in tubolare quadro d'acciaio 50×50×2 mm | [Scheda prodotto](https://www.retissima.it/reti_e_recinzioni/cancellata-lima-recinzione-in-ferro-zincato/) · [Identità](https://www.retissima.it/reti_e_recinzioni/cancellata-lima-recinzione-in-ferro-zincato/) |
| 4 | Sottile S.r.l. | Emilia-Romagna | arco tubolare ferro zincato Ø27×2 mm | [Scheda prodotto](https://sottileserre.com/serre/serra-in-ferro-zincato/) · [Identità](https://sottileserre.com/serre/serra-in-ferro-zincato/) |
| 5 | Tecnocarpenteria S.r.l. | Veneto | tubolari ferro zincato Ø28, Ø40, Ø60 mm | [Scheda prodotto](https://www.tecnocarpenteria.it/serre/tunnel/) · [Identità](https://www.tecnocarpenteria.it/serre/tunnel/) |

I cinque identificativi fiscali aziendali pubblicati sui siti sono nel [manifest JSON](../services/worker/data/net_it_user1c_first5_operator_packet_20261108.json) e hanno **0 exact-VAT match** nei cataloghi canonical, discovery e bulk già interrogati. Si tratta di un preflight sui registri disponibili, non di verifica camerale esaustiva.

## Contratti di promozione — passaggi obbligatori

1. **Registrazione come semplice ricerca:** completata per 21, e questa coorte resta privata.
2. **Ingresso in CORE tramite `netcov2_operator_batch_stage`:** ancora da eseguire. Il chiamante deve disporre di un account reale Platform con `discovery.enrich` e attestazione, prima di inviare le cinque righe JSON/TSV. La RPC limita il lotto a 40 righe e verifica 7 campi, HTTPS ed exact-domain dedup.
3. **Review CORE tramite `netcov1_review_targets`:** richiede un utente reale Platform con `discovery.governance_review`, motivazione, attestazione e materiale esplicito. `ready_for_crawler` non significa pubblicato.
4. **Enqueue/crawl solo da fonte governata:** `netcov1_enqueue_reviewed` richiede fonte IT approvata, uso consentito/licenza, fonte diritti e permessi Platform; l'attuale source registry non ha una fonte autorizzata pertinente a questi cinque siti. La voce Wikidata CC0 non autorizza il riuso massivo dei siti aziendali.
5. **Publication Network canonical e ruolo `end_user`:** è un gate successivo separato, con dedup identità, informazioni di sola fonte ammissibili, reviewer/audit, readback numerico e nessuna promessa di certificazione/fornitura.

## Perché il nome AUG è S.r.l.

Sebbene il dominio si chiami `augspa.com`, la pagina [Contatti AUG](https://www.augspa.com/contatti/) riporta la ragione sociale **AUG Arredi Urbani e Giochi S.r.l.**. Materiali storici citano S.p.A.; usare la denominazione ufficiale corrente. In produzione privata il nome è stato corretto, senza alterare il ruolo pubblico.

## Deliverable utilizzabili

- [Manifest di revisione non-eseguibile](../services/worker/data/net_it_user1c_first5_operator_packet_20261108.json) — evidenza, nome, partita IVA, URL societario, distinzione stato/permessi.
- [TSV di 5 righe per operatore Platform](../services/worker/data/net_it_user1c_first5_platform_operator_20261108.tsv) — solo proposta per importazione autenticata, non payload automatico.

**Niente PII, niente outreach/RFQ, niente stock o prezzo e nessuna norma EN/ASTM inferita.** Lotti di acquisizione privata e di pubblicazione si misurano separatamente. Mantenere un solo deploy Vercel al giorno, nessun intervento UI decorativo.
