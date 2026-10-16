# CALC-INT4.2 — Search Console Evidence & Content Prioritization

Data di avvio: **16 ottobre 2026**.
Owner: Smart Steel Sales · WC / Google Measurement (G1).
Stato: implementazione pipeline locale, **baseline internazionale GSC non disponibile** (non confondere con zero traffico).

## Decisione

Prima di aprire nuovi URL tecnici DE/FR/ES, raccogliere dati osservati tramite CSV gratuiti esportati da Search Console. La prova GSC Wizard è scaduta e le sue API restituiscono \`payment_required\`. La proprietà Search Console e la sitemap erano state confermate dall'utente il 14 ottobre; questo problema del connettore **non equivale** a una proprietà Google non verificata. Non comprare automaticamente un piano per ripristinare GSC Wizard.

La guida nazionale e il primo approfondimento sono online dal **16/10/2026**: **non esistono ancora 28 giorni di dati post-pubblicazione** per valutare onestamente l'effetto di CALC-INT4/4.1. Si possono però leggere dati storici del calcolatore e delle pagine precedenti, senza attribuire quell'intero periodo ai nuovi articoli.

## Scaricare un campione reale da GSC, senza abbonamenti

1. Aprire https://search.google.com/search-console usando l'account della proprietà \`smartsteelsales.com\`, scegliere **Risultati di ricerca > Prestazioni** e il tipo **Web**. Abilitare l'intervallo **ultimi 28 giorni completi** (oppure 7 per un segnale iniziale, da non usare come priorità), annotare esattamente le date di inizio/fine visibili.
2. Aggiungere il filtro **Paese: Germania** (non "Lingua"), il filtro **Pagina contiene** \`/de/knowledge/tubes\` e verificare che **nessun altro filtro query/device** sia applicato. Il paese indica dove si cerca; \`/de/\` indica la versione linguistica della landing. È legittimo misurare separatamente \`/de/\` dai paesi FR/ES.
3. Esportare i dati in **CSV** dal report; recuperare la tabella **Query** (es. \`Queries.csv\` / \`Top queries.csv\`) e la tabella **Pagine** (\`Pages.csv\` / \`Top pages.csv\`) dall'archivio ottenuto. Rinominarle, per es., \`DEU-de-queries-28d.csv\` e \`DEU-de-pages-28d.csv\`.
4. Ripetere con **Paese: Francia** e URL \`/fr/knowledge/tubes\`, quindi **Paese: Spagna** e URL \`/es/knowledge/tubes\`. Se servono mercati fuori dal paese della lingua, esportarli come file **distinti**, non sovrascrivere il parametro \`country\` per renderlo uguale alla \`locale\`.
5. Ricordare il limite Google UI di **massimo 1.000 righe rappresentative** per export; non sommare le righe esportate come se rappresentassero tutte le impression della proprietà. Google può inoltre escludere query anonimizzate e dati recenti incompleti. Fonte: https://support.google.com/webmasters/answer/12919797 e https://developers.google.com/webmaster-tools/v1/searchanalytics/query.

**L'export standard delle tabelle Query e Pagine non costituisce una tabella congiunta query→pagina.** Per individuare possibili sovrapposizioni di URL per la *stessa* query servirebbe in futuro un export congiunto per query+pagina ottenuto tramite API Search Analytics autorizzata o un dataset realmente equivalente. Non stimare la dimensione mancante tramite join dei due CSV.

## Usare la pipeline locale (nessuna modifica al sito o credenziali)

Dalla directory \`apps/web\`:

\`\`\`bash
node scripts/calc-int4-2-gsc-evidence.mjs --example
\`\`\`

L'output è uno scheletro JSON **privo di metriche fittizie**. Creare la cartella \`apps/web/private/gsc-evidence/\` (ignorata da Git) e salvare lì \`manifest.json\` più i CSV. Esempio con i soli export tedeschi:

\`\`\`json
{
  "property": "sc-domain:smartsteelsales.com",
  "exportedAt": "2026-10-16",
  "exports": [
    {
      "path": "./DEU-de-queries-28d.csv",
      "dimension": "query",
      "locale": "de",
      "country": "DEU",
      "startDate": "2026-09-16",
      "endDate": "2026-10-13",
      "searchType": "web",
      "pageFilter": "/de/knowledge/tubes",
      "filtersVerified": true,
      "finalData": true
    },
    {
      "path": "./DEU-de-pages-28d.csv",
      "dimension": "page",
      "locale": "de",
      "country": "DEU",
      "startDate": "2026-09-16",
      "endDate": "2026-10-13",
      "searchType": "web",
      "pageFilter": "/de/knowledge/tubes",
      "filtersVerified": true,
      "finalData": true
    }
  ]
}
\`\`\`

**Sostituire le date con quelle reali del report.** \`filtersVerified: true\` dichiara che sono stati controllati paese/pagina/tipo Web; \`finalData: true\` solo per giorni che GSC segnala come finalizzati. Se è ancora provvisorio, indicare \`false\`: il report mostrerà i numeri come *non validati* e non li promuoverà a priorità SEO. La pipeline non si connette a Google.

\`\`\`bash
node scripts/calc-int4-2-gsc-evidence.mjs \
  --manifest private/gsc-evidence/manifest.json \
  --output private/gsc-evidence/report.md
\`\`\`

Il report Markdown resta **in locale** e può essere incollato in Notion su decisione del founder. Non committare in GitHub file CSV originali, manifest con dati sensibili o report con query proprietarie. È prevista una \`.gitignore\` dedicata. La pipeline non salva credenziali, non trasmette email o RFQ e non altera il database.

## Validazioni e priorità

- CSV UTF-8/UTF-8 BOM, delimitatori \`,\` o \`;\`, stringhe quotate, header comuni IT/DE/FR/ES/EN, percentuali e formati numerici locali. File irregolari bloccati, non interpretati come zero.
- Ogni export deve dichiarare proprietà, data di download, finestra esatta 7/28 giorni, **paese di ricerca**, **locale della landing**, prefisso pagina e dati finali/filtri. Export duplicati sullo stesso scope sono rifiutati.
- Le URL della dimensione Pagine devono appartenere a \`www.smartsteelsales.com\` o \`smartsteelsales.com\` in HTTPS ed essere sotto il prefisso della lingua scelta. Non leggere siti di terzi.
- Solo con osservazioni **finali su 28 giorni completi** classificare:
  - **P1_CTR**: almeno 30 impression, posizione media tra 4–20 e CTR inferiore al 3% → verificare query→URL e migliorare il contenuto/snippet esistente. Soglie operative interne, non soglie ufficiali di Google.
  - **P2_INTENT**: almeno 30 impression, posizione media 20–50 → verificare se esistono gap tecnici e migliorare la copertura esistente.
  - **LOW_SIGNAL**: meno di 30 impression → osservare senza creare nuove pagine.
  - **OBSERVE_7D / VERIFY_EXPORT**: periodo troppo breve, CSV provvisorio o filtri non confermati → nessun ranking operativo.
  - **EXCLUDE_BRAND**: query brand escluse dalla coda editoriale.
- L'appartenenza al cluster è una verifica di lessico/tema, non una dichiarazione che quella query porta traffico a uno specifico articolo. Se non esiste un export congiunto, il report lo esplicita. Una query che appare su almeno **2 URL** con **>=10 impression per URL** nello stesso export congiunto attiva \`URL_OVERLAP_REVIEW_NOT_PROVEN_CANNIBALIZATION\`: solo un approfondimento, non prova di cannibalizzazione.
- Il report è una **coda di revisione**. Non altera automaticamente title, editoriali, norme, canonical, sitemap, attribuzioni geografico-linguistiche, né apre automaticamente nuovi cluster.

## Roadmap prioritaria (finché mancano dati reali)

| Decisione | Stato | Gate |
| --- | --- | --- |
| Stabilità calcolatore internazionale e 3 pillar | Già pubblicati | Nessun intervento sul motore peso |
| DE DIN EN 10219-2 dimensioni/tolleranze | Pubblicato come satellite | Misurare query di ricerca e URL |
| FR EN 10204 tipo 3.1 e documenti | Pubblicato come satellite | Misurare query di ricerca e URL |
| ES UNE-EN 10210/10219 differenze | Pubblicato come satellite | Misurare query di ricerca e URL |
| Nuovi argomenti DE/FR/ES | **ON HOLD — evidenza insufficiente** | Domanda reale 28d + intento distinto + fonti normative |
| Auto API / abbonamenti GSC Wizard | **NON necessario** | Solo se il valore supera il costo e l'owner lo approva |

## Acceptance

- [ ] Pipeline deterministica con test per filtri, locale, parsing, date, duplicati, assenza dato e query-page.
- [ ] Nessuna lettura OAuth né chiamate esterne; no nuovo runtime production.
- [ ] Protected CI verde, merge solo dopo verifica.
- [ ] Notion aggiornata con PR/commit e vincolo dati GSC.
- [ ] Il rapporto reale verrà valorizzato **solo dopo che l'utente abbia esportato dati autentici**.

## Riferimenti
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://support.google.com/webmasters/answer/12919797
- [CALC-INT4.1](https://github.com/ctimaru/steel-sales-ai/pull/613)
- [Measurement OS G1](https://app.notion.com/p/3eff059cecb581e7ad98ff9ae71dd72c)
