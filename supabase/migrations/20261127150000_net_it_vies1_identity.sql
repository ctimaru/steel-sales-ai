-- NET-IT-VIES1 (founder, 27 nov 2026): sbloccare i candidati del Network
-- italiano fermi perché la ragione sociale con la forma societaria non è
-- scritta sul sito («no_company_name_on_site», scartati in automatico da
-- AUTO2 v4).
-- Decisione: la forma societaria si verifica con P.IVA + VIES; il legame con
-- l'acciaio con la lettura del sito. Ditte individuali sempre escluse.
--
-- Prova richiesta per ogni candidato (il worker raccoglie, il database
-- ricontrolla):
--   * P.IVA letta su una pagina HTTPS del dominio ufficiale del candidato,
--     codice di controllo valido;
--   * VIES: P.IVA valida, intestata a un nome che corrisponde al candidato
--     (nome o dominio) e con forma S.r.l./S.r.l.s./S.p.A./S.n.c./S.a.s.;
--   * almeno un termine della filiera dell'acciaio sulle pagine del sito.
-- Allora la ragione sociale VIES diventa il nome del candidato, lo scarto
-- AUTO2 viene annullato (con traccia) e si registra un'evidenza
-- «net-it-vies1-v1» che AUTO3 accetta come le evidenze first-party v4:
-- la pubblicazione resta di AUTO3, con i suoi controlli (duplicati, dati
-- personali, nomi «di», limiti giornalieri).

CREATE TABLE IF NOT EXISTS private.net_it_vies1_attempts (
  candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_attempt_at timestamptz,
  outcome text CHECK (outcome IS NULL OR char_length(outcome) <= 40),
  vat_id text CHECK (vat_id IS NULL OR vat_id ~ '^[0-9]{11}$'),
  vies_name text CHECK (vies_name IS NULL OR char_length(vies_name) <= 255),
  legal_name text CHECK (legal_name IS NULL OR char_length(legal_name) <= 255),
  page_url text CHECK (page_url IS NULL OR char_length(page_url) <= 1024),
  steel_terms text[] NOT NULL DEFAULT '{}' CHECK (cardinality(steel_terms) <= 20),
  previous_discard_reason text,
  leased_until timestamptz
);
ALTER TABLE private.net_it_vies1_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_vies1_attempts FROM PUBLIC, anon, authenticated;

-- Coda: candidati IT in attesa, scartati solo per assenza della ragione
-- sociale sul sito, mai provati (o fermati da VIES non disponibile).
CREATE OR REPLACE FUNCTION public.net_it_vies1_queue(p_max integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  WITH picked AS (
    SELECT c.id, c.website_url, lower(btrim(c.canonical_domain)) AS domain, c.legal_name, c.trading_name
    FROM public.network_company_discovery_candidates c
    JOIN public.network_company_discovery_runs r ON r.id = c.run_id
    JOIN private.net_it_auto2_discards d ON d.candidate_id = c.id AND d.reason = 'no_company_on_site'
    LEFT JOIN private.net_it_vies1_attempts a ON a.candidate_id = c.id
    WHERE c.country_code = 'IT' AND c.review_status = 'pending_review'
      AND c.governance_status = 'unreviewed'
      -- stesse fonti ammesse da AUTO3
      AND ((r.governance_status = 'unreviewed' AND r.terms_status IN ('not_checked', 'unknown')
            AND r.database_rights_status IN ('not_assessed', 'unknown'))
        OR (r.governance_status = 'approved' AND r.governance_reviewed_by IS NOT NULL
            AND r.terms_status IN ('allows_reuse', 'allows_limited_reuse')
            AND r.database_rights_status IN ('low_risk', 'licensed')
            AND r.personal_data_policy IN ('company_data_only', 'exclude_personal_data')))
      AND c.website_url ~* '^https://' AND c.source_url ~* '^https://'
      AND lower(split_part(split_part(c.website_url, '/', 3), ':', 1))
          IN (lower(btrim(c.canonical_domain)), 'www.' || lower(btrim(c.canonical_domain)))
      AND NOT c.personal_data_detected AND cardinality(c.personal_data_fields) = 0
      AND cardinality(c.role_keys) > 0
      AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL AND c.match_signals = '[]'::jsonb
      AND c.quality_flags <@ ARRAY['product_scope_not_verified', 'province_area_to_verify',
            'classification_multi_role', 'classification_low_margin', 'legal_identity_not_verified',
            'identity_no_legal_suffix', 'identity_domain_mismatch', 'identity_domain_fallback']::text[]
      AND NOT EXISTS (SELECT 1 FROM public.network_netfast3_suppressed_domains s
                      WHERE s.domain = lower(btrim(c.canonical_domain)))
      AND (a.candidate_id IS NULL OR (a.outcome IN ('leased', 'vies_unavailable', 'site_unreachable') AND a.attempts < 3))
      AND (a.leased_until IS NULL OR a.leased_until < now())
      AND NOT EXISTS (SELECT 1 FROM public.network_companies n
                      WHERE lower(btrim(n.website_domain)) = lower(btrim(c.canonical_domain)))
    ORDER BY coalesce(a.attempts, 0), c.created_at, c.id
    LIMIT greatest(1, least(coalesce(p_max, 20), 50))
    FOR UPDATE OF c SKIP LOCKED
  ), leased AS (
    INSERT INTO private.net_it_vies1_attempts(candidate_id, attempts, outcome, leased_until)
    SELECT id, 1, 'leased', now() + interval '30 minutes' FROM picked
    ON CONFLICT (candidate_id) DO UPDATE
      SET attempts = least(private.net_it_vies1_attempts.attempts + 1, 10),
          outcome = 'leased', leased_until = excluded.leased_until
    RETURNING candidate_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'website_url', p.website_url,
           'domain', p.domain, 'name', coalesce(p.trading_name, p.legal_name))), '[]'::jsonb)
    INTO v_items
  FROM picked p JOIN leased l ON l.candidate_id = p.id;
  RETURN jsonb_build_object('contract', 'net-it-vies1-queue-v1', 'items', v_items);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_it_vies1_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_vies1_queue(integer) TO service_role;

