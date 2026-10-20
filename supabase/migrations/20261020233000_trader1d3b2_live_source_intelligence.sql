-- TRADER1D.3B.2 — live first-party source metadata; no publication or rights inference.
-- Activation is BLOCKED until approved migration-history reconciliation (#780).
BEGIN;

CREATE TABLE private.trader1d3b2_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES private.netdata1eu_trader_research(id),
  source_kind text NOT NULL CHECK (source_kind IN ('role_evidence','product_evidence')),
  source_url text NOT NULL CHECK (
    length(source_url) BETWEEN 12 AND 500
    AND source_url ~ '^https://[^/?#@[:space:]]+'
  ),
  source_domain text NOT NULL CHECK (source_domain ~ '^[a-z0-9][a-z0-9.-]{2,180}$'),
  observation_date date NOT NULL,
  checked_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN (
    'reachable_html','reachable_unknown_type','redirect_observed',
    'not_found','access_denied','rate_limited','server_error',
    'method_not_supported','robots_or_unavailable','network_error','http_other'
  )),
  http_status integer CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  content_type text CHECK (content_type IS NULL OR length(content_type) BETWEEN 1 AND 80),
  metadata_fingerprint text CHECK (metadata_fingerprint IS NULL
    OR metadata_fingerprint ~ '^[a-f0-9]{64}$'),
  change_kind text NOT NULL CHECK (change_kind IN (
    'first_observation','unchanged','changed','unavailable'
  )),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(research_id,source_kind,observation_date),
  CHECK (observation_date = (checked_at AT TIME ZONE 'UTC')::date)
);
CREATE INDEX trader1d3b2_source_latest_idx ON
  private.trader1d3b2_source_observations
  (research_id,source_kind,checked_at DESC);

ALTER TABLE private.trader1d3b2_source_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trader1d3b2_source_observations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON private.trader1d3b2_source_observations TO service_role;

CREATE OR REPLACE FUNCTION private.trader1d3b2_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
  RAISE EXCEPTION 'Source observations are immutable' USING errcode='42501';
END;
$$;
REVOKE ALL ON FUNCTION private.trader1d3b2_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trader1d3b2_no_rewrite
BEFORE UPDATE OR DELETE ON private.trader1d3b2_source_observations
FOR EACH ROW EXECUTE FUNCTION private.trader1d3b2_immutable();

