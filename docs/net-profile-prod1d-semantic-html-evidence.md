# NET-PROFILE-PROD1.D — Distinguere contenuto aziendale dai menu HTML

**Decisione operativa del 23 novembre 2026:** l'estrattore di prove dei produttori deve citare frasi aziendali effettive, non link di menu ripetuti in tutte le pagine. Il riscontro del canary Bonacina aveva evidenziato una frase di navigazione simile a "Produzione di viti..." erroneamente identificabile come processo produttivo.

## Soluzione

- Il crawler `company_discovery._fetch_page` conserva il testo completo per ricerca, identità e navigazione, ma aggiunge il campo opzionale `CrawledPage.evidence_blocks`, separato dal testo appiattito.
- Il parser HTML di evidenze raccoglie SOLO paragrafi editoriali `<p>` o contenitori di testo identificati come WYSIWYG/descriptions, mantenendo il testo continuo dentro le singole frasi. Non raccoglie menu, breadcrumb, footer, header, sidebar, modali/cookie, link, pulsanti, script, titoli e meta description.
- L'estrattore `net_profile_prod1b.source_backed_facts` usa **solo** `evidence_blocks` se presente, anche quando vuoto. Vietato ricadere su `page.text`/SEO e introdurre un'affermazione non presente nel corpo. Restano le regole positive di produzione e lavorazione, identità del dominio, robots/SSRF, limiti max 5 pagine per azienda e trace first-party.
- Un `evidence_blocks=None` è ammesso solo per compatibilità con i fixture/fetch sintetici legacy; le pagine effettivamente scaricate da HTTP restituiscono sempre una tupla.
- Nessuna modifica allo schema Supabase, al contratto RPC, alle interfacce Free/PRO, agli stock, al catalogo strutturato o alle automazioni esistenti. Nessun cron aggiuntivo.

## Collaudo e misura

Test HTML annidato: frasi dal menu, meta, `h1`, anchor, footer o cookie non devono diventare prodotti fabbricati; il paragrafo editoriale esplicito deve invece creare una sola prova. Integrazione fetcher robots/SSRF in mock, con link ancora disponibili per scoprire sezioni.

Una volta rilasciato sul worker Railway esistente, esaminare un lotto limitato di 5 aziende e confrontare accepted / no_evidence / blocked / false positives. È normale ridurre l'accettazione quando prima l'unica frase era nel menu. La precisione resta il criterio di rilascio.
