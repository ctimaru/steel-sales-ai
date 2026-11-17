-- NET-IT-GROWTH.B2 | Source discovery by Italy region + industry, CC0 only.
-- Two bounded Wikidata requests/day via GitHub Actions. No publication authority.
-- The canonical Network remains protected by existing SEED1/AUTO2/AUTO3 gates.
CREATE TABLE IF NOT EXISTS private.net_it_growthb2_regions (
  slot smallint PRIMARY KEY CHECK(slot BETWEEN 0 AND 19),
  region_name text NOT NULL UNIQUE,
  region_qid text NOT NULL UNIQUE CHECK(region_qid ~ '^Q[1-9][0-9]{0,13}$'),
  next_offset integer NOT NULL DEFAULT 0 CHECK(next_offset BETWEEN 0 AND 1000
                                                AND next_offset % 100 = 0),
  last_processed_at timestamptz
);
ALTER TABLE private.net_it_growthb2_regions ENABLE ROW LEVEL SECURITY;
INSERT INTO private.net_it_growthb2_regions(slot,region_name,region_qid) VALUES
  (0,'Piemonte','Q1216'),(1,'Lombardia','Q1210'),
  (2,'Veneto','Q1243'),(3,'Emilia-Romagna','Q1263'),
  (4,'Toscana','Q1273'),(5,'Marche','Q1279'),
  (6,'Liguria','Q1256'),(7,'Friuli-Venezia Giulia','Q1250'),
  (8,'Trentino-Alto Adige','Q1237'),(9,'Valle d''Aosta','Q1222'),
  (10,'Umbria','Q1280'),(11,'Lazio','Q1282'),
  (12,'Abruzzo','Q1284'),(13,'Molise','Q1443'),
  (14,'Campania','Q1438'),(15,'Puglia','Q1447'),
  (16,'Basilicata','Q1452'),(17,'Calabria','Q1458'),
  (18,'Sicilia','Q1460'),(19,'Sardegna','Q1462')
ON CONFLICT(slot) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.net_it_growthb2_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_day date NOT NULL UNIQUE,
  region_qids text[] NOT NULL CHECK(cardinality(region_qids)=2),
  offsets jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('claimed','completed')),
  raw_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted integer NOT NULL DEFAULT 0,
  new_domains integer NOT NULL DEFAULT 0,
  duplicate_or_rejected integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE private.net_it_growthb2_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.net_it_growthb2_region_evidence (
  source_entity_id text NOT NULL CHECK(source_entity_id ~ '^Q[1-9][0-9]{0,13}$'),
  region_qid text NOT NULL CHECK(region_qid ~ '^Q[1-9][0-9]{0,13}$'),
  industry_qid text NOT NULL CHECK(industry_qid IN
    ('Q2285982','Q1924906','Q1957908','Q190117')),
  domain text NOT NULL,
  source_url text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_entity_id,region_qid)
);
ALTER TABLE private.net_it_growthb2_region_evidence ENABLE ROW LEVEL SECURITY;

-- Do not create new source approvals: use the original reviewed CC0 record.
CREATE OR REPLACE FUNCTION private.net_it_growthb2_source_active()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT private.net_it_seed1_policy_active() AND EXISTS (
    SELECT 1 FROM public.network_discovery_source_registry s
    WHERE s.id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid
      AND s.source_url='https://query.wikidata.org/sparql'
      AND s.country_code='IT' AND s.enabled_for_discovery
      AND s.governance_status='approved'
      AND s.reviewed_by IS NOT NULL AND s.reviewed_at IS NOT NULL
      AND s.terms_status='allows_reuse'
      AND s.database_rights_status='low_risk'
      AND s.personal_data_policy='exclude_personal_data'
      AND s.rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
      AND s.max_domains_per_run>=200
  );
$function$;

CREATE OR REPLACE FUNCTION public.net_it_growthb2_claim_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_offset integer;
  v_regions jsonb;
  v_ids text[];
  v_offsets jsonb;
  v_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Server-only NET-IT-GROWTH.B2 worker'
      USING ERRCODE='42501';
  END IF;
  IF NOT private.net_it_growthb2_source_active() THEN
    RETURN jsonb_build_object('contract','net-it-growthb2-v1',
      'eligible',false,'reason','approved_source_or_owner_policy_inactive');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(810021,20261172);
  IF EXISTS(SELECT 1 FROM private.net_it_growthb2_runs WHERE run_day=v_day) THEN
    RETURN jsonb_build_object('contract','net-it-growthb2-v1',
      'eligible',false,'reason','already_claimed_today');
  END IF;
  v_offset:=(((v_day-DATE '2026-11-17')*2) % 20 + 20) % 20;
  SELECT jsonb_agg(jsonb_build_object(
      'qid',r.region_qid,'name',r.region_name,'offset',r.next_offset
    ) ORDER BY r.slot),
    array_agg(r.region_qid ORDER BY r.slot),
    jsonb_object_agg(r.region_qid,r.next_offset)
  INTO v_regions,v_ids,v_offsets
  FROM private.net_it_growthb2_regions r
  WHERE r.slot IN (v_offset, (v_offset+1)%20);
  IF coalesce(array_length(v_ids,1),0)<>2 THEN
    RAISE EXCEPTION 'Incomplete Italian region registry' USING ERRCODE='42501';
  END IF;
  INSERT INTO private.net_it_growthb2_runs(run_day,region_qids,offsets,status)
  VALUES(v_day,v_ids,v_offsets,'claimed') RETURNING id INTO v_id;
  RETURN jsonb_build_object('contract','net-it-growthb2-v1','eligible',true,
    'run_id',v_id,'regions',v_regions,'max_records',200,
    'verified_companies',0,'publication_authorized',false);
