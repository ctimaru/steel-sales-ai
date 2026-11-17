# NET-PRO-PRODUCERS1.AUTO1.B2 — Database privato dei cataloghi autorizzati

Dipende dalla PR B1 #1420; issue B2 #1422; master #1349; roadmap Notion https://app.notion.com/p/41af059cecb5816d93c9cbe25931fb67.

## Dati e autorizzazioni
La nuova tabella private.network_producer_catalog_grants memorizza azienda canonica IT con ruolo producer pubblicato, catalog_id/versione, URL first-party, SHA256, edizione, formato CSV/PDF, metodo/riferimento autorizzativo verificati da un SERVIZIO FIDATO, scope extract + store_derived + use_in_producer_search, verified_at/expires_at/revoked_at. L'upload non crea da solo una licenza. I link esistenti hanno rights_status=link_only e NON sono retroattivamente autorizzati.
La tabella private.network_producer_catalog_candidate_rows contiene solo specifiche complete candidate e relativo locator CSV, vincolate per FK allo stesso catalogo, azienda e SHA. Stato esclusivamente pending_verification o stale: non conferma producibilità, stock o capacità.
La tabella private.network_producer_catalog_events è append-only con trigger di immutabilità e riepiloghi senza dati dei documenti.

## Accessi e operazioni
Le tre tabelle sono private con RLS attiva, zero policy browser, REVOKE diretto anon/auth/PUBLIC e nessun accesso diretto neppure per service_role. Un endpoint RPC public.netproducers1_b2_catalog(p_operation,p_payload), EXECUTE soltanto a service_role, delega a una funzione privata SECURITY DEFINER SET search_path=''.
register: servizio fidato dopo verifica indipendente dei diritti; producer/IT published, dominio canonico, SHA, validità, prova e scope obbligatori; idempotenza sul catalog_id, niente riassociazione e massimo una versione APPROVED per company/source_url.
get: restituisce esclusivamente il grant ancora attivo a un worker fidato, non al browser.
stage: transazione bounded max 50 righe, stessa azienda/catalog/sha/source/edition, norma+grado+sezione+dimensioni nella stessa riga CSV; controllo dimensioni, replay idempotente, conflitti rifiutati. Il bridge Python net_pro_producers_catalog_b2.py usa B1 prima di chiamare RPC, suddivide in 50 e non produce claims.
revoke: marca grant revoked e righe stale nello stesso lock transazionale, scrive evento append-only; nuova versione dell'URL richiede esplicita revoca della precedente.

## Cosa NON è
Non è una route per upload, un pagamento, un parser PDF, un parser AI, una licenza generata automaticamente, una capability produttiva verificata o una fonte pubblica. Nessun PDF di terzi scaricato, copiato o letto. Niente service role nel frontend. Nessuna modifica cron Railway o a network_producer_catalog_links. Non merge B2 finché B1 non è pronta.

## Gate di rollout
- P0 required sul commit effettivo, test bridge B1/B2, SQL/RLS security audit e Postgres migration rebuild; review indipendente.
- Allineare migration history remota prima di qualunque installazione; NO indiscriminato db push su A3-A5.
- Installare una sola volta dopo merge protetto. Readback: 0 grant/righe inseriti automaticamente, anon/auth privileges false, service_role true.
- Audit controllato in sandbox per grants, candidate staging, replay, revoca, cross-company, SHA e scadenze.
- B3 in seguito implementerà verifica delle combinazioni e parser di documenti solo con diritti, B4 UX proprietario e ricerca AI.
- Metrica di prodotto: specifiche esatte verificabili per azienda/documento/versione e diritti attivi, non PDF censiti.