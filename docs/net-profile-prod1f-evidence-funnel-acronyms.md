# NET-PROFILE-PROD1.F — Perché l'arricchimento produttori scarta le fonti?

## Problema misurato (24 novembre 2026)

Alla verifica live: 297 produttori già esaminati, 19 con evidenze accettate, 238 senza prove e 40 bloccati. La coda operativa corrente era a zero, quindi non basta ripetere il crawler per ottenere schede più ricche.

## Intervento

1. Nel worker esistente `net_profile_prod1b` viene misurato, per ogni azienda, il **funnel delle evidenze**: numero di pagine HTML lette, blocchi editoriali attendibili, segmenti esaminati, pagine senza blocchi, frasi contenenti verbi di produzione/lavorazione, frasi che superano i controlli di relazione e frasi respinte dai controlli, fallimenti nel recupero delle fonti. Questi sono **contatori**, non citazioni o dati personali.
2. Il risultato distingue i motivi aggregati: `identity_mismatch`, `source_unavailable`, `no_editorial_blocks`, `no_explicit_verbs`, `rejected_or_unclassified_relation`, `already_known_or_policy_excluded` e `accepted`. Una frase con un verbo non dimostra automaticamente la fabbricazione di un prodotto: il filtro finale resta quello esistente.
3. La migrazione aggiunge unicamente `diagnostics jsonb` al registro **privato** degli eventi di elaborazione, più un RPC service-role-only con limitazioni su schema, campi e grandezza. Vietati HTML, URL, estratti, indirizzi email o altri valori arbitrari. Funzione con grants ridotti e RLS invariata. Le informazioni non entrano mai nella scheda pubblica.
4. Il writer salva le metriche *dopo* la completion principale, con flag `NETPROFILE_PROD1F_DIAGNOSTICS_ENABLED=true`, quindi un malfunzionamento del reporting non può annullare evidenze già verificate. La mancata registrazione compare comunque nell'output del cron.
5. `identity_matches_domain` accetta **solo corrispondenze esatte** fra una sigla legale di 3-12 caratteri e lo stem del dominio, opzionalmente seguito dalla forma societaria. Esempi accettabili: `O.M.O. S.p.A.` / `omospa.it`, `FAR S.p.A.` / `farspa`, `SGP` / `sgp`, `GRA.BER.` / `gra-ber`. Le varianti tipo `O.M.O.` / `omopartner`, `ABS` / `abstagliotubi` e i nomi con prefissi/label spuri restano bloccate.

## Controlli e attivazione

- P0 worker + SQL, nessun nuovo crawler, nessun allentamento del meccanismo di prima prova e nessun arricchimento speculativo.
- Merge protetto, applicazione migrazione Supabase **prima** di attivare l'output dei contatori sul servizio Railway esistente; rilasciare il worker sul commit mergiato.
- Canary di cinque aziende eseguito con il cron esistente dopo l'avvio della nuova versione, misurando (a) quante pagine e blocchi leggiamo, (b) per quale motivo le frasi sono scartate, (c) quali informazioni **effettivamente verificate** sono apparse nelle schede.
- Non auto-sbloccare in massa i 40 record bloccati: un riconoscimento più preciso non equivale a una prova industriale; il sito ufficiale e i filtri di produzione restano obbligatori.