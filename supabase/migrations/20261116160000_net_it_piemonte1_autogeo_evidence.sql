-- NET-IT-PIEMONTE1 / AUTO-GEO3 — autonomous locality from the crawler's
-- OWN first-party evidence, without operator-entered observation rows.
-- A match is only an exact postal-code / city / province sequence, cross-checked
-- with the current official ISTAT municipality registry. Multiple different
-- municipalities for the same company are held (multi-plant ambiguity).
-- Owner policy currently enables Piemonte only. No company fact or legal
-- verification status is changed by this publisher.
CREATE OR REPLACE FUNCTION private.net_it_region_auto3_evidence_geo_publish(
  p_region text DEFAULT 'Piemonte',
  p_max integer DEFAULT 25,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $agent$
DECLARE
  v_item record;
  v_facility uuid;
  v_ready integer := 0;
  v_published integer := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance agent only; no user/session impersonation'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 25 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Bounded locality batch and explicit dry run required'
      USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private.net_it_region_geo_auto_policy
    WHERE region=p_region AND enabled
  ) THEN
    RETURN jsonb_build_object(
      'contract','net-it-region-auto3-evidence-v1',
      'status','region_not_authorized','ready',0,'published',0);
  END IF;
  IF NOT p_dry_run THEN
    -- Shared lock with the other Piemonte locality agents :47, :48, :49.
    PERFORM pg_catalog.pg_advisory_xact_lock(810021,20263);
    LOCK TABLE public.network_facilities IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR v_item IN
    WITH eligible AS (
      SELECT c.id AS candidate_id, c.run_id AS source_run_id,
             c.promoted_company_id AS company_id,
             c.canonical_domain AS source_domain, c.evidence,
             c.created_at AS candidate_created
      FROM public.network_company_discovery_candidates c
      JOIN private.net_it_auto3_publications a
        ON a.candidate_id=c.id AND a.company_id=c.promoted_company_id
      JOIN private.net_it_auto2_evidence proof
        ON proof.id=a.evidence_id
        AND proof.candidate_id=c.id AND proof.source_run_id=c.run_id
      JOIN public.network_companies n ON n.id=c.promoted_company_id
      WHERE c.country_code='IT' AND c.review_status='published'
        AND c.promoted_company_id IS NOT NULL
        AND c.personal_data_detected IS NOT TRUE
        AND cardinality(coalesce(c.personal_data_fields,'{}'::text[]))=0
        AND c.match_company_id IS NULL
        AND c.match_signals='[]'::jsonb
        AND n.country_code='IT' AND n.publication_status='published'
        AND n.archived_at IS NULL AND n.claimed_status='unclaimed'
        AND n.verification_status='unverified'
        AND lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
        AND a.actor_type='delegated_agent'
        AND a.policy='first_party_minimal_facts_only_v1'
        AND proof.reviewer_version='net-it-auto2-firstparty-v4'
        AND proof.verdict='identity_supported'
        AND proof.matched_company_name IS TRUE
        AND proof.identity_confidence>=0.94
        AND proof.observed_domain=lower(btrim(c.canonical_domain))
        AND proof.page_evidence_hash~'^[a-f0-9]{64}$'
        AND proof.source_rights_state='unknown'
        AND proof.reviewed_at>=now()-interval '30 days'
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
          WHERE l.company_id=n.id OR l.candidate_id=c.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.network_netfast3_suppressed_domains s
          WHERE s.domain=lower(btrim(c.canonical_domain))
        )
    ),
    text_matches AS (
      SELECT e.candidate_id,e.source_run_id,e.company_id,e.source_domain,
             e.candidate_created,
             page.value->>'url' AS source_url,
             hit.m[1] AS postal_code,
             btrim(hit.m[2], ' -') AS city,
             hit.m[3] AS province_code
      FROM eligible e
      CROSS JOIN LATERAL jsonb_array_elements(
        coalesce(e.evidence,'[]'::jsonb)) AS page(value)
      CROSS JOIN LATERAL regexp_matches(
        left(coalesce(page.value->>'snippet',''),1200),
        '([0-9]{5})[[:space:]]+([[:alpha:]''’ -]{2,45})[[:space:]]*[(]([A-Z]{2})[)]',
        'g'
      ) AS hit(m)
      WHERE page.value->>'url'~*'^https://'
        AND lower(regexp_replace(
          split_part(split_part(page.value->>'url','/',3),':',1),
          '^www[.]',''))=lower(btrim(e.source_domain))
        -- A company footer/contact address, not a number from an arbitrary
        -- product table. The source was already first-party and identity-tested.
        AND lower(substring(page.value->>'snippet' from
              greatest(1, strpos(page.value->>'snippet',hit.m[1])-100)
              for 110)) ~
            '(^|[^[:alpha:]])(via|sede|contatti|indirizzo|zona|area|strada|corso|piazza|localit[aà]|viale|contrada|c[.]?/?da)([^[:alpha:]]|$)'
    ),
    verified AS (
      SELECT t.*,m.istat_code,m.municipality_name,m.region_name
      FROM text_matches t
      JOIN public.network_it_municipalities m
        ON m.is_current AND m.region_name=p_region
       AND m.province_code=t.province_code
       AND lower(btrim(m.municipality_name))=lower(btrim(t.city))
    ),
    one_location AS (
      SELECT v.candidate_id,v.source_run_id,v.company_id,v.source_domain,
             min(v.source_url) AS source_url,
             min(v.istat_code) AS istat_code,
             min(v.municipality_name) AS city,
             min(v.province_code) AS province_code,
             min(v.region_name) AS region,
             min(v.candidate_created) AS candidate_created
      FROM verified v
      GROUP BY v.candidate_id,v.source_run_id,v.company_id,v.source_domain
      -- Do not silently pick one of several plants or an ambiguous address.
      HAVING count(DISTINCT v.istat_code)=1
    )
    SELECT o.* FROM one_location o
    ORDER BY o.candidate_created,o.candidate_id
    LIMIT p_max
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.network_facilities
      WHERE company_id=v_item.company_id AND archived_at IS NULL
    ) THEN CONTINUE; END IF;
    v_ready := v_ready+1;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'company_id',v_item.company_id,
      'city',v_item.city,'province',v_item.province_code,
      'source_url',v_item.source_url));
    IF p_dry_run THEN CONTINUE; END IF;

    INSERT INTO public.network_facilities(
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) VALUES (
      v_item.company_id,'Sede — '||v_item.city,'site',
      v_item.city,v_item.region,'IT','published','unverified'
    ) RETURNING id INTO v_facility;

    INSERT INTO private.net_it_region_geo_auto_ledger(
      candidate_id,company_id,facility_id,source_run_id,source_url,
      source_domain,istat_code,province_code,region,city
    ) VALUES (
      v_item.candidate_id,v_item.company_id,v_facility,v_item.source_run_id,
      v_item.source_url,v_item.source_domain,v_item.istat_code,
      v_item.province_code,v_item.region,v_item.city
    );
    v_published := v_published+1;
  END LOOP;
  RETURN jsonb_build_object(
    'contract','net-it-region-auto3-evidence-v1',
    'status',CASE WHEN p_dry_run THEN 'preview_only' ELSE 'published' END,
    'ready',v_ready,'published',v_published,
    'verification_status','unverified','items',v_rows);
END
$agent$;
REVOKE ALL ON FUNCTION private.net_it_region_auto3_evidence_geo_publish(text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;

-- Runs after the three existing regional agents; no duplicate scheduler.
SELECT cron.schedule(
  'net-it-piemonte-auto3-evidence-geo1','50 * * * *',
  $cron$SELECT private.net_it_region_auto3_evidence_geo_publish('Piemonte',25,false);$cron$
);
