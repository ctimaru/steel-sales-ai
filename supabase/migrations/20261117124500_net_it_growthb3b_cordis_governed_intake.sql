-- NET-IT-GROWTH.B3.B: governed CORDIS European Commission industrial lead feed.
-- The existing source registry row must be independently owner-approved before
-- this runs. Migration DOES NOT approve, unlock or alter source rights.
-- Only unverified website-domain pointers are staged for first-party SEED1;
-- no contacts, company names, claimed roles or facilities are imported.
CREATE TABLE IF NOT EXISTS private.net_it_growthb3b_cursor (
 source_id uuid PRIMARY KEY REFERENCES public.network_discovery_source_registry(id),
 next_offset integer NOT NULL DEFAULT 0 CHECK(next_offset BETWEEN 0 AND 1000000),
 last_success_at timestamptz
);
ALTER TABLE private.net_it_growthb3b_cursor ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.net_it_growthb3b_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_day date NOT NULL UNIQUE,
 source_id uuid NOT NULL REFERENCES public.network_discovery_source_registry(id),
 status text NOT NULL CHECK(status IN ('claimed','completed')),
 offset_start integer NOT NULL CHECK(offset_start >= 0),
 max_items smallint NOT NULL CHECK(max_items BETWEEN 1 AND 100),
 attempts smallint NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 2),
 raw_rows integer NOT NULL DEFAULT 0,
 sourced_domains integer NOT NULL DEFAULT 0,
 net_new_domains integer NOT NULL DEFAULT 0,
 duplicate_or_rejected integer NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
