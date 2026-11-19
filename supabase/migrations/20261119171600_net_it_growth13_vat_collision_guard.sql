-- GROWTH13: an identical NAME is not an identical COMPANY when the
-- source-proven, independently audited 11-digit VATs are disjoint.
-- Never relax exact domain / exact VAT collisions, rights, PII, or owner gates.
DO $vat_guard$
DECLARE src text; a text; b text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_record';
 a:=$old$OR (n.country_code='IT' AND lower(trim(n.legal_name))=lower(trim(v_c.legal_name)))$old$;
 b:=$new$OR (n.country_code='IT' AND lower(trim(n.legal_name))=lower(trim(v_c.legal_name))
       AND NOT private.net_it_growth13_distinct_vat(v_c.id,n.id))$new$;
 IF src IS NULL OR (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN
 RAISE EXCEPTION 'AUTO2 record source changed'; END IF;
 EXECUTE replace(src,a,b);

 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto3_release';
 a:=$old$OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name)))$old$;
 b:=$new$OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name))
             AND NOT private.net_it_growth13_distinct_vat(c.id,n.id))$new$;
 IF src IS NULL OR (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN
 RAISE EXCEPTION 'AUTO3 selection source changed'; END IF;
 src:=replace(src,a,b);

 a:=$old$OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(v_candidate.legal_name)))$old$;
 b:=$new$OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(v_candidate.legal_name))
       AND NOT private.net_it_growth13_distinct_vat(v_candidate.id,n.id))$new$;
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN
 RAISE EXCEPTION 'AUTO3 locked recheck source changed'; END IF;
 src:=replace(src,a,b);

 -- Retain audited VAT on the final company profile ONLY for proven homonyms.
 a:=$old$  INSERT INTO public.network_companies(
    legal_name,country_code,website_url,website_domain,
    publication_status,claimed_status,verification_status
  ) VALUES (
    btrim(v_candidate.legal_name),'IT',v_candidate.website_url,
    lower(btrim(v_candidate.canonical_domain)),
    'published','unclaimed','unverified'
  ) RETURNING id INTO v_company;$old$;
 b:=$new$  INSERT INTO public.network_companies(
    legal_name,country_code,website_url,website_domain,vat_id,
    publication_status,claimed_status,verification_status
  ) VALUES (
    btrim(v_candidate.legal_name),'IT',v_candidate.website_url,
    lower(btrim(v_candidate.canonical_domain)),
    CASE WHEN EXISTS(SELECT 1 FROM private.net_it_growth13_vat_proofs p
         WHERE p.candidate_id=v_candidate.id)
         THEN v_candidate.vat_id ELSE NULL END,
    'published','unclaimed','unverified'
  ) RETURNING id INTO v_company;$new$;
 IF (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN
 RAISE EXCEPTION 'AUTO3 VAT insert source changed'; END IF;
 EXECUTE replace(src,a,b);

 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_queue';
 a:=$old$               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               -- GROWTH12: fresh proof needed$old$;
 b:=$new$               WHEN e.verdict='identity_supported'
               THEN interval '2 days'
               WHEN e.verdict='needs_human'
                AND e.evidence->>'catalog_collision'='true'
                AND EXISTS(SELECT 1 FROM private.net_it_growth13_vat_proofs p
                   WHERE p.candidate_id=c.id
                     AND private.net_it_growth13_distinct_vat(c.id,p.existing_company_id))
               THEN interval '10 minutes'
               -- GROWTH12: fresh proof needed$new$;
 IF src IS NULL OR (length(src)-length(replace(src,a,'')))/length(a)<>1 THEN
 RAISE EXCEPTION 'AUTO2 cooldown source changed'; END IF;
 EXECUTE replace(src,a,b);
END;
$vat_guard$;

DO $proof_checks$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto3_release';
 IF src IS NULL OR
 (length(src)-length(replace(src,'net_it_growth13_distinct_vat','')))/
 length('net_it_growth13_distinct_vat')<>2
 OR position('net_it_auto2_discards' in src)=0
 OR position('pg_advisory_xact_lock' in src)=0
 OR position('v_evidence.observed_business_name' in src)=0
 THEN RAISE EXCEPTION 'AUTO3 audited VAT release proof incomplete'; END IF;
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_auto2_record';
 IF src IS NULL OR position('net_it_growth13_distinct_vat' in src)=0
 OR position('p_rights_state' in src)=0
 THEN RAISE EXCEPTION 'AUTO2 recorded evidence proof incomplete'; END IF;
END;
$proof_checks$;
