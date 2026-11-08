-- NET-RO1.GROWTH9.CONTACT1 — Romanian generic company inboxes.
-- The existing NET-CONTACT1 policy intentionally allows role-based company
-- mailboxes and excludes personal / off-company-domain addresses. Romanian
-- generic inbox names were not included: secretariat, vanzari, comercial.
-- ONLY add the three role-based aliases; source, same-domain check, review,
-- notice/legitimate-interest requirements, and publication status unchanged.
create or replace function private.netcontact1_generic_local_part(p_local text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
  select lower(btrim(coalesce(p_local,''))) ~ (
    '^(info|informazioni|contatti|contact|contacts|commerciale|commerciali|vendite|vendita|sales|'
    'ufficio\.?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export|'
    'italia|segreteria|secretariat|vanzari|comercial|office|mail|posta|amministrazione|acquisti|purchasing|tecnico|technical|'
    'ufficio\.?tecnico|ufficiotecnico|logistica|spedizioni|customer\.?service|servizio\.?clienti|'
    'assistenza|support|qualita|quality|marketing|direzione|reception|centralino|azienda|company|hello)'
    '([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$'
  );
$function$;

REVOKE ALL ON FUNCTION private.netcontact1_generic_local_part(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.netcontact1_generic_local_part(text)
  TO authenticated, service_role;
