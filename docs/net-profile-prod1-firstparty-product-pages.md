# NET-PROFILE-PROD1 — Fonti prodotto nella scheda del produttore

Decisione founder 2026-11-23: l'area **Attività e prodotti** è il biglietto da visita del produttore. Dare priorità a informazioni strutturate e specifiche, con evidenze first-party; evitare la falsa equiparazione tra un produttore, un distributore, chi lavora tubi e chi produce macchine.

## Fase A: collegamento immediato delle pagine prodotto già raccolte

Baseline read-only Supabase 2026-11-23: 266 produttori pubblicati IT, 142 descrizioni dirette, 10 schede con almeno un prodotto strutturato. Nel crawler produttori risultano 568 pagine prodotto HTML processate con SHA e host ufficiale esatto, su 152 produttori pubblicati nel mondo. Queste **non** sono 568 prodotti verificati; sono pagine da consultare.

La PR collega la pagina azienda Free e Pro a un reader limitato a 4 URL, che espone **solo** collegamenti first-party già processati dalla coda esistente. La descrizione e le famiglie prodotto non vengono inventate né dedotte dall'URL. Non sono coinvolti prezzi, inventario, specifiche PRO, cataloghi con licenza, PDF, lead privati o modifiche al ruolo/claim.

Controlli SQL: workspace attivo o accesso Pro esistente; company published e non archiviata; ruolo producer; HTTPS/host e dominio identici al sito ufficiale canonical; checksum snapshot; pagina catalogata come products e processed. RPC revocata a anon e public, permesso ristretto ad authenticated. Client fail-closed in assenza della migrazione.

## Rollout protetto

1. P0 required, test UI e test sicurezza, verificare SQL su ambiente di prova prima del merge.
2. Merge protetto e migrazione applicata nello slot Supabase autorizzato. Per 2 profili con fonti e 1 senza: controllare Free e Pro, link validi, 320/390/1440px e fonti solo first-party.
3. Readback SQL della copertura distintamente per Italia/Europa, conteggio link esposti e verifica che nessuna candidatura tecnica sia diventata un prodotto.
4. Deploy Vercel nello slot previsto; confermare READY. Solo allora dichiarare i link online.

## Fase B: arricchimento industriale effettivo (non incluso in questa PR)

Scandire le pagine sorgente con il crawler già esistente, estrarre breve descrizione originale riscritta con termini non generici + famiglie, lavorazioni e norme **specifiche** con relazione (produce / trasforma / distribuisce). Validare affermazione per affermazione con contenuto citabile e fonte ufficiale; non promuovere candidati semplicemente perché la pagina contiene un termine. Usare le code di arricchimento e i gate esistenti; i valori dubbi non escono pubblicamente. Priorità ai 124 produttori italiani senza descrizione diretta e ai 256 senza famiglie prodotto. Misurare aziende con descrizione, aziende con almeno una famiglia documentata, fonti e ultima verifica. Non riaprire le PR DATA2 #1297/#1300, sospese in Notion, senza una decisione esplicita.
