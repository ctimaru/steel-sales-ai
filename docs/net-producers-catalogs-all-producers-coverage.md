# NET-PRO-PRODUCERS — Cataloghi di tutti i produttori, non elenco di link

**Decisione del fondatore (18/11/2026):** il buyer deve vedere le informazioni tecniche strutturate in Smart Steel Sales; la conferma/rimozione è gestita dalle aziende. Nessun PDF esterno deve essere il percorso principale per conoscere diametri e sezioni.

## Stato misurato

- Network: **136** profili con ruolo `producer` pubblicati: **118 IT**, **18 RO**. **Attenzione:** il ruolo categorizza una candidatura aziendale, NON garantisce che sia un tubificio. In elenco ci sono anche produttori di altre categorie industriali. Il crawler usa il ruolo per aprire **la ricerca di un catalogo**, non per attribuire una capacità tubificia.
- Cataloghi ufficiali censiti prima di questa PR: **15** riferimenti da **9** produttori, inclusi **7** PDF. Dati tecnici pubblicati: 64 attributi e 15 dimensioni PDF da Alessio Tubi.
- Questa PR aggiunge **101 dimensioni PDF indicizzate da altri 3 produttori**, portando il totale **previsto di migrazione a 116 righe da 4 aziende**. Nessuna nuova categoria è dichiarata produttiva in base al solo ruolo.
- Fonti: Acciaitubi catalogo 2024 pagina PDF 27, dati CHS EN 10219 (29 diametri); Padana Tubi catalogo inox 2018 pagina PDF 7, 12 diametri CHS + 14 SHS + 16 RHS (42 righe), norma per singola riga **non attestata**; CSM TUBE brochure 2025 pagina PDF 5, tabella PRODUCT RANGE, 30 diametri CHS, norma per singola riga **non attestata**.
- Qui **`line_sha256`** è hash della riga indicizzata testuale del PDF (o singola cella testuale nei dati precedenti), **non** hash del file PDF originale. L'evidenza è `official_pdf_text_index`, il grado resta separato, lo spessore `NULL` e la producibilità effettiva `pending_producer_confirmation`. Le fonte PDF sono collegamenti originali first-party; nessuna copia PDF o tabella integrale viene distribuita.

## Coda di crescita per tutti i 136 profili

- Migration `private.network_producer_catalog_discovery_queue` con seed idempotente di **tutti i profili producer IT e RO pubblicati** con dominio ufficiale, e audit immutabile; aggiunge automaticamente nuove aziende future.
- API servizio `public.netproducers_catalog_discovery` **solo service_role**: `seed / stats / claim / complete`, 1–3 lease per iterazione, `skip locked`, token di lease, retry e cooldown. Non serve claim aziendale per scoprire una fonte ufficiale, ma gli attributi specifici si confermano solo in seguito.
- Worker `net_pro_producers_catalog_discovery.py`: HTTPS pubblico **DNS IP pinned**, validazione TLS hostname, robot rules, no proxy, no redirect cross-domain, massimo tre pagine HTML per sito e massimo otto PDF link, niente download PDF né archiviazione di contenuti integrali. Esclude PDF di privacy/contratti generici e PDF non correlati al settore; verifica solo **URL first-party** e riferimenti di cataloghi prodotti. Su ogni sito indica `discovered/none_found/blocked/retry`. Non pubblica SKU e non assegna la categoria tubificio a un produttore generico.
- Collegamento al cron Railway **esistente** `net-producers-auto1`: `NETPRODUCERS_CATALOG_DISCOVERY_ENABLED=1` dopo il prossimo deploy protetto. **Non è una nuova cron**. Fino ad allora la coda è predisposta, ma non viene ancora lavorata dal nuovo codice; non dichiarare scansioni automatiche già avvenute.
- Nuovo limite UI 180 misure PDF nella prima pagina e standard `CATALOGUE_UNSPECIFIED` visualizzato come **“Non indicata”**. Aggiornamenti dinamici senza intervenire nella scheda manualmente.

## Evoluzione prioritaria

- **Dopo il primo rilascio:** attivare il flag e un **solo** deploy Railway nel prossimo slot consentito. Canary 1–2 siti per cron, audit per territorio/settore, qualità e deduplica; normalizzare e aggiungere nuovi cataloghi ufficiali senza fare clic obbligatori.
- Il crawler qui **censisce nuove fonti**, non ha ancora un job di estrazione automatica dai PDF pubblici con verifica geometrica a coordinate. Quest'ultimo è richiesto da [issue #1454](https://github.com/ctimaru/steel-sales-ai/issues/1454) e resta una seconda fase: PDF first-party limitato e in memoria, colonne e celle con provenienza verificabile, pubblicazione di soli fatti, non di copie protette. Evitare errori nel mapping di spessori, norme, gradi.
- **Scale:** pagination (oltre 180 dimensioni PDF) e filtri industriali; KPI produttori con documenti, documenti nuovi, produttori con dati, righe dimensionali pubblicate, ultimi aggiornamenti e tasso di rimozione.

## Gate di pubblicazione

1. GitHub P0 (frontend/worker/supabase), SEC1, responsive e contrasto sullo SHA definitivo.
2. Merge protetto, migrazioni Supabase in ordine esatto una volta.
3. Read-back produzione: 116 fatti PDF, 4 produttori con misure, 72 righe con norma `CATALOGUE_UNSPECIFIED`, 0 spessori associati arbitrariamente, tutti pending, niente duplicati; queue 136 (118 IT +18 RO) e anon/auth DENY all'accesso alla coda.
4. Vercel READY sulla SHA del merge; Railway non dichiarato aggiornato se source pinned vecchia.
