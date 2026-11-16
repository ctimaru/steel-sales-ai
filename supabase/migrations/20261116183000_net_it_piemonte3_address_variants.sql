-- NET-IT-PIEMONTE3 source-backed address variants.
-- Extension of existing maintenance-only governed geo-agent, not a new
-- client-visible publisher. The stored excerpt remains literal first-party.
CREATE OR REPLACE FUNCTION private.net_it_region_official_text_geo_publish(p_region text DEFAULT 'Piemonte'::text, p_max integer DEFAULT 25, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_row record;
  v_id uuid;
  v_ready integer:=0;
  v_written integer:=0;
  v_items jsonb:='[]'::jsonb;
BEGIN
  IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance-only first-party locality publisher' USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 25 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Batch must be bounded and dry_run explicit' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.net_it_region_geo_auto_policy
                 WHERE region=p_region AND enabled) THEN
    RETURN jsonb_build_object('contract','net-it-region-official-text-v1',
      'status','region_not_authorized','ready',0,'published',0);
  END IF;
  IF NOT p_dry_run THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(810021,20263);
    LOCK TABLE public.network_facilities IN SHARE ROW EXCLUSIVE MODE;
  END IF;
  FOR v_row IN
    SELECT o.id observation_id, c.id candidate_id, c.run_id source_run_id,
           n.id company_id, n.website_domain source_domain,
           o.source_url,o.city,o.region,o.postal_code,o.province_code,m.istat_code
    FROM private.net_it_region_official_locality_observations o
    JOIN public.network_companies n ON n.id=o.company_id
    JOIN public.network_company_discovery_candidates c
      ON c.promoted_company_id=n.id AND c.canonical_domain=lower(btrim(o.domain))
    JOIN private.net_it_auto3_publications a
      ON a.candidate_id=c.id AND a.company_id=n.id
    JOIN private.net_it_auto2_evidence e
      ON e.id=a.evidence_id AND e.candidate_id=c.id AND e.source_run_id=c.run_id
    JOIN public.network_it_municipalities m
      ON m.is_current AND m.region_name=p_region
      AND lower(btrim(m.municipality_name))=lower(btrim(o.city))
      AND m.province_code=o.province_code
    WHERE o.region=p_region AND o.country_code='IT'
      AND o.observed_at>=now()-interval '30 days'
      AND lower(btrim(o.domain))=lower(btrim(n.website_domain))
      AND o.source_url~*'^https://'
      AND lower(regexp_replace(split_part(split_part(o.source_url,'/',3),':',1),'^www[.]',''))
          =lower(btrim(o.domain))
      AND position(o.postal_code IN o.source_excerpt)>0
      -- First-party address must show the municipality verbatim; a small
      -- documented Piedmont abbreviation 'C.se' is accepted for 'Canavese'
      -- only when the current ISTAT municipality and TO are both exact.
      AND (
        position(lower(btrim(o.city)) IN lower(o.source_excerpt))>0
        OR (
          o.province_code='TO'
          AND lower(btrim(o.city)) LIKE '% canavese'
          AND position(
            replace(lower(btrim(o.city)),' canavese',' c.se')
            IN lower(o.source_excerpt)
          )>0
        )
      )
      -- Province: '(TO)', isolated 'TO', or the official extended name
      -- following a DIFFERENT municipality (Paruzzaro, Novara). Never infer
      -- province from a city with the same name (Torino, Torino).
      AND (
        position('('||o.province_code||')' IN o.source_excerpt)>0
        OR lower(o.source_excerpt) ~ (
          '(^|[^[:alpha:]])'||lower(o.province_code)||'([^[:alpha:]]|$)'
        )
        OR (
          lower(m.province_name) <> lower(o.city)
          AND position(
            lower(m.province_name) IN
            substring(lower(o.source_excerpt)
                      FROM greatest(1,position(lower(o.city) IN lower(o.source_excerpt)))
                      FOR 100)
          )>0
        )
      )
      -- All variants must remain an actual company-address statement,
      -- not a service-area/SEO location. The source URL still must be
      -- HTTPS on the same already-published, identity-proven domain.
      AND lower(o.source_excerpt) ~
          '(via |viale |strada |corso |piazza |sede |stabilimento|unit[aà] locale|loc[.]|s[.]p[.]|address|contatti)'
      AND n.country_code='IT' AND n.publication_status='published'
      AND n.claimed_status='unclaimed' AND n.verification_status='unverified'
      AND n.archived_at IS NULL
      AND c.country_code='IT' AND c.review_status='published'
      AND c.personal_data_detected IS NOT TRUE
      AND cardinality(coalesce(c.personal_data_fields,'{}'::text[]))=0
      AND c.match_company_id IS NULL
      AND a.actor_type='delegated_agent'
      AND a.policy='first_party_minimal_facts_only_v1'
      AND e.verdict='identity_supported' AND e.matched_company_name IS TRUE
      AND e.reviewer_version='net-it-auto2-firstparty-v4'
      AND e.identity_confidence>=0.94
      AND e.observed_domain=lower(btrim(o.domain))
      AND e.page_evidence_hash~'^[a-f0-9]{64}$'
      AND e.source_rights_state='unknown'
      AND NOT EXISTS(SELECT 1 FROM public.network_facilities f
         WHERE f.company_id=n.id AND f.archived_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.network_it_geo_evidence_candidates ge
         WHERE ge.company_id=n.id)
      -- Do not arbitrarily pick among different sourced municipalities.
      AND NOT EXISTS (
        SELECT 1 FROM private.net_it_region_official_locality_observations o2
        WHERE o2.company_id=o.company_id
          AND o2.observed_at>=now()-interval '30 days'
          AND (o2.city,o2.province_code) IS DISTINCT FROM (o.city,o.province_code)
      )
      AND NOT EXISTS(SELECT 1 FROM private.net_it_region_geo_auto_ledger l
         WHERE l.company_id=n.id OR l.candidate_id=c.id)
      AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
         WHERE s.domain=lower(btrim(o.domain)))
    ORDER BY o.created_at,o.id
    LIMIT p_max
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    IF EXISTS(SELECT 1 FROM public.network_facilities
              WHERE company_id=v_row.company_id AND archived_at IS NULL) THEN
      CONTINUE;
    END IF;
    v_ready:=v_ready+1;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'company_id',v_row.company_id,'city',v_row.city,
      'province',v_row.province_code,'source_url',v_row.source_url));
    IF p_dry_run THEN CONTINUE; END IF;
    INSERT INTO public.network_facilities(
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) VALUES (
      v_row.company_id,'Sede — '||v_row.city,'site',v_row.city,v_row.region,
      'IT','published','unverified'
    ) RETURNING id INTO v_id;
    INSERT INTO private.net_it_region_geo_auto_ledger(
      candidate_id,company_id,facility_id,source_run_id,source_url,
      source_domain,istat_code,province_code,region,city
    ) VALUES(
      v_row.candidate_id,v_row.company_id,v_id,v_row.source_run_id,
      v_row.source_url,v_row.source_domain,v_row.istat_code,
      v_row.province_code,v_row.region,v_row.city
    );
    v_written:=v_written+1;
  END LOOP;
  RETURN jsonb_build_object(
    'contract','net-it-region-official-text-v1',
    'status',CASE WHEN p_dry_run THEN 'preview_only' ELSE 'published' END,
    'ready',v_ready,'published',v_written,
    'verification_status','unverified','items',v_items);
END
$function$;
REVOKE ALL ON FUNCTION private.net_it_region_official_text_geo_publish(text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
