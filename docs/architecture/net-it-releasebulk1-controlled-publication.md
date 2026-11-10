# NET-IT-RELEASEBULK1 — Pubblicazione italiana con una conferma

Data 8 novembre 2026. Tracking GitHub issue #1202. Il codice è una proposta NON APPLICATA alla produzione, nel file SQL del worker.

## Stato reale

* Supabase Italia: 163 record privati alla lettura, inclusi 58 dalle due coorti carpenteria parallele.
* 77 record con corsia tecnica web_profile_review_pending. Sono prioritari da verificare, NON approvati per la pubblicazione.
* GROWFAST2 ha importato 51 nuovi prospect in privato; 5 nella corsia tecnica e 46 nell'industrial-fit review.
* Catalogo pubblico Italia: 278 canonical published. Nessun end-user canonical published.
* Questa funzionalità proposta ha pubblicato ZERO aziende.

## UX: una sola schermata e una sola conferma

1. Filtro per paese, batch, settore e ruolo, massimo 100 aziende per coorte. Una riga compatta per sito, ruolo, prova industriale, identità, diritti e blocco.
2. Un revisore Platform autentico carica un manifesto che riporta per ogni azienda esattamente otto campi: seed_id, domain, role, legal_name, identity_evidence_url, rights_reference_url, rights_decision e rights_note. Un URL ufficiale NON dimostra automaticamente i diritti: servono decisione e prova reali.
3. Bottone Anteprima: la funzione ritorna requested, eligible, blocked e fingerprint SHA-256. Nessuna scrittura pubblica o privata di approvazione.
4. Se eligible equivale a requested: bottone Pubblica coorte. Il revisore attesta le verifiche, e il client invia il manifesto identico e il fingerprint visualizzato in anteprima.
5. Commit atomico con advisory lock e lock della tabella canonical. Ogni scostamento di ruolo, identità, dominio, fonte, stato o updated_at dopo l'anteprima invalida il fingerprint e fa fallire tutto, senza pubblicazioni parziali.
6. Audit privato di wave, seed, research ID, company canonical, reviewer UUID, URL di identità e diritti, decisione e note, fingerprint. Replay della stessa wave coerente restituisce already_published; wave parziale o modificata fallisce.

## Regole e sicurezza

- Anteprima e commit richiedono `auth.uid()` reale e i permessi Platform `discovery.governance_review` e `discovery.run`. **Il solo commit (`p_commit=true`) richiede inoltre `discovery.publish`**, verificato prima di replay, lock o scritture: un revisore con i soli permessi di governance può leggere l'anteprima, ma non pubblicare. La funzione Definer è in `private`, il wrapper `public` è Security Invoker e la chiamata anon è revocata.
- Ammessi soltanto seed IT di fonte aziendale e corsia web_profile_review_pending, non rivendicati, web_sourced_unverified e not_published, con ruolo attivo.
- Identità societaria e nome esatto già riconciliati. Brand di gruppo, collisioni nominali, siti soppressi e lead già presenti nella pipeline devono essere esclusi prima di approvare la coorte.
- Nessuna licenza/diritto può essere inventato: le verifiche e le evidenze dei diritti devono essere documentate e attestate da un reviewer reale. Il prototipo non usa una visura obbligatoria per il semplice record privato di ricerca.
- I profili canonical che verranno pubblicati soltanto dopo i gate resteranno unclaimed e unverified; non vanno associati automaticamente ordini, volumi, certificazioni, buyer verificati, contatti personali o capacità tubolari non dimostrate.
- Nessun numero baseline hardcoded: le altre coorti private che crescono in parallelo non modificano il manifesto selezionato.

## File e gate di rilascio

SQL di proposta: services/worker/sql/net_it_releasebulk1_proposed.sql.
Template NON APPROVATO dei primi tre: services/worker/data/net_it_releasebulk1_pilot3_review_template_20261108.json.
Test offline: services/worker/tests/test_net_it_releasebulk1_contract.py.

Prima del deployment: generare una migrazione ufficiale nel repository; eseguire revisione RLS, grants e privacy; testare con account Platform reale, falso account e anon; testare fingerprint drift, duplicati fra cataloghi, opt-out, idempotenza e rollback di una riga. Solo dopo CI verde e merge protetto applicare la migrazione e realizzare l'interfaccia compatta, una pagina, desktop/mobile. Un deploy di produzione al giorno. Il documento NON costituisce autorizzazione alla pubblicazione.

## Pilot read-only specifico (8 novembre 2026)

La coorte pilota aggiornate è composta da **Lazzari S.r.l.**, **Retissima S.r.l.** e **Sottile S.r.l.**, nel batch `NET-IT-USER1B-PRIVATE21-20261108`. Una query di produzione **SELECT-only** ha verificato per tutte le tre righe: source URL HTTPS first-party, review lane `web_profile_review_pending`, ruolo proposto `end_user`, nome in ricerca coerente con il manifesto, nessun canonical/CORE domain collision e nessuna soppressione. Per tutte **rights_review_attested=false**, quindi **authorized_for_publication=false**. Nessuna funzione RELEASEBULK1 installata e nessun write canonico eseguito.

Due fonti GROWFAST2 sono state corrette prima dell'avvio del publisher: Adeglas tratta principalmente tubi in plexiglass/plastica/alluminio (`industrial_fit_review`), mentre TCB Tubi identifica Tecnotubi/Gruppo Amenduni Steel (`brand_legal_identity_review`). Entrambi restano privati. Le condizioni tecniche del pilot3 non sostituiscono la decisione legale/riuso dei dati dell'operatore.

## Gate di sicurezza NET-IT-CARP1.C — 8 novembre 2026

- Fix richiesto in review: la pubblicazione ora esige `discovery.publish` anche con `p_attested=true` e fingerprint corretto; `discovery.governance_review` + `discovery.run` non bastano. La sola preview resta disponibile ai revisori autorizzati.
- Aggiunto un test statico per posizione e unicità del permesso. Non dichiarare test con sessioni reale/anon finché non effettuati in ambiente autorizzato.
- Restano necessari una prova reale con Platform reviewer privo di `discovery.publish`, una con utente che lo possiede, una con anon, prove di rollback/duplicati e diritti/identità documentati sui candidati. Non usare service-role o JWT simulati.
- La PR è una proposta SQL e non installa il publisher in produzione; mantenere il gate di protected merge/CI, un deploy al giorno.


## Revisione protetta su baseline main (8 novembre 2026)

Questo branch riallineato riprende la PR draft #1204 con correzioni fail-closed aggiuntive: **duplicati di persona giuridica nella stessa wave**, collisioni su tutti i cataloghi NETFAST/bulk/discovery, inclusi profili canonical **archiviati** (mai ricreare un opt-out non riconciliato). Aumentati i lock transazionali delle pipeline concorrenti; test statici aggiuntivi. La nuova PR **sostituisce** la #1204, ma resta Draft fino a CI, revisione PostgreSQL e sessione Platform autentica con decisioni sui diritti realmente attestate. Non applicare la proposta SQL direttamente alla produzione né pubblicare le tre aziende pilota per il solo superamento del preflight tecnico.
