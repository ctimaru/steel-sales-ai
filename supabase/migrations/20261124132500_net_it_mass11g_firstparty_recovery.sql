-- NET-IT-MASS11G-RECOVERY: bounded 22-case source-licensed official-site recheck.
-- Original AUTO2 decisions and all publication rules remain untouched.
-- Crawler source 36140... can only be reviewed again with fresh first-party proof.
CREATE TABLE IF NOT EXISTS private.net_it_mass11g_recovery_attempts (
 candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 retry_claimed_at timestamptz,
 completed_at timestamptz,
 recovered_at timestamptz,
 result text
);
REVOKE ALL ON private.net_it_mass11g_recovery_attempts FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE private.net_it_mass11g_recovery_attempts IS
 'MASS11G 22-company deep first-party retry ledger. One fresh attempt and at most one stale-claim retry, never publication.';

CREATE OR REPLACE FUNCTION private.net_it_mass11g_recovery_queue(
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
     AND s.source_id='36140f37-f3bd-40ba-ae9d-c84e79c9205a'::uuid
     AND s.status='candidate'
 JOIN private.net_it_overture_provenance p
     ON p.source_id=s.source_id AND p.domain=s.domain
 LEFT JOIN private.net_it_auto2_discards d ON d.candidate_id=c.id
 LEFT JOIN private.net_it_mass11g_recovery_attempts a ON a.candidate_id=c.id
 JOIN LATERAL (
    SELECT e.* FROM private.net_it_auto2_evidence e
    WHERE e.candidate_id=c.id ORDER BY e.reviewed_at DESC,e.id DESC LIMIT 1
 ) e ON true
 WHERE c.country_code='IT' AND c.review_status='pending_review'
   AND c.governance_status='unreviewed' AND r.governance_status='unreviewed'
   AND r.terms_status IN ('not_checked','unknown')
   AND r.database_rights_status IN ('not_assessed','unknown')
   -- Only the 22 real source-bound non-published discarded identity holds.
   -- Two invalid http URLs and the unrelated blank-reason case are excluded.
   AND d.reason='no_company_on_site'
   AND e.verdict='needs_human'
   AND 'no_company_name_on_site'=ANY(e.reason_codes)
   AND e.reviewer_version='net-it-auto2-firstparty-v4'
   AND (
      (a.candidate_id IS NULL
       AND e.reviewed_at <= '2026-11-24 12:16:00+00'::timestamptz)
      OR
      (a.candidate_id IS NOT NULL AND a.completed_at IS NULL
       AND a.retry_claimed_at IS NULL
       AND a.claimed_at < now() - interval '12 minutes')
   )
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
   AND (a.candidate_id IS NULL OR (
      a.completed_at IS NULL AND a.retry_claimed_at IS NULL
      AND a.claimed_at < now() - interval '12 minutes'
   ))
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
   INSERT INTO private.net_it_mass11g_recovery_attempts(candidate_id)
   SELECT id FROM eligible
   ON CONFLICT(candidate_id) DO UPDATE
   SET retry_claimed_at=now()
   WHERE private.net_it_mass11g_recovery_attempts.completed_at IS NULL
     AND private.net_it_mass11g_recovery_attempts.retry_claimed_at IS NULL
     AND private.net_it_mass11g_recovery_attempts.claimed_at
         < now() - interval '12 minutes'
   RETURNING candidate_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'domain',e.canonical_domain,'url',e.source_url,
   'website_url',e.website_url,'company_name',e.legal_name,
   'vat',e.vat_id,'source_run_id',e.run_id,
   'quality_flags',to_jsonb(e.quality_flags),'role_keys',to_jsonb(e.role_keys)
 ) ORDER BY e.created_at,e.id),'[]'::jsonb) INTO v_items
 FROM eligible e JOIN claims cl ON cl.candidate_id=e.id;
 RETURN jsonb_build_object('contract','net-it-mass11g-recovery-queue-v1',
     'count',jsonb_array_length(v_items),'items',v_items,'publication_authorized',false);
END
$func$;



