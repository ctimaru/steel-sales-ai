-- NET-IT-PIEMONTE1 — source-only automatic postcode locality for AUTO3 companies.
-- A company already published by delegated AUTO3 can acquire a minimal, explicitly
-- unverified regional location from its OWN site's JSON-LD, not from the team's
-- manual census notes. Only Piemonte is owner-authorized in existing policy.
-- No user action can invoke this maintenance-only function.

CREATE OR REPLACE FUNCTION private.net_it_region_auto3_postal_publish(
  p_region text DEFAULT 'Piemonte',
  p_max integer DEFAULT 25,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $postal$
DECLARE
  v_count integer := 0;
  v_published integer := 0;
  v_facility uuid;
  v_items jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance-only regional source-locality worker'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 25 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Bounded regional postal batch required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.net_it_region_geo_auto_policy
    WHERE region=p_region AND enabled
  ) THEN
    RETURN jsonb_build_object('contract','net-it-region-auto3-postal-v1',
      'status','region_not_authorized','ready',0,'published',0);
  END IF;

  IF NOT p_dry_run THEN
    -- Same advisory lock as the existing approved-source Piemonte agent.
    PERFORM pg_catalog.pg_advisory_xact_lock(810021,20263);
    LOCK TABLE public.network_facilities IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR v_row IN
    SELECT c.id AS candidate_id, c.run_id AS source_run_id,
      n.id AS company_id, c.canonical_domain AS source_domain,
      m.municipality_name AS city, m.region_name AS region,
      m.province_code AS province_code, m.istat_code AS istat_code,
      geo.source_url AS source_url
    FROM public.network_company_discovery_candidates c
    JOIN private.net_it_auto3_publications auto3
      ON auto3.candidate_id=c.id AND auto3.company_id=c.promoted_company_id
    JOIN private.net_it_auto2_evidence proof
      ON proof.id=auto3.evidence_id AND proof.candidate_id=c.id
         AND proof.source_run_id=c.run_id
    JOIN public.network_companies n ON n.id=c.promoted_company_id
    CROSS JOIN LATERAL (
      SELECT lower(btrim(loc.value->>'city')) AS city_key,
        loc.value->>'postal_code' AS postal_code,
        bool_or(lower(btrim(loc.value->>'region'))=lower(p_region)) AS region_seen,
        coalesce(array_agg(DISTINCT upper(btrim(loc.value->>'province_code')))
          FILTER (WHERE loc.value->>'province_code' ~ '^[A-Z]{2}$'),
          '{}'::text[]) AS province_codes,
        min(loc.value->>'source_url') AS source_url
      FROM jsonb_array_elements(coalesce(c.facility_candidates,'[]'::jsonb)) loc(value)
      WHERE loc.value->>'source_kind'='json_ld_postal_address'
        AND loc.value->>'country_code'='IT'
        AND loc.value->>'source_url' ~* '^https://'
        AND lower(regexp_replace(
          split_part(split_part(loc.value->>'source_url','/',3),':',1),
          '^www[.]',''
        ))=lower(btrim(c.canonical_domain))
        AND loc.value->>'postal_code' ~ '^[0-9]{5}$'
        AND char_length(btrim(loc.value->>'city')) BETWEEN 2 AND 120
      GROUP BY lower(btrim(loc.value->>'city')), loc.value->>'postal_code'
    ) AS geo
    JOIN public.network_it_municipalities m
      ON m.is_current
        AND m.region_name=p_region
        AND lower(btrim(m.municipality_name))=geo.city_key
        AND m.province_code=ANY(geo.province_codes)
    WHERE c.country_code='IT' AND c.review_status='published'
      AND c.promoted_company_id IS NOT NULL
      AND c.personal_data_detected IS NOT TRUE
      AND cardinality(coalesce(c.personal_data_fields,'{}'::text[]))=0
      AND c.match_company_id IS NULL
      AND c.source_url ~* '^https://'
      AND lower(regexp_replace(
          split_part(split_part(c.source_url,'/',3),':',1),
          '^www[.]',''
        ))=lower(btrim(c.canonical_domain))
      AND n.country_code='IT' AND n.publication_status='published'
      AND n.archived_at IS NULL AND n.claimed_status='unclaimed'
      AND n.verification_status='unverified'
      AND lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
      -- Publication must already have passed the official delegated AUTO3 path.
      AND auto3.actor_type='delegated_agent'
      AND auto3.policy='first_party_minimal_facts_only_v1'
      AND proof.reviewer_version='net-it-auto2-firstparty-v4'
      AND proof.verdict='identity_supported'
      AND proof.matched_company_name IS TRUE
      AND proof.identity_confidence>=0.94
      AND proof.observed_domain=lower(btrim(c.canonical_domain))
      AND proof.page_evidence_hash ~ '^[a-f0-9]{64}$'
      AND proof.source_rights_state='unknown'
      AND geo.region_seen
      -- Require BOTH the source-observed region and official province on the
      -- same city, postcode, company domain; never infer from an arbitrary city.
      AND NOT EXISTS (
        SELECT 1 FROM public.network_facilities f
        WHERE f.company_id=n.id AND f.archived_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_it_geo_evidence_candidates g
        WHERE g.company_id=n.id AND g.status='conflict'
      )
      AND NOT EXISTS (
        SELECT 1 FROM private.net_it_region_geo_auto_ledger l
        WHERE l.candidate_id=c.id OR l.company_id=n.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_netfast3_suppressed_domains s
        WHERE s.domain=lower(btrim(c.canonical_domain))
      )
    ORDER BY c.created_at,c.id,m.istat_code
    LIMIT p_max
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.network_facilities f
      WHERE f.company_id=v_row.company_id AND f.archived_at IS NULL
    ) THEN
      CONTINUE;
    END IF;
    v_count:=v_count+1;
    v_items:=v_items || jsonb_build_array(jsonb_build_object(
      'company_id',v_row.company_id,'city',v_row.city,
      'province',v_row.province_code,'source_url',v_row.source_url));
    IF p_dry_run THEN CONTINUE; END IF;

    INSERT INTO public.network_facilities (
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) VALUES (
      v_row.company_id,'Sede — '||v_row.city,'site',v_row.city,
      v_row.region,'IT','published','unverified'
    ) RETURNING id INTO v_facility;
    INSERT INTO private.net_it_region_geo_auto_ledger (
      candidate_id,company_id,facility_id,source_run_id,source_url,
      source_domain,istat_code,province_code,region,city
    ) VALUES (
      v_row.candidate_id,v_row.company_id,v_facility,v_row.source_run_id,
      v_row.source_url,v_row.source_domain,v_row.istat_code,
      v_row.province_code,v_row.region,v_row.city
    );
    v_published:=v_published+1;
  END LOOP;
  RETURN jsonb_build_object('contract','net-it-region-auto3-postal-v1',
    'status',CASE WHEN p_dry_run THEN 'preview_only' ELSE 'published' END,
    'ready',v_count,'published',v_published,'verification_status','unverified',
    'items',v_items);
END
$postal$;

REVOKE ALL ON FUNCTION private.net_it_region_auto3_postal_publish(text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;

SELECT cron.schedule(
  'net-it-piemonte-auto3-postal-geo1',
  '48 * * * *',
  $cron$SELECT private.net_it_region_auto3_postal_publish('Piemonte',25,false);$cron$
);
