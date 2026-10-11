-- CRAWL-IT5: extend M6 using the identical public/published tenant-safe query semantics.
-- Region and city originate from published structured facilities until ISTAT approval;
-- province requires explicit approved ISTAT reconciliation. Never match unpublished facilities.
create or replace function public.m6_search_network_geo(
  p_query text default null,
  p_role_keys text[] default null,
  p_product_keys text[] default null,
  p_capability_keys text[] default null,
  p_country_codes text[] default null,
  p_market_keys text[] default null,
  p_region text default null,
  p_province text default null,
  p_city text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
with params as (
  select
    nullif(btrim(p_query),'') q,
    case when p_role_keys is null or cardinality(p_role_keys)=0 then null else p_role_keys end role_keys,
    case when p_product_keys is null or cardinality(p_product_keys)=0 then null else p_product_keys end product_keys,
    case when p_capability_keys is null or cardinality(p_capability_keys)=0 then null else p_capability_keys end capability_keys,
    case when p_country_codes is null or cardinality(p_country_codes)=0 then null else upper(p_country_codes::text)::text[] end country_codes,
    case when p_market_keys is null or cardinality(p_market_keys)=0 then null else p_market_keys end market_keys,
    nullif(btrim(p_region),'') region,
    nullif(upper(btrim(p_province)),'') province,
    nullif(btrim(p_city),'') city,
    least(greatest(coalesce(p_limit,25),1),100) lim,
    greatest(coalesce(p_offset,0),0) off
),
base as (
  select c.*
  from public.network_companies c, params p
  where c.publication_status='published'
    and (p.q is null or c.legal_name ilike '%'||p.q||'%' or coalesce(c.trading_name,'') ilike '%'||p.q||'%' or coalesce(c.website_domain,'') ilike '%'||p.q||'%')
    and (p.role_keys is null or exists (
      select 1 from public.network_company_role_assignments ra
      join public.network_company_roles r on r.id=ra.role_id
      where ra.company_id=c.id and r.canonical_key=any(p.role_keys)
    ))
    and (p.product_keys is null or exists (
      select 1 from public.network_company_products cp
      join public.network_product_families pf on pf.id=cp.product_family_id
      where cp.company_id=c.id and pf.canonical_key=any(p.product_keys)
    ))
    and (p.market_keys is null or exists (
      select 1 from public.network_company_markets cm
      join public.network_markets m on m.id=cm.market_id
      where cm.company_id=c.id and m.canonical_key=any(p.market_keys)
    ))
    and ((p.region is null and p.province is null and p.city is null) or exists (
      select 1 from public.network_facilities f
      left join public.network_it_facility_geo_reviews g
        on g.facility_id=f.id and g.status='approved'
      left join public.network_it_municipalities im on im.istat_code=g.proposed_istat_code
      where f.company_id=c.id and f.publication_status='published'
        and f.archived_at is null and f.country_code='IT'
        and (p.region is null or lower(coalesce(im.region_name,f.region,''))=lower(p.region))
        and (p.city is null or lower(coalesce(im.municipality_name,f.city,''))=lower(p.city))
        and (p.province is null or upper(coalesce(im.province_code,''))=p.province)
    ))
    and (p.capability_keys is null or exists (
      select 1 from public.network_facilities f
      join public.network_facility_capabilities fc on fc.facility_id=f.id
      join public.network_capabilities cap on cap.id=fc.capability_id
      where f.company_id=c.id and f.publication_status='published' and cap.canonical_key=any(p.capability_keys)
    ))
    and (p.country_codes is null or c.country_code=any(p.country_codes) or exists (
      select 1 from public.network_facilities f
      where f.company_id=c.id and f.publication_status='published' and f.country_code=any(p.country_codes)
    ))
),
counted as (select count(*)::integer total from base),
paged as (
  select * from base
  order by legal_name,id
  limit (select lim from params)
  offset (select off from params)
),
rows_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'legal_name',c.legal_name,'trading_name',c.trading_name,
    'country_code',c.country_code,'website_url',c.website_url,'website_domain',c.website_domain,
    'verification_status',c.verification_status,'claimed_status',c.claimed_status,
    'roles',coalesce((select jsonb_agg(jsonb_build_object('key',r.canonical_key,'name',r.display_name,'is_primary',ra.is_primary) order by ra.is_primary desc,r.sort_order,r.display_name)
      from public.network_company_role_assignments ra join public.network_company_roles r on r.id=ra.role_id where ra.company_id=c.id),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(distinct jsonb_build_object('key',pf.canonical_key,'name',pf.display_name,'relationship_type',cp.relationship_type))
      from public.network_company_products cp join public.network_product_families pf on pf.id=cp.product_family_id where cp.company_id=c.id),'[]'::jsonb),
    'markets',coalesce((select jsonb_agg(distinct jsonb_build_object('key',m.canonical_key,'name',m.display_name))
      from public.network_company_markets cm join public.network_markets m on m.id=cm.market_id where cm.company_id=c.id),'[]'::jsonb),
    'capabilities',coalesce((select jsonb_agg(distinct jsonb_build_object('key',cap.canonical_key,'name',cap.display_name))
      from public.network_facilities f join public.network_facility_capabilities fc on fc.facility_id=f.id join public.network_capabilities cap on cap.id=fc.capability_id
      where f.company_id=c.id and f.publication_status='published'),'[]'::jsonb),
    'facility_countries',coalesce((select jsonb_agg(distinct f.country_code) from public.network_facilities f where f.company_id=c.id and f.publication_status='published'),'[]'::jsonb)
  ) order by c.legal_name,c.id),'[]'::jsonb) items
  from paged c
)
select jsonb_build_object('items',rows_json.items,'total',counted.total,'limit',(select lim from params),'offset',(select off from params))
from rows_json,counted;
$function$;
revoke all on function public.m6_search_network_geo(text,text[],text[],text[],text[],text[],text,text,text,integer,integer) from public,anon;
grant execute on function public.m6_search_network_geo(text,text[],text[],text[],text[],text[],text,text,text,integer,integer) to authenticated,service_role;

