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
