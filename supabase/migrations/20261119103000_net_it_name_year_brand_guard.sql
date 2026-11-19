-- NET-IT-GROWTH / 19 Nov 2026: surgically fix first-party legal-name false negatives.
-- Keep original gate: reject copyright-year prefix, UI headers, bylines,
-- emails, domain fragments, phone numbers and excessive text.
-- AUTO3 still requires fresh, verified first-party identity + anti-duplication.
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
  -- at most 6 words before the legal form
  AND coalesce(array_length(regexp_split_to_array(v_core,'[[:space:]]+'),1),0) <= 6;
END
$function$;

DO $net_it_name_guard_regression$
BEGIN
  IF NOT private.net_it_legal_name_quality_ok('Sider 2012 Srl')
     OR NOT private.net_it_legal_name_quality_ok('Crestani 2000 S.r.l.')
     OR NOT private.net_it_legal_name_quality_ok('2C-Steel Lab s.r.l.')
     OR NOT private.net_it_legal_name_quality_ok('3Erre Saldature Inox Srl') THEN
    RAISE EXCEPTION 'Valid first-party corporate names rejected';
  END IF;
  IF private.net_it_legal_name_quality_ok('2022 by Cogne Acciai S.p.A.')
     OR private.net_it_legal_name_quality_ok('Giada Cusano Responsabile Commerciale METALSTAR 2000 S.r.l.')
     OR private.net_it_legal_name_quality_ok('Immagini Coltro Srl')
     OR private.net_it_legal_name_quality_ok('Contattaci per maggiori informazioni O&T S.r.l.')
     OR private.net_it_legal_name_quality_ok('2017 T.&D. S.r.l.') THEN
    RAISE EXCEPTION 'Contaminated or copyright-prefixed identity accepted';
  END IF;
END;
$net_it_name_guard_regression$;