create or replace function public.m6_network_geo_facets()
returns jsonb language sql stable security invoker set search_path=''
as $$
with valid_facilities as (
 select distinct f.id,f.region,f.city
 from public.network_facilities f
 join public.network_companies c on c.id=f.company_id
 where c.publication_status='published' and f.publication_status='published'
 and f.archived_at is null and f.country_code='IT'
), regions as (
 select coalesce(jsonb_agg(region order by region),'[]'::jsonb) items from (
 select distinct region from valid_facilities where nullif(btrim(region),'') is not null
 ) q
), cities as (
 select coalesce(jsonb_agg(city order by city),'[]'::jsonb) items from (
 select distinct city from valid_facilities where nullif(btrim(city),'') is not null
 ) q
), provinces as (
 select coalesce(jsonb_agg(province_code order by province_code),'[]'::jsonb) items from (
 select distinct im.province_code
 from public.network_it_facility_geo_reviews g
 join public.network_it_municipalities im on im.istat_code=g.proposed_istat_code
 join public.network_facilities f on f.id=g.facility_id
 join public.network_companies c on c.id=f.company_id
 where g.status='approved' and f.publication_status='published'
 and f.archived_at is null and c.publication_status='published'
 ) q
)
select jsonb_build_object('regions',regions.items,'cities',cities.items,'provinces',provinces.items,
'location_note','Regione e comune da sedi pubblicate; provincia disponibile solo con validazione ISTAT.')
from regions,cities,provinces;
$$;
revoke all on function public.m6_network_geo_facets() from public,anon;
grant execute on function public.m6_network_geo_facets() to authenticated,service_role;
