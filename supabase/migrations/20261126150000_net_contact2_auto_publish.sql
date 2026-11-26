-- NET-CONTACT2 (founder, 26 nov 2026): campagna email del Network.
-- NET-CONTACT1 raccoglie già le caselle aziendali generiche dai siti ufficiali
-- (regole del 2 nov 2026: solo info@, commerciale@, vendite@… sul dominio
-- dell'azienda e il centralino; mai nomi di persona, cellulari, Gmail/Libero)
-- e PROD-EMAIL1.B le pubblica dopo un controllo automatico e tracciato.
-- Entrambi i passi però partivano a mano. Il servizio Railway
-- net-contact2-collector li esegue in automatico: questa funzione è il solo
-- punto d'accesso, per il ruolo di servizio, alla pubblicazione automatica
-- già esistente. Nessuna regola nuova: le caselle non generiche e i telefoni
-- restano in revisione umana (LR4) come oggi.

CREATE OR REPLACE FUNCTION public.net_contact2_auto_publish(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  RETURN private.netcontact1_auto_review_company_channels(
    least(greatest(coalesce(p_limit, 100), 1), 200), NULL, true);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_contact2_auto_publish(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_contact2_auto_publish(integer) TO service_role;
