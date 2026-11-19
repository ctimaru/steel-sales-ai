-- NET-IT-GROWTH7: legal corporate names may include " di ".
-- This requires first-party v4 EXACT official company name evidence, not a byline.
-- AUTO3 rules for evidence hash/host, PII, dedup, rights, role and quota remain.
CREATE OR REPLACE FUNCTION private.net_it_corporate_di_name_supported(
 p_legal_name text,p_observed_business_name text,p_reviewer_version text,
 p_matched_company_name boolean
) RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $guard$
 SELECT coalesce(
  p_reviewer_version='net-it-auto2-firstparty-v4'
  AND p_matched_company_name IS TRUE
  AND lower(btrim(p_legal_name))=lower(btrim(p_observed_business_name))
  AND lower(p_legal_name) LIKE '% di %'
  AND private.net_it_legal_name_quality_ok(p_legal_name)
  AND p_legal_name ~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
 ,false);
$guard$;
REVOKE ALL ON FUNCTION private.net_it_corporate_di_name_supported(text,text,text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.net_it_auto3_release(p_max integer DEFAULT 50, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_policy private.net_it_auto3_policy%rowtype;
 v_daily integer;
 v_limit integer;
 v_item record;
 v_candidate public.network_company_discovery_candidates%rowtype;
 v_evidence private.net_it_auto2_evidence%rowtype;
 v_role uuid;
 v_role_key text;
 v_company uuid;
 v_assertion uuid;
 v_collision boolean;
 v_published integer := 0;
 v_reviewed integer := 0;
 v_results jsonb := '[]'::jsonb;
BEGIN
 IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Maintenance-only agent; no service JWT/browser impersonation'
    USING ERRCODE='42501';
 END IF;
 IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 100 OR p_dry_run IS NULL THEN
  RAISE EXCEPTION 'Only bounded agent runs are accepted' USING ERRCODE='22023';
 END IF;

 -- Shared lock with human publisher and AUTO1 to prevent duplicate releases.
 PERFORM pg_catalog.pg_advisory_xact_lock(810021,20262);
 LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO v_policy FROM private.net_it_auto3_policy
  WHERE singleton=true FOR UPDATE;
 SELECT count(*) INTO v_daily FROM private.net_it_auto3_publications
 WHERE (published_at AT TIME ZONE 'Europe/Rome')::date
    = (now() AT TIME ZONE 'Europe/Rome')::date;

 IF NOT coalesce(v_policy.enabled,false) OR v_policy.expires_at IS NULL
    OR v_policy.expires_at<=now() THEN
  RETURN jsonb_build_object('contract','net-it-auto3-release-v1',
    'status','delegation_disabled','published',0,'daily_published',v_daily);
 END IF;
 v_limit:=LEAST(p_max,100,GREATEST(0,v_policy.daily_cap-v_daily));
 IF v_limit=0 THEN
  RETURN jsonb_build_object('contract','net-it-auto3-release-v1',
   'status','daily_limit_reached','published',0,'daily_published',v_daily);
 END IF;

 FOR v_item IN
  SELECT c.id,e.id AS evidence_id
  FROM public.network_company_discovery_candidates c
  JOIN public.network_company_discovery_runs r ON r.id=c.run_id
  JOIN LATERAL (
    SELECT * FROM private.net_it_auto2_evidence x
    WHERE x.candidate_id=c.id ORDER BY x.reviewed_at DESC,x.id DESC LIMIT 1
  ) e ON true
  WHERE c.country_code='IT' AND c.review_status='pending_review'
    AND c.governance_status='unreviewed'
    -- NET-IT-GROWTH3: unreviewed source with unknown rights (as before) OR a
    -- founder-approved source with reuse allowed and low database-rights risk.
    AND ((r.governance_status='unreviewed'
          AND r.terms_status IN ('not_checked','unknown')
          AND r.database_rights_status IN ('not_assessed','unknown'))
      OR (r.governance_status='approved' AND r.governance_reviewed_by IS NOT NULL
          AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
          AND r.database_rights_status IN ('low_risk','licensed')
          AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')))
    AND c.source_url ~* '^https://'
    AND c.website_url ~* '^https://'
    AND e.verdict='identity_supported'
    AND e.reviewed_at>=now()-interval '3 days'
    AND e.reviewer_version IN ('net-it-auto2-firstparty-v1','net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')
    AND e.observed_domain=lower(btrim(c.canonical_domain))
    AND e.matched_company_name AND e.identity_confidence>=0.94
    AND e.source_rights_state='unknown'
    AND e.page_evidence_hash ~ '^[a-f0-9]{64}$'
    AND lower(split_part(split_part(e.company_page_url,'/',3),':',1))
      IN (lower(btrim(c.canonical_domain)),'www.'||lower(btrim(c.canonical_domain)))
    -- NET-IT-AUTO4: identity flags from the crawler's first guess are resolved by
    -- v4, which found the full ragione sociale on the company's own pages.
    AND (c.quality_flags <@ ARRAY['product_scope_not_verified','province_area_to_verify','classification_multi_role','classification_low_margin','legal_identity_not_verified']::text[]
      OR (e.reviewer_version='net-it-auto2-firstparty-v4'
          AND c.quality_flags <@ ARRAY['product_scope_not_verified','province_area_to_verify','classification_multi_role','classification_low_margin','legal_identity_not_verified','identity_no_legal_suffix','identity_domain_mismatch','identity_domain_fallback']::text[]))
    -- NET-IT-GROWTH1: the legacy identity hold is cleared ONLY by v2 first-party
    -- evidence (full S.r.l./S.p.A. corporate name found in the company's own pages).
    AND (NOT c.quality_flags @> ARRAY['legal_identity_not_verified']::text[]
         -- NET-IT-GROWTH5: v3 performs the same full-name first-party check.
         OR e.reviewer_version IN ('net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4'))
    AND NOT c.personal_data_detected
    AND cardinality(c.personal_data_fields)=0
    AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
    AND c.match_signals='[]'::jsonb
    AND (lower(c.legal_name) NOT LIKE '% di %'
   OR private.net_it_corporate_di_name_supported(
      c.legal_name,e.observed_business_name,e.reviewer_version,e.matched_company_name))
    -- NET-IT-AUTO4-NAME: no navigation, privacy, phone, date or domain text.
    AND private.net_it_legal_name_quality_ok(c.legal_name)
    -- NET-IT-GROWTH5: S.n.c./S.a.s. admitted next to S.r.l./S.r.l.s./S.p.A.
    AND c.legal_name ~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
    AND NOT EXISTS (
      SELECT 1 FROM public.network_companies n
      WHERE lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
         OR (c.vat_id IS NOT NULL AND n.vat_id=c.vat_id)
         OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name)))
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.network_netfast3_suppressed_domains s
      WHERE s.domain=lower(btrim(c.canonical_domain))
    )
    AND NOT EXISTS(
      SELECT 1 FROM private.net_pipeline1b2_publication_ledger l WHERE l.candidate_id=c.id
    )
    -- NET-IT-AUTO4: automatically discarded candidates are never published.
    AND NOT EXISTS(
      SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id
    )
  ORDER BY c.created_at,c.id
  LIMIT v_limit FOR UPDATE OF c SKIP LOCKED
 LOOP
  v_reviewed:=v_reviewed+1;
  SELECT * INTO v_candidate FROM public.network_company_discovery_candidates
  WHERE id=v_item.id;
  SELECT * INTO v_evidence FROM private.net_it_auto2_evidence
  WHERE id=v_item.evidence_id;
  -- Re-evaluate under the same lock. Source company website must be its own
  -- domain and a human hasn't denied rights or blocked the source/candidate.
  SELECT EXISTS(SELECT 1 FROM public.network_companies n
    WHERE lower(btrim(n.website_domain))=lower(btrim(v_candidate.canonical_domain))
       OR (v_candidate.vat_id IS NOT NULL AND n.vat_id=v_candidate.vat_id)
       OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(v_candidate.legal_name))))
  INTO v_collision;
  IF v_collision OR
     lower(split_part(split_part(v_candidate.source_url,'/',3),':',1))
       NOT IN (lower(btrim(v_candidate.canonical_domain)),'www.'||lower(btrim(v_candidate.canonical_domain)))
     OR lower(split_part(split_part(v_candidate.website_url,'/',3),':',1))
       NOT IN (lower(btrim(v_candidate.canonical_domain)),'www.'||lower(btrim(v_candidate.canonical_domain)))
     OR (lower(v_candidate.legal_name) LIKE '% di %'
    AND NOT private.net_it_corporate_di_name_supported(
      v_candidate.legal_name,v_evidence.observed_business_name,
      v_evidence.reviewer_version,v_evidence.matched_company_name))
     OR NOT private.net_it_legal_name_quality_ok(v_candidate.legal_name)
     OR v_candidate.review_status<>'pending_review'
     OR v_candidate.governance_status<>'unreviewed'
     -- NET-IT-GROWTH3: same two source routes as the selection above.
     OR NOT EXISTS(SELECT 1 FROM public.network_company_discovery_runs r
        WHERE r.id=v_candidate.run_id
        AND ((r.governance_status='unreviewed'
              AND r.terms_status IN ('not_checked','unknown')
              AND r.database_rights_status IN ('not_assessed','unknown'))
          OR (r.governance_status='approved' AND r.governance_reviewed_by IS NOT NULL
              AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
              AND r.database_rights_status IN ('low_risk','licensed')
              AND r.personal_data_policy IN ('company_data_only','exclude_personal_data'))))
     OR v_candidate.quality_flags && ARRAY['historical_sole_trader_vat_context']::text[]
     OR (v_candidate.quality_flags @> ARRAY['legal_identity_not_verified']::text[]
         AND v_evidence.reviewer_version NOT IN ('net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4'))
     OR v_evidence.reviewer_version NOT IN ('net-it-auto2-firstparty-v1','net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')
     OR v_candidate.personal_data_detected
     OR cardinality(v_candidate.personal_data_fields)>0
     OR v_evidence.verdict<>'identity_supported'
     OR v_evidence.reviewed_at<now()-interval '3 days'
     OR v_evidence.source_rights_state<>'unknown'
  THEN CONTINUE; END IF;
  SELECT role.id,role.canonical_key INTO v_role,v_role_key
    FROM public.network_company_roles role
    WHERE role.canonical_key=ANY(v_candidate.role_keys)
      AND role.status='active' AND role.searchable=true
    ORDER BY array_position(v_candidate.role_keys,role.canonical_key)
    LIMIT 1;
  IF v_role IS NULL THEN CONTINUE; END IF;
  IF p_dry_run THEN
    v_results:=v_results||jsonb_build_array(
      jsonb_build_object('candidate_id',v_candidate.id,'status','ready_facts_only'));
    CONTINUE;
  END IF;
  -- Publish **only factual minimal fields**; no copied page content or contacts.
  -- No claim of a human approval or intellectual-property license is recorded.
  INSERT INTO public.network_companies(
    legal_name,country_code,website_url,website_domain,
    publication_status,claimed_status,verification_status
  ) VALUES (
    btrim(v_candidate.legal_name),'IT',v_candidate.website_url,
    lower(btrim(v_candidate.canonical_domain)),
    'published','unclaimed','unverified'
  ) RETURNING id INTO v_company;
  INSERT INTO private.net_pipeline1b2_publication_ledger(
    candidate_id,company_id,source_url,source_domain,classification,executed_by
  ) VALUES (
    v_candidate.id,v_company,v_candidate.source_url,
    lower(btrim(v_candidate.canonical_domain)),
    'minimal_unverified',NULL
  );
  INSERT INTO public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  ) VALUES (
    'company',v_company,'industrial_role_observed',
    jsonb_build_object(
      'role_key',v_role_key,'source_url',v_candidate.source_url,
      'origin','delegated_agent','evidence_id',v_evidence.id,
      'policy','first_party_minimal_facts_only_v1',
      'role_confirmed_by_company',false,'company_verified',false,
      'tube_procurement_confirmed',false
    ),
    'public_web',v_candidate.source_url,'platform_curated',NULL,
    0.50,'accepted'
  ) RETURNING id INTO v_assertion;
  INSERT INTO public.network_company_role_assignments(
    company_id,role_id,is_primary,source_assertion_id
  ) VALUES(v_company,v_role,true,v_assertion);
  -- Insert the immutable machine/owner attestation BEFORE the candidate update,
  -- so the PA1.5 publication guard can authenticate this precise exception.
  INSERT INTO private.net_it_auto3_publications(
    candidate_id,company_id,evidence_id,authorized_by
  ) VALUES(v_candidate.id,v_company,v_evidence.id,v_policy.authorized_by);
  UPDATE public.network_company_discovery_candidates
  SET review_status='published',promoted_company_id=v_company,
      publication_actor_type='delegated_agent',
      reviewed_at=now(),reviewed_by=NULL,
      review_note='NET-IT-AUTO3: minimal factual profile published by agent under explicit Platform Owner policy; source rights remain not human-approved; evidence retained.'
  WHERE id=v_candidate.id;
  v_published:=v_published+1;
  v_results:=v_results||jsonb_build_array(
   jsonb_build_object('candidate_id',v_candidate.id,'company_id',v_company));
 END LOOP;

 IF NOT p_dry_run AND v_published>0 THEN
  INSERT INTO private.net_it_auto3_events(
    event_kind,actor_type,actor_user_id,details
  ) VALUES (
    'agent_release','delegated_agent',NULL,
    jsonb_build_object('count',v_published,'published',v_results,
      'authorized_by',v_policy.authorized_by)
  );
 END IF;
 RETURN jsonb_build_object(
  'contract','net-it-auto3-release-v1',
  'status',CASE WHEN p_dry_run THEN 'dry_run' ELSE 'published' END,
  'considered',v_reviewed,'published',v_published,
  'ready',CASE WHEN p_dry_run THEN jsonb_array_length(v_results) ELSE v_published END,
  'daily_published',v_daily+v_published,'results',v_results,
  'original_publisher_default_off',(
    SELECT enabled IS FALSE FROM private.net_pipeline1b2_settings WHERE singleton=true
  )
 );
