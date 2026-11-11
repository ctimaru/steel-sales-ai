-- NET-IT-AUTO2: first-party evidence research by an attributed software agent.
-- This migration DOES NOT grant publication or make rights/identity approvals.
-- The queue and results are private; only the server-side service role can call
-- the bounded research RPCs. Public company counts remain unchanged.

CREATE TABLE IF NOT EXISTS private.net_it_auto2_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.network_company_discovery_candidates(id),
  source_run_id uuid NOT NULL REFERENCES public.network_company_discovery_runs(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reviewer_kind text NOT NULL DEFAULT 'software_agent'
    CHECK(reviewer_kind='software_agent'),
  reviewer_version text NOT NULL CHECK(length(reviewer_version) BETWEEN 5 AND 80),
  verdict text NOT NULL CHECK(verdict IN ('identity_supported','needs_human','blocked')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  observed_domain text,
  matched_company_name boolean NOT NULL DEFAULT false,
  observed_business_name text,
  company_page_url text,
  page_evidence_hash text,
  source_terms_url text,
  source_rights_state text NOT NULL DEFAULT 'unknown'
    CHECK(source_rights_state IN ('unknown','restricts_reuse')),
  identity_confidence numeric NOT NULL DEFAULT 0
    CHECK(identity_confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(pg_column_size(evidence)<=8192),
  CONSTRAINT auto2_evidence_hash CHECK(
    page_evidence_hash IS NULL OR page_evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS net_it_auto2_evidence_candidate_time
  ON private.net_it_auto2_evidence(candidate_id,reviewed_at DESC);
ALTER TABLE private.net_it_auto2_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.net_it_auto2_evidence FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto2_queue(
  p_max integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $q$
DECLARE
 v_rows jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR
     p_max NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Server research identity and bounded batch required'
       USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'domain',canonical_domain,'url',source_url,
   'website_url',website_url,'company_name',legal_name,
   'vat',vat_id,'source_run_id',run_id,'quality_flags',to_jsonb(quality_flags),
   'role_keys',to_jsonb(role_keys)
  ) ORDER BY priority,created_at,id),'[]'::jsonb)
  INTO v_rows
  FROM (
   SELECT c.id,c.canonical_domain,c.source_url,c.website_url,c.legal_name,
          c.vat_id,c.run_id,c.quality_flags,c.role_keys,c.created_at,
          CASE WHEN cardinality(c.quality_flags)=0 THEN 0
               WHEN NOT(c.quality_flags && ARRAY['legal_identity_not_verified','historical_sole_trader_vat_context']::text[]) THEN 1 ELSE 2 END priority
   FROM public.network_company_discovery_candidates c
   JOIN public.network_company_discovery_runs r ON r.id=c.run_id
   WHERE c.country_code='IT'
     AND c.review_status='pending_review'
     AND c.governance_status='unreviewed'
     AND r.governance_status='unreviewed'
     AND NOT coalesce(c.personal_data_detected,false)
     AND cardinality(c.personal_data_fields)=0
     AND c.canonical_domain<>'' AND c.source_url ~* '^https?://'
     AND NOT EXISTS (
       SELECT 1 FROM private.net_it_auto2_evidence e
       WHERE e.candidate_id=c.id
         -- AUTO3 accepts evidence for 3 days only: refresh supported
         -- identities after 2 days so they never fall into a dead window;
         -- exceptions are retried weekly.
         AND e.reviewed_at>now()-CASE WHEN e.verdict='identity_supported'
               THEN interval '2 days' ELSE interval '7 days' END)
   ORDER BY priority,c.created_at,c.id LIMIT p_max
  ) eligible;
  RETURN jsonb_build_object('contract','net-it-auto2-queue-v1',
   'items',v_rows,'count',jsonb_array_length(v_rows),
   'publication_authorized',false);
END
$q$;
REVOKE ALL ON FUNCTION private.net_it_auto2_queue(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_auto2_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_auto2_queue(
 p_max integer DEFAULT 50
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $q$
 SELECT private.net_it_auto2_queue(p_max);
$q$;
REVOKE ALL ON FUNCTION public.net_it_auto2_queue(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto2_record(
 p_candidate_id uuid,p_reviewer_version text,p_verdict text,
 p_reasons text[],p_observed_domain text,p_matched_name boolean,
 p_observed_name text,p_page_url text,p_hash text,p_confidence numeric,
 p_terms_url text DEFAULT NULL,p_rights_state text DEFAULT 'unknown'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $record$
DECLARE
 v_c public.network_company_discovery_candidates%rowtype;
 v_run public.network_company_discovery_runs%rowtype;
 v_id uuid;
 v_collision boolean;
 v_verdict text := p_verdict;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Service research role required' USING ERRCODE='42501';
 END IF;
 IF p_reviewer_version IS NULL OR length(p_reviewer_version) NOT BETWEEN 5 AND 80
    OR p_verdict NOT IN ('identity_supported','needs_human','blocked')
    OR p_confidence NOT BETWEEN 0 AND 1
    OR p_reasons IS NULL OR cardinality(p_reasons)>20
    OR (p_hash IS NOT NULL AND p_hash !~ '^[a-f0-9]{64}$')
    OR p_rights_state NOT IN ('unknown','restricts_reuse') THEN
   RAISE EXCEPTION 'Invalid bounded evidence payload' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_c FROM public.network_company_discovery_candidates
  WHERE id=p_candidate_id FOR SHARE;
 IF NOT FOUND OR v_c.country_code<>'IT' OR v_c.review_status<>'pending_review' THEN
   RAISE EXCEPTION 'Candidate not available for review' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_run FROM public.network_company_discovery_runs WHERE id=v_c.run_id;
 IF p_page_url IS NOT NULL
    AND lower(split_part(split_part(p_page_url,'/',3),':',1))
      NOT IN (lower(v_c.canonical_domain),'www.'||lower(v_c.canonical_domain)) THEN
   RAISE EXCEPTION 'Evidence must originate from company-owned domain'
     USING ERRCODE='22023';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.network_companies n
  WHERE lower(trim(n.website_domain))=lower(trim(v_c.canonical_domain))
   OR (v_c.vat_id IS NOT NULL AND n.vat_id=v_c.vat_id)
   OR (n.country_code='IT' AND lower(trim(n.legal_name))=lower(trim(v_c.legal_name))))
 INTO v_collision;
 -- Agent identity confidence is advisory ONLY. Re-check duplicates and flag
 -- unresolved legal identity even if the model or extractor reports success.
 IF v_collision OR cardinality(v_c.personal_data_fields)>0
      OR v_c.personal_data_detected
      OR v_c.quality_flags && ARRAY['historical_sole_trader_vat_context']::text[]
      OR lower(coalesce(p_observed_domain,''))<>lower(v_c.canonical_domain)
      OR NOT coalesce(p_matched_name,false)
      OR coalesce(p_confidence,0)<0.90
      OR p_hash IS NULL THEN
   v_verdict:='needs_human';
 END IF;
 IF p_rights_state='restricts_reuse' THEN v_verdict:='blocked'; END IF;

 INSERT INTO private.net_it_auto2_evidence(
  candidate_id,source_run_id,reviewer_version,verdict,reason_codes,
  observed_domain,matched_company_name,observed_business_name,company_page_url,
  page_evidence_hash,identity_confidence,source_terms_url,source_rights_state,
  evidence
 ) VALUES(
  p_candidate_id,v_c.run_id,p_reviewer_version,v_verdict,coalesce(p_reasons,'{}'),
  left(p_observed_domain,250),p_matched_name,left(p_observed_name,240),
  left(p_page_url,1024),p_hash,p_confidence,left(p_terms_url,1024),p_rights_state,
  jsonb_build_object('candidate_original_name',left(v_c.legal_name,240),
    'candidate_original_domain',left(v_c.canonical_domain,250),
    'catalog_collision',v_collision,'run_governance',v_run.governance_status,
    'rights_not_approved_by_agent',true,
    'publication_authorized',false)
 ) RETURNING id INTO v_id;
 RETURN jsonb_build_object('contract','net-it-auto2-review-v1',
  'evidence_id',v_id,'verdict',v_verdict,
  'source_approval_modified',false,'candidate_approval_modified',false,
  'publication_count',0);
END
$record$;
REVOKE ALL ON FUNCTION private.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_auto2_record(
 p_candidate_id uuid,p_reviewer_version text,p_verdict text,p_reasons text[],
 p_observed_domain text,p_matched_name boolean,p_observed_name text,
 p_page_url text,p_hash text,p_confidence numeric,
 p_terms_url text DEFAULT NULL,p_rights_state text DEFAULT 'unknown'
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $record$
 SELECT private.net_it_auto2_record(p_candidate_id,p_reviewer_version,p_verdict,
  p_reasons,p_observed_domain,p_matched_name,p_observed_name,p_page_url,
  p_hash,p_confidence,p_terms_url,p_rights_state);
$record$;
REVOKE ALL ON FUNCTION public.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)
 TO service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto2_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $status$
BEGIN
 PERFORM private.require_platform_permission('discovery.read');
 RETURN jsonb_build_object('contract','net-it-auto2-status-v1',
  'reviewed',(SELECT count(*) FROM private.net_it_auto2_evidence),
  'identity_supported',(SELECT count(*) FROM private.net_it_auto2_evidence
     WHERE verdict='identity_supported'),
  'needs_human',(SELECT count(*) FROM private.net_it_auto2_evidence
     WHERE verdict='needs_human'),
  'blocked',(SELECT count(*) FROM private.net_it_auto2_evidence
     WHERE verdict='blocked'),
  'auto_publications',0,'source_review_unchanged',true);
END
$status$;
REVOKE ALL ON FUNCTION private.net_it_auto2_status()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_auto2_status() TO authenticated;
CREATE OR REPLACE FUNCTION public.net_it_auto2_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $status$
 SELECT private.net_it_auto2_status();
$status$;
REVOKE ALL ON FUNCTION public.net_it_auto2_status()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_auto2_status() TO authenticated;