-- Service-only: pulls *live* current URLs. Unlike the snapshot, newly inserted
-- or edited private research automatically enters the paged worker feed.
CREATE OR REPLACE FUNCTION public.trader1d3b2_source_batch(
  p_limit integer DEFAULT 5, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service worker only' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Source refresh batch out of bounds' USING errcode='22023';
  END IF;
  WITH sources AS (
    SELECT r.id research_id,r.domain,r.target_country_code market,
       'role_evidence'::text source_kind,r.role_evidence_url source_url
    FROM private.netdata1eu_trader_research r
    WHERE lower(regexp_replace(split_part(r.role_evidence_url,'/',3),'^www[.]',''))=r.domain
    UNION ALL
    SELECT r.id,r.domain,r.target_country_code,'product_evidence',r.product_evidence_url
    FROM private.netdata1eu_trader_research r
    WHERE r.product_evidence_url IS NOT NULL
      AND r.product_evidence_url IS DISTINCT FROM r.role_evidence_url
      AND lower(regexp_replace(split_part(r.product_evidence_url,'/',3),'^www[.]',''))=r.domain
  ), page AS (
    SELECT * FROM sources ORDER BY domain,research_id,source_kind LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'contract','trader1d3b2-source-batch-v1',
    'total',(SELECT count(*) FROM sources),
    'limit',p_limit,'offset',p_offset,
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'research_id',p.research_id,'domain',p.domain,'market',p.market,
      'source_kind',p.source_kind,'source_url',p.source_url,
      'latest',(
        SELECT jsonb_build_object('status',o.status,'checked_at',o.checked_at,
          'fingerprint',o.metadata_fingerprint,'change',o.change_kind)
        FROM private.trader1d3b2_source_observations o
        WHERE o.research_id=p.research_id AND o.source_kind=p.source_kind
          AND o.source_url=p.source_url
        ORDER BY o.checked_at DESC,o.id DESC LIMIT 1
      )
    ) ORDER BY p.domain,p.research_id,p.source_kind) FROM page p),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.trader1d3b2_source_batch(integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trader1d3b2_source_batch(integer,integer)
  TO service_role;

-- Store each bounded read-only HTTP probe as an immutable, idempotent event.
-- No caller can write arbitrary URLs: DB rechecks research UUID, kind, URL, host.
CREATE OR REPLACE FUNCTION public.trader1d3b2_commit_observations(
  p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $$
DECLARE
  v_item jsonb; v_id uuid; v_kind text; v_url text;
  v_domain text; v_expected text; v_status text;
  v_time timestamptz; v_http integer; v_type text; v_fp text;
  v_previous text; v_change text;
  v_written integer := 0; v_duplicate integer := 0; v_affected integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service worker only' USING errcode='42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid source observation batch' USING errcode='22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS e(value)
  LOOP
    IF jsonb_typeof(v_item)<>'object' THEN
      RAISE EXCEPTION 'Invalid observation object' USING errcode='22023';
    END IF;
    v_id := (v_item->>'research_id')::uuid;
    v_kind := v_item->>'source_kind';
    v_url := v_item->>'source_url';
    v_status := v_item->>'status';
    v_time := (v_item->>'checked_at')::timestamptz;
    v_http := (v_item->>'http_status')::integer;
    v_type := nullif(v_item->>'content_type','');
    v_fp := nullif(v_item->>'fingerprint','');
    IF v_id IS NULL OR v_kind IS NULL OR v_kind NOT IN
        ('role_evidence','product_evidence')
      OR v_url IS NULL OR length(v_url)>500
      OR v_status IS NULL OR v_status NOT IN (
        'reachable_html','reachable_unknown_type','redirect_observed',
        'not_found','access_denied','rate_limited','server_error',
        'method_not_supported','robots_or_unavailable','network_error','http_other')
      OR v_time IS NULL OR v_time < now()-interval '24 hours'
      OR v_time > now()+interval '5 minutes'
      OR (v_http IS NOT NULL AND v_http NOT BETWEEN 100 AND 599)
      OR (v_type IS NOT NULL AND length(v_type)>80)
      OR (v_fp IS NOT NULL AND v_fp !~ '^[a-f0-9]{64}$')
      OR (v_fp IS NULL AND v_status NOT IN ('robots_or_unavailable','network_error'))
      OR (v_fp IS NOT NULL AND v_status IN ('robots_or_unavailable','network_error'))
      THEN
      RAISE EXCEPTION 'Invalid or stale source observation' USING errcode='22023';
    END IF;

    SELECT r.domain,
      CASE WHEN v_kind='role_evidence' THEN r.role_evidence_url
           ELSE r.product_evidence_url END
    INTO v_domain,v_expected
    FROM private.netdata1eu_trader_research r WHERE r.id=v_id;
    IF v_domain IS NULL OR v_expected IS NULL OR v_url<>v_expected
      OR lower(regexp_replace(split_part(v_url,'/',3),'^www[.]',''))<>v_domain
      OR v_url !~ '^https://[^/?#@[:space:]]+' THEN
      RAISE EXCEPTION 'Source URL not bound to current research record'
        USING errcode='22023';
    END IF;

    v_previous := NULL;
    SELECT o.metadata_fingerprint INTO v_previous
      FROM private.trader1d3b2_source_observations o
      WHERE o.research_id=v_id AND o.source_kind=v_kind
        AND o.source_url=v_url AND o.metadata_fingerprint IS NOT NULL
      ORDER BY o.checked_at DESC,o.id DESC LIMIT 1;
    v_change := CASE WHEN v_fp IS NULL THEN 'unavailable'
      WHEN v_previous IS NULL THEN 'first_observation'
      WHEN v_fp = v_previous THEN 'unchanged'
      ELSE 'changed' END;

    INSERT INTO private.trader1d3b2_source_observations
      (research_id,source_kind,source_url,source_domain,observation_date,
       checked_at,status,http_status,content_type,metadata_fingerprint,change_kind)
    VALUES(v_id,v_kind,v_url,v_domain,(v_time AT TIME ZONE 'UTC')::date,
       v_time,v_status,v_http,v_type,v_fp,v_change)
    ON CONFLICT (research_id,source_kind,observation_date) DO NOTHING;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected=1 THEN v_written := v_written+1;
    ELSE v_duplicate := v_duplicate+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('contract','trader1d3b2-commit-v1',
    'inserted',v_written,'duplicate_day',v_duplicate,
    'published',0,'rights_updated',0);
END;
$$;
REVOKE ALL ON FUNCTION public.trader1d3b2_commit_observations(jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trader1d3b2_commit_observations(jsonb)
  TO service_role;

-- Browser sees ONLY bounded, owner-authorized metadata, never private table GRANTs.
CREATE OR REPLACE FUNCTION public.trader1d3b2_owner_health(
  p_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_user_roles pur
    WHERE pur.user_id=(SELECT auth.uid()) AND pur.role='platform_superadmin'
      AND pur.status='active'
  ) THEN
    RAISE EXCEPTION 'Superadmin only source health' USING errcode='42501';
  END IF;
  IF p_ids IS NULL OR coalesce(array_length(p_ids,1),0) NOT BETWEEN 1 AND 25
    OR array_position(p_ids,NULL::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid owner health input' USING errcode='22023';
  END IF;

  SELECT jsonb_build_object('contract','trader1d3b2-owner-health-v1',
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'research_id',r.id,
      'role',(
        SELECT jsonb_build_object('status',o.status,'checked_at',o.checked_at,
          'change',o.change_kind)
        FROM private.trader1d3b2_source_observations o
        WHERE o.research_id=r.id AND o.source_kind='role_evidence'
          AND o.source_url=r.role_evidence_url
        ORDER BY o.checked_at DESC,o.id DESC LIMIT 1
      ),
      'product',(
        SELECT jsonb_build_object('status',o.status,'checked_at',o.checked_at,
          'change',o.change_kind)
        FROM private.trader1d3b2_source_observations o
        WHERE o.research_id=r.id AND o.source_kind='product_evidence'
          AND o.source_url=r.product_evidence_url
        ORDER BY o.checked_at DESC,o.id DESC LIMIT 1
      )
    ) ORDER BY r.id),'[]'::jsonb)
  ) INTO v
  FROM private.netdata1eu_trader_research r WHERE r.id=ANY(p_ids);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.trader1d3b2_owner_health(uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trader1d3b2_owner_health(uuid[])
  TO authenticated;

COMMENT ON TABLE private.trader1d3b2_source_observations
  IS 'Immutable metadata-only EU source HTTP observations. No content capture, license grant, profile edits or Network publication.';
COMMENT ON FUNCTION public.trader1d3b2_source_batch(integer,integer)
  IS 'Service-role only, bounded live source URLs and latest HTTP metadata; no client-selected URL.';
COMMENT ON FUNCTION public.trader1d3b2_commit_observations(jsonb)
  IS 'Service-role only, bounded idempotent metadata history; no company/rights writes.';
COMMENT ON FUNCTION public.trader1d3b2_owner_health(uuid[])
  IS 'Active platform superadmin only; limited existing dossier IDs and latest metadata statuses.';
COMMIT;
