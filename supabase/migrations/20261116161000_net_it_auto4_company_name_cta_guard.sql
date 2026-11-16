-- NET-IT-PIEMONTE1 / NAME-GATE — preserve existing quality checks.
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
  -- A first-party call-to-action is not part of an industrial company's name.
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
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
$function$;


-- Narrow provenance-backed correction of one polluted Piemonte AUTO3 name.
-- Keep discovery candidate as historic evidence; adjust published name only.
CREATE TABLE IF NOT EXISTS private.net_it_name_quality_corrections (
 company_id uuid NOT NULL REFERENCES public.network_companies(id),
 old_name text NOT NULL,
 corrected_name text NOT NULL,
 source_url text NOT NULL,
 reason text NOT NULL,
 corrected_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,old_name)
);
ALTER TABLE private.net_it_name_quality_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_name_quality_corrections
  FROM PUBLIC,anon,authenticated,service_role;

WITH candidates AS (
 SELECT n.id,n.legal_name,c.source_url
 FROM public.network_companies n
 JOIN public.network_company_discovery_candidates c
 ON c.promoted_company_id=n.id AND c.canonical_domain='officinepiva.it'
 JOIN private.net_it_auto3_publications a
 ON a.candidate_id=c.id AND a.company_id=n.id
 WHERE n.country_code='IT' AND n.website_domain='officinepiva.it'
 AND n.publication_status='published' AND n.claimed_status='unclaimed'
 AND n.verification_status='unverified' AND n.archived_at IS NULL
 AND n.legal_name='Chiama ora OFFICINE PIVA S.r.l.'
 AND c.review_status='published' AND c.legal_name=n.legal_name
 AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(c.evidence,'[]'::jsonb)) e(item)
   WHERE lower(regexp_replace(
     split_part(split_part(e.item->>'url','/',3),':',1),'^www[.]',''))
     = 'officinepiva.it'
     AND e.item->>'snippet' ILIKE '%Officine Piva Srl%'
 )
),
audited AS (
 INSERT INTO private.net_it_name_quality_corrections(
   company_id,old_name,corrected_name,source_url,reason
 )
 SELECT id,legal_name,'Officine Piva S.r.l.',source_url,
   'NET-IT-AUTO4: remove "Chiama ora" CTA copied from first-party website into company name'
 FROM candidates ON CONFLICT(company_id,old_name) DO NOTHING
 RETURNING company_id
)
UPDATE public.network_companies n
SET legal_name='Officine Piva S.r.l.'
FROM audited a
WHERE n.id=a.company_id
 AND n.legal_name='Chiama ora OFFICINE PIVA S.r.l.';
