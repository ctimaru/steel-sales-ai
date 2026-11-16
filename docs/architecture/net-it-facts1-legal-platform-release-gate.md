# NET-IT-CARP1.E.2 / FACTS1 — Legal & Platform release gate

**Stato 8 novembre 2026:** proposta tecnica e dossier per revisione; **nessun sign-off legale effettuato**, nessuna migrazione installata e **zero pubblicazioni** da FACTS1. Correlati: [issue #1219](https://github.com/ctimaru/steel-sales-ai/issues/1219), [publisher PR #1214](https://github.com/ctimaru/steel-sales-ai/pull/1214), [Notion NET-IT1](https://app.notion.com/p/3fff059cecb58123a50bce2e0f9efba6).

## Distinzione giuridica da validare

1. La direttiva UE 96/9/CE non estende il diritto d'autore ai **singoli meri fatti**; tuttavia protegge investimenti in banche dati dall'estrazione/riutilizzo sostanziale e, in condizioni specifiche, dall'estrazione sistematica di parti non sostanziali: [EUR-Lex 96/9/CE, art. 7–8](https://eur-lex.europa.eu/eli/dir/1996/9/2019-06-06/eng).
2. La Commissione europea chiarisce che GDPR non disciplina i dati delle **persone giuridiche in quanto tali**, ma può disciplinare dati di imprese individuali e dei lavoratori identificabili: [Commissione europea](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/application-regulation/do-data-protection-rules-apply-data-about-company_en).
3. La legge italiana n. 633/1941 tutela opere creative e, a certe condizioni, le banche dati; la presenza di una homepage accessibile NON equivale a licenza per loghi, foto, testi, cataloghi o estrazione sistematica: [Normattiva L. 633/1941](https://www.normattiva.it/eli/id/1941/07/16/041U0633/CONSOLIDATED/20260612).

**Conclusione operativa proposta, non parere legale:** chiedere approvazione documentata di una scheda minima derivata da osservazioni individuali su siti aziendali first-party, senza copiare contenuti espressivi e senza estrarre directory di terzi. Il reviewer giuridico deve valutare fonti, condizioni d'uso, database rights, correttezza dei fatti, minimizzazione e opt-out. Non dichiarare licenza o consenso se non esiste.

## Scheda pubblica nel solo perimetro FACTS1

Consentire esclusivamente **denominazione legale** di una S.r.l./S.p.A. adeguatamente riconciliata, paese, sito first-party e **ruolo industriale proposto/non confermato**, con descrizione originale generica prodotta dalla piattaforma. Sempre `unclaimed/unverified`.

Esclusi per il primo pilot: ditte individuali e altre forme incerte, nomi/recapiti di persone fisiche, email personali, numeri diretti, foto, loghi, testi aziendali copiati, certificazioni, capacità tubolari e clienti non verificati, affermazioni di approvvigionamento e RFQ.

## Controlli tecnici implementati SOLO come proposta

- `services/worker/sql/net_it_facts1_policy_proposed.sql` crea policy **disabled** e ledger privati con RLS, nessun accesso diretto anon/authenticated. La nuova RPC `public.netit_facts1_signoff` (wrapper Security Invoker, implementazione privata Security Definer) richiede `auth.uid()` reale, `network.privacy_governance_review`, `discovery.governance_review`, `discovery.publish`, URL HTTPS di parere/revisione legale e motivazione dettagliata. Non effettua nessuna approvazione da sola.
- `services/worker/sql/net_it_releasebulk1_proposed.sql` accetta `factual_metadata_only_reviewed` **solo se** la policy approvata è attiva, il documento indicato coincide con quello firmato e il nome è chiaramente una forma societaria S.r.l./S.p.A.; resta necessaria la review di identità first-party, il controllo delle collisioni e la conferma di coorte. La revisione policy entra nel fingerprint SHA-256. Revocare la policy impedisce nuovi commit, non elimina i profili già pubblicati (takedown separato da progettare).
- `supabase/tests/net_it_releasebulk1_local.sql` prova default-deny, divieti per anon/non-Platform, simulazione di approvazione locale su domini `.invalid`, preview, revoca, cambiamento SHA e commit atomico sintetico, con `ROLLBACK` totale. **Il test sintetico non è un attestato legale e non scrive in produzione.**
- I due SQL proposti devono essere **revisionati e ordinati in una migrazione ufficiale generata con la CLI** (`supabase migration new`) soltanto dopo i gate, passando da merge protetto e un deploy autorizzato. Non eseguire il file SQL nel progetto produttivo dalla chat o dalla SQL Console.

## Pilot carpenterie, tre identità, nessuna autorizzazione inventata

Dossier: `services/worker/data/net_it_facts1_carpenteria_pilot3_review_template_20261108.json`.

1. Bandini e Cantarelli S.r.l. (`bandinicantarelli.com`), seed esistente ma nome abbreviato `Bandini Cantarelli`.
2. Ferrinox S.r.l. (`ferrinoxsrl.it`), seed `Ferrinox`.
3. Pres Metal S.p.A. (`presmetalspa.it`), seed `Pres Metal`.

Preflight dominio, denominazione e P.IVA contro canonical e discovery: nessuna collisione alla verifica. **Tutti restano privati**, denominazioni dei seed da riconciliare in modo tracciato; campi rights nel manifesto sono null, quindi il file NON è inviabile al publisher. Prima di ogni preview definitiva rifare il controllo contro canonical, discovery, CORE, NETFAST, opt-out e ogni altra pipeline.

## Gate per il rilascio

- [ ] Revisore legale competente valida per iscritto l'esatto perimetro FACTS1, metodo di raccolta, diritti banca dati, minimizzazione GDPR/opt-out e documenta decisione con URL verificabile; nessuna licenza fittizia.
- [ ] Operatore Platform reale autentica la propria sessione e registra la decisione via RPC (mai service-role o JWT simulato in produzione).
- [ ] Code review SQL, test negativi anon / authenticated non autorizzato / revoca / doppie identità / replay / rollback, RLS/grants e CI verdi sull'HEAD finale.
- [ ] Migrazione ufficiale `supabase migration new` e deploy protetto autorizzato (nessuna installazione automatica).
- [ ] Identità delle 3 carpenterie riconciliata contro i seed, fonte aziendale e P.IVA ove disponibile; rights decision/reference/note effettivi.
- [ ] Preview del manifesto 8-campi, SHA, conferma una sola volta, commit atomico e readback SQL delle 3 company canonical pubblicate e dei 3 link ledger.
- [ ] Verifica Network pubblico, CTA `Rivendica questa azienda`, tutela opt-out e controllo che non vi siano duplicati.
- [ ] Misurare aumento reale da baseline (alla lettura **278 profili italiani pubblici**) senza confondere candidature private e pubblicazioni.

**Stato dichiarabile oggi: proposta codificata, review legale da ottenere, SQL CI da confermare, 0 nuove company canoniche pubblicate.**
