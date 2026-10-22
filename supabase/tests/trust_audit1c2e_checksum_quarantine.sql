-- TRUST-AUDIT1C.2E — schema and blocked-write acceptance. No real data modifications.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.c2e_assert(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST-C2E: %',msg; END IF; END $$;

SELECT pg_temp.c2e_assert(
  (SELECT count(*)=4 FROM pg_trigger
   WHERE tgname IN('trust_c2e_block_knowledge_reingest','trust_c2e_block_worker_reingest',
                   'trust_c2e_block_offer_reingest','trust_c2e_block_price_import')
   AND NOT tgisinternal), 'four quarantine triggers');

SELECT pg_temp.c2e_assert(
  (SELECT count(*) FROM private.trust_c2e_quarantined_checksums)
    = (SELECT count(DISTINCT lower(content_checksum)) FROM public.knowledge_documents
       WHERE status='superseded' AND checksum_algorithm='sha256'
         AND content_checksum ~ '^[a-fA-F0-9]{64}$'),
  'checksum registry reconciles with quarantined documents');

INSERT INTO private.trust_c2e_quarantined_checksums(content_checksum)
VALUES(repeat('f',64)) ON CONFLICT DO NOTHING;

DO $check$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.worker_jobs(filename,extension,size_bytes,status,content_checksum)
    VALUES('synthetic-gate-test.txt','.txt',1,'queued',repeat('f',64));
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Blocked fingerprint accepted by worker'; END IF;
END $check$;
ROLLBACK;
