-- TRUST-AUDIT1C.2G — private provenance reconciliation, read-only transaction.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.audit_assert(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST-C2G %',msg; END IF; END $$;
SELECT pg_temp.audit_assert((SELECT count(*) FROM private.trust_c2g_source_assessment_queue)=(SELECT count(*) FROM private.netdata1b5_source_assessments),'assessment coverage');
SELECT pg_temp.audit_assert((SELECT count(*) FROM private.trust_c2g_source_hold_queue)=(SELECT count(*) FROM private.netdata1b5_source_holds),'hold coverage');
SELECT pg_temp.audit_assert((SELECT count(*) FROM private.trust_c2g_company_provenance_readiness)=(SELECT count(*) FROM public.network_companies),'company coverage');
SELECT pg_temp.audit_assert(NOT EXISTS(SELECT 1 FROM private.trust_c2g_company_provenance_readiness WHERE reuse_rights_cleared),'no unverified reuse rights');
SELECT pg_temp.audit_assert(NOT has_table_privilege('anon','private.trust_c2g_company_provenance_readiness','SELECT') AND NOT has_table_privilege('authenticated','private.trust_c2g_company_provenance_readiness','SELECT') AND NOT has_table_privilege('authenticated','private.trust_c2g_source_hold_queue','SELECT') AND has_table_privilege('service_role','private.trust_c2g_company_provenance_readiness','SELECT'),'private access only');
SELECT (SELECT count(*) FROM private.trust_c2g_company_provenance_readiness WHERE publication_status='published') published_companies,(SELECT count(*) FROM private.trust_c2g_source_assessment_queue) assessments,(SELECT count(*) FROM private.trust_c2g_source_hold_queue) holds,(SELECT count(*) FROM private.trust_c2g_source_hold_queue WHERE NOT has_assessment) holds_without_assessment;
ROLLBACK;