CREATE OR REPLACE FUNCTION private.net_it_mass11g_recovery_finalize(
 p_candidate_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
 a private.net_it_mass11g_recovery_attempts%rowtype;
 c public.network_company_discovery_candidates%rowtype;
 e private.net_it_auto2_evidence%rowtype;
 discard_reason text;
 correction jsonb;
 noisy boolean;
 clean_flags text[];
 safe boolean;
 outcome text;
 changed integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_candidate_id IS NULL THEN
   RAISE EXCEPTION 'Service recovery role required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM private.net_it_mass11g_recovery_attempts
 WHERE candidate_id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR a.completed_at IS NOT NULL THEN
   RETURN jsonb_build_object('contract','net-it-mass11g-recovery-finalize-v1',
       'status','no_active_attempt','recovered',0,'published',0);
 END IF;
 SELECT * INTO c FROM public.network_company_discovery_candidates
 WHERE id=p_candidate_id FOR UPDATE;
 SELECT d.reason INTO discard_reason FROM private.net_it_auto2_discards d
 WHERE d.candidate_id=p_candidate_id FOR UPDATE;
 SELECT * INTO e FROM private.net_it_auto2_evidence obs
 WHERE obs.candidate_id=p_candidate_id
 ORDER BY obs.reviewed_at DESC,obs.id DESC LIMIT 1;

 noisy := 'identity_name_noise'=ANY(coalesce(c.quality_flags,'{}'::text[]));
 clean_flags := array_remove(coalesce(c.quality_flags,'{}'::text[]),'identity_name_noise');
 correction := coalesce(c.enrichment_quality,'{}'::jsonb)
                   ->'net_it_auto4_identity_correction';

 safe := c.id IS NOT NULL AND c.country_code='IT'
   AND c.review_status='pending_review' AND c.governance_status='unreviewed'
   AND (discard_reason='no_company_on_site'
        OR (discard_reason IS NULL AND noisy))
   AND e.id IS NOT NULL AND e.reviewed_at>=coalesce(a.retry_claimed_at,a.claimed_at)
   AND e.reviewer_version='net-it-auto2-firstparty-v4'
   AND e.verdict='identity_supported' AND cardinality(e.reason_codes)=0
   AND coalesce(e.matched_company_name,false)
   AND e.identity_confidence>=0.94
   AND e.source_rights_state='unknown'
   AND e.page_evidence_hash ~ '^[a-f0-9]{64}$'
   AND lower(btrim(coalesce(e.observed_domain,'')))=lower(btrim(c.canonical_domain))
   AND lower(btrim(coalesce(e.observed_business_name,'')))=lower(btrim(c.legal_name))
   AND lower(split_part(coalesce(e.company_page_url,''),'/',3))
        IN (lower(btrim(c.canonical_domain)),'www.'||lower(btrim(c.canonical_domain)))
   AND private.net_it_legal_name_quality_ok(c.legal_name)
   AND lower(c.legal_name) NOT LIKE '% di %'
   AND c.legal_name ~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
   AND NOT coalesce(c.personal_data_detected,false)
   AND cardinality(c.personal_data_fields)=0
   AND cardinality(c.role_keys)>0
   AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
   AND c.match_signals='[]'::jsonb
   AND clean_flags <@ ARRAY['product_scope_not_verified','province_area_to_verify',
      'classification_multi_role','classification_low_margin',
      'legal_identity_not_verified','identity_no_legal_suffix',
      'identity_domain_mismatch','identity_domain_fallback']::text[]
   AND EXISTS(SELECT 1 FROM private.net_it_seed1_domains seed
       JOIN private.net_it_overture_provenance prov
         ON prov.source_id=seed.source_id AND prov.domain=seed.domain
       WHERE seed.source_id='36140f37-f3bd-40ba-ae9d-c84e79c9205a'::uuid
       AND seed.domain=c.canonical_domain AND seed.status='candidate')
   AND EXISTS(SELECT 1 FROM public.network_company_discovery_runs run
       WHERE run.id=c.run_id AND run.governance_status='unreviewed'
       AND run.terms_status IN ('not_checked','unknown')
       AND run.database_rights_status IN ('not_assessed','unknown'))
   AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_evidence blocked
       WHERE blocked.candidate_id=c.id AND blocked.verdict='blocked')
   AND NOT EXISTS(SELECT 1 FROM public.network_companies n
       WHERE lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
       OR (c.vat_id IS NOT NULL AND n.vat_id=c.vat_id)
       OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name))))
   AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains sup
       WHERE sup.domain=lower(btrim(c.canonical_domain)));

 -- A noisy label is only cleared after the existing official-site correction
 -- RPC changed THIS candidate during THIS claim. Never trim a name by fiat.
 IF coalesce(safe,false) AND noisy THEN
   safe := jsonb_typeof(correction)='object'
      AND correction->>'reviewer_version'='net-it-auto2-firstparty-v4'
      AND lower(btrim(coalesce(correction->>'legal_name','')))=lower(btrim(c.legal_name))
      AND lower(btrim(coalesce(correction->>'previous_legal_name','')))
            IS DISTINCT FROM lower(btrim(c.legal_name))
      AND coalesce(correction->>'at','') ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}[T ]'
      AND (correction->>'at')::timestamptz>=coalesce(a.retry_claimed_at,a.claimed_at)
      AND lower(split_part(coalesce(correction->>'page_url',''),'/',3))
          IN (lower(btrim(c.canonical_domain)),'www.'||lower(btrim(c.canonical_domain)));
 END IF;
 IF NOT coalesce(safe,false) THEN
   outcome := CASE WHEN e.id IS NULL OR e.reviewed_at<coalesce(a.retry_claimed_at,a.claimed_at)
      THEN 'no_new_evidence' ELSE 'evidence_or_policy_hold' END;
   UPDATE private.net_it_mass11g_recovery_attempts
   SET completed_at=now(),result=outcome
   WHERE candidate_id=p_candidate_id AND completed_at IS NULL;
   RETURN jsonb_build_object('contract','net-it-mass11g-recovery-finalize-v1',
       'status',outcome,'recovered',0,'published',0);
 END IF;

 IF discard_reason='no_company_on_site' THEN
   DELETE FROM private.net_it_auto2_discards
   WHERE candidate_id=p_candidate_id AND reason='no_company_on_site';
   GET DIAGNOSTICS changed=ROW_COUNT;
   IF changed<>1 THEN
     RAISE EXCEPTION 'Concurrent discard modification' USING ERRCODE='40001';
   END IF;
 END IF;
 IF noisy THEN
   UPDATE public.network_company_discovery_candidates
   SET quality_flags=clean_flags WHERE id=p_candidate_id
      AND 'identity_name_noise'=ANY(quality_flags);
   GET DIAGNOSTICS changed=ROW_COUNT;
   IF changed<>1 THEN
     RAISE EXCEPTION 'Concurrent name quality modification' USING ERRCODE='40001';
   END IF;
 END IF;
 outcome := CASE WHEN discard_reason='no_company_on_site'
        THEN 'restored_discard' ELSE 'cleared_name_noise' END;
 UPDATE private.net_it_mass11g_recovery_attempts
 SET completed_at=now(),recovered_at=now(),result=outcome
 WHERE candidate_id=p_candidate_id AND completed_at IS NULL;
 RETURN jsonb_build_object('contract','net-it-mass11g-recovery-finalize-v1',
       'status',outcome,'recovered',1,'published',0);
