-- NET-DATA1-EU TRADER1D.1 — human-reviewed evidence ledger and service-only
-- editorial readiness queue. Depends on the FIVE private TRADER1A/B/C research
-- migrations; does not authorize import, publish, crawl, claim or company RFQ.
BEGIN;

CREATE TABLE private.netdata1eu_trader_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_research_id uuid NOT NULL REFERENCES private.netdata1eu_trader_research(id),
  dimension text NOT NULL CHECK (dimension IN (
    'legal_identity','trader_role','product_evidence',
    'domain_reconciliation','reuse_rights','facility_source'
  )),
  decision text NOT NULL CHECK (decision IN ('accepted','hold','rejected')),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  evidence_url text CHECK (
    evidence_url IS NULL OR
    (evidence_url ~ '^https://[^/?#@[:space:]]+' AND length(evidence_url)<=500)
  ),
  -- These are human assertions, NOT automatically filled from research market.
  legal_entity_name text CHECK (legal_entity_name IS NULL OR
    length(legal_entity_name) BETWEEN 3 AND 180),
  legal_country_code text CHECK (legal_country_code IS NULL OR
    legal_country_code IN (
      'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
      'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'
    )),
  permission_basis text CHECK (
    permission_basis IS NULL OR
    permission_basis IN ('written_permission','written_license','open_license')
  ),
  permission_scope text CHECK (
    permission_scope IS NULL OR
    permission_scope IN ('internal_research','network_profile','network_facility')
  ),
  review_note text NOT NULL CHECK (length(review_note) BETWEEN 20 AND 800),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  -- An accepted assessment always needs a directly cited source.
  CONSTRAINT trader1d_accepted_requires_source CHECK (
    decision <> 'accepted' OR evidence_url IS NOT NULL
  ),
  -- Legal name/country require an explicit decision on the legal entity.
  CONSTRAINT trader1d_identity_requires_evidence CHECK (
    dimension <> 'legal_identity' OR decision <> 'accepted' OR
    (legal_entity_name IS NOT NULL AND legal_country_code IS NOT NULL)
  ),
  -- Reuse approval cannot be inferred from a public website. It requires an
  -- explicit rights basis and scope (commercial-facing or internal only).
  CONSTRAINT trader1d_rights_require_permission CHECK (
    dimension <> 'reuse_rights' OR decision <> 'accepted' OR
    (permission_basis IS NOT NULL AND permission_scope IS NOT NULL)
  ),
  CONSTRAINT trader1d_rights_fields_scoped CHECK (
    dimension='reuse_rights' OR
    (permission_basis IS NULL AND permission_scope IS NULL)
  ),
  CONSTRAINT trader1d_identity_fields_scoped CHECK (
    dimension='legal_identity' OR
    (legal_entity_name IS NULL AND legal_country_code IS NULL)
  )
);
CREATE INDEX netdata1eu_trader_review_latest_idx ON
  private.netdata1eu_trader_review_decisions
  (trader_research_id,dimension,recorded_at DESC,id DESC);
ALTER TABLE private.netdata1eu_trader_review_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netdata1eu_trader_review_decisions
  FROM public,anon,authenticated;
-- Review history is append-only. No direct UPDATE/DELETE permissions.
GRANT SELECT,INSERT ON private.netdata1eu_trader_review_decisions TO service_role;

CREATE OR REPLACE FUNCTION private.netdata1eu_trader_review_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $function$
BEGIN
  RAISE EXCEPTION 'Trader review history is append-only' USING errcode='42501';
END;
$function$;
REVOKE ALL ON FUNCTION private.netdata1eu_trader_review_immutable()
  FROM public,anon,authenticated;
CREATE TRIGGER trader_review_append_only
  BEFORE UPDATE OR DELETE ON private.netdata1eu_trader_review_decisions
  FOR EACH ROW EXECUTE FUNCTION private.netdata1eu_trader_review_immutable();

