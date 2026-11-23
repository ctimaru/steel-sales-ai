# NET-IT-GROWTH13 · riconciliazione fiscale omonimie (23/11/2026)

**Ambito:** tre coppie di aziende italiane con stesso nome e partita IVA distinta. Questo documento NON esegue modifiche e NON costituisce consenso a disattivare controlli di produzione.

La prova tecnica verificabile è in [`scripts/net_it_growth13_omonimie_preflight_20261123.sql`](../scripts/net_it_growth13_omonimie_preflight_20261123.sql), eseguito in sola lettura su Supabase progetto `ecrafjdummcdfycznitx`.

| Candidata | P. IVA candidata | Fonte candidata | Scheda pubblicata | P. IVA pubblicata da registrare | Fonte della scheda |
|---|---|---|---|---|---|
| CLM S.r.l., `clmsrl.net` | `02262820265` | https://www.clmsrl.net/index.php/chi-siamo | `clmmeccanica.it` | `01151140264` | https://www.clmmeccanica.it/en/privacy/ |
| OMG S.r.l., `meccanicaomg.it` | `00122340938` | https://www.ufficiocamerale.it/5286/omg-srl e https://opencorpdata.com/lei/815600A7BF083AEEB858 (identità e sede Sequals); sito candidato da ri-verificare da AUTO2 | `omgsteel.it` | `02304000694` | https://www.omgsteel.it/contatti-omg/ |
| Metal Working S.r.l., `metalworkingitalia.it` | `05511410010` | https://metalworkingitalia.it/ | `metalworkingweb.com` | `02064370220` | https://metalworkingweb.com/contatti/ |

**Casi esclusi:** `metalfer.eu` è in `HOLD_RIGHTS_REVIEW` (diritti fonte da verificare); `steelsiderurgica.it` è in `HOLD_UNRESOLVED_CANONICAL_IDENTITY` (`steelsrl.it` senza identità fiscale confermata). Non registrarli come prova conclusa.

## Esito delle verifiche read-only

- Tre schede già pubblicate avevano ancora `vat_id NULL` al controllo del 23/11/2026. Le candidature hanno le rispettive VAT, sono `pending_review`, non sono rivendicate o pubblicate tramite `promoted_company_id`; PII rilevata zero.
- Tre coppie: `NEEDS_AUTHORIZED_CANONICAL_VAT_BACKFILL`; nessun record prova presente in `private.net_it_growth13_vat_proofs`.
- `private.net_it_growth13_distinct_vat(candidate_id, existing_id)` deve diventare `true` solo dopo l'arricchimento canonical e la prova fiscale auditabile; al momento il risultato è `false`.
- Questo ramo non cambia partite IVA, `review_status`, evidenze AUTO2, policy, ruoli, diritti né schede pubblicate.

## Sequenza di manutenzione autorizzata

1. Un operatore autorizzato controlla le fonti e ripete il preflight read-only su produzione. Non agisce se una VAT, un dominio o un'identità risultano conflittuali, o se la scheda è claimed/verified.
2. Usa esclusivamente il normale processo governato di manutenzione per valorizzare la VAT esistente su ciascuna scheda **solo se vuota**, con fonte originale registrata e un'asserzione `network_data_assertions` marcata `pending`, non `company_verified`.
3. Registra per ciascuna coppia le due VAT e i due URL di prova nella tabella privata GROWTH13 secondo l'audit del rilascio PR #1517. Non inserisce dati se prova o diritto alla fonte insufficienti.
4. Ripete il preflight e verifica `private.net_it_growth13_distinct_vat = true` per ogni coppia idonea. Le vecchie evidenze `needs_human` non vanno alterate.
5. Attende una **nuova** verifica first-party AUTO2 dal worker attivo. Solo se il nuovo verdetto è `identity_supported` e AUTO3 dry-run dà `ready>0`, pubblica tramite AUTO3 entro il cap delegato e controlla ledger/canonical/count. Se bloccata per diritti o altro, conserva l'esclusione.

**Vincolo operativo:** il tentativo di scrittura in produzione e la generazione di un ulteriore script eseguibile sono stati bloccati dai controlli di sicurezza della piattaforma. Non aggirare questo vincolo usando percorsi alternativi. Questa documentazione è per l'operatore del canale autorizzato e non dichiara nessuna pubblicazione eseguita.

Contesto: issue [#1384](https://github.com/ctimaru/steel-sales-ai/issues/1384), [#1514](https://github.com/ctimaru/steel-sales-ai/issues/1514), PR [#1517](https://github.com/ctimaru/steel-sales-ai/pull/1517), PR attuale [#1559](https://github.com/ctimaru/steel-sales-ai/pull/1559).
