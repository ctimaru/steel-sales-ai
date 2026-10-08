# SP3 — Steel Pulse Editorial Engine & Governed Publish Gate
**08.10.2026 — Stato: contratto operativo, nessuna pubblicazione pubblica**

## Regola di sicurezza
Una sorgente presente nel feed o una sintesi prodotta con AI **non** autorizzano la pubblicazione. SP3 formalizza una filiera di controllo umano: autore → revisore fattuale indipendente → verifica legale Platform Owner → publisher indipendente. Ogni passaggio è registrato in un ledger append-only con actor, revisione, decisione, motivazione, data.

## Ingresso SP2
- Il materiale disponibile proviene solo da \`steel_pulse_private.items\`, con \`editorial_state='staged'\`.
- SP2 conserva soltanto URL canonico, impronta GUID e date; non l'articolo originale, non le immagini o contatti.
- Finché non si approva alcuna fonte e non si attiva una raccolta governata, **non esistono elementi utilizzabili** per l'editoriale. La CI usa esclusivamente fixture sintetiche e rollback.

## Schede redazionali
La nuova tabella \`steel_pulse_private.editorial_cards\` contiene:
- titolo **originale** max 160 caratteri, sintesi originale max 650, importanza per il professionista max 380;
- tema standardizzato (mercato, commercio, normative, materie prime, tecnologia, aziende) e lingua IT/EN;
- autori, revisioni ottimistiche, revisore indipendente con fonte fattuale HTTPS, approvazione legale con prova **per il singolo item**, publisher, tempi e finestra di validità;
- status: \`draft → in_review → editor_approved → legal_approved → published → withdrawn\`. Rifiuti editoriali/legali riportano la scheda a bozza; nessun salto di stati.
- contenuto semplice, niente HTML, URL incorporati nel testo o immagini di terzi; il collegamento dell'articolo viene solamente dal registro origine.

## Autorizzazioni
Riutilizziamo il RBAC esistente: \`knowledge.edit\` crea/modifica e invia bozze, \`knowledge.review\` esamina i fatti, **solo Platform Owner** con \`private.is_platform_superadmin()\` attesta i diritti per il singolo articolo, \`knowledge.publish\` pubblica/ritira. L'autore non può revisionare o pubblicare la sua scheda. Il revisore editoriale non può sottoscrivere la verifica legale. Il publisher deve essere distinto da autore e revisore editoriale. Per un workflow realmente attivo sono necessarie identità abilitate e indipendenti.

Tutte le mutazioni sono RPC \`public.sp3_save_draft\` e \`public.sp3_decide\` con \`SECURITY DEFINER\`, check autenticazione e permessi, lock e controllo revisione; non sono disponibili DML dirette a \`anon\`/\`authenticated\`. La review umana **non è sostituibile** dalla generazione AI.

Per consultare la coda senza accesso SQL diretto, le RPC `public.sp3_editorial_queue` e `public.sp3_editorial_detail` espongono la sola vista redazionale ai ruoli dotati di `knowledge.read_drafts`. L'attestazione legale dettagliata è consultabile soltanto dal Platform Owner. Le quattro RPC SP3 sono registrate nell'allowlist di sicurezza HP13 per nuove funzioni `SECURITY DEFINER` autenticate, con `search_path` vincolato. L'interfaccia grafica privata di moderazione sarà collegata in un microblocco UI successivo.

## Publish gate a prova di revoca
\`sp3_source_is_publishable\` controlla il diritto di \`publish_news_card\`, stato approvato, prova/source item coerente, identità legale-editoriale distinte, politica esistente, review recente e licenza non scaduta.
Le schede marcate \`published\` NON sono ancora esposte in una route pubblica; restano in \`steel_pulse_private.sp3_currently_eligible_cards\` leggibile solo da servizio. La proiezione applica nuovamente il controllo fonte **alla lettura**, per escludere una scheda appena la fonte è sospesa/scade, senza attendere un cron. Ritiro manuale con \`sp3_decide(...,'withdraw',...)\` e audit.
Il dato ha una scadenza tecnica \`published_until\` non superiore a 90 giorni né alla scadenza dell'approvazione fonte.

**Nessuna immagine/asset esterno è pubblicata o scaricata in SP3.** La selezione della fonte fattuale e la validità dell'attestazione sono sempre responsabilità del reviewer; un semplice URL non costituisce in sé prova della licenza.

## Cosa SP3 non fa
- Nessuna fonte di test approvata in produzione; nessun feed/crawler/pubblicazione automatica.
- Nessun endpoint pubblico di lettura; il design e l'autenticazione di \`/login\` restano identici.
- Nessuna chiamata AI con testo di editori, OCR, scraping o copia di articoli.
- Nessun dato di aziende tenant, email private, prezzi, P.IVA o RFQ.
- Migrazione Supabase solo nel repository e validata in CI fino a successivo deployment verificato.

## Controlli di accettazione
- \`supabase/tests/sp3_steel_pulse_editorial_publish_gate.sql\` eseguito nel Required Gate locale (con SQL, auth e RBAC reali).
- Ruoli anon/auth senza SELECT su drafts, ledger o proiezione; assenza di dati live iniziali.
- Blocco self-review, blocco publish prima della verifica legale, controllo revisioni, sorgente sospesa esclusa alla lettura e ritiro immediato.
- Ledger immutabile su UPDATE/DELETE.
- La redazione deve avere un revisore di diritti indipendente dalle altre fasi.

## Go/no-go SP4
Per esporre la pagina login: applicazione controllata migrazione di produzione; verifica del consenso delle fonti e licenze per singolo item; controllo dell'editorial workflow con ruoli reali; nuovo endpoint pubblico minimo e cache/freshness/revoca; UI accessibile/mobile; smoke anon e no leakage. Finché questi gate non sono verificati, il login non mostra card Steel Pulse.
