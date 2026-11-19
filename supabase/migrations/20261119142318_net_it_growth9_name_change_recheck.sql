-- NET-IT-GROWTH9: one-time repair must always be re-reviewed.
-- Leaves AUTO2 evidence immutable. No publication, approval, or loosened guard.
CREATE OR REPLACE FUNCTION private.net_it_auto2_queue(p_max integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_rows jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR
     p_max NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Server research identity and bounded batch required'
       USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'domain',canonical_domain,'url',source_url,
   'website_url',website_url,'company_name',legal_name,
   'vat',vat_id,'source_run_id',run_id,'quality_flags',to_jsonb(quality_flags),
   'role_keys',to_jsonb(role_keys)
  ) ORDER BY priority,created_at,id),'[]'::jsonb)
  INTO v_rows
  FROM (
   SELECT c.id,c.canonical_domain,c.source_url,c.website_url,c.legal_name,
          c.vat_id,c.run_id,c.quality_flags,c.role_keys,c.created_at,
          CASE
              -- Prioritize eligible supported but bad-name identities for
              -- first-party re-review; prefer Piemonte pilot before others.
              WHEN NOT private.net_it_legal_name_quality_ok(c.legal_name)
               AND EXISTS (
                 SELECT 1 FROM private.net_it_auto2_evidence proof
                 WHERE proof.candidate_id=c.id
                   AND proof.reviewer_version='net-it-auto2-firstparty-v4'
                   AND proof.verdict='identity_supported'
               )
               AND EXISTS (
                 SELECT 1 FROM private.network_web_research_seeds seed
                 WHERE seed.batch_key LIKE 'NET-IT-PIEMONTE-%'
                   AND lower(seed.canonical_domain)=lower(c.canonical_domain)
               ) THEN -2
              WHEN NOT private.net_it_legal_name_quality_ok(c.legal_name)
               AND EXISTS (
                 SELECT 1 FROM private.net_it_auto2_evidence proof
                 WHERE proof.candidate_id=c.id
                   AND proof.reviewer_version='net-it-auto2-firstparty-v4'
                   AND proof.verdict='identity_supported'
               ) THEN -1
              WHEN cardinality(c.quality_flags)=0 THEN 0
               WHEN NOT(c.quality_flags && ARRAY['legal_identity_not_verified','historical_sole_trader_vat_context']::text[]) THEN 1 ELSE 2 END priority
   FROM public.network_company_discovery_candidates c
   JOIN public.network_company_discovery_runs r ON r.id=c.run_id
   WHERE c.country_code='IT'
     AND c.review_status='pending_review'
     AND c.governance_status='unreviewed'
     -- NET-IT-GROWTH3: also research candidates whose SOURCE the founder already
     -- approved (reuse allowed, low database-rights risk, no personal data);
     -- the candidate itself stays unreviewed and needs AUTO2 evidence.
     AND (r.governance_status='unreviewed'
       OR (r.governance_status='approved' AND r.governance_reviewed_by IS NOT NULL
           AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
           AND r.database_rights_status IN ('low_risk','licensed')
           AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
           AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL))
     -- NET-IT-AUTO4: automatically discarded candidates leave the queue.
     AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id)
     AND NOT coalesce(c.personal_data_detected,false)
     AND cardinality(c.personal_data_fields)=0
     AND c.canonical_domain<>'' AND c.source_url ~* '^https?://'
     AND NOT EXISTS (
       SELECT 1 FROM private.net_it_auto2_evidence e
       WHERE e.candidate_id=c.id
         -- NET-IT-AUTO4: pre-v4 identity exceptions do not hold the candidate
         -- back (v4 reads the ragione sociale on the site), nor does pre-v4
         -- support of a candidate whose crawler identity flags only v4 clears.
         AND NOT (e.reviewer_version<>'net-it-auto2-firstparty-v4'
                  AND (e.reason_codes && ARRAY['legal_form_requires_human_review',
                         'corporate_name_not_evidenced']::text[]
                       OR (e.verdict='identity_supported'
                           AND c.quality_flags && ARRAY['identity_no_legal_suffix',
                             'identity_domain_mismatch','identity_domain_fallback']::text[])))
         -- AUTO3 accepts evidence for 3 days only: refresh supported
         -- identities after 2 days so they never fall into a dead window;
         -- exceptions are retried weekly.
         -- NET-IT-AUTO4: unreachable sites are retried every 2 days and
         -- discarded by the sweep after 3 attempts.
         AND e.reviewed_at>now()-CASE -- No artificial approval: bad names can be rechecked by AUTO2
               -- sooner than valid names, at most every 12 hours.
               WHEN e.verdict='identity_supported'
                 AND NOT private.net_it_legal_name_quality_ok(c.legal_name)
               THEN interval '1 hour'
               -- GROWTH9: an independently corrected legal name must get
               -- a fresh first-party AUTO2 observation; the old supported
               -- observation was for a different displayed company name.
               -- Bounded 10-minute cooldown and existing rights/robots gates
               -- still apply; no change to the evidence ledger or AUTO3.
               WHEN e.verdict='identity_supported'
                 AND private.net_it_legal_name_quality_ok(c.legal_name)
                 AND lower(btrim(e.observed_business_name)) IS DISTINCT FROM
                     lower(btrim(c.legal_name))
               THEN interval '10 minutes'
               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               WHEN e.reason_codes && ARRAY['robots_blocked_or_unavailable',
                 'fetch_rejected_or_unavailable']::text[] THEN interval '2 days'
               ELSE interval '7 days' END)
   ORDER BY priority,c.created_at,c.id LIMIT p_max
  ) eligible;
  RETURN jsonb_build_object('contract','net-it-auto2-queue-v1',
   'items',v_rows,'count',jsonb_array_length(v_rows),
   'publication_authorized',false);
