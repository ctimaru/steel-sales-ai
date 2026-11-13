-- NET-IT-GROWTH5 (2/2) — Re-review partnerships with AUTO2 reviewer v3.
-- Apply ONLY after the worker running net-it-auto2-firstparty-v3 is deployed:
-- with an older reviewer the same candidates would be re-queued every run.
-- Body is the production definition from 20261113090000 (GROWTH3) with only
-- the NET-IT-GROWTH5 lines changed.

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
     -- NET-IT-GROWTH3: also research candidates whose SOURCE the founder already
     -- approved (reuse allowed, low database-rights risk, no personal data);
     -- the candidate itself stays unreviewed and needs AUTO2 evidence.
     AND (r.governance_status='unreviewed'
       OR (r.governance_status='approved' AND r.governance_reviewed_by IS NOT NULL
           AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
           AND r.database_rights_status IN ('low_risk','licensed')
           AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
           AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL))
     AND NOT coalesce(c.personal_data_detected,false)
     AND cardinality(c.personal_data_fields)=0
     AND c.canonical_domain<>'' AND c.source_url ~* '^https?://'
     AND NOT EXISTS (
       SELECT 1 FROM private.net_it_auto2_evidence e
       WHERE e.candidate_id=c.id
         -- NET-IT-GROWTH5: a pre-v3 legal-form exception does not hold the
         -- candidate back; v3 re-reviews S.n.c./S.a.s. right away.
         AND NOT (e.reviewer_version<>'net-it-auto2-firstparty-v3'
                  AND 'legal_form_requires_human_review'=ANY(e.reason_codes))
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