create or replace function public.m6_search_network(
  p_query text default null,
  p_role_keys text[] default null,
  p_product_keys text[] default null,
  p_capability_keys text[] default null,
  p_country_codes text[] default null,
  p_market_keys text[] default null,
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

revoke all on function public.m6_search_network(text,text[],text[],text[],text[],text[],integer,integer) from public,anon;
grant execute on function public.m6_search_network(text,text[],text[],text[],text[],text[],integer,integer) to authenticated,service_role;

create or replace function public.m6_network_company_profile(p_company_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'company',jsonb_build_object(
    'id',c.id,'legal_name',c.legal_name,'trading_name',c.trading_name,'country_code',c.country_code,
    'website_url',c.website_url,'website_domain',c.website_domain,'description',c.description,
    'verification_status',c.verification_status,'claimed_status',c.claimed_status
  ),
  'roles',coalesce((select jsonb_agg(jsonb_build_object('key',r.canonical_key,'name',r.display_name,'is_primary',ra.is_primary) order by ra.is_primary desc,r.sort_order,r.display_name)
    from public.network_company_role_assignments ra join public.network_company_roles r on r.id=ra.role_id where ra.company_id=c.id),'[]'::jsonb),
  'subtypes',coalesce((select jsonb_agg(jsonb_build_object('key',s.canonical_key,'name',s.display_name) order by s.sort_order,s.display_name)
    from public.network_company_subtype_assignments sa join public.network_company_subtypes s on s.id=sa.subtype_id where sa.company_id=c.id),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('key',pf.canonical_key,'name',pf.display_name,'relationship_type',cp.relationship_type,'facility_id',cp.facility_id) order by pf.sort_order,pf.display_name,cp.relationship_type)
    from public.network_company_products cp join public.network_product_families pf on pf.id=cp.product_family_id where cp.company_id=c.id),'[]'::jsonb),
  'markets',coalesce((select jsonb_agg(jsonb_build_object('key',m.canonical_key,'name',m.display_name) order by m.sort_order,m.display_name)
    from public.network_company_markets cm join public.network_markets m on m.id=cm.market_id where cm.company_id=c.id),'[]'::jsonb),
  'facilities',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'name',f.name,'facility_type',f.facility_type,'address_line_1',f.address_line_1,'address_line_2',f.address_line_2,
      'postal_code',f.postal_code,'city',f.city,'region',f.region,'country_code',f.country_code,'website_url',f.website_url,
      'verification_status',f.verification_status,
      'capabilities',coalesce((select jsonb_agg(jsonb_build_object('key',cap.canonical_key,'name',cap.display_name,'verification_status',fc.verification_status) order by cap.sort_order,cap.display_name)
        from public.network_facility_capabilities fc join public.network_capabilities cap on cap.id=fc.capability_id where fc.facility_id=f.id),'[]'::jsonb)
    ) order by f.country_code,f.city nulls last,f.name)
    from public.network_facilities f where f.company_id=c.id and f.publication_status='published'),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',nc.id,'facility_id',nc.facility_id,'contact_type',nc.contact_type,'display_name',nc.display_name,'email',nc.email,'phone',nc.phone,'website_url',nc.website_url) order by nc.contact_type,nc.display_name nulls last,nc.id)
    from public.network_contacts nc where nc.company_id=c.id and nc.publication_status='published'),'[]'::jsonb),
  'certifications',coalesce((select jsonb_agg(jsonb_build_object(
      'id',cc.id,'facility_id',cc.facility_id,'certification_type_key',ct.canonical_key,'certification_type_name',ct.display_name,
      'issuer',cc.issuer,'certificate_identifier',cc.certificate_identifier,'valid_from',cc.valid_from,'valid_to',cc.valid_to,
      'scope_text',cc.scope_text,'verification_status',cc.verification_status,'evidence_reference',cc.evidence_reference
    ) order by ct.sort_order,ct.display_name,cc.valid_to desc nulls last)
    from public.network_company_certifications cc join public.network_certification_types ct on ct.id=cc.certification_type_id where cc.company_id=c.id),'[]'::jsonb)
)
from public.network_companies c
where c.id=p_company_id and c.publication_status='published';
$function$;

revoke all on function public.m6_network_company_profile(uuid) from public,anon;
grant execute on function public.m6_network_company_profile(uuid) to authenticated,service_role;

comment on function public.m6_search_network(text,text[],text[],text[],text[],text[],integer,integer) is
  'M6 authenticated faceted Network search. SECURITY INVOKER; raw-table RLS remains authoritative.';
comment on function public.m6_network_company_profile(uuid) is
  'M6 authenticated published Network company profile read model. SECURITY INVOKER; governance/control tables are excluded.';
