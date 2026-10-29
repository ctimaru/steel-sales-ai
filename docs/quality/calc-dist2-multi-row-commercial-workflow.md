# CALC-DIST2 — Multi-Riga & Commercial Workflow

## Decisione di prodotto — 29 ottobre 2026

Preserviamo **CALC-DIST1** come componente unico del drawer tecnico-commerciale.
Una Distinta con 1–4 righe mantiene le card complete. Da **5 righe** si applica
automaticamente una presentazione compatta delle **medesime righe**, senza creare
un nuovo editor, un motore di peso, un duplicato di stato né modificare i payload RFQ.

Ogni riga mantiene descrizione, norma/grado, quantità editabile, metri, tonnellate,
4 azioni (modifica, duplica, rimuovi, prezzo) e lunghezza barra, ove applicabile.
La voce `Mostra dettagli` espande tutte le card; `Compatta righe` ripristina
la scansione rapida. La preferenza rimane solo nello stato visivo React.

## Continuità e sicurezza del workflow

- Il calcolo di riga e i totali restano quelli di `buyer-distinta`.
- La quantità e la lunghezza modificata rimangono **bozze locali** fino a Enter/Salva.
- L'editing completo e quello del target privato impediscono **copia e creazione RFQ**
  finché non vengono salvati o annullati. Le quantità non salvate mantengono il blocco precedente.
- Non è possibile duplicare una riga mentre ha una quantità non confermata o un
  proprio editor aperto; questo evita di clonare quantità o prezzi obsoleti.
- I draft legati a una riga rimossa vengono eliminati; nessun residuo in memoria.
- Il riepilogo con metri, tonnellate e CTA privata rimane nel **footer del drawer**.
- Le preferenze di presentazione non vengono salvate nel `sessionStorage`.
  Prezzi buyer privati non entrano in clipboard, sessione tecnica o RFQ senza opt-in.
- Il pulsante **Crea RFQ privata** mantiene il percorso protetto esistente:
  autenticazione, azienda autorizzata, snapshot canonico e RFQ Hub; non invia
  richieste a fornitori in automatico.

## Criteri di accettazione

1. Cinque lingue IT/EN/DE/FR/ES con 10 righe sintetiche ciascuna.
2. Mobile 320 e 390px, desktop 1440px; nessun overflow orizzontale.
3. Con 10 righe la card compatta resta sotto 180px, tutte le azioni utilizzabili.
4. Footer RFQ resta visibile mentre il contenuto viene scrollato.
5. Modifica quantità non salvata: RFQ e copia disabilitate, duplicazione disabilitata
   solo sulla riga interessata; salvataggio con Enter riabilita i flussi.
6. Modifica avanzata/prezzo aperta: RFQ bloccata; annullamento ripristina il flusso.
7. Vista espansa e compatta non alterano valori, numero di righe o dati privati.
8. Scendendo sotto le cinque righe torna la resa CALC-DIST1.
9. Non vengono mai creati account, campagne RFQ o invii reali nei test visuali.
10. CI verde, controllo manuale visivo sugli screenshot prima del protected merge.

## Evidenza tecnica

- `apps/web/tests/calc-dist2-multi-row.test.mjs`
- `apps/web/tests/calc-dist2-chrome-multi-row.mjs`
- `.github/workflows/perf2-1-mobile-acceptance.yml` con artifact visual QA.

## Stato

Implementazione su branch dedicato. **Il merge e il sign-off visuale restano
subordinati ai controlli CI**; nessuna dichiarazione di pilot autorizzato o
adozione reale è implicata da questi test sintetici.
