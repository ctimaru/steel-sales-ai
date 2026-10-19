# NET-UX DATA1 — Company Intelligence Enrichment
## Verità dei dati | 19 ottobre 2026
- Production readback: 501 profili = 32 canonical pubblicati in Italia + 469 discovered (427 official_company_research, 35 Wikidata CC0, 7 governed_candidate).
- Tracce geo grezze: 69/501 (13,77%), di cui **1 canonical segnata conflict**. Copertura geo utilizzabile nell'audit: **68/501 (13,57%)** = 40 discovered source_observed + 25 canonical pending_review + 3 facilities canonical pubblicate. 1 geo in conflitto va tenuta separata; nessuna osservazione equivale a sede verificata.
- Profili con evidenza tecnica privata: 9/501 (3 con arricchimenti accettati, 6 con nuovi servizi candidati). SOLO 3 società canoniche hanno capacità pubblicate nelle facilities (8 assegnazioni). Altri 49 discovery candidates con capability_keys non sono pubblicati.
- Verifica SQL per UUID della coorte fissa COMPACT4B (file approved_25.json): 25/25 già con un'evidenza geografica. La nota storica '16 originali da completare' era obsoleta rispetto al manifest reale; evitare duplicati.
- La RPC next_eligible mostrava 379 candidati prima delle tre nuove osservazioni. Va aggiornata dopo il lotto; non presumere che il risultato resti costante.

## Scritture verificate in produzione
**Tre nuove località, solo source_observed, non verificate o pubblicate:**
- CIFA — Senago MI — https://www.cifa.com/en/contacts
- ALPEGO — Lonigo VI — https://alpego.com/contatti/
- APES — Limena PD — https://www.apes.it/contatti/

**Sette osservazioni tecniche candidate private su sei società, no filtri pubblicati modificati:**
- Tecnocurve — bending_forming — https://www.tecnocurve.it/curvatura-tubi/
- Tecnocurve — welding_fabrication — https://www.tecnocurve.it/lavorazioni-tubo/
- Tubificio del Friuli — cut_to_length — https://www.tubificiodelfriuli.com/servizi/
- Generaltubi — cut_to_length — https://generaltubi.com/it/azienda/magazzini
- MECART — bending_forming — https://www.mecart-piegatura-tubi.it/ita/
- Commercio Tubi — stockholding — https://www.commerciotubi.it/
- CPS — stockholding — https://www.cpssrl.com/it/
Si tratta di dichiarazioni aziendali osservate su fonte ufficiale, non di capacità certificate né di disponibilità attuale. Le 7 osservazioni rimangono con review_status=candidate.

## Read-only audit realmente eseguito su tutta la base
- Prova transazionale production SQL con rollback, usando la RPC DATA1: 21 pagine da 25 (ultima 1), **501 righe, 501 UUID unici, 0 duplicazioni**.
- 499 siti HTTPS con dominio tecnicamente coerente ma identità/diritti di riutilizzo non attestati; 2 record che condividono marcegaglia.com (Marcegaglia Carbon Steel e Marcegaglia Specialties), da trattare come aziende distinte e non associare automaticamente gli attributi.
- **432 senza geo utilizzabile**, **68 con geo osservata/pubblicata**, **1 geo in conflitto**. 9 con evidenza tecnica candidata/accettata.
- La nuova RPC è stata testata in una transazione con ROLLBACK: **non è ancora stata applicata come migrazione produzione**. Nessuno dei 501 siti è stato dichiarato visitato tramite questa prova.

## Scansione sistematica della base
- La nuova funzione netdata1_company_audit è read-only, service-role-only, limit 25 con offset; riporta copertura di tutto il Network, provenienza e status di geo/capability, siti ufficiali potenziali e domini condivisi o ignoti. Nessuna promozione, claim, o write.
- Il worker netdata1_company_audit.py riusa l'extractor già protetto (robots.txt, anti-SSRF, HTTPS, limiti, privacy), preserva gli esclusi dalla scansione; dry run predefinito. --scan --persist richiede scelta esplicita e inserisce soltanto private source candidates tramite RPC esistente.
- Workflow GitHub manuale netux-data1-company-audit.yml: offset 0,25,...,500. Ventuno pagine coprono 501 posizioni, NON significa 501 aziende già verificate. L'audit rimane valido anche per record senza sito ufficiale, segnalati come gap.
- Protezione: niente credenziali nel browser, niente nuovi endpoint public, nessun dato personale, nessuna attribuzione automatica di certificazioni, sedi legali o capacità di servizio da attività produttive interne.

## Prossimi passi
1. Audit strutturale delle 21 pagine completato e reconciliato; resta verificare le fonti esterne e i diritti delle 499 schede con sito e le due identità a dominio condiviso.
2. Nuovi lotti da 25 siti: leggere fonti, diritti e robots prima; stage candidate solo dove utile. Bloccare siti con restrizioni di riutilizzo.
3. Revisione manuale dei casi multi-sede, parent-brand, ufficio commerciale vs sede, comune ISTAT e filiera.
4. Console Platform Company Intelligence (KPI, queue, source links e tabella comparativa) e promozione dei dati soltanto con review/autorizzazione.

Riferimenti: https://github.com/ctimaru/steel-sales-ai/issues/736 e https://www.smartsteelsales.com/network

## Progressivo DATA1B — 19 ottobre 2026 (nuovi settori)
- 6 nuove località official-site osservate nel lotto dinamico: SCM Group (Rimini RN), Merlo (Cervasca CN), Fassi Gru (Albino BG), Comer Industries (Reggiolo RE), Casappa (Collecchio PR), Peruzzo (Curtarolo PD). Il contatore discovered geo passa da 40 a **46**; tutte `source_observed` senza verifica/publishing.
- 7 nuove entità discovered tramite `netdensity3_seed_first_party`: Fincantieri (marine), Ansaldo Energia (energy), Cimolai e Webuild (construction), SACMI (industrial equipment/packaging), Aermec e CAREL (HVAC). Tutte `needs_review`, senza pubblicazioni o verifiche di acquirente: 7 inserite, 0 duplicate o invalide. Siti aziendali come fonti primarie.
- Totale ora **508**: 32 published canonical + **476** discovered. Geo utilizzabile **74** = 46 discovered osservate, 25 pending canonical, 3 facilities published; **1 conflict** separato; 508 - 74 - 1 = 433 senza geo utilizzabile e senza conflict (verifica via audit quando pronto).
- Le segmentazioni del modello legacy sono ancora `other` per 6 nuove entità, e `industrial_equipment` per SACMI. La mappatura puntuale ai `network_markets` esistenti è una **proposta da validare** e non ancora un filtro reale per le schede discovered.
- Diritti: il sito Orsi Group ha restrizioni esplicite al riuso commerciale; Orsi non è stato inserito nel lotto geografico. Le fonti di Dallara hanno restrizioni analoghe e non sono state importate in questo ciclo. Dati personali non estratti.
- Il label costante `scope` della RPC è stato corretto da un numero fisso a `all-visible-network-profiles-dynamic`, perché il Network continua a crescere.
