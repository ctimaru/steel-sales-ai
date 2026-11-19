-- NET-RO-OVERTURE1: bridge private Overture hints to existing RO AUTO2.
-- Never infer first-party verification from a website URL supplied by Overture.
-- Read-only and service-only. No human sign-off per candidate is required;
-- automated research can upgrade the original seed after verifying the site.
CREATE OR REPLACE FUNCTION private.net_ro_overture1_firstparty_queue(
  p_max integer DEFAULT 15
) RETURNS TABLE (
  seed_id uuid,
  canonical_domain text,
  overture_gers_id uuid,
  observed_place_label text,
  proposed_role text,
  website_url text,
  place_category text,
  dataset_release text
)
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $fn$
  SELECT s.id, s.canonical_domain, l.gers_id, l.place_label,
         s.proposed_role, l.website_url, l.place_category,l.dataset_release
  FROM private.network_web_research_seeds s
  JOIN LATERAL (
    SELECT l.*
    FROM private.net_ro_overture_leads l
    WHERE l.canonical_domain=s.canonical_domain
      AND l.state='needs_first_party'
    ORDER BY l.dataset_release DESC
    LIMIT 1
  ) l ON true
  WHERE s.country_code='RO'
    AND s.source_kind='overture_places'
    AND s.publication_status='not_published'
    AND s.claim_status='unclaimed'
    AND s.verification_status='web_sourced_unverified'
    AND NOT EXISTS (
      SELECT 1 FROM public.network_companies c
      WHERE c.country_code='RO' AND c.archived_at IS NULL
        AND c.website_domain=s.canonical_domain
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.network_netfast3_suppressed_domains d
      WHERE d.domain=s.canonical_domain
    )
    AND NOT EXISTS(
      SELECT 1 FROM private.net_ro1_domain_verification_evidence e
      WHERE e.seed_id=s.id
    )
  ORDER BY CASE s.proposed_role
    WHEN 'producer' THEN 0
    WHEN 'processor_service_provider' THEN 1
    WHEN 'trader_distributor' THEN 2
    ELSE 3 END,s.first_seen_at,s.canonical_domain
  LIMIT greatest(1,least(coalesce(p_max,15),50));
$fn$;
REVOKE ALL ON FUNCTION private.net_ro_overture1_firstparty_queue(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_ro_overture1_firstparty_queue(integer)
  TO service_role;
COMMENT ON FUNCTION private.net_ro_overture1_firstparty_queue(integer) IS
 'Overture Romania leads awaiting independent first-party company identity evidence. Never publishes or elevates permissions.';