ALTER TABLE private.net_it_growthb3b_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.net_it_growthb3b_evidence (
 domain text PRIMARY KEY CHECK(domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'),
 source_id uuid NOT NULL REFERENCES public.network_discovery_source_registry(id),
 project_id text NOT NULL CHECK(project_id ~ '^[0-9]{4,14}$'),
 organization_id text NOT NULL CHECK(organization_id ~ '^[0-9]{1,20}$'),
 source_url text NOT NULL CHECK(source_url ~ '^https://cordis[.]europa[.]eu/project/id/[0-9]{4,14}$'),
 license_url text NOT NULL DEFAULT 'https://cordis.europa.eu/about/legal',
 observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_growthb3b_evidence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.net_it_growthb3b_source_active()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
 SELECT private.net_it_seed1_policy_active() AND EXISTS(
  SELECT 1 FROM public.network_discovery_source_registry s
  WHERE s.id='63b3ab2f-e272-43d1-b1cb-026d20a0a384'::uuid
   AND s.country_code='IT'
   AND s.source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
   AND s.enabled_for_discovery AND s.governance_status='approved'
   AND s.reviewed_by IS NOT NULL AND s.reviewed_at IS NOT NULL
   AND s.terms_status='allows_reuse'
   AND s.database_rights_status IN ('licensed','low_risk')
   AND s.personal_data_policy='exclude_personal_data'
   AND s.rights_evidence_url='https://cordis.europa.eu/about/legal'
   AND nullif(btrim(s.review_note),'') IS NOT NULL
   AND s.minimum_interval_hours >= 24
   AND s.max_domains_per_run BETWEEN 1 AND 100
 );
$fn$;

CREATE OR REPLACE FUNCTION public.net_it_growthb3b_claim_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_day date:=(now() AT TIME ZONE 'UTC')::date;
 v_source public.network_discovery_source_registry%rowtype;
 v_run private.net_it_growthb3b_runs%rowtype;
 v_start integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'B3.B only from the server worker' USING ERRCODE='42501';
 END IF;
 IF NOT private.net_it_growthb3b_source_active() THEN
  RETURN jsonb_build_object('contract','net-it-growthb3b-v1',
    'eligible',false,'reason','source_not_owner_approved','published',0);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(810021,20261174);
 SELECT * INTO v_source FROM public.network_discovery_source_registry
 WHERE id='63b3ab2f-e272-43d1-b1cb-026d20a0a384'::uuid;
 SELECT * INTO v_run FROM private.net_it_growthb3b_runs
 WHERE run_day=v_day FOR UPDATE;
 IF FOUND THEN
  IF v_run.status='completed' OR
    v_run.attempts>=2 OR v_run.started_at>now()-interval '35 minutes' THEN
    RETURN jsonb_build_object('contract','net-it-growthb3b-v1',
      'eligible',false,'reason','already_claimed_today','published',0);
  END IF;
  UPDATE private.net_it_growthb3b_runs
  SET attempts=attempts+1,started_at=now()
  WHERE id=v_run.id;
 ELSE
  INSERT INTO private.net_it_growthb3b_cursor(source_id) VALUES(v_source.id)
  ON CONFLICT DO NOTHING;
  SELECT next_offset INTO v_start FROM private.net_it_growthb3b_cursor
  WHERE source_id=v_source.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM private.net_it_growthb3b_cursor c
    WHERE c.source_id=v_source.id AND c.last_success_at >
       now()-make_interval(hours=>v_source.minimum_interval_hours)) THEN
    RETURN jsonb_build_object('contract','net-it-growthb3b-v1',
      'eligible',false,'reason','source_cooldown','published',0);
  END IF;
  INSERT INTO private.net_it_growthb3b_runs(
    run_day,source_id,status,offset_start,max_items
  ) VALUES(v_day,v_source.id,'claimed',v_start,v_source.max_domains_per_run)
  RETURNING * INTO v_run;
 END IF;
 RETURN jsonb_build_object('contract','net-it-growthb3b-v1','eligible',true,
  'run_id',v_run.id,'offset',v_run.offset_start,
  'limit',v_run.max_items,'source','cordis-horizon-organisations',
  'download_url','https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip',
  'published',0,'first_party_verified',false);
END
$fn$;

CREATE OR REPLACE FUNCTION public.net_it_growthb3b_commit_daily(
 p_run_id uuid,p_items jsonb,p_raw_rows integer,p_exhausted boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_run private.net_it_growthb3b_runs%rowtype;
 v_item jsonb;
 v_domain text;v_home text;v_project text;v_org text;v_provenance text;
 v_source_id uuid;v_inserted text;
 v_received integer:=0;v_accepted integer:=0;
 v_new integer:=0;v_rejected integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'B3.B only from the server worker' USING ERRCODE='42501';
 END IF;
 IF NOT private.net_it_growthb3b_source_active() THEN
  RAISE EXCEPTION 'CORDIS owner approval revoked' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_run FROM private.net_it_growthb3b_runs
 WHERE id=p_run_id AND status='claimed'
 AND run_day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No active B3.B claim' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_items)>v_run.max_items
  OR p_raw_rows IS NULL OR p_raw_rows NOT BETWEEN 0 AND 700000
  OR p_exhausted IS NULL THEN
  RAISE EXCEPTION 'CORDIS feed exceeds bounded limits' USING ERRCODE='22023';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_received:=v_received+1;
  IF jsonb_typeof(v_item)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_item))<>4
    OR NOT(v_item ?& ARRAY['domain','homepage','organization_id','project_id'])
  THEN v_rejected:=v_rejected+1;CONTINUE;END IF;
  v_domain:=lower(btrim(v_item->>'domain'));
  v_home:=v_item->>'homepage';
  v_org:=v_item->>'organization_id';
  v_project:=v_item->>'project_id';
  IF v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
   OR v_domain LIKE '%..%' OR v_domain LIKE 'www.%'
   OR v_home IS DISTINCT FROM 'https://'||v_domain||'/'
   OR v_org !~ '^[0-9]{1,20}$' OR v_project !~ '^[0-9]{4,14}$'
   OR v_domain ~* '(^|[.])(university|universita|polimi|polito|google|facebook|linkedin|wikipedia|cordis|europa)[.]'
  THEN v_rejected:=v_rejected+1;CONTINUE;END IF;
  v_provenance:='https://cordis.europa.eu/project/id/'||v_project;
  v_accepted:=v_accepted+1;
  -- Dedup against every first-party and third-party candidate source. A
  -- subdomain of an existing canonical organization is not a new company.
  IF EXISTS(SELECT 1 FROM public.network_companies c
    WHERE lower(c.website_domain)=v_domain
      OR v_domain LIKE '%.'||lower(c.website_domain))
  OR EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c
    WHERE lower(c.canonical_domain)=v_domain
      OR v_domain LIKE '%.'||lower(c.canonical_domain))
  OR EXISTS(SELECT 1 FROM private.net_it_seed1_domains d
    WHERE d.domain=v_domain OR v_domain LIKE '%.'||d.domain)
  OR EXISTS(SELECT 1 FROM private.network_web_research_seeds r
    WHERE lower(r.canonical_domain)=v_domain)
  OR EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
    WHERE lower(s.domain)=v_domain OR v_domain LIKE '%.'||lower(s.domain))
  OR EXISTS(SELECT 1 FROM public.network_netfast2_structured_entities n
    WHERE n.removed_at IS NULL AND lower(n.domain)=v_domain)
  OR EXISTS(SELECT 1 FROM private.netfast_discovered_records n
    WHERE lower(n.domain)=v_domain)
  OR EXISTS(SELECT 1 FROM public.network_discovery_domain_leads l
    WHERE lower(l.domain)=v_domain)
  THEN v_rejected:=v_rejected+1;CONTINUE;END IF;
  v_source_id:=NULL;v_inserted:=NULL;
  INSERT INTO private.net_it_seed1_index_sources(
    source_url,source_kind,label,enabled,max_links,min_interval_hours,last_result
  ) VALUES(
    v_home,'other',left('NET-IT-GROWTH.B3.B · CORDIS first-party: '||v_domain,255),
    false,1,8760,jsonb_build_object(
      'mode','direct_first_party_not_index','origin','cordis_horizon_europe',
      'cordis_project',v_project,'publication_authorized',false,'published',false)
  ) ON CONFLICT(source_url) DO NOTHING RETURNING id INTO v_source_id;
  IF v_source_id IS NULL THEN
    SELECT s.id INTO v_source_id FROM private.net_it_seed1_index_sources s
    WHERE s.source_url=v_home AND NOT s.enabled AND s.source_kind='other'
      AND s.last_result->>'mode'='direct_first_party_not_index';
  END IF;
  IF v_source_id IS NULL THEN v_rejected:=v_rejected+1;CONTINUE;END IF;
  INSERT INTO private.net_it_seed1_domains(
    domain,proposed_url,source_id,evidence_url,status
  ) VALUES(v_domain,v_home,v_source_id,v_provenance,'staged')
  ON CONFLICT(domain) DO NOTHING RETURNING domain INTO v_inserted;
  IF v_inserted IS NULL THEN v_rejected:=v_rejected+1;CONTINUE;END IF;
  INSERT INTO private.net_it_growthb3b_evidence(
    domain,source_id,project_id,organization_id,source_url
  ) VALUES(v_domain,v_run.source_id,v_project,v_org,v_provenance)
  ON CONFLICT(domain) DO NOTHING;
  v_new:=v_new+1;
 END LOOP;
 UPDATE private.net_it_growthb3b_runs
 SET status='completed',raw_rows=p_raw_rows,sourced_domains=v_accepted,
   net_new_domains=v_new,duplicate_or_rejected=v_rejected,completed_at=now()
 WHERE id=p_run_id;
 UPDATE private.net_it_growthb3b_cursor
 SET next_offset=CASE WHEN p_exhausted THEN 0
      ELSE v_run.offset_start+v_received END,last_success_at=now()
 WHERE source_id=v_run.source_id;
 UPDATE public.network_discovery_source_registry
 SET last_discovered_at=now() WHERE id=v_run.source_id;
 RETURN jsonb_build_object('contract','net-it-growthb3b-v1','status','completed',
  'raw_rows',p_raw_rows,'sourced_domains',v_accepted,
  'net_new_to_network',v_new,'duplicate_or_rejected',v_rejected,
  'next_offset',CASE WHEN p_exhausted THEN 0 ELSE v_run.offset_start+v_received END,
  'published',0);
