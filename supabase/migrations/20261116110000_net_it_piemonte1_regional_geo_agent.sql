-- NET-IT-PIEMONTE1 — first-party, source-governed regional facility publisher.
-- Scoped to Piemonte only. The inventoried region is a *company locality*, not
-- evidence of product availability, tube purchasing, ownership or verification.
--
-- This automation is independent from human-reviewed netux3_publish_reviewed_geo.
-- It does not manufacture human review flags or approve pending/conflicted
-- geographic evidence. The source was already reviewed for reuse, the company
-- is published and unclaimed, the official-site locality matches the company
-- domain, and municipality+province are confirmed against current ISTAT data.
-- Caller restricted to maintenance session (pg_cron/postgres) without an auth JWT.

CREATE TABLE IF NOT EXISTS private.net_it_region_geo_auto_policy (
  region text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  owner_decision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_region_geo_auto_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_region_geo_auto_policy FROM PUBLIC,anon,authenticated,service_role;

INSERT INTO private.net_it_region_geo_auto_policy(region, enabled, owner_decision)
VALUES ('Piemonte', true,
  'Founder authorized regional industrial census and automatic source-governed publication on 2026-11-16; never mark an unverified location as verified.')
ON CONFLICT (region) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.net_it_region_geo_auto_ledger (
  candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
  company_id uuid NOT NULL UNIQUE REFERENCES public.network_companies(id),
  facility_id uuid NOT NULL UNIQUE REFERENCES public.network_facilities(id),
  source_run_id uuid NOT NULL REFERENCES public.network_company_discovery_runs(id),
  source_url text NOT NULL,
  source_domain text NOT NULL,
  istat_code text NOT NULL REFERENCES public.network_it_municipalities(istat_code),
  province_code text NOT NULL,
  region text NOT NULL,
  city text NOT NULL,
  actor_type text NOT NULL DEFAULT 'maintenance_agent'
    CHECK(actor_type='maintenance_agent'),
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS net_it_region_geo_auto_ledger_region
  ON private.net_it_region_geo_auto_ledger(region, published_at);
ALTER TABLE private.net_it_region_geo_auto_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_region_geo_auto_ledger FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.net_it_region_geo_auto_publish(
  p_region text DEFAULT 'Piemonte',
  p_max integer DEFAULT 25,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $autogeo$
DECLARE
  v_ready integer := 0;
  v_published integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_facility_id uuid;
  v_row record;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance-only geographic agent; not a user action'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 25 OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Bounded geographic batch and explicit dry-run required'
      USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.net_it_region_geo_auto_policy
    WHERE region=p_region AND enabled
  ) THEN
    RETURN jsonb_build_object('contract','net-it-region-geo-auto-v1',
      'status','region_not_authorized','ready',0,'published',0);
  END IF;

  -- A separate lock protects same-company locality writes from concurrent
  -- maintenance agents; the facility table lock blocks competing inserts.
  IF NOT p_dry_run THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(810021,20263);
    LOCK TABLE public.network_facilities IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR v_row IN
    SELECT
      c.id AS candidate_id,
      c.run_id AS source_run_id,
      c.promoted_company_id AS company_id,
      c.canonical_domain AS source_domain,
      m.municipality_name AS city,
      m.region_name AS region,
      m.province_code AS province_code,
      m.istat_code AS istat_code,
      place.loc->>'source_url' AS source_url
    FROM public.network_company_discovery_candidates c
    JOIN public.network_company_discovery_runs r ON r.id=c.run_id
    JOIN public.network_companies n ON n.id=c.promoted_company_id
    CROSS JOIN LATERAL jsonb_array_elements(
      coalesce(c.facility_candidates,'[]'::jsonb)
    ) AS place(loc)
    JOIN public.network_it_municipalities m
      ON m.is_current
     AND m.region_name=p_region
     AND lower(btrim(m.municipality_name))=lower(btrim(place.loc->>'city'))
     AND m.province_code=place.loc->>'province_code'
    WHERE c.country_code='IT' AND c.review_status='published'
      AND c.promoted_company_id IS NOT NULL
      AND c.governance_status='unreviewed'
      AND c.personal_data_detected IS NOT TRUE
      AND cardinality(coalesce(c.personal_data_fields,'{}'::text[]))=0
      AND c.match_company_id IS NULL
      AND n.country_code='IT' AND n.publication_status='published'
      AND n.archived_at IS NULL
      AND n.claimed_status='unclaimed'
      AND n.verification_status='unverified'
      AND lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
      AND r.governance_status='approved'
      AND r.governance_reviewed_by IS NOT NULL
      AND r.governance_reviewed_at IS NOT NULL
      AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
      AND r.database_rights_status IN ('low_risk','licensed')
      AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
      AND place.loc->>'region'=p_region
      AND place.loc->>'country_code'='IT'
      AND place.loc->>'site_kind'='source_reported'
      AND place.loc->>'source_url' ~* '^https://'
      AND lower(regexp_replace(
        split_part(split_part(place.loc->>'source_url','/',3),':',1),
        '^www[.]',''
      ))=lower(btrim(c.canonical_domain))
      AND NOT EXISTS (
        SELECT 1 FROM public.network_facilities f
        WHERE f.company_id=n.id AND f.archived_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_it_geo_evidence_candidates g
        WHERE g.company_id=n.id AND g.status='conflict'
      )
      AND NOT EXISTS (
        SELECT 1 FROM private.net_it_region_geo_auto_ledger a
        WHERE a.company_id=n.id OR a.candidate_id=c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.network_netfast3_suppressed_domains s
        WHERE s.domain=lower(btrim(c.canonical_domain))
      )
    ORDER BY c.created_at,c.id,m.istat_code
    LIMIT p_max
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    -- A discovery candidate could include more than one locality; never
    -- auto-select a second site once a company has acquired a facility.
    IF EXISTS (
      SELECT 1 FROM public.network_facilities f
      WHERE f.company_id=v_row.company_id AND f.archived_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    v_ready := v_ready + 1;
    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object('company_id',v_row.company_id,
        'city',v_row.city,'province',v_row.province_code,
        'region',v_row.region,'source_url',v_row.source_url)
    );
    IF p_dry_run THEN CONTINUE; END IF;

    -- Published but explicitly UNVERIFIED: no fabricated address, phone,
    -- evidence approval, certification or commercial capability.
    INSERT INTO public.network_facilities(
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) VALUES (
      v_row.company_id,'Sede — '||v_row.city,'site',v_row.city,v_row.region,
      'IT','published','unverified'
    ) RETURNING id INTO v_facility_id;

    INSERT INTO private.net_it_region_geo_auto_ledger(
      candidate_id,company_id,facility_id,source_run_id,source_url,
      source_domain,istat_code,province_code,region,city
    ) VALUES (
      v_row.candidate_id,v_row.company_id,v_facility_id,v_row.source_run_id,
      v_row.source_url,v_row.source_domain,v_row.istat_code,v_row.province_code,
      v_row.region,v_row.city
    );
    v_published := v_published + 1;
  END LOOP;
  RETURN jsonb_build_object(
    'contract','net-it-region-geo-auto-v1',
    'status',CASE WHEN p_dry_run THEN 'preview_only' ELSE 'published' END,
    'ready',v_ready,'published',v_published,
    'verification_status','unverified',
    'items',v_rows
  );
END
$autogeo$;

REVOKE ALL ON FUNCTION private.net_it_region_geo_auto_publish(text,integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;

-- Run after the existing automated discovery / publication jobs.
-- Safe while the region policy is enabled; every run is idempotent.
SELECT cron.schedule(
  'net-it-piemonte-geo-auto1',
  '47 * * * *',
  $cron$SELECT private.net_it_region_geo_auto_publish('Piemonte',25,false);$cron$
);
