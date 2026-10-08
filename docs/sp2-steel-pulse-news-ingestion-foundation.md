# SP2 — Steel Pulse News Ingestion Foundation

**8 ottobre 2026 — Microblocco SP2**  
**Obiettivo:** acquisire metadati di notizie/documenti pubblici soltanto da fonti autorizzate; escludere scraping arbitrario e pubblicazione automatica.

## Cosa viene rilasciato
1. Migrazione `20261008153000_sp2_steel_pulse_ingestion_foundation.sql`: schema SQL `steel_pulse_private`, RLS, service-role RPC, registro decisioni diritti (append-only), esecuzioni, staging `items`, vincoli sullo stato editoriale e deduplica tramite URL canonico.
2. `services/worker/app/steel_pulse_ingestion.py`: client RSS/Atom asincrono con alimentazione **manuale**; `STEEL_PULSE_INGESTION_ENABLED=false` di default, nessun cron, nessuna route API e nessuna sorgente approvata.
3. Regression su URL, port, domain allowlist, DNS pubblico, robots, no redirect, max 512 KB feed e max 25 item, anti-duplicazione, payload privo di articolo/citazioni/foto e SQL acceptance in CI.
4. Registrazione SP2 in Notion; **nessun** contenuto viene mostrato al login o nel Workspace in questa fase.

## Flusso governato
`service_role -> sp2_begin_feed_run(source_id) -> rights gate DB -> public RSS/Atom/robots -> metadata-only -> sp2_finish_feed_run(run_id, items) -> staging privato`.

Il begin applica *current* source status = approved, licenza verificata, policy + evidenza, approvazione editoriale e legale, scadenza licenza, revisione dei termini entro 90 giorni, `feed_url` configurato e permesso esplicito di discovery. Applica un lease esclusivo e il limite di una raccolta per fonte ogni 60–10080 minuti (default 24 ore). Il finish ripete i controlli principali; se le autorizzazioni decadono, la transazione non acquisisce contenuti.

**Stato iniziale in DB:** `candidate` per Eurostat, OECD, worldsteel, EUROFER, siderweb; `prohibited` per SteelOrbis. Nessun `feed_url` e nessun `approved_operations`. Le fonti non sono attive.

## Metadati memorizzati
- `canonical_url`: HTTPS nel dominio autorizzato, senza query string/frammenti.
- `source_id`: chiave verso la fonte verificata.
- `source_guid_hash`: SHA256 dell'identificatore di feed (mai guid in chiaro).
- `published_at`, `first_seen_at`, `last_seen_at`, `first_run_id`.
- `rights_evidence_url` dell'autorizzazione registrata al momento dell'acquisizione.
- `editorial_state='staged'`.

**Non** archiviamo articolo, titolo, sommario originale, HTML, immagine, contatti o dati tenant. SP3 costruirà sintesi originali solo quando le licenze e la revisione lo permetteranno.

## Permessi e limiti operativi
- Tabelle nello schema `steel_pulse_private`, non esposte nei normali schemi API; RLS su tutte; `anon`/`authenticated` privi di USAGE e DML.
- Le RPC pubbliche sono eseguibili solo dal `service_role` e verificano `auth.role()='service_role'` anche in runtime.
- Registro decisioni append-only e trigger di audit sulle modifiche dei diritti; evidenza, reviewer, seconda approvazione legale e rationale obbligatori per passare a `approved`.
- Il worker rifiuta redirection 30x, credenziali nell'URL, HTTP, porte arbitrarie, destinazioni fuori allowlist e DNS privato/link-local. Non usa proxy da ambiente (`trust_env=False`). Robots letto ad ogni tentativo, `User-Agent` dichiarato, timeout 8 s e dimensioni limitate.
- Questo microblocco non include un sottosistema di *pinned DNS resolution* contro DNS rebinding fra controllo DNS e connessione. Prima di attivare feed non istituzionali in un ambiente esposto, predisporre un egress proxy con allowlist/IP filtering effettivi o transport che blocchi ogni connessione a IP non pubblici.
- Niente schedulazione, attivazione remota o modifica di source rights da interfaccia pubblica. Per responsabilità e compliance, l'approvazione concreta deve essere oggetto di una successiva azione amministrativa con controllo del contratto effettivo.

## Esito atteso (CI)
- [x] Migrazione e SQL acceptance aggiunti a `.github/workflows/p0-required-gate.yml`.
- [x] Worker test per blocchi robots, payload strettamente metadata, fonte non approvata, feed Atom/RSS, deduplica e redirect.
- [x] Staging senza endpoint di pubblicazione e senza cron.
- [ ] CI verde (verificare PR prima merge).
- [ ] Applicazione migrazione su Supabase di produzione (non eseguita da questa PR senza verifica ambiente).
- [ ] Prima fonte con licenza item-level e approvazioni formali (nessuna attivata).

## Operatività futura
Dopo migrazione e approvazione della fonte:
`STEEL_PULSE_INGESTION_ENABLED=true python -m app.steel_pulse_ingestion --source <source_id>`
(da ambiente operativo protetto con credenziali server, **non** dal browser, con supervisione; non eseguire prima di SP3 safety acceptance).

Prima di SP3 verificare monitoraggio anomalie, blocco/errore run, lease stale (non riavviabili automaticamente per evitare sovrapposizioni), condizioni legali per singoli item, runtime egress restriction, e manual review con source URL e rights evidence.

## Collegamento roadmap
SP1 è il contratto di fonte, SP2 è ingestion/staging; SP3 sarà **Editorial Engine & Publish Gate**, SP4 login news UI, SP5 personalizzazione, SP6 alert e ritorno utenti.