-- This function is a private service-only review REPORT, not a publication RPC.
-- Every approval is recorded by a human; no approvals are seeded by this
-- migration. A ready candidate still requires a later platform publication
-- decision outside this function.
CREATE OR REPLACE FUNCTION private.netdata1eu_trader_review_queue(
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0,
  p_country text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v_payload jsonb;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service-only European trader review' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000
    OR (p_country IS NOT NULL AND p_country NOT IN
      ('AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
       'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK')) THEN
    RAISE EXCEPTION 'Invalid bounded European trader review query'
      USING errcode='22023';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (d.trader_research_id,d.dimension)
      d.trader_research_id,d.dimension,d.decision,d.permission_scope
    FROM private.netdata1eu_trader_review_decisions d
    ORDER BY d.trader_research_id,d.dimension,d.recorded_at DESC,d.id DESC
  ), candidates AS (
    SELECT r.*,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='legal_identity') identity_decision,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='trader_role') role_decision,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='product_evidence') product_decision,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='domain_reconciliation') domain_decision,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='reuse_rights') rights_decision,
      (SELECT l.permission_scope FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='reuse_rights') rights_scope,
      (SELECT l.decision FROM latest l WHERE l.trader_research_id=r.id
        AND l.dimension='facility_source') facility_decision,
      (SELECT count(*)::integer FROM public.network_companies c
        WHERE c.website_domain=r.domain AND c.archived_at IS NULL) canonical_hits,
      (SELECT count(*)::integer FROM private.netfast_discovered_records v
        WHERE v.domain=r.domain) discovered_hits,
      (SELECT count(*)::integer FROM public.network_core_target_leads t
        WHERE t.canonical_domain=r.domain) lead_hits,
      (SELECT count(*)::integer FROM private.netdata1eu_trader_research peer
        WHERE peer.domain=r.domain AND peer.id<>r.id) peer_hits,
      (SELECT count(*)::integer FROM private.netdata1eu_trader_facility_evidence f
        WHERE f.trader_research_id=r.id) observed_facilities
    FROM private.netdata1eu_trader_research r
    WHERE p_country IS NULL OR r.target_country_code=p_country
  ), scored AS (
    SELECT c.*,
      -- A positive record means evidence is ready for PLATFORM editorial
      -- inspection, NOT a legally verified/public company.
      (c.identity_decision='accepted'
       AND c.role_decision='accepted'
       AND c.product_decision='accepted'
       AND c.domain_decision='accepted'
       AND c.rights_decision='accepted'
       AND c.rights_scope IN ('network_profile','network_facility')
       AND c.source_rights='license_approved'
       AND c.legal_name IS NOT NULL AND c.legal_country_code IS NOT NULL
       AND c.legal_identity_evidence_url IS NOT NULL
       AND c.research_state='ready_for_review') AS editorial_evidence_ready,
      array_remove(ARRAY[
        CASE WHEN c.identity_decision IS DISTINCT FROM 'accepted'
          THEN 'legal_identity_review' END,
        CASE WHEN c.legal_name IS NULL OR c.legal_country_code IS NULL OR
                  c.legal_identity_evidence_url IS NULL
          THEN 'legal_entity_fields_missing' END,
        CASE WHEN c.role_decision IS DISTINCT FROM 'accepted'
          THEN 'trader_role_review' END,
        CASE WHEN c.product_decision IS DISTINCT FROM 'accepted'
          THEN 'product_evidence_review' END,
        CASE WHEN c.domain_decision IS DISTINCT FROM 'accepted'
          THEN 'domain_reconciliation_review' END,
        CASE WHEN c.rights_decision IS DISTINCT FROM 'accepted' OR
                  c.rights_scope NOT IN ('network_profile','network_facility') OR
                  c.rights_scope IS NULL OR c.source_rights<>'license_approved'
          THEN 'source_reuse_rights_review' END,
        CASE WHEN c.research_state IN ('identity_hold','source_hold')
          THEN 'explicit_research_hold' END,
        CASE WHEN c.canonical_hits+c.discovered_hits+c.lead_hits+c.peer_hits>0
          AND c.domain_decision IS DISTINCT FROM 'accepted'
          THEN 'shared_domain_identity_hold' END
      ]::text[],NULL) AS blockers
    FROM candidates c
  ), page AS (
    SELECT * FROM scored
    ORDER BY CASE WHEN research_state IN ('identity_hold','source_hold') THEN 0 ELSE 1 END,
      CASE WHEN canonical_hits+discovered_hits+lead_hits+peer_hits>0 THEN 0 ELSE 1 END,
      target_country_code,lower(display_name),id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'contract','netdata1eu-trader-review-v1',
    'scope','private_research_only',
    'total',(SELECT count(*) FROM scored),
    'editorial_evidence_ready',(SELECT count(*) FROM scored
      WHERE editorial_evidence_ready),
    'needs_identity_review',(SELECT count(*) FROM scored
      WHERE identity_decision IS DISTINCT FROM 'accepted'),
    'needs_rights_review',(SELECT count(*) FROM scored
      WHERE rights_decision IS DISTINCT FROM 'accepted' OR
        source_rights<>'license_approved'),
    'with_domain_collision',(SELECT count(*) FROM scored
      WHERE canonical_hits+discovered_hits+lead_hits+peer_hits>0),
    'observed_location_count',(SELECT coalesce(sum(observed_facilities),0) FROM scored),
    'published_by_trader1d',0,
    'limit',p_limit,'offset',p_offset,'country',p_country,
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'research_id',p.id,'name',p.display_name,'research_market',p.target_country_code,
      'domain',p.domain,'status',p.research_state,
      'source_rights',p.source_rights,
      'identity_review',p.identity_decision,'trader_role_review',p.role_decision,
      'product_review',p.product_decision,'dedup_review',p.domain_decision,
      'rights_review',p.rights_decision,'rights_scope',p.rights_scope,
      'facility_review',p.facility_decision,
      'canonical_hits',p.canonical_hits,'discovered_hits',p.discovered_hits,
      'lead_hits',p.lead_hits,'research_peer_hits',p.peer_hits,
      'location_observations',p.observed_facilities,
      'editorial_evidence_ready',p.editorial_evidence_ready,
      'blockers',p.blockers,
      'source_url',p.role_evidence_url
    ) ORDER BY CASE WHEN p.research_state IN ('identity_hold','source_hold')
      THEN 0 ELSE 1 END,lower(p.display_name)) FROM page p),'[]'::jsonb)
  ) INTO v_payload;
  RETURN v_payload;
END;
$function$;
REVOKE ALL ON FUNCTION private.netdata1eu_trader_review_queue(integer,integer,text)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.netdata1eu_trader_review_queue(integer,integer,text)
  TO service_role;

COMMENT ON TABLE private.netdata1eu_trader_review_decisions IS
 'TRADER1D append-only manual review evidence. No crawler, license inference, auto verification or public publication.';
COMMENT ON FUNCTION private.netdata1eu_trader_review_queue(integer,integer,text) IS
 'Service-only bounded human review queue. Evidence-ready status is NOT public, verified or RFQ-eligible.';
COMMIT;