END
$fn$;
-- Pre-populate only the DOCUMENTARY EVIDENCE for a possible one-time source
-- review. Do NOT mark reviewed/approved, relax terms, or enable discovery.
-- Existing human decisions are never overwritten.
UPDATE public.network_discovery_source_registry
SET rights_evidence_url=coalesce(rights_evidence_url,
      'https://cordis.europa.eu/about/legal'),
    review_note=CASE WHEN nullif(btrim(coalesce(review_note,'')),'') IS NULL
      THEN 'B3.B source assessment proposal only (not approval). EU CORDIS open CSV; reuse notice CC BY 4.0 for EU-owned content, beneficiary/third-party works excluded. Use only non-personal official company web links as unverified first-party crawl pointers. Named owner must separately check archive-specific rights and approve.'
      ELSE review_note END
WHERE id='63b3ab2f-e272-43d1-b1cb-026d20a0a384'::uuid
 AND source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
 AND governance_status='unreviewed' AND NOT enabled_for_discovery
 AND reviewed_by IS NULL AND reviewed_at IS NULL;

REVOKE ALL ON FUNCTION private.net_it_growthb3b_source_active()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.net_it_growthb3b_claim_daily()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.net_it_growthb3b_commit_daily(uuid,jsonb,integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_growthb3b_claim_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.net_it_growthb3b_commit_daily(uuid,jsonb,integer,boolean)
 TO service_role;
