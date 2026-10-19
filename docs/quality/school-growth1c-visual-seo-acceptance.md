# SCHOOL-GROWTH1C — Original Technical Visuals & SEO Images

Data: 2026-10-19 · Ambito pubblico: /knowledge e /knowledge/articoli (3 articoli esistenti).

## Asset e uso
- Tre illustrazioni **SVG originali**, 1200x675, self-contained, leggere, senza immagini esterne, script, font distribuiti o contenuti protetti.
- Ogni articolo ha un `visual` tipizzato con src, alt e caption. La home Scuola e l'indice usano la stessa copertina. In articolo la figura è full-width con caption.
- Gli SVG sono schemi **concettuali e non in scala**, non grafici normativi né dati proprietari. La mappa industriale è volutamente una rete astratta: non inventa posizioni o capacità produttive.
- PNG **Open Graph 1200x630** renderizzato server-side tramite `next/og` per la Scuola e una variante per ciascuno dei tre articoli. Contiene i titoli reali e brand. Nessun fetch di immagini, nessuna dipendenza terza.
- Articolo: metadata OG/Twitter + `Article.image` puntano alla medesima URL pubblica PNG; canonical esistenti invariati.
- Servire `image/svg+xml` con alt descrittivo e `image/png` social, testare immagini in browser/HTTP e l'URL privata /school rimane non indicizzabile.

## Verifiche prima di un rilascio
- Tutte le copertine <16 KB, mobile cards 16:9, nessun layout shift (dimensioni esplicite), contenuti testuali SEO leggibili e senza cloaking.
- Node tests, TypeScript, Next build, CI P0; contrast guard e browser mobile.
- Post deploy: 200 + content-type corretti per le 3 SVG, /knowledge/opengraph-image e 3 /knowledge/articoli/:slug/opengraph-image, OG/Twitter/JSON-LD della pagina e snippet SEO invariati.
- Non trattare le immagini come promessa di rich results o ranking; monitorare CTR, Google Images e metriche CWV quando raccolte.

## Post-production fix — fixed social PNG endpoints
The dynamic metadata image convention produced a non-resolving URL for article-specific Open Graph links on the live deployment (HTTP 404). Follow-up routes use stable GET endpoints `/api/school-og` and `/api/school-og/:slug`; confirm HTTP 200 + `image/png` and correct metadata URL before closing. Keep the working `/knowledge/opengraph-image-...` homepage automatic metadata image. Do not ship a 404 OG tag even if Next build is green.
