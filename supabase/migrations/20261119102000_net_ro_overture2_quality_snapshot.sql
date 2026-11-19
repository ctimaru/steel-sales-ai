-- RO-OVERTURE2: one compact, reproducible view of the Overture -> AUTO2 funnel.
-- Service-only readout; zero publication, zero privilege widening.
CREATE OR REPLACE FUNCTION private.net_ro_overture2_quality_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
WITH latest AS (
  SELECT DISTINCT ON (l.canonical_domain) l.*
  FROM private.net_ro_overture_leads l
  ORDER BY l.canonical_domain,l.dataset_release DESC
), cohort AS (
  SELECT l.canonical_domain,l.state,
    CASE WHEN l.observed_lat < 45.8 THEN 'south-' ELSE 'north-' END ||
    CASE WHEN l.observed_lon < 22.5 THEN '0'
         WHEN l.observed_lon < 25.0 THEN '1'
         WHEN l.observed_lon < 27.5 THEN '2'
         ELSE '3' END AS tile,
    s.source_kind,s.id AS seed_id,e.verdict,e.identity_checked,
    e.role_checked,e.romania_checked,e.published,
    EXISTS(
      SELECT 1 FROM public.network_companies c
      WHERE c.country_code='RO' AND c.archived_at IS NULL
        AND c.publication_status='published'
        AND c.website_domain=l.canonical_domain
    ) AS in_public_network
  FROM latest l
  LEFT JOIN private.network_web_research_seeds s
    ON s.country_code='RO' AND s.canonical_domain=l.canonical_domain
  LEFT JOIN private.net_ro1_domain_verification_evidence e
    ON e.seed_id=s.id
)
SELECT pg_catalog.jsonb_build_object(
  'contract','net-ro-overture2-snapshot-v1',
  'captured_at',pg_catalog.now(),
  'total_published_ro',(
    SELECT count(*) FROM public.network_companies c
    WHERE c.country_code='RO'
      AND c.publication_status='published'
      AND c.archived_at IS NULL
  ),
  'overture_distinct_domains',(SELECT count(*) FROM cohort),
  'overture_published',(SELECT count(*) FROM cohort WHERE published),
  'overture_already_published_legacy',(SELECT count(*) FROM cohort
    WHERE in_public_network AND published IS DISTINCT FROM true),
  'firstparty_upgraded',(SELECT count(*) FROM cohort
    WHERE source_kind='first_party_web'),
  'firstparty_identity_role_country',(SELECT count(*) FROM cohort
    WHERE source_kind='first_party_web' AND coalesce(identity_checked,false)
      AND coalesce(role_checked,false) AND coalesce(romania_checked,false)),
  'assessed',(SELECT count(*) FROM cohort WHERE verdict IS NOT NULL),
  'false_positive_scope',(SELECT count(*) FROM cohort WHERE verdict='scope_mismatch'),
  'duplicate_possible',(SELECT count(*) FROM cohort WHERE verdict='duplicate_possible'),
  'unassessed',(SELECT count(*) FROM cohort WHERE verdict IS NULL AND NOT in_public_network),
  'search_tiles',(SELECT coalesce(pg_catalog.jsonb_object_agg(tile,cnt),'{}'::jsonb)
      FROM (SELECT tile,count(*) AS cnt FROM cohort GROUP BY tile ORDER BY tile) g)
);
$fn$;
REVOKE ALL ON FUNCTION private.net_ro_overture2_quality_snapshot()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_ro_overture2_quality_snapshot()
  TO service_role;
COMMENT ON FUNCTION private.net_ro_overture2_quality_snapshot() IS
 'Service-only observable Romania Overture pipeline funnel, distinct domains and 8 discovery tiles; never authorizes publication.';
