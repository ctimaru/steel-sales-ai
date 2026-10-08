# SP1 — Steel Pulse | Source & Legal Governance
**Data:** 2026-10-08  
**Ambito:** Smart Steel Sales, feed professionale steel/tube.  
**Stato:** fondazione contrattuale; NO crawler attivo, NO contenuti terzi ripubblicati, NO rollout UI.  
**Decision owner:** Platform Owner + referente legale/editoriale. I rilievi qui sotto non sostituiscono un parere legale.

## Scopo e perimetro
Il feed Steel Pulse deve incentivare il ritorno spontaneo di utenti in login e Workspace, distinguendo:
1. **Fatti e statistiche:** materiale di partenza per nuovi commenti/focus redatti da Smart Steel Sales, se accessibile e utilizzabile legittimamente.
2. **Pubblicazioni/editori:** nessuna riproduzione di articoli, copertine, foto, snippet o feed completi senza analisi dei diritti e/o accordo.
3. **Dati aziendali:** mai includere email, contatti privati, richieste RFQ, pricing, nomi di aziende della memoria privata o altra informazione dei tenant.
4. **Deep link:** esporre esclusivamente collegamenti permessi dalle condizioni delle singole fonti, con source attribution e separazione netta fra redazione originale e contenuto editoriale altrui.

Non dedurre una licenza commerciale da mera accessibilità web, `robots.txt`, RSS, Google News, un link o una sintesi AI. L'eccezione TDM non attribuisce automaticamente diritti di pubblicazione.

