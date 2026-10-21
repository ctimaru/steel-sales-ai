# SUPA-LEDGER2 — verificare SQL applicato, non soltanto timestamp

**Data campione:** 21 ottobre 2026. **Modalità:** sola lettura e CI offline. **Blocco produzione:** resta attivo finché la riparazione non viene validata con procedura ufficiale.

## Origine verificabile
- Progetto: `ecrafjdummcdfycznitx`.
- Query di sola lettura: `SELECT version, name, encode(extensions.digest(statements[1], 'sha256'),'hex') AS sha256, octet_length(statements[1]) AS bytes FROM supabase_migrations.schema_migrations ORDER BY version`.
- Il registro storico al momento della cattura contiene **466 record**, ciascuno con **una** voce `statements[1]`.
- Snapshot: `supabase/audits/20261021_migration_content_fingerprints.json`. Comprende solamente SHA256, byte-size, nome e versione — nessun SQL aziendale, token o password.
- Comparatore: `supabase/tools/migration_sql_fingerprint_audit.py`. Legge i file SQL GitHub come **byte**, calcola SHA256/byte-size e classifica con il report completo.
- Test: `supabase/tools/test_migration_sql_fingerprint_audit.py`. Workflow `.github/workflows/supa-ledger2-sql-audit.yml`: **offline**, senza segreti o accesso a Supabase, con artifact `migration-sql-equivalence-report.json`.

## Risultato effettivo da GitHub Actions (21 ottobre 2026)
Workflow [SUPA-LEDGER2 run #39558805507](https://github.com/ctimaru/steel-sales-ai/actions/runs/39558805507) **SUCCESS**; artifact `supa-ledger2-sql-equivalence-39558805507` contiene 437 classificazioni e tutte le 36 voci senza corrispondente nome locale.

| Gruppo | Numero | Azione consentita |
|---|---:|---|
| Stessa versione e SHA-256 del testo SQL | **33** | Conservare, non riparare |
| SQL byte-identico ma versione diversa | **270** | Candidato a valutazione di riallineamento selettivo, non autorizzato automaticamente |
| Solo commenti introduttivi / spazi di fine file diversi | **68** | Verificare la sequenza, documentare la provenienza; non assumere automaticamente equivalenza operativa |
| Differenze nel corpo SQL dopo normalizzazione conservativa | **47** | **Bloccare repair e valutare la modifica** |
| Nomi duplicati / ambigui | **7 file GitHub** | Distinguere ogni versione; non eseguire repair massivo |
| Solo file GitHub | **12** | Analizzare schema/presenza degli oggetti |
| Solo storico Supabase | **36** | Conservare cronologia/provenienza e analizzare la funzione originaria |

La prima esecuzione grezza identificava 115 file con SHA-256 differente. Il secondo comparatore separa **68 differenze cosmetiche** dai **47 casi con corpo SQL non identico**. Nessuna delle due categorie autorizza modifiche allo storico senza verifiche aggiuntive.

**Priorità dei 47:** sicurezza/tenant e ruoli (es. `add_organization_tenant_foundation`, `harden_p1_onboarding_security_definers`, `p0a_1_platform_superadmin_foundation`, `hp8_team_invitations_role_onboarding`); core Network/claim (es. `m4_governance_trust`, `m7_registration_bridge`, `m8_managed_profile_cutover`); RFQ e governance (`rfqh1_campaign_supplier_foundation`, `rfqh13_governance_team_rls`); catalogo EN 10210/10219/10216/10217 e riferimenti di peso. Questi richiedono diff di SQL e schema prima di qualunque decisione.

## Regole di classificazione
- `exact_version_and_sql`: stesso nome, versione e SQL identico.
- `identical_sql_different_version`: nome e SQL **byte-identici**, versione diversa. È una prova forte per progettare una possibile riparazione, ma non autorizza la riparazione.
- `different_sql_same_name`: stesso nome ma contenuto diverso. **Blocco**: revisionare differenze SQL e schema; non sostituire una migrazione eseguita solo per il timestamp.
- `ambiguous_duplicate_name`: uno o più duplicati locali/remoti. **Blocco** finché è ricostruita la provenienza di ogni applicazione.
- `only_in_local`: file presente in repo ma non nello storico con lo stesso nome. L'assenza dal ledger non significa automaticamente assenza dallo schema.
- `only_in_remote`: migrazione nello storico ma non disponibile con lo stesso nome nel repository; conservare la prova, non eliminare.

## Procedure consentite e vietate
1. Eseguire il job di fingerprint offline e conservare l'artifact. Se la verifica delle **sette TRADER1A–D.2** non coincide sui byte, bloccare e investigare.
2. Completare il workflow ufficiale SUPA-LEDGER1 **read-only linked CLI** su main, usando esclusivamente secrets protetti configurati in GitHub e `linked_cli=true`.
3. Confrontare le effettive varianti di schema e migrazioni, sequenza storica, cause dei duplicati, dipendenze e release simultanee.
4. Preparare una PR separata con **piano ufficiale selettivo** basato su `supabase migration repair`, con backup/rollback documentati e autorizzazione di release, senza modificare direttamente `supabase_migrations.schema_migrations` con SQL.
5. Verificare nuovamente la lista locale/remota e integrità DB prima di applicare le nuove migrazioni 2D1 → 2D2 → 2D3 e/o TRADER1D.3B.2.

**Non consentito:** `supabase db push` sul ledger divergente, repair massivo su 300+ nomi, modifiche manuali al ledger, assunzione che un hash uguale equivalga a compatibilità dello schema corrente, spostare segreti in chat/PR/log, o dichiarare IDENTITY2D rilasciato prima della prova applicativa autenticata.

[Risorsa operativa #780](https://github.com/ctimaru/steel-sales-ai/issues/780) · [IDENTITY2D #798](https://github.com/ctimaru/steel-sales-ai/issues/798).
