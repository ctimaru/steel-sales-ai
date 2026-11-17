# AUTO1.A.5.4 — Priorità delle schede tecniche HTML

## Punto di partenza (lettura Supabase, 17/11/2026)
- **40** pagine depth-two `processed`, di cui solo **2** con URL che contengono segnali tecnici espliciti (`dimension|tabelle|scheda|data-sheet|en-?10219|structural`).
- **13** URL con indicatori generici o fuori settore (`about|azienda|lavora|sostenib|elastomer|paladex`): misurazione indicativa dei percorsi URL, **non** classificazione semantica dei siti.
- **5** diagnostiche A5 = `no_table_rows` con in totale **9 link PDF**. A53: **3** `no_comparable_rows`. Non significa che i produttori non abbiano tali capacità: le pagine HTML esaminate non espongono righe confrontabili.
- **0** associazioni tecniche esatte A4 verificate. Non forzare attribuzioni o combinare evidenze su più righe/pagine.

## Modifica di discovery (due livelli)
La nuova flag `NETPRODUCERS_A54_ENABLED=true` abilita **solo ranking e classificazione delle pagine HTML**. Di default è disattivata.

1. **Homepage → pagine prodotto (A3)**. I link a tabelle dimensionali, schede tecniche, EN 10219/10210 e sezioni RHS/SHS/CHS hanno priorità rispetto ai link generici a prodotti. Le pagine con *label* tecniche esplicite e uno slug neutro possono ora entrare tra gli **8** link già ammessi; mantenuto il tipo `catalog` per compatibilità del contratto SQL A3.
2. **Pagina prodotto → pagina di secondo livello (A4)**. Anche `/schede/tabelle-dimensionali/` viene riconosciuta se il link contiene segnali tecnici espliciti, invece di essere scartata per assenza delle parole `tubi` e `pipe`. La classifica preferisce informazioni dimensionali HTML e penalizza pagine di carpenteria generica/corporate o prodotti non strutturali, **senza cancellare** link che potrebbero contenere evidenze. Tetto **6** per pagina.
3. **Classificazione dell'HTML realmente scaricato** (solo codice, nessun nuovo schema):
   - `technical_html_rows`: il parser A4 rileva righe tabellari con almeno un segnale tecnico.
   - `nontechnical_html_table`: tabelle HTML presenti, nessuna riga tecnica individuata.
   - `pdf_links_no_html_table`: nessuna tabella HTML, ma link ad almeno un PDF.
   - `no_html_table_or_pdf_link`: non osservati tabelle HTML o link PDF. **Non** dichiarare che sia per forza una SPA/JS.
   
   Le categorie sono esclusivamente **contatori aggregati per ciclo** (`a54_product_page_quality` e `a54_detail_page_quality`). Non vengono persistiti HTML, URL, testi, nomi o valori in nuove tabelle.

## Invarianti di sicurezza e produttività
- URL ufficiali HTTPS con host apex/www ammesso; robots, DNS pubblici, no redirect, max 512KB e massimo collegamenti invariati. Nessun download di PDF, allegati, fogli Excel, crawling di terzi, login o materiali di terzi.
- Il ranking **non è una prova**. `extract_exact_row_candidates` rimane invariato: EN norm, steel grade, CHS/SHS/RHS, *dimensioni esatte nella stessa riga*, nessuna negazione/ambiguità e successive prove di source SHA.
- Le tabelle HTML di **primo livello** vengono rilevate e contate, ma **non** trasformate in candidate tecniche; un futuro sviluppo distinto dovrà esaminare le condizioni di provenance con A3+SQL.
- `NETPRODUCERS_A54_ENABLED=false`: comportamento storico A3/A4. Senza flag, nessuna nuova metrica o RPC richiesta.
- Nessuna migrazione, nessun reset della coda, nessuna modifica al cron Railway `*/20 * * * *`, zero pubblicazioni.

## Accettazione, rollout e metriche
1. Test del worker: priorità tecnica A3/A4, URL esterni e PDF esclusi, cap 8/6, stessa source SHA parent A4, sorgenti false e markup JS, distinzione oggettiva delle quattro categorie.
2. P0 Required Gate worker + Codex review HEAD senza rilievi, merge protetto.
3. Staging Railway del **solo** worker con source commit merge e nuova variabile `NETPRODUCERS_A54_ENABLED=true`. Rispettare policy un deploy/giorno; nessuna attivazione automatica oggi se un deploy è già stato fatto.
4. Canary di esecuzione reale: A3 `a54_product_page_quality`, A4 `a54_detail_page_quality`, zero errori, `published_claims=0`; readback invarianti A5/A53 e quote sicurezza. I dati potranno inizialmente risultare zero se non vi sono pagine in coda; non manipolare le scadenze.
5. Valutare dopo il primo lotto le quote `technical_html_rows` vs `pdf_links_no_html_table` e ridurre ulteriormente le pagine poco utili; eventuale estensione dell'estrazione a tabelle di primo livello sarà una PR successiva autonoma con source identity controllata.

Riferimenti: #1349 Intelligence Produttori, #1403 A5.3, #1404 deploy A5.3.
