-- NET-IT-CARP1.E.8.C — Platform-only, read-only unified D+E8 private cohort snapshot.
-- Does not publish companies, alter candidate state, or grant public access to contacts.
-- Requires existing Platform RBAC and the E7 research-alias metadata.
CREATE OR REPLACE FUNCTION private.netit_carp1_e8_admin_snapshot_impl(
 p_cohort text DEFAULT 'all', p_state text DEFAULT 'all',
 p_query text DEFAULT '', p_province text DEFAULT '',
 p_limit integer DEFAULT 40, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $netit_e8c$
DECLARE
 v_result jsonb;
 v_cohort text := pg_catalog.btrim(coalesce(p_cohort,'all'));
 v_state text := pg_catalog.btrim(coalesce(p_state,'all'));
 v_query text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query,'')));
 v_province text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_province,'')));
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Platform authentication required' USING ERRCODE='42501';
 END IF;
 PERFORM private.require_platform_permission('discovery.read');
 PERFORM private.require_platform_permission('discovery.governance_review');
 PERFORM private.require_platform_permission('network.privacy_governance_review');
 IF v_cohort NOT IN ('all','Growth100','E8A','E8B','E8C')
 OR v_state NOT IN (
   'all','needs_contact','research_seed_missing','candidate_seed_aligned',
   'domain_alias_linked','name_reconciliation_needed','canonical_collision',
   'location_to_verify'
 ) OR pg_catalog.char_length(v_query)>80
 OR (v_province<>'' AND v_province !~ '^[A-Z]{2}$')
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Invalid E8C private cockpit filters/pagination'
  USING ERRCODE='22023';
 END IF;
 WITH c0 AS MATERIALIZED (
   SELECT c.id AS candidate_id,c.canonical_domain AS domain,
   c.legal_name AS candidate_name,c.vat_id,
   c.review_status,c.governance_status,c.quality_flags,
   c.identity_quality,c.enrichment_quality,c.facility_candidates,
   c.source_url AS company_source_url,c.updated_at,
   CASE
     WHEN r.source_reference LIKE 'NET-IT-CARP1.D.%' THEN 'Growth100'
     WHEN r.source_reference LIKE 'NET-IT-CARP1.E.8.A%' THEN 'E8A'
     WHEN r.source_reference LIKE 'NET-IT-CARP1.E.8.B%' THEN 'E8B'
     WHEN r.source_reference LIKE 'NET-IT-CARP1.E.8.C%' THEN 'E8C'
   END AS cohort,
   coalesce(
    c.enrichment_quality->'official_contact_20261108'->>'email',
    c.enrichment_quality->'official_contact_20261109'->>'email',
    c.enrichment_quality->'cohort_intake_e8c'->>'email'
   ) AS email,
   coalesce(
    c.enrichment_quality->'official_contact_20261108'->>'phone',
    c.enrichment_quality->'official_contact_20261109'->>'phone',
    c.enrichment_quality->'cohort_intake_e8c'->>'phone'
   ) AS phone,
   coalesce(
    c.enrichment_quality->'official_contact_20261108'->>'source_url',
    c.enrichment_quality->'official_contact_20261109'->>'source_url',
    c.enrichment_quality->'cohort_intake_e8c'->>'source_url',
    c.source_url
   ) AS contact_source_url,
   coalesce(
    c.enrichment_quality->'official_contact_20261108'->'industrial_capabilities_observed',
    c.enrichment_quality->'official_contact_20261109'->'industrial_capabilities_observed',
    c.enrichment_quality->'cohort_intake_e8c'->'industrial_capabilities_observed',
    '[]'::jsonb
   ) AS observed_capabilities,
   coalesce(
    c.enrichment_quality->'official_contact_20261108'->>'source_kind',
    c.enrichment_quality->'official_contact_20261109'->>'source_kind',
    c.enrichment_quality->'cohort_intake_e8c'->>'source_kind',
    c.identity_quality->>'source_kind',
    'company_source_unclassified'
   ) AS source_kind,
   c.facility_candidates->0->>'region' AS region,
   c.facility_candidates->0->>'province_code' AS province,
   CASE WHEN 'province_area_to_verify'=ANY(c.quality_flags)
     THEN 'research_area_to_verify'
     ELSE coalesce(c.facility_candidates->0->>'site_kind','source_reported')
   END AS location_quality,
   s.id AS research_seed_id,
   s.display_name AS research_seed_name,
   nc.id AS canonical_id
   FROM public.network_company_discovery_candidates c
   JOIN public.network_company_discovery_runs r ON r.id=c.run_id
   LEFT JOIN LATERAL (
     SELECT s1.id,s1.display_name
     FROM private.network_web_research_seeds s1
     WHERE s1.country_code='IT' AND s1.canonical_domain=c.canonical_domain
     ORDER BY s1.first_seen_at DESC NULLS LAST,s1.id
     LIMIT 1
   ) s ON true
   LEFT JOIN LATERAL (
     SELECT n.id
     FROM public.network_companies n
     WHERE n.country_code='IT'
      AND (
       pg_catalog.regexp_replace(pg_catalog.lower(coalesce(n.website_domain,'')),
          '^www[.]','','i')=c.canonical_domain
       OR (c.vat_id IS NOT NULL AND pg_catalog.regexp_replace(coalesce(n.vat_id,''),
           '[^0-9]','','g')=pg_catalog.regexp_replace(c.vat_id,'[^0-9]','','g'))
      )
     ORDER BY n.created_at DESC NULLS LAST,n.id LIMIT 1
   ) nc ON true
   WHERE c.country_code='IT'
    AND (r.source_reference LIKE 'NET-IT-CARP1.D.%'
      OR r.source_reference LIKE 'NET-IT-CARP1.E.8.%')
 ),
 classified AS MATERIALIZED (
 SELECT c.*,
  (c.email IS NOT NULL OR c.phone IS NOT NULL) AS has_contact,
  CASE
   WHEN c.canonical_id IS NOT NULL THEN 'canonical_collision'
   WHEN c.research_seed_id IS NULL THEN 'research_seed_missing'
   WHEN c.enrichment_quality->'identity_link_e7'->>'status'='exact_domain_alias_linked'
     AND c.enrichment_quality->'identity_link_e7'->>'linked_research_seed_id'=c.research_seed_id::text
     THEN 'domain_alias_linked'
   WHEN pg_catalog.regexp_replace(pg_catalog.lower(coalesce(c.research_seed_name,'')),
     '[^a-z0-9]','','g') <>
     pg_catalog.regexp_replace(pg_catalog.lower(coalesce(c.candidate_name,'')),
     '[^a-z0-9]','','g')
    THEN 'name_reconciliation_needed'
   ELSE 'candidate_seed_aligned'
  END AS reconciliation_state
 FROM c0 c
 ),
 stats AS (
 SELECT count(*)::integer total,
 count(distinct domain)::integer unique_domains,
 count(*) FILTER(WHERE cohort='Growth100')::integer growth100,
 count(*) FILTER(WHERE cohort='E8A')::integer e8a,
 count(*) FILTER(WHERE cohort='E8B')::integer e8b,
 count(*) FILTER(WHERE cohort='E8C')::integer e8c,
 count(*) FILTER(WHERE has_contact)::integer with_contact,
 count(*) FILTER(WHERE email IS NOT NULL)::integer email_count,
 count(*) FILTER(WHERE phone IS NOT NULL)::integer phone_count,
 count(*) FILTER(WHERE NOT has_contact)::integer needs_contact,
 count(*) FILTER(WHERE reconciliation_state='candidate_seed_aligned')::integer aligned,
 count(*) FILTER(WHERE reconciliation_state='domain_alias_linked')::integer alias_linked,
 count(*) FILTER(WHERE reconciliation_state='name_reconciliation_needed')::integer name_review,
 count(*) FILTER(WHERE reconciliation_state='research_seed_missing')::integer candidate_first,
 count(*) FILTER(WHERE reconciliation_state='canonical_collision')::integer collision,
 count(*) FILTER(WHERE location_quality='research_area_to_verify')::integer province_to_verify,
 count(distinct province)::integer provinces
 FROM classified
 ),
 filtered AS (
 SELECT * FROM classified c
 WHERE (v_cohort='all' OR c.cohort=v_cohort)
  AND (
    v_state='all' OR
    (v_state='needs_contact' AND NOT c.has_contact) OR
    (v_state='location_to_verify' AND c.location_quality='research_area_to_verify') OR
    c.reconciliation_state=v_state
  )
  AND (v_province='' OR c.province=v_province)
  AND (v_query='' OR pg_catalog.strpos(pg_catalog.lower(c.candidate_name),v_query)>0
    OR pg_catalog.strpos(pg_catalog.lower(c.domain),v_query)>0
    OR pg_catalog.strpos(pg_catalog.lower(coalesce(c.province,'')),v_query)>0)
 ),
 page AS (
  SELECT * FROM filtered
  ORDER BY has_contact ASC,cohort DESC,region,province,domain,candidate_id
  LIMIT p_limit OFFSET p_offset
 )
 SELECT pg_catalog.jsonb_build_object(
  'contract','net-it-carp1-e8c-unified-admin-v1',
  'total',stats.total,'unique_domains',stats.unique_domains,
  'growth100',stats.growth100,'e8a',stats.e8a,'e8b',stats.e8b,'e8c',stats.e8c,
  'with_contact',stats.with_contact,'email_count',stats.email_count,
  'phone_count',stats.phone_count,'needs_contact',stats.needs_contact,
  'aligned',stats.aligned,'alias_linked',stats.alias_linked,
  'name_review',stats.name_review,'candidate_first',stats.candidate_first,
  'collision',stats.collision,'province_to_verify',stats.province_to_verify,
  'provinces',stats.provinces,
  'selected_total',(SELECT count(*) FROM filtered),
  'items',(SELECT coalesce(pg_catalog.jsonb_agg(
     pg_catalog.jsonb_build_object(
      'candidate_id',p.candidate_id,'name',p.candidate_name,'domain',p.domain,
      'cohort',p.cohort,'region',p.region,'province',p.province,
      'location_quality',p.location_quality,
      'source_kind',p.source_kind,'company_source_url',p.company_source_url,
      'contact_source_url',p.contact_source_url,
      'research_seed_name',p.research_seed_name,
      'reconciliation_state',p.reconciliation_state,
      'vat_identity_review',coalesce(p.identity_quality->>'vat_conflict_status','not_flagged'),
      'vat_id',p.vat_id,'has_contact',p.has_contact,'email',p.email,
      'phone',p.phone,'observed_capabilities',p.observed_capabilities,
      'review_status',p.review_status,'governance_status',p.governance_status,
      'updated_at',p.updated_at
     ) ORDER BY p.has_contact ASC,p.cohort DESC,p.domain
   ),'[]'::jsonb) FROM page p),
  'publications_performed',0
 ) INTO v_result FROM stats;
 RETURN v_result;
END;
$netit_e8c$;

REVOKE ALL ON FUNCTION private.netit_carp1_e8_admin_snapshot_impl(
 text,text,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.netit_carp1_e8_admin_snapshot_impl(
 text,text,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.netit_carp1_e8_admin_snapshot(
 p_cohort text DEFAULT 'all', p_state text DEFAULT 'all',
 p_query text DEFAULT '',p_province text DEFAULT '',
 p_limit integer DEFAULT 40,p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $netit_e8c_wrapper$
 SELECT private.netit_carp1_e8_admin_snapshot_impl(
  p_cohort,p_state,p_query,p_province,p_limit,p_offset);
$netit_e8c_wrapper$;
REVOKE ALL ON FUNCTION public.netit_carp1_e8_admin_snapshot(
 text,text,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.netit_carp1_e8_admin_snapshot(
 text,text,text,text,integer,integer) TO authenticated;
COMMENT ON FUNCTION public.netit_carp1_e8_admin_snapshot(
 text,text,text,text,integer,integer)
 IS 'NET-IT E8C: owner-only paginated unified private cohort readback; no publication';