-- NET-IT-CARP1.E.5 — append source-observed capabilities to Platform-only cockpit snapshot.
-- Does not change publication, source review or any company statuses.
CREATE OR REPLACE FUNCTION private.netit_carp1_e5_admin_snapshot_impl(p_state text DEFAULT 'all'::text, p_query text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_state text := lower(btrim(coalesce(p_state,'all')));
  v_query text := lower(btrim(coalesce(p_query,'')));
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Platform authentication required' USING ERRCODE='42501';
  END IF;
  PERFORM private.require_platform_permission('discovery.read');
  PERFORM private.require_platform_permission('discovery.governance_review');
  PERFORM private.require_platform_permission('network.privacy_governance_review');

  IF v_state NOT IN (
    'all','candidate_seed_aligned','name_reconciliation_needed',
    'research_seed_missing','canonical_collision','needs_contact'
  ) THEN
    RAISE EXCEPTION 'Invalid reconciliation filter' USING ERRCODE='22023';
  END IF;
  IF char_length(v_query)>80 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Invalid pagination/search bounds' USING ERRCODE='22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT * FROM private.netit_carp1_growth100_bridge
  ),
  stats AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER(WHERE has_first_party_contact)::integer AS enriched,
      count(*) FILTER(WHERE corporate_email_private IS NOT NULL)::integer AS email_count,
      count(*) FILTER(WHERE corporate_phone_private IS NOT NULL)::integer AS phone_count,
      count(*) FILTER(WHERE reconciliation_state='candidate_seed_aligned')::integer AS aligned,
      count(*) FILTER(WHERE reconciliation_state='name_reconciliation_needed')::integer AS name_review,
      count(*) FILTER(WHERE reconciliation_state='research_seed_missing')::integer AS research_missing,
      count(*) FILTER(WHERE reconciliation_state='canonical_collision')::integer AS collision
    FROM candidates
  ),
  filtered AS (
    SELECT * FROM candidates c
    WHERE (v_state='all' OR
           (v_state='needs_contact' AND NOT c.has_first_party_contact)
            OR c.reconciliation_state=v_state)
      AND (v_query='' OR pg_catalog.strpos(lower(c.candidate_name),v_query)>0
                       OR pg_catalog.strpos(lower(c.canonical_domain),v_query)>0
                       OR pg_catalog.strpos(lower(coalesce(c.province_code,'')),v_query)>0)
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY has_first_party_contact ASC,canonical_domain ASC,candidate_id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT pg_catalog.jsonb_build_object(
    'contract','net-it-carp1-e5-admin-v1',
    'total',stats.total,'enriched',stats.enriched,
    'email_count',stats.email_count,'phone_count',stats.phone_count,
    'aligned',stats.aligned,'name_review',stats.name_review,
    'research_missing',stats.research_missing,'collision',stats.collision,
    'selected_total',(SELECT count(*) FROM filtered),
    'items',(SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'candidate_id',p.candidate_id,
        'name',p.candidate_name,
        'domain',p.canonical_domain,
        'vat_id',p.vat_id,
        'region',p.region,
        'province',p.province_code,
        'reconciliation_state',p.reconciliation_state,
        'research_seed_name',p.research_seed_name,
        'has_contact',p.has_first_party_contact,
        'email',p.corporate_email_private,
        'phone',p.corporate_phone_private,
        'company_source_url',p.candidate_source_url,
        'contact_source_url',p.contact_source_url,
        'observed_capabilities',coalesce(
          (SELECT c.enrichment_quality->'official_contact_20261108'->'industrial_capabilities_observed'
           FROM public.network_company_discovery_candidates c WHERE c.id=p.candidate_id),
          '[]'::jsonb
        ),
        'review_status',p.review_status,
        'governance_status',p.governance_status,
        'updated_at',p.candidate_updated_at
      ) ORDER BY p.canonical_domain), '[]'::jsonb) FROM paged p),
    'publications_performed',0
  ) INTO v_result FROM stats;

  RETURN v_result;
END;
$function$;
