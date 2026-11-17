-- NET-IT-GROWTH.B3.A | source expansion through PUBLIC first-party industrial links.
-- No copying of third-party registries, people, contacts, company facts or roles.
-- A link to an outside domain is only an UNVERIFIED first-party crawl hint.
-- All published company identities flow through the existing SEED1->AUTO2->AUTO3.
CREATE TABLE IF NOT EXISTS private.net_it_growthb3_firstparty_run (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_day date NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN ('claimed','completed')),
 source_company_ids uuid[] NOT NULL,
 raw_links integer NOT NULL DEFAULT 0,
 sourced_domains integer NOT NULL DEFAULT 0,
 staged_domains integer NOT NULL DEFAULT 0,
 already_known integer NOT NULL DEFAULT 0,
 failures integer NOT NULL DEFAULT 0,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
ALTER TABLE private.net_it_growthb3_firstparty_run ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.net_it_growthb3_firstparty_sources (
 company_id uuid PRIMARY KEY REFERENCES public.network_companies(id) ON DELETE CASCADE,
 last_claimed_at timestamptz NOT NULL,
 last_success_at timestamptz,
 last_status text NOT NULL DEFAULT 'claimed'
   CHECK(last_status IN ('claimed','completed')),
 new_domains integer NOT NULL DEFAULT 0
);
ALTER TABLE private.net_it_growthb3_firstparty_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.net_it_growthb3_referral_evidence (
 domain text PRIMARY KEY CHECK(domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'),
 referring_company_id uuid NOT NULL REFERENCES public.network_companies(id) ON DELETE CASCADE,
 referring_url text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_growthb3_referral_evidence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.net_it_growthb3_claim_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_day date := (now() AT TIME ZONE 'UTC')::date;
 v_items jsonb;
 v_ids uuid[];
 v_run uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Only the authorized server worker can acquire B3 first-party sources'
   USING ERRCODE='42501';
 END IF;
 IF NOT private.net_it_seed1_policy_active() THEN
  RETURN jsonb_build_object('contract','net-it-growthb3-v1','eligible',false,
   'reason','owner_policy_inactive','published',0);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(810021,20261173);
 IF EXISTS(SELECT 1 FROM private.net_it_growthb3_firstparty_run WHERE run_day=v_day) THEN
  RETURN jsonb_build_object('contract','net-it-growthb3-v1','eligible',false,
   'reason','already_claimed_today','published',0);
 END IF;
 WITH company_sources AS (
  SELECT c.id,lower(btrim(c.website_domain)) AS domain,
   'https://' || lower(btrim(c.website_domain)) || '/' AS home,
   coalesce((
    SELECT r.canonical_key FROM public.network_company_role_assignments a
    JOIN public.network_company_roles r ON r.id=a.role_id
    WHERE a.company_id=c.id AND r.canonical_key IN (
      'producer','processor_service_provider','trader_distributor','end_user')
    ORDER BY CASE r.canonical_key
       WHEN 'producer' THEN 0 WHEN 'processor_service_provider' THEN 1
       WHEN 'trader_distributor' THEN 2 ELSE 3 END LIMIT 1
   ),'other') AS role_key,
   l.last_claimed_at
  FROM public.network_companies c
  LEFT JOIN private.net_it_growthb3_firstparty_sources l ON l.company_id=c.id
  WHERE c.country_code='IT' AND c.publication_status='published'
   AND c.archived_at IS NULL
   AND c.website_url ~* '^https://'
   AND c.website_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
   AND c.website_domain NOT LIKE 'www.%'
   AND lower(regexp_replace(split_part(c.website_url,'/',3),'^www[.]',''))
       =lower(btrim(c.website_domain))
   AND (l.last_claimed_at IS NULL OR l.last_claimed_at<now()-interval '30 days')
 ), ranked AS (
  SELECT id,domain,home,role_key,
   row_number() OVER (PARTITION BY role_key
      ORDER BY last_claimed_at NULLS FIRST,md5(id::text)) AS role_rank
  FROM company_sources
 ), chosen AS (
  SELECT id,domain,home,role_key FROM ranked
  WHERE role_rank<=CASE WHEN role_key IN
    ('producer','processor_service_provider','trader_distributor','end_user')
      THEN 3 ELSE 0 END
  ORDER BY CASE role_key WHEN 'producer' THEN 0
    WHEN 'processor_service_provider' THEN 1
    WHEN 'trader_distributor' THEN 2
    WHEN 'end_user' THEN 3 ELSE 4 END, role_rank LIMIT 12
 )
 SELECT jsonb_agg(jsonb_build_object('company_id',id,'domain',domain,
        'homepage',home,'role_hint',role_key)),
        array_agg(id)
 INTO v_items,v_ids FROM chosen;
 IF coalesce(array_length(v_ids,1),0)=0 THEN
  RETURN jsonb_build_object('contract','net-it-growthb3-v1','eligible',false,
   'reason','no_eligible_first_party_roots','published',0);
 END IF;
 INSERT INTO private.net_it_growthb3_firstparty_run(run_day,status,source_company_ids)
 VALUES(v_day,'claimed',v_ids) RETURNING id INTO v_run;
 INSERT INTO private.net_it_growthb3_firstparty_sources(company_id,last_claimed_at)
 SELECT unnest(v_ids),now()
 ON CONFLICT(company_id) DO UPDATE
   SET last_claimed_at=EXCLUDED.last_claimed_at,last_status='claimed';
 RETURN jsonb_build_object('contract','net-it-growthb3-v1','eligible',true,
  'run_id',v_run,'items',v_items,'max_referrals',120,
  'published',0,'verification_complete',false);
END
$fn$;

CREATE OR REPLACE FUNCTION public.net_it_growthb3_commit_daily(
 p_run_id uuid,p_items jsonb,p_metrics jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_run private.net_it_growthb3_firstparty_run%rowtype;
 v_item jsonb;
 v_domain text; v_source_company uuid; v_evidence text; v_site text;
 v_host text; v_source_id uuid; v_added_domain text;
 v_received integer:=0; v_new integer:=0; v_known integer:=0;
 v_invalid integer:=0; v_sourced integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Server-side B3 only' USING ERRCODE='42501';
 END IF;
 IF NOT private.net_it_seed1_policy_active() THEN
  RAISE EXCEPTION 'Owner policy inactive' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_run FROM private.net_it_growthb3_firstparty_run
 WHERE id=p_run_id AND status='claimed'
   AND run_day=(now() AT TIME ZONE 'UTC')::date
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No claimed B3 run' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_items)>120
   OR jsonb_typeof(p_metrics) IS DISTINCT FROM 'object'
   OR (p_metrics->>'raw_links') !~ '^[0-9]{1,5}$'
   OR (p_metrics->>'failures') !~ '^[0-9]{1,3}$'
   OR (p_metrics->>'raw_links')::integer>10000
   OR (p_metrics->>'failures')::integer>12 THEN
  RAISE EXCEPTION 'B3 batch exceeds approved limits' USING ERRCODE='22023';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_received:=v_received+1;
  IF jsonb_typeof(v_item)<>'object' OR
    (SELECT count(*) FROM jsonb_object_keys(v_item))<>4 OR
    NOT(v_item ?& ARRAY['domain','homepage','source_company_id','evidence_url'])
  THEN v_invalid:=v_invalid+1;CONTINUE;END IF;
  v_domain:=lower(btrim(coalesce(v_item->>'domain','')));
  v_site:=v_item->>'homepage';
  v_evidence:=v_item->>'evidence_url';
  BEGIN v_source_company:=(v_item->>'source_company_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
   v_invalid:=v_invalid+1;CONTINUE;
  END;
  IF NOT(v_source_company=ANY(v_run.source_company_ids))
    OR v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    OR v_domain LIKE '%..%' OR v_domain LIKE 'www.%'
    OR v_site<>('https://'||v_domain||'/')
    OR v_evidence IS NULL OR length(v_evidence)>1900
    OR v_evidence !~* '^https://[a-z0-9.-]+/'
    OR split_part(v_evidence,'/',3) ~ '[:@]'
    OR lower(v_evidence) !~ '/(partner|partners|partnership|collaborazion|fornitor|supply-chain|network|associat|referenz|soci)(/|[?_-]|$)'
    OR NOT EXISTS (
      SELECT 1 FROM public.network_companies c
      WHERE c.id=v_source_company AND c.country_code='IT'
      AND c.publication_status='published' AND c.archived_at IS NULL
      AND lower(regexp_replace(split_part(v_evidence,'/',3),'^www[.]',''))
          =lower(c.website_domain)
    ) THEN v_invalid:=v_invalid+1;CONTINUE;END IF;
  v_sourced:=v_sourced+1;
  -- Conservative business identity/opt-out dedup at both root/subdomain level.
  IF EXISTS (
    SELECT 1 FROM public.network_companies c
      WHERE lower(c.website_domain)=v_domain OR lower(c.website_domain)=regexp_replace(v_domain,'^[^.]+[.]','')
        OR v_domain LIKE '%.'||lower(c.website_domain)
  ) OR EXISTS (
    SELECT 1 FROM public.network_company_discovery_candidates c
      WHERE lower(c.canonical_domain)=v_domain OR v_domain LIKE '%.'||lower(c.canonical_domain)
  ) OR EXISTS (
    SELECT 1 FROM private.net_it_seed1_domains q WHERE q.domain=v_domain
      OR v_domain LIKE '%.'||q.domain
  ) OR EXISTS (
    SELECT 1 FROM private.network_web_research_seeds q
      WHERE lower(q.canonical_domain)=v_domain
  ) OR EXISTS (
    SELECT 1 FROM public.network_netfast2_structured_entities w
      WHERE w.removed_at IS NULL AND lower(w.domain)=v_domain
  ) OR EXISTS (
    SELECT 1 FROM private.netfast_discovered_records w WHERE lower(w.domain)=v_domain
  ) OR EXISTS (
    SELECT 1 FROM public.network_netfast3_suppressed_domains s
      WHERE lower(s.domain)=v_domain OR v_domain LIKE '%.'||lower(s.domain)
  ) OR EXISTS (
    SELECT 1 FROM public.network_discovery_domain_leads d WHERE lower(d.domain)=v_domain
  ) THEN
    v_known:=v_known+1;CONTINUE;
  END IF;
  v_source_id:=NULL; v_added_domain:=NULL;
  INSERT INTO private.net_it_seed1_index_sources(
    source_url,source_kind,label,enabled,max_links,min_interval_hours,last_result
  ) VALUES (
    'https://' || v_domain || '/','other',
    left('NET-IT-GROWTH.B3 · first-party referral: '||v_domain,255),
    false,1,8760,
    jsonb_build_object('mode','direct_first_party_not_index',
       'origin','net_it_growthb3_referrals','source_company_id',v_source_company,
       'published',false,'source_approval',false)
  ) ON CONFLICT (source_url) DO NOTHING RETURNING id INTO v_source_id;
  IF v_source_id IS NULL THEN
    SELECT id INTO v_source_id FROM private.net_it_seed1_index_sources s
    WHERE s.source_url='https://' || v_domain || '/'
      AND s.source_kind='other' AND NOT s.enabled
      AND s.last_result->>'mode'='direct_first_party_not_index';
  END IF;
  IF v_source_id IS NULL THEN v_known:=v_known+1;CONTINUE;END IF;
  INSERT INTO private.net_it_seed1_domains(
    domain,proposed_url,source_id,evidence_url,status
  ) VALUES (
    v_domain,v_site,v_source_id,v_evidence,'staged'
  ) ON CONFLICT(domain) DO NOTHING RETURNING domain INTO v_added_domain;
  IF v_added_domain IS NOT NULL THEN
    v_new:=v_new+1;
    INSERT INTO private.net_it_growthb3_referral_evidence(
      domain,referring_company_id,referring_url
    ) VALUES(v_added_domain,v_source_company,v_evidence)
    ON CONFLICT(domain) DO NOTHING;
  ELSE v_known:=v_known+1;END IF;
 END LOOP;
 UPDATE private.net_it_growthb3_firstparty_run
 SET status='completed',raw_links=(p_metrics->>'raw_links')::integer,
  failures=(p_metrics->>'failures')::integer,sourced_domains=v_sourced,
  staged_domains=v_new,already_known=v_known+v_invalid,completed_at=now()
 WHERE id=p_run_id;
 UPDATE private.net_it_growthb3_firstparty_sources
 SET last_success_at=now(),last_status='completed'
 WHERE company_id=ANY(v_run.source_company_ids);
 RETURN jsonb_build_object('contract','net-it-growthb3-v1',
  'status','completed','source_roots',cardinality(v_run.source_company_ids),
  'raw_links',(p_metrics->>'raw_links')::integer,'referrals_received',v_received,
  'accepted_source_domains',v_sourced,'net_new_to_network',v_new,
  'duplicate_or_invalid',v_known+v_invalid,'published',0);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_it_growthb3_claim_daily() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.net_it_growthb3_commit_daily(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_growthb3_claim_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.net_it_growthb3_commit_daily(uuid,jsonb,jsonb) TO service_role;