## Normativa e lettura prudenziale
- **Direttiva (UE) 2019/790, articoli 4 e 15:** riserva dei diritti per text/data mining; diritto connesso degli editori con eccezioni per hyperlink, singole parole ed estratti molto brevi. [EUR-Lex](https://eur-lex.europa.eu/legal-content/IT/ALL/?uri=CELEX%3A32019L0790).
- **Legge 633/1941, art. 43-bis e regolamento AGCOM 3/23/CONS:** impatto sugli aggregatori di notizie/rassegne e negoziazioni. [AGCOM](https://www.agcom.it/competenze/piattaforme-online/diritto-dautore-e-dei-diritti-connessi/equo-compenso-le-pubblicazioni-di-carattere).
- **CC BY 4.0**: attribuzione, link alla licenza, indicazione modifiche; attenzione alle componenti di terzi e marchi. [Creative Commons](https://creativecommons.org/licenses/by/4.0/).
- **Diritti sui database**: acquisizioni massive/ripetute vanno valutate indipendentemente dalla brevità di un estratto e dalla citazione di fonte.

## Prima source matrix (preliminare, non autorizzazioni)
| Source ID | Fonte | Canale candidato | Condizioni note | Decisione iniziale |
|---|---|---|---|---|
| eurostat | Eurostat | API dati | Riuso commerciale generalmente consentito con attribuzione; eccezioni su dati terzi e specifiche pubblicazioni | `candidate`, niente fetch/publishing |
| oecd | OECD | Pubblicazioni | Molti testi dal 1 luglio 2024 CC BY 4.0; verificare licenza di ciascun report e componenti terzi | `candidate`, niente fetch/publishing |
| worldsteel | World Steel Association | News/comunicati | Citazioni attribuite descritte nel copyright notice; non è licenza generale per ridistribuire testi o immagini | `candidate`, niente fetch/publishing |
| eurofer | EUROFER | Press room | Termini specifici di riuso/automazione non ancora verificati | `candidate`, niente fetch/publishing |
| siderweb | siderweb | Editoria | Da verificare accordo editoriale e condizioni di acquisizione | `candidate`, niente fetch/publishing |
| steelorbis | SteelOrbis | Editoria | Condizioni esplicitamente restrittive anche su link e reimpiego | `prohibited`, solo accordo scritto potrà sbloccare |

Fonti primarie:
- [Eurostat — copyright e riuso commerciale](https://ec.europa.eu/eurostat/help/copyright-notice)
- [Eurostat — accesso API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/)
- [OECD — condizioni e open access](https://www.oecd.org/en/about/terms-conditions.html)
- [worldsteel — copyright](https://worldsteel.org/global/copyright/)
- [SteelOrbis — condizioni d'uso](https://www.steelorbis.com/support/terms-of-use.htm)

## Gate autorizzativi (fail-closed)
Il codice in `apps/web/lib/steel-pulse-source-governance.ts` definisce il catalogo iniziale e la funzione `authorizeSteelPulseAction`. Nessuna fonte è abilitata inizialmente.

Prima di qualsiasi `discover_metadata`, `ingest_statistical_data`, `summarize_facts`, `publish_news_card` o `reuse_media` servono:
- fonte nello stato `approved`, permessi specifici all'operazione, URL HTTPS verificato contro hostname allowlist esatta;
- fonte e documento licenza esaminati, evidenza di permesso, approvazione editoriale + legale identificabile, date valide e scadenza di riesame;
- prima di qualunque acquisizione automatica: controllo live dei termini/robots, limiti di frequenza, redirect sicuri, rispetto della fonte e nessun bypass paywall/login;
- prima di sintetizzare/pubblicare: esame licenza puntuale dell'item; verifica umana fattuale, privacy, fonte/link originale, attribuzione, modifiche dichiarate e verifica media separata;
- in caso di revoca, cambio licenza, contestazione, scadenza o fonte non disponibile: `suspended`/nessuna acquisizione e rimozione o blocco delle card nei termini previsti.

**Avvertenza:** SP1 è un contratto di autorizzazione software, NON un crawler o una garanzia tecnica su robots e rate limit. In SP2 quei segnali devono essere misurati da componenti reali ad ogni fetch, controllando anche tutti i redirect.

## Dati e audit richiesti per SP2
Schema previsto in Supabase, privato e con RBAC Platform:
- `pulse_sources`: dominio consentito, policy URL/hash, canale, permessi, motivazione, riesame e stato.
- `pulse_source_rights_ledger`: append-only (source ID, revision/hash policy, precedente/nuovo stato, reviewer e legal approver, permesso, istante, scadenza, licenza, motivazione).
- `pulse_items`: canonical URL, discovery timestamp, timestamp origine, fonte, lingua, content hash, source-rights revision, categorie, diritti specifici, status editorial.
- `pulse_publication_ledger`: decisioni editor/reviewer, link originario, attribuzione, avviso modifiche, approvazioni, revoche/rimozioni.
- Evitare memorizzazione di copie integrali di articoli o immagini non licenziati; niente tenant data dentro il feed condiviso.

Solo Platform Owner o operatore espressamente delegato potrà validare la pubblicazione; la revisione legale è distinta. Un edit client non costituisce approvazione. Ogni modifica resta tracciata e può essere revocata. Prima del lancio commerciale: sign-off legale.

## Checklist di uscita SP1
- [x] Prima matrice delle fonti con stato fail-closed.
- [x] Riferimenti ufficiali di diritto UE, AGCOM, licenze e termini di utilizzo delle fonti confermate.
- [x] Contract tipizzato e controlli URL, operazioni autorizzate, documento, scadenza, robots/rate, rights per item, privacy ed editor.
- [x] Test regressione su fonti predefinite non attive, URI malevoli, permessi e pubblicazione.
- [ ] Verifiche legali specifiche + firme sulle fonti che intendiamo attivare (SP2 pre-requisito).
- [ ] Database/ledger operativo, crawler controllato, UI editoriale e pubblicazione (SP2–SP4).

## Next: SP2 — News Ingestion Foundation
Partire dal dataset Eurostat o da una pubblicazione OECD **solo dopo** il permesso puntuale e il controllo automatizzato/registrato su termini e robots; API/feed prima di HTML crawling. Progettare meccanismo anti-duplicate, cron limitato e revisione manuale. Il login non deve degradare in caso di indisponibilità di Steel Pulse.
