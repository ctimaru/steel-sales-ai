# NET-UX COMPACT4C — Acceptance del primo batch geografico

Data: 2026-10-19. Dati verificati tramite query SQL sul progetto Supabase di produzione.

## Risultato verificato

- Manifest originario: 25 aziende (18 canonical, 7 discovered) in `services/worker/data/netcompact4b_approved_25.json`.
- **25/25 località con fonte HTTPS persistite**, nessuna del campione rimasta priva di dati.
- 18 record `public.network_it_geo_evidence_candidates` in `pending_review`; 7 record `public.network_neteima2_provisional_geo` in `source_observed`.
- Prima dell'intervento: 3 sedi pubblicate + 12 candidate canoniche + 26 censite = 41 profili con località. Dopo: **3 + 25 + 28 = 56 / 501 (11,2%)**.
- Nessuna nuova sede pubblicata: `network_facilities` resta a 3 aziende. 1 preesistente candidato in conflitto resta escluso.
- Tutte le località sono **indicative**, non certificazioni. Link alla fonte consultabile nei profili; dominio aziendale e città/provincia ISTAT controllati dalla RPC service-only.

## Evidenze registrate

| Tipologia | Azienda | Comune (provincia), regione | Fonte |
|---|---|---|---|
| Pubblicata | /9/9/6/ /M/E/C/A/R/T/ /S/./r/./l/./ | Gualtieri (RE), Emilia-Romagna | [Pagina ufficiale](https://www.mecart-piegatura-tubi.it/eng/privacy-policy/) |
| Pubblicata | /C/o/m/m/e/r/c/i/o/ /T/u/b/i/ /S/./r/./l/./ | Torino (TO), Piemonte | [Pagina ufficiale](https://www.commerciotubi.it/contatti.htm) |
| Pubblicata | /C/P/S/ /S/./r/./l/./ | Concorezzo (MB), Lombardia | [Pagina ufficiale](https://www.cpssrl.com/it/contacts.php) |
| Pubblicata | /D/i/e/g/o/ /B/u/t/t/i/g/n/o/l/ /S/./r/./l/./ | Concordia Sagittaria (VE), Veneto | [Pagina ufficiale](https://www.diegobuttignol.it/azienda/le-sedi/) |
| Pubblicata | /E/c/o/r/ /S/./p/./A/./ | Schio (VI), Veneto | [Pagina ufficiale](https://ecor.com/contatti) |
| Pubblicata | /F/e/r/r/o/ /T/u/b/i/ /S/./p/./A/./ | Padova (PD), Veneto | [Pagina ufficiale](https://www.ferrotubi.com/contatti/) |
| Pubblicata | /G/e/n/e/r/a/l/t/u/b/i/ /S/./p/./A/./ | Torino (TO), Piemonte | [Pagina ufficiale](https://www.generaltubi.com/pdf/privacy-policy.pdf) |
| Pubblicata | /I/L/T/ /P/R/O/C/E/S/S/ /T/U/B/E/ /S/./r/./l/./ | Pontedera (PI), Toscana | [Pagina ufficiale](https://www.iltsrl.it/) |
| Pubblicata | /I/n/o/s/s/i/d/a/b/i/l/e/ /S/./r/./l/./ | Collegno (TO), Piemonte | [Pagina ufficiale](https://www.inossidabilesrl.com/barre-e-laminati-inox/) |
| Pubblicata | /O/f/f/ /B/o/r/s/a/r/i/ /S/./r/./l/./ | Cavezzo (MO), Emilia-Romagna | [Pagina ufficiale](https://www.offborsari.it/contatti.html) |
| Pubblicata | /p/e/c/./i/t/ /L/./C/./F/./ /S/./r/./l/./ | Casale Monferrato (AL), Piemonte | [Pagina ufficiale](https://www.lcfitalia.it/en/brochure/) |
| Pubblicata | /S/C/A/L/T/R/I/T/T/I/ /S/./p/./A/./ | Jerago con Orago (VA), Lombardia | [Pagina ufficiale](https://www.scaltritti.it/taglio-laser-lamiera-milano.php) |
| Pubblicata | /T/A/D/ /L/o/n/g/ /P/r/o/d/u/c/t/s/ /S/./p/./A/./ | Marcallo con Casone (MI), Lombardia | [Pagina ufficiale](https://tadlongproducts.it/) |
| Pubblicata | /T/e/c/n/i/c/a/ /T/r/e/ /S/./r/./l/./ | Bassano del Grappa (VI), Veneto | [Pagina ufficiale](https://www.tecnicatre.it/contatti) |
| Pubblicata | /T/e/c/n/o/ /M/e/c/c/a/n/i/c/h/e/ /M/o/d/e/r/n/e/ /S/./r/./l/./ | Rocca San Felice (AV), Campania | [Pagina ufficiale](https://www.tecnomeccaniche.it/privacy-policy.php) |
| Pubblicata | /T/e/c/n/o/c/u/r/v/e/ /S/./r/./l/./ | San Pietro di Morubio (VR), Veneto | [Pagina ufficiale](https://www.tecnocurve.it/contatti/) |
| Pubblicata | /T/u/b/a/u/t/o/ /S/./r/./l/./ | Torino (TO), Piemonte | [Pagina ufficiale](https://www.tubauto.it/it/) |
| Pubblicata | /T/u/b/i/f/i/c/i/o/ /d/e/l/ /F/r/i/u/l/i/ /S/./p/./A/./ | Rivignano Teor (UD), Friuli-Venezia Giulia | [Pagina ufficiale](https://www.tubificiodelfriuli.com/contatti/) |
| Censita | /C/i/n/e/l/l/i/ | Settala (MI), Lombardia | [Pagina ufficiale](https://cinelli-milano.com/policies/privacy-policy) |
| Censita | /C/o/l/n/a/g/o/ | Cambiago (MI), Lombardia | [Pagina ufficiale](https://www.colnago.com/en-fi/contact-us) |
| Censita | /G/B/M/ /B/u/i/l/d/i/n/g/ /E/q/u/i/p/m/e/n/t/ | Leno (BS), Lombardia | [Pagina ufficiale](https://www.gbmitaly.it/privacy) |
| Censita | /M/e/t/a/l/c/o/ | Resana (TV), Veneto | [Pagina ufficiale](https://www.metalco.it/about/storia/) |
| Censita | /P/e/d/r/a/l/i/ | Mornico al Serio (BG), Lombardia | [Pagina ufficiale](https://www.pedrali.com/it-it/dove-siamo) |
| Censita | /R/I/M/A/ | Montichiari (BS), Lombardia | [Pagina ufficiale](https://www.rimaspa.com/contatti/) |
| Censita | /S/C/A/B/ /D/e/s/i/g/n/ | Coccaglio (BS), Lombardia | [Pagina ufficiale](https://www.scabdesign.com/image/data/prodotti/allegati/SCAB_TS_piani_stratificato_compact_acciaio_zincato.pdf) |

## Acceptance e limiti

- Le PR [#725](https://github.com/ctimaru/steel-sales-ai/pull/725) (pipeline) e [#726](https://github.com/ctimaru/steel-sales-ai/pull/726) (correzione regex HTTPS) sono integrate con controlli richiesti verdi; relative migrazioni applicate alla produzione.
- Le RPC di inserimento sono invocabili soltanto tramite service_role; anon e authenticated non possono usarle.
- **Esecuzione del batch**: ricerca mirata delle fonti ufficiali e inserimento tramite RPC; **non** è stato dichiarato eseguito un workflow automatico di 25 siti. Il workflow GitHub rimane manuale e facoltativo.
- Alcuni siti evidenziano più località: `Diego Buttignol` e `Tecnica Tre` hanno sede principale esplicita; `TAD Long Products` è stato associato all'ufficio citato sul sito, non alla sede legale; `Cinelli` rimanda all'indirizzo societario `Gruppo Srl - Div. Cinelli`. I due ultimi meritano controllo di identità/ownership, ma restano località **indicative**.
- Non è stata eseguita la visual acceptance con login Free/Pro in Chrome: il dato persistito è verificato nel DB, non una prova screenshot dell'interfaccia live.

## Prossimo microblocco proposto

**NET-UX COMPACT4D — Geo Source Confidence & Scaling**: controllo delle eccezioni TAD/Cinelli, ricerca di ulteriori aziende senza località, generazione manifest idempotente da record eleggibili, miglioramento estrazione che ora riconosce soltanto alcuni formati di indirizzo, metriche per fonti effettivamente trovate e rapporto di completamento progressivo su 501 aziende. Non rendere fittizia o pubblicata una sede a partire da un nome di località.
