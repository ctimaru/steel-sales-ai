-- NET-DATA1-EU TRADER1A — governed PRIVATE research of European tube distributors.
-- This is not the Network directory, not an automatic country backfill,
-- not a crawler authorization or a publication/claim/verification pipeline.
BEGIN;

CREATE TABLE private.netdata1eu_trader_research (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 research_batch text NOT NULL CHECK (length(research_batch) BETWEEN 5 AND 100),
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 3 AND 180),
 -- Search-market focus does NOT assert a verified legal domicile.
 target_country_code text NOT NULL CHECK (target_country_code IN
   ('AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK')),
 legal_name text,
 legal_country_code text CHECK (legal_country_code IS NULL OR legal_country_code IN
   ('AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK')),
 legal_identity_evidence_url text,
 domain text NOT NULL CHECK (domain ~ '^[a-z0-9][a-z0-9.-]{2,180}$'
                            AND domain NOT LIKE 'www.%'),
 official_website text NOT NULL CHECK (official_website ~ '^https://[^/?#[:space:]]+'),
 role_evidence_url text NOT NULL CHECK (role_evidence_url ~ '^https://[^/?#[:space:]]+'),
 product_evidence_url text CHECK (product_evidence_url IS NULL OR
                              product_evidence_url ~ '^https://[^/?#[:space:]]+'),
 product_evidence_summary text CHECK (product_evidence_summary IS NULL OR
                              length(product_evidence_summary) BETWEEN 8 AND 350),
 discovered_via_url text CHECK (discovered_via_url IS NULL OR
                            discovered_via_url ~ '^https://[^/?#[:space:]]+'),
 -- No rights can be inferred from first-party publication or association listing.
 source_rights text NOT NULL DEFAULT 'not_assessed'
   CHECK (source_rights IN ('not_assessed','rights_review','license_approved')),
 research_state text NOT NULL DEFAULT 'research_only'
   CHECK (research_state IN ('research_only','identity_hold','source_hold','ready_for_review')),
 role_assertion text NOT NULL DEFAULT 'candidate'
   CHECK (role_assertion IN ('candidate','source_observed','reviewed')),
 canonical_company_id uuid REFERENCES public.network_companies(id),
 -- netfast_discovered_records is a governed read VIEW (not a base table):
 -- record its UUID as a reconciliation hint; audit on live view before linking.
 discovered_record_id uuid,
 target_lead_id uuid REFERENCES public.network_core_target_leads(id),
 review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (legal_name IS NULL OR
   (legal_country_code IS NOT NULL AND legal_identity_evidence_url ~ '^https://[^/?#[:space:]]+')),
 CHECK (legal_country_code IS NULL OR
   (legal_name IS NOT NULL AND legal_identity_evidence_url ~ '^https://[^/?#[:space:]]+')),
 -- Do not allow marking a record ready without a human license gate.
 CHECK (research_state <> 'ready_for_review' OR source_rights='license_approved'),
 CONSTRAINT netdata1eu_trader_official_host CHECK (
   lower(regexp_replace(split_part(official_website,'/',3),'^www[.]',''))=domain
 )
);
CREATE UNIQUE INDEX netdata1eu_trader_batch_identity_idx
 ON private.netdata1eu_trader_research(research_batch,domain,lower(display_name));
CREATE INDEX netdata1eu_trader_country_state_idx
 ON private.netdata1eu_trader_research(target_country_code,research_state);

CREATE TABLE private.netdata1eu_trader_facility_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trader_research_id uuid NOT NULL REFERENCES private.netdata1eu_trader_research(id) ON DELETE CASCADE,
 country_code text NOT NULL CHECK (country_code IN
   ('AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK')),
 city text NOT NULL CHECK (length(city) BETWEEN 2 AND 130),
 facility_type text NOT NULL CHECK (facility_type IN
    ('office','warehouse','distribution_center','facility_unspecified')),
 evidence_url text NOT NULL CHECK (evidence_url ~ '^https://[^/?#[:space:]]+'),
 -- NUTS mapping is deliberately absent: do not invent from city names.
 evidence_state text NOT NULL DEFAULT 'source_observed'
   CHECK (evidence_state IN ('source_observed','identity_hold','reviewed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trader_research_id,country_code,city,facility_type)
);
ALTER TABLE private.netdata1eu_trader_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.netdata1eu_trader_facility_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netdata1eu_trader_research FROM public,anon,authenticated;
REVOKE ALL ON private.netdata1eu_trader_facility_evidence FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.netdata1eu_trader_research TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.netdata1eu_trader_facility_evidence TO service_role;

-- Read-only service analysis: exact-domain collisions are *holds*, not dedup
-- decisions. Multinationals can share a domain across distinct legal entities.
CREATE OR REPLACE FUNCTION private.netdata1eu_trader_audit(
 p_batch text DEFAULT NULL, p_limit integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
   OR (p_batch IS NOT NULL AND length(p_batch)>100) THEN
   RAISE EXCEPTION 'Invalid bounded trader research audit' USING errcode='22023';
 END IF;
 WITH rows AS (
   SELECT r.*,
   (SELECT count(*)::integer FROM public.network_companies c
     WHERE c.website_domain=r.domain AND c.archived_at IS NULL) canonical_matches,
   (SELECT count(*)::integer FROM private.netfast_discovered_records d
     WHERE d.domain=r.domain) discovered_matches,
   (SELECT count(*)::integer FROM public.network_core_target_leads l
     WHERE l.canonical_domain=r.domain) target_matches,
   (SELECT count(*)::integer FROM private.netdata1eu_trader_research other
     WHERE other.domain=r.domain AND other.id<>r.id) peer_matches,
   (SELECT count(*)::integer FROM private.netdata1eu_trader_facility_evidence f
     WHERE f.trader_research_id=r.id) sourced_facilities
   FROM private.netdata1eu_trader_research r
   WHERE p_batch IS NULL OR r.research_batch=p_batch
 )
 SELECT jsonb_build_object(
   'contract','netdata1eu-trader-audit-v1',
   'total',(SELECT count(*) FROM rows),
   'with_duplicate_domain',(SELECT count(*) FROM rows
     WHERE canonical_matches+discovered_matches+target_matches+peer_matches>0),
   'with_facility_evidence',(SELECT count(*) FROM rows WHERE sourced_facilities>0),
   'ready_for_review',(SELECT count(*) FROM rows WHERE research_state='ready_for_review'),
   'published_by_this_pipeline',0,
   'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'id',t.id,'name',t.display_name,'target_country',t.target_country_code,
     'legal_country',t.legal_country_code,'domain',t.domain,
     'research_state',t.research_state,'source_rights',t.source_rights,
     'canonical_matches',t.canonical_matches,'discovered_matches',t.discovered_matches,
     'existing_lead_matches',t.target_matches,'other_research_matches',t.peer_matches,
     'sourced_facilities',t.sourced_facilities,'source_url',t.role_evidence_url)
     ORDER BY t.target_country_code,t.display_name)
     FROM (SELECT * FROM rows ORDER BY target_country_code,display_name LIMIT p_limit) t),
     '[]'::jsonb)
 ) INTO v;
 RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION private.netdata1eu_trader_audit(text,integer)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.netdata1eu_trader_audit(text,integer)
  TO service_role;
COMMENT ON TABLE private.netdata1eu_trader_research IS
 'TRADER1A privately staged EU research. No auto-publication, verification, source license or country inference.';
COMMENT ON FUNCTION private.netdata1eu_trader_audit(text,integer) IS
 'TRADER1A read-only service audit, exact-domain warnings across canonical, discovered, staging. Duplicates require identity review.';
COMMIT;
