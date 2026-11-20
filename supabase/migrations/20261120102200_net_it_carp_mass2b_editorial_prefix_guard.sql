-- NET-IT-CARP-MASS2B: clean flattened editorial page prefixes from legal names.
-- Publisher rights/permissions, PII, roles, identity evidence and dedup unchanged.
DO $patch$
DECLARE
 v_function text;
 v_before text := $before$  -- at most 6 words before the legal form$before$;
 v_after text := $after$  -- MASS2B: extracted site menu "Mission In" is not part of the company name.
  -- Preserve a legitimate short legal entity "Mission In Srl".
  AND lower(v_name) !~ '^mission[[:space:]]+in[[:space:]]+.+[[:space:]]+(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?)([^[:alnum:]]|$)'
  -- MASS2B: "Realizzazione e Allestimenti La ..." is a flattened page heading.
  AND lower(v_name) !~ '^realizzazione[[:space:]]+e[[:space:]]+allestimenti[[:space:]]+la[[:space:]]+.+[[:space:]]+(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?)([^[:alnum:]]|$)'
  -- at most 6 words before the legal form$after$;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_function
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='net_it_legal_name_quality_ok';
 IF v_function IS NULL
    OR (length(v_function)-length(replace(v_function,v_before,'')))/length(v_before) <> 1
    OR position('about[[:space:]]+us' IN v_function)=0
    OR position('installazione[[:space:]]+servizio[[:space:]]+gru' IN v_function)=0
 THEN
   RAISE EXCEPTION 'CARP-MASS2B legal-name function drift';
 END IF;
 EXECUTE replace(v_function,v_before,v_after);
END;
$patch$;

DO $regression$
BEGIN
 IF private.net_it_legal_name_quality_ok('Mission In Comic Srl')
 OR private.net_it_legal_name_quality_ok('REALIZZAZIONE E ALLESTIMENTI La Fratelli Marotta srl')
 OR private.net_it_legal_name_quality_ok('ABOUT US Barbarino SNC')
 OR NOT private.net_it_legal_name_quality_ok('Mission In Srl')
 OR NOT private.net_it_legal_name_quality_ok('Fratelli Marotta S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('Global Welding S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('GLK Srl') THEN
   RAISE EXCEPTION 'CARP-MASS2B legal-name quality regression';
 END IF;
END;
$regression$;
