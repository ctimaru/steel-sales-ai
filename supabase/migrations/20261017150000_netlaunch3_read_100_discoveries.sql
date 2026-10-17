-- NET-LAUNCH3: existing authorized Free and Pro discoveries grow beyond 50.
-- Keep the role/company access guards, source provenance, and public RPC signatures unchanged.
-- Bounded full-page read is temporary; use server pagination for future >100 density.
create or replace function private.netfast_free_directory_impl(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.netux11_require_active_company(p_organization_id);
 if length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
 or (p_role is not null and p_role not in
 ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'Invalid discovery filters' using errcode='22023';end if;
 with eligible as (
 select d.* from private.netfast_discovered_records d
 where (nullif(btrim(coalesce(p_query,'')),'') is null
 or strpos(lower(d.company_name),lower(btrim(p_query)))>0
 or strpos(lower(d.domain),lower(btrim(p_query)))>0)
 and (p_role is null or d.role_key=p_role)
 and nullif(btrim(coalesce(p_region,'')),'') is null
 ), chosen as (
 select * from eligible order by created_at desc,id desc
 limit least(greatest(coalesce(p_limit,50),1),100))
 select jsonb_build_object(
 'contract','netfast-discovery-v1',
 'total',(select count(*) from eligible),
 'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',d.id,'legal_name',d.company_name,'trading_name',null,
  'country_code','IT','website_url',d.website_url,
  'claimed_status','unclaimed','verification_status','unverified',
  'discovery_status','unconfirmed','source_url',d.source_url,
  'origin',d.origin,'finished_only',d.finished_only,
  'roles',jsonb_build_array(jsonb_build_object(
   'key',d.role_key,'name',coalesce(
    (select rr.display_name from public.network_company_roles rr
     where rr.canonical_key=d.role_key and rr.status='active' limit 1),
    'Categoria indicativa'),'is_primary',true)),
  'products','[]'::jsonb,'location',null
 ) order by d.created_at desc,d.id desc) from chosen d),'[]'::jsonb)
 ) into v;
 return v;
end $$;

create or replace function private.netlaunch1_pro_discovery_impl(
 p_organization_id uuid,p_query text default null,p_role text default null,
 p_region text default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.pa1_3_require_network_access(p_organization_id);
 if length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
  or (p_role is not null and p_role not in
    ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'Invalid Network search filters' using errcode='22023';end if;
 with eligible as(
   select d.* from private.netfast_discovered_records d
   where (nullif(btrim(coalesce(p_query,'')),'') is null
      or strpos(lower(d.company_name),lower(btrim(p_query)))>0
      or strpos(lower(d.domain),lower(btrim(p_query)))>0)
     and (p_role is null or d.role_key=p_role)
     -- Region unknown: never claim provisional company geography.
     and nullif(btrim(coalesce(p_region,'')),'') is null
 ), chosen as(
   select * from eligible order by created_at desc,id desc
   limit least(greatest(coalesce(p_limit,50),1),100))
 select jsonb_build_object(
  'contract','netlaunch1-pro-discovery-v1',
  'total',(select count(*) from eligible),
  'discovered_total',(select count(*) from eligible),
  'viewer_role',null,'regions','[]'::jsonb,
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',d.id,'legal_name',d.company_name,'trading_name',null,
   'country_code','IT','website_url',d.website_url,
   'claimed_status','unclaimed','verification_status','unverified',
   'discovery_status','unconfirmed','source_url',d.source_url,
   'origin',d.origin,'finished_only',d.finished_only,
   'roles',jsonb_build_array(jsonb_build_object(
    'key',d.role_key,'name','Categoria indicativa','is_primary',true)),
   'products','[]'::jsonb,'location',null
  ) order by d.created_at desc,d.id desc) from chosen d),'[]'::jsonb)
 ) into v;
 return v;
end $$;


-- Canonical Free directory shares the same 100-company temporary display cap.
CREATE OR REPLACE FUNCTION private.netux11_free_directory_impl(p_organization_id uuid, p_query text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  perform private.netux11_require_active_company(p_organization_id);
  if p_query is not null and length(p_query) > 120 then
    raise exception 'Search query too long' using errcode='22023';
  end if;
  if p_region is not null and length(p_region) > 90 then
    raise exception 'Region filter too long' using errcode='22023';
  end if;
  if p_role is not null and p_role not in
    ('producer','trader_distributor','processor_service_provider','end_user') then
    raise exception 'Invalid company role' using errcode='22023';
  end if;

  with eligible as (
    select c.id, c.legal_name, c.trading_name, c.country_code,
           c.website_url, c.verification_status, c.claimed_status
    from public.network_companies c
    where c.publication_status = 'published'
      and c.archived_at is null
      and c.country_code = 'IT'
      and (nullif(btrim(p_query),'') is null or
        strpos(lower(c.legal_name), lower(btrim(p_query))) > 0 or
        strpos(lower(coalesce(c.trading_name,'')), lower(btrim(p_query))) > 0)
      and (nullif(btrim(p_role),'') is null or exists (
        select 1 from public.network_company_role_assignments ra
        join public.network_company_roles rr on rr.id = ra.role_id
        where ra.company_id = c.id and rr.canonical_key = p_role
      ))
      and (nullif(btrim(p_region),'') is null or exists (
        select 1 from public.network_facilities f
        where f.company_id=c.id and f.publication_status='published'
          and f.archived_at is null and f.country_code='IT'
          and lower(btrim(f.region))=lower(btrim(p_region))
      ))
  ), chosen as (
    select * from eligible order by legal_name, id
    limit least(greatest(coalesce(p_limit,50),1),100)
  )
  select jsonb_build_object(
    'contract', 'netux11-free-v1',
    'total', (select count(*) from eligible),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'legal_name', c.legal_name,
        'trading_name', c.trading_name,
        'country_code', c.country_code,
        'website_url', c.website_url,
        'verification_status', c.verification_status,
        'claimed_status', c.claimed_status,
        'roles', coalesce((
          select jsonb_agg(jsonb_build_object(
            'key', r.canonical_key, 'name', r.display_name, 'is_primary', a.is_primary
          ) order by a.is_primary desc, r.display_name)
          from public.network_company_role_assignments a
          join public.network_company_roles r on r.id = a.role_id
          where a.company_id = c.id and r.status = 'active'
        ), '[]'::jsonb),
        'products', coalesce((
          select jsonb_agg(distinct p.display_name)
          from public.network_company_products cp
          join public.network_product_families p on p.id = cp.product_family_id
          where cp.company_id = c.id and p.status = 'active'
        ), '[]'::jsonb),
        'location', (
          select jsonb_build_object('region', f.region, 'city', f.city)
          from public.network_facilities f
          where f.company_id = c.id and f.publication_status='published'
            and f.archived_at is null and f.country_code = 'IT'
          order by f.created_at, f.id limit 1
        )
      ) order by c.legal_name, c.id) from chosen c
    ), '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(distinct f.region)
      from public.network_facilities f
      join public.network_companies c on c.id = f.company_id
      where f.publication_status='published'
        and f.archived_at is null and c.publication_status='published'
        and c.archived_at is null and f.country_code='IT'
        and nullif(btrim(f.region),'') is not null
    ), '[]'::jsonb),
    'viewer_role', (
      select r.canonical_key from public.organization_network_company_links l
      join public.network_company_role_assignments a on a.company_id=l.network_company_id
      join public.network_company_roles r on r.id=a.role_id
      where l.organization_id=p_organization_id and l.link_status='active'
      order by a.is_primary desc, r.sort_order nulls last, r.canonical_key
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$function$
;
