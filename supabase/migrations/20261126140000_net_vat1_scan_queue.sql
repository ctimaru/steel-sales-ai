-- NET-VAT1 fase 2 (founder, 26 nov 2026): raccolta mirata della P.IVA sui siti
-- ufficiali delle aziende pubblicate che non l'hanno ancora.
-- La pipeline su Railway visita footer, Contatti, Note legali e Privacy del
-- dominio ufficiale e registra l'esito qui. La scrittura nel profilo passa
-- sempre da private.net_vat1_apply (fase 1): codice di controllo, dominio
-- ufficiale, nessuna sovrascrittura. Al massimo 3 tentativi per azienda,
-- a distanza di almeno 3 giorni (stessa regola dei siti irraggiungibili).

CREATE TABLE IF NOT EXISTS private.network_company_vat_scan_attempts (
  company_id uuid PRIMARY KEY REFERENCES public.network_companies(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_attempt_at timestamptz,
  last_outcome text CHECK (last_outcome IS NULL OR char_length(last_outcome) <= 64),
  leased_until timestamptz
);
ALTER TABLE private.network_company_vat_scan_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_company_vat_scan_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.net_vat1_scan_queue(p_max integer DEFAULT 40)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  WITH picked AS (
    SELECT n.id, n.website_url, regexp_replace(lower(n.website_domain), '^www\.', '') AS domain,
           n.legal_name
    FROM public.network_companies n
    LEFT JOIN private.network_company_vat_scan_attempts a ON a.company_id = n.id
    WHERE n.country_code = 'IT' AND n.publication_status = 'published'
      AND n.archived_at IS NULL AND n.vat_id IS NULL
      AND n.website_url LIKE 'https://%' AND n.website_domain IS NOT NULL
      AND coalesce(a.attempts, 0) < 3
      AND (a.last_attempt_at IS NULL OR a.last_attempt_at < now() - interval '3 days')
      AND (a.leased_until IS NULL OR a.leased_until < now())
    ORDER BY coalesce(a.attempts, 0), n.created_at
    LIMIT greatest(1, least(coalesce(p_max, 40), 50))
    FOR UPDATE OF n SKIP LOCKED
  ), leased AS (
    INSERT INTO private.network_company_vat_scan_attempts(company_id, leased_until)
    SELECT id, now() + interval '30 minutes' FROM picked
    ON CONFLICT (company_id) DO UPDATE SET leased_until = excluded.leased_until
    RETURNING company_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'website_url', p.website_url, 'domain', p.domain,
           'legal_name', p.legal_name)), '[]'::jsonb)
    INTO v_items
  FROM picked p JOIN leased l ON l.company_id = p.id;
  RETURN jsonb_build_object('contract', 'net-vat1-scan-queue-v1', 'items', v_items);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_scan_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_vat1_scan_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.net_vat1_record_scan(
  p_company_id uuid, p_vat text, p_page_url text, p_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('found', 'not_found', 'ambiguous', 'unreachable') THEN
    RAISE EXCEPTION 'Invalid scan outcome' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.network_company_vat_scan_attempts
                 WHERE company_id = p_company_id) THEN
    RAISE EXCEPTION 'Company was not leased for a VAT scan' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'found' THEN
    v_outcome := private.net_vat1_apply(p_company_id, p_vat, p_page_url, 'firstparty_scan');
  ELSE
    v_outcome := p_outcome;
  END IF;
  UPDATE private.network_company_vat_scan_attempts
  SET attempts = attempts + 1, last_attempt_at = now(), last_outcome = v_outcome,
      leased_until = NULL
  WHERE company_id = p_company_id;
  RETURN jsonb_build_object('contract', 'net-vat1-record-scan-v1', 'outcome', v_outcome);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_record_scan(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_vat1_record_scan(uuid, text, text, text) TO service_role;
