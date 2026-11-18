-- NET-IT-OVERTURE4-RECOVERY1: one-time, bounded first-party recovery of the
-- 78 Overture4 candidates discarded only because the first pass did not find
-- their legal identity. Do not change a human decision or a rights restriction.
-- A new, independently evidenced AUTO2 verdict is required before lifting
-- the specific 'no_company_on_site' discard. Never publish from these RPCs.

CREATE TABLE IF NOT EXISTS private.net_it_overture4_recovery_attempts (
  candidate_id uuid PRIMARY KEY
    REFERENCES public.network_company_discovery_candidates(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
REVOKE ALL ON TABLE private.net_it_overture4_recovery_attempts
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_it_auto2_recovery_queue(
  p_max integer DEFAULT 12
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_items jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 12 THEN
   RAISE EXCEPTION 'Service role and bounded recovery batch required'
     USING ERRCODE='42501';
 END IF;

 WITH eligible AS MATERIALIZED (
   SELECT c.id,c.canonical_domain,c.source_url,c.website_url,c.legal_name,
          c.vat_id,c.run_id,c.quality_flags,c.role_keys,c.created_at
   FROM public.network_company_discovery_candidates c
   JOIN public.network_company_discovery_runs r ON r.id=c.run_id
   JOIN private.net_it_seed1_domains seed ON
        seed.domain=c.canonical_domain
        AND seed.source_id='bfd5c35f-54e0-4835-8283-ea447c9bdd9b'::uuid
   JOIN private.net_it_auto2_discards d ON d.candidate_id=c.id
        AND d.reason='no_company_on_site'
   JOIN LATERAL (
      SELECT e.* FROM private.net_it_auto2_evidence e
      WHERE e.candidate_id=c.id
      ORDER BY e.reviewed_at DESC,e.id DESC LIMIT 1
   ) ev ON true
   WHERE c.country_code='IT'
     AND c.review_status='pending_review'
     AND c.governance_status='unreviewed'
     AND r.governance_status='unreviewed'
     AND r.terms_status IN ('not_checked','unknown')
     AND r.database_rights_status IN ('not_assessed','unknown')
     AND c.source_url ~* '^https://'
     AND c.website_url ~* '^https://'
     AND c.canonical_domain<>''
     AND lower(split_part(split_part(c.source_url,'/',3),':',1))
         IN (lower(c.canonical_domain),'www.'||lower(c.canonical_domain))
     AND lower(split_part(split_part(c.website_url,'/',3),':',1))
         IN (lower(c.canonical_domain),'www.'||lower(c.canonical_domain))
     AND NOT coalesce(c.personal_data_detected,false)
     AND cardinality(c.personal_data_fields)=0
     AND cardinality(c.role_keys)>0
     AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
     AND c.match_signals='[]'::jsonb
     -- Fixed, previously measured 78-case campaign. A new observation
     -- after the cutoff prevents another attempt or an infinite loop.
     AND ev.reviewer_version='net-it-auto2-firstparty-v4'
     AND ev.verdict='needs_human'
     AND 'no_company_name_on_site'=ANY(ev.reason_codes)
     AND ev.reviewed_at<='2026-11-18 11:54:58.10777+00'::timestamptz
     AND ev.page_evidence_hash ~ '^[a-f0-9]{64}$'
     AND ev.source_rights_state='unknown'
     AND NOT EXISTS(
       SELECT 1 FROM private.net_it_overture4_recovery_attempts t
       WHERE t.candidate_id=c.id
     )
     AND NOT EXISTS(
       SELECT 1 FROM private.net_it_auto2_evidence e
       WHERE e.candidate_id=c.id AND e.verdict='blocked'
     )
     AND NOT EXISTS(
       SELECT 1 FROM public.network_companies n
       WHERE lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
         OR (c.vat_id IS NOT NULL AND n.vat_id=c.vat_id)
         OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name)))
     )
     AND NOT EXISTS(
       SELECT 1 FROM public.network_netfast3_suppressed_domains s
       WHERE s.domain=lower(btrim(c.canonical_domain))
     )
   ORDER BY CASE WHEN private.net_it_legal_name_quality_ok(c.legal_name)
                 THEN 0 ELSE 1 END,c.created_at,c.id
   LIMIT p_max FOR UPDATE OF c SKIP LOCKED
 ), claimed AS (
   INSERT INTO private.net_it_overture4_recovery_attempts(candidate_id)
   SELECT id FROM eligible
   ON CONFLICT (candidate_id) DO NOTHING
   RETURNING candidate_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'domain',e.canonical_domain,'url',e.source_url,
   'website_url',e.website_url,'company_name',e.legal_name,
   'vat',e.vat_id,'source_run_id',e.run_id,
   'quality_flags',to_jsonb(e.quality_flags),'role_keys',to_jsonb(e.role_keys)
 ) ORDER BY e.created_at,e.id),'[]'::jsonb)
 INTO v_items
 FROM eligible e JOIN claimed cl ON cl.candidate_id=e.id;

 RETURN jsonb_build_object(
  'contract','net-it-auto2-recovery-queue-v1','items',v_items,
  'count',jsonb_array_length(v_items),'publication_authorized',false,
  'cohort','overture4-firstparty-20261118');
END
$function$;

CREATE OR REPLACE FUNCTION public.net_it_auto2_recovery_queue(
  p_max integer DEFAULT 12
) RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $function$
 SELECT private.net_it_auto2_recovery_queue(p_max);
