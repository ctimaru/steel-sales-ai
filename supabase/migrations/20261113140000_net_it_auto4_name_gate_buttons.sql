-- NET-IT-AUTO4-NAME2 — button/widget words in the company-name gate
-- (13 Nov 2026, explicit founder instruction "applica il filtro pulsanti").
-- Second v4 run published "Info Metal Tech Srls", "M.G. Srl? M.G. Srl" and
-- "Pulsante C.T.L. LAVORAZIONE LAMIERE srl". Only the name-check function
-- changes; AUTO3 and the PA1.5 guard already call it.
-- APPLIED to production 13 Nov 2026 ~13:05 UTC (md5 verified).

CREATE OR REPLACE FUNCTION private.net_it_legal_name_quality_ok(p_name text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $namecheck$
DECLARE
 v_name text := btrim(coalesce(p_name,''));
 v_core text;
BEGIN
 v_core := btrim(regexp_replace(v_name,
   '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$).*$',
   '', 'i'));
 RETURN v_name <> '' AND v_core <> ''
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND v_name ~ '^[[:upper:]]'
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
$namecheck$;
REVOKE ALL ON FUNCTION private.net_it_legal_name_quality_ok(text) FROM PUBLIC,anon,authenticated;
