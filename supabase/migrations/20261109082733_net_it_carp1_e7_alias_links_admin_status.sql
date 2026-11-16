-- NET-IT-CARP1.E.7 — Private alias labels, no public profile insert.
-- Actual source candidates carry identity_link_e7 metadata already (16/16).
-- Domain link is a non-verified brand alias, NOT a verified legal identity.
-- NET-IT-CARP1.E4 — Read-only private bridge for Growth100 intake.
-- No company publication, no duplicate insert and no reliance on a legal sign-off.
-- Joins existing discovery candidates to research seeds by domain, retaining
-- a single canonical candidate as source of truth until a separate publish gate.
CREATE OR REPLACE VIEW private.netit_carp1_growth100_bridge
WITH (security_invoker=true) AS
SELECT
  c.id AS candidate_id,
  c.run_id,
  c.canonical_domain,
  c.legal_name AS candidate_name,
  c.vat_id,
  c.source_url AS candidate_source_url,
  c.review_status,
  c.governance_status,
  c.facility_candidates->0->>'region' AS region,
  c.facility_candidates->0->>'province_code' AS province_code,
  (c.enrichment_quality ? 'official_contact_20261108') AS has_first_party_contact,
  c.enrichment_quality->'official_contact_20261108'->>'email' AS corporate_email_private,
  c.enrichment_quality->'official_contact_20261108'->>'phone' AS corporate_phone_private,
  c.enrichment_quality->'official_contact_20261108'->>'source_url' AS contact_source_url,
  s.id AS research_seed_id,
  s.display_name AS research_seed_name,
  s.publication_status AS research_seed_publication_status,
  CASE
    WHEN n.id IS NOT NULL THEN 'canonical_collision'
    WHEN s.id IS NULL THEN 'research_seed_missing'
    WHEN c.enrichment_quality->'identity_link_e7'->>'status'='exact_domain_alias_linked'
      AND c.enrichment_quality->'identity_link_e7'->>'linked_research_seed_id'=s.id::text
      AND regexp_replace(lower(coalesce(s.display_name,'')),'[^a-z0-9]','','g')
       <> regexp_replace(lower(coalesce(c.legal_name,'')),'[^a-z0-9]','','g')
    THEN 'domain_alias_linked'
    WHEN regexp_replace(lower(coalesce(s.display_name,'')),'[^a-z0-9]','','g')
       <> regexp_replace(lower(coalesce(c.legal_name,'')),'[^a-z0-9]','','g')
    THEN 'name_reconciliation_needed'
    ELSE 'candidate_seed_aligned'
  END AS reconciliation_state,
  n.id AS existing_canonical_company_id,
  c.updated_at AS candidate_updated_at
FROM public.network_company_discovery_candidates c
JOIN public.network_company_discovery_runs r ON r.id=c.run_id
LEFT JOIN LATERAL (
 SELECT s.id,s.display_name,s.publication_status
 FROM private.network_web_research_seeds s
 WHERE s.country_code='IT' AND s.canonical_domain=c.canonical_domain
 ORDER BY s.first_seen_at DESC NULLS LAST,s.id
 LIMIT 1
) s ON true
LEFT JOIN LATERAL (
 SELECT n.id FROM public.network_companies n
 WHERE n.country_code='IT' AND (
   regexp_replace(lower(coalesce(n.website_domain,'')),'^www[.]','','i')=c.canonical_domain
   OR (c.vat_id IS NOT NULL AND regexp_replace(coalesce(n.vat_id,''),'[^0-9]','','g')=regexp_replace(c.vat_id,'[^0-9]','','g'))
 )
 ORDER BY n.created_at DESC NULLS LAST,n.id LIMIT 1
) n ON true
WHERE c.country_code='IT'
  AND r.source_reference LIKE 'NET-IT-CARP1.D.%';
REVOKE ALL ON private.netit_carp1_growth100_bridge FROM PUBLIC,anon,authenticated;
COMMENT ON VIEW private.netit_carp1_growth100_bridge IS
'NET-IT-CARP1.E4 private, security-invoker, read-only identity/contact reconciliation. No public release and no licence status.';

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
    'all','candidate_seed_aligned','domain_alias_linked','name_reconciliation_needed',
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
      count(*) FILTER(WHERE reconciliation_state='domain_alias_linked')::integer AS alias_linked,
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
    'aligned',stats.aligned,'alias_linked',stats.alias_linked,'name_review',stats.name_review,
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
        'vat_identity_review',coalesce((select c.identity_quality->>'vat_conflict_status' from public.network_company_discovery_candidates c where c.id=p.candidate_id),'not_flagged'),
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
