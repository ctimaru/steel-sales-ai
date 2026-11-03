# RELEASE-OPS1 — Una sola pubblicazione Vercel per giornata (proposta)

## Stato: preflight pronto, **protezione automatica NON attivata**

Alla verifica del 2 novembre 2026, `apps/web/vercel.json` consente ancora deployment Git automatici su `main` e su `preview-*`. Il vecchio `ignoreCommand` evita solo build senza modifiche web: **non** limita il numero di deploy nello stesso giorno. GitHub e Vercel hanno oggi più deployment Production READY in una giornata, quindi la regola operativa “massimo 1 al giorno” **non è soddisfatta né garantita** dall'infrastruttura.

Questa PR aggiunge **solo** il controllo manuale, in lettura:
- `apps/web/scripts/release-ops1-preflight.mjs` interroga `GET https://api.vercel.com/v6/deployments` con credenziali Vercel read-only, progetto e team fissati da variabili GitHub, target `production`, storico paginato, data locale `Europe/Rome` compresa l'ora legale.
- Il controllo restituisce exit `0` solo se **nessun** deploy READY o in corso per la giornata; exit `2` se almeno uno è presente; exit `3` se manca accesso o i dati non sono attendibili (**fail closed**).
- `.github/workflows/release-ops1-preflight.yml` è `workflow_dispatch`, senza merge o deploy. Richiede un secret `VERCEL_TOKEN` con permessi minimi di sola lettura e le variabili `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`; niente token in repository né log.
- Node test con fixture coprono timezone CET/CEST, query scoping, paginazione, stati e comportamento di errore.

## Limite esplicito

**Il preflight NON impedisce i deploy Git automatici su `main`.** Non è un gate GitHub Required Check né una modifica operativa Vercel. Non si può affermare “un deploy al giorno garantito” finché la modalità di pubblicazione resta automatica.

## Attivazione futura: release controllata (decisione di governance separata)

1. Concludere prima le release School #1085 (A/B/C) e #1087 (D), oppure pianificare in modo esplicito una migrazione con smoke e rollback nella finestra di rilascio autorizzata; non mescolare attivazione della governance e feature School.
2. Abilitare e collaudare il preflight GitHub in modalità read-only con token **fornito come secret GitHub**, non via chat. Verificare che le variabili identifichino il progetto Vercel corretto e l'account autorizzato.
3. Solo dopo approvazione separata della nuova procedura, modificare `apps/web/vercel.json` per disabilitare deploy Git automatici su `main`, mantenendo preview autorizzate. Riferimento Vercel: https://vercel.com/docs/project-configuration/git-configuration. Conservare rollback e verifica effettiva delle impostazioni in Vercel.
4. Configurare **un solo** workflow/job di rilascio protetto, con `environment: production` e reviewer, che esegua: preflight → verifica SHA/CI/review → lock di concorrenza → deploy della **SHA esatta** → verifica `READY` + smoke. Applicare enforcement a TUTTI i percorsi di deploy manuale, inclusi dashboard, CLI e agenti. La concorrenza GitHub da sola non blocca gli utenti che chiamano direttamente Vercel: regolare i permessi e la procedura.
5. Dopo aver attivato il nuovo percorso, verificare 3 casi: nessun deploy oggi (consentito); già READY (bloccato); deployment in coda (bloccato). Gestire recovery per un deploy fallito senza bypass automatici.

## Casi che NON copre questa PR

- Non disattiva la connessione Git Vercel e non impedisce forzature manuali in dashboard/API.
- Non crea, aggiorna o promuove deployment; non tocca domini, Supabase, Railway, PR School o limiti di budget.
- Non imposta permessi o secret sul repository. Quando non configurati, il job fallisce: non produce falsi PASS.

## Evidenze e priorità

- Release School: [#1085](https://github.com/ctimaru/steel-sales-ai/pull/1085) → [#1087](https://github.com/ctimaru/steel-sales-ai/pull/1087) prima dell'eventuale attivazione del governo deploy.
- [Vercel — Git Configuration](https://vercel.com/docs/project-configuration/git-configuration); [Vercel — Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings).
- I deployment ignorati da `ignoreCommand` **contano comunque come tentativi** per le quote di Vercel: evitare di usare tale meccanismo come controllo del budget e delle release.
