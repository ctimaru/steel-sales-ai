-- NET-IT-CARP-MASS1: reject flattened editorial prefixes in legal names.
-- Fixes an AUTO3 false positive without rewriting any publisher policy,
-- changing delegated limits, deleting candidates, or publishing records.
DO $patch$
DECLARE
  v_function text;
  v_before text := $before$  -- at most 6 words before the legal form$before$;
  v_after text := $after$  -- CARP-MASS1: flattened About Us / Chi siamo heading is not legal identity.
  -- Keep a legitimate company named "About Us S.r.l." eligible: this
  -- predicate needs a third name token followed by a corporate suffix.
  AND lower(v_name) !~ '^(about[[:space:]]+us|chi[[:space:]]+siamo)[[:space:]]+.+[[:space:]]+(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
  -- at most 6 words before the legal form$after$;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_function
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_legal_name_quality_ok';
 IF v_function IS NULL
   OR (length(v_function)-length(replace(v_function,v_before,'')))/length(v_before)<>1
   OR position('installazione[[:space:]]+servizio[[:space:]]+gru' in v_function)=0
 THEN
   RAISE EXCEPTION 'CARP-MASS1 quality function missing or drifted';
 END IF;
 EXECUTE replace(v_function,v_before,v_after);
END;
$patch$;

DO $regression$
BEGIN
 IF private.net_it_legal_name_quality_ok('ABOUT US Barbarino SNC')
 OR private.net_it_legal_name_quality_ok('Chi siamo Carpenteria Esempio S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('About Us S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('Carpenteria Luca Piccinini Srl')
 OR NOT private.net_it_legal_name_quality_ok('SUD FERRO S.R.L. UNIPERSONALE')
 OR NOT private.net_it_legal_name_quality_ok('GLK Srl') THEN
    RAISE EXCEPTION 'CARP-MASS1 legal-name quality regression';
 END IF;
END;
$regression$;
