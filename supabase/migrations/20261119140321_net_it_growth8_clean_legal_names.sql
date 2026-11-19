-- NET-IT-GROWTH8. Only rejects names containing flattened HTML/CTA,
-- editorial text and addresses. Does NOT authorize or publish any record.
-- AUTO3, AUTO2 correction and readback share this mandatory quality check.
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
  -- Reject a street address whose SNC means senza numero civico.
  AND lower(v_name) !~ '^(c[.]?[[:space:]]*da|contrada|via|viale|piazza|corso|strada|localit[aà])[[:space:]]+.+[[:space:]]+s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?$'
  -- Credits is a flattened page-navigation label, not part of a multiword company name.
  -- A legitimate one-word brand 'Credits S.r.l.' is not rejected.
  AND lower(v_name) !~ '^credits?[[:space:]]+.+[[:space:]]+(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)[[:space:]]*$'
  -- Reject flattened CTA 'CONTATTACI ORA VITAL SRL' without banning true ORA Srl.
  AND lower(v_name) !~ '^ora[[:space:]]+.+[[:space:]]+s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?$'
  -- A first-party call-to-action is not part of an industrial company's name.
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- Names copied from flattened UI widgets are not legal entities.
  -- Do not confuse a website's "Immagini" or "Dom Chiuso" controls
  -- with the company owning that website.
  AND lower(v_name) !~ '^(dom[[:space:]]+chiuso|immagini|images|fotografie|gallery|galleria|foto|visualizza)[[:space:]]+'
  -- A salesperson byline is never the legal company name.
  AND lower(v_name) !~ '(^|[^[:alpha:]])responsabile([^[:alpha:]]|$)'

  -- NET-IT-AUTO4-NAME2: no question/exclamation marks ("M.G. Srl? M.G. Srl")
  AND v_name !~ '[?!]'
  -- no phone-like or date-like digit groups
  AND v_name !~ '[0-9]{3,}[ ./-]+[0-9]{3,}'
  AND v_name !~ '^[[:space:]]*(19|20)[0-9]{2}([^[:alnum:]]|$)'
  -- no sentence end inside the name ("... gratuiti. VIBEL")
  AND v_name !~ '[[:alpha:]]{4,}[.][[:space:]]'
  -- no navigation, contact, privacy or marketing words
  AND lower(v_name) !~ '(^|[^[:alpha:]])(home|homepage|contatti|contattaci|news|privacy|cookie|cookies|gdpr|titolare|trattamento|informativa|copyright|messaggio|politica|ditta|azienda|località|localita|scegli|preventivi|preventivo|fornirvi|qualità|qualita|benvenuti|telefono|tel|fax|email|pec|sede|menu|info|pulsante|button|clicca|click|scarica|download|vai|torna)([^[:alpha:]]|$)'
  -- GROWTH8: no flattened page controls, editorial prefixes or addresses.
  AND lower(v_name) !~ '^(continua|leggere[[:space:]]+di[[:space:]]+pi[uù]|rivista|dal[[:space:]]+(19|20)[0-9]{2})([^[:alpha:]]|$)'
  AND lower(v_name) !~ '(^|[[:space:]])(zona[[:space:]]+artigianale|zona[[:space:]]+industriale|contrada|c[.]?[[:space:]]*da|via[[:space:]]+[[:alpha:]]{3,}|viale[[:space:]]+[[:alpha:]]{3,})([[:space:]]|$)'
  AND lower(v_name) !~ '^(abruzzo|piemonte|lombardia|veneto|lazio|puglia|calabria|campania|toscana|sicilia|sardegna)[[:space:]]+(la|il|lo|le|i|gli)[[:space:]]+'
  -- at most 6 words before the legal form
  AND coalesce(array_length(regexp_split_to_array(v_core,'[[:space:]]+'),1),0) <= 6;
