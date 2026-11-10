-- NET-IT-PUB1: exact first-five review queue; read-only, permission-gated.
-- No source or company is approved by installing this migration.
-- Only Platform reviewers can see the selected first-party evidence.
CREATE OR REPLACE FUNCTION private.net_it_pub1_review_queue_impl()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $net_it_pub1$
DECLARE
  v_items jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authenticated Platform reviewer required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.require_platform_permission('discovery.governance_review');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'candidate_id', c.id,
        'run_id', r.id,
        'run_label', r.label,
        'run_source_reference', r.source_reference,
        'run_total_candidates', (
          SELECT count(*) FROM public.network_company_discovery_candidates rc
          WHERE rc.run_id = r.id
        ),
        'source_status', r.governance_status,
        'terms_status', r.terms_status,
        'database_rights_status', r.database_rights_status,
        'personal_data_policy', r.personal_data_policy,
        'candidate_status', c.governance_status,
        'review_status', c.review_status,
        'personal_data_detected', c.personal_data_detected,
        'personal_data_fields', to_jsonb(c.personal_data_fields),
        'quality_flags', to_jsonb(c.quality_flags),
        'canonical_domain', c.canonical_domain,
        'private_legal_name', c.legal_name,
        'proposed_public_name', c.enrichment_quality #>> '{net_it_pub1_20261110,public_name_observed}',
        'identity_source', COALESCE(
          c.enrichment_quality #>> '{net_it_pub1_official_identity_evidence_20261110,first_party_identity_url}',
          c.enrichment_quality #>> '{net_it_pub1_20261110,identity_source}'
        ),
        'activity_source', COALESCE(
          c.enrichment_quality #>> '{net_it_pub1_official_identity_evidence_20261110,activity_evidence_url}',
          c.enrichment_quality #>> '{net_it_pub1_20261110,activity_source}'
        ),
        'first_party_name_observed',
          c.enrichment_quality #>> '{net_it_pub1_official_identity_evidence_20261110,company_name_on_first_party}',
        'locality_unverified', c.enrichment_quality #>> '{net_it_pub1_20261110,locality_observed_unverified}',
        'source_rights_not_attested', COALESCE(
          (c.enrichment_quality #>> '{net_it_pub1_20261110,source_rights_not_attested}')::boolean,
          true
        ),
        'publisher_eligibility_reason', private.net_pipeline1b2_eligibility(c.id) ->> 'reason',
        'already_published', c.promoted_company_id IS NOT NULL,
        'canonical_collision', EXISTS (
          SELECT 1 FROM public.network_companies nc
          WHERE nc.website_domain = c.canonical_domain
             OR (c.vat_id IS NOT NULL AND nc.vat_id = c.vat_id)
        )
      )
      ORDER BY c.canonical_domain
    ), '[]'::jsonb
  ) INTO v_items
  FROM public.network_company_discovery_candidates c
  JOIN private.netit_carp1_growth100_bridge b ON b.candidate_id = c.id
  JOIN public.network_company_discovery_runs r ON r.id = c.run_id
  WHERE c.country_code = 'IT'
    AND c.canonical_domain = ANY (ARRAY[
      'carpenteriamfn.it', 'csmetalmeccanica.com', 'guazzifratelli.it',
      'ntcgroupitalia.com', 'carpenteriacosta.com'
    ]::text[])
    AND c.enrichment_quality ? 'net_it_pub1_20261110';

  RETURN jsonb_build_object(
    'contract', 'net-it-pub1-review-v1',
    'items', v_items
  );
END;
$net_it_pub1$;

-- The privileged reader stays private. The public API is SECURITY INVOKER,
-- matching the Platform HP13 inventory and the existing guarded RPC pattern.
REVOKE ALL ON FUNCTION private.net_it_pub1_review_queue_impl() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.net_it_pub1_review_queue_impl() TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_pub1_review_queue()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $net_it_pub1_facade$
  SELECT private.net_it_pub1_review_queue_impl();
$net_it_pub1_facade$;

REVOKE ALL ON FUNCTION public.net_it_pub1_review_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.net_it_pub1_review_queue() TO authenticated;
