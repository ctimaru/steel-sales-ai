# HOME-CINE2A.1 — Reference Gap Map & Design Tokens

> **Audit di progetto — documentazione, non implementazione UI.** Data: 2026-10-25. Baseline GitHub `main` `83af541da152399476e89971e1799119c8c0e674` (#940). Reference pack con quattro PNG originali presente nel progetto e nella conversazione.

## Fonti ed evidenza

- 4 PNG originali approvati dal founder, raccolti come benchmark nel pacchetto `HOME_VISION_LOCK_reference_approvate.zip` (copia privata in conversazione); `reference-board.jpg` è solo un indice grafico ridimensionato.
- Source verified: `PublicCinematicHero`, `public-cinematic-hero.module.css`, `public-cinematic-continuity.module.css`, `PublicHomeHeader`, `BuyerDistintaBuilder`.
- **Screenshot storico reale, NON corrente**: `Screenshot 2026-10-25 alle 22.19.32.png`, prima di PR #940; non usarlo per attestare il layout corrente.
- **Screenshot reali post-HOME-CONV1A**: GitHub Actions `PERF2.1 Mobile UX & Payload Acceptance` [run 40238148823](https://github.com/ctimaru/steel-sales-ai/actions/runs/40238148823), artifact [home-si5-public-visual-qa](https://github.com/ctimaru/steel-sales-ai/actions/runs/40238148823/artifacts/12615618944), 9.58 MB, pubblicato 25 ottobre 2026; il workflow ha catturato `mobile-320`, `mobile-390`, `tablet-768`, `desktop-1440`. **Artifact presente, ma file PNG non visualizzati direttamente in questo audit**: serve review visiva diretta per validare la soglia di 17/20.
- Capture script già presente: `apps/web/tests/home-si5-chrome-visual-qa.mjs`, screenshot fullPage nel folder `/tmp/home-si5`. Non serve reimplementare una pipeline parallela.

## Conclusione visuale

La homepage corrente ha un hero dark steel credibile, rete decorativa, CTA calcolatrice-first e product proof. Rispetto alle reference manca ancora la *scala scenografica delle fabbriche e dei tubi*, una rete/mappa immediatamente interpretabile, widget di calcolo convincente e una **fascia compatta di cinque card fotografiche**. La discontinuità maggiore è il passaggio dalle superfici cinematiche dell'hero alle sezioni bianche tipo SaaS; dal sorgente è confermabile via `public-cinematic-continuity.module.css`. Per la Distinta esiste un builder reale ma non è stata dimostrata la parità fotografica/tabellare con la reference.

## Gap prioritari

### G01 · P0 — Hero: materia e ambiente
- **Attuale:** Foto tubi sul lato destro; nessuna fabbrica monumentale nel file attuale. **Evidenza:** Confermato CSS + immagine storica.
- **Owner/target:** `public-cinematic-hero.module.css` → HOME-CINE2A.2.
- **Obiettivo:** Background unico ottimizzato con impianto industriale e tubi in primo piano; desktop/mobile crop distinto.
- **Test:** Vero screenshot 1440 e 390; metallo credibile, testo e CTA leggibili.

### G02 · P0 — Hero: rapporto tubi/testo
- **Attuale:** Max-width container 1180; background right auto 88%; negative space forte. **Evidenza:** Confermato CSS.
- **Owner/target:** `public-cinematic-hero.module.css` → HOME-CINE2A.2.
- **Obiettivo:** Scena tubi dominante senza coprire copy; 55–65% target desk.
- **Test:** Nessun clipping e CTA entro firstfold 1440/390/320; valutazione side by side.

### G03 · P0 — Hero: network intelligence
- **Attuale:** Rete svg lineare; non globo/mappa riconoscibile. **Evidenza:** Confermato TSX/CSS.
- **Owner/target:** `public-cinematic-hero.tsx` → HOME-CINE2A.2.
- **Obiettivo:** Mappa connessioni leggibile e sottile integrata nello sfondo, niente finti endpoint.
- **Test:** Globo network leggibile a 1440, nascosto/simplificato sotto 700.

### G04 · P1 — Overlay semantici
- **Attuale:** Un badge FILIERA CONNESSA + hint Distinta>RFQ; non 4 nodi informativi. **Evidenza:** Confermato TSX.
- **Owner/target:** `public-cinematic-hero.tsx` → HOME-CINE2A.2.
- **Obiettivo:** Badge sobri Aziende/Conoscenza/Opportunità/AI solo con copy che non prometta funzioni inesistenti.
- **Test:** Badge decorativi non cliccabili o con destinazioni reali e accessibili.

### G05 · P0 — Technical product proof
- **Attuale:** Card attuale concettuale Distinta > RFQ > Offerte; manca proof calcolatrice visiva. **Evidenza:** Confermato TSX.
- **Owner/target:** `public-cinematic-hero.tsx` → HOME-CINE2A.2.
- **Obiettivo:** Widget calcolatrice con campi/azioni reali o sample dichiarato illustrativo, zero numeri fittizi.
- **Test:** Nessun finto peso, misura o dato azienda; CTA apre calcolatrice reale.

### G06 · P0 — Feature rail fotografica
- **Attuale:** Quattro tile di testo bianche in toolSection e moduli separati; non cinque foto-contesti coerenti. **Evidenza:** Confermato page.tsx + continuity CSS.
- **Owner/target:** `app/(italian)/page.tsx + public-cinematic-continuity.module.css` → HOME-CINE2A.3.
- **Obiettivo:** Cinque tile con visuals steel, distinta, globe, scuola, RFQ governato e link reali.
- **Test:** Navigazione IT/EN, contrasto, nessun pubblico su RFQ privato.

### G07 · P0 — Continuità dark-to-light
- **Attuale:** Network/Intelligence/Tools/Trust ancora superfici bianche. **Evidenza:** Confermato continuity CSS.
- **Owner/target:** `public-cinematic-continuity.module.css` → HOME-CINE2A.3 / 2D.
- **Obiettivo:** Transizioni graduate con superfici premium; no salti arbitrari a cards bianche SaaS.
- **Test:** Screenshot full-page confrontati 1440 + 390; leggibilità mantenuta.

### G08 · P1 — Banda piattaforma e ruoli
- **Attuale:** Bridge 01/02/03; ruoli Network in altra sezione; non una banda immediata. **Evidenza:** Confermato hero TSX+network role explorer.
- **Owner/target:** `public-cinematic-hero.tsx + public-network-role-explorer.tsx` → HOME-CINE2A.3.
- **Obiettivo:** Percorso Calcola > Distinta > RFQ > Network + produttori/commercianti/terzisti/utilizzatori, niente numeri fake.
- **Test:** Percorso comprensibile, CTA primaria invariata.

### G09 · P0 — Numeri da screenshot non verificati
- **Attuale:** Reference include metriche 10,000+, 100+ e masse/quote puramente demo. **Evidenza:** Verificato solo reference, non produzione.
- **Owner/target:** `homepage + BuyerDistintaBuilder` → HOME-CINE2A.2 / 2B.
- **Obiettivo:** Nessuna statistica/weight/sample da reference copiata in produzione.
- **Test:** Prove dataset e motore reale o etichetta illustrativo.

### G10 · P1 — Header e gerarchia CTA
- **Attuale:** HOME-CONV1A sticky calcolatrice, Area aziende unica, 5 lingue compatte; differisce dai 2 pulsanti del mockup volutamente. **Evidenza:** Confermato public-home-header.tsx.
- **Owner/target:** `public-home-header.tsx` → PRESERVARE.
- **Obiettivo:** Non ricopiare header mockup se inverte funnel, non duplicate CTA.
- **Test:** Chrome pubblico IT/EN; calcolatrice 1 click, niente click extra.

### G11 · P1 — Distinta: tabularità e densità
- **Attuale:** Esiste BuyerDistintaBuilder reale con stato/completamento, stile dense CSS 5k; non provata parità con mockup. **Evidenza:** Sorgente verified, screenshot reale Distinta non ispezionato.
- **Owner/target:** `buyer-distinta-builder.tsx + buyer-dense-builder.module.css` → HOME-CINE2B.
- **Obiettivo:** Grid compatta senza duplicare gestione righe; più data-ink e meno whitespace.
- **Test:** Browser auth/guest, calcoli ed editing reali, nessuna regressione input.

### G12 · P1 — Distinta: summary sticky e azioni
- **Attuale:** Riepilogo e Crea RFQ del progetto esistono, forma visuale/affordance non confrontata live. **Evidenza:** Sorgente-only, screenshot reale pending.
- **Owner/target:** `buyer-distinta-builder.tsx` → HOME-CINE2B.
- **Obiettivo:** Riepilogo laterale calcolato, save/export/RFQ reali; mobile pannello accessibile.
- **Test:** Confronto desktop 1440 + mobile 390; quote e masse dal motore.

### G13 · P1 — Calcolatrice e Distinta same DNA
- **Attuale:** PublicTubeWeightCalculator e distinta usano componenti distinti; visual parity non dimostrata. **Evidenza:** Sorgente-only.
- **Owner/target:** `public-tube-weight-calculator.tsx + buyer-distinta-builder.tsx` → HOME-CINE2C.
- **Obiettivo:** Design tokens condivisi, autocomplete e dimensioni compatte con handoff verificato.
- **Test:** CHS/SHS/RHS, pesi e lunghezze verificati.

### G14 · P2 — Mobile visual first-fold
- **Attuale:** CSS current hero min-height 790 <=390, hides demo; header sticky CTA; full screenshot #940 artifact available. **Evidenza:** Confermato CSS+CI logs, asset non ispezionato graficamente.
- **Owner/target:** `public-cinematic-hero.module.css + home-si5-chrome-visual-qa.mjs` → HOME-CINE2A.2 + 2D.
- **Obiettivo:** Tubi bottom crop non sovrapposti al titolo e CTA; gerarchia firstfold.
- **Test:** 320×720 e 390×844 screenshot confronto, Axe zero.

### G15 · P2 — Animazione e prestazioni
- **Attuale:** CSS già breathing scale 1.018 + network drift; no WebGL/video. Motion ridotto per preferenze. **Evidenza:** Confermato CSS.
- **Owner/target:** `public-cinematic-hero.module.css` → PRESERVARE.
- **Obiettivo:** Nessun nuovo runtime per resa puramente decorativa.
- **Test:** 3 Lighthouse runs, baseline 94/94/95; CLS 0; LCP medio ≤baseline+150ms o diagnosi.

## Design token proposti (non ancora applicati)

`design-tokens.json` e `design-tokens.css` definiscono palette, tipografia, superfici, density e motion con ruoli semantici, senza introdurre runtime o sovrascrivere CSS globale. **Il CSS file non va importato finché un microblocco successivo non ha completato contrasto ed evidence visual QA.**

- **Nero acciaio:** `#04120F`; stage `#061713`; pannello `#09251F`; elevated `#102E27`.
- **Accenti:** smeraldo luminoso `#55E6B0` per decorazione e highlight; CTA scura `#0B7852` con testo bianco per contrasto; hover `#075E40`.
- **Testo:** `#F2FFF8` primario; `#C4DDD0` secondario; evidenza di mappa e rete più sottile.
- **Materiale:** sheen `#B6CFC4`, steel middle `#69867C`, shadow `#1C3330`.
- **Densità:** touch >=44 px; row min 44px; card radius 12px; desktop H1 clamp 3.2rem/4.65vw/5.1rem solo come *proposta*. Non applicare automaticamente su mobile o a Distinta.

## Scorecard di fedeltà visuale (manuale)

Scala 0=assente, 1=parziale, 2=convincente; 10 criteri: (01) tubi monumentali, (02) fabbrica materica, (03) acciaio riflettente, (04) gerarchia headline, (05) CTA calcolatrice, (06) globo/network, (07) widget tecnico credibile, (08) percorso piattaforma, (09) cinque feature card fotografiche, (10) continuità Distinta/calcolatrice. Target >=17/20, critici #01/#05/#07 >=1, #05/veridicità/a11y obbligatori. **Non si assegna un punteggio numerico in questo blocco** senza screenshot correnti effettivamente revisionati. Chiudere la valutazione col founder dopo avere aperto l'artifact GitHub.

## Sequenza di implementazione derivata

1. `HOME-CINE2A.2` — Hero: nuovo framing industriale vero, tubi monumentali, mappa intelligente, widget tecnico coerente/illustrativo trasparente, senza inventare dati.
2. `HOME-CINE2A.3` — Cinque tile visuali + fascia Calcolatrice → Distinta → RFQ → Network; integrazione senza esporre dati privati.
3. `HOME-CINE2B` — Distinta Professional Cockpit: tabella reale, dense toolbar, riepilogo sticky, mobile rispettato.
4. `HOME-CINE2C` — Calculator→Distinta Visual Parity, senza inventare norme/dimensioni/pesi.
5. `HOME-CINE2D` — Coordinamento finale, accessibilità e performance.

## Gate / rischi non negoziabili

- No numeri/aziende/pesi/misure/AI finti copiati dalle reference.
- Nessun cambio a contabilità, calcoli, quote, auth e privacy nel microblocco 2A.1.
- No video/autoplay, WebGL o large JS per estetica.
- Browser 320/390/768/1440 con screenshot e overflow, Axe serious/critical 0, reduced-motion/reduced-data.
- Lighthouse CI baseline #940: 94/94/95, LCP 2731/2720/2714ms, CLS 0. Allerta se >3 punti di calo o >150ms LCP medio in test ripetuti, da diagnosticare prima del merge.
- Bloccare la PR visiva successiva se il risultato assomiglia a un mockup statico invece di un prodotto realmente utilizzabile.

**Stato 2A.1:** gap source-audit + token definiti; review live screenshot 2026-10-25 post-#940 ancora da effettuare per scorecard finale. Nessun deploy richiesto da questo documento.