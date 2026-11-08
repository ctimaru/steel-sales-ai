# NET-IT-CARP1.C — Pubblicazione controllata + crescita nelle province

Data: 8 novembre 2026. Project: Smart Steel Sales.
Notion: https://app.notion.com/p/3fff059cecb58123a50bce2e0f9efba6
Tracking: https://github.com/ctimaru/steel-sales-ai/issues/1199

## Esecuzione su Supabase produzione

| Lotto | Nuove candidature | Tipo prova | Stato |
|---|---:|---|---|
| NET-IT-CARP1.A | 58 | Discovery da fonte web | Private, not_published |
| NET-IT-CARP1.B | 130 | Discovery da fonte web | Private, not_published |
| NET-IT-CARP1.C / first-party | **17** | Sito aziendale aperto e letto | Private, not_published |
| NET-IT-CARP1.C / indexed | **50** | Sito trovato nelle ricerche provinciali, non ancora letto individualmente | Private, not_published |
| **Totale A+B+C** | **255** | 255 domini distinti | **0 nuove pubblicazioni** |

Profilo canonical IT `public.network_companies`: **278 published** e 4 pending_review preesistenti, invariati.
Totale `private.network_web_research_seeds` per IT: 410 alla rilettura, include coorti di altri cantieri; non sommare al 255 come se tutto fosse carpenteria.

9 candidature preesistenti A/B sono state arricchite con fatti osservati direttamente dai siti; Sorti Flaminio già nei registri CORE/netfast, esclusa dall'import doppio. Il pacchetto per revisore collega queste 9 alle 17 nuove da fonti dirette: **26 schede**, senza diritti riuso attestati e senza autorizzazione di pubblicazione.

I 50 nuovi dal web index sono in `industrial_fit_review` anziché nella corsia di pubblicazione: alcuni risultati sono brand, siti di lavorazione generica o geografie indicative, da riscontrare prima di proporre il profilo pubblico. Anche i 17 first-party richiedono identità legale e rights review. Non utilizzare l'area di ricerca come sede confermata.

## Gate di pubblicazione (non bypassare)

1. **Sorgente e identità:** leggere i 26 siti del pacchetto operatore, verificare eventuale denominazione giuridica, fonte riutilizzabile, duplicati e opt-out. Nessun obbligo di visura su ogni profilo quando il sito offre elementi sufficienti.
2. **Permessi Platform:** non esiste una sessione autenticata disponibile in questo flusso per invocare l'RPC P3 di `discovery.publish`; non simulare `auth.uid()`, claims o service_role. Senza sessione Platform non dichiarare pubblicazione.
3. **Publisher di coorte:** `NET-IT-RELEASEBULK1` è draft in [PR #1204](https://github.com/ctimaru/steel-sales-ai/pull/1204), non installato. Verificata assenza di funzioni `netit_releasebulk1%` nel database. Prima del merge: aggiungere controllo distinto `discovery.publish` al ramo di commit, testare sotto permessi limitati, revisione SQL/RLS/rollback e CI. Review segnalata in commento su PR #1204.
4. **Primo micro-lotto pubblicabile:** selezionare solo schede con identità/diritti/ruolo documentati; effettuare preview → attestazione Platform → commit protetto → lettura Network reale e audit ledger.
5. **Crescita continua:** usare coda ISTAT di 110 province in PR #1205; ricerca altri 100–250 per lotto, senza attendere visure per la raccolta privata.

## Fatti non attestati

Nessuna società è qualificata automaticamente come cliente tubo, buyer, partner, fornitore pronto RFQ o certificata EN 10219; l'etichetta `processor_service_provider` è provvisoria e l'eventuale utilizzo di tubolari si dichiara solo con fonte esplicita. Nessuna immagine o descrizione marketing è ripubblicata. Profili rivendicabili e completamento delle schede da parte dei proprietari rimangono la destinazione della pipeline.

## File

- `services/worker/data/net_it_carp1c_private67_20261108.json` — manifest produzione.
- `services/worker/data/net_it_carp1c_operator_review26_20261108.json` — pacchetto revoca/diritti/identità, deliberatamente non approvato.

