-- NET-IT-GROWTH8.C: source-specific first-party menu contamination
-- correction. All unrelated AUTO3 safety, rights and approval rules remain.
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
  -- GROWTH8.C: a service menu prefix is not part of a company name.
  -- Observed false-positive: 'Installazione Servizio GRU Carpenteria Luca Piccinini Srl'.
  AND lower(v_name) !~ '^installazione[[:space:]]+servizio[[:space:]]+gru[[:space:]]+'
  -- at most 6 words before the legal form
  AND coalesce(array_length(regexp_split_to_array(v_core,'[[:space:]]+'),1),0) <= 6;
END
$function$;

DO $regression$
BEGIN
 IF private.net_it_legal_name_quality_ok('Installazione Servizio GRU Carpenteria Luca Piccinini Srl')
 OR NOT private.net_it_legal_name_quality_ok('Carpenteria Luca Piccinini Srl')
 OR NOT private.net_it_legal_name_quality_ok('GLK Srl')
 OR NOT private.net_it_legal_name_quality_ok('SUD FERRO S.R.L. UNIPERSONALE') THEN
  RAISE EXCEPTION 'GROWTH8.C name quality regression';
 END IF;
END;
$regression$;
