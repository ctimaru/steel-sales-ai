-- NET-IT-GROWTH.B: move already sourced public industrial leads into the existing
-- SEED1 first-party crawler, without human-per-batch promotion or any publication.
-- The crawl authorization is the existing, expiring Platform Owner SEED1 policy.
-- No contacts, supplier capabilities or industrial roles are copied from feeds.
CREATE OR REPLACE FUNCTION private.net_it_growthb_feed(
  p_max integer DEFAULT 100, p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_item record;
  v_source uuid;
  v_inserted_domain text;
  v_seen integer := 0;
  v_staged integer := 0;
  v_source_skips integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance-only feed; never callable by browser or service JWT'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 100 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Bounded 1..100 feed required' USING ERRCODE='22023';
  END IF;
  IF NOT private.net_it_seed1_policy_active() THEN
    RETURN jsonb_build_object('contract','net-it-growthb-feed-v1',
      'status','owner_policy_inactive','ready',0,'staged',0,'published',0);
  END IF;
  -- One writer at a time; domain primary key and downstream publisher checks
  -- remain authoritative against concurrent discovery.
  PERFORM pg_catalog.pg_advisory_xact_lock(810021, 20261117);

  FOR v_item IN
    WITH feed AS (
      -- An explicitly first-party research record is a discovery pointer, NOT
      -- a reviewed source or permission to publish scraped content.
      SELECT lower(btrim(r.canonical_domain)) AS domain,
             'https://' || split_part(r.source_url,'/',3) || '/' AS homepage,
             r.source_url AS evidence_url, 'first_party_research'::text AS origin,
             1 AS priority, r.first_seen_at AS observed_at
      FROM private.network_web_research_seeds r
      WHERE r.country_code='IT' AND r.source_kind='first_party_web'
        AND r.source_url ~* '^https://[a-z0-9.-]+/'
        AND lower(regexp_replace(split_part(r.source_url,'/',3),'^www[.]','')) =
            lower(btrim(r.canonical_domain))
      UNION ALL
      SELECT lower(btrim(n.domain)), n.website_url, n.source_url,
             'official_company_research'::text, 2, n.created_at
      FROM private.netfast_discovered_records n
      WHERE n.origin='official_company_research'
        AND n.source_url ~* '^https://[a-z0-9.-]+/'
        AND (lower(regexp_replace(split_part(n.source_url,'/',3),'^www[.]','')) =
             lower(btrim(n.domain))
             OR lower(split_part(n.source_url,'/',3)) LIKE '%.'||lower(btrim(n.domain)))
      UNION ALL
      -- Existing scheduled NET-LAUNCH2 adds fresh CC0 items here daily.
      -- Never treat a Wikidata label as a verified company or steel role.
      SELECT lower(btrim(w.domain)), w.website_url, w.source_url,
             'wikidata_daily_structured'::text, 3, w.discovered_at
      FROM public.network_netfast2_structured_entities w
      WHERE w.country_code='IT' AND w.removed_at IS NULL
        AND w.license_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
        AND w.source_entity_id ~ '^Q[1-9][0-9]{0,13}$'
        AND w.source_url=('https://www.wikidata.org/wiki/'||w.source_entity_id)
        AND EXISTS (
          SELECT 1 FROM public.network_discovery_source_registry s
          WHERE s.source_url='https://query.wikidata.org/sparql'
            AND s.country_code='IT' AND s.enabled_for_discovery
            AND s.governance_status='approved' AND s.reviewed_by IS NOT NULL
            AND s.terms_status='allows_reuse'
            AND s.database_rights_status IN ('low_risk','licensed')
            AND s.personal_data_policy IN ('company_data_only','exclude_personal_data')
        )
      UNION ALL
      -- Wikidata P856 is a discovery lead, not evidence of legal identity or
      -- Italian production. Use only the existing reviewed CC0 registry.
      SELECT lower(btrim(n.domain)), n.website_url, n.source_url,
             'wikidata_cc0'::text, 3, n.created_at
      FROM private.netfast_discovered_records n
      WHERE n.origin='wikidata_cc0'
        AND n.source_url ~ '^https://www[.]wikidata[.]org/wiki/Q[1-9][0-9]{0,13}$'
        AND EXISTS (
          SELECT 1 FROM public.network_discovery_source_registry s
          WHERE s.source_url='https://query.wikidata.org/sparql'
            AND s.country_code='IT' AND s.enabled_for_discovery
            AND s.governance_status='approved' AND s.reviewed_by IS NOT NULL
            AND s.terms_status='allows_reuse'
            AND s.database_rights_status IN ('low_risk','licensed')
            AND s.personal_data_policy IN ('company_data_only','exclude_personal_data')
        )
      UNION ALL
      SELECT lower(btrim(d.domain)), d.proposed_url, d.evidence_url,
             'approved_source_lead'::text, 4, d.created_at
      FROM public.network_discovery_domain_leads d
      JOIN public.network_discovery_source_registry s ON s.id=d.source_id
      WHERE d.country_code='IT' AND d.status='pending_review'
        AND s.country_code='IT' AND s.enabled_for_discovery
        AND s.governance_status='approved' AND s.reviewed_by IS NOT NULL
        AND s.terms_status IN ('allows_reuse','allows_limited_reuse')
        AND s.database_rights_status IN ('low_risk','licensed')
        AND s.personal_data_policy IN ('company_data_only','exclude_personal_data')
    ), eligible AS (
      SELECT f.* FROM feed f
      WHERE f.domain ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?[.][a-z]{2,24}$'
        AND f.homepage ~* '^https://[a-z0-9.-]+(/|$)'
        AND f.homepage !~ '@' AND split_part(f.homepage,'/',3) !~ ':'
        AND lower(regexp_replace(split_part(f.homepage,'/',3),'^www[.]','')) = f.domain
        AND char_length(f.homepage)<=2000
        AND f.evidence_url ~* '^https://' AND char_length(f.evidence_url)<=2000
        AND NOT EXISTS(SELECT 1 FROM private.net_it_seed1_domains q WHERE q.domain=f.domain)
        AND NOT EXISTS(SELECT 1 FROM public.network_companies c
                       WHERE lower(btrim(c.website_domain))=f.domain)
        AND NOT EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c
                       WHERE lower(btrim(c.canonical_domain))=f.domain)
        AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
                       WHERE lower(s.domain)=f.domain)
    ), ranked AS (
      SELECT DISTINCT ON (domain) *
      FROM eligible ORDER BY domain, priority, observed_at DESC NULLS LAST
    )
    SELECT * FROM ranked ORDER BY priority, observed_at DESC NULLS LAST,domain
    LIMIT p_max
  LOOP
    v_seen:=v_seen+1;
    IF p_dry_run THEN
      IF v_seen <= 20 THEN
        v_items:=v_items||jsonb_build_array(jsonb_build_object(
          'domain',v_item.domain,'origin',v_item.origin));
      END IF;
      CONTINUE;
    END IF;
    v_source:=NULL;
    v_inserted_domain:=NULL;
    -- Direct sites are intentionally NOT enabled as index-page sources. They
    -- are queued only in net_it_seed1_domains and handled by the crawler.
    INSERT INTO private.net_it_seed1_index_sources(
      source_url,source_kind,label,enabled,max_links,min_interval_hours,last_result
    ) VALUES (
      v_item.homepage,'other',
      left('NET-IT-GROWTH.B · direct first-party: '||v_item.domain,255),
      false,1,8760,jsonb_build_object(
        'mode','direct_first_party_not_index',
        'origin','net_it_growthb_feed','evidence_kind',v_item.origin,
        'source_approval',false,'published',false)
    )
    ON CONFLICT (source_url) DO NOTHING RETURNING id INTO v_source;

    IF v_source IS NULL THEN
      SELECT s.id INTO v_source FROM private.net_it_seed1_index_sources s
      WHERE s.source_url=v_item.homepage AND s.enabled=false
        AND s.source_kind='other'
        AND s.last_result->>'mode'='direct_first_party_not_index';
    END IF;
    IF v_source IS NULL THEN
      v_source_skips:=v_source_skips+1;
      CONTINUE;
    END IF;
    INSERT INTO private.net_it_seed1_domains(
      domain,proposed_url,source_id,evidence_url,status
    ) VALUES (
      v_item.domain,v_item.homepage,v_source,v_item.evidence_url,'staged'
    ) ON CONFLICT(domain) DO NOTHING
    RETURNING domain INTO v_inserted_domain;
    IF v_inserted_domain IS NOT NULL THEN
      v_staged:=v_staged+1;
      IF v_staged <= 20 THEN
        v_items:=v_items||jsonb_build_array(jsonb_build_object(
          'domain',v_inserted_domain,'origin',v_item.origin));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'contract','net-it-growthb-feed-v1',
    'status',CASE WHEN p_dry_run THEN 'dry_run' ELSE 'staged_for_first_party_crawl' END,
    'ready',CASE WHEN p_dry_run THEN v_seen ELSE 0 END,
    'considered',v_seen,'staged',v_staged,
    'source_skips',v_source_skips,'published',0,'items',v_items
  );
END
$function$;

-- Even if the private schema is exposed in the future, the maintenance guard
-- rejects app/service JWT calls. Grant no API role an execution privilege.
REVOKE ALL ON FUNCTION private.net_it_growthb_feed(integer,boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- Hourly, before the existing SEED1 crawl (at :52). Reuses the owner's policy
-- and downstream caps; no Vercel/Railway deployment per batch.
SELECT cron.schedule('net-it-growthb-hourly-feed','12 * * * *',
  'SELECT private.net_it_growthb_feed(100,false);');
