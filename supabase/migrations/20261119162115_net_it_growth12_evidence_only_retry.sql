-- NET-IT-GROWTH12: increase throughput of ALREADY evidenced, inconclusive
-- candidates without changing their verdict. Revisit after 12 hours ONLY if
-- the previous evidence was from the official domain with no exception reason,
-- a full matching legal name, hash and confidence >= 0.94.
-- Robots, unavailable pages, discarded candidates, rights, PII and AUTO3
-- publication requirements remain unchanged.

DO $growth12_patch$
DECLARE v_source text;
        v_old text := $old$               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               WHEN e.reason_codes && ARRAY['robots_blocked_or_unavailable',$old$;
        v_new text := $new$               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               -- GROWTH12: fresh proof needed, NOT an approval shortcut.
               -- Retry only an older blank-reason needs_human record whose
               -- recorded official site matched the existing legal name.
               WHEN e.verdict='needs_human'
                 AND cardinality(e.reason_codes)=0
                 AND e.matched_company_name IS TRUE
                 AND e.identity_confidence>=0.94
                 AND e.page_evidence_hash ~ '^[a-f0-9]{64}$'
                 AND lower(btrim(e.observed_domain))=lower(btrim(c.canonical_domain))
                 AND lower(btrim(e.observed_business_name))=lower(btrim(c.legal_name))
                 AND e.source_rights_state='unknown'
                 AND private.net_it_legal_name_quality_ok(c.legal_name)
               THEN interval '12 hours'
               WHEN e.reason_codes && ARRAY['robots_blocked_or_unavailable',$new$;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_source
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 IF v_source IS NULL
 OR (length(v_source)-length(replace(v_source,v_old,'')))/length(v_old)<>1
 OR position('net_it_auto2_discards' in v_source)=0
 OR position('net_it_auto2_site_errors' in v_source)=0
 OR position('personal_data_detected' in v_source)=0
 OR position('robots_blocked_or_unavailable' in v_source)=0
 THEN RAISE EXCEPTION 'GROWTH12 queue drift: no retry expansion'; END IF;
 EXECUTE replace(v_source,v_old,v_new);
END;
$growth12_patch$;

DO $growth12_assert$
DECLARE v_def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 IF v_def IS NULL
 OR position('cardinality(e.reason_codes)=0' in v_def)=0
 OR position('e.identity_confidence>=0.94' in v_def)=0
 OR position('e.source_rights_state=''unknown''' in v_def)=0
 OR position('interval ''12 hours''' in v_def)=0
 OR position('net_it_auto2_site_errors' in v_def)=0
 OR position('net_it_auto2_discards' in v_def)=0
 OR position('robots_blocked_or_unavailable' in v_def)=0
 OR position('interval ''7 days''' in v_def)=0
 THEN RAISE EXCEPTION 'GROWTH12 retry safety invariants missing'; END IF;
END;
$growth12_assert$;