END
$func$;





CREATE OR REPLACE FUNCTION public.net_it_mass11g_recovery_queue(p_max integer DEFAULT 12)
RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $func$ SELECT private.net_it_mass11g_recovery_queue(p_max); $func$;
CREATE OR REPLACE FUNCTION public.net_it_mass11g_recovery_finalize(p_candidate_id uuid)
RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $func$ SELECT private.net_it_mass11g_recovery_finalize(p_candidate_id); $func$;
REVOKE ALL ON FUNCTION public.net_it_mass11g_recovery_queue(integer)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.net_it_mass11g_recovery_finalize(uuid)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.net_it_mass11g_recovery_queue(integer)
 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.net_it_mass11g_recovery_finalize(uuid)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_mass11g_recovery_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.net_it_mass11g_recovery_finalize(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.net_it_mass11g_recovery_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.net_it_mass11g_recovery_finalize(uuid) TO service_role;

COMMENT ON FUNCTION private.net_it_mass11g_recovery_queue(integer) IS
 'Service-role 22-case cohort; fixed source, old evidence cutoff, first-party URL and rights, no PII or duplicates, at most one stale lease reclaim.';
COMMENT ON FUNCTION private.net_it_mass11g_recovery_finalize(uuid) IS
 'After fresh official-site AUTO2 record, re-check rights, corporate identity, duplicates and optional correction; never publish or approve governance.';
