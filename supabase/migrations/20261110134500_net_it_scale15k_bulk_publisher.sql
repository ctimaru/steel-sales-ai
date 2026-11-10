-- NET-IT-SCALE15K C2: reusable atomic 1..100 minimal-company publisher.
-- DEFINITION-ONLY: NO company insert, NO source approval, runtime remains OFF.
-- Original publisher: public.net_pipeline1b2_publish_one(uuid).
-- Requires REAL Platform human governance review + fresh, attested manifest.
-- Does not reuse a first-five-only manifest or invent rights, VAT or contacts.

CREATE TABLE IF NOT EXISTS private.net_it_scale15k_publication_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  committed_by uuid NOT NULL REFERENCES auth.users(id),
  review_note text NOT NULL,
  candidate_ids uuid[] NOT NULL,
  company_ids uuid[] NOT NULL,
  company_count integer NOT NULL CHECK(company_count BETWEEN 1 AND 100),
  committed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_scale15k_publication_waves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_scale15k_publication_waves FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.net_it_scale15k_bulk_publish_impl(
  p_candidate_ids uuid[],
  p_expected_fingerprint text DEFAULT NULL,
  p_attested boolean DEFAULT false,
  p_review_note text DEFAULT NULL,
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $scale15k_publish$
DECLARE
  v_actor uuid := auth.uid();
  v_ids uuid[];
  v_requested integer;
  v_found integer;
  v_eligible integer;
  v_fingerprint text;
  v_enabled boolean;
  v_result jsonb;
  v_row record;
  v_role_id uuid;
  v_role_key text;
  v_assertion_id uuid;
  v_company_id uuid;
  v_companies uuid[] := '{}'::uuid[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Real authenticated Platform operator required'
      USING ERRCODE='42501';
  END IF;
  PERFORM private.require_platform_permission('discovery.read');
  PERFORM private.require_platform_permission('discovery.governance_review');
  v_requested := COALESCE(cardinality(p_candidate_ids),0);
  IF v_requested NOT BETWEEN 1 AND 100 OR
     EXISTS (SELECT 1 FROM unnest(p_candidate_ids) AS candidate(id) WHERE id IS NULL) THEN
    RAISE EXCEPTION 'Select between 1 and 100 distinct candidate identifiers'
      USING ERRCODE='22023';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids
  FROM (SELECT DISTINCT id FROM unnest(p_candidate_ids) candidate(id)) dedup;
  IF cardinality(v_ids)<>v_requested THEN
    RAISE EXCEPTION 'Repeated candidate identifiers cannot be published twice'
      USING ERRCODE='22023';
  END IF;

  IF COALESCE(p_commit,false) THEN
    PERFORM private.require_platform_permission('discovery.publish');
    -- Exact same advisory lock as the existing individual candidate publisher.
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

  WITH selected AS (
    SELECT c.id,c.run_id,c.legal_name,c.canonical_domain,c.vat_id,
      c.website_url,c.source_url,c.country_code,c.review_status,
      c.governance_status,c.governance_reviewed_by,c.governance_reviewed_at,
      c.updated_at,c.role_keys,c.subtype_keys,c.quality_flags,
      c.match_company_id,c.promoted_company_id,c.personal_data_detected,
      c.personal_data_fields,r.governance_status AS source_governance,
      r.governance_reviewed_by AS source_reviewer,
      r.governance_reviewed_at AS source_reviewed_at,
      r.updated_at AS source_updated_at,r.terms_status,
      r.database_rights_status,r.personal_data_policy,
      (private.net_pipeline1b2_eligibility(c.id)->>'eligible')::boolean
        AS minimal_eligible
    FROM public.network_company_discovery_candidates c
    JOIN public.network_company_discovery_runs r ON r.id=c.run_id
    WHERE c.id=ANY(v_ids)
  ),
  annotated AS (
    SELECT s.*,
      (
        s.country_code='IT'
        AND s.review_status='pending_review'
        AND s.governance_status='approved_company_data'
        AND s.governance_reviewed_by IS NOT NULL
        AND s.governance_reviewed_at IS NOT NULL
        AND s.source_governance='approved'
        AND s.source_reviewer IS NOT NULL
        AND s.source_reviewed_at IS NOT NULL
        AND s.terms_status IN ('allows_reuse','allows_limited_reuse')
        AND s.database_rights_status IN ('low_risk','licensed')
        AND s.personal_data_policy IN ('company_data_only','exclude_personal_data')
        AND NOT s.personal_data_detected
        AND cardinality(s.personal_data_fields)=0
        AND cardinality(s.quality_flags)=0
        AND s.match_company_id IS NULL
        AND s.promoted_company_id IS NULL
        AND s.minimal_eligible IS TRUE
        AND cardinality(s.role_keys)>0
        AND EXISTS (
          SELECT 1 FROM public.network_company_roles role
          WHERE role.canonical_key=ANY(s.role_keys)
            AND role.status='active' AND role.searchable=true
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.network_companies existing
          WHERE lower(trim(existing.website_domain))=lower(trim(s.canonical_domain))
             OR (s.vat_id IS NOT NULL AND existing.vat_id=s.vat_id)
             OR (existing.country_code='IT'
                 AND lower(trim(existing.legal_name))=lower(trim(s.legal_name)))
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.network_netfast3_suppressed_domains suppressed
          WHERE suppressed.domain=lower(trim(s.canonical_domain))
        )
      ) AS eligible
    FROM selected s
  )
  SELECT
    count(*),
    count(*) FILTER(WHERE eligible),
    encode(sha256(convert_to(
      coalesce(jsonb_agg(jsonb_build_object(
        'id',id,'run_id',run_id,'domain',canonical_domain,
        'legal_name',legal_name,'vat_id',vat_id,
        'website_url',website_url,'source_url',source_url,
        'country',country_code,'role_keys',to_jsonb(role_keys),
        'subtype_keys',to_jsonb(subtype_keys),
        'candidate_status',governance_status,
        'candidate_reviewed_by',governance_reviewed_by,
        'candidate_reviewed_at',governance_reviewed_at,
        'candidate_updated_at',updated_at,
        'source_status',source_governance,
        'source_reviewed_by',source_reviewer,
        'source_reviewed_at',source_reviewed_at,
        'source_updated_at',source_updated_at,
        'terms',terms_status,
        'rights',database_rights_status,
        'personal_policy',personal_data_policy,
        'quality_flags',to_jsonb(quality_flags),
        'eligible',eligible
      ) ORDER BY id)::text,'[]'),'UTF8'
    )),'hex')
  INTO v_found,v_eligible,v_fingerprint
  FROM annotated;

  -- The fingerprint is of an exact, ordered canonical set and latest reviewed
  -- data. Any change to the source/identity/roles between preview and commit
  -- invalidates the submitted hash and causes ALL writes to roll back.
  IF NOT COALESCE(p_commit,false) THEN
    RETURN jsonb_build_object(
      'contract','net-it-scale15k-bulk-publish-v1',
      'status',CASE WHEN v_found=v_requested AND v_eligible=v_requested
        THEN 'ready_for_attested_commit' ELSE 'blocked' END,
      'requested',v_requested,'eligible',v_eligible,
      'blocked',v_requested-v_eligible,'published_now',0,
      'manifest_fingerprint',v_fingerprint,
      'original_publisher_default_off',true
    );
  END IF;

  IF v_found<>v_requested OR v_eligible<>v_requested THEN
    RAISE EXCEPTION 'Not all selected companies have approved source, identity, and collision checks'
      USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT lower(trim(c.canonical_domain)))
      FROM public.network_company_discovery_candidates c
      WHERE c.id=ANY(v_ids))<>v_requested
      OR (SELECT count(DISTINCT lower(trim(c.legal_name)))
          FROM public.network_company_discovery_candidates c
          WHERE c.id=ANY(v_ids))<>v_requested THEN
    RAISE EXCEPTION 'Duplicate domain or normalized company name inside this wave'
      USING ERRCODE='22023';
  END IF;
  IF p_attested IS DISTINCT FROM true
      OR p_expected_fingerprint IS NULL
      OR p_expected_fingerprint<>v_fingerprint
      OR length(btrim(COALESCE(p_review_note,''))) NOT BETWEEN 80 AND 2000 THEN
    RAISE EXCEPTION 'Fresh preview, operator attestation and meaningful review note required'
      USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.net_it_scale15k_publication_waves
    WHERE fingerprint=v_fingerprint
  ) THEN
    RAISE EXCEPTION 'This wave was already published'
      USING ERRCODE='22023';
  END IF;

  SELECT enabled INTO v_enabled FROM private.net_pipeline1b2_settings
  WHERE singleton=true FOR UPDATE;
  IF NOT FOUND OR v_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Original minimal publisher must be default OFF before one-shot release'
      USING ERRCODE='42501';
  END IF;

  -- The ON state is uncommitted and invisible to other transactions.
  -- Existing global publisher is restored OFF before this transaction commits.
  UPDATE private.net_pipeline1b2_settings SET enabled=true WHERE singleton=true;
  FOR v_row IN
    SELECT c.id,c.role_keys,c.subtype_keys,c.source_url
    FROM public.network_company_discovery_candidates c
    WHERE c.id=ANY(v_ids)
    ORDER BY c.id
  LOOP
    v_result := public.net_pipeline1b2_publish_one(v_row.id);
    IF v_result->>'status'<>'published'
       OR NULLIF(v_result->>'company_id','') IS NULL THEN
      RAISE EXCEPTION 'Publication of candidate % failed, all inserts rolled back',
        v_row.id USING ERRCODE='22023';
    END IF;
    v_company_id := (v_result->>'company_id')::uuid;
    SELECT role.id,role.canonical_key INTO STRICT v_role_id,v_role_key
    FROM public.network_company_roles role
    WHERE role.canonical_key=ANY(v_row.role_keys)
      AND role.status='active' AND role.searchable=true
    ORDER BY array_position(v_row.role_keys,role.canonical_key)
    LIMIT 1;

    INSERT INTO public.network_data_assertions (
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,asserted_by,
      confidence,review_state
    ) VALUES (
      'company',v_company_id,'industrial_role_observed',
      jsonb_build_object(
        'role_key',v_role_key,'subtype_keys_observed',to_jsonb(v_row.subtype_keys),
        'source_url',v_row.source_url,
        'role_confirmed_by_company',false,
        'company_verified',false,'tube_procurement_confirmed',false
      ),
      'public_web',v_row.source_url,'platform_curated',v_actor,
      0.50,'accepted'
    ) RETURNING id INTO v_assertion_id;
    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);
    v_companies := array_append(v_companies,v_company_id);
  END LOOP;
  UPDATE private.net_pipeline1b2_settings SET enabled=false WHERE singleton=true;
  IF cardinality(v_companies)<>v_requested THEN
    RAISE EXCEPTION 'Atomic batch size mismatch' USING ERRCODE='22023';
  END IF;

  INSERT INTO private.net_it_scale15k_publication_waves(
    fingerprint,committed_by,review_note,candidate_ids,company_ids,company_count
  ) VALUES (v_fingerprint,v_actor,btrim(p_review_note),v_ids,v_companies,v_requested);

  RETURN jsonb_build_object(
    'contract','net-it-scale15k-bulk-publish-v1',
    'status','published','published_count',v_requested,
    'company_ids',to_jsonb(v_companies),
    'claimed_companies',0,'verified_companies',0,
    'original_publisher_default_off',true
  );
END;
$scale15k_publish$;

REVOKE ALL ON FUNCTION private.net_it_scale15k_bulk_publish_impl(uuid[],text,boolean,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_scale15k_bulk_publish_impl(uuid[],text,boolean,text,boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_scale15k_bulk_publish(
  p_candidate_ids uuid[],
  p_expected_fingerprint text DEFAULT NULL,
  p_attested boolean DEFAULT false,
  p_review_note text DEFAULT NULL,
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER
SET search_path TO ''
AS $scale15k_public$
  SELECT private.net_it_scale15k_bulk_publish_impl(
    p_candidate_ids,p_expected_fingerprint,p_attested,p_review_note,p_commit
  );
$scale15k_public$;
REVOKE ALL ON FUNCTION public.net_it_scale15k_bulk_publish(uuid[],text,boolean,text,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_scale15k_bulk_publish(uuid[],text,boolean,text,boolean)
  TO authenticated;
