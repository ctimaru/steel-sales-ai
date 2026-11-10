-- NET-IT-SCALE15K / C1: read-only, Platform-permission-gated Italian growth funnel.
-- Installation does NOT approve sources, alter candidates, or publish companies.
-- Raw private research and governance details are never exposed to anon.
-- Kept separate from NET-IT-PUB1 five-company publication PR (#1214).

CREATE OR REPLACE FUNCTION private.net_it_scale15k_readiness_impl(
  p_lane text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $scale15k$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated Platform reviewer required' USING ERRCODE='42501';
  END IF;
  PERFORM private.require_platform_permission('discovery.read');
  PERFORM private.require_platform_permission('discovery.governance_review');

  IF p_lane IS NULL OR p_lane NOT IN
    ('all','ready','review_source','review_company','duplicate','hold')
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 250
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 15000 THEN
    RAISE EXCEPTION 'Invalid growth queue filter or page' USING ERRCODE='22023';
  END IF;

  WITH base AS MATERIALIZED (
    SELECT
      c.id,c.run_id,c.canonical_domain,c.legal_name,c.website_url,
      c.source_url,c.role_keys,c.created_at,c.review_status,
      c.governance_status AS candidate_governance,c.personal_data_detected,
      c.match_company_id,c.promoted_company_id,c.quality_flags,
      r.governance_status AS source_governance,r.terms_status,
      r.database_rights_status,r.personal_data_policy,
      lower(trim(c.canonical_domain)) AS normal_domain,
      (private.net_pipeline1b2_eligibility(c.id)->>'reason') AS eligibility_reason,
      EXISTS (
        SELECT 1 FROM public.network_companies existing
        WHERE lower(trim(existing.website_domain))=lower(trim(c.canonical_domain))
           OR (c.vat_id IS NOT NULL AND existing.vat_id=c.vat_id)
      ) AS catalog_collision
    FROM public.network_company_discovery_candidates c
    JOIN public.network_company_discovery_runs r ON r.id=c.run_id
    WHERE c.country_code='IT' AND c.review_status='pending_review'
  ),
  ranked AS MATERIALIZED (
    SELECT b.*,
      row_number() OVER (
        PARTITION BY b.normal_domain
        ORDER BY (b.candidate_governance='approved_company_data') DESC,
                 (b.source_governance='approved') DESC,
                 b.created_at,b.id
      ) AS same_domain_rank,
      count(*) OVER (PARTITION BY b.normal_domain) AS same_domain_count
    FROM base b
  ),
  lanes AS MATERIALIZED (
    SELECT r.*,
      CASE
        WHEN r.catalog_collision OR r.match_company_id IS NOT NULL
          OR r.same_domain_rank>1 THEN 'duplicate'
        WHEN r.source_governance IN ('blocked','restricted')
          OR r.terms_status='restricts_reuse'
          OR r.database_rights_status='restricted'
          OR r.personal_data_policy='legal_review_required'
          THEN 'hold'
        WHEN r.source_governance<>'approved'
          OR r.terms_status NOT IN ('allows_reuse','allows_limited_reuse')
          OR r.database_rights_status NOT IN ('low_risk','licensed')
          OR r.personal_data_policy NOT IN ('company_data_only','exclude_personal_data')
          THEN 'review_source'
        WHEN r.candidate_governance<>'approved_company_data' THEN 'review_company'
        WHEN r.eligibility_reason='eligible_minimal_preview'
          AND NOT r.personal_data_detected
          AND cardinality(r.quality_flags)=0 THEN 'ready'
        ELSE 'hold'
      END AS lane
    FROM ranked r
  ),
  summary AS (
    SELECT
      count(*) AS pending,
      count(*) FILTER (WHERE lane='ready') AS ready,
      count(*) FILTER (WHERE lane='review_source') AS review_source,
      count(*) FILTER (WHERE lane='review_company') AS review_company,
      count(*) FILTER (WHERE lane='duplicate') AS duplicate,
      count(*) FILTER (WHERE lane='hold') AS hold,
      count(DISTINCT normal_domain) AS distinct_domains
    FROM lanes
  ),
  page AS (
    SELECT l.*
    FROM lanes l
    WHERE p_lane='all' OR l.lane=p_lane
    ORDER BY
      CASE l.lane
        WHEN 'ready' THEN 0
        WHEN 'review_company' THEN 1
        WHEN 'review_source' THEN 2
        WHEN 'duplicate' THEN 3 ELSE 4 END,
      l.normal_domain,l.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT pg_catalog.jsonb_build_object(
    'contract','net-it-scale15k-readiness-v1',
    'goal',15000,
    'country_code','IT',
    'canonical_published',(
      SELECT count(*) FROM public.network_companies nc
      WHERE nc.country_code='IT' AND nc.publication_status='published'
        AND nc.archived_at IS NULL
    ),
    'published_missing_role',(
      SELECT count(*) FROM public.network_companies nc
      WHERE nc.country_code='IT' AND nc.publication_status='published'
        AND nc.archived_at IS NULL
        AND NOT EXISTS(
          SELECT 1 FROM public.network_company_role_assignments a
          WHERE a.company_id=nc.id
        )
    ),
    'discovery_all',(
      SELECT count(*) FROM public.network_company_discovery_candidates dc
      WHERE dc.country_code='IT'
    ),
    'private_seed_total',(
      SELECT count(*) FROM private.network_web_research_seeds s
      WHERE s.country_code='IT' AND s.publication_status='not_published'
    ),
    'private_seed_unlinked_domains',(
      SELECT count(DISTINCT lower(trim(s.canonical_domain)))
      FROM private.network_web_research_seeds s
      WHERE s.country_code='IT' AND s.publication_status='not_published'
        AND NOT EXISTS (
          SELECT 1 FROM public.network_company_discovery_candidates dc
          WHERE lower(trim(dc.canonical_domain))=lower(trim(s.canonical_domain))
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.network_companies nc
          WHERE lower(trim(nc.website_domain))=lower(trim(s.canonical_domain))
        )
    ),
    'pending',s.pending,'pending_distinct_domains',s.distinct_domains,
    'ready',s.ready,'review_source',s.review_source,
    'review_company',s.review_company,'duplicate',s.duplicate,'hold',s.hold,
    'lane',p_lane,'limit',p_limit,'offset',p_offset,
    'rows',COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'candidate_id',p.id,'run_id',p.run_id,
            'company_name',p.legal_name,
            'domain',p.canonical_domain,
            'company_website',p.website_url,
            'source_url',p.source_url,
            'role',COALESCE(p.role_keys[1],'unspecified'),
            'lane',p.lane,
            'eligibility_reason',p.eligibility_reason,
            'candidate_governance',p.candidate_governance,
            'source_governance',p.source_governance,
            'source_terms',p.terms_status,
            'source_rights',p.database_rights_status,
            'same_domain_count',p.same_domain_count,
            'catalog_collision',p.catalog_collision
          ) ORDER BY
            CASE p.lane WHEN 'ready' THEN 0 WHEN 'review_company' THEN 1
              WHEN 'review_source' THEN 2 WHEN 'duplicate' THEN 3 ELSE 4 END,
            p.normal_domain,p.id
        )
        FROM page p
      ),'[]'::jsonb
    )
  ) INTO v_result
  FROM summary s;

  RETURN v_result;
END;
$scale15k$;

REVOKE ALL ON FUNCTION private.net_it_scale15k_readiness_impl(text,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_scale15k_readiness_impl(text,integer,integer)
  TO authenticated;

-- Invoker façade, not a public SECURITY DEFINER function (HP13 compliance).
CREATE OR REPLACE FUNCTION public.net_it_scale15k_readiness(
  p_lane text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO ''
AS $scale15k_public$
  SELECT private.net_it_scale15k_readiness_impl(p_lane,p_limit,p_offset);
$scale15k_public$;
REVOKE ALL ON FUNCTION public.net_it_scale15k_readiness(text,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_scale15k_readiness(text,integer,integer)
  TO authenticated;
