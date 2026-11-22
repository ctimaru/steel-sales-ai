# NET-IT-CARP1.E.3 — FACTS1 | Scheda di decisione legale documentata

> **STATO: BOZZA PER PROFESSIONISTA / SIGN-OFF NON ACQUISITO.** Questo documento è una richiesta di valutazione e un modello di decisione. Non costituisce un parere legale, un consenso delle aziende, una licenza di riuso né un'autorizzazione a pubblicare. Non inserire una firma fittizia e non trasformare i campi vuoti in valori di default.

**Progetto:** Smart Steel Sales — Network aziende industriali italiane  
**Gate:** FACTS1 / `NET-IT-CARP1.E.3`  
**Prima coorte proposta:** 3 carpenterie, **non pubblicate**  
**Destinatario:** professionista legale competente in proprietà intellettuale, diritti sulle banche dati e protezione dati  
**Decisione attuale:** `PENDING_LEGAL_REVIEW`  
**Revisione preparatoria:** 8 novembre 2026  
**Collegamenti:** [Issue FACTS1 #1219](https://github.com/ctimaru/steel-sales-ai/issues/1219) · [PR SQL #1214](https://github.com/ctimaru/steel-sales-ai/pull/1214) · [runbook release](net-it-facts1-legal-platform-release-gate.md)

## 1. Quesito preciso al revisore

> È giuridicamente sostenibile per una directory B2B, secondo il diritto italiano e UE vigente, pubblicare **solo** denominazione e forma giuridica di una società di capitali, paese, dominio/sito ufficiale e *ruolo industriale proposto, da confermare*, ricavati **individualmente da pagine first-party** e presentati con descrizione originale neutrale, senza copiare testo, foto, logo, recapiti personali, cataloghi o classificazioni non documentate, e **senza estrarre directory o banche dati di terzi**? Quali condizioni specifiche, limitazioni, controlli delle fonti e procedure di rettifica/opposizione sono necessari?

Il parere deve distinguere chiaramente **liceità del dato pubblicato**, **liceità della raccolta e del metodo di riutilizzo**, **diritti su eventuali banche dati**, **trasparenza/riservatezza**, **eventuali termini contrattuali delle fonti** e **ruolo delle classificazioni AI**.

## 2. Perimetro tecnico previsto

| Voce | Prima pubblicazione FACTS1 | Esclusioni |
|---|---|---|
| Identità | Ragione sociale di società di capitali riconciliata con sito first-party; verifiche incrociate per omonimi e P.IVA se reperita | Ditta individuale, persona fisica, contatto professionale nominativo |
| Dati visibili | Ragione sociale, paese, sito ufficiale; ruolo `processor_service_provider` **proposto e non verificato** | Slogan, foto, loghi, testi del sito, nominativi, email individuali, telefono diretto |
| Descrizione | Testo originale generico generato dalla piattaforma | Riproduzione dell'espressione creativa delle fonti |
| Claim/status | `unclaimed`, `unverified`; CTA «Rivendica questa azienda» | Dichiarazioni di certificazione, cliente, buyer o approvvigionamento di tubi non verificate |
| Fonte | Pagina web first-party per singola impresa, URL ed evidenze private | Estrazione sistematica di elenchi protetti di terzi, scraping di contatti o pagine dietro login |
| Gestione errori | Rettifica, opt-out/suppression, audit e revisione dell'identità | Inserimento automatico in RFQ, outreach non richiesto |

**Distinzione chiave:** la decisione `factual_metadata_only_reviewed` **non** significa `licensed` né concede autorizzazione a riprodurre contenuti protetti.

## 3. Casi concreti del pilot da esaminare

| Sito first-party | Denominazione per revisione | P.IVA osservata | Nota |
|---|---|---|---|
| https://www.bandinicantarelli.com/dove-siamo-e-contatti.html | Bandini e Cantarelli S.r.l. | 00148980345 | Seed privato ha nome abbreviato «Bandini Cantarelli» |
| https://www.ferrinoxsrl.it/ | Ferrinox S.r.l. — **Fidenza (PR)** | 01706870340 | Omonimo: altra Ferrinox S.r.l. a Resana (TV), sito `ferrinox.it`, P.IVA 01341740288; identità per dominio/P.IVA, non solo nome |
| https://www.presmetalspa.it/it/contatti | Pres Metal S.p.A. | 00871340238 | Seed privato «Pres Metal» senza forma giuridica |

Il file `services/worker/data/net_it_facts1_carpenteria_pilot3_review_template_20261108.json` contiene seed ID, URL e i tre campi `rights_*` **nulli**. Il revisore deve prima assicurarsi che denominazione, dominio e forma giuridica siano corretti; la presenza del sito non prova diritti di riuso.

## 4. Fonti legali primarie di riferimento da validare

1. [Commissione europea — trattamento dei dati riferiti a società](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/application-regulation/do-data-protection-rules-apply-data-about-company_en): il GDPR protegge persone fisiche; imprese individuali e contatti nominativi possono contenere dati personali.
2. [Direttiva 96/9/CE, articoli 7–8](https://eur-lex.europa.eu/eli/dir/1996/9/2019-06-06/eng): diritto sui generis del costitutore di banche dati, estrazione/riutilizzazione; anche operazioni ripetute su parti non sostanziali possono risultare problematiche.
3. [Legge 22 aprile 1941, n. 633, art. 102-bis](https://def.giustiziatributaria.gov.it/DocTribFrontend/executePrintArticolo.do?articolo=Articolo+102+bis&codiceOrdinamento=0000000000001029999900002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000&id=%7B012E634A-9F52-4452-B7F7-980D83EDE0C6%7D): recepimento italiano dei diritti sui generis delle banche dati.
4. [Corte di Giustizia UE, C-203/02](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62002CJ0203): la disponibilità pubblica della banca dati non elimina di per sé il diritto del costitutore contro estrazione/riutilizzazione.

**Da verificare dal professionista:** disciplina applicabile alla data della firma, termini/condizioni specifici dei tre siti, limiti della raccolta per coorti crescenti, modalità di informazione/opt-out e rischi di classificazione AI. Le fonti non sostituiscono un'analisi giuridica.

## 5. Check-list giuridica e domande che richiedono risposta espressa

- [ ] Il perimetro è limitato a **fatti societari non creativi** e a siti first-party per ciascuna azienda? Il metodo di acquisizione evita database altrui protetti?
- [ ] Le fonti dei tre casi sono identificate e i loro termini d'uso, eventuali divieti tecnici/contrattuali e i diritti di terzi sono stati controllati?
- [ ] Ragione sociale e P.IVA/sito sono associati alla corretta società? L'omonimia Ferrinox è gestita senza false fusioni?
- [ ] Sono esclusi dati personali diretti e indiretti (nominativi, recapiti individuali, microimprese identificabili)?
- [ ] La classificazione settoriale è proposta, neutra, correggibile e non implica verifiche, clienti o certificazioni inesistenti?
- [ ] La scheda presenta fonte, marcatura `unverified/unclaimed`, CTA di rivendicazione, rettifica e opt-out efficace?
- [ ] Le evidenze legali e la nota del reviewer sono **private**, con audit limitato agli operatori autorizzati?
- [ ] È definita la gestione della revoca per coorti già pubblicate, diversa dal semplice blocco dei nuovi commit?
- [ ] L'eventuale parere riguarda **solo il pilot3** oppure una **policy riusabile** per altri siti first-party? Definire condizioni e limiti quantitativi; non estendere la valutazione alle 100 Growth100 senza regole esplicite.

## 6. ESITO DEL PROFESSIONISTA — DA COMPILARE SOLO DAL FIRMATARIO

- **Nome e qualifica del professionista / studio:** `[da compilare]`
- **Data e ora del parere:** `[da compilare]`
- **Titolo / identificativo documento:** `[da compilare]`
- **Collocazione del documento integrale:** `[repository legale privato o DMS con controllo accessi; URL HTTPS non pubblico]`
- **Decisione firmata:** `[APPROVATO_SENZA_CONDIZIONI | APPROVATO_CON_CONDIZIONI | RESPINTO | ULTERIORI_VERIFICHE]`
- **Ambito coperto:** `[solo pilot3 / fonti first-party omogenee con criteri / altro]`
- **Ragioni, limiti e condizioni operative:** `[da compilare]`
- **Responsabilità su rettifiche, opt-out, esposizione dati, mantenimento documenti:** `[da compilare]`
- **Firma del professionista e autenticità verificata dalla società:** `[da compilare fuori da questa bozza]`

**Non inserire una scelta, una firma o un URL di approvazione in automatico** e non trasformare la firma del founder/superadmin in un parere legale esterno.

## 7. Atto Platform — separato dalla valutazione legale

**Solo dopo ricezione e verifica del documento:**
1. La governance Platform verifica firma, versione, ambito, data, fonte e condizioni; registra dove è conservato il memo **in archivio privato**.
2. Un operatore autenticato con permessi `network.privacy_governance_review`, `discovery.governance_review` e `discovery.publish` effettua il sign-off tramite la RPC **solo quando** la policy FACTS1 è installata mediante migrazione revisionata e approvata.
3. Se l'esito legale è negativo/non conclusivo, `private.netit_facts1_policy.enabled=false`; **non impostare `licensed`** per eludere il gate.
4. Se l'esito è favorevole e le condizioni sono soddisfatte, il reviewer prepara un manifesto coerente con la policy; dopo legal names riconciliati e nuova deduplica, esegue preview/fingerprint/commit atomico in ambiente autorizzato.
5. Verifica readback `public.network_companies` e ledger privato e controlla il risultato nel Network pubblico con CTA «Rivendica».

- **Platform approver:** `[da registrare dalla sessione reale; mai simulare auth.uid]`
- **Revision della policy FACTS1:** `[da produzione dopo approvazione]`
- **Manifest fingerprint:** `[da produrre con preview autenticata]`
- **Pubblicazioni effettive:** `0 finché non esiste readback pubblico`

---

*Documento preparatorio per revisione; firma legale e decisione autorizzativa NON PRESENTI al momento della creazione.*
