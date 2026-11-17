# AUTO1.A.5.3 — differenze HTML vs righe tecniche documentate

**Stato:** candidato al rilascio; flag `NETPRODUCERS_A53_ENABLED` **disattiva per default**. Non installato in produzione finché non sono completati gate, merge protetto, migrazione e rollout del worker.

## Problema reale
Il primo audit A5.2 su Railway (17/11/2026) ha letto 8 pagine ufficiali: 1 hash dei byte identico, 7 hash diversi, nessuna modifica al database. Sulla pagina identica sono mancate tabelle HTML (`no_table_rows`). **Una variazione dei byte non prova un cambio delle specifiche**; allo stesso modo, l'assenza di una differenza fra righe riconosciute **non prova che l'intero catalogo sia invariato**.

## Soluzione: doppia impronta con scopi diversi
- **SHA-256 completo dei byte HTML**, già esistente: unico riferimento per identità/versione della fonte. Resta il requisito obbligatorio per `extract_exact_row_candidates`, per la provenienza delle norme e per qualunque futura affermazione di producibilità.
- **Firma secondaria A5.3**: SHA-256 di un insieme ordinato e limitato a 120 righe HTML *osservate* contenenti segnali di norma, grado, forma o dimensione. Mantiene testo integrale delle righe (ma lo firma, **non lo conserva**), separatori di cella e ordine; normalizza soltanto maiuscole, spaziatura e `×`. Gli elementi HTML decorativi, i CSS, gli script e il menu non entrano nel confronto.
- **Nessuna riga riconosciuta** → fingerprint nullo e stato `no_comparable_rows`, mai equivalenza.
- **Primo snapshot A5.3 con righe** → `baseline`, nessuna conclusione retroattiva. Su un nuovo snapshot con SHA byte diverso, due impronte tecniche non nulle e identiche → `same_observed_rows`; diverse → `changed_observed_rows`. Questi termini indicano *solo* righe individuate dal parser, non l'intera gamma tecnica.
- Snapshot identico già registrato → `unchanged_snapshot`, idempotente. Stesso SHA con firma diversa → errore e stop; non sovrascrivere un'identità fonte coerente.

## Contratto e sicurezza
Una nuova tabella `private.network_producer_auto1a53_fingerprints` ha RLS e non concede `SELECT` ad anon/authenticated; solo RPC service role. La funzione privata valida che il documento A5 sia già stato controllato con **lo stesso SHA**, che la pagina depth-two sia `processed`, che il produttore italiano canonico sia pubblicato e che root+parent SHA e tempi siano attuali. Nessun dato sensibile, HTML o URL nella tabella o nei log aggregati.

Il worker calcola il fingerprint solo sulle pagine depth-two e lo registra **dopo** l'acknowledgement positivo di A5, **soltanto** quando `NETPRODUCERS_A53_ENABLED=true` e A5/A4 sono abilitate. Il cron, le scadenze delle fonti e gli estrattori di evidenza restano invariati. Nessuna requeue o pubblicazione.

## Priorità discovery
I link HTML a **tabelle dimensionali, size/dimension charts e spessori** vengono preferiti a semplici pagine prodotto. Pagine relative a elastomeri, adesivi, compositi e drenaggi vengono *declassate*, non eliminate. L'origine first-party, i controlli sui robot, il limite 6 link per pagina, l'assenza di redirect, i limiti bytes e le verifiche di sicurezza preesistenti restano intatti. PDF: rilevazione link diagnostica, **nessun download**.

## Verifica di rilascio
1. PR P0 `worker` e `supabase foundation` verdi, review Codex senza rilievi sulla HEAD; nessuna installazione in anticipo.
2. Applicare **una volta** `20261117115000_net_producers_auto1a53_technical_row_fingerprints.sql`; controllare tabella RLS, permessi funzioni (anon/authenticated negati, service_role consentito) e tabella vuota prima del primo uso.
3. Rollout mirato del worker su Railway nella finestra consentita, con `NETPRODUCERS_A53_ENABLED=true` soltanto dopo SQL. Non cambiare `--persist --limit 10` né il cron `*/20`.
4. Primo canary reale: contatore `a53_fingerprints_recorded`; readback record con `source_sha256` identico alla pagina A5, `comparison_status` nei valori sopra e `published_claims=0`. Con 0 nuove pagine in scadenza, **0 fingerprint non indica guasto**.
5. Misurare in un secondo momento il tasso `same_observed_rows` / `changed_observed_rows` soltanto dopo la **seconda** osservazione di ciascuna pagina. Mai convertire tali stati in manufacturing capability.

**Collegamenti:** #1349 (roadmap), #1387 (A5.1+A5.2), #1397 (audit one-shot completato).
