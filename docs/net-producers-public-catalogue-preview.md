# NET-PRODUCERS — Prima anteprima cataloghi ufficiali osservati

**Scelta di prodotto:** eliminare il gate di claim/abbonamento per la *scoperta di fonti ufficiali e dei fatti atomici osservati*. Non eliminare la sicurezza delle credenziali, il vincolo sulle copie integrali PDF, la verifica delle licenze/documenti privati o la conferma di producibilità.

## Funzione

`/network/cataloghi` presenta le fonti pubbliche ufficiali di tubifici italiani già pubblicati nel Network: cataloghi PDF (link esterni al sito ufficiale) e pagine prodotto, più brevi attributi tecnici fattuali che riportano ciascuno produttore e fonte. Sorgente dati reale: `private.network_producer_catalog_links` e `private.network_producer_technical_claims`, con RPC lettura `public.netproducers1_catalog_observed_preview`, funzione interna `sec1_public.netproducers1_catalog_observed_preview_impl`.

L'anteprima offre ricerca testuale di produttore, norma e singolo attributo, link diretti e conteggi dal database attuale. Gli stati sono sempre `producer_confirmation_pending`. Non dimostra che *insieme* norma, grado, sezione e misura siano prodotti. Nessuna combinazione “EN10219 S355J2H 200×100×6” è certificata per associazione fra attributi indipendenti. Nessun PDF viene copiato o distribuito tramite Smart Steel Sales.

**SEC1**: facciata pubblica `SECURITY INVOKER`, implementazione auditata sotto `sec1_public` con `SECURITY DEFINER`, `search_path=''`, cap 24 fonti × 25 osservazioni ciascuna e 80 caratteri di ricerca; soli produttori IT `published` con ruolo `producer`, fonte `official_link_observed` e `link_only`, osservazione `first_party_observed`. Nessun dato da candidati, claim aziendali, email, Storage, SKU privati, grants B2 o coda.

## Iniziale senza bloccare l'indicizzazione

Prima di questa PR è stata eseguita una acquisizione *link-only* idempotente di tre pagine prodotto mancanti, già presenti fra le osservazioni ufficiali:
- Acciaitubi / Welded construction tubes
- Alessio Tubi / Prodotti
- Padana Tubi / Acciaio al carbonio

La vista quindi include **15 fonti su 9 aziende e 64 osservazioni tecniche** al momento della lettura. I numeri sul sito derivano dalla query live, non da const hardcoded. Queste 15 fonti sono **riferimenti** a siti ufficiali e non copie PDF né 15 autorizzazioni B2. Un audit dei diritti può limitare eventuali ulteriori estrazioni/copie; la consultazione del link non viene bloccata in attesa del claim aziendale.

## Evoluzione

- Ingestion crawler **first-party link discovery**: monitorare cataloghi ufficiali pubblici, segnare provenienza, data, URL, status, deduplicare, e classificare singoli attributi con citazione; mai scaricare/archiviare copie di PDF terzi senza diritti specifici.
- C2.B issuer per documenti forniti dagli amministratori aziendali verificati: registrazione diritti B2, worker Railway; la sua attivazione è uno step separato.
- C3 verifica geometrica righe/intestazioni e tuple esatte con origine pagina/cella; `manufacturer_confirmed` richiede esplicita conferma del produttore. Fatti osservati restano `pending_confirmation` per visibilità, RFQ/stock/negoziazione si basano su stati più forti.
- Conferma dichiarativa aziendale e revoca/stato di aggiornamento da Company Hub, non una revisione umana centrale per ogni singolo fatto.

## Rilascio

1. Gate P0 Required + SEC1 + frontend TypeScript e test + Supabase rebuild dal branch definitivo.
2. Merge protetto e migrazione additiva una volta sola in produzione.
3. Test reale con `SET ROLE anon`: lettura soli documenti pubblici, nessun accesso alle tabelle private.
4. Vercel READY; verificare il percorso `/network/cataloghi` e CTA dalla Home Network/PRO. QA 390/320/1440.
