# Smart Steel Sales — Network PRO F.1 / F.2

**Stato:** implementazione in PR, **non** checkout live. Nessun pagamento effettuato. L'amministratore aziendale non deve fare richieste o attendere un'approvazione: acquisto valido → sblocco automatico.

## Prodotto

F.1: 4 moduli per ruolo industriale, territorio IT oppure EU, opzione mensile/annuale. Un'unica sottoscrizione aziendale con tariffa in funzione del numero di moduli. Stripe Checkout ospita il pagamento, Stripe Tax gestisce gli importi fiscali in checkout. Il browser non imposta prezzo, cliente Stripe o organizzazione destinataria.

F.2: webhook firmato **e** lettura API Stripe in tempo reale, verificando sessione, organizzazione, subscription/customer, prezzo, fattura **pagata**, valuta e periodo. Il registro append-only Supabase viene aggiornato in transazione; la query Network PRO esistente legge i diritti per modulo e territorio e le loro scadenze. Il ritorno di Checkout non dimostra il pagamento, serve solo per chiedere al server la verifica e mostrare lo stato. Rinnovi pagati estendono la scadenza; mancati pagamenti non estendono; al termine del periodo il diritto scade senza intervento umano. L'evento firmato di cancellazione effettiva revoca i moduli.

## Configurazione obbligatoria (solo server; mai nel frontend)

- `NEXT_PUBLIC_SITE_URL`: origin HTTPS esatto del sito, senza path; localhost HTTP ammesso soltanto in sviluppo.
- `SUPABASE_SERVICE_ROLE_KEY`: chiave di servizio confinata a route e server actions; non esporla mai su client.
- `STRIPE_SECRET_KEY`: chiave server Stripe `sk_test_...` prima di configurare la live.
- `STRIPE_WEBHOOK_SECRET`: signing secret esatto del webhook `/api/webhooks/stripe-netpro`.
- `STRIPE_NETPRO_PRICE_IDS_JSON`: JSON con **16** chiavi `IT:monthly:1` ... `EU:annual:4` verso Price ID `price_...` approvati; l'importo in Stripe deve coincidere esattamente con la quotazione mostrata dal server.
- `STRIPE_NETPRO_PORTAL_CONFIGURATION_ID`: configurazione del Customer Portal limitata a metodo di pagamento, fatture e disdetta. **Disabilitare** cambio piano/prezzo dal portale fino a supporto verificato di upgrade/downgrade.
- `NETPRO_BILLING_ENABLED`: lasciare `false` prima di aver completato i gate, approvato listino/tassazione e verificato ambiente merchant. Solo con valore `true` e tutte le credenziali rilevanti il checkout viene mostrato come disponibile.

L'attuale `NETWORK_PRO_PRICE_BOOK` è ancora una proposta in codice (e `purchasable:false`); non procedere con acquisti veri prima di approvazione commerciale/fiscale. Confronto del prezzo a checkout: EUR, interval Stripe month/year, importo in centesimi uguale alla tariffa sul sito (IVA determinata da Stripe). Una configurazione incompleta o un prezzo differente blocca il checkout.

Webhook Stripe da abilitare: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Gli eventi devono essere validati con timestamp e HMAC; un evento sconosciuto non aggiunge accessi.

## Configurazione e sequenza di rilascio

1. Confermare prezzi reali, merchant Stripe verificato, tasse, condizioni B2B e diritto di recesso/termini abbonamento, comunicazioni fiscali; scegliere test-mode per la prima prova.
2. Integrare PR su main **solo dopo** merge della [PR #1316](https://github.com/ctimaru/steel-sales-ai/pull/1316), riallineamento e gate P0/Chrome/Security sul medesimo HEAD. Mai eseguire il secondo deploy nello stesso giorno senza deroga.
3. Applicare le migrazioni `20261113180000_netpro_f1_checkout_intents.sql` e `20261113180500_netpro_f2_paid_entitlements.sql` su Supabase (dev/test prima, produzione solo nella finestra autorizzata); verificare permessi: browser senza CRUD sulla tabella, RPC F2 eseguibili solo dal ruolo service.
4. Configurare le variabili segrete in Vercel lato server e il webhook di produzione puntato al dominio ufficiale. Abilitare `NETPRO_BILLING_ENABLED=true` **solo dopo il pilot**.
5. Con Stripe test-mode: acquisto con carta test → invoice realmente paid → nuova riga checkout intent con `status='paid'`, ledger eventi automatici per tutti e soli moduli acquistati → accesso Network PRO sulla stessa sessione. Altra azienda e altri moduli restano bloccati.
6. Ripetere pagamento fallito, evento duplicato, evento tardivo, disdetta a fine periodo, revoca immediata, rinnovo pagato, sospensione/errore provider; monitorare il tempo di sblocco. Chrome desktop 1440 e mobile 390/320.

## Limiti da affrontare prima del go-live completo

- **Upgrade/downgrade senza interruzione** non ancora implementati: il vincolo iniziale di una sottoscrizione attiva per azienda impedisce un secondo checkout; il portale deve impedire cambi prezzo non gestiti. Sviluppare migrazione di piano con invoice verificata e sostituzione atomica dei diritti.
- Gestione automatica di rimborsi e chargeback, riattivazioni dopo dispute vinte, recupero checkout pendenti e monitoraggio/retry degli eventi bloccati: da collaudare esplicitamente prima di aprire il live.
- Nessun collegamento Stripe o test di pagamento reale è stato eseguito con questo codice finché non saranno fornite le credenziali e l'account merchant.
