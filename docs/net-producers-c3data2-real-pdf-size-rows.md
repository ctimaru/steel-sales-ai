# C3.DATA2.A — Dalla tabella PDF al dato tecnico sul Network

**Decisione prodotto:** il PDF non è un risultato per il buyer. I fatti tecnici che le fonti primarie rendono osservabili devono apparire in Smart Steel Sales, con verifica/rimozione successiva da parte del produttore.

## Primo documento e primo risultato riproducibile

- **Alessio Tubi, brochure ufficiale 2026:** `https://alessiotubi.it/wp-content/uploads/2026/04/2026_04_ALESSIOTUBI_BrochureTabelle.pdf`, 6 pagine (fonte ufficiale già presente nei 7 cataloghi censiti).
- Il PDF distingue chiaramente tabelle `RECTANGULAR EN 10219`, `SQUARE EN 10219` (pagina PDF 3) e `ROUND STRUCTURAL EN 10219` (pagina PDF 4). Il testo originale mostra numerose righe con dimensione esterna e valori di peso teorico.
- **Canary fattuale limitato: 15 righe di misura** tratte da 3 tabelle di quella fonte, pubblicate come singole osservazioni: 6 rettangolari, 5 quadrate, 4 tonde. Per esempio RHS 200×100 mm, SHS 150×150 mm, CHS Ø219,1 mm. Sono prove di **misure stampate in una tabella**, non prova che l'azienda possa produrre ogni grado/quantità.
- Tracciabilità per ogni record: `company_id`, URL ufficiale, pagina, tipologia e norma della tabella, localizzatore, SHA-256 del testo di riga estratto e metodo di acquisizione `official_pdf_text_index`. Questo hash è del testo ricavato dall'indice, **non** del PDF scaricato integralmente: non chiamarlo `source_verified`.
- Nessuno spessore per misura è dichiarato nel primo canary: i numeri successivi alla misura sono **pesi teorici in kg/m** e, nel testo estratto, i vuoti delle colonne non sono preservati. Attribuire il numero alla colonna di spessore più vicina sarebbe un errore. Nessun grado S355J2H associato a singole righe di tabella.

## Architettura

1. SQL `private.network_producer_pdf_size_rows` e audit append-only, RLS deny-all, reader `public.netproducers_c3_pdf_public` read-only e procedura di staging `public.netproducers_c3_pdf_stage` **service_role-only**.
2. Ogni staging controlla che la società sia pubblicata come produttore IT, che il documento sia indicizzato come first-party PDF, che l'hostname appartenga al sito ufficiale, che pagina, norma, forma e locatore siano coerenti. Massimo 30 record per batch.
3. Pubblicazione **immediata** delle righe osservate senza claim aziendale; nessun PDF originale memorizzato/ripubblicato da questo flusso.
4. `/network/cataloghi` rende tabella di misure EN 10219 con sezione e grandezza già pronta per l'acquirente. Il PDF originale è disponibile solo nei dettagli come prova di provenienza, non un passaggio obbligato.
5. Produttore con claim aziendale indipendente verificato e ruolo admin attivo: `/network/manage/cataloghi` → conferma/rimuove/ripubblica **singola riga**; rimozioni non vengono resuscitate al successivo passaggio dello stesso locatore. Affermazioni rimangono individuali.
6. Estrazione automatica: modulo `net_pro_producers_pdf_table_sizes_c3.py` processa **pagine PDF nel worker già esistente** usando `_read_pdf_lines` isolato, solo intestazioni esplicite e righe numeriche nella medesima pagina. In B3.B viene invocato **solo se** `NETPRODUCERS_C3_PDF_SIZE_PUBLISH_ENABLED=1`, dopo verifica B2 del documento effettivamente fornito da produttore. L'estrazione non ricostruisce geometria a livello di cella: perciò mantiene `pending_producer_confirmation` e lascia spessore NULL.
7. Nessun secondo deploy Railway oggi: il servizio in produzione è ancora pinned su un commit precedente e il nuovo flag è **OFF**. Questa PR distribuisce il primo risultato tramite migrazione SQL e UI Vercel, predisponendo l'accodamento automatico per documenti B2 abilitati nella prossima finestra.

## Limiti onesti / seconda evoluzione

- Le prime 15 righe sono dati numerici *da un vero PDF primario*, non 15 licenze documentali B2 e non una scansione completa dei 7 PDF.
- Non promuovere a `source_verified` prima di confronto indipendente del PDF originale e coordinate celle dell'intestazione/spessore/valore di peso; non combinare qualità e sezioni da tabelle distinte.
- **C3.DATA2.B**: scansione first-party HTTP/PDF con retry, registrazione hash documento/edizione, geometria X/Y delle colonne, pagina × tabella × cella, limitazioni di dimensione, taratura su almeno 3 PDF diversi, revoca di fonte e aggiornamento periodico per l'intero indice PDF. Metriche nuove righe, duplicate, respinte, per fonte, qualità e stabilità. Solo fatti brevi e numerici, rispettando eventuali richieste di rimozione.
- Target: dalla ricerca tecnica alla RFQ AI con etichette `osservato nella tabella`, `confermato dal produttore`, `producibilità da verificare` e senza promesse di disponibilità.
