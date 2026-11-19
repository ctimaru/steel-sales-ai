-- RO-OVERTURE4: precision upgrade against medical laser, sports, print and detector names.
-- Keep previous hotel/motel protections; "laser" alone is not industrial evidence.
-- Also prevent "equinox", "teaverse", "stube", salon, gym etc. from
-- being classified as industrial without actual first-party evidence.
-- Does not retroactively treat any Overture name as corporate proof.
-- This replaces the existing service-only RPC with a stricter filter.
CREATE OR REPLACE FUNCTION public.net_ro_overture1_stage(p_release text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    AND (
      x.category IN ('metal_fabricator','sheet_metal_fabricator',
        'metal_supplier','steel_mill','steel_supplier','machine_shop',
        'welding_service','metal_processing','metalworking')
      OR (x.category='keyword_industrial_hint'
        AND x.label ~* '(metal|metall|steel|sider|profil|carpenter|sudur|forjat|prelucr|(^|[^a-z])(inox|tub|teav|țeav|fier|oțel))'
        AND x.label !~* '(hotel|motel|resort|hostel|restaurant|pensiun|cafenea|cafe|bubble.?tea|salon|cosmetic|beauty|epil|gym|fitness|muze|museum|biseric|church|scoal|școal|school|laser.?tag|barber|spa|dent|stomat|clinic|dermat|chirurg|estet|fotbal|football|stadion|printer|imprimant|toner|cartu|detecto|laser.?game|lasertime|metalul.?buz)')
    )
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
  )
  SELECT count(*) INTO v_staged FROM ins;

  -- The lead and seed writes must be separate SQL statements: in PG,
  -- a data-modifying CTE cannot see siblings' table writes in one snapshot.
  INSERT INTO private.network_web_research_seeds(
    country_code,canonical_domain,display_name,proposed_role,
    source_url,source_summary,source_kind,review_lane,research_id,batch_key
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
  JOIN (SELECT DISTINCT x.domain FROM jsonb_to_recordset(p_items)
        AS x(domain text)) source ON source.domain=l.canonical_domain
  WHERE l.dataset_release=p_release AND l.state='needs_first_party'
    AND NOT EXISTS (SELECT 1 FROM public.network_companies c
      WHERE c.country_code='RO' AND c.archived_at IS NULL
        AND c.website_domain=l.canonical_domain)
    AND NOT EXISTS (SELECT 1 FROM public.network_netfast3_suppressed_domains d
      WHERE d.domain=l.canonical_domain)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_seeded=ROW_COUNT;

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
$function$
;
REVOKE ALL ON FUNCTION public.net_ro_overture1_stage(text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_ro_overture1_stage(text,jsonb)
  TO service_role;


COMMENT ON FUNCTION public.net_ro_overture1_stage(text,jsonb) IS
  'RO-OVERTURE4 service-only stage; reject standalone laser and medical/sport/printing/retail hints; Overture names never authorize publication.';
