# SCHOOL-CONTENT1.D — Professore contestuale, fonti e Calcolatrice

## Obiettivo
Far usare al Professore le quattro guide comparative CONTENT1.C e i sei approfondimenti CONTENT1.A/B senza introdurre un secondo ingresso, un modello generativo, voce, memoria commerciale o nuove API.

## Contratto
- Una domanda **EN 10210 vs EN 10219**, **EN 10204 / 3.1 / 3.2**, **saldato vs seamless**, **peso teorico/tolleranze** viene interpretata **solo localmente** tramite `matchSchoolProfessorComparison`.
- La risposta breve riprende `subtitle` e `takeaway` di `schoolComparisons`, con link alla stessa guida integrale e agli URL ufficiali già verificati. Non crea valori, equivalenze, idoneità o documenti.
- Un riferimento K2 singolo (es. EN 10219, S355J2H) continua a richiedere la ricerca pubblica: **solo dopo risposta K2 `k2_published`** può comparire la scheda CONTENT1.A/B, con 2 controlli pratici, avvertenze K2 e fonti ufficiali.
- Il parametro `topic` della pagina Professore accetta **esclusivamente** gli ID già pubblicati delle quattro guide comparative. Non causa fetch, non viene riflesso come HTML né inviato a server.
- La guida di confronto include un'azione «Chiedi al Professore» che apre il contesto nella **stessa unica esperienza** pubblica o autenticata.
- Il collegamento al Calcolatore Pesi è sempre disponibile: se l'intento contiene geometria e quantità complete e validate dal parser preesistente, il link trasporta solo campi strutturati già ammessi; altrimenti apre la Calcolatrice generica. Non salva né invia RFQ.
- La domanda resta nel browser; verso `/api/public/school-evidence` viaggiano solo i codici tecnici ammessi in HTTPS, `credentials: omit` e `cache: no-store`. Nessuna tabella, email, identità o prompt aziendale entra nella risposta.

## Accettazione
- [x] Unit test per quattro intenti, priorità confronto prima di K2, fallback e rifiuto parametri arbitrari.
- [x] Chrome 390/1440 incluso in `school-ai1-chrome-professor.mjs`: confronto contestuale e certificati EN 10204, fonti visibili e nessuna chiamata API per il percorso statico.
- [x] Chrome K2 verifica che il contenuto A/B appaia dopo un record `k2_published`; vecchio test topic «Come si producono...» resta valido.
- [ ] CI finale: P0 su branch dello stack, UI contrast, PERF2.1, FLOW1, smoke anonimo.
- [ ] Verifica visuale di screenshot professore pubblico/autenticato su 390 e 1440; SSO real user da revisionare.
- [ ] Merge solo **dopo** A/B/C [#1085](https://github.com/ctimaru/steel-sales-ai/pull/1085) e relativa finestra di produzione. Ritarare la PR su main senza doppio deploy.

## Esclusioni esplicite
AI generativa/voice, prompt logging, storage, tenant/RLS, prezzi, firma/rilascio norme, selezione automatica di un grado, quantità stimate, attivazione RFQ, navigazione ridisegnata.

## Evidenze collegate
Notion SCHOOL-CONTENT1: https://app.notion.com/p/40cf059cecb5819dba38ea7a7c3ad2ae
