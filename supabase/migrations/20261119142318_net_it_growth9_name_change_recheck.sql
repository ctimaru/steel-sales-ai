-- NET-IT-GROWTH9: one-time repair must always be re-reviewed.
-- Leaves AUTO2 evidence immutable. No publication, approval, or loosened guard.
CREATE OR REPLACE FUNCTION private.net_it_auto2_queue(p_max integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
          CASE
              -- Prioritize eligible supported but bad-name identities for
              -- first-party re-review; prefer Piemonte pilot before others.
              WHEN NOT private.net_it_legal_name_quality_ok(c.legal_name)
               AND EXISTS (
                 SELECT 1 FROM private.net_it_auto2_evidence proof
                 WHERE proof.candidate_id=c.id
                   AND proof.reviewer_version='net-it-auto2-firstparty-v4'
                   AND proof.verdict='identity_supported'
               )
               AND EXISTS (
                 SELECT 1 FROM private.network_web_research_seeds seed
                 WHERE seed.batch_key LIKE 'NET-IT-PIEMONTE-%'
                   AND lower(seed.canonical_domain)=lower(c.canonical_domain)
               ) THEN -2
              WHEN NOT private.net_it_legal_name_quality_ok(c.legal_name)
               AND EXISTS (
                 SELECT 1 FROM private.net_it_auto2_evidence proof
                 WHERE proof.candidate_id=c.id
                   AND proof.reviewer_version='net-it-auto2-firstparty-v4'
                   AND proof.verdict='identity_supported'
               ) THEN -1
              WHEN cardinality(c.quality_flags)=0 THEN 0
               WHEN NOT(c.quality_flags && ARRAY['legal_identity_not_verified','historical_sole_trader_vat_context']::text[]) THEN 1 ELSE 2 END priority
   FROM public.network_company_discovery_candidates c
   JOIN public.network_company_discovery_runs r ON r.id=c.run_id
   WHERE c.country_code='IT'
     AND c.review_status='pending_review'
     AND c.governance_status='unreviewed'
     -- NET-IT-GROWTH3: also research candidates whose SOURCE the founder already
     -- approved (reuse allowed, low database-rights risk, no personal data);
     -- the candidate itself stays unreviewed and needs AUTO2 evidence.
     AND (r.governance_status='unreviewed'
       OR (r.governance_status='approved' AND r.governance_reviewed_by IS NOT NULL
           AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
           AND r.database_rights_status IN ('low_risk','licensed')
           AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
           AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL))
     -- NET-IT-AUTO4: automatically discarded candidates leave the queue.
     AND NOT EXISTS(SELECT 1 FROM private.net_it_auto2_discards d WHERE d.candidate_id=c.id)
     AND NOT coalesce(c.personal_data_detected,false)
     AND cardinality(c.personal_data_fields)=0
     AND c.canonical_domain<>'' AND c.source_url ~* '^https?://'
     AND NOT EXISTS (
       SELECT 1 FROM private.net_it_auto2_evidence e
       WHERE e.candidate_id=c.id
         -- NET-IT-AUTO4: pre-v4 identity exceptions do not hold the candidate
         -- back (v4 reads the ragione sociale on the site), nor does pre-v4
         -- support of a candidate whose crawler identity flags only v4 clears.
         AND NOT (e.reviewer_version<>'net-it-auto2-firstparty-v4'
                  AND (e.reason_codes && ARRAY['legal_form_requires_human_review',
                         'corporate_name_not_evidenced']::text[]
                       OR (e.verdict='identity_supported'
                           AND c.quality_flags && ARRAY['identity_no_legal_suffix',
                             'identity_domain_mismatch','identity_domain_fallback']::text[])))
         -- AUTO3 accepts evidence for 3 days only: refresh supported
         -- identities after 2 days so they never fall into a dead window;
         -- exceptions are retried weekly.
         -- NET-IT-AUTO4: unreachable sites are retried every 2 days and
         -- discarded by the sweep after 3 attempts.
         AND e.reviewed_at>now()-CASE -- No artificial approval: bad names can be rechecked by AUTO2
               -- sooner than valid names, at most every 12 hours.
               WHEN e.verdict='identity_supported'
                 AND NOT private.net_it_legal_name_quality_ok(c.legal_name)
               THEN interval '1 hour'
               -- GROWTH9: an independently corrected legal name must get
               -- a fresh first-party AUTO2 observation; the old supported
               -- observation was for a different displayed company name.
               -- Bounded 10-minute cooldown and existing rights/robots gates
               -- still apply; no change to the evidence ledger or AUTO3.
               WHEN e.verdict='identity_supported'
                 AND private.net_it_legal_name_quality_ok(c.legal_name)
                 AND lower(btrim(e.observed_business_name)) IS DISTINCT FROM
                     lower(btrim(c.legal_name))
               THEN interval '10 minutes'
               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               WHEN e.reason_codes && ARRAY['robots_blocked_or_unavailable',
                 'fetch_rejected_or_unavailable']::text[] THEN interval '2 days'
               ELSE interval '7 days' END)
   ORDER BY priority,c.created_at,c.id LIMIT p_max
  ) eligible;
  RETURN jsonb_build_object('contract','net-it-auto2-queue-v1',
   'items',v_rows,'count',jsonb_array_length(v_rows),
   'publication_authorized',false);
END
$function$;

DO $growth9_assert$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 IF src IS NULL
    OR position('e.observed_business_name' in src)=0
    OR position('interval ''10 minutes''' in src)=0
    OR position('interval ''2 days''' in src)=0
    OR position('net_it_auto2_discards' in src)=0
    OR position('robots_blocked_or_unavailable' in src)=0
 THEN RAISE EXCEPTION 'GROWTH9 AUTO2 queue invariants not met'; END IF;
END;
$growth9_assert$;
