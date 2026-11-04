# SCHOOL-CONTENT1.C — Guide comparative e glossario tecnico

## Scopo
Sviluppare un solo riferimento editoriale pubblico, originale e consultabile dalla School pubblica/autenticata, con quattro confronti e un glossario di 16 termini. Evitare una moltiplicazione di pagine SEO generiche e mantenere l'interfaccia e la struttura K2 esistenti.

## Ambito consegnato
- Pagina \`/knowledge/articoli/confronti-glossario\`: 4 confronti (EN 10210 vs EN 10219, EN 10204 2.1/2.2/3.1/3.2, saldato vs seamless, tolleranze/massa teorica) e glossario da 16 termini.
- Collegamento dall'indice Guide già pubblico e riusato dal workspace \`/school/guide\`.
- Collegamento dalle sei schede arricchite con CONTENT1.A/B, senza cambiare quelle non pubblicate.
- Una sola URL nuova con canonical, TechArticle/DefinedTermSet/BreadcrumbList e sitemap.
- Nessuna nuova tab, API, modello di calcolo, query Supabase, email, RFQ o file normativo coperto da copyright.

## Qualità editoriale
- Distinguere norme di fornitura Parte 1 e dimensioni/tolleranze Parte 2; per EN 10210/10219, le Parti 2 pubblicate UNI sono del 2019.
- EN 10204 riguarda documenti di controllo, non materiali o l'idoneità progettuale.
- Certificato 3.1 validato dal rappresentante autorizzato del produttore indipendente dalla produzione; 3.2 richiede anche seconda rappresentanza autorizzata pertinente.
- Non dedurre equivalenze S355, superiorità assoluta seamless, peso certificato dal kg/m teorico o conformità PED dal documento.
- Fonti: catalogo ufficiale UNI e BSSA, con link diretti e revisione 2 novembre 2026.

## Test / release gate
- [ ] \`node --test tests/school-content1c-comparisons-glossary.test.mjs\` e suite P0 complessiva
- [ ] TypeScript/Next build/contrast/FLOW1/PERF2.1 su SHA della PR
- [ ] QA visuale 320/390/1440, anchor, focus, nessun overflow, leggibilità termini su mobile
- [ ] Preview Vercel READY sul commit testato, senza disabilitare SSO
- [ ] Merge solo **dopo** #1083 e suo sign-off: PR stacked, non indipendente da \`main\`
- [ ] Rispettare un solo deployment di produzione al giorno; nessun merge durante il blocco QA

## Navigazione e confini
- School \`/school/guide\` usa già la lista pubblica \`/knowledge/articoli\`, e gli articoli pubblici sono esclusi dal redirect privato in \`lib/supabase/proxy.ts\`.
- Professore AI / Voice attivazione, Distinta privata, RFQ, Network e motori peso non modificati.
- Solo \`it\` per i nuovi contenuti originali; non simulare traduzioni EN/DE/FR/ES non ancora pubblicate.


## Single protected production release — 2 November 2026

- This branch now targets `main` as the **combined release for SCHOOL-CONTENT1.A/B/C**: the first six K2 editorial overlays and the new comparisons/glossary page land in **one merge / one Vercel production build**, instead of two merges each potentially deploying.
- The original [PR #1083](https://github.com/ctimaru/steel-sales-ai/pull/1083) remains a traceable unmerged draft and must not be merged separately; after the combined production release, close #1083 as superseded (do not falsely claim merged).
- Combined review PR: [#1085](https://github.com/ctimaru/steel-sales-ai/pull/1085). Keep DRAFT until all main-target P0 and visual gates are recorded, real SSO access is reviewed, and the release window is approved.
- Synthetic screenshot evidence: workflow `PERF2.1`, artifact `school-unify2-private-ux-demo`, images `school-content1c-390.png` and `school-content1c-1440.png`. These demonstrate layout, not real-account access.
- The 2 November production release slot was already used by Network. **Do not merge on 2 November 2026** merely because CI is green; merge only within an authorized subsequent deployment window.
