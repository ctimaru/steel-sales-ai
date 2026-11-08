# NET-IT-CARP1.D — preflight delle prime 26 schede, publisher coorte unica

Data 08/11/2026 · Project Smart Steel Sales · [tracking #1199](https://github.com/ctimaru/steel-sales-ai/issues/1199).

## Read-only preflight: 26/26 tecnicamente disponibili per review

- Esaminate 26 schede private di carpenteria: 9 già presenti nei batch A/B e arricchite leggendo i siti, 17 nuove in `NET-IT-CARP1-C-FIRSTPARTY17-20261108`.
- Tutte e 26 hanno dominio HTTPS first-party che corrisponde al dominio della scheda, ruolo `processor_service_provider` attivo e nome sufficientemente distinto al controllo di dominio/normalizzazione.
- **0** collisioni canonical pubbliche, CORE target leads, discovery candidates, discovery domain leads, suppression e duplicati normalizzati di nome. **0** collisioni netfast provisional aggiuntive sulla coorte.
- **0/26** con decisione `allows_reuse` / `allows_limited_reuse` / `licensed` già attestata nel registro `private.net_pipeline1b2l_source_rights`. Nome giuridico esatto e rights/reference URL richiedono decisione di revisore; la sola pagina ufficiale non concede automaticamente una licenza.
- Il preflight è di **sola lettura** e non prova che l'azienda sia legalmente verificata né autorizza la pubblicazione.
- Stato fonte resta `unclaimed / web_sourced_unverified / not_published`, ruolo solo proposto, 0 pubblicazioni in questo intervento.

## Scelta prima coorte
Il publisher corrente `NET-IT-RELEASEBULK1` richiede un unico `p_batch`; le 26 schede coprono più batch. Per un primo commit atomico si propone **il blocco C delle 17 schede**, tutte nello stesso batch, senza riclassificare i ruoli, con file pronto per l'operatore:
`services/worker/data/net_it_releasebulk1_carp17_operator_payload_20261108.json`.

**Importantissimo: il payload è volutamente NON SUBMITTABLE**: `p_commit=false`, `attested=false`, `p_expected_fingerprint=null`, `rights_reference_url=null`, `rights_decision=null`, `rights_note=null`. `identity_evidence_url` indica soltanto la fonte aziendale osservata; `legal_name` è ancora il nome di ricerca, non attestato in via legale.

## Passaggi reali prima della release
1. Revisore Platform autentico conferma identità e fonte, riuso minimale dei dati, assenza di opt-out; per ogni azienda completa rights evidence, decision, note e nome giuridico. Se nome differisce dalla scheda privata, riconciliare il seed sotto controllo e ripetere preview.
2. PR #1204: fissato il gate `discovery.publish` per `p_commit=true`; attendere P0 e FLOW1, code review, test PostgreSQL/staging autenticato incluse negazioni anon/reviewer-only, quindi migrazione nel percorso protetto. La funzione è ancora proposta, non installata.
3. Pubblicare solo i record ammessi con preview digest e un singolo commit autorizzato; readback `public.network_companies`, `private.netit_releasebulk1_links`, ruoli e indicatori nel Network reale. Numeri separati private/staged/published.
4. Batch A/B 9 già verificati come seconda ondata con manifest per batch, senza fusione non prevista; 50 indicizzati del lotto C restano nella corsia industrial_fit_review.

Nessuna visura camerale obbligatoria per ricerca privata. Nessuna simulazione JWT, service_role o attestazioni dei diritti inventate.

## Espansione parallela delle province (NET-IT-CARP1.D)

Durante il gate di pubblicazione sono stati letti altri **18 siti first-party** da ricerche in province meno coperte (fra cui Biella, Vercelli, Verbano-Cusio-Ossola, Benevento, Vibo Valentia e Macerata). Due siti risultavano già presenti nei registri: **16 nuove candidature** acquisite in produzione con `batch_key=NET-IT-CARP1-D-PROVINCES-FIRSTPARTY-20261108`. I siti non attestano automaticamente diritti o identità legale.

Totale nuovi record di carpenteria di tutte le ondate A+B+C+D: **271 privati con dominio distinto**, zero nuove pubblicazioni; 278 canonical Italia `published` invariati alla rilettura. Readback manifest: `services/worker/data/net_it_carp1d_province16_firstparty_20261108.json`. Le 16 sono in corsia `web_profile_review_pending`, `not_published` e `unclaimed`.
