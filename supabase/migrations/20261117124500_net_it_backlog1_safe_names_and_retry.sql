-- NET-IT-BACKLOG1: preserve proven alphanumeric brand identities and retry
-- names containing website boilerplate. No source, privacy, matching, evidence
-- or publication authorization bypass; original AUTO3 gate stays in place.
-- Reviewer v4 requires first-party evidence. Cautious 1h retry applies only
-- to identity_supported plus names rejected by the existing quality function.
CREATE OR REPLACE FUNCTION private.net_it_legal_name_quality_ok(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE
 v_name text := btrim(coalesce(p_name,''));
 v_core text;
BEGIN
 v_core := btrim(regexp_replace(v_name,
   '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$).*$',
   '', 'i'));
 RETURN v_name <> '' AND v_core <> ''
  -- A first-party call-to-action is not part of an industrial company's name.
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]][[:space:]][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- NET-IT-AUTO4-NAME2: no question/exclamation marks ("M.G. Srl? M.G. Srl")
  AND v_name !~ '[?!]'
  -- no phone-like or date-like digit groups
  AND v_name !~ '[0-9]{3,}[ ./-]+[0-9]{3,}'
  AND v_name !~ '(^|[^[:alnum:]])(19|20)[0-9]{2}([^[:alnum:]]|$)'
  -- no sentence end inside the name ("... gratuiti. VIBEL")
  AND v_name !~ '[[:alpha:]]{4,}[.][[:space:]]'
  -- no navigation, contact, privacy or marketing words
  AND lower(v_name) !~ '(^|[^[:alpha:]])(home|homepage|contatti|contattaci|news|privacy|cookie|cookies|gdpr|titolare|trattamento|informativa|copyright|messaggio|politica|ditta|azienda|località|localita|scegli|preventivi|preventivo|fornirvi|qualità|qualita|benvenuti|telefono|tel|fax|email|pec|sede|menu|info|pulsante|button|clicca|click|scarica|download|vai|torna)([^[:alpha:]]|$)'
  -- at most 6 words before the legal form
  AND coalesce(array_length(regexp_split_to_array(v_core,'[[:space:]]+'),1),0) <= 6;
END
$function$
;

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
$function$
;

DO $validate$
BEGIN
 IF NOT private.net_it_legal_name_quality_ok('2C Carpenteria Srl.')
 OR NOT private.net_it_legal_name_quality_ok('3D Meccanica S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('Arper SPA')
 OR private.net_it_legal_name_quality_ok('2025 Arper SPA')
 OR private.net_it_legal_name_quality_ok('00 B.G.M. S.r.l.')
 OR private.net_it_legal_name_quality_ok('2018-2019 TF FATTORI SRL')
 OR private.net_it_legal_name_quality_ok('Richiedi preventivo 2C Carpenteria Srl.')
 THEN RAISE EXCEPTION 'NET-IT-BACKLOG1 quality-gate regression';
 END IF;
END
$validate$;
