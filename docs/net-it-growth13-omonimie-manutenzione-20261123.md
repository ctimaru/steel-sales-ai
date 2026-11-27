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

## Procedura automatica richiesta — zero interventi per singola azienda

**Direttiva founder del 23/11/2026:** nessun intervento umano per risolvere singole aziende, nessuna richiesta all'utente di inserire una partita IVA, controllare una fonte o decidere una pubblicazione. Nei casi non risolvibili automaticamente, **HOLD motivato e prosecuzione della coda**. Il target 15.000 non viene fermato da un gruppo di collisioni omonime.

**Contratto di implementazione per la pipeline esistente**, senza nuovo cron:

1. **Scoperta collisione**: il worker/servizio già attivo individua un'omonimia su ragione sociale; non la classifica come duplicato senza VAT/domino e altre prove d'identità.
2. **Raccolta fiscalità**: consulta automaticamente pagine ufficiali con fetch protetto (robots, DNS/SSRF, limiti, HTTPS, restrizioni) e, solo se riutilizzabili, registri ufficiali. Associa ogni P.IVA alla precisa identità, al relativo dominio e a fonte/provenienza; non copiare pagine o dati personali.
3. **Verifica reciproca**: almeno due VAT valide, diverse, univoche, attribuibili a due imprese distinte; nessuna scheda claimed/verified da modificare, nessuna PII, nessuna collisione canonica per dominio o identità fiscale. Con prova incompleta, conflittuale o vietata: stato privato HOLD automatico, senza forzare pubblicazione.
4. **Persistenza governata**: usare soltanto un percorso con autorizzazioni effettive, idempotente, auditabile e protetto in produzione, che rispetti le guard GROWTH13 per VAT canonica e `private.net_it_growth13_vat_proofs`. Non inserire dati artificiali e non aggirare eventuali blocchi di sicurezza. Il codice di un *nuovo* percorso scrivente **non è ancora consegnato**: questo documento è la specifica di accettazione, non un'autorizzazione ad aggirare il blocco precedente.
5. **Esito**: dopo `private.net_it_growth13_distinct_vat = true`, lasciare al reviewer AUTO2 già in cron l'acquisizione di una nuova prova first-party. Pubblicare esclusivamente tramite AUTO3 con policy owner attiva, dry-run `ready>0`, controlli invariati e readback canonical+ledger. Altrimenti HOLD e passare al prossimo candidato.
6. **Funnel**: misurare identità candidate / VAT confermate / omonimi distinti / HOLD per causa / nuove evidenze AUTO2 / nuove aziende AUTO3. Mai contare la documentazione, i domini o una VAT rilevata come profilo pubblicato.

### Esito del blocco corrente

Tre coppie hanno fonti fiscali raccolte ma NON la persistenza governata completata. Metalfer rimane HOLD diritti; Steel rimane HOLD identità. Non chiedere manutenzione manuale delle cinque schede e non riproporre DML diretta bloccata. **Continuare invece le altre candidature idonee con l'automazione Network Italia 15K già attiva.**

Contesto: issue [#1384](https://github.com/ctimaru/steel-sales-ai/issues/1384), [#1514](https://github.com/ctimaru/steel-sales-ai/issues/1514), PR [#1517](https://github.com/ctimaru/steel-sales-ai/pull/1517), PR attuale [#1559](https://github.com/ctimaru/steel-sales-ai/pull/1559).
