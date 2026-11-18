# NET-PRO-PRODUCERS1.C3.DATA1 — Cataloghi trasformati in dati strutturati, pubblicati subito

Decisione di prodotto 18/11/2026: la ricerca deve offrire direttamente **valori tecnici utilizzabili**. Aprire un PDF non può essere la principale esperienza d'acquisto. Il produttore esercita poi il controllo sui suoi attributi: **conferma**, **rimozione immediata** o **ripubblicazione** dal Company Hub.

## Cosa è effettivamente pubblicato (prima tranche)

- Migrazione additiva di `private.network_producer_structured_facts`, retroattiva sui 64 dati brevi atomici **già osservati** da fonti primarie; nessun dato creato da associazioni arbitrarie. Ogni attributo conserva `source_claim_id`, `company_id`, `product_scope`, tipo, valore, URL della fonte, recensione aziendale.
- **Intervalli dimensionali realmente numerici**: min/max diametro per CHS, min/max lato1-lato2 per SHS/RHS, spessore min/max quando è nella *stessa fonte e frase*. Un valore non indicato rimane NULL. Intervalli non dimostrano tutte le misure intermedie né l'associazione con uno specifico grado/norma.
- **Auto-pubblicazione senza registrazione del link** per ogni nuova osservazione `first_party_observed` proveniente direttamente dal sito primario verificato (dominio effettivo o sottodominio) di azienda italiana già pubblicata come produttore. Trigger Postgres su inserimento e revisione della fonte. Si conserva il permalink originale per audit, non si ricopia la tabella PDF integrale. Nessun claim obbligatorio in fase di scoperta.
- Nuovo RPC `public.netproducers1_structured_public` anon read-only, limitato a 160 attributi e ricerca semplice, `SECURITY INVOKER` con `sec1_public` verificato; RLS deny-all sulle nuove tabelle e audit append-only.
- UI `/network/cataloghi` ora pone **le gamme numeriche e le caratteristiche** al centro. Mostra per produttore e famiglia norme, acciai, sezioni, lavorazioni, una tabella leggibile di forme/dimensioni/spessori. Fonti originali in disclosure opzionale, non un obbligo di navigazione. Dichiarazione costante **«Da confermare dal produttore»** per i dati non approvati.
- UI `/network/manage/cataloghi`: amministratore del produttore con claim aziendale `approved`, prova identità `verified` e membership attiva può confermare, rimuovere o ripubblicare **un singolo attributo**. SQL controlla sempre il company ID corrente; nessun concorrente o membro non autorizzato può moderare.
- Una nuova scansione della stessa fonte **non ripubblica in automatico** un dato rimosso dal produttore. Se la fonte viene invalidata il dato non appare più. Audit delle azioni append-only.

## Semantica industriale obbligatoria

- `pending` significa **dato osservato**, già pubblicato, in attesa di controllo aziendale;
- `confirmed` significa **soltanto questo valore confermato dall'azienda**. Non equivale a un grado × forma × misura certificato o una fornitura corrente;
- `removed` significa cancellato immediatamente dalla vista, recuperabile solo dall'amministratore;
- un vero `manufacturer_confirmed` di una combinazione esatta è un attributo separato da creare solo con evidenza univoca e conferma esplicita della producibilità.
- Non si memorizzano/downloadano copie integrali dei PDF link_only e non si presentano specifiche norme protette come testo riprodotto.

## Prossima estensione importante

La prima tranche normalizza **64 osservazioni esistenti**; non si dichiara di aver letto integralmente tutte le tabelle dei 7 PDF. Occorre ampliare il parser B3.C3 #1442 con mappatura geometrica delle colonne/intestazioni della medesima pagina, unità e celle, distinzione tra gamme e misure esatte, prove riproducibili e ciclo di aggiornamento. Il worker AUTO1 Railway è pinned a commit precedente: non si dichiara il suo codice C2.B attivo finché non è stato rilasciato.

## Gate

1. P0 Required + SEC1 sul final head, SQL tests, typescript e responsive UI.
2. Protected merge, applicazione migrazione unica, verifica con ruolo `anon` dei dati e ruolo fake `authenticated` che NON può modificarli; verifica 64 fatti + numero intervalli.
3. Vercel READY produzione, URL `https://smartsteelsales.com/network/cataloghi`, niente secondo deploy Railway.
