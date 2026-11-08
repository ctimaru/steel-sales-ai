# NET-IT-USER1.A — Qualificazione dei primi 25 utilizzatori italiani

**Data:** 8 novembre 2026 · **Tracking:** [NET-IT-USER1 #1190](https://github.com/ctimaru/steel-sales-ai/issues/1190).

## Esito reale

Lotto di **25 lead italiani già censiti**, qualificati a livello di ricerca tecnica, e NON promossi a buyer o canonical. Controllo read-only produzione: 25/25 già in `public.network_core_target_leads`, 25 domini distinti, 0 match di dominio in `public.network_company_discovery_candidates`, 2 già in `public.network_companies` e pubblicati (ALPEGO, MASCHIO GASPARDO: **enrichment, non nuovi profili**). Le 25 righe rimangono `needs_review` nel DB; nessun write, crawler o deploy eseguito da questo intervento.

- **A: 14** — Uso di tubi di acciaio/ferro esplicitato nel prodotto/processo della fonte aziendale (9 già classificati tali in CORE, 5 nuove evidenze raccolte qui).
- **B: 5** — Tubolare/struttura documentata, ma il materiale del tubo o l'applicazione precisa non è provata come acciaio.
- **C: 6** — Produzione di attrezzature o macchinari, senza prova diretta di tubo strutturale d'acciaio.

**A/B/C è intensità dell'evidenza, non verifica legale dell'impresa, relazione commerciale, potenziale acquisto o disponibilità di materiale.** Le priorità alta/media/bassa sono priorità di ricerca orientate a tubi strutturali, non punteggi AI o volumi stimati.

## Registro di qualificazione

| # | Azienda | Settore | Evidenza | Priorità commerciale | Riscontro da fonte aziendale | URL | Gate successivo |
|---:|---|---|:---:|:---:|---|---|---|
| 1 | Arper | arredo | A | media | Saari: gambe realizzate tramite idroformatura di tubo in acciaio; fonte aziendale storica 2012 | [Fonte](https://www.arper.com/en_GB/blog/technology-for-the-senses.html) | `research_only` |
| 2 | EMU Group | arredo | A | media | Riviera: struttura saldata in tubolare e barre di acciaio Fe360 | [Fonte](https://www.emu.it/p/sgabello-giardino-esterno-acciaio-riviera-436/) | `research_only` |
| 3 | Magis | arredo | A | media | Substance: telaio in tubo di acciaio verniciato a polvere | [Fonte](https://www.magisdesign.com/product/substance-chair-and-armchair/) | `research_only` |
| 4 | Pedrali | arredo | A | media | Kuadra 1151: struttura in tubo di acciaio Ø16 mm | [Fonte](https://www.pedrali.com/it-it/prodotti/sedie-design/kuadra-1151) | `research_only` |
| 5 | SCAB Design | arredo | A | media | SI-SI Barcode: telaio a 4 gambe in acciaio tubolare zincato Ø20 mm | [Fonte](https://www.scabdesign.com/image/data/prodotti/chairs/si-si%20barcode/Scheda%20tecnica/SCAB_TS_si-si_barcode.pdf) | `research_only` |
| 6 | Cinelli | biciclette | A | bassa | Nemo: telai con tubi Columbus Spirit in leghe di acciaio; applicazione specialistica | [Fonte](https://cinelli-milano.com/it/collections/nemo-tig) | `research_only` |
| 7 | Colnago | biciclette | A | bassa | Master: telaio realizzato con tubi in acciaio DT15V | [Fonte](https://www.colnago.com/it-it/products/bici-master) | `research_only` |
| 8 | GBM Building Equipment | ponteggi | A | alta | Ponteggio a perni: correnti, diagonali e telai con tubi in acciaio S235JR | [Fonte](https://www.gbmitaly.it/ponteggi/perni) | `research_only` |
| 9 | Metalco | arredo urbano | A | media | CICLOS: spirale e traverse in tubolare di acciaio | [Fonte](https://www.metalco.it/product/ciclos-portabici-urbano-acciaio/) | `research_only` |
| 10 | Basso Bikes | biciclette | A | bassa | Viper: telaio saldato in acciaio con tubi conici internamente; applicazione specialistica | [Fonte](https://bassobikes.com/en/bikes/steel-bikes/viper) | `research_only` |
| 11 | CETA | ponteggi | A | alta | Ponteggi tubo e giunto: tubo di acciaio S235JR zincato Ø48,3×3,2 mm | [Fonte](https://www.ceta.it/prodotti/linea-ponteggi/cat-tubo-giunto) | `research_only` |
| 12 | Industria Italiana Ponteggi | ponteggi | A | alta | Ponteggio tubo-giunto: tubi Ø48 mm con marcatura del tipo di acciaio, spessore 2,9 mm | [Fonte](https://industriaitalianaponteggi.com/sistemi-di-ponteggio) | `research_only` |
| 13 | Lombarda Serre | serre | A | alta | Arcate con tubi in ferro zincato Ø60×2 mm; correnti Ø40×1,5 e Ø30×1,2 | [Fonte](https://lombardaserre.it/about-us/) | `legal_identity_hold` |
| 14 | Tecnal Serre | serre | A | alta | Bancali: gambe e binari in tubolari/tubi di acciaio zincato a caldo | [Fonte](https://www.tecnalserre.it/prodotti/serre-e-impianti/impianti-per-serre/bancali-di-coltivazione-e-esposizione) | `research_only` |
| 15 | Cresci Rimorchi | rimorchi | B | alta | N3000-R: telaio tubolare profilato zincato a caldo; qualità acciaio non specificata | [Fonte](https://www.crescirimorchi.it/index.php/n3000-r/?pid=103) | `material_hold` |
| 16 | Metalserra | serre | B | alta | Serre a tunnel: colonne in tubo quadro 80×80 e arcate Ø60/80 zincate; materiale non espresso | [Fonte](https://www.metalserra.it/serre-ad-arco/) | `material_hold` |
| 17 | MASCHIO GASPARDO S.p.A. | macchine agricole | B | alta | Rullo MARIO LT: telaio tubolare 140×80 mm; materiale non specificato | [Fonte](https://www.maschiogaspardo.com/it_it/rullo-mario-lt.html) | `existing_canonical_enrich` |
| 18 | ALPEGO S.p.A. | macchine agricole | B | alta | TR52: struttura rinforzata con tubolari trasversali; materiale non specificato | [Fonte](https://alpego.com/news/novita-alpego-eima-2026/) | `existing_canonical_enrich` |
| 19 | Artigianfer | serre | B | media | Serre Venlo con struttura mista acciaio/alluminio e tubi impiantistici; tubo strutturale d'acciaio non dimostrato | [Fonte](https://artigianfer.com/news/prima-serra-semichiusa-italia/) | `material_hold` |
| 20 | Agrimec Serre | serre | C | media | Serra solare con batteria di tubi scambiatori; non prova tubo strutturale in acciaio | [Fonte](https://www.agrimec.it/it/novita-produzione-serre/serra-solare-con-sistema-recupero-energia) | `technical_evidence_missing` |
| 21 | D'Eusanio Rimorchi | rimorchi | C | alta | Produzione rimorchi e vasche in acciaio/inox; nessuna prova del tubo strutturale nel prodotto | [Fonte](https://www.deusanio.com/deausanio_costruzioni_meccaniche_rimorchi_agricoli_in_acciaio_inox.asp) | `technical_evidence_missing` |
| 22 | Med Group Serre | serre | C | media | Lead serre già censito; non verificata in questa revisione una scheda prodotto che attesti tubi in acciaio | [Fonte](https://medgroupsrl.it/) | `technical_evidence_missing` |
| 23 | Iacono Serre | serre | C | media | Profili e accessori di serra; tubi flessibili per gonfiaggio non attestano tubolari strutturali d'acciaio | [Fonte](https://iaconoserre.it/) | `technical_evidence_missing` |
| 24 | Zaccaria Rimorchi | rimorchi | C | alta | Rimorchi con vasche in acciaio: non accertato impiego di tubo strutturale | [Fonte](https://www.zaccariarimorchi.com/) | `technical_evidence_missing` |
| 25 | Francini Rimorchi | rimorchi | C | alta | Lead produttore di rimorchi già censito; scheda tubolare d'acciaio da reperire | [Fonte](https://francinirimorchi.it/) | `technical_evidence_missing` |

## Regole di utilizzo e rilascio

1. Il manifest JSON `services/worker/data/net_it_user1a_first25_20261108.json` è **non-importabile e solo ricerca**. Non usarlo automaticamente come payload RPC, e non eseguire `UPDATE` o `INSERT` in produzione per elevare i ruoli. Promozione solo con operatore Platform realmente autenticato, prove ammissibili, decisione registrata e fonte/diritti verificati.
2. Riconciliazione effettuata su **dominio esatto** e nei 3 inventari citati, non identità legale totale, gruppi, sinonimi, lead di fonti ulteriori o diritti di ripubblicazione. Rieseguire dedup completa e suppression/opt-out prima di pubblicazione.
3. Lombarda Serre mostra riferimenti societari storici differenti (vecchi documenti Snc, sito corrente Srl): **verificare identità e P.IVA correnti**, non mescolare le due entità automaticamente.
4. ALPEGO e MASCHIO GASPARDO hanno già profili canonical published, ma `unverified`: **arricchire, non creare nuovo profilo**. Anche gli altri A non sono compratori confermati. Per ciclistica (Cinelli, Colnago, Basso), le tubazioni specialistiche **non** sono la stessa cosa di tubolari EN 10219.
5. Priorità alle prove tecniche su **ponteggi, serre, rimorchi**. Una scheda che dice solo 'metallo', 'acciaio', 'telaio' o 'impianto' non attesta acquisto di tubolari in acciaio; evitare norme, misure, prezzi, stock, buyer status o contratti per inferenza.
6. Nessun dato personale o contatto estratto; non dichiarare diritto di scraping/crawling o riutilizzo commerciale massivo per il solo fatto che una fonte è online. La fonte resta collegata per revisione.

## Prossimo microblocco

**NET-IT-USER1.B**: trattare il gruppo A tramite coda Platform e reviewer autorizzato, con registrazione puntuale delle fonti; risolvere i 5 B cercando il materiale esatto, mantenere i 6 C come potenziali utilizzatori non confermati, e lanciare una coorte **veramente nuova** di 25–50 aziende non presenti in CORE, canonical o discovery, preservando la regola una release al giorno.
