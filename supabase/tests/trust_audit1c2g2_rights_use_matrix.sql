-- TRUST-AUDIT1C.2G.2: allow+deny checks with rollback (no real rights assigned).
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_c2g2(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST-C2G2: %',msg; END IF; END $$;

SELECT pg_temp.assert_c2g2(
  (SELECT count(*) FROM private.trust_c2g2_company_allowed_use_matrix)
   = (SELECT count(*)*7 FROM public.network_companies),'7 scopes for every company');
SELECT pg_temp.assert_c2g2(
  (SELECT count(*) FROM private.trust_c2g2_evidence_use_matrix)
   = (SELECT count(*)*7 FROM private.trust_c2g1_source_evidence_links),'7 scopes for every evidence');
SELECT pg_temp.assert_c2g2(
  NOT EXISTS(
    SELECT 1 FROM private.trust_c2g2_rights_decisions
    WHERE decision IN('allowed','limited')
      AND (rights_basis IS NULL OR evidence_url IS NULL OR reviewed_by IS NULL
           OR reviewed_at IS NULL OR nullif(btrim(coalesce(terms_version,'')),'') IS NULL)
  ),
  'all future granted rights must have documented evidence');
SELECT pg_temp.assert_c2g2(
  NOT EXISTS(
    SELECT 1 FROM private.trust_c2g2_company_allowed_use_matrix
    WHERE company_use_state IN('allowed','limited')
      AND (reviewed_links <> linked_evidence_count OR hold_count > 0
           OR (company_use_state='allowed' AND allowed_links <> linked_evidence_count))
  ),
  'future allowed/limited scopes require full explicit rights coverage and no holds');
SELECT pg_temp.assert_c2g2(
  NOT has_table_privilege('anon','private.trust_c2g2_rights_decisions','SELECT')
  AND NOT has_table_privilege('authenticated','private.trust_c2g2_rights_decisions','SELECT')
  AND NOT has_table_privilege('service_role','private.trust_c2g2_rights_decisions','INSERT')
  AND has_table_privilege('service_role','private.trust_c2g2_company_allowed_use_matrix','SELECT'),
  'no Data API access or server auto-approval');

DO $tests$
DECLARE eid uuid; ek text; inserted uuid;
        invalid_allowed boolean:=false;
        missing_evidence boolean:=false;
        immutable_block boolean:=false;
BEGIN
 SELECT evidence_id,evidence_kind INTO eid,ek
 FROM private.trust_c2g1_source_evidence_links LIMIT 1;
 IF eid IS NULL THEN RAISE EXCEPTION 'no staged evidence to test'; END IF;
 BEGIN
  INSERT INTO private.trust_c2g2_rights_decisions(evidence_kind,evidence_id,use_scope,decision)
  VALUES(ek,eid,'paid_network','allowed');
 EXCEPTION WHEN check_violation THEN invalid_allowed:=true;
 END;
 IF NOT invalid_allowed THEN RAISE EXCEPTION 'grant without evidence accepted'; END IF;
 BEGIN
  INSERT INTO private.trust_c2g2_rights_decisions(evidence_kind,evidence_id,use_scope,decision)
  VALUES('canonical_evidence','00000000-0000-0000-0000-000000000002','ai_training','blocked');
 EXCEPTION WHEN foreign_key_violation THEN missing_evidence:=true;
 END;
 IF NOT missing_evidence THEN RAISE EXCEPTION 'missing evidence accepted'; END IF;
 INSERT INTO private.trust_c2g2_rights_decisions(evidence_kind,evidence_id,use_scope,decision,review_note)
 VALUES(ek,eid,'paid_network','blocked','Synthetic acceptance test; rolled back') RETURNING decision_id INTO inserted;
 IF NOT EXISTS(
 SELECT 1 FROM private.trust_c2g2_evidence_use_matrix m
 WHERE m.evidence_id=eid AND m.evidence_kind=ek AND m.use_scope='paid_network'
   AND m.effective_rights_state='blocked'
 ) THEN RAISE EXCEPTION 'block not reflected in matrix'; END IF;
 BEGIN
  UPDATE private.trust_c2g2_rights_decisions SET decision='allowed' WHERE decision_id=inserted;
 EXCEPTION WHEN insufficient_privilege THEN immutable_block:=true;
 END;
 IF NOT immutable_block THEN RAISE EXCEPTION 'ledger not append-only'; END IF;
END $tests$;
SELECT count(*) AS transient_decisions FROM private.trust_c2g2_rights_decisions;
ROLLBACK;
