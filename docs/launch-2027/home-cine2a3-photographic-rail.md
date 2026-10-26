# HOME-CINE2A.3 — Cinque card fotografiche / Product journey

**Stato:** implementazione proposta in branch Preview. Non è un merge di produzione né un'approvazione 17/20 del founder. Tracking [#947](https://github.com/ctimaru/steel-sales-ai/issues/947), brief [#941](https://github.com/ctimaru/steel-sales-ai/issues/941).

## Contratto visivo e UX

- Continuazione dark steel/emerald della hero esistente, senza banner promozionali ridondanti e senza un finto software generato dentro le immagini.
- Un componente server `PublicPhotographicToolRail` condiviso da homepage IT/EN, dopo la hero.
- Cinque card: Calcolatrice → Distinta → RFQ → Network → Scuola. Copy breve, una sola CTA reale e focus keyboard per card. CTA della hero *Apri calcolatrice* resta primaria.
- Calcolatrice e Distinta pubbliche senza account; RFQ punta a login aziendale (non accessibile come invitato); Network punta al teaser pubblico (non alla directory privata). Nessuna promessa di assistente AI animato già attivo nella Scuola.
- Smartphone/tablet: scorrimento orizzontale CSS `scroll-snap` senza JavaScript, 44px action line; desktop >1199px cinque colonne. Lazy-loading delle immagini, no autoplay, WebGL o font aggiuntivi.

## Asset / provenienza e diritti

Un unico WebP **locale** `apps/web/public/home-cine2a3-five-photo-atlas.webp`, generato da un'apposita azione CI con cinque foto diverse, ciascuna ritagliata a 210×84 px. File finale 210×420 px, **16.224 byte**, SHA256 `fe8eba9b73b06a0bce1f001595edf7d682534320ec81f41a5ae70e897e0e32a6`.

| Card | Foto Pexels | Autore | Ruolo illustrativo |
|---|---|---|---|
| Calcolatrice | [Metal Tubes on Stack #15508177](https://www.pexels.com/photo/metal-tubes-on-stack-15508177/) | Zakhar Vozhdaienko | CHS in deposito |
| Distinta | [Blueprints and a Laptop #8470810](https://www.pexels.com/photo/blueprints-and-a-laptop-8470810/) | Thirdman | Specifica e documentazione tecnica |
| RFQ | [Industrial Warehouse with Metal Pipes and Crane #29224600](https://www.pexels.com/photo/industrial-warehouse-with-metal-pipes-and-crane-29224600/) | Cemrecan Yurtman | Movimentazione merce e forniture |
| Network | [3D Image of a Clear Glass Ball #14314638](https://www.pexels.com/photo/3d-image-of-a-clear-glass-ball-14314638/) | Merlin Lightpainting | Rete concettuale, non aziende vere |
| Scuola | [Industrial Worker Reviewing Documents #32845698](https://www.pexels.com/photo/industrial-worker-reviewing-documents-in-factory-32845698/) | Sergey Sergeev | Formazione / uso di conoscenza tecnica, NON nostro dipendente né professore AI |

Condizioni: [Pexels License](https://www.pexels.com/license/), uso commerciale gratuito, modifiche consentite e attribuzione non obbligatoria (qui accreditata volontariamente). Non insinuare che persone, fotografi, fabbriche o aziende fotografate usino o sponsorizzino Smart Steel Sales. Nessuna fotografia di partner o prospect spacciata per cliente; nessun brand o dato commerciale ritratto deve diventare un'affermazione. Script `apps/web/scripts/build-home-cine2a3-atlas.py`, eseguito una volta via `.github/workflows/home-cine2a3-photo-assets.yml`; il sito NON scarica nulla da Pexels a runtime.

## Verifiche prima del merge

1. Node source contracts: dimensione/magic WebP, cinque clip diverse, IT/EN routes, CTA reali, no rottura dei permessi.
2. Chrome render screenshot con consenso non espresso a 320/390/768/1440; tutti i tile devono essere navigabili, senza clipping e con crop corretti.
3. Axe zero serious/critical, keyboard/focus, testo/icone leggibili; Network e RFQ non devono esporre dati privati.
4. Lighthouse locale tre campioni vs hero release HOME-CINE2A.2B 93/93/93, LCP ~2.758 s, CLS0 e baseline HOME-CONV1A 94/94/95 LCP ~2.72s. Segnalare se LCP +150ms o performance score -3.
5. Confronto visivo con quattro reference founder, scorecard 10 criteri su 20: **non assegnare 17/20 senza review**. Merge solo dopo gate.

La preview degli asset è distinta dai mockup illustrativi: foto vere usate nelle card, testi/CTA/link sono HTML/Next reali.
