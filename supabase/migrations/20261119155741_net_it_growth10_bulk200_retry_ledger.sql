-- NET-IT-GROWTH10: 200 candidates per cron = 4 existing, bounded
-- 50-candidate lots; no increase of first-party request concurrency.
-- A malformed site gets a private retry-delay ledger, never a fake AUTO2
-- evidence verdict, and remains eligible for safe future retries.

CREATE TABLE IF NOT EXISTS private.net_it_auto2_site_errors (
  candidate_id uuid PRIMARY KEY
    REFERENCES public.network_company_discovery_candidates(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 100),
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  retry_after timestamptz NOT NULL DEFAULT now(),
  last_error_type text NOT NULL CHECK (last_error_type IN ('ValueError','CompanyDiscoveryError'))
);
ALTER TABLE private.net_it_auto2_site_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_auto2_site_errors FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_it_auto2_record_site_error(
   p_candidate_id uuid, p_error_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $backoff$
DECLARE v_candidate public.network_company_discovery_candidates%rowtype;
        v_n integer; v_until timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE='42501';
  END IF;
  IF p_candidate_id IS NULL OR p_error_type NOT IN ('ValueError','CompanyDiscoveryError') THEN
    RAISE EXCEPTION 'Invalid bounded site error' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_candidate
  FROM public.network_company_discovery_candidates
  WHERE id=p_candidate_id FOR SHARE;
  IF NOT FOUND OR v_candidate.country_code<>'IT'
      OR v_candidate.review_status<>'pending_review'
      OR v_candidate.governance_status<>'unreviewed'
      OR EXISTS(SELECT 1 FROM private.net_it_auto2_discards d
                WHERE d.candidate_id=p_candidate_id) THEN
    RAISE EXCEPTION 'Candidate outside research queue' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.net_it_auto2_site_errors
      (candidate_id,attempts,first_failed_at,last_failed_at,retry_after,last_error_type)
  VALUES(p_candidate_id,1,now(),now(),now()+interval '30 minutes',p_error_type)
  ON CONFLICT (candidate_id) DO UPDATE SET
    attempts=CASE WHEN private.net_it_auto2_site_errors.last_failed_at <
                       now()-interval '7 days' THEN 1
                  ELSE LEAST(100,private.net_it_auto2_site_errors.attempts+1) END,
    last_failed_at=now(),
    retry_after=now()+CASE
       WHEN private.net_it_auto2_site_errors.attempts>=5 THEN interval '7 days'
       WHEN private.net_it_auto2_site_errors.attempts>=3 THEN interval '1 day'
       ELSE interval '30 minutes' END,
    last_error_type=EXCLUDED.last_error_type
  RETURNING attempts,retry_after INTO v_n,v_until;
  RETURN jsonb_build_object('contract','net-it-auto2-site-error-v1',
    'attempts',v_n,'retry_after',v_until,'publication_count',0,
    'evidence_created',false,'status','retry_scheduled');
END;
$backoff$;
REVOKE ALL ON FUNCTION private.net_it_auto2_record_site_error(uuid,text)
 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.net_it_auto2_record_site_error(
   p_candidate_id uuid, p_error_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $wrapper$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  RETURN private.net_it_auto2_record_site_error(p_candidate_id,p_error_type);
END;
$wrapper$;
REVOKE ALL ON FUNCTION public.net_it_auto2_record_site_error(uuid,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_record_site_error(uuid,text)
 TO service_role;

DO $queue_guard$
DECLARE v_original text;
        v_old text := $old$     AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id)$old$;
        v_new text := $new$     AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id)
     AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_site_errors err
                    WHERE err.candidate_id=c.id AND err.retry_after>now())$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_original
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
  IF v_original IS NULL OR (length(v_original)-length(replace(v_original,v_old,'')))/length(v_old)<>1
    OR position('net_it_auto2_discards' in v_original)=0 THEN
    RAISE EXCEPTION 'GROWTH10 active AUTO2 queue drift detected';
  END IF;
  EXECUTE replace(v_original,v_old,v_new);
END;
$queue_guard$;

DO $growth10_assert$
DECLARE fn text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
  IF fn IS NULL OR position('net_it_auto2_site_errors' in fn)=0
    OR position('net_it_auto2_discards' in fn)=0
    OR position('robots_blocked_or_unavailable' in fn)=0
    OR position('personal_data_detected' in fn)=0 THEN
    RAISE EXCEPTION 'GROWTH10 queue safety invariants missing';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid='private.net_it_auto2_site_errors'::regclass) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Site error ledger must use RLS';
  END IF;
END;
$growth10_assert$;
