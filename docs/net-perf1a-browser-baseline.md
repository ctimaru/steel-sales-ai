# NET-PERF1.A — Baseline di navigazione reale (opt-in)

**Scopo:** misurare la fluidità del Network su un browser reale autenticato
senza cambiare l'interfaccia normale e senza raccogliere dati commerciali.
**Stato:** strumento introdotto solo nel branch/PR; le metriche browser
sono **da raccogliere** dopo la verifica del rilascio. Non scambiare
l'esecuzione SQL o i tempi di CI per Core Web Vitals di un visitatore.

## Attivazione (solo platform superadmin)

1. Aprire Chrome autenticato nella workspace Smart Steel Sales.
2. Aprire `/network?netperf=1` nel dominio del deployment che contiene la
   PR. La piccola finestra 'NET-PERF1.A · Misura locale' appare in basso a destra.
   Negli accessi normali la finestra non viene montata e il chunk di misurazione
   non viene caricato.
3. A ogni viewport 1440×900, 390×844 e 320×700, scegliere **Azzera** e
   aggiornare una volta la pagina per misurare navigation TTFB/FCP.
4. Eseguire 5 iterazioni delle azioni: Italia ↔ Romania, ruolo
   Produttori/Commercianti/Terzisti, selezione prodotto/capability/mercato,
   ricerca per nome e apertura profilo. Preferire nomi pubblici o fittizi
   (il testo non viene raccolto), evitare RFQ e trattative.
5. Premere **Copia JSON**, incollare qui nella conversazione e annotare
   dispositivo/connessione e se la cache era fredda o calda. Ripetere
   per tutti e tre i viewport (tre report distinti).
6. Premere **Termina** a test concluso.

## Interpretazione del rapporto

| Campo | Cosa misura | Cosa NON misura |
| --- | --- | --- |
| `navigation.ttfb` | Browser Navigation Timing, avvio→primo byte | Non l'intera pagina |
| `paint.fcp` | First Contentful Paint osservato nel browser | Non LCP |
| `paint.lcp_candidate` | Ultimo candidato LCP disponibile in questa sessione | Non aggregato RUM p75 ufficiale |
| `paint.cls_session_max` | Massimo CLS session-window della singola navigazione | Non la popolazione utenti |
| `paint.longest_event_duration` | Evento più lungo disponibile | Non è l'INP ufficiale |
| `interaction.*` + `action_to_dom_update` | Azione→mutazione dei risultati con URL aggiornato | Non implica pittura completata |
| `interaction.*` + `full_document_to_probe_ready` | Azione→mount della sonda dopo ricaricamento | Non confrontabile direttamente con soft nav |

La sonda campiona l'azione e la mutazione DOM senza conoscere contenuti
privati. Alcuni aggiornamenti indistinguibili non generano un campione.
Non fare claim su LCP/INP p75 reali o guadagni % senza **prima/dopo**
su browser e rete omogenei. `interactionP75Ms` è calcolato solo con almeno
5 campioni, ma non combinare `action_to_dom_update` e
`full_document_to_probe_ready` per confronti statisticamente rigorosi.

## Dati e accessi

- Componente caricato con import dinamico **solo** dopo attivazione;
  server gate `context.platformSuperadmin`.
- Salva al massimo 100 righe per scheda in `sessionStorage`: tipo,
  durata numerica, classe route (`network`/`company_profile`/`other`),
  larghezza viewport e tipo di misura.
- **NON** salva testo della ricerca, query parameters, dati aziendali,
  ID organizzazione o profili, email, nomi, indirizzi, token, RFQ, cookie,
  URL completi, user agent o IP.
- **NON** emette fetch, sendBeacon o log di telemetry.
- Il JSON lascia il browser solo dopo **Copia JSON** e un'azione
  deliberata dell'operatore. I dati tab-local spariscono alla chiusura
  della scheda; il tasto Azzera elimina i campioni.
- Conservare all'interno dell'analisi solo report numerici sanitizzati;
  non allegare HAR completo o session replay di account reali.
- La sonda misura solo l'area Network; la presenza del test non autorizza
  condivisioni di dati fra aziende né una nuova telemetria GA4.

## Baseline DB raccolta il 5 novembre 2026

`pg_stat_statements` cumulativo dal 7 settembre 2026, **non browser**:

| RPC | Chiamate | Media (ms) | Massimo (ms) |
| --- | ---: | ---: | ---: |
| `netlaunch4b_browse_page` | 650 | 104,0 | 2.000,0 |
| `net_europe1c_region_coverage` | 20 | 73,7 | 529,9 |
| `netux_map1_country_stats` | 9 | 116,0 | 737,3 |

Le query Vercel Observability API per Speed Insights restituiscono HTTP 400
nel contesto del team; lo stato dell'abbonamento/abilitazione Speed Insights
va verificato prima di equiparare l'assenza di metriche a 'prestazioni buone'.
Nel repository non è installato `@vercel/speed-insights`; la sonda locale
non lo abilita automaticamente e non crea costi di telemetria Vercel.

## Gate di accettazione

- [ ] P0 Required, SEC1 e build/typecheck verdi sulla PR.
- [ ] Un primo JSON numerico reale ottenuto da una sessione autentica,
  con almeno 5 navigazioni per viewport.
- [ ] Ripetizione su 1440, 390, 320, con rete e cache annotate.
- [ ] Confronto di azioni omogenee `soft` vs `full`, senza mescolare;
  separare TTFB e paint da azione→risultato.
- [ ] Nessuna modifica al layout in modalità normale; il probe rimane
  invisibile a chiunque non sia superadmin senza opt-in.
- [ ] Solo dopo una baseline valida si autorizza NET-PERF1.B (filtri) e
  NET-PERF1.C (server) e si quantifica il beneficio prima/dopo.

Vedi [piano NET-PERF1 su Notion](https://app.notion.com/p/40ff059cecb58137b0dcd22ca81e8c2a).