END
$function$;

CREATE OR REPLACE FUNCTION public.net_it_growthb2_commit_daily(
 p_run_id uuid,p_items jsonb,p_counts jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_run private.net_it_growthb2_runs%rowtype;
  v_item jsonb;
  v_qid text; v_name text; v_domain text; v_website text;
  v_region text; v_industry text;
  v_accepted integer := 0;
  v_new integer := 0;
  v_skipped integer := 0;
  v_changed integer;
  v_raw integer := 0;
  v_rqid text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Server-only NET-IT-GROWTH.B2 worker'
      USING ERRCODE='42501';
  END IF;
  IF NOT private.net_it_growthb2_source_active() THEN
    RAISE EXCEPTION 'Wikidata CC0 or SEED1 authorization revoked'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_run FROM private.net_it_growthb2_runs
  WHERE id=p_run_id AND status='claimed'
    AND run_day=(now() AT TIME ZONE 'UTC')::date
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active B2 claim' USING ERRCODE='42501';END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items)>200
    OR jsonb_typeof(p_counts) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_counts))<>2 THEN
    RAISE EXCEPTION 'B2 batch over budget / malformed' USING ERRCODE='22023';
  END IF;
  FOREACH v_rqid IN ARRAY v_run.region_qids LOOP
    IF NOT(p_counts ? v_rqid) OR (p_counts->>v_rqid) !~ '^[0-9]{1,3}$'
      OR (p_counts->>v_rqid)::integer NOT BETWEEN 0 AND 100 THEN
      RAISE EXCEPTION 'B2 missing/invalid regional count'
        USING ERRCODE='22023';
    END IF;
    v_raw:=v_raw+(p_counts->>v_rqid)::integer;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_accepted:=v_accepted+1;
    IF jsonb_typeof(v_item)<>'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_item))<>6
      OR NOT (v_item ?& ARRAY[
        'qid','label','domain','website','industry_qid','region_qid']) THEN
      v_skipped:=v_skipped+1;CONTINUE;
    END IF;
    v_qid:=v_item->>'qid';
    v_name:=btrim(coalesce(v_item->>'label',''));
    v_domain:=lower(btrim(coalesce(v_item->>'domain','')));
    v_website:=v_item->>'website';
    v_region:=v_item->>'region_qid';
    v_industry:=v_item->>'industry_qid';
    IF v_qid !~ '^Q[1-9][0-9]{0,13}$'
      OR NOT (v_region=ANY(v_run.region_qids))
      OR v_industry NOT IN ('Q2285982','Q1924906','Q1957908','Q190117')
      OR length(v_name) NOT BETWEEN 3 AND 180
      OR v_name ~* '(https?://|[@<>[:cntrl:]])'
      OR v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
      OR v_domain LIKE '%..%'
      OR v_website<>('https://'||v_domain||'/')
      OR v_domain ~* '(^|[.])(facebook|linkedin|instagram|youtube|wikidata|wikipedia|google|twitter|tiktok|wordpress)[.]'
    THEN v_skipped:=v_skipped+1;CONTINUE;END IF;
    -- Discovery evidence only: geographical and industrial claims remain
    -- Wikidata-derived hints, never public first-party verified facts.
    INSERT INTO private.net_it_growthb2_region_evidence(
      source_entity_id,region_qid,industry_qid,domain,source_url
    ) VALUES(v_qid,v_region,v_industry,v_domain,
      'https://www.wikidata.org/wiki/'||v_qid)
    ON CONFLICT(source_entity_id,region_qid) DO NOTHING;
    INSERT INTO public.network_netfast2_structured_entities(
      source_entity_id,company_name,domain,website_url,industry_qid
    ) VALUES(v_qid,v_name,v_domain,v_website,v_industry)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    v_new:=v_new+v_changed;
    v_skipped:=v_skipped+1-v_changed;
  END LOOP;
  IF v_accepted>v_raw THEN
    RAISE EXCEPTION 'B2 returned more records than the two bounded WDQS pages'
      USING ERRCODE='22023';
  END IF;
  FOREACH v_rqid IN ARRAY v_run.region_qids LOOP
    UPDATE private.net_it_growthb2_regions
    SET next_offset=CASE WHEN (p_counts->>v_rqid)::integer=100
          THEN CASE WHEN next_offset>=1000 THEN 0 ELSE next_offset+100 END
          ELSE 0 END,
        last_processed_at=now()
    WHERE region_qid=v_rqid AND next_offset=(v_run.offsets->>v_rqid)::integer;
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    IF v_changed<>1 THEN RAISE EXCEPTION 'Concurrent B2 region cursor' USING ERRCODE='42501';END IF;
  END LOOP;
  UPDATE private.net_it_growthb2_runs
  SET status='completed',raw_counts=p_counts,accepted=v_accepted,
      new_domains=v_new,duplicate_or_rejected=v_skipped,completed_at=now()
  WHERE id=p_run_id;
  RETURN jsonb_build_object('contract','net-it-growthb2-v1',
    'status','completed','source_hits',v_accepted,
    'new_domains',v_new,'duplicate_or_rejected',v_skipped,
    'published',0,'geography_verified',false);
END
$function$;

-- Defense-in-depth: no browser/API user execution of privileged routines.
REVOKE ALL ON FUNCTION public.net_it_growthb2_claim_daily()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.net_it_growthb2_commit_daily(uuid,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_growthb2_claim_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.net_it_growthb2_commit_daily(uuid,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.net_it_growthb2_source_active()
  FROM PUBLIC,anon,authenticated;
-- No schema-wide privilege changes: existing private objects remain untouched.
