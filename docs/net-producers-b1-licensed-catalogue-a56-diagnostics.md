# NET-PRO-PRODUCERS1 — B1 cataloghi autorizzati + A5.6 HTML diagnostics

**Stato 17 novembre 2026:** primo nucleo di codice e test proposto in PR, **non live**. Segue [roadmap Produttori](https://app.notion.com/p/41af059cecb5816d93c9cbe25931fb67), [B #1417](https://github.com/ctimaru/steel-sales-ai/issues/1417) e [A #1418](https://github.com/ctimaru/steel-sales-ai/issues/1418), master #1349. Non cambia checkout, PRO entitlement, la UI, Supabase di produzione o il worker Railway.

## Perché B prima di un altro parser HTML

Il canary A5.5 ha verificato 8 pagine HTML: 2 SHA corrispondenti, 6 contenuti cambiati, 1 pagina con PDF link-only e 1 senza PDF o tabelle, 0 righe HTML tecniche stabili. I link ai 5 cataloghi ufficiali / 4 produttori oggi restano **`rights_status=link_only`** con vincolo DB: la loro presenza NON è una licenza di scaricare, estrarre o riutilizzare il documento.

## B1 — Contratto del nuovo canale (già implementato in forma isolata)

Modulo `services/worker/app/net_pro_producers_catalog_b1.py`:

1. Riceve **bytes già consegnati dal produttore**, più manifest dell'azienda e **grant recuperato separatamente da un componente server trusted** (`grant_lookup(company_id, catalog_id)`). Un flag dell'upload non vale come consenso.
2. Una licenza/grant approvata deve essere document-specific, legata a `company_id`, `catalog_id`, **URL HTTPS esatto** e **SHA256 dei bytes**, con `verified_at` e `expires_at` validi, senza revoca e con tutti gli scope `extract`, `store_derived`, `use_in_producer_search`. Se assente/scaduta/revocata: **fail closed**.
3. CSV fornito dal produttore, UTF-8, massimo 2 MiB / 500 righe, estrae **solo righe complete**: `standard,grade,shape,dimensions_mm`. Norma, grado, famiglia CHS/SHS/RHS e dimensioni sono controllati sulla **stessa riga**. Righe incomplete, intervalli, doppioni o combinazioni fisicamente incoerenti vengono scartati. Ogni candidato contiene `csv_row:N`, edition, SHA del documento e `pending_verification`.
4. PDF consegnato direttamente dal produttore: con grant valido controlla la firma e il limite di 12 MiB; **registra solo un esito preparatorio** `licensed_pdf_registered_not_extracted`. Per adesso **NON legge pagine PDF**, non aggira diritti e **NON produce SKU**. Parser PDF in sandbox e provenienza `page/table/row` sono un successivo blocco B2/B3.
5. L'intera funzione è **offline e no-write**; restituisce candidati per un *futuro* staging privato, non aggiorna Network e non autorizza capacità produttiva reale, stock, prezzi, certificazioni o disponibilità.

**Modello successivo B2 (non implementato oggi):** `private.network_producer_catalog_grants` con identity/owner/permissions/expiry/revocation e audit append-only, e `private.network_producer_catalog_candidate_rows` deduplicata per company/catalog/document SHA/locator. Solo service-role RPC con RLS e revoca immediata sulla visibilità; mai esposizione documento grezzo o entitlement tramite client. Quando esiste il produttore autenticato, separare *dichiarazione aziendale* da *verifica della fonte*: non sono equivalenti.

**B3:** parser strutturato XLSX/CSV/PDF autorizzato, verifica semantica di scope per tabella e riga, gestione stabilimenti, range vs tuple esatte, diff/versioni. **B4:** UX compatta web/mobile per produttore che concede diritti selettivi, importa, vede copertura e revoca; vista AI-first `producers/IT` che rende solo dati verificati e distingue documentato/potenziale/ignoto; collegamento alla Distinta/RFQ su scelta dell'utente.

## A5.6 — Diagnostica di pagine HTML cambiate (già implementata in forma isolata)

Modulo `services/worker/app/net_pro_producers_a56_change.py`:

- Input: vecchio **full-byte SHA** della stessa fonte, impronta delle **righe tecniche osservate** di A5.3 legata alla SHA di origine, e HTML nuovo **già ottenuto** secondo i controlli DNS pubblici/robots/HTTPS/no-redirect/512KiB. Nessun nuovo fetch nel modulo.
- Classificazioni: `unchanged_full_bytes`, `same_observed_rows`, `changed_observed_rows`, `no_comparable_rows`, `not_comparable_encoding`.
- L'uguaglianza delle righe osservate **non prova** che tutti i contenuti tecnici non siano cambiati; le vecchie attestazioni restano associate alla **SHA originale**, mai trasferite alla nuova.
- Output aggregati, nessun HTML, URL, SHA grezza, scraping, scrittura DB o pubblicazione. **Non è ancora collegato alla coda first-level**: richiede un nuovo fingerprint di riferimento validato e un gate di rollout.

## Accettazione e rollout

- Test B1: grant rifiutato, revoca, scadenza, SHA errata, licenza incompleta, spoof rights nel manifest, PDF non autorizzato, righe separate e duplicate. Test A5.6: banner HTML variato ma righe osservate uguali, misura cambiata, nessuna riga, mismatch SHA originale, output senza dati grezzi.
- PR protetta + required checks + review, senza merge automatico o schema applicato in produzione in assenza di specifico gate; test worker eseguiti sulla HEAD.
- B2 deve portare **vera** provenienza trusted delle licenze in Supabase con ACL/RLS, revoca e staging antesignano di qualsiasi promozione. Niente `supabase db push` indiscriminato: cronologia remota delle migrazioni A3–A5 non coincide con i timestamp dei file GitHub.
- La pipeline automatica attuale non legge PDF e non deve iniziare a farlo da URL link-only. Nessun quinto SKU commerciale, nessun nuovo worker schedulato, nessuna pubblicazione inventata.

**KPI utile:** non il numero di URL o PDF, ma il numero di **tuple verificabili per azienda e versione con diritti attivi** e la copertura delle domande tecniche reali.
