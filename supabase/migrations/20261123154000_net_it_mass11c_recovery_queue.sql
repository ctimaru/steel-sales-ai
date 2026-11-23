-- MASS11C: one-time discovery of first-party legal identities.
-- No publishing or approval occurs in this migration.
CREATE TABLE IF NOT EXISTS private.net_it_mass11c_recovery_attempts (
 candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 recovered_at timestamptz,
 result text
);
REVOKE ALL ON private.net_it_mass11c_recovery_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_it_mass11c_recovery_queue(
 p_max integer DEFAULT 12
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_items jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 12 THEN
   RAISE EXCEPTION 'Service role and bounded batch required' USING ERRCODE='42501';
 END IF;
 WITH eligible AS MATERIALIZED (
 SELECT c.id,c.canonical_domain,c.source_url,c.website_url,c.legal_name,
        c.vat_id,c.run_id,c.quality_flags,c.role_keys,c.created_at
 FROM public.network_company_discovery_candidates c
 JOIN public.network_company_discovery_runs r ON r.id=c.run_id
 JOIN private.net_it_seed1_domains s ON s.domain=c.canonical_domain
     AND s.source_id='063b7e32-c5e4-4dca-9a6b-f8cd8fab5a88'::uuid
     AND s.status='candidate'
 JOIN private.net_it_overture_provenance p
     ON p.source_id=s.source_id AND p.domain=s.domain
 LEFT JOIN private.net_it_auto2_discards d ON d.candidate_id=c.id
 JOIN LATERAL (
    SELECT e.* FROM private.net_it_auto2_evidence e
    WHERE e.candidate_id=c.id ORDER BY e.reviewed_at DESC,e.id DESC LIMIT 1
 ) e ON true
 WHERE c.country_code='IT' AND c.review_status='pending_review'
   AND c.governance_status='unreviewed' AND r.governance_status='unreviewed'
   AND r.terms_status IN ('not_checked','unknown')
   AND r.database_rights_status IN ('not_assessed','unknown')
   AND ((d.reason='no_company_on_site'
      AND e.verdict='needs_human'
      AND 'no_company_name_on_site'=ANY(e.reason_codes))
     OR (d.candidate_id IS NULL
      AND 'identity_name_noise'=ANY(c.quality_flags)
      AND e.verdict='identity_supported'))
   AND e.reviewer_version='net-it-auto2-firstparty-v4'
   AND e.reviewed_at<='2026-11-23 14:00:00+00'::timestamptz
   AND e.source_rights_state='unknown'
   AND e.page_evidence_hash ~ '^[a-f0-9]{64}$'
   AND c.source_url ~* '^https://' AND c.website_url ~* '^https://'
   AND lower(split_part(c.source_url,'/',3))
      IN (c.canonical_domain,'www.'||c.canonical_domain)
   AND lower(split_part(c.website_url,'/',3))
      IN (c.canonical_domain,'www.'||c.canonical_domain)
   AND cardinality(c.role_keys)>0
   AND NOT coalesce(c.personal_data_detected,false)
   AND cardinality(c.personal_data_fields)=0
   AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
   AND c.match_signals='[]'::jsonb
   AND NOT ('historical_sole_trader_vat_context'=ANY(c.quality_flags))
   AND NOT EXISTS(SELECT 1 FROM private.net_it_mass11c_recovery_attempts a
                  WHERE a.candidate_id=c.id)
   AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_evidence blocked
       WHERE blocked.candidate_id=c.id AND blocked.verdict='blocked')
   AND NOT EXISTS(SELECT 1 FROM public.network_companies n
       WHERE lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
       OR (c.vat_id IS NOT NULL AND n.vat_id=c.vat_id)
       OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name))))
   AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains sup
       WHERE sup.domain=lower(btrim(c.canonical_domain)))
 ORDER BY c.created_at,c.id LIMIT p_max FOR UPDATE OF c SKIP LOCKED
 ), claims AS (
   INSERT INTO private.net_it_mass11c_recovery_attempts(candidate_id)
   SELECT id FROM eligible ON CONFLICT(candidate_id) DO NOTHING RETURNING candidate_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'domain',e.canonical_domain,'url',e.source_url,
   'website_url',e.website_url,'company_name',e.legal_name,
   'vat',e.vat_id,'source_run_id',e.run_id,
   'quality_flags',to_jsonb(e.quality_flags),'role_keys',to_jsonb(e.role_keys)
 ) ORDER BY e.created_at,e.id),'[]'::jsonb) INTO v_items
 FROM eligible e JOIN claims cl ON cl.candidate_id=e.id;
 RETURN jsonb_build_object('contract','net-it-mass11c-recovery-queue-v1',
     'count',jsonb_array_length(v_items),'items',v_items,'publication_authorized',false);
END
$func$;
CREATE OR REPLACE FUNCTION public.net_it_mass11c_recovery_queue(
 p_max integer DEFAULT 12
) RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $func$ SELECT private.net_it_mass11c_recovery_queue(p_max); $func$;
REVOKE ALL ON FUNCTION public.net_it_mass11c_recovery_queue(integer)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_mass11c_recovery_queue(integer) TO service_role;
REVOKE ALL ON FUNCTION private.net_it_mass11c_recovery_queue(integer)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_mass11c_recovery_queue(integer)
 TO service_role;
