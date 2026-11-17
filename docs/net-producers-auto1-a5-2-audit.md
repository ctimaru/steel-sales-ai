# AUTO1.A.5.2 — Campione retrospettivo delle fonti tecniche

**Stato:** sviluppo in PR #1387; NON installato né attivo in produzione fino a migrazioni, gate e rilascio protetto. Dipende dalla diagnostica A5.1 (originariamente PR #1383).

## Perché
La raccolta depth-two dispone di 34 pagine `processed` e 6 `failed` (istantanea del 17/11/2026), ma non ha ancora una combinazione dimostrata **norma + grado + forma + dimensione nella stessa riga HTML**. Le pagine HTML non vengono archiviate. È scorretto assegnare una ragione tecnica a una vecchia scansione senza recuperare nuovamente la stessa versione byte-per-byte.

## Sequenza di rilascio
1. Verificare gate P0 Supabase foundation/worker e review Codex sulla SHA effettiva; nessun bypass.
2. Installare **una volta** la migrazione privata `20261117101500_net_producers_auto1a5_evidence_gap_diagnostics.sql`, poi la funzione di campionamento read-only `20261117113000_net_producers_auto1a5_2_readonly_sample.sql`. Verificare `anon` e `authenticated`: NO EXECUTE sulle facciate `public`; `service_role`: EXECUTE; RLS e ACL sulla tabella privata.
3. Distribuire il worker sulla SHA merged controllando le altre versioni, **senza toccare il cron `*/20 * * * *`**. La diagnostica A5 ordinaria resta opt-in (`NETPRODUCERS_A5_ENABLED`); il campionatore A5.2 non è associato al cron.
4. Dal worker autorizzato, con le credenziali già custodite in Railway, eseguire **una sola volta** e senza `--persist`:

   ```bash
   python -m app.net_pro_producers_auto1 --audit-a5 --sample 8
   ```

5. Leggere `selected`, `sha_matched`, `changed_snapshot`, `http_blocked`, `http_failed` e `reasons`. Solo `sha_matched` produce motivi A5 attribuibili allo snapshot originale. Se `sha_matched=0`, riportare il limite e non inferire cause dalle sole URL.
6. Per campione più ampio, `--sample 12` è il massimo assoluto e il database limita a **2 per dominio**. Non ripetere senza scopo o anticipare i `next_check_at`. Il comando è **read-only**: zero lease/record/requeue/insert/update, zero pubblicazioni.

## Sicurezza ed esiti
- Produttori IT pubblicati, siti ufficiali verificati, parent e root SHA coerenti e freschi (35 giorni); pagina depth-two già `processed` e non ancora due-now.
- HTTPS; DNS pubblico; robots; no redirects; niente PDF; HTML max 512 KB; `trust_env=False`.
- L'audit confronta il **SHA-256 dei byte HTML** con `last_sha256`, non solo il contenuto indicizzato o la somiglianza testuale.
- Output JSON **solo aggregato**: non stampa domini/URL, HTML, hash, estratti, grade/standard/dimensioni o identificatori.
- Le combinazioni che non sono esplicite nella stessa riga non diventano mai candidate; i candidati A4 non diventano automaticamente capacità produttive.
- I link a `lavora-con-noi`, `posizioni-aperte`, `sostenibilita` o `criteri-ambientali-minimi` non sono più nuovi target di discovery A4. I link tecnici strutturali con riferimenti a norme/dimensioni hanno precedenza; URL preesistenti e fonti conservate **non vengono cancellati**.
- Controllare la prima raccolta regolare A5 separatamente: non usare il campionamento retrospettivo come prova del funzionamento del cron.

**Tracciamento:** #1349, #1383, #1387.
