-- NET-RO-OVERTURE1: reuse the Italian Overture discovery pattern for Romania.
-- Places are discovery leads only. Never publish, claim, attest, or infer
-- manufacturing capabilities from an Overture category or name.
-- Source: Overture Maps Places, release 2026-11-18.0 (CDLA Permissive 2.0).
CREATE TABLE IF NOT EXISTS private.net_ro_overture_leads (
  dataset_release text NOT NULL,
  canonical_domain text NOT NULL,
  gers_id uuid NOT NULL,
  place_label text NOT NULL,
  place_category text NOT NULL,
  source_dataset text NOT NULL,
  source_license text NOT NULL,
  source_audit_url text NOT NULL,
  website_url text NOT NULL,
  observed_lon numeric(9,6) NOT NULL,
  observed_lat numeric(9,6) NOT NULL,
  confidence numeric(4,3) NOT NULL,
  state text NOT NULL CHECK (state IN (
    'needs_first_party','already_in_queue','already_published','suppressed'
  )),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_ro_overture1_pk PRIMARY KEY (dataset_release,canonical_domain),
  CONSTRAINT net_ro_overture1_gers_unique UNIQUE (dataset_release,gers_id),
  CONSTRAINT net_ro_overture1_domain CHECK (
    canonical_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    AND canonical_domain !~ '[.][.]'
  ),
  CONSTRAINT net_ro_overture1_country_bbox CHECK (
    observed_lon BETWEEN 20.0 AND 30.3
    AND observed_lat BETWEEN 43.5 AND 48.4
  ),
  CONSTRAINT net_ro_overture1_evidence CHECK (
    source_license='CDLA-Permissive-2.0'
    AND confidence BETWEEN 0.75 AND 1.0
    AND website_url ~ '^https://'
    AND source_audit_url ~ '^https://'
    AND char_length(place_label) BETWEEN 3 AND 180
  )
);
ALTER TABLE private.net_ro_overture_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_ro_overture_leads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.net_ro_overture_leads TO service_role;

