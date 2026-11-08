# NET-IT-USER1.B.2 — Acquisizione privata di 21 prospect italiani e readback Supabase

**Data operativa:** 8 novembre 2026 · **PR:** #1193 · **Tracking:** #1190

## Esecuzione confermata in produzione (non pubblicazione Network)

- **21/21** nuovi record inseriti atomicamente in `private.network_web_research_seeds` tramite SQL DML, guardato da un advisory transaction lock e preflight fail-closed: dominio sorgente, sintassi URL HTTPS, ruolo proposto `end_user`, lunghezza dei riassunti, ID ricerca, dedup contro 11 registri e blacklist.
- `country_code='IT'`, `batch_key='NET-IT-USER1B-PRIVATE21-20261108'`.
- **21 domini unici e 21 research_id distinti**, 0 collisioni con canonical o `network_core_target_leads`, 0 URL privi di HTTPS.
- Corsie private: **11 `web_profile_review_pending`**, **10 `industrial_fit_review`**.
- Per tutti i record: `proposed_role='end_user'`, `source_kind='first_party_web'`, `claim_status='unclaimed'`, `verification_status='web_sourced_unverified'`, `publication_status='not_published'`.
- **0 incrementi di `public.network_companies`, `public.network_core_target_leads`, company role assignments o RFQ**. Readback successivo: Italia 278 published canonical, 0 published end_user, 423 lead CORE end_user, 21 private IT research.
- In revisione live dei siti first-party, il claim di SICOS su sezioni tubolari in acciaio non era direttamente provato dalla homepage; pertanto il **riassunto privato è stato corretto** per indicare solamente produzione di trabattelli in acciaio e verifica necessaria del tubo. Nessuna norma/dimensione inventata.

## Cosa è stato — e non è stato — fatto

**Questa è importazione nel registro privato di ricerca**, già separato dal pubblico e dalla procedura Platform. Non è staging tramite `netcov2_operator_batch_stage`, non è review `netcov1_review_targets` e non è pubblicazione/claim. L'inserimento privato non attribuisce diritti di crawl automatico né consente all'utente Free/Pro di consultare il record.

Il registro supporta `country_code='IT'` e `proposed_role='end_user'`, vieta fisicamente `publication_status='published'`. Nessuna funzione di autenticazione della console è stata simulata, nessuna sessione user JWT è stata costruita.

Prima di inviare i dati alla coda di review Platform, serve accesso autentico a `https://www.smartsteelsales.com/platform/company-discovery/end-users`, attestazione appropriata e riconciliazione dei nomi legali e dei diritti sulla fonte. Il profilo browser di automazione attualmente non ha accesso autenticato, quindi il passo non è stato eseguito.

## Separazione lotti

| Lotto | Categoria | Quantità | Stato |
|---|---|---:|---|
| NET-IT-USER1.A | Prospect già in CORE | 25 | Manifest PR #1191, nessun cambio di stato |
| NET-IT-USER1.B2 | Nuovi IT | 21 | **Importati nel research store privato**, unclaimed/unverified/not_published |
| NET-IT-USER1.B hold | CTS, Piscopiello, Effe.Di, Electric Metal/brand | 4 | **Esclusi dall'importazione**, in attesa di identity resolution |
| Network pubblico IT | Canonical published | 278 | Invariato |
| Network pubblico IT | Ruolo end_user published | 0 | Invariato |

## Prossima esecuzione a valore

1. Verificare con un account Platform realmente autenticato i 11 profili sulla corsia `web_profile_review_pending` e i 10 `industrial_fit_review`; destinare alla coda CORE solo record con identità/sito/diritti ammissibili.
2. Mettere al primo posto le applicazioni più pertinenti a tubolari strutturali (serre, ponteggi, recinzioni); non confondere l'uso di un tubolare con un acquisto diretto o una classificazione EN 10219.
3. Riconciliare 4 hold senza duplicare identità commerciali. Conservare il percorso Rivendica → Arricchisci → Verifica.
4. Dopo il gate di revisione, eventuale bulk claimable su Network con lettura dei nuovi conteggi pubblici. Nessun deploy solo per import privato.

**Nessun merge o deployment su Vercel eseguito dall'importazione privata.**