$function$;
REVOKE ALL ON FUNCTION public.net_it_auto2_recovery_queue(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_recovery_queue(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto2_recovery_restore(
  p_candidate_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_c public.network_company_discovery_candidates%rowtype;
 v_e private.net_it_auto2_evidence%rowtype;
 v_claim private.net_it_overture4_recovery_attempts%rowtype;
 v_reason text;
 v_n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_candidate_id IS NULL THEN
  RAISE EXCEPTION 'Service recovery role required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_claim FROM private.net_it_overture4_recovery_attempts
  WHERE candidate_id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR v_claim.restored_at IS NOT NULL THEN
  RETURN jsonb_build_object('contract','net-it-auto2-recovery-restore-v1',
    'restored',0,'published',0,'status','no_active_attempt');
 END IF;
 SELECT * INTO v_c FROM public.network_company_discovery_candidates
  WHERE id=p_candidate_id FOR UPDATE;
 SELECT d.reason INTO v_reason FROM private.net_it_auto2_discards d
  WHERE d.candidate_id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_e FROM private.net_it_auto2_evidence e
  WHERE e.candidate_id=p_candidate_id
  ORDER BY e.reviewed_at DESC,e.id DESC LIMIT 1;

 IF v_c.id IS NULL OR v_c.country_code<>'IT'
    OR v_c.review_status<>'pending_review'
    OR v_c.governance_status<>'unreviewed'
    OR v_reason IS DISTINCT FROM 'no_company_on_site'
    OR v_e.id IS NULL
    OR v_e.reviewed_at<v_claim.claimed_at
    OR v_e.reviewer_version<>'net-it-auto2-firstparty-v4'
    OR v_e.verdict<>'identity_supported'
    OR cardinality(v_e.reason_codes)>0
    OR NOT coalesce(v_e.matched_company_name,false)
    OR v_e.identity_confidence<0.94
    OR v_e.source_rights_state<>'unknown'
    OR v_e.page_evidence_hash !~ '^[a-f0-9]{64}$'
    OR lower(coalesce(v_e.observed_domain,''))<>lower(btrim(v_c.canonical_domain))
    OR lower(split_part(split_part(coalesce(v_e.company_page_url,''),'/',3),':',1))
      NOT IN (lower(btrim(v_c.canonical_domain)),
               'www.'||lower(btrim(v_c.canonical_domain)))
    OR NOT private.net_it_legal_name_quality_ok(v_c.legal_name)
    OR lower(v_c.legal_name) LIKE '% di %'
    OR NOT v_c.legal_name ~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
    OR v_c.quality_flags && ARRAY['historical_sole_trader_vat_context']::text[]
    OR NOT coalesce(v_c.quality_flags,'{}'::text[]) <@
       ARRAY['product_scope_not_verified','province_area_to_verify',
             'classification_multi_role','classification_low_margin',
             'legal_identity_not_verified','identity_no_legal_suffix',
             'identity_domain_mismatch','identity_domain_fallback']::text[]
    OR coalesce(v_c.personal_data_detected,false)
    OR cardinality(v_c.personal_data_fields)>0
    OR v_c.match_company_id IS NOT NULL OR v_c.promoted_company_id IS NOT NULL
    OR v_c.match_signals<>'[]'::jsonb
    OR NOT EXISTS (
      SELECT 1 FROM private.net_it_seed1_domains s
      WHERE s.source_id='bfd5c35f-54e0-4835-8283-ea447c9bdd9b'::uuid
      AND s.domain=v_c.canonical_domain
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.network_company_discovery_runs r
      WHERE r.id=v_c.run_id AND r.governance_status='unreviewed'
      AND r.terms_status IN ('not_checked','unknown')
      AND r.database_rights_status IN ('not_assessed','unknown')
    )
    OR EXISTS (
      SELECT 1 FROM private.net_it_auto2_evidence old
      WHERE old.candidate_id=v_c.id AND old.verdict='blocked'
    )
    OR EXISTS (
      SELECT 1 FROM public.network_companies n
      WHERE lower(btrim(n.website_domain))=lower(btrim(v_c.canonical_domain))
        OR (v_c.vat_id IS NOT NULL AND n.vat_id=v_c.vat_id)
        OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(v_c.legal_name)))
    )
    OR EXISTS(
      SELECT 1 FROM public.network_netfast3_suppressed_domains s
      WHERE s.domain=lower(btrim(v_c.canonical_domain))
    ) THEN
    RETURN jsonb_build_object('contract','net-it-auto2-recovery-restore-v1',
      'restored',0,'published',0,'status','evidence_or_policy_hold');
 END IF;
 DELETE FROM private.net_it_auto2_discards
 WHERE candidate_id=p_candidate_id AND reason='no_company_on_site';
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>1 THEN
  RAISE EXCEPTION 'Concurrent discard change: no restoration'
    USING ERRCODE='40001';
 END IF;
 UPDATE private.net_it_overture4_recovery_attempts SET restored_at=now()
 WHERE candidate_id=p_candidate_id AND restored_at IS NULL;
 RETURN jsonb_build_object('contract','net-it-auto2-recovery-restore-v1',
   'restored',1,'published',0,'status','evidence_only_discard_lifted',
   'candidate_id',p_candidate_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.net_it_auto2_recovery_restore(
  p_candidate_id uuid
) RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $function$
 SELECT private.net_it_auto2_recovery_restore(p_candidate_id);
$function$;
REVOKE ALL ON FUNCTION public.net_it_auto2_recovery_restore(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_recovery_restore(uuid)
  TO service_role;

COMMENT ON FUNCTION private.net_it_auto2_recovery_queue(integer) IS
 'Once-only 78-domain Overture4 first-party reinspection, atomic bounded claims, no approval or publication';
COMMENT ON FUNCTION private.net_it_auto2_recovery_restore(uuid) IS
 'Lift ONLY no_company_on_site automatic discard after new first-party AUTO2 corporate proof; never publish';