-- Call only with the server-side secret from GitHub Actions/worker.
-- A bounded batch is committed atomically and idempotently:
-- Overture records -> private lead -> existing private RO discovery seeds.
-- Seeds stay source_kind='overture_places', excluded from AUTO2 until a
-- separate first-party website proof replaces this discovery source.
CREATE OR REPLACE FUNCTION public.net_ro_overture1_stage(
  p_release text,p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_received integer;
  v_valid integer;
  v_staged integer;
  v_seeded integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'RO Overture stage: service_role required'
      USING ERRCODE='42501';
  END IF;
  IF p_release IS NULL OR
     p_release !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-[0-3][0-9][.][0-9]+$'
     OR p_release<'2026-11-18.0' THEN
    RAISE EXCEPTION 'RO Overture stage: invalid release';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN
    RAISE EXCEPTION 'RO Overture stage: expected array';
  END IF;
  v_received:=jsonb_array_length(p_items);
  IF v_received<1 OR v_received>200 THEN
    RAISE EXCEPTION 'RO Overture stage: 1..200 records only';
  END IF;

  WITH rows AS (
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      gers_id text,domain text,website text,label text,
      category text,source_dataset text,license text,country text,
      longitude numeric,latitude numeric,confidence numeric
    )
  )
  SELECT count(*) INTO v_valid FROM rows x
  WHERE x.gers_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND x.domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    AND x.domain NOT LIKE '%..%'
    AND x.domain NOT IN ('facebook.com','instagram.com','linkedin.com',
      'google.com','maps.google.com','youtube.com','tiktok.com','wixsite.com')
    AND x.website LIKE 'https://%'
    AND lower(regexp_replace(
      split_part(split_part(x.website,'://',2),'/',1),
      '^www[.]','','i'))=x.domain
    AND x.label IS NOT NULL AND char_length(btrim(x.label)) BETWEEN 3 AND 180
    AND x.label !~ '[@<>]'
    AND x.category IN ('metal_fabricator','sheet_metal_fabricator',
      'metal_supplier','steel_mill','steel_supplier','machine_shop',
      'welding_service','metal_processing','metalworking')
    AND x.source_dataset ~ '^[a-zA-Z0-9_-]{2,60}$'
    AND x.license='CDLA-Permissive-2.0'
    AND x.country='RO'
    AND x.longitude BETWEEN 20.0 AND 30.3
    AND x.latitude BETWEEN 43.5 AND 48.4
    AND x.confidence BETWEEN 0.75 AND 1.0;
  IF v_valid<>v_received THEN
    RAISE EXCEPTION 'RO Overture stage: invalid source/country/domain/item';
  END IF;

  WITH rows AS MATERIALIZED (
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      gers_id text,domain text,website text,label text,
      category text,source_dataset text,license text,country text,
      longitude numeric,latitude numeric,confidence numeric
    )
  ), ins AS (
    INSERT INTO private.net_ro_overture_leads(
      dataset_release,canonical_domain,gers_id,place_label,place_category,
      source_dataset,source_license,source_audit_url,website_url,
      observed_lon,observed_lat,confidence,state
    )
    SELECT p_release,x.domain,x.gers_id::uuid,x.label,x.category,
      x.source_dataset,x.license,
      'https://docs.overturemaps.org/guides/places/',x.website,
      x.longitude,x.latitude,x.confidence,
      CASE
        WHEN EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains d
          WHERE d.domain=x.domain) THEN 'suppressed'
        WHEN EXISTS(SELECT 1 FROM public.network_companies c
          WHERE c.country_code='RO' AND c.archived_at IS NULL
          AND c.website_domain=x.domain) THEN 'already_published'
        WHEN EXISTS(SELECT 1 FROM private.network_web_research_seeds s
          WHERE s.country_code='RO' AND s.canonical_domain=x.domain)
          THEN 'already_in_queue'
        ELSE 'needs_first_party'
      END
    FROM rows x
    ON CONFLICT DO NOTHING
    RETURNING canonical_domain
  ), seeds AS (
    INSERT INTO private.network_web_research_seeds(
      country_code,canonical_domain,display_name,proposed_role,
      source_url,source_summary,source_kind,review_lane,
      research_id,batch_key
    )
    SELECT 'RO',l.canonical_domain,l.place_label,
      CASE WHEN l.place_category IN ('metal_supplier','steel_supplier')
        THEN 'trader_distributor'
        WHEN l.place_category='steel_mill' THEN 'producer'
        ELSE 'processor_service_provider' END,
      'https://'||l.canonical_domain||'/',
      'Overture Places discovery pointer only. Industrial activity, legal name, Romanian operation, website and rights require independent first-party verification.',
      'overture_places','overture_needs_firstparty_identity',
      'NET-RO-OVERTURE-'||replace(l.gers_id::text,'-',''),
      'NET-RO-OVERTURE-'||p_release
    FROM private.net_ro_overture_leads l
    JOIN rows x ON x.domain=l.canonical_domain
    JOIN ins i ON i.canonical_domain=l.canonical_domain
    WHERE l.dataset_release=p_release AND l.state='needs_first_party'
      AND NOT EXISTS(
        SELECT 1 FROM public.network_companies c
        WHERE c.country_code='RO' AND c.archived_at IS NULL
          AND c.website_domain=l.canonical_domain
      )
      AND NOT EXISTS(
        SELECT 1 FROM public.network_netfast3_suppressed_domains d
        WHERE d.domain=l.canonical_domain
      )
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT (SELECT count(*) FROM ins),(SELECT count(*) FROM seeds)
    INTO v_staged,v_seeded;

  RETURN jsonb_build_object(
    'contract','net-ro-overture1-v1',
    'release',p_release,
    'received',v_received,
    'new_leads',v_staged,
    'new_private_seeds',v_seeded,
    'published',0,
    'requires_first_party_identity',true
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.net_ro_overture1_stage(text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_ro_overture1_stage(text,jsonb)
  TO service_role;
COMMENT ON FUNCTION public.net_ro_overture1_stage(text,jsonb) IS
 'Service-only bounded Romania Overture discovery feed, private idempotent staging; never publishes without first-party AUTO2 verification.';