END
$function$;
CREATE OR REPLACE FUNCTION private.net_it_auto2_correct_identity(p_candidate_id uuid, p_legal_name text, p_vat_id text, p_page_url text, p_reviewer_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_c public.network_company_discovery_candidates%rowtype;
 v_name text := btrim(coalesce(p_legal_name,''));
 v_vat text := nullif(btrim(coalesce(p_vat_id,'')),'');
 v_host text := lower(split_part(split_part(coalesce(p_page_url,''),'/',3),':',1));
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Service research role required' USING ERRCODE='42501';
 END IF;
 IF p_reviewer_version IS DISTINCT FROM 'net-it-auto2-firstparty-v4'
    OR char_length(v_name) NOT BETWEEN 3 AND 255
    OR v_name !~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
    OR NOT private.net_it_legal_name_quality_ok(v_name)
    OR (v_vat IS NOT NULL AND v_vat !~ '^[0-9]{11}
    OR p_page_url IS NULL OR p_page_url !~* '^https://' THEN
  RAISE EXCEPTION 'Invalid identity correction' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_c FROM public.network_company_discovery_candidates
  WHERE id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR v_c.country_code<>'IT' OR v_c.review_status<>'pending_review'
    OR v_c.governance_status<>'unreviewed' THEN
  RAISE EXCEPTION 'Candidate not available for identity correction' USING ERRCODE='22023';
 END IF;
 IF v_host NOT IN (lower(btrim(v_c.canonical_domain)),'www.'||lower(btrim(v_c.canonical_domain))) THEN
  RAISE EXCEPTION 'Identity must come from the company-owned domain' USING ERRCODE='22023';
 END IF;
 UPDATE public.network_company_discovery_candidates
 SET legal_name=v_name,
     vat_id=coalesce(vat_id,v_vat),
     enrichment_quality=coalesce(enrichment_quality,'{}'::jsonb)||jsonb_build_object(
       'net_it_auto4_identity_correction',jsonb_build_object(
         'previous_legal_name',left(v_c.legal_name,255),'legal_name',v_name,
         'vat_id_found',v_vat,'page_url',left(p_page_url,1024),
         'reviewer_version',p_reviewer_version,'at',now()))
 WHERE id=p_candidate_id;
 RETURN jsonb_build_object('contract','net-it-auto2-identity-v1',
  'candidate_id',p_candidate_id,'legal_name',v_name,
  'previous_legal_name',v_c.legal_name,'publication_count',0);
END
$function$
)
    OR p_page_url IS NULL OR p_page_url !~* '^https://' THEN
  RAISE EXCEPTION 'Invalid identity correction' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_c FROM public.network_company_discovery_candidates
  WHERE id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR v_c.country_code<>'IT' OR v_c.review_status<>'pending_review'
    OR v_c.governance_status<>'unreviewed' THEN
  RAISE EXCEPTION 'Candidate not available for identity correction' USING ERRCODE='22023';
 END IF;
 IF v_host NOT IN (lower(btrim(v_c.canonical_domain)),'www.'||lower(btrim(v_c.canonical_domain))) THEN
  RAISE EXCEPTION 'Identity must come from the company-owned domain' USING ERRCODE='22023';
 END IF;
 UPDATE public.network_company_discovery_candidates
 SET legal_name=v_name,
     vat_id=coalesce(vat_id,v_vat),
     enrichment_quality=coalesce(enrichment_quality,'{}'::jsonb)||jsonb_build_object(
       'net_it_auto4_identity_correction',jsonb_build_object(
         'previous_legal_name',left(v_c.legal_name,255),'legal_name',v_name,
         'vat_id_found',v_vat,'page_url',left(p_page_url,1024),
         'reviewer_version',p_reviewer_version,'at',now()))
 WHERE id=p_candidate_id;
 RETURN jsonb_build_object('contract','net-it-auto2-identity-v1',
  'candidate_id',p_candidate_id,'legal_name',v_name,
  'previous_legal_name',v_c.legal_name,'publication_count',0);
END
$function$;

DO $growth8_test$
BEGIN
 IF private.net_it_legal_name_quality_ok('CONTINUA METAL SEBINA SRL')
 OR private.net_it_legal_name_quality_ok('Abruzzo La GLK Srl')
 OR private.net_it_legal_name_quality_ok('SUD FERRO Contrada Cannavà SNC')
 OR private.net_it_legal_name_quality_ok('TERMOFABBRIALLUMINIO Via Carmelia SNC')
 OR private.net_it_legal_name_quality_ok('OFFICINA PORTAS Zona Artigianale Candiatzus SNC')
 OR private.net_it_legal_name_quality_ok('Leggere di più Leghe Leggere Lavorate S.r.l.')
 OR private.net_it_legal_name_quality_ok('Rivista Le Case di Elixir Eolo Srl')
 OR private.net_it_legal_name_quality_ok('Dal 1950 ICOS di Leonelli Marino S.p.A.') THEN
   RAISE EXCEPTION 'GROWTH8: HTML/CTA/address contamination accepted';
 END IF;
 IF NOT private.net_it_legal_name_quality_ok('METAL SEBINA SRL')
 OR NOT private.net_it_legal_name_quality_ok('GLK S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('OFFICINA PORTAS SNC')
 OR NOT private.net_it_legal_name_quality_ok('Deama 1989 spa')
 OR NOT private.net_it_legal_name_quality_ok('Carpenteria Dallago S.r.l.')
 OR NOT private.net_it_legal_name_quality_ok('Via S.r.l.') THEN
   RAISE EXCEPTION 'GROWTH8: legitimate legal brand incorrectly rejected';
 END IF;
END;
$growth8_test$;