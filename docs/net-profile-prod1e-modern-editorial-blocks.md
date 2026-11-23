# NET-PROFILE-PROD1.E — Estrarre anche il testo editoriale nei DIV moderni

**Decisione founder, 23 novembre 2026:** aumentare la copertura delle schede produttori senza ricadere nel parsing della navigazione. Dopo PROD1.D, 5/5 siti del primo lotto risultavano privi di prove positive; non si deve attribuire automaticamente tale esito soltanto all'HTML: si migliora la lettura strutturale e si misura.

## Ambito implementato

- Non tocchiamo il testo appiattito usato per discovery/identità. Il parser di evidenze rimane separato.
- Oltre ai paragrafi `<p>`, accettiamo soltanto testi **leaf** all'interno di editor noti (Elementor text widgets, Gutenberg group/HTML, WPBakery, Divi, Webflow, Squarespace, Bricks, Fusion, WYSIWYG), oppure `<div>` diretti dentro un vero `<article>` e sezioni con `itemprop=description`.
- Il candidato testuale deve formare un **blocco coerente**. Un contenitore con sottosezioni/div, liste, heading, nav o altri blocchi non può concatenare pezzi indipendenti: vengono esaminati solo i singoli blocchi foglia che superano la soglia (54 caratteri per i div non espliciti, 24 negli editor dichiarati o paragrafi).
- L'interazione (link, pulsanti, form) invalida il blocco padre per impedire di costruire un'affermazione unendo testo e voce di menu/CTA.
- Sono sempre esclusi header, nav, footer, cookie, menu, breadcrumb, aside, hidden, iframe e script. Nessun fallback al testo grezzo, titolo o metadata SEO.
- Resta il filtro semantico successivo su verbi di produzione/lavorazione, prova first-party, dominio ufficiale, robots/SSRF, massimo 5 pagine per azienda, audit con URL ed estratto.

## Fuori ambito

Nessuna migrazione Supabase, nuova pianificazione, accesso pubblico, nuova card UI, prezzi/stock/varianti, o attribuzione di capacità tecniche specifiche non presenti in fonti ufficiali.

## Gate e rollout

CI worker P0 e regressioni HTML: nested Elementor, Gutenberg, Article, itemprop e negativi su menu, heading, CTA, link, modali, paragrafi figli, concatenazione tra contenitori. Solo dopo merge protetto aggiornare `net-producers-auto1` Railway allo SHA integrato; misurare il **primo lotto effettivo di 5 aziende** letto dal nuovo worker. Se non si ottengono fatti verificati, registrare correttamente `no_evidence` e non gonfiare il Network.