-- NET-IT-GROWTH9: repair exactly the two proven pipeline gaps.
-- Recheck a legally corrected candidate via fresh first-party AUTO2 evidence,
-- and NEVER let AUTO3 publish when latest evidence describes an old name.
-- Both functions retain security definer, rights/robots, approval, PII, role,
-- deduplication, owner limits, and maintenance-only controls verbatim.

DO $growth9_change$
DECLARE
  fn text;
  old_sql text;
  new_sql text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO fn
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
  IF fn IS NULL THEN RAISE EXCEPTION 'GROWTH9 missing AUTO2 queue'; END IF;
  old_sql := $queue_old$               WHEN e.verdict='identity_supported'
               THEN interval '2 days'$queue_old$;
  new_sql := $queue_new$               -- GROWTH9: old proof no longer attests corrected name.
               WHEN e.verdict='identity_supported'
                 AND private.net_it_legal_name_quality_ok(c.legal_name)
                 AND lower(btrim(e.observed_business_name)) IS DISTINCT FROM
                     lower(btrim(c.legal_name))
               THEN interval '10 minutes'
               WHEN e.verdict='identity_supported'
               THEN interval '2 days'$queue_new$;
  IF (length(fn)-length(replace(fn,old_sql,'')))/length(old_sql)<>1
     OR position('net_it_auto2_discards' in fn)=0
  THEN RAISE EXCEPTION 'GROWTH9 AUTO2 queue drift'; END IF;
  EXECUTE replace(fn,old_sql,new_sql);

  SELECT pg_get_functiondef(p.oid) INTO fn
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='private' AND p.proname='net_it_auto3_release';
  IF fn IS NULL THEN RAISE EXCEPTION 'GROWTH9 missing AUTO3 publisher'; END IF;
  old_sql := $select_old$    AND e.matched_company_name AND e.identity_confidence>=0.94$select_old$;
  new_sql := $select_new$    AND e.matched_company_name AND e.identity_confidence>=0.94
    -- GROWTH9: evidence must attest CURRENT name, never an obsolete guess.
    AND lower(btrim(e.observed_business_name))=lower(btrim(c.legal_name))$select_new$;
  IF (length(fn)-length(replace(fn,old_sql,'')))/length(old_sql)<>1
     OR position('pg_advisory_xact_lock' in fn)=0
     OR position('net_it_auto2_discards' in fn)=0
  THEN RAISE EXCEPTION 'GROWTH9 AUTO3 selection drift'; END IF;
  fn := replace(fn,old_sql,new_sql);

  old_sql := $loop_old$     OR v_evidence.verdict<>'identity_supported'$loop_old$;
  new_sql := $loop_new$     OR lower(btrim(v_evidence.observed_business_name)) IS DISTINCT FROM
        lower(btrim(v_candidate.legal_name))
     OR v_evidence.verdict<>'identity_supported'$loop_new$;
  IF (length(fn)-length(replace(fn,old_sql,'')))/length(old_sql)<>1
  THEN RAISE EXCEPTION 'GROWTH9 AUTO3 recheck drift'; END IF;
  EXECUTE replace(fn,old_sql,new_sql);
END;
$growth9_change$;

DO $growth9_assert$
DECLARE queue_body text; publisher_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO queue_body FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
  SELECT pg_get_functiondef(p.oid) INTO publisher_body FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
   WHERE n.nspname='private' AND p.proname='net_it_auto3_release';
  IF queue_body IS NULL OR publisher_body IS NULL
    OR position('interval ''10 minutes''' in queue_body)=0
    OR position('net_it_auto2_discards' in queue_body)=0
    OR position('robots_blocked_or_unavailable' in queue_body)=0
    OR position('lower(btrim(e.observed_business_name))=lower(btrim(c.legal_name))' in publisher_body)=0
    OR position('lower(btrim(v_evidence.observed_business_name)) IS DISTINCT FROM' in publisher_body)=0
    OR position('net_it_auto2_discards' in publisher_body)=0
  THEN RAISE EXCEPTION 'GROWTH9 verification failed'; END IF;
END;
$growth9_assert$;