END
$function$;

DO $test$
BEGIN
 IF NOT private.net_it_corporate_di_name_supported(
  'A.F.A. di De Giorgi f.lli S.r.l.','A.F.A. di De Giorgi f.lli S.r.l.','net-it-auto2-firstparty-v4',true)
 OR NOT private.net_it_corporate_di_name_supported(
  'DEGASPERI LAVORAZIONE METALLI DI PINTARELLI FILIPPO SRLS',
  'DEGASPERI LAVORAZIONE METALLI DI PINTARELLI FILIPPO SRLS','net-it-auto2-firstparty-v4',true) THEN
   RAISE EXCEPTION 'Supported corporate names erroneously rejected';
 END IF;
 IF private.net_it_corporate_di_name_supported(
   'A.F.A. di De Giorgi f.lli S.r.l.','Unrelated S.r.l.','net-it-auto2-firstparty-v4',true)
 OR private.net_it_corporate_di_name_supported(
   'A.F.A. di De Giorgi f.lli S.r.l.','A.F.A. di De Giorgi f.lli S.r.l.','net-it-auto2-firstparty-v3',true)
 OR private.net_it_corporate_di_name_supported(
   'A.F.A. di De Giorgi f.lli S.r.l.','A.F.A. di De Giorgi f.lli S.r.l.','net-it-auto2-firstparty-v4',false)
 OR private.net_it_corporate_di_name_supported(
   'Officina di Mario','Officina di Mario','net-it-auto2-firstparty-v4',true)
 OR private.net_it_corporate_di_name_supported(
   'Contattaci di Bianchi S.r.l.','Contattaci di Bianchi S.r.l.','net-it-auto2-firstparty-v4',true) THEN
   RAISE EXCEPTION 'Unverified/non-corporate or contaminated names erroneously accepted';
 END IF;
END;
$test$;
