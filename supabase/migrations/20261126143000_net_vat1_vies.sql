-- NET-VAT1 fase 3 (founder, 26 nov 2026): controllo incrociato delle P.IVA
-- con VIES, il servizio ufficiale della Commissione europea.
--
-- Per l'Italia VIES contiene solo le P.IVA abilitate alle operazioni
-- intracomunitarie: «non presente in VIES» NON significa P.IVA errata, quindi
-- non nasconde nulla. VIES conta solo in positivo, con due eccezioni:
--   * valida ma intestata a un'altra azienda (nessuna parola del nome in
--     comune: tipico della P.IVA della web agency nel footer) -> la P.IVA
--     esce dal profilo, va nella coda delle eccezioni e non viene riapplicata
--     (controllo in private.net_vat1_apply, fase 1);
--   * valida e intestata all'azienda -> «verificata VIES» sulla scheda, un
--     segnale per la futura spunta «azienda verificata».
-- Si salva solo il nome registrato (dato aziendale), non l'indirizzo.

CREATE TABLE IF NOT EXISTS private.network_company_vat_vies (
  company_id uuid PRIMARY KEY REFERENCES public.network_companies(id) ON DELETE CASCADE,
  vat_id text NOT NULL CHECK (vat_id ~ '^[0-9]{11}$'),
  status text CHECK (status IS NULL OR status IN ('valid', 'not_in_vies')),
  name_match text CHECK (name_match IS NULL OR name_match IN ('match', 'mismatch', 'unknown')),
  registered_name text CHECK (registered_name IS NULL OR char_length(registered_name) <= 255),
  checked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 64),
  leased_until timestamptz
);
ALTER TABLE private.network_company_vat_vies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_company_vat_vies FROM PUBLIC, anon, authenticated;

-- P.IVA italiane pubblicate mai controllate, o controllate da oltre 180 giorni;
-- i servizi nazionali spesso non rispondono: si riprova, al massimo 10 volte.
CREATE OR REPLACE FUNCTION public.net_vat1_vies_queue(p_max integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  WITH picked AS (
    SELECT n.id, n.vat_id, n.legal_name
    FROM public.network_companies n
    LEFT JOIN private.network_company_vat_vies v ON v.company_id = n.id
    WHERE n.country_code = 'IT' AND n.publication_status = 'published'
      AND n.archived_at IS NULL AND n.vat_id ~ '^[0-9]{11}$'
      AND (v.company_id IS NULL OR v.vat_id <> n.vat_id
           OR (v.checked_at IS NULL AND v.attempts < 10)
           OR v.checked_at < now() - interval '180 days')
      AND (v.leased_until IS NULL OR v.leased_until < now())
    ORDER BY v.checked_at NULLS FIRST, coalesce(v.attempts, 0), n.id
    LIMIT greatest(1, least(coalesce(p_max, 100), 200))
    FOR UPDATE OF n SKIP LOCKED
  ), leased AS (
    INSERT INTO private.network_company_vat_vies(company_id, vat_id, leased_until)
    SELECT id, vat_id, now() + interval '30 minutes' FROM picked
    ON CONFLICT (company_id) DO UPDATE
      SET leased_until = excluded.leased_until,
          vat_id = excluded.vat_id,
          status = CASE WHEN private.network_company_vat_vies.vat_id = excluded.vat_id
                        THEN private.network_company_vat_vies.status END,
          name_match = CASE WHEN private.network_company_vat_vies.vat_id = excluded.vat_id
                            THEN private.network_company_vat_vies.name_match END
    RETURNING company_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'vat_id', p.vat_id, 'legal_name', p.legal_name)), '[]'::jsonb)
    INTO v_items
  FROM picked p JOIN leased l ON l.company_id = p.id;
  RETURN jsonb_build_object('contract', 'net-vat1-vies-queue-v1', 'items', v_items);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_vies_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_vat1_vies_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.net_vat1_record_vies(
  p_company_id uuid, p_vat text, p_status text, p_name_match text, p_registered_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_row private.network_company_vat_vies%rowtype;
  v_source text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('valid', 'not_in_vies', 'unavailable')
     OR (p_status = 'valid' AND p_name_match NOT IN ('match', 'mismatch', 'unknown')) THEN
    RAISE EXCEPTION 'Invalid VIES outcome' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM private.network_company_vat_vies
  WHERE company_id = p_company_id AND vat_id = p_vat FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company was not leased for a VIES check' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'unavailable' THEN
    UPDATE private.network_company_vat_vies
    SET attempts = least(attempts + 1, 20), last_error = 'unavailable', leased_until = NULL
    WHERE company_id = p_company_id;
    RETURN jsonb_build_object('contract', 'net-vat1-record-vies-v1', 'outcome', 'unavailable');
  END IF;
  UPDATE private.network_company_vat_vies
  SET status = p_status,
      name_match = CASE WHEN p_status = 'valid' THEN p_name_match END,
      registered_name = CASE WHEN p_status = 'valid'
                             THEN left(nullif(btrim(p_registered_name), ''), 255) END,
      checked_at = now(), attempts = least(attempts + 1, 20), last_error = NULL,
      leased_until = NULL
  WHERE company_id = p_company_id;
  IF p_status = 'valid' AND p_name_match = 'mismatch' THEN
    SELECT source_url INTO v_source FROM private.network_company_vat_evidence
    WHERE company_id = p_company_id;
    PERFORM private.net_vat1_exception(p_company_id, p_vat, v_source, 'vies_name_mismatch');
    -- Solo le P.IVA raccolte dalla campagna: quelle dichiarate dall'azienda
    -- (senza evidenza dal sito) restano e vanno solo in eccezione.
    IF v_source IS NOT NULL THEN
      UPDATE public.network_companies SET vat_id = NULL
      WHERE id = p_company_id AND vat_id = p_vat;
      DELETE FROM private.network_company_vat_evidence WHERE company_id = p_company_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('contract', 'net-vat1-record-vies-v1',
    'outcome', CASE WHEN p_status = 'valid' THEN 'valid_' || p_name_match ELSE p_status END);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_record_vies(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_vat1_record_vies(uuid, text, text, text, text) TO service_role;

-- Scheda: P.IVA intestata ad altri secondo VIES non si mostra; «verificata
-- VIES» solo se valida e intestata all'azienda.
CREATE OR REPLACE FUNCTION public.net_vat1_public_company_vat(p_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
  SELECT jsonb_build_object(
    'contract', 'net-vat1-public-v1',
    'vat_id', n.vat_id,
    'source', CASE WHEN e.company_id IS NOT NULL THEN 'official_site' ELSE 'network' END,
    'vies_confirmed', coalesce(v.vat_id = n.vat_id AND v.status = 'valid'
                               AND v.name_match = 'match', false))
  FROM public.network_companies n
  LEFT JOIN private.network_company_vat_evidence e ON e.company_id = n.id
  LEFT JOIN private.network_company_vat_vies v ON v.company_id = n.id
  WHERE auth.uid() IS NOT NULL AND n.id = p_company_id
    AND n.publication_status = 'published' AND n.archived_at IS NULL
    AND n.vat_id IS NOT NULL
    AND NOT (v.vat_id IS NOT DISTINCT FROM n.vat_id AND v.status IS NOT DISTINCT FROM 'valid'
             AND v.name_match IS NOT DISTINCT FROM 'mismatch');
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_public_company_vat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.net_vat1_public_company_vat(uuid) TO authenticated;
