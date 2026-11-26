-- NET-RESEARCH1 (founder, 26 nov 2026): ricerca su ogni azienda del Network e
-- «Profilo in breve» nella prima scheda (Attività e prodotti).
-- Decisioni: fatturato solo se dichiarato dall'azienda; fatturato e dipendenti
-- in fasce; pilota su 50 aziende in revisione privata, poi pubblicazione
-- automatica «da fonte pubblica».
--
-- La pipeline su Railway legge solo il sito ufficiale dell'azienda; ogni fatto
-- porta la pagina da cui viene e, per i numeri, la frase testuale. Il database
-- accetta solo valori nelle liste e nelle fasce previste. Nessun dato
-- personale: niente nomi di persona, email o telefoni nel profilo.

CREATE TABLE IF NOT EXISTS private.network_company_research (
  company_id uuid PRIMARY KEY REFERENCES public.network_companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'pilot_review', 'published', 'rejected', 'no_content', 'failed')),
  summary text CHECK (summary IS NULL OR char_length(summary) BETWEEN 80 AND 900),
  activities text[] NOT NULL DEFAULT '{}' CHECK (cardinality(activities) <= 12),
  products text[] NOT NULL DEFAULT '{}' CHECK (cardinality(products) <= 20),
  sectors text[] NOT NULL DEFAULT '{}' CHECK (cardinality(sectors) <= 12),
  certifications text[] NOT NULL DEFAULT '{}' CHECK (cardinality(certifications) <= 12),
  markets text[] NOT NULL DEFAULT '{}' CHECK (cardinality(markets) <= 12),
  founded_year integer CHECK (founded_year IS NULL OR founded_year BETWEEN 1800 AND 2100),
  employees_band text CHECK (employees_band IS NULL OR employees_band IN (
    '1-9', '10-49', '50-249', '250-999', '1000+')),
  revenue_band text CHECK (revenue_band IS NULL OR revenue_band IN (
    'lt2m', '2-10m', '10-50m', '50-250m', 'gt250m')),
  revenue_year integer CHECK (revenue_year IS NULL OR revenue_year BETWEEN 1990 AND 2100),
  plants_count integer CHECK (plants_count IS NULL OR plants_count BETWEEN 1 AND 200),
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_urls text[] NOT NULL DEFAULT '{}' CHECK (cardinality(source_urls) <= 12),
  extractor_version text,
  model text,
  researched_at timestamptz,
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 80),
  leased_until timestamptz
);
ALTER TABLE private.network_company_research ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_company_research FROM PUBLIC, anon, authenticated;

-- Coda: aziende pubblicate con sito HTTPS non ancora ricercate. In modalità
-- pilota si ferma a 50 profili in revisione; l'ordine è stabile ma misto.
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
      AND (r.company_id IS NULL OR (r.status IN ('queued', 'failed') AND r.attempts < 3))
      AND (r.leased_until IS NULL OR r.leased_until < now())
    ORDER BY coalesce(r.attempts, 0), md5(n.id::text)
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

-- Elenco ripulito: voci brevi, senza @ o link, al massimo n elementi.
CREATE OR REPLACE FUNCTION private.net_research1_labels(p_value jsonb, p_max integer)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $fn$
  SELECT coalesce((array_agg(v ORDER BY ord))[1:greatest(coalesce(p_max, 0), 0)], '{}'::text[])
  FROM (
    SELECT DISTINCT ON (lower(btrim(x))) btrim(x) AS v, ord
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_value) = 'array' THEN p_value ELSE '[]'::jsonb END)
         WITH ORDINALITY AS t(x, ord)
    WHERE char_length(btrim(x)) BETWEEN 2 AND 80 AND x !~ '[@/<>]|https?:|www\.'
    ORDER BY lower(btrim(x)), ord
  ) s;
$fn$;
REVOKE ALL ON FUNCTION private.net_research1_labels(jsonb, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.net_research1_record(
  p_company_id uuid, p_outcome text, p_profile jsonb, p_publish boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_status text;
  v_domain text;
  v_sources text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service research role required' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('researched', 'no_content', 'failed') THEN
    RAISE EXCEPTION 'Invalid research outcome' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.network_company_research WHERE company_id = p_company_id) THEN
    RAISE EXCEPTION 'Company was not leased for research' USING ERRCODE = '22023';
  END IF;
  IF p_outcome <> 'researched' THEN
    UPDATE private.network_company_research
    SET status = CASE WHEN p_outcome = 'failed' THEN 'failed' ELSE 'no_content' END,
        attempts = attempts + 1, leased_until = NULL,
        last_error = left(coalesce(p_profile->>'error', p_outcome), 80)
    WHERE company_id = p_company_id;
    RETURN jsonb_build_object('contract', 'net-research1-record-v1', 'status', p_outcome);
  END IF;

  -- Ogni fonte deve stare sul dominio ufficiale dell'azienda.
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
    attempts = attempts + 1, last_error = NULL, leased_until = NULL
  WHERE company_id = p_company_id;
  RETURN jsonb_build_object('contract', 'net-research1-record-v1', 'status', v_status);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_research1_record(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_research1_record(uuid, text, jsonb, boolean) TO service_role;

-- Scheda: profili pubblicati per gli utenti autenticati; i profili del pilota
-- in revisione solo al superadmin della piattaforma, marcati come anteprima.
CREATE OR REPLACE FUNCTION public.net_research1_company_profile(p_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
  SELECT jsonb_build_object(
    'contract', 'net-research1-profile-v1',
    'preview', r.status = 'pilot_review',
    'summary', r.summary, 'activities', to_jsonb(r.activities), 'products', to_jsonb(r.products),
    'sectors', to_jsonb(r.sectors), 'certifications', to_jsonb(r.certifications),
    'markets', to_jsonb(r.markets), 'founded_year', r.founded_year,
    'employees_band', r.employees_band, 'revenue_band', r.revenue_band,
    'revenue_year', r.revenue_year, 'plants_count', r.plants_count,
    'source_urls', to_jsonb(r.source_urls), 'researched_at', r.researched_at)
  FROM private.network_company_research r
  JOIN public.network_companies n ON n.id = r.company_id
  WHERE auth.uid() IS NOT NULL AND r.company_id = p_company_id
    AND n.publication_status = 'published' AND n.archived_at IS NULL
    AND (r.status = 'published' OR (r.status = 'pilot_review' AND private.is_platform_superadmin()));
$fn$;
REVOKE ALL ON FUNCTION public.net_research1_company_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.net_research1_company_profile(uuid) TO authenticated;
