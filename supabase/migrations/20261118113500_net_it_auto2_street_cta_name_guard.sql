-- NET-IT-AUTO2-NAME2: harden AUTO3 legal-name quality against first-party
-- flattened addresses and contact buttons (Overture3/4 18-Nov-2026).
-- The existing private function and access model are preserved; no grants,
-- new public endpoints or autonomous publications are introduced.
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
  -- An address like "C.da Piana snc" means SENZA NUMERO CIVICO, not a legal S.n.c.
  AND lower(v_name) !~ '^(c[.]?[[:space:]]*da|contrada|via|viale|piazza|corso|strada|localit[aà])[[:space:]]+.+[[:space:]]+s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]][[:space:]][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- Names copied from flattened UI widgets are not legal entities.
  -- Do not confuse a website's "Immagini" or "Dom Chiuso" controls
  -- with the company owning that website.
  AND lower(v_name) !~ '^(dom[[:space:]]+chiuso|immagini|images|fotografie|gallery|galleria|foto|visualizza)[[:space:]]+'

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

  -- "CONTATTACI ORA VITAL SRL": a flattened CTA must not become legal name.
  -- This is intentionally fail-closed: reviewer must evidence the clean name.
  AND lower(v_name) !~ '^ora[[:space:]]+.+[[:space:]]+s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]][[:space:]][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- Names copied from flattened UI widgets are not legal entities.
  -- Do not confuse a website's "Immagini" or "Dom Chiuso" controls
  -- with the company owning that website.
  AND lower(v_name) !~ '^(dom[[:space:]]+chiuso|immagini|images|fotografie|gallery|galleria|foto|visualizza)[[:space:]]+'

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

  -- A first-party call-to-action is not part of an industrial company's name.
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]][[:space:]][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- Names copied from flattened UI widgets are not legal entities.
  -- Do not confuse a website's "Immagini" or "Dom Chiuso" controls
  -- with the company owning that website.
  AND lower(v_name) !~ '^(dom[[:space:]]+chiuso|immagini|images|fotografie|gallery|galleria|foto|visualizza)[[:space:]]+'

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


COMMENT ON FUNCTION private.net_it_legal_name_quality_ok(text) IS
  'Rejects UI, legal-name contamination, and address snc vs true legal SNC';