-- Esito senza identità verificata: si registra e basta (il candidato resta scartato).
CREATE OR REPLACE FUNCTION public.net_it_vies1_record(p_candidate_id uuid, p_outcome text,
  p_vat text DEFAULT NULL, p_vies_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('no_vat_on_site', 'not_in_vies', 'vies_unavailable', 'vies_name_mismatch',
                       'sole_trader_or_no_legal_form', 'in_liquidation', 'no_steel_link',
                       'site_unreachable', 'reuse_restricted') THEN
    RAISE EXCEPTION 'Invalid VIES1 outcome' USING ERRCODE = '22023';
  END IF;
  UPDATE private.net_it_vies1_attempts
  SET last_attempt_at = now(), outcome = p_outcome,
      vat_id = CASE WHEN p_vat ~ '^[0-9]{11}$' THEN p_vat END,
      vies_name = left(nullif(btrim(p_vies_name), ''), 255), leased_until = NULL
  WHERE candidate_id = p_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate was not leased' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('contract', 'net-it-vies1-record-v1', 'outcome', p_outcome);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_it_vies1_record(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_vies1_record(uuid, text, text, text) TO service_role;

-- Identità verificata con VIES: nome, P.IVA, annullo dello scarto, evidenza per AUTO3.
CREATE OR REPLACE FUNCTION public.net_it_vies1_apply(p_candidate_id uuid, p_vat text, p_page_url text,
  p_vies_name text, p_legal_name text, p_steel_terms text[], p_page_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_c public.network_company_discovery_candidates%rowtype;
  v_name text := btrim(regexp_replace(coalesce(p_legal_name, ''), '\s+', ' ', 'g'));
  v_host text := lower(split_part(split_part(coalesce(p_page_url, ''), '/', 3), ':', 1));
  v_discard text;
  v_evidence uuid;
  v_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM public.network_company_discovery_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND OR v_c.country_code <> 'IT' OR v_c.review_status <> 'pending_review'
     OR v_c.governance_status <> 'unreviewed'
     OR NOT EXISTS (SELECT 1 FROM private.net_it_vies1_attempts WHERE candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'Candidate not available for VIES identity' USING ERRCODE = '22023';
  END IF;

  v_outcome := CASE
    WHEN NOT private.net_vat1_it_vat_ok(p_vat) THEN 'rejected_invalid_vat'
    WHEN p_page_url !~* '^https://'
      OR v_host NOT IN (lower(btrim(v_c.canonical_domain)), 'www.' || lower(btrim(v_c.canonical_domain)))
      THEN 'rejected_not_official_site'
    WHEN char_length(v_name) NOT BETWEEN 3 AND 255
      OR v_name !~* '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$)'
      THEN 'rejected_no_legal_form'
    WHEN NOT private.net_it_legal_name_quality_ok(v_name) THEN 'rejected_name_quality'
    WHEN coalesce(cardinality(p_steel_terms), 0) = 0 THEN 'rejected_no_steel_link'
    WHEN p_page_hash IS NULL OR p_page_hash !~ '^[a-f0-9]{64}$' THEN 'rejected_no_hash'
    WHEN EXISTS (SELECT 1 FROM public.network_companies n
                 WHERE n.vat_id = p_vat OR lower(btrim(n.website_domain)) = lower(btrim(v_c.canonical_domain)))
      THEN 'rejected_already_in_network'
    ELSE 'identity_verified' END;

  IF v_outcome <> 'identity_verified' THEN
    UPDATE private.net_it_vies1_attempts
    SET last_attempt_at = now(), outcome = v_outcome,
        vat_id = CASE WHEN p_vat ~ '^[0-9]{11}$' THEN p_vat END,
        vies_name = left(p_vies_name, 255), legal_name = left(v_name, 255), leased_until = NULL
    WHERE candidate_id = p_candidate_id;
    RETURN jsonb_build_object('contract', 'net-it-vies1-apply-v1', 'outcome', v_outcome);
  END IF;

  SELECT reason INTO v_discard FROM private.net_it_auto2_discards WHERE candidate_id = p_candidate_id;
  DELETE FROM private.net_it_auto2_discards WHERE candidate_id = p_candidate_id;

  UPDATE public.network_company_discovery_candidates
  SET legal_name = v_name, vat_id = p_vat,
      enrichment_quality = coalesce(enrichment_quality, '{}'::jsonb) || jsonb_build_object(
        'net_it_vies1_identity', jsonb_build_object(
          'previous_legal_name', left(v_c.legal_name, 255), 'previous_vat_id', v_c.vat_id,
          'legal_name', v_name,
          'vies_registered_name', left(p_vies_name, 255), 'vat_id', p_vat,
          'page_url', left(p_page_url, 1024), 'steel_terms', to_jsonb(p_steel_terms[1:20]),
          'previous_discard_reason', v_discard, 'at', now()))
  WHERE id = p_candidate_id;

  INSERT INTO private.net_it_auto2_evidence(
    candidate_id, source_run_id, reviewer_version, verdict, reason_codes, observed_domain,
    matched_company_name, observed_business_name, company_page_url, page_evidence_hash,
    identity_confidence, source_terms_url, source_rights_state, evidence)
  VALUES (p_candidate_id, v_c.run_id, 'net-it-vies1-v1', 'identity_supported', '{}'::text[],
    lower(btrim(v_c.canonical_domain)), true, left(v_name, 240), left(p_page_url, 1024), p_page_hash,
    0.95, NULL, 'unknown',
    jsonb_build_object('method', 'first_party_vat_plus_vies', 'vat_id', p_vat,
      'vies_registered_name', left(p_vies_name, 255), 'steel_terms', to_jsonb(p_steel_terms[1:20]),
      'previous_discard_reason', v_discard, 'founder_decision', '2026-11-27',
      'rights_not_approved_by_agent', true, 'publication_authorized', false))
  RETURNING id INTO v_evidence;

  UPDATE private.net_it_vies1_attempts
  SET last_attempt_at = now(), outcome = 'identity_verified',
      vat_id = p_vat, vies_name = left(p_vies_name, 255), legal_name = left(v_name, 255),
      page_url = left(p_page_url, 1024), steel_terms = p_steel_terms[1:20],
      previous_discard_reason = v_discard, leased_until = NULL
  WHERE candidate_id = p_candidate_id;

  RETURN jsonb_build_object('contract', 'net-it-vies1-apply-v1', 'outcome', 'identity_verified',
    'evidence_id', v_evidence);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_it_vies1_apply(uuid, text, text, text, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_vies1_apply(uuid, text, text, text, text, text[], text) TO service_role;

-- AUTO3 accetta l'evidenza VIES1 alle stesse condizioni delle evidenze v4.
DO $patch$
DECLARE
  v_def text := pg_get_functiondef('private.net_it_auto3_release(integer,boolean)'::regprocedure);
  v_new text;
  v_all text := $$('net-it-auto2-firstparty-v1','net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')$$;
  v_v2 text := $$('net-it-auto2-firstparty-v2','net-it-auto2-firstparty-v3','net-it-auto2-firstparty-v4')$$;
BEGIN
  IF position('net-it-vies1-v1' IN v_def) > 0 THEN
    RETURN;  -- già applicato
  END IF;
  v_new := replace(v_def, v_all, replace(v_all, ')', ',''net-it-vies1-v1'')'));
  v_new := replace(v_new, v_v2, replace(v_v2, ')', ',''net-it-vies1-v1'')'));
  v_new := replace(v_new, $$(e.reviewer_version='net-it-auto2-firstparty-v4'$$,
                          $$(e.reviewer_version IN ('net-it-auto2-firstparty-v4','net-it-vies1-v1')$$);
  IF (length(v_new) - length(replace(v_new, 'net-it-vies1-v1', ''))) / length('net-it-vies1-v1') < 5 THEN
    RAISE EXCEPTION 'NET-IT-VIES1: AUTO3 patch did not match (found % occurrences)',
      (length(v_new) - length(replace(v_new, 'net-it-vies1-v1', ''))) / length('net-it-vies1-v1');
  END IF;
  EXECUTE v_new;
END
$patch$;

-- La coda AUTO2 tratta l'evidenza VIES1 come la v4: non rimette subito in
-- lettura (e quindi non riscarta) un candidato appena verificato con VIES.
DO $patch$
DECLARE
  v_def text := pg_get_functiondef('private.net_it_auto2_queue(integer)'::regprocedure);
  v_old text := $$e.reviewer_version<>'net-it-auto2-firstparty-v4'$$;
BEGIN
  IF position('net-it-vies1-v1' IN v_def) > 0 THEN
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'NET-IT-VIES1: AUTO2 queue patch did not match';
  END IF;
  EXECUTE replace(v_def, v_old,
    $$e.reviewer_version NOT IN ('net-it-auto2-firstparty-v4','net-it-vies1-v1')$$);
END
$patch$;
