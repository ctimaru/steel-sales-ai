-- TRUST-AUDIT1C.2G.1: structural + rights-safe read-only acceptance, rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.trust_c2g1_assert(ok boolean,msg text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST C2G1 FAIL: %', msg; END IF; END $$;
SELECT pg_temp.trust_c2g1_assert((SELECT count(*) FROM private.trust_c2g1_company_evidence_summary)=(SELECT count(*) FROM public.network_companies),'one summary per company');
SELECT pg_temp.trust_c2g1_assert((SELECT sum(linked_evidence_count) FROM private.trust_c2g1_company_evidence_summary)=(SELECT count(*) FROM private.trust_c2g1_source_evidence_links),'links equal evidence summary');
SELECT pg_temp.trust_c2g1_assert(NOT EXISTS(SELECT 1 FROM private.trust_c2g1_source_evidence_links WHERE company_id IS NULL OR reuse_clearance <> 'not_cleared'),'no orphan or false clearance');
SELECT pg_temp.trust_c2g1_assert(NOT EXISTS(SELECT 1 FROM private.trust_c2g1_company_evidence_summary WHERE reuse_rights_cleared),'no auto-licensed companies');
SELECT pg_temp.trust_c2g1_assert(NOT has_table_privilege('anon','private.trust_c2g1_source_evidence_links','SELECT') AND NOT has_table_privilege('authenticated','private.trust_c2g1_source_evidence_links','SELECT') AND NOT has_table_privilege('authenticated','private.trust_c2g1_company_evidence_summary','SELECT') AND has_table_privilege('service_role','private.trust_c2g1_source_evidence_links','SELECT'),'internal-only access');
SELECT (SELECT count(*) FROM private.trust_c2g1_source_evidence_links) AS evidence_links,(SELECT count(*) FROM private.trust_c2g1_company_evidence_summary WHERE publication_status='published') AS published_companies,(SELECT count(*) FROM private.trust_c2g1_company_evidence_summary WHERE reuse_rights_cleared) AS auto_cleared;
ROLLBACK;
