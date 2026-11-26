-- LOMBARDIA1.O: bounded deferred transient recovery; reuse existing claim/record path.
-- Never retry ambiguous access failures, explicit refusals, or disabled/suppressed domains.
CREATE OR REPLACE FUNCTION private.net_it_seed1_claim_batch_impl(p_max integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  WHERE (d.status='staged' AND d.attempts<10)
    OR (d.status='unreachable' AND d.domain IN (
      SELECT retry.domain FROM private.net_it_seed1_domains retry
      JOIN private.net_it_seed1_index_sources s ON s.id=retry.source_id
      JOIN private.net_it_overture_provenance p ON p.source_id=s.id AND p.domain=retry.domain
      WHERE retry.status='unreachable' AND retry.attempts BETWEEN 1 AND 2
        AND retry.updated_at<=now()-interval '24 hours'
        AND retry.claimed_at<=now()-interval '24 hours'
        AND retry.detail IN ('ReadTimeout','ConnectTimeout','PoolTimeout','WriteTimeout','ReadError','RemoteProtocolError')
        AND s.enabled AND s.added_by IS NOT NULL AND s.source_kind='other'
        AND s.source_url='https://docs.overturemaps.org/guides/places/#sss-autofeed-v1'
        AND NOT EXISTS(SELECT 1 FROM public.network_companies c WHERE lower(btrim(c.website_domain))=retry.domain)
        AND NOT EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c WHERE lower(btrim(c.canonical_domain))=retry.domain)
        AND NOT EXISTS(SELECT 1 FROM private.network_web_research_seeds seed WHERE lower(btrim(seed.canonical_domain))=retry.domain)
        AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains suppressed WHERE suppressed.domain=retry.domain)
      ORDER BY retry.updated_at,retry.domain LIMIT 10
    ))
  ORDER BY CASE WHEN d.status='staged' THEN 0 ELSE 1 END,d.staged_at,d.domain
  LIMIT v_limit FOR UPDATE SKIP LOCKED
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
$function$
