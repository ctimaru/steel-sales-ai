-- EUROPE1C country provenance correction: country_code is the legal
-- entity's declared country, never the selected foreign facility country.
-- Search remains constrained by the published facility's country + NUTS area.
BEGIN;
CREATE OR REPLACE FUNCTION public.net_europe1c_region_search(
 p_organization_id uuid, p_access text, p_country text, p_region_code text,
 p_query text DEFAULT NULL, p_role text DEFAULT NULL, p_product text DEFAULT NULL,
 p_capability text DEFAULT NULL, p_market text DEFAULT NULL,
 p_page integer DEFAULT 1, p_limit integer DEFAULT 6
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_country text:=upper(btrim(coalesce(p_country,'')));
 v_code text:=upper(btrim(coalesce(p_region_code,'')));
 v_count integer:=0; v_items jsonb:='[]'::jsonb;
 v_page integer:=coalesce(p_page,1); v_limit integer:=coalesce(p_limit,6);
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING errcode='42501';
 END IF;
 IF p_access='free' THEN
  PERFORM private.netux11_require_active_company(p_organization_id);
 ELSIF p_access='pro' THEN
  PERFORM private.pa1_3_require_network_access(p_organization_id);
 ELSE
  RAISE EXCEPTION 'Invalid access' USING errcode='22023';
 END IF;
 IF v_page<1 OR v_page>100000 OR v_limit<1 OR v_limit>18 OR
    length(coalesce(p_query,''))>120 OR
    length(coalesce(p_role,''))>90 OR length(coalesce(p_product,''))>100 OR
    length(coalesce(p_capability,''))>100 OR length(coalesce(p_market,''))>100 OR
    NOT EXISTS (SELECT 1 FROM public.network_eu_nuts2024_regions r
      WHERE r.code=v_code AND r.country_code=v_country) THEN
  RAISE EXCEPTION 'Unsupported European region' USING errcode='22023';
 END IF;

 WITH matched_facilities AS (
  SELECT DISTINCT ON (f.company_id) f.company_id, f.id facility_id,
   f.city, f.region, f.eu_nuts2024_code
  FROM public.network_facilities f
  JOIN public.network_eu_nuts2024_regions r ON r.code=v_code AND r.country_code=v_country
  WHERE f.country_code=v_country AND f.publication_status='published'
   AND f.archived_at IS NULL
   AND (f.eu_nuts2024_code=r.code
      OR (f.eu_nuts2024_code IS NULL AND nullif(btrim(f.region),'') IS NOT NULL
         AND lower(btrim(f.region))=lower(btrim(r.name_latn))))
  ORDER BY f.company_id, f.created_at, f.id
 ), eligible AS (
  SELECT c.id, c.legal_name,c.trading_name,c.country_code,c.website_url,
   c.verification_status,c.claimed_status, mf.facility_id, mf.city, mf.region,
   mf.eu_nuts2024_code
  FROM public.network_companies c
  JOIN matched_facilities mf ON mf.company_id=c.id
  WHERE c.publication_status='published' AND c.archived_at IS NULL
   AND (nullif(btrim(coalesce(p_query,'')),'') IS NULL
     OR strpos(lower(c.legal_name),lower(btrim(p_query)))>0
     OR strpos(lower(coalesce(c.trading_name,'')),lower(btrim(p_query)))>0
     OR strpos(lower(coalesce(c.website_domain,'')),lower(btrim(p_query)))>0)
   AND (nullif(p_role,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_role_assignments a
     JOIN public.network_company_roles cr ON cr.id=a.role_id
     WHERE a.company_id=c.id AND cr.canonical_key=p_role))
   AND (nullif(p_product,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_products cp
     JOIN public.network_product_families pf ON pf.id=cp.product_family_id
     WHERE cp.company_id=c.id AND pf.canonical_key=p_product))
   AND (nullif(p_market,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_markets cm
     JOIN public.network_markets m ON m.id=cm.market_id
     WHERE cm.company_id=c.id AND m.canonical_key=p_market))
   AND (nullif(p_capability,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_facility_capabilities fc
     JOIN public.network_capabilities cap ON cap.id=fc.capability_id
     WHERE fc.facility_id=mf.facility_id AND cap.canonical_key=p_capability))
 ), picked AS (
  SELECT * FROM eligible ORDER BY lower(legal_name), id
  LIMIT v_limit OFFSET (v_page-1)*v_limit
 )
 SELECT (SELECT count(*)::integer FROM eligible),
  coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',x.id,'legal_name',x.legal_name,'trading_name',x.trading_name,
   'country_code',x.country_code,'website_url',x.website_url,
   'claimed_status',x.claimed_status,'verification_status',x.verification_status,
   'location',jsonb_build_object('region',x.region,'city',x.city),
   'geography_status','published',
   'roles',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'key',cr.canonical_key,'name',cr.display_name,'is_primary',a.is_primary)
     ORDER BY a.is_primary DESC,cr.display_name)
     FROM public.network_company_role_assignments a
     JOIN public.network_company_roles cr ON cr.id=a.role_id
     WHERE a.company_id=x.id AND cr.status='active'),'[]'::jsonb),
   'products',coalesce((SELECT jsonb_agg(DISTINCT pf.display_name)
     FROM public.network_company_products cp
     JOIN public.network_product_families pf ON pf.id=cp.product_family_id
     WHERE cp.company_id=x.id AND pf.status='active'),'[]'::jsonb),
   'capabilities',coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'key',cap.canonical_key,'name',cap.display_name))
     FROM public.network_facility_capabilities fc
     JOIN public.network_capabilities cap ON cap.id=fc.capability_id
     WHERE fc.facility_id=x.facility_id AND cap.status='active'),'[]'::jsonb)
  ) ORDER BY lower(x.legal_name),x.id) FROM picked x),'[]'::jsonb)
 INTO v_count,v_items;
 RETURN jsonb_build_object('contract','net-europe1c-region-v1',
  'country',v_country,'region_code',v_code,'scope','published_facilities_only',
  'total',v_count,'page',v_page,'page_size',v_limit,'items',v_items);
END
$fn$;

COMMENT ON FUNCTION public.net_europe1c_region_search(uuid,text,text,text,text,text,text,text,text,integer,integer)
 IS 'EUROPE1C published matching foreign facility: return true legal company country, not filtered facility country; no identity inference.';
COMMIT;
