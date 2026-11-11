-- NET-IT-SEED1: continuous, owner-authorized discovery of Italian company
-- websites and first-party staging of PRIVATE candidates.
--
-- What it adds
--   1. Index pages (association member lists, trade-fair exhibitor lists,
--      certification lists...) used ONLY as pointers to company websites.
--      Nothing from an index page is stored except the outbound domain and
--      the URL of the page where the link was seen.
--   2. A queue of discovered domains, deduplicated against the catalogue,
--      existing candidates, private research seeds and suppressed domains.
--   3. Bounded batches handed to the worker, which visits each company's OWN
--      website (robots-, SSRF- and size-protected crawler) and stages a
--      private pending candidate.
--
-- What it does NOT do
--   * It never publishes. Publication stays behind the human publisher,
--     NET-IT-AUTO1 or NET-IT-AUTO3, each with its own owner policy.
--   * It never marks a source or a candidate as human-reviewed: runs are
--     created 'unreviewed' / 'not_checked' / 'not_assessed'.
--   * It is OFF until a real Platform Owner enables it; it expires, has a
--     daily cap and can be revoked at any time.

CREATE TABLE IF NOT EXISTS private.net_it_seed1_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 authorized_by uuid REFERENCES auth.users(id),
 authorized_at timestamptz,
 expires_at timestamptz,
 daily_crawl_cap integer NOT NULL DEFAULT 1000
   CHECK(daily_crawl_cap BETWEEN 1 AND 5000),
 owner_note text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.net_it_seed1_policy(singleton,enabled)
VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
ALTER TABLE private.net_it_seed1_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_seed1_policy FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_seed1_index_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_url text NOT NULL UNIQUE
   CHECK(source_url ~* '^https://[^[:space:]]+$' AND char_length(source_url)<=2000),
 source_kind text NOT NULL
   CHECK(source_kind IN ('association','trade_fair','certification_list',
                         'consortium','public_register','other')),
 label text CHECK(label IS NULL OR char_length(label)<=255),
 enabled boolean NOT NULL DEFAULT true,
 max_links integer NOT NULL DEFAULT 300 CHECK(max_links BETWEEN 1 AND 1000),
 min_interval_hours integer NOT NULL DEFAULT 168
   CHECK(min_interval_hours BETWEEN 24 AND 8760),
 last_harvested_at timestamptz,
 last_result jsonb NOT NULL DEFAULT '{}'::jsonb
   CHECK(pg_column_size(last_result)<=4096),
 added_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_seed1_index_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_seed1_index_sources FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_seed1_domains (
 domain text PRIMARY KEY
   CHECK(domain=lower(domain) AND domain ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?[.][a-z]{2,24}$'),
 proposed_url text NOT NULL
   CHECK(proposed_url ~* '^https://' AND char_length(proposed_url)<=2000),
 source_id uuid NOT NULL REFERENCES private.net_it_seed1_index_sources(id),
 evidence_url text NOT NULL CHECK(char_length(evidence_url)<=2000),
 status text NOT NULL DEFAULT 'staged'
   CHECK(status IN ('staged','claimed','candidate','no_candidate',
                    'not_italian','unreachable','error')),
 run_id uuid REFERENCES public.network_company_discovery_runs(id),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
 detail text CHECK(detail IS NULL OR char_length(detail)<=300),
 staged_at timestamptz NOT NULL DEFAULT now(),
 claimed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS net_it_seed1_domains_status_time
 ON private.net_it_seed1_domains(status,staged_at);
CREATE INDEX IF NOT EXISTS net_it_seed1_domains_run
 ON private.net_it_seed1_domains(run_id);
ALTER TABLE private.net_it_seed1_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_seed1_domains FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_seed1_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_kind text NOT NULL
   CHECK(event_kind IN ('owner_grant','owner_revoke','source_added','source_disabled')),
 actor_user_id uuid,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_seed1_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_seed1_events FROM PUBLIC,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Owner policy: one explicit, expiring, revocable authorization.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.net_it_seed1_set_policy_impl(
 p_enabled boolean,
 p_daily_crawl_cap integer DEFAULT 1000,
 p_valid_days integer DEFAULT 30,
 p_attested boolean DEFAULT false,
 p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $policy$
DECLARE
 v_actor uuid := auth.uid();
 v_policy private.net_it_seed1_policy%rowtype;
BEGIN
 IF v_actor IS NULL OR NOT private.is_platform_superadmin()
   OR NOT private.has_platform_permission('platform.settings.manage')
   OR NOT private.has_platform_permission('discovery.run') THEN
  RAISE EXCEPTION 'Only a real Platform Owner can authorize continuous site discovery'
    USING ERRCODE='42501';
 END IF;
 IF p_enabled IS NULL THEN
  RAISE EXCEPTION 'Explicit choice required' USING ERRCODE='22023';
 END IF;
 IF p_enabled AND (
  p_attested IS DISTINCT FROM true
  OR p_daily_crawl_cap IS NULL OR p_daily_crawl_cap NOT BETWEEN 1 AND 5000
  OR p_valid_days IS NULL OR p_valid_days NOT BETWEEN 1 AND 90
  OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 80 AND 2000
 ) THEN
  RAISE EXCEPTION 'Site discovery requires explicit authorization, a daily cap and a meaningful note'
    USING ERRCODE='42501';
 END IF;

 UPDATE private.net_it_seed1_policy
 SET enabled=p_enabled,
     authorized_by=CASE WHEN p_enabled THEN v_actor ELSE authorized_by END,
     authorized_at=CASE WHEN p_enabled THEN now() ELSE authorized_at END,
     expires_at=CASE WHEN p_enabled THEN now()+make_interval(days=>p_valid_days) ELSE now() END,
     daily_crawl_cap=CASE WHEN p_enabled THEN p_daily_crawl_cap ELSE daily_crawl_cap END,
     owner_note=CASE WHEN p_enabled THEN btrim(p_note) ELSE owner_note END,
     updated_at=now()
 WHERE singleton=true RETURNING * INTO v_policy;

 INSERT INTO private.net_it_seed1_events(event_kind,actor_user_id,details)
 VALUES(CASE WHEN p_enabled THEN 'owner_grant' ELSE 'owner_revoke' END,v_actor,
  jsonb_build_object('enabled',p_enabled,'daily_crawl_cap',v_policy.daily_crawl_cap,
   'expires_at',v_policy.expires_at,'publication_authorized',false));
 RETURN jsonb_build_object('contract','net-it-seed1-policy-v1',
  'enabled',v_policy.enabled,'expires_at',v_policy.expires_at,
  'daily_crawl_cap',v_policy.daily_crawl_cap,'publication_authorized',false);
END
$policy$;
REVOKE ALL ON FUNCTION private.net_it_seed1_set_policy_impl(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_set_policy_impl(boolean,integer,integer,boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_seed1_set_policy(
 p_enabled boolean,p_daily_crawl_cap integer DEFAULT 1000,p_valid_days integer DEFAULT 30,
 p_attested boolean DEFAULT false,p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $policy$
 SELECT private.net_it_seed1_set_policy_impl(p_enabled,p_daily_crawl_cap,p_valid_days,p_attested,p_note);
$policy$;
REVOKE ALL ON FUNCTION public.net_it_seed1_set_policy(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_set_policy(boolean,integer,integer,boolean,text)
 TO authenticated;

-- ---------------------------------------------------------------------------
-- Index pages: added by Platform users allowed to run discovery.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.net_it_seed1_add_source_impl(
 p_source_url text,p_source_kind text,p_label text DEFAULT NULL,p_max_links integer DEFAULT 300
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $source$
DECLARE
 v_actor uuid := auth.uid();
 v_url text := btrim(coalesce(p_source_url,''));
 v_id uuid;
 v_new boolean := false;
BEGIN
 PERFORM private.require_platform_permission('discovery.run');
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authenticated Platform user required' USING ERRCODE='42501';
 END IF;
 IF v_url !~* '^https://[^[:space:]]+$' OR char_length(v_url)>2000
    OR p_source_kind IS NULL
    OR p_source_kind NOT IN ('association','trade_fair','certification_list',
                             'consortium','public_register','other')
    OR p_max_links IS NULL OR p_max_links NOT BETWEEN 1 AND 1000
    OR (p_label IS NOT NULL AND char_length(p_label)>255) THEN
  RAISE EXCEPTION 'Invalid index page' USING ERRCODE='22023';
 END IF;
 INSERT INTO private.net_it_seed1_index_sources(source_url,source_kind,label,max_links,added_by)
 VALUES(v_url,p_source_kind,nullif(btrim(coalesce(p_label,'')),''),p_max_links,v_actor)
 ON CONFLICT(source_url) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NOT NULL THEN
  v_new := true;
  INSERT INTO private.net_it_seed1_events(event_kind,actor_user_id,details)
  VALUES('source_added',v_actor,jsonb_build_object('source_id',v_id,'kind',p_source_kind));
 ELSE
  SELECT id INTO v_id FROM private.net_it_seed1_index_sources WHERE source_url=v_url;
 END IF;
 RETURN jsonb_build_object('contract','net-it-seed1-source-v1','source_id',v_id,'created',v_new);
END
$source$;
REVOKE ALL ON FUNCTION private.net_it_seed1_add_source_impl(text,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_add_source_impl(text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_seed1_add_source(
 p_source_url text,p_source_kind text,p_label text DEFAULT NULL,p_max_links integer DEFAULT 300
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $source$
 SELECT private.net_it_seed1_add_source_impl(p_source_url,p_source_kind,p_label,p_max_links);
$source$;
REVOKE ALL ON FUNCTION public.net_it_seed1_add_source(text,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_add_source(text,text,text,integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Worker API. The public facades are SECURITY INVOKER and refuse every
-- caller that is not the backend service role; implementations are private.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.net_it_seed1_policy_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $active$
 SELECT coalesce((SELECT p.enabled AND p.authorized_by IS NOT NULL
   AND p.expires_at IS NOT NULL AND p.expires_at>now()
   FROM private.net_it_seed1_policy p WHERE p.singleton),false);
$active$;
REVOKE ALL ON FUNCTION private.net_it_seed1_policy_active()
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.net_it_seed1_claim_sources_impl(p_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $claim$
DECLARE v_rows jsonb;
BEGIN
 IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Bounded source batch required' USING ERRCODE='22023';
 END IF;
 IF NOT private.net_it_seed1_policy_active() THEN
  RETURN jsonb_build_object('contract','net-it-seed1-sources-v1',
   'status','policy_disabled','items','[]'::jsonb);
 END IF;
 WITH due AS (
  SELECT s.id FROM private.net_it_seed1_index_sources s
  WHERE s.enabled
    AND (s.last_harvested_at IS NULL
      OR s.last_harvested_at<=now()-make_interval(hours=>s.min_interval_hours))
  ORDER BY s.last_harvested_at NULLS FIRST,s.created_at,s.id
  LIMIT p_max FOR UPDATE SKIP LOCKED
 ), upd AS (
  UPDATE private.net_it_seed1_index_sources s SET last_harvested_at=now()
  FROM due WHERE s.id=due.id
  RETURNING s.id,s.source_url,s.source_kind,s.max_links
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'url',source_url,
   'kind',source_kind,'max_links',max_links)),'[]'::jsonb) INTO v_rows FROM upd;
 RETURN jsonb_build_object('contract','net-it-seed1-sources-v1',
  'status','ok','items',v_rows);
END
$claim$;
REVOKE ALL ON FUNCTION private.net_it_seed1_claim_sources_impl(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_claim_sources_impl(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_seed1_claim_sources(p_max integer DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $claim$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 RETURN private.net_it_seed1_claim_sources_impl(p_max);
END
$claim$;
REVOKE ALL ON FUNCTION public.net_it_seed1_claim_sources(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_claim_sources(integer) TO service_role;

-- Stage outbound domains seen on one index page. Deduplicates in the
-- database so the worker never needs read access to private tables.
CREATE OR REPLACE FUNCTION private.net_it_seed1_stage_impl(p_source_id uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $stage$
DECLARE
 v_source private.net_it_seed1_index_sources%rowtype;
 v_received integer;
 v_valid integer;
 v_known integer;
 v_inserted integer;
BEGIN
 IF NOT private.net_it_seed1_policy_active() THEN
  RAISE EXCEPTION 'Site discovery is not authorized' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_source FROM private.net_it_seed1_index_sources
  WHERE id=p_source_id AND enabled;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Unknown or disabled index page' USING ERRCODE='22023';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
    OR jsonb_array_length(p_items)>1000 THEN
  RAISE EXCEPTION 'At most 1000 domains per index page' USING ERRCODE='22023';
 END IF;
 v_received := jsonb_array_length(p_items);

 WITH incoming AS (
  SELECT DISTINCT ON (d) d AS domain,u AS proposed_url,e AS evidence_url
  FROM (
   SELECT lower(btrim(i->>'domain')) d,btrim(i->>'url') u,
          left(btrim(coalesce(i->>'evidence',v_source.source_url)),2000) e
   FROM jsonb_array_elements(p_items) i
  ) x
  WHERE d ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?[.][a-z]{2,24}$'
    AND u ~* '^https://' AND char_length(u)<=2000
    AND lower(split_part(split_part(u,'/',3),':',1)) IN (d,'www.'||d)
  ORDER BY d
 ), fresh AS (
  SELECT n.* FROM incoming n
  WHERE NOT EXISTS(SELECT 1 FROM public.network_companies c
                   WHERE lower(btrim(c.website_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c
                   WHERE lower(btrim(c.canonical_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM private.network_web_research_seeds s
                   WHERE lower(btrim(s.canonical_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
                   WHERE s.domain=n.domain)
    AND NOT EXISTS(SELECT 1 FROM private.net_it_seed1_domains q
                   WHERE q.domain=n.domain)
 ), ins AS (
  INSERT INTO private.net_it_seed1_domains(domain,proposed_url,source_id,evidence_url)
  SELECT domain,proposed_url,p_source_id,evidence_url FROM fresh
  ON CONFLICT(domain) DO NOTHING RETURNING 1
 )
 SELECT (SELECT count(*) FROM incoming),(SELECT count(*) FROM ins)
 INTO v_valid,v_inserted;
 v_known := v_valid-v_inserted;

 UPDATE private.net_it_seed1_index_sources
 SET last_result=jsonb_build_object('at',now(),'received',v_received,
   'valid',v_valid,'already_known',v_known,'staged',v_inserted)
 WHERE id=p_source_id;
 RETURN jsonb_build_object('contract','net-it-seed1-stage-v1',
  'received',v_received,'valid',v_valid,'already_known',v_known,
  'staged',v_inserted,'published',0);
END
$stage$;
REVOKE ALL ON FUNCTION private.net_it_seed1_stage_impl(uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_stage_impl(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_seed1_stage(p_source_id uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $stage$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 RETURN private.net_it_seed1_stage_impl(p_source_id,p_items);
END
$stage$;
REVOKE ALL ON FUNCTION public.net_it_seed1_stage(uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_stage(uuid,jsonb) TO service_role;

-- Hand a bounded batch of staged domains to the worker and open the
-- discovery run that will own the resulting private candidates.
CREATE OR REPLACE FUNCTION private.net_it_seed1_claim_batch_impl(p_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $batch$
DECLARE
 v_policy private.net_it_seed1_policy%rowtype;
 v_today integer;
 v_limit integer;
 v_run uuid;
 v_domains text[];
 v_urls jsonb;
BEGIN
 IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Batch must contain 1 to 100 websites' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_policy FROM private.net_it_seed1_policy WHERE singleton FOR UPDATE;
 IF NOT private.net_it_seed1_policy_active() THEN
  RETURN jsonb_build_object('contract','net-it-seed1-batch-v1',
   'status','policy_disabled','items','[]'::jsonb);
 END IF;
 -- A crashed worker must not hold domains forever.
 UPDATE private.net_it_seed1_domains
 SET status=CASE WHEN attempts>=3 THEN 'error' ELSE 'staged' END,
     detail=CASE WHEN attempts>=3 THEN 'abandoned after repeated claims' ELSE detail END,
     run_id=NULL,updated_at=now()
 WHERE status='claimed' AND claimed_at<now()-interval '6 hours';

 SELECT count(*) INTO v_today FROM private.net_it_seed1_domains
 WHERE claimed_at IS NOT NULL
   AND (claimed_at AT TIME ZONE 'Europe/Rome')::date=(now() AT TIME ZONE 'Europe/Rome')::date;
 v_limit := LEAST(p_max,GREATEST(0,v_policy.daily_crawl_cap-v_today));
 IF v_limit=0 THEN
  RETURN jsonb_build_object('contract','net-it-seed1-batch-v1',
   'status','daily_limit_reached','items','[]'::jsonb,'claimed_today',v_today);
 END IF;

 SELECT array_agg(domain) INTO v_domains FROM (
  SELECT d.domain FROM private.net_it_seed1_domains d
  WHERE d.status='staged'
  ORDER BY d.staged_at,d.domain LIMIT v_limit FOR UPDATE SKIP LOCKED
 ) picked;
 IF v_domains IS NULL THEN
  RETURN jsonb_build_object('contract','net-it-seed1-batch-v1',
   'status','queue_empty','items','[]'::jsonb,'claimed_today',v_today);
 END IF;

 SELECT jsonb_agg(d.proposed_url ORDER BY d.domain) INTO v_urls
 FROM private.net_it_seed1_domains d WHERE d.domain=ANY(v_domains);

 -- The run is attributed to the Owner who authorized discovery, and is left
 -- explicitly unreviewed: no source approval or rights statement is implied.
 INSERT INTO public.network_company_discovery_runs(
  requested_by,country_code,seed_urls,status,started_at,
  source_type,source_reference,label,extraction_version
 ) VALUES (
  v_policy.authorized_by,'IT',v_urls,'running',now(),
  'other','net-it-seed1','NET-IT-SEED1 first-party auto','p3.4-v1'
 ) RETURNING id INTO v_run;

 UPDATE private.net_it_seed1_domains
 SET status='claimed',run_id=v_run,claimed_at=now(),
     attempts=attempts+1,updated_at=now()
 WHERE domain=ANY(v_domains);

 RETURN jsonb_build_object('contract','net-it-seed1-batch-v1','status','ok',
  'run_id',v_run,'claimed_today',v_today+cardinality(v_domains),
  'items',(SELECT jsonb_agg(jsonb_build_object('domain',d.domain,'url',d.proposed_url)
            ORDER BY d.domain)
           FROM private.net_it_seed1_domains d WHERE d.domain=ANY(v_domains)));
END
$batch$;
REVOKE ALL ON FUNCTION private.net_it_seed1_claim_batch_impl(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_claim_batch_impl(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_seed1_claim_batch(p_max integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $batch$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 RETURN private.net_it_seed1_claim_batch_impl(p_max);
END
$batch$;
REVOKE ALL ON FUNCTION public.net_it_seed1_claim_batch(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_claim_batch(integer) TO service_role;

-- Record what the worker found on ONE company website of a claimed batch.
-- A candidate is inserted here, server side, as a private pending record.
CREATE OR REPLACE FUNCTION private.net_it_seed1_record_impl(
 p_run_id uuid,p_domain text,p_outcome text,p_candidate jsonb DEFAULT NULL,
 p_detail text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $record$
DECLARE
 v_domain text := lower(btrim(coalesce(p_domain,'')));
 v_row private.net_it_seed1_domains%rowtype;
 v_outcome text := p_outcome;
 v_candidate uuid;
 v_host text;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN
    ('candidate','no_candidate','not_italian','unreachable','error') THEN
  RAISE EXCEPTION 'Invalid outcome' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_row FROM private.net_it_seed1_domains
  WHERE domain=v_domain AND run_id=p_run_id AND status='claimed' FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Website is not part of this claimed batch' USING ERRCODE='22023';
 END IF;

 IF v_outcome='candidate' THEN
  IF p_candidate IS NULL OR jsonb_typeof(p_candidate)<>'object'
     OR pg_column_size(p_candidate)>120000 THEN
   RAISE EXCEPTION 'Candidate payload missing or too large' USING ERRCODE='22023';
  END IF;
  v_host := lower(split_part(split_part(coalesce(p_candidate->>'website_url',''),'/',3),':',1));
  IF lower(btrim(coalesce(p_candidate->>'canonical_domain','')))<>v_domain
     OR v_host NOT IN (v_domain,'www.'||v_domain)
     OR lower(split_part(split_part(coalesce(p_candidate->>'source_url',''),'/',3),':',1))
        NOT IN (v_domain,'www.'||v_domain)
     OR coalesce(p_candidate->>'country_code','')<>'IT' THEN
   RAISE EXCEPTION 'Candidate must come from the claimed company website' USING ERRCODE='22023';
  END IF;
  -- Another path may have catalogued the same company while we crawled.
  IF EXISTS(SELECT 1 FROM public.network_companies c
            WHERE lower(btrim(c.website_domain))=v_domain)
     OR EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c
               WHERE lower(btrim(c.canonical_domain))=v_domain) THEN
   v_outcome := 'no_candidate';
   p_detail := 'already known when recorded';
  ELSE
   INSERT INTO public.network_company_discovery_candidates(
    run_id,source_url,canonical_domain,website_url,legal_name,trading_name,
    country_code,vat_id,registration_id,description,role_keys,subtype_keys,
    product_relations,evidence,source_urls,match_signals,confidence,
    extraction_version,identity_quality,classification_scores,quality_flags,
    facility_candidates,capability_keys,market_keys,enrichment_quality,
    review_status
   ) VALUES (
    p_run_id,p_candidate->>'source_url',v_domain,p_candidate->>'website_url',
    p_candidate->>'legal_name',nullif(p_candidate->>'trading_name',''),
    'IT',nullif(p_candidate->>'vat_id',''),nullif(p_candidate->>'registration_id',''),
    nullif(p_candidate->>'description',''),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'role_keys','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'subtype_keys','[]'::jsonb))),
    coalesce(p_candidate->'product_relations','[]'::jsonb),
    coalesce(p_candidate->'evidence','[]'::jsonb),
    coalesce(p_candidate->'source_urls','[]'::jsonb),
    '[]'::jsonb,
    coalesce((p_candidate->>'confidence')::numeric,0),
    coalesce(nullif(p_candidate->>'extraction_version',''),'p3.4-v1'),
    coalesce(p_candidate->'identity_quality','{}'::jsonb),
    coalesce(p_candidate->'classification_scores','{}'::jsonb),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'quality_flags','[]'::jsonb))),
    coalesce(p_candidate->'facility_candidates','[]'::jsonb),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'capability_keys','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'market_keys','[]'::jsonb))),
    coalesce(p_candidate->'enrichment_quality','{}'::jsonb)
      || jsonb_build_object('net_it_seed1',jsonb_build_object(
           'index_source_id',v_row.source_id,'index_evidence_url',v_row.evidence_url,
           'index_used_as_pointer_only',true)),
    'pending_review'
   ) RETURNING id INTO v_candidate;
  END IF;
 END IF;

 UPDATE private.net_it_seed1_domains
 SET status=v_outcome,detail=left(p_detail,300),updated_at=now()
 WHERE domain=v_domain;
 RETURN jsonb_build_object('contract','net-it-seed1-record-v1',
  'outcome',v_outcome,'candidate_id',v_candidate,'published',0);
END
$record$;
REVOKE ALL ON FUNCTION private.net_it_seed1_record_impl(uuid,text,text,jsonb,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_record_impl(uuid,text,text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_seed1_record(
 p_run_id uuid,p_domain text,p_outcome text,p_candidate jsonb DEFAULT NULL,
 p_detail text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $record$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 RETURN private.net_it_seed1_record_impl(p_run_id,p_domain,p_outcome,p_candidate,p_detail);
END
$record$;
REVOKE ALL ON FUNCTION public.net_it_seed1_record(uuid,text,text,jsonb,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_record(uuid,text,text,jsonb,text) TO service_role;

-- Close the run once every website of the batch has an outcome.
CREATE OR REPLACE FUNCTION private.net_it_seed1_finish_batch_impl(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $finish$
DECLARE
 v_candidates integer; v_skipped integer; v_errors integer; v_open integer; v_total integer;
BEGIN
 SELECT count(*) FILTER (WHERE status='candidate'),
        count(*) FILTER (WHERE status IN ('no_candidate','not_italian')),
        count(*) FILTER (WHERE status IN ('unreachable','error')),
        count(*) FILTER (WHERE status='claimed'),count(*)
 INTO v_candidates,v_skipped,v_errors,v_open,v_total
 FROM private.net_it_seed1_domains WHERE run_id=p_run_id;
 IF v_total=0 THEN
  RAISE EXCEPTION 'Unknown site discovery batch' USING ERRCODE='22023';
 END IF;
 -- Websites the worker never reported go back to the queue.
 UPDATE private.net_it_seed1_domains
 SET status='staged',run_id=NULL,updated_at=now()
 WHERE run_id=p_run_id AND status='claimed';

 UPDATE public.network_company_discovery_runs
 SET status='completed',completed_at=now(),candidate_count=v_candidates,
     skipped_count=v_skipped,error_count=v_errors,
     stats=jsonb_build_object('seed_count',v_total,'candidate_count',v_candidates,
       'skipped_count',v_skipped,'error_count',v_errors,'requeued',v_open,
       'pipeline','net-it-seed1')
 WHERE id=p_run_id AND status='running'
   AND label='NET-IT-SEED1 first-party auto';
 RETURN jsonb_build_object('contract','net-it-seed1-finish-v1',
  'candidates',v_candidates,'skipped',v_skipped,'errors',v_errors,
  'requeued',v_open,'published',0);
END
$finish$;
REVOKE ALL ON FUNCTION private.net_it_seed1_finish_batch_impl(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_finish_batch_impl(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_seed1_finish_batch(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $finish$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 RETURN private.net_it_seed1_finish_batch_impl(p_run_id);
END
$finish$;
REVOKE ALL ON FUNCTION public.net_it_seed1_finish_batch(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_finish_batch(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Read-only status for the Platform console.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.net_it_seed1_status_impl()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $status$
DECLARE v private.net_it_seed1_policy%rowtype;
BEGIN
 PERFORM private.require_platform_permission('discovery.read');
 SELECT * INTO v FROM private.net_it_seed1_policy WHERE singleton;
 RETURN jsonb_build_object(
  'contract','net-it-seed1-status-v1',
  'enabled',coalesce(v.enabled,false),
  'active',private.net_it_seed1_policy_active(),
  'expires_at',v.expires_at,'daily_crawl_cap',v.daily_crawl_cap,
  'index_sources',(SELECT count(*) FROM private.net_it_seed1_index_sources WHERE enabled),
  'domains_total',(SELECT count(*) FROM private.net_it_seed1_domains),
  'domains_waiting',(SELECT count(*) FROM private.net_it_seed1_domains WHERE status='staged'),
  'visited_today',(SELECT count(*) FROM private.net_it_seed1_domains
     WHERE claimed_at IS NOT NULL
       AND (claimed_at AT TIME ZONE 'Europe/Rome')::date=(now() AT TIME ZONE 'Europe/Rome')::date),
  'candidates_total',(SELECT count(*) FROM private.net_it_seed1_domains WHERE status='candidate'),
  'no_candidate_total',(SELECT count(*) FROM private.net_it_seed1_domains
     WHERE status IN ('no_candidate','not_italian')),
  'failed_total',(SELECT count(*) FROM private.net_it_seed1_domains
     WHERE status IN ('unreachable','error')),
  'published_by_this_pipeline',0
 );
END
$status$;
REVOKE ALL ON FUNCTION private.net_it_seed1_status_impl()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_status_impl() TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_seed1_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $status$ SELECT private.net_it_seed1_status_impl(); $status$;
REVOKE ALL ON FUNCTION public.net_it_seed1_status()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_seed1_status() TO authenticated;
