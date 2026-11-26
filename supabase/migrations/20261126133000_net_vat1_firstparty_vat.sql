-- NET-VAT1 fase 1 (founder, 26 nov 2026): campagna partita IVA.
--
-- Le pipeline del Network leggono la P.IVA sul sito ufficiale dell'azienda,
-- ma la salvano solo sul candidato: alla pubblicazione nessun publisher la
-- copia nel profilo. Questa migrazione:
--   1. aggiunge il registro privato della provenienza della P.IVA;
--   2. un'unica funzione che applica una P.IVA italiana al profilo solo se
--      valida (codice di controllo), letta sul dominio ufficiale dell'azienda
--      e non già usata da un'altra azienda; i casi dubbi finiscono in una coda
--      di eccezioni, mai sovrascritti;
--   3. recupera subito le P.IVA già trovate sui candidati pubblicati;
--   4. espone la P.IVA sulla scheda Network (decisione del founder: pubblica)
--      agli utenti autenticati, solo per profili pubblicati.
-- Nessuna ditta individuale: i profili pubblicati IT passano già il filtro
-- della forma societaria. Nessun dato personale.

CREATE TABLE IF NOT EXISTS private.network_company_vat_evidence (
  company_id uuid PRIMARY KEY REFERENCES public.network_companies(id) ON DELETE CASCADE,
  vat_id text NOT NULL CHECK (vat_id ~ '^[0-9]{11}$'),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%' AND char_length(source_url) <= 1024),
  method text NOT NULL CHECK (method IN ('candidate_backfill', 'firstparty_scan')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.network_company_vat_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_company_vat_evidence FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.network_company_vat_exceptions (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.network_companies(id) ON DELETE CASCADE,
  vat_id text NOT NULL CHECK (char_length(vat_id) <= 32),
  source_url text CHECK (source_url IS NULL OR char_length(source_url) <= 1024),
  reason text NOT NULL CHECK (reason IN (
    'invalid_checksum', 'not_official_site', 'vat_in_use',
    'company_has_other_vat', 'vat_on_multiple_companies', 'company_not_eligible',
    'vies_name_mismatch')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, vat_id, reason)
);
ALTER TABLE private.network_company_vat_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_company_vat_exceptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.network_company_vat_exceptions_id_seq FROM PUBLIC, anon, authenticated;

-- Codice di controllo della partita IVA italiana (11 cifre).
CREATE OR REPLACE FUNCTION private.net_vat1_it_vat_ok(p_vat text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $fn$
DECLARE
  v_sum integer := 0;
  v_digit integer;
BEGIN
  IF p_vat IS NULL OR p_vat !~ '^[0-9]{11}$' OR p_vat = '00000000000' THEN
    RETURN false;
  END IF;
  FOR i IN 1..10 LOOP
    v_digit := substr(p_vat, i, 1)::integer;
    IF i % 2 = 0 THEN
      v_digit := v_digit * 2;
      IF v_digit > 9 THEN v_digit := v_digit - 9; END IF;
    END IF;
    v_sum := v_sum + v_digit;
  END LOOP;
  RETURN (10 - v_sum % 10) % 10 = substr(p_vat, 11, 1)::integer;
END
$fn$;
REVOKE ALL ON FUNCTION private.net_vat1_it_vat_ok(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_vat1_host(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $fn$
  SELECT nullif(regexp_replace(lower(split_part(split_part(split_part(
    coalesce(p_url, ''), '://', 2), '/', 1), ':', 1)), '^www\.', ''), '');
$fn$;
REVOKE ALL ON FUNCTION private.net_vat1_host(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.net_vat1_exception(
  p_company_id uuid, p_vat text, p_source_url text, p_reason text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
  INSERT INTO private.network_company_vat_exceptions(company_id, vat_id, source_url, reason)
  VALUES (p_company_id, left(coalesce(p_vat, ''), 32), left(p_source_url, 1024), p_reason)
  ON CONFLICT (company_id, vat_id, reason) DO NOTHING;
  SELECT p_reason;
$fn$;
REVOKE ALL ON FUNCTION private.net_vat1_exception(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Unico punto di scrittura: non solleva errori, restituisce l'esito.
CREATE OR REPLACE FUNCTION private.net_vat1_apply(
  p_company_id uuid, p_vat text, p_source_url text, p_method text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_company public.network_companies%rowtype;
  v_vat text := regexp_replace(upper(coalesce(p_vat, '')), '^IT|[^0-9A-Z]', '', 'g');
BEGIN
  SELECT * INTO v_company FROM public.network_companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_company.country_code <> 'IT' OR v_company.archived_at IS NOT NULL
     OR v_company.publication_status <> 'published' THEN
    RETURN 'company_not_eligible';
  END IF;
  -- Una P.IVA che VIES intesta a un'altra azienda (fase 3) non torna più.
  IF EXISTS (SELECT 1 FROM private.network_company_vat_exceptions e
             WHERE e.company_id = p_company_id AND e.vat_id = v_vat
               AND e.reason = 'vies_name_mismatch') THEN
    RETURN 'vies_name_mismatch';
  END IF;
  IF NOT private.net_vat1_it_vat_ok(v_vat) THEN
    RETURN private.net_vat1_exception(p_company_id, v_vat, p_source_url, 'invalid_checksum');
  END IF;
  IF p_source_url IS NULL OR p_source_url NOT LIKE 'https://%'
     OR private.net_vat1_host(p_source_url) IS DISTINCT FROM
        regexp_replace(lower(coalesce(v_company.website_domain, '')), '^www\.', '') THEN
    RETURN private.net_vat1_exception(p_company_id, v_vat, p_source_url, 'not_official_site');
  END IF;
  IF v_company.vat_id IS NOT NULL THEN
    IF private.hp4_normalize_identifier(v_company.vat_id) IN (v_vat, 'IT' || v_vat) THEN
      INSERT INTO private.network_company_vat_evidence(company_id, vat_id, source_url, method)
      VALUES (p_company_id, v_vat, left(p_source_url, 1024), p_method)
      ON CONFLICT (company_id) DO NOTHING;
      RETURN 'already_same';
    END IF;
    RETURN private.net_vat1_exception(p_company_id, v_vat, p_source_url, 'company_has_other_vat');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.network_companies x
    WHERE x.country_code = 'IT' AND x.id <> p_company_id
      AND private.hp4_normalize_identifier(x.vat_id) IN (v_vat, 'IT' || v_vat)
  ) THEN
    RETURN private.net_vat1_exception(p_company_id, v_vat, p_source_url, 'vat_in_use');
  END IF;
  UPDATE public.network_companies SET vat_id = v_vat WHERE id = p_company_id;
  INSERT INTO private.network_company_vat_evidence(company_id, vat_id, source_url, method)
  VALUES (p_company_id, v_vat, left(p_source_url, 1024), p_method)
  ON CONFLICT (company_id) DO UPDATE
    SET vat_id = excluded.vat_id, source_url = excluded.source_url,
        method = excluded.method, recorded_at = now();
  RETURN 'applied';
END
$fn$;
REVOKE ALL ON FUNCTION private.net_vat1_apply(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Candidati pubblicati con P.IVA trovata sul sito ma non ancora nel profilo.
-- Una P.IVA presente su più aziende non è attribuibile: va in eccezione.
CREATE OR REPLACE FUNCTION private.net_vat1_sweep_candidates(p_max integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  r record;
  v_result text;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  FOR r IN
    WITH cohort AS (
      SELECT DISTINCT ON (n.id) n.id AS company_id, c.vat_id,
        coalesce(nullif(c.enrichment_quality->'net_it_auto4_identity_correction'->>'page_url', ''),
                 c.source_url) AS source_url
      FROM public.network_company_discovery_candidates c
      JOIN public.network_companies n ON n.id = c.promoted_company_id
      WHERE c.vat_id ~ '^[0-9]{11}$' AND n.vat_id IS NULL AND n.country_code = 'IT'
        AND n.archived_at IS NULL AND n.publication_status = 'published'
        AND NOT EXISTS (SELECT 1 FROM private.network_company_vat_exceptions e
                        WHERE e.company_id = n.id AND e.vat_id = c.vat_id)
      ORDER BY n.id, c.updated_at DESC
    ), shared AS (
      SELECT vat_id FROM cohort GROUP BY vat_id HAVING count(*) > 1
    )
    SELECT cohort.*, (cohort.vat_id IN (SELECT vat_id FROM shared)) AS is_shared
    FROM cohort
    LIMIT greatest(1, least(coalesce(p_max, 500), 5000))
  LOOP
    IF r.is_shared THEN
      v_result := private.net_vat1_exception(r.company_id, r.vat_id, r.source_url,
                                             'vat_on_multiple_companies');
    ELSE
      v_result := private.net_vat1_apply(r.company_id, r.vat_id, r.source_url, 'candidate_backfill');
    END IF;
    v_counts := jsonb_set(v_counts, ARRAY[v_result],
                          to_jsonb(coalesce((v_counts->>v_result)::integer, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('contract', 'net-vat1-sweep-v1', 'outcomes', v_counts);
END
$fn$;
REVOKE ALL ON FUNCTION private.net_vat1_sweep_candidates(integer) FROM PUBLIC, anon, authenticated;

-- Pipeline su Railway (fase 2): stesso sweep per i nuovi pubblicati.
CREATE OR REPLACE FUNCTION public.net_vat1_sweep(p_max integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  RETURN private.net_vat1_sweep_candidates(p_max);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_sweep(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_vat1_sweep(integer) TO service_role;

-- Scheda Network: P.IVA dei profili pubblicati, per utenti autenticati.
CREATE OR REPLACE FUNCTION public.net_vat1_public_company_vat(p_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
  SELECT jsonb_build_object(
    'contract', 'net-vat1-public-v1',
    'vat_id', n.vat_id,
    'source', CASE WHEN e.company_id IS NOT NULL THEN 'official_site' ELSE 'network' END)
  FROM public.network_companies n
  LEFT JOIN private.network_company_vat_evidence e ON e.company_id = n.id
  WHERE auth.uid() IS NOT NULL AND n.id = p_company_id
    AND n.publication_status = 'published' AND n.archived_at IS NULL
    AND n.vat_id IS NOT NULL;
$fn$;
REVOKE ALL ON FUNCTION public.net_vat1_public_company_vat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.net_vat1_public_company_vat(uuid) TO authenticated;

DO $net_vat1_checks$
BEGIN
  IF NOT private.net_vat1_it_vat_ok('00743110157')
     OR NOT private.net_vat1_it_vat_ok('01114601006')    -- valida
     OR private.net_vat1_it_vat_ok('00743110158')
     OR private.net_vat1_it_vat_ok('00000000000')
     OR private.net_vat1_it_vat_ok('1234567890')
     OR private.net_vat1_host('https://www.Acme.it/contatti') <> 'acme.it' THEN
    RAISE EXCEPTION 'NET-VAT1 self-check failed';
  END IF;
END
$net_vat1_checks$;

-- Recupero immediato delle P.IVA già trovate sui siti ufficiali.
SELECT private.net_vat1_sweep_candidates(5000);
