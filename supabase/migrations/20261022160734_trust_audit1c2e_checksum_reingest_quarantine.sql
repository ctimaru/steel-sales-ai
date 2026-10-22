-- TRUST-AUDIT1C.2E: SHA256-based non-destructive quarantine.
-- Production/staging migration, 2026-10-22. No file names or hash values committed.
CREATE TABLE IF NOT EXISTS private.trust_c2e_quarantined_checksums (
  content_checksum text PRIMARY KEY CHECK (content_checksum ~ '^[a-fA-F0-9]{64}$'),
  reason_code text NOT NULL DEFAULT 'source_ip_review',
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.trust_c2e_quarantined_checksums FROM PUBLIC,anon,authenticated;
INSERT INTO private.trust_c2e_quarantined_checksums(content_checksum)
SELECT DISTINCT lower(content_checksum) FROM public.knowledge_documents
WHERE status='superseded' AND checksum_algorithm='sha256'
AND content_checksum ~ '^[a-fA-F0-9]{64}$'
ON CONFLICT(content_checksum) DO NOTHING;
CREATE OR REPLACE FUNCTION private.trust_c2e_prevent_quarantined_reingest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $b$
DECLARE c text;
BEGIN
  c:=lower(new.content_checksum);
  IF c IS NULL OR length(c)<>64 THEN RETURN new; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.trust_c2e_quarantined_checksums q WHERE q.content_checksum=c) THEN RETURN new; END IF;
  IF TG_TABLE_NAME='knowledge_documents' AND new.status='superseded' THEN RETURN new; END IF;
  IF TG_OP='UPDATE' AND old.content_checksum IS NOT DISTINCT FROM new.content_checksum
     AND old.status IS NOT DISTINCT FROM new.status THEN RETURN new; END IF;
  RAISE EXCEPTION 'Quarantined source fingerprint cannot be re-ingested' USING ERRCODE='42501';
END;$b$;
REVOKE ALL ON FUNCTION private.trust_c2e_prevent_quarantined_reingest() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trust_c2e_block_knowledge_reingest ON public.knowledge_documents;
CREATE TRIGGER trust_c2e_block_knowledge_reingest BEFORE INSERT OR UPDATE OF content_checksum,status ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION private.trust_c2e_prevent_quarantined_reingest();
DROP TRIGGER IF EXISTS trust_c2e_block_worker_reingest ON public.worker_jobs;
CREATE TRIGGER trust_c2e_block_worker_reingest BEFORE INSERT OR UPDATE OF content_checksum,status ON public.worker_jobs FOR EACH ROW EXECUTE FUNCTION private.trust_c2e_prevent_quarantined_reingest();
DROP TRIGGER IF EXISTS trust_c2e_block_offer_reingest ON public.commercial_offer_source_reingests;
CREATE TRIGGER trust_c2e_block_offer_reingest BEFORE INSERT OR UPDATE OF content_checksum,status ON public.commercial_offer_source_reingests FOR EACH ROW EXECUTE FUNCTION private.trust_c2e_prevent_quarantined_reingest();
DROP TRIGGER IF EXISTS trust_c2e_block_price_import ON public.price_list_import_runs;
CREATE TRIGGER trust_c2e_block_price_import BEFORE INSERT OR UPDATE OF content_checksum,status ON public.price_list_import_runs FOR EACH ROW EXECUTE FUNCTION private.trust_c2e_prevent_quarantined_reingest();