END
$function$;

-- GROWTH9 publisher proof-binding fix under lock (no bypass of any guard).
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
    -- GROWTH9: latest evidence must support CURRENT name, not old CMS guess.
    AND lower(btrim(e.observed_business_name))=lower(btrim(c.legal_name))
    AND e.source_rights_state='unknown'
    AND e.page_evidence_hash ~ '^[a-f0-9]{64}
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 IF src IS NULL
    OR position('e.observed_business_name' in src)=0
    OR position('interval ''10 minutes''' in src)=0
    OR position('interval ''2 days''' in src)=0
    OR position('net_it_auto2_discards' in src)=0
    OR position('robots_blocked_or_unavailable' in src)=0
 THEN RAISE EXCEPTION 'GROWTH9 AUTO2 queue invariants not met'; END IF;
END;
$growth9_assert$;

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
    AND lower(c.legal_name) NOT LIKE '% di %'
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
     OR lower(v_candidate.legal_name) LIKE '% di %'
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
     OR lower(btrim(v_evidence.observed_business_name)) IS DISTINCT FROM
        lower(btrim(v_candidate.legal_name))
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

DO $growth9_assert$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 IF src IS NULL
    OR position('e.observed_business_name' in src)=0
    OR position('interval ''10 minutes''' in src)=0
    OR position('interval ''2 days''' in src)=0
    OR position('net_it_auto2_discards' in src)=0
    OR position('robots_blocked_or_unavailable' in src)=0
 THEN RAISE EXCEPTION 'GROWTH9 AUTO2 queue invariants not met'; END IF;
END;
$growth9_assert$;

DO $growth9_auto3_assert$
DECLARE v_def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto3_release';
 IF v_def IS NULL
   OR position('lower(btrim(e.observed_business_name))=lower(btrim(c.legal_name))' in v_def)=0
   OR position('lower(btrim(v_evidence.observed_business_name)) IS DISTINCT FROM' in v_def)=0
   OR position('net_it_auto2_discards' in v_def)=0
   OR position('pg_advisory_xact_lock' in v_def)=0
 THEN RAISE EXCEPTION 'GROWTH9 requires exact-name proof in both AUTO3 gates'; END IF;
END;
$growth9_auto3_assert$;
