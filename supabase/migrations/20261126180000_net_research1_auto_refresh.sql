-- NET-RESEARCH1 automatico (founder, 26 nov 2026: «ok per tutto, poi
-- automatizza il processo»). Pilota approvato: i 50 profili in anteprima
-- diventano pubblici e la pipeline pubblica in automatico. La coda prende
-- anche i profili pubblicati da oltre 12 mesi, così le schede restano
-- aggiornate; le nuove aziende pubblicate entrano da sole.

UPDATE private.network_company_research
SET status = 'published', published_at = now()
WHERE status = 'pilot_review';

CREATE OR REPLACE FUNCTION public.net_research1_queue(p_max integer DEFAULT 5, p_pilot boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_room integer := greatest(1, least(coalesce(p_max, 5), 25));
  v_items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_pilot THEN
    v_room := least(v_room, 50 - (SELECT count(*) FROM private.network_company_research
                                  WHERE status IN ('pilot_review', 'published', 'rejected')));
    IF v_room <= 0 THEN
      RETURN jsonb_build_object('contract', 'net-research1-queue-v1', 'items', '[]'::jsonb);
    END IF;
  END IF;
  WITH picked AS (
    SELECT n.id, n.website_url, regexp_replace(lower(n.website_domain), '^www\.', '') AS domain,
           coalesce(n.trading_name, n.legal_name) AS name, n.country_code
    FROM public.network_companies n
    LEFT JOIN private.network_company_research r ON r.company_id = n.id
    WHERE n.publication_status = 'published' AND n.archived_at IS NULL
      AND n.website_url LIKE 'https://%' AND n.website_domain IS NOT NULL
      AND n.country_code = 'IT'
      AND (r.company_id IS NULL
           OR (r.status IN ('queued', 'failed') AND r.attempts < 3)
           OR (NOT p_pilot AND r.status IN ('published', 'no_content')
               AND r.researched_at < now() - interval '12 months'))
      AND (r.leased_until IS NULL OR r.leased_until < now())
    ORDER BY (r.company_id IS NOT NULL AND r.status = 'published'), coalesce(r.attempts, 0), md5(n.id::text)
    LIMIT v_room
    FOR UPDATE OF n SKIP LOCKED
  ), leased AS (
    INSERT INTO private.network_company_research(company_id, leased_until)
    SELECT id, now() + interval '30 minutes' FROM picked
    ON CONFLICT (company_id) DO UPDATE SET leased_until = excluded.leased_until
    RETURNING company_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'website_url', p.website_url,
           'domain', p.domain, 'name', p.name)), '[]'::jsonb)
    INTO v_items
  FROM picked p JOIN leased l ON l.company_id = p.id;
  RETURN jsonb_build_object('contract', 'net-research1-queue-v1', 'items', v_items);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_research1_queue(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_research1_queue(integer, boolean) TO service_role;

-- Aggiornamento annuale: se il sito non si legge più, la scheda pubblicata
-- resta com'è (si registra solo il tentativo); altrimenti come prima.
CREATE OR REPLACE FUNCTION public.net_research1_record(
  p_company_id uuid, p_outcome text, p_profile jsonb, p_publish boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_status text;
  v_current text;
  v_domain text;
  v_sources text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('researched', 'no_content', 'failed') THEN
    RAISE EXCEPTION 'Invalid research outcome' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_current FROM private.network_company_research WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company was not leased for research' USING ERRCODE = '22023';
  END IF;
  IF p_outcome <> 'researched' THEN
    IF v_current = 'published' THEN
      UPDATE private.network_company_research
      SET researched_at = now(), leased_until = NULL,
          last_error = left(coalesce(p_profile->>'error', p_outcome), 80)
      WHERE company_id = p_company_id;
      RETURN jsonb_build_object('contract', 'net-research1-record-v1', 'status', 'kept_published');
    END IF;
    UPDATE private.network_company_research
    SET status = CASE WHEN p_outcome = 'failed' THEN 'failed' ELSE 'no_content' END,
        attempts = least(attempts + 1, 10), leased_until = NULL,
        researched_at = CASE WHEN p_outcome = 'no_content' THEN now() ELSE researched_at END,
        last_error = left(coalesce(p_profile->>'error', p_outcome), 80)
    WHERE company_id = p_company_id;
    RETURN jsonb_build_object('contract', 'net-research1-record-v1', 'status', p_outcome);
  END IF;

  SELECT regexp_replace(lower(website_domain), '^www\.', '') INTO v_domain
  FROM public.network_companies WHERE id = p_company_id;
  SELECT coalesce(array_agg(DISTINCT u), '{}'::text[]) INTO v_sources
  FROM jsonb_array_elements_text(coalesce(p_profile->'source_urls', '[]'::jsonb)) AS t(u);
  IF cardinality(v_sources) = 0 OR EXISTS (
       SELECT 1 FROM unnest(v_sources) u
       WHERE u NOT LIKE 'https://%'
          OR (private.net_vat1_host(u) IS DISTINCT FROM v_domain
              AND private.net_vat1_host(u) NOT LIKE '%.' || v_domain)) THEN
    RAISE EXCEPTION 'Research sources must be on the official domain' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN p_publish THEN 'published' ELSE 'pilot_review' END;
  UPDATE private.network_company_research SET
    status = v_status,
    summary = nullif(btrim(p_profile->>'summary'), ''),
    activities = private.net_research1_labels(p_profile->'activities', 12),
    products = private.net_research1_labels(p_profile->'products', 20),
    sectors = private.net_research1_labels(p_profile->'sectors', 12),
    certifications = private.net_research1_labels(p_profile->'certifications', 12),
    markets = private.net_research1_labels(p_profile->'markets', 12),
    founded_year = (p_profile->>'founded_year')::integer,
    employees_band = p_profile->>'employees_band',
    revenue_band = p_profile->>'revenue_band',
    revenue_year = (p_profile->>'revenue_year')::integer,
    plants_count = (p_profile->>'plants_count')::integer,
    facts = coalesce(p_profile->'facts', '{}'::jsonb),
    source_urls = v_sources[1:12],
    extractor_version = left(p_profile->>'extractor_version', 64),
    model = left(p_profile->>'model', 120),
    researched_at = now(),
    published_at = CASE WHEN p_publish THEN now() END,
    attempts = least(attempts + 1, 10), last_error = NULL, leased_until = NULL
  WHERE company_id = p_company_id;
  RETURN jsonb_build_object('contract', 'net-research1-record-v1', 'status', v_status);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_research1_record(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_research1_record(uuid, text, jsonb, boolean) TO service_role;
