-- TRADER1D.2 — Explicit superadmin-only bridge to PRIVATE research review.
-- Depends on TRADER1D.1; never publishes, verifies, creates facilities, or opens RFQ.
-- Public-schema RPCs are necessary because private is NOT an exposed Data API schema.
-- Both calls deny all but the single active platform_superadmin inside Postgres.
BEGIN;

CREATE OR REPLACE FUNCTION public.trader1d2_superadmin_queue(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_country text DEFAULT NULL,
  p_research_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_user_roles pur
    WHERE pur.user_id = (SELECT auth.uid())
      AND pur.role = 'platform_superadmin' AND pur.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Superadmin only trader verification' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000
     OR (p_country IS NOT NULL AND p_country NOT IN (
       'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
       'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'
     )) THEN
    RAISE EXCEPTION 'Invalid bounded trader queue request' USING errcode='22023';
  END IF;

  WITH filtered AS (
    SELECT r.* FROM private.netdata1eu_trader_research r
    WHERE p_country IS NULL OR r.target_country_code=p_country
  ), paged AS (
    SELECT * FROM filtered
    ORDER BY CASE WHEN research_state IN ('identity_hold','source_hold') THEN 0 ELSE 1 END,
      target_country_code, lower(display_name),id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'contract','trader1d2-superadmin-v1',
    'scope','private_research_only',
    'total',(SELECT count(*) FROM filtered),
    'limit',p_limit,'offset',p_offset,'country',p_country,
    'items',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',r.id,'name',r.display_name,'market',r.target_country_code,
        'domain',r.domain,'research_state',r.research_state,
        'source_rights',r.source_rights,
        'source_url',r.role_evidence_url,
        'reviews',coalesce((
          SELECT jsonb_object_agg(d.dimension,d.decision)
          FROM (
            SELECT DISTINCT ON (q.dimension) q.dimension,q.decision
            FROM private.netdata1eu_trader_review_decisions q
            WHERE q.trader_research_id=r.id
            ORDER BY q.dimension,q.recorded_at DESC,q.id DESC
          ) d
        ),'{}'::jsonb),
        'domain_collision_count',(
          (SELECT count(*) FROM public.network_companies c
             WHERE c.website_domain=r.domain AND c.archived_at IS NULL)
          +(SELECT count(*) FROM private.netfast_discovered_records x WHERE x.domain=r.domain)
          +(SELECT count(*) FROM public.network_core_target_leads t WHERE t.canonical_domain=r.domain)
          +(SELECT count(*) FROM private.netdata1eu_trader_research peers
             WHERE peers.domain=r.domain AND peers.id<>r.id)
        )
      ) ORDER BY CASE WHEN r.research_state IN ('identity_hold','source_hold')
          THEN 0 ELSE 1 END, r.target_country_code,lower(r.display_name))
      FROM paged r
    ),'[]'::jsonb),
    'selected',(
      SELECT jsonb_build_object(
        'id',r.id,'name',r.display_name,'market',r.target_country_code,
        'legal_name',r.legal_name,'legal_country',r.legal_country_code,
        'legal_identity_evidence_url',r.legal_identity_evidence_url,
        'domain',r.domain,'official_website',r.official_website,
        'role_evidence_url',r.role_evidence_url,
        'product_evidence_url',r.product_evidence_url,
        'product_evidence_summary',r.product_evidence_summary,
        'research_state',r.research_state,'source_rights',r.source_rights,
        'research_note',r.review_note,
        'facilities',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'country',f.country_code,'city',f.city,'type',f.facility_type,
            'source_url',f.evidence_url,'state',f.evidence_state
          ) ORDER BY f.country_code,f.city)
          FROM private.netdata1eu_trader_facility_evidence f
          WHERE f.trader_research_id=r.id
        ),'[]'::jsonb),
        'history',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'dimension',d.dimension,'decision',d.decision,'note',d.review_note,
            'evidence_url',d.evidence_url,'recorded_at',d.recorded_at,
            'legal_name',d.legal_entity_name,'legal_country',d.legal_country_code,
            'permission_basis',d.permission_basis,'permission_scope',d.permission_scope
          ) ORDER BY d.recorded_at DESC,d.id DESC)
          FROM (
            SELECT * FROM private.netdata1eu_trader_review_decisions q
            WHERE q.trader_research_id=r.id
            ORDER BY q.recorded_at DESC,q.id DESC LIMIT 100
          ) d
        ),'[]'::jsonb)
      )
      FROM private.netdata1eu_trader_research r WHERE r.id=p_research_id
    ),
    'published_by_trader1d2',0
  ) INTO v;
  RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public.trader1d2_superadmin_queue(integer,integer,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trader1d2_superadmin_queue(integer,integer,text,uuid)
  TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.trader1d2_record_decision(
  p_research_id uuid,
  p_dimension text,
  p_decision text,
  p_evidence_url text,
  p_note text,
  p_legal_name text DEFAULT NULL,
  p_legal_country text DEFAULT NULL,
  p_permission_basis text DEFAULT NULL,
  p_permission_scope text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_user_roles pur
    WHERE pur.user_id=(SELECT auth.uid())
      AND pur.role='platform_superadmin' AND pur.status='active'
  ) THEN
    RAISE EXCEPTION 'Superadmin only trader verification' USING errcode='42501';
  END IF;

  IF p_research_id IS NULL
    OR p_dimension IS NULL OR p_dimension NOT IN (
      'legal_identity','trader_role','product_evidence',
      'domain_reconciliation','reuse_rights','facility_source')
    OR p_decision IS NULL OR p_decision NOT IN ('accepted','hold','rejected')
    OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 20 AND 800
    OR (p_decision='accepted' AND (p_evidence_url IS NULL
                                  OR btrim(p_evidence_url)=''))
    OR (p_evidence_url IS NOT NULL AND
        (p_evidence_url !~ '^https://[^/?#@[:space:]]+' OR length(p_evidence_url)>500))
    OR (p_dimension='legal_identity' AND p_decision='accepted' AND
        (nullif(btrim(coalesce(p_legal_name,'')),'') IS NULL
         OR nullif(btrim(coalesce(p_legal_country,'')),'') IS NULL))
    OR (p_dimension='reuse_rights' AND p_decision='accepted' AND
        (p_permission_basis IS NULL OR p_permission_scope IS NULL))
    OR (p_dimension<>'legal_identity' AND
        (p_legal_name IS NOT NULL OR p_legal_country IS NOT NULL))
    OR (p_dimension<>'reuse_rights' AND
        (p_permission_basis IS NOT NULL OR p_permission_scope IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid source-backed trader review decision' USING errcode='22023';
  END IF;

  -- The existing table CHECK constraints are the final validation authority.
  -- This INSERT never mutates research_state, source_rights, facilities or Network.
  INSERT INTO private.netdata1eu_trader_review_decisions
    (trader_research_id,dimension,decision,reviewer_id,evidence_url,
     legal_entity_name,legal_country_code,permission_basis,permission_scope,review_note)
  VALUES
    (p_research_id,p_dimension,p_decision,(SELECT auth.uid()),
     nullif(btrim(p_evidence_url),''),nullif(btrim(p_legal_name),''),
     nullif(btrim(p_legal_country),''),
     nullif(btrim(p_permission_basis),''),nullif(btrim(p_permission_scope),''),
     btrim(p_note))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.trader1d2_record_decision(
  uuid,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trader1d2_record_decision(
  uuid,text,text,text,text,text,text,text,text) TO authenticated,service_role;

COMMENT ON FUNCTION public.trader1d2_superadmin_queue(integer,integer,text,uuid)
  IS 'Authenticated platform owner only. Bounded private EU trader research review; no publication.';
COMMENT ON FUNCTION public.trader1d2_record_decision(uuid,text,text,text,text,text,text,text,text)
  IS 'Authenticated platform owner only. Append human source-backed review decision, no public verification.';
COMMIT;
