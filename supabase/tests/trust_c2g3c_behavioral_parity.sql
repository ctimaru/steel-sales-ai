-- TRUST-AUDIT1C.2G.3C — staging/production semantic parity smoke probe.
-- Runs inside a transaction; test rows have no real source names or payload.
-- For paired environments, this tests the two textually differing catalog objects.
BEGIN;
INSERT INTO private.trust_c2e_quarantined_checksums(content_checksum)
VALUES(repeat('e',64))
ON CONFLICT DO NOTHING;
DO $trust$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.worker_jobs(filename,extension,size_bytes,status,content_checksum)
    VALUES('synthetic-trust-c2g3c','.txt',1,'queued',repeat('e',64));
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'TRUST-C2G3C: held source bypassed worker quarantine';
  END IF;
END $trust$;
DO $trust$
BEGIN
  IF EXISTS(
    SELECT 1 FROM private.trust_c2g_company_provenance_readiness
    WHERE reuse_rights_cleared
       OR assessment_count<0 OR hold_count<0 OR linked_discovery_candidates<0
  ) THEN RAISE EXCEPTION 'TRUST-C2G3C: unsafe company provenance'; END IF;
  IF (SELECT count(*) FROM private.trust_c2g_company_provenance_readiness)
    <> (SELECT count(*) FROM public.network_companies)
  THEN RAISE EXCEPTION 'TRUST-C2G3C: missing or duplicate company readiness rows'; END IF;
  IF EXISTS(
    SELECT 1 FROM private.trust_c2g_company_provenance_readiness v
    WHERE v.assessment_count<>(
      SELECT count(*) FROM private.netdata1b5_source_assessments a
      WHERE (a.entity_kind='canonical' AND a.entity_id=v.company_id)
       OR (a.entity_kind='discovered' AND EXISTS(
         SELECT 1 FROM public.network_company_discovery_candidates d
         WHERE d.id=a.entity_id AND
           (d.promoted_company_id=v.company_id OR d.match_company_id=v.company_id)
       ))
    )
  ) THEN RAISE EXCEPTION 'TRUST-C2G3C: wrong source assessment counts'; END IF;
END $trust$;
SELECT
 (SELECT count(*) FROM private.trust_c2g_company_provenance_readiness)
  AS company_rows,
 (SELECT count(*) FROM private.trust_c2g_company_provenance_readiness WHERE reuse_rights_cleared)
  AS rights_auto_grants,
 (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'trust_c2e_block_%' AND NOT tgisinternal)
  AS quarantine_guard_triggers;
ROLLBACK;
