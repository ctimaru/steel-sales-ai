-- NET-IT-GROWTH4 — Unblock the NET-IT-SEED1 crawler (13 Nov 2026, approved by
-- the founder: "Correzione A: sì, applica").
--
-- Since 11 Nov 21:57 every hourly crawl failed and nothing new was found.
-- Root cause: after NET-IT-GROWTH2 the extractor also accepts steel
-- supply-chain companies that do not name tubes; they carry no product
-- relation, so inserting the private candidate violated
-- network_company_discovery_candidates_products_check (841 times). The record
-- RPC failed, the website stayed 'claimed', finish_batch put it back in the
-- queue, and after 10 rounds the attempts check made the whole claim fail.
--
-- Changes (only the marked lines of the production bodies from 20261111103000):
--   1. record: no product relation -> the curated placeholder
--      {"key":"unverified_product_scope","relationship_type":"not_assessed"}
--      plus quality flag product_scope_not_verified (already allowed by AUTO3).
--   2. finish_batch: an unreported website is closed as 'error' after 3 attempts.
--   3. claim_batch: never claims a website already at the attempt cap.
--   4. Data: websites waiting in the queue failed only because of this bug, so
--      their attempt counter is reset; they will be visited again.
-- Unchanged: owner policy, daily cap, deduplication, first-party-only crawling;
-- nothing here publishes.

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
    -- NET-IT-GROWTH4: never claim a website that would exceed the attempt cap.
    AND d.attempts<10
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
 v_products jsonb;
 v_flags text[];
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
   -- NET-IT-GROWTH4: since NET-IT-GROWTH2 the crawler also stages steel
   -- supply-chain companies that do not name tubes. Those come with no product
   -- relation and violated the candidates' products check (841 lost records on
   -- 11 Nov). Use the same unverified placeholder as the curated batches and
   -- flag the product scope as not verified.
   v_products := coalesce(p_candidate->'product_relations','[]'::jsonb);
   v_flags := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_candidate->'quality_flags','[]'::jsonb)));
   IF jsonb_typeof(v_products)<>'array' OR jsonb_array_length(v_products)=0 THEN
    v_products := '[{"key":"unverified_product_scope","relationship_type":"not_assessed"}]'::jsonb;
    IF NOT ('product_scope_not_verified'=ANY(v_flags)) THEN
     v_flags := v_flags||ARRAY['product_scope_not_verified'];
    END IF;
   END IF;
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
    v_products,
    coalesce(p_candidate->'evidence','[]'::jsonb),
    coalesce(p_candidate->'source_urls','[]'::jsonb),
    '[]'::jsonb,
    coalesce((p_candidate->>'confidence')::numeric,0),
    coalesce(nullif(p_candidate->>'extraction_version',''),'p3.4-v1'),
    coalesce(p_candidate->'identity_quality','{}'::jsonb),
    coalesce(p_candidate->'classification_scores','{}'::jsonb),
    v_flags,
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
 -- NET-IT-GROWTH4: ...but only up to 3 attempts; a website that keeps failing
 -- is closed as 'error' so it can never block the head of the queue again.
 UPDATE private.net_it_seed1_domains
 SET status=CASE WHEN attempts>=3 THEN 'error' ELSE 'staged' END,
     detail=CASE WHEN attempts>=3 THEN 'abandoned after 3 unreported attempts' ELSE detail END,
     run_id=NULL,updated_at=now()
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

-- 4. Data repair: requeue the websites the bug kept failing.
UPDATE private.net_it_seed1_domains
SET attempts=0,
    detail=left('requeued 13/11 by NET-IT-GROWTH4 (products check bug)',300),
    updated_at=now()
WHERE status='staged' AND attempts>0;
