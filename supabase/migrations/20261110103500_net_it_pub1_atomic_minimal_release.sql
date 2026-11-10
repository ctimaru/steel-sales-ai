-- NET-IT-PUB1: one-shot atomic release of precisely five ALREADY-REVIEWED
-- discovery candidates through the existing NET-PIPELINE1B.2 minimal publisher.
-- DEFINITION ONLY: installs no public profiles and keeps original runtime OFF.
-- No invented legal signoff, no automatic source approval or service-role session.
-- A real Platform user must first review three official-source runs and five
-- candidates, then attest the exact preview fingerprint and publication note.
CREATE TABLE IF NOT EXISTS private.net_it_pub1_batch_ledger (
  wave text PRIMARY KEY,
  committed_by uuid NOT NULL REFERENCES auth.users(id),
  manifest_fingerprint text NOT NULL,
  review_note text NOT NULL,
  company_ids uuid[] NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_pub1_batch_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_pub1_batch_ledger FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_it_pub1_release_impl(
  p_expected_fingerprint text DEFAULT NULL,
  p_attested boolean DEFAULT false,
  p_review_note text DEFAULT NULL,
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $pub1$
DECLARE
  v_actor uuid := auth.uid();
  v_ids uuid[] := ARRAY[
    '3222c3fa-4a44-4b68-bb27-5fb04d52f6fc'::uuid,
    '28defb68-413d-47d7-93e0-3bbb95afa1cf'::uuid,
    '79960391-2660-4843-a0e3-f423130166c5'::uuid,
    '9d306e06-e62d-49f6-8b90-7ea088c741d9'::uuid,
    'd6307036-2999-4c56-a5d6-801130e13bdd'::uuid
  ];
  v_expected integer := 5;
  v_present integer := 0;
  v_eligible integer := 0;
  v_fingerprint text;
  v_result jsonb;
  v_company_ids uuid[] := '{}'::uuid[];
  v_row record;
  v_original_enabled boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Real authenticated Platform operator required'
      USING ERRCODE='42501';
  END IF;
  PERFORM private.require_platform_permission('discovery.governance_review');
  IF coalesce(p_commit,false) THEN
    PERFORM private.require_platform_permission('discovery.publish');
    -- Same lock acquired by the underlying minimal publisher. All five inserts
    -- and the temporary flag change take place in THIS transaction only.
    PERFORM pg_catalog.pg_advisory_xact_lock(810021,20262);
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
    PERFORM c.id FROM public.network_company_discovery_candidates c
      WHERE c.id=ANY(v_ids) ORDER BY c.id FOR UPDATE;
    PERFORM r.id FROM public.network_company_discovery_runs r
      WHERE r.id IN (
        SELECT c.run_id FROM public.network_company_discovery_candidates c
        WHERE c.id=ANY(v_ids)
      ) ORDER BY r.id FOR SHARE;
  END IF;

  -- Exact identity, verified source decision, no personal-data flags and no
  -- collisions even with archived/suppressed profiles. The existing publisher
  -- repeats its independent eligibility checks under the same transaction.
  SELECT count(*),count(*) FILTER (
    WHERE c.country_code='IT'
      AND c.review_status='pending_review'
      AND c.governance_status='approved_company_data'
      AND c.governance_reviewed_by IS NOT NULL
      AND c.governance_reviewed_at IS NOT NULL
      AND r.governance_status='approved'
      AND r.governance_reviewed_by IS NOT NULL
      AND r.governance_reviewed_at IS NOT NULL
      AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
      AND r.database_rights_status IN ('low_risk','licensed')
      AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
      AND NOT c.personal_data_detected
      AND pg_catalog.cardinality(c.personal_data_fields)=0
      AND pg_catalog.cardinality(c.quality_flags)=0
      AND c.match_company_id IS NULL
      AND c.promoted_company_id IS NULL
      AND c.role_keys @> ARRAY['processor_service_provider']::text[]
      AND c.subtype_keys @> ARRAY['fabricator']::text[]
      AND c.enrichment_quality ? 'net_it_pub1_20261110'
      AND c.enrichment_quality ? 'net_it_pub1_official_identity_evidence_20261110'
      AND (private.net_pipeline1b2_eligibility(c.id)->>'eligible')::boolean
      AND NOT EXISTS (
        SELECT 1 FROM public.network_companies existing
        WHERE lower(existing.website_domain)=lower(c.canonical_domain)
          OR (c.vat_id IS NOT NULL AND existing.vat_id=c.vat_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_netfast3_suppressed_domains suppressed
        WHERE suppressed.domain=c.canonical_domain
      )
  ) INTO v_present,v_eligible
  FROM public.network_company_discovery_candidates c
  JOIN public.network_company_discovery_runs r ON r.id=c.run_id
  WHERE c.id=ANY(v_ids);

  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',c.id,'domain',c.canonical_domain,'legal_name',c.legal_name,
      'vat_id',c.vat_id,'candidate_status',c.governance_status,
      'review_status',c.review_status,'candidate_reviewed_by',c.governance_reviewed_by,
      'candidate_updated_at',c.updated_at,
      'source_id',r.id,'source_status',r.governance_status,
      'source_reviewed_by',r.governance_reviewed_by,
      'source_updated_at',r.updated_at,
      'source_terms',r.terms_status,'database_rights',r.database_rights_status,
      'personal_data_policy',r.personal_data_policy,
      'quality_flags',to_jsonb(c.quality_flags),
      'official_source',c.source_url
    ) ORDER BY c.canonical_domain)::text,'[]'),'UTF8'
  )),'hex') INTO v_fingerprint
  FROM public.network_company_discovery_candidates c
  JOIN public.network_company_discovery_runs r ON r.id=c.run_id
  WHERE c.id=ANY(v_ids);

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status',CASE WHEN v_present=v_expected AND v_eligible=v_expected
        THEN 'ready_for_attested_commit' ELSE 'blocked' END,
      'requested',v_expected,'eligible',v_eligible,
      'blocked',v_expected-v_eligible,'published_now',0,
      'manifest_fingerprint',v_fingerprint,
      'requires_authenticated_attestation',true,
      'original_publisher_stays_default_off',true
    );
  END IF;

  IF EXISTS (SELECT 1 FROM private.net_it_pub1_batch_ledger
             WHERE wave='NET-IT-PUB1-FIRST5-20261110') THEN
    RAISE EXCEPTION 'NET-IT-PUB1 wave already committed; read back public profiles'
      USING ERRCODE='22023';
  END IF;
  IF v_present<>v_expected OR v_eligible<>v_expected THEN
    RAISE EXCEPTION 'All five source and candidate reviews required; none published'
      USING ERRCODE='22023';
  END IF;
  IF p_attested IS DISTINCT FROM true
      OR p_expected_fingerprint IS NULL
      OR p_expected_fingerprint<>v_fingerprint
      OR pg_catalog.length(pg_catalog.btrim(coalesce(p_review_note,''))) NOT BETWEEN 80 AND 2000 THEN
    RAISE EXCEPTION 'Attested unchanged preview and a meaningful review note required'
      USING ERRCODE='42501';
  END IF;

  SELECT enabled INTO v_original_enabled
  FROM private.net_pipeline1b2_settings
  WHERE singleton=true FOR UPDATE;
  IF NOT FOUND OR v_original_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Minimal publisher settings changed; reconcile before proceeding'
      USING ERRCODE='42501';
  END IF;

  -- MVCC: the switch to ON remains uncommitted and invisible to other sessions.
  -- No other session can exploit the temporary state; it is restored to OFF
  -- BEFORE this transaction commits, even on successful publication.
  UPDATE private.net_pipeline1b2_settings SET enabled=true WHERE singleton=true;
  FOR v_row IN
    SELECT c.id,c.canonical_domain
    FROM public.network_company_discovery_candidates c
    WHERE c.id=ANY(v_ids)
    ORDER BY c.canonical_domain
  LOOP
    v_result := public.net_pipeline1b2_publish_one(v_row.id);
    IF v_result->>'status'<>'published'
       OR nullif(v_result->>'company_id','') IS NULL THEN
      RAISE EXCEPTION 'Atomic publication failed for %, all inserts rolled back',
        v_row.canonical_domain USING ERRCODE='22023';
    END IF;
    v_company_ids := pg_catalog.array_append(
      v_company_ids,(v_result->>'company_id')::uuid
    );
  END LOOP;
  UPDATE private.net_pipeline1b2_settings SET enabled=false WHERE singleton=true;

  IF pg_catalog.cardinality(v_company_ids)<>5 THEN
    RAISE EXCEPTION 'Five-company atomic release count mismatch'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO private.net_it_pub1_batch_ledger(
    wave,committed_by,manifest_fingerprint,review_note,company_ids
  ) VALUES (
    'NET-IT-PUB1-FIRST5-20261110',
    v_actor,v_fingerprint,pg_catalog.btrim(p_review_note),v_company_ids
  );
  RETURN pg_catalog.jsonb_build_object(
    'status','published','wave','NET-IT-PUB1-FIRST5-20261110',
    'published_count',5,'company_ids',to_jsonb(v_company_ids),
    'verified_companies',0,'claimed_companies',0
  );
END;
$pub1$;

REVOKE ALL ON FUNCTION private.net_it_pub1_release_impl(text,boolean,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_pub1_release_impl(text,boolean,text,boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_pub1_release(
  p_expected_fingerprint text DEFAULT NULL,
  p_attested boolean DEFAULT false,
  p_review_note text DEFAULT NULL,
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $pub1_public$
  SELECT private.net_it_pub1_release_impl(
    p_expected_fingerprint,p_attested,p_review_note,p_commit
  );
$pub1_public$;
REVOKE ALL ON FUNCTION public.net_it_pub1_release(text,boolean,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_pub1_release(text,boolean,text,boolean)
  TO authenticated;
