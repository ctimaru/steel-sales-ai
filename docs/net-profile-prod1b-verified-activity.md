# NET-PROFILE-PROD1.B — Attività e prodotti, automatici ma documentati

**Decisione del fondatore, 23 novembre 2026.** Prima tab della scheda produttore: attività, prodotti, lavorazioni, norme e capacità tecniche documentate. La prima milestone di produzione mette online **solo** attività e famiglie prodotto con un'esplicita relazione produttiva, citata dal sito first-party; nessuna deduzione da ruolo, ATECO, nome o semplice presenza del prodotto nella pagina.

## Stato misurato all'avvio

Italia: 266 produttori canonical pubblicati; 142 con descrizione diretta e 10 con almeno una relazione prodotto strutturata. Mancano 124 descrizioni dirette e 256 relazioni strutturate. Il crawler ha già 568 pagine di prodotto first-party processate su 152 producer italiani, ma alcune candidature esistenti confondono chi produce tubi e chi produce macchinari per lavorare tubi: vietato accettarle indiscriminatamente.

## Funzionamento

- Nuova coda privata idempotente, ordinata Italia → Romania → resto d'Europa, lotti da 1–10, lease atomico e lock SKIP LOCKED. Retentativi e intervalli di aggiornamento 3/30/45/90 giorni per errore, blocco, assenza di prove e verifica.
- All'avvio il cron produttori Railway *già esistente*, solo quando NETPROFILE_PROD1B_ENABLED=true ed è installata la migrazione 20261123151000, chiede un lotto, consulta al massimo pagina prodotto già elaborata più homepage ufficiale, e applica il fetcher HTTP/robots/SSRF già usato dal worker. Nessuna seconda automazione.
- L'estrattore produce soltanto etichette di famiglia e una sintesi originale per una frase esplicita e ravvicinata tipo «Produciamo tubi» o «Produzione di profilati». Blocca distributori, keyword isolate e costruttori di macchine/impianti; una relazione ambigua è **assenza di prova**.
- Per ogni fatto accettato registra *singola breve citazione, URL ufficiale, hash del testo sorgente, extractor_version e data*, e scrive private.network_company_enrichment come accepted. Il reader Free/Pro **già esistente** netprofile1d_profile_evidence mostra gli elementi senza modificare i campi aziendali di proprietà del produttore.
- Non scrive in network_company_products, che richiede un'autonoma riconciliazione del rapporto produce/processes/distributes e codici catalogo; queste nuove etichette sono **famiglie documentate di profilo**, non SKU e non inventario, prezzi, dimensioni o certificazioni.
- Non tocca claimed_status, verification_status, publication_status, stock, RFQ, offerte o private Commercial Memory. Non utilizza le PR DATA2 #1297/#1300, sospese in Notion.
- RPC per scritture e letture delle code sono accessibili **solo da service_role**; la tabella audit privata e le code hanno RLS. Nessun segreto nel frontend.

## Rilascio sicuro

1. Validare la migrazione SQL e la suite negativa Python (fabbricanti macchine, distributori, falsi siti, link fuori dominio, privacy).
2. CI GitHub P0/SEC1, integrazione e merge protetto. Applicare la migrazione nello slot di rilascio autorizzato (max un deploy al giorno).
3. Lasciare NETPROFILE_PROD1B_ENABLED=false al primo deploy. Abilitare solo dopo aver verificato le RPC e il readback senza esposizioni anon/authenticated.
4. Pilot su 5 produttori; audit manuale **del campione**, non approvazione per singola scheda. Misurare: processed, accepted_facts, published_profiles, no_evidence, blocked, non sovrascrittura di descrizioni dichiarate dall'azienda.
5. Scalare il batch e completare i producer italiani a rotazione; poi RO/EU. Verificare la resa a 1440/390/320 px, ma non introdurre card grandi.
6. Fase successiva: lavorazioni, gradi, norme, gamme, descrizioni più specifiche, solo dopo verifica per singola relazione e allineamento al catalogo PRO.

Il cron esistente continua l'intelligence tecnica anche quando il flag PROD1.B è disattivo. Nessun dato è stato arricchito dalla sola creazione della PR.
