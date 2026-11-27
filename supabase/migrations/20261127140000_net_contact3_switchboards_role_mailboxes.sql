-- NET-CONTACT3 (founder, 27 nov 2026): smaltire la coda dei contatti in
-- revisione. Oltre alle caselle commerciali/generiche di PROD-EMAIL1.B si
-- pubblicano in automatico:
--   * i centralini: numeri fissi (Italia +39 0…, numeri verdi +39 800/803;
--     Romania +40 2…/+40 3…) letti sul sito ufficiale, senza email;
--   * le caselle di ruolo sul dominio aziendale (amministrazione@,
--     ufficiotecnico@, acquisti@, segreteria@, direzione@…).
-- Mai cellulari, nomi di persona o caselle fuori dominio: quelle restano alla
-- revisione umana. Stessi requisiti di provenienza di PROD-EMAIL1.B
-- (asserzione NET-CONTACT1 da pagina HTTPS del dominio ufficiale) e stesso
-- registro degli eventi.

CREATE OR REPLACE FUNCTION private.net_contact3_auto_review(p_limit integer DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $fn$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_published integer := 0;
  v_rec record;
  v_before jsonb;
  v_after public.network_contacts%rowtype;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'system company-channel review is service-only' USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT nc.id,
           CASE WHEN nc.email IS NULL THEN 'switchboard' ELSE 'role_mailbox' END AS kind
    FROM public.network_contacts nc
    JOIN public.network_companies c ON c.id = nc.company_id
    JOIN public.network_data_assertions a ON a.id = nc.source_assertion_id
    WHERE nc.publication_status = 'pending_review' AND nc.archived_at IS NULL
      AND c.publication_status = 'published' AND c.archived_at IS NULL
      AND nc.privacy_classification = 'unreviewed' AND nc.privacy_legal_basis = 'not_assessed'
      AND nc.lia_status = 'not_assessed' AND nc.art14_status = 'not_assessed'
      AND nc.privacy_reviewed_at IS NULL AND nc.privacy_reviewed_by IS NULL
      AND nc.privacy_review_actor_type IS NULL
      AND a.entity_type = 'company' AND a.entity_id = nc.company_id
      AND a.field_path = 'netcontact1_public_company_channel'
      AND a.source_type = 'public_web' AND a.source_reference = nc.source_reference
      AND a.ownership_type = 'platform_curated' AND a.review_state = 'pending'
      AND coalesce(a.confidence, 0) >= 0.9
      AND nc.source_reference ~ '^https://' AND nc.source_obtained_at IS NOT NULL
      AND (
        split_part(regexp_replace(lower(nc.source_reference), '^https://', ''), '/', 1)
          IN (lower(regexp_replace(coalesce(c.website_domain, ''), '^www\.', '')),
              'www.' || lower(regexp_replace(coalesce(c.website_domain, ''), '^www\.', '')))
        OR split_part(regexp_replace(lower(nc.source_reference), '^https://', ''), '/', 1)
          LIKE '%.' || lower(regexp_replace(coalesce(c.website_domain, ''), '^www\.', ''))
      )
      AND (
        -- centralino: solo numeri fissi, nessuna email
        (nc.email IS NULL AND nc.phone ~ '^\+(390[0-9]{5,10}|3980[03][0-9]{3,7}|40[23][0-9]{7,8})$')
        OR
        -- casella di ruolo sul dominio aziendale (telefono, se c'è, solo fisso)
        (nc.email IS NOT NULL
         AND private.netcontact1_domain_matches(nc.email, c.website_domain)
         AND split_part(lower(btrim(nc.email)), '@', 1) ~
           '^(sales|commerciale|commerciali|vendite|vendita|ufficio[._-]?commerciale|ordini|orders|offerte|preventivi|quotes|export|import|info|informazioni|contatti|contact|contacts|office|mail|posta|hello|amministrazione|admin|administration|contabilita|acquisti|ufficio[._-]?acquisti|purchasing|procurement|tecnico|ufficio[._-]?tecnico|technical|qualita|quality|produzione|production|logistica|logistics|spedizioni|shipping|magazzino|warehouse|segreteria|direzione|marketing|assistenza|service|support|servizio[._-]?clienti|customer[._-]?(service|care))([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$'
         AND (nc.phone IS NULL OR nc.phone ~ '^\+(390[0-9]{5,10}|3980[03][0-9]{3,7}|40[23][0-9]{7,8})$'))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_contacts x
        WHERE x.company_id = nc.company_id AND x.id <> nc.id AND x.archived_at IS NULL
          AND x.publication_status = 'published'
          AND ((nc.email IS NOT NULL AND lower(btrim(x.email)) = lower(btrim(nc.email)))
               OR (nc.email IS NULL AND x.phone = nc.phone))
      )
    ORDER BY nc.source_obtained_at, nc.id
    LIMIT v_limit
    FOR UPDATE OF nc SKIP LOCKED
  LOOP
    SELECT jsonb_build_object(
      'publication_status', nc.publication_status, 'privacy_classification', nc.privacy_classification,
      'privacy_legal_basis', nc.privacy_legal_basis, 'lia_status', nc.lia_status,
      'art14_status', nc.art14_status, 'privacy_review_actor_type', nc.privacy_review_actor_type)
    INTO v_before FROM public.network_contacts nc WHERE nc.id = v_rec.id;

    UPDATE public.network_contacts
    SET privacy_classification = 'company_channel',
        privacy_legal_basis = 'not_applicable_company_data',
        lia_status = 'not_required', art14_status = 'not_required',
        art14_due_at = NULL, art14_delivered_at = NULL, art14_notice_version = NULL,
        art14_notice_channel = NULL, art14_exception_reason = NULL,
        privacy_reviewed_by = NULL, privacy_reviewed_at = now(),
        privacy_review_expires_at = now() + interval '12 months',
        privacy_review_note = CASE WHEN v_rec.kind = 'switchboard'
          THEN 'NET-CONTACT3 automated review: company switchboard (landline) observed on official company website'
          ELSE 'NET-CONTACT3 automated review: company role mailbox observed on official company website' END,
        privacy_review_actor_type = 'system',
        publication_status = 'published'
    WHERE id = v_rec.id AND publication_status = 'pending_review' AND privacy_reviewed_at IS NULL
    RETURNING * INTO v_after;

    IF FOUND THEN
      INSERT INTO public.network_data_governance_events(
        subject_type, subject_id, action, actor_user_id, actor_type, before_state, after_state, note)
      VALUES ('network_contact', v_rec.id, 'contact_privacy_reviewed', NULL, 'system', v_before,
        jsonb_build_object('publication_status', v_after.publication_status,
          'privacy_classification', v_after.privacy_classification,
          'privacy_legal_basis', v_after.privacy_legal_basis, 'lia_status', v_after.lia_status,
          'art14_status', v_after.art14_status, 'source_obtained_at', v_after.source_obtained_at,
          'privacy_review_expires_at', v_after.privacy_review_expires_at,
          'privacy_review_actor_type', v_after.privacy_review_actor_type),
        'NET-CONTACT3 system review (founder decision 27 nov 2026): ' || v_rec.kind);
      v_published := v_published + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('contract', 'net-contact3-auto-review-v1', 'published', v_published);
END
$fn$;
REVOKE ALL ON FUNCTION private.net_contact3_auto_review(integer) FROM PUBLIC, anon, authenticated;

-- Il servizio Railway net-contact2-collector pubblica a fine giro: ora anche
-- centralini e caselle di ruolo.
CREATE OR REPLACE FUNCTION public.net_contact2_auto_publish(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_first jsonb;
  v_second jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  v_first := private.netcontact1_auto_review_company_channels(
    least(greatest(coalesce(p_limit, 100), 1), 200), NULL, true);
  v_second := private.net_contact3_auto_review(least(greatest(coalesce(p_limit, 100), 1), 200));
  RETURN v_first || jsonb_build_object(
    'published', coalesce((v_first->>'published')::integer, 0) + coalesce((v_second->>'published')::integer, 0),
    'net_contact3_published', coalesce((v_second->>'published')::integer, 0));
END
$fn$;
REVOKE ALL ON FUNCTION public.net_contact2_auto_publish(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_contact2_auto_publish(integer) TO service_role;

-- Smaltimento immediato della coda attuale.
SELECT private.net_contact3_auto_review(1000);
