-- NET-UX-FILTERS3: country browse available to Free and Pro viewers after
-- the same active-organization/paid-entitlement guard used by Network itself.
-- The old m6_search_network SQL-invoker RPC observes Pro-restrictive table RLS;
-- Free users saw 0 foreign results even though the authorized country banner
-- correctly counted published companies. Never change or bypass those RLS rules.
create or replace function private.netux_filters3_country_page_impl(
  p_organization_id uuid,
  p_access text,
  p_country text,
  p_query text default null,
  p_role text default null,
  p_product text default null,
  p_capability text default null,
  p_market text default null,
  p_page integer default 1,
  p_limit integer default 18
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_country text := upper(btrim(coalesce(p_country,'')));
  v_page integer := coalesce(p_page,1);
  v_limit integer := least(greatest(coalesce(p_limit,18),1),18);
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_access='free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access='pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid Network access mode' using errcode='22023';
  end if;
  if v_country !~ '^[A-Z]{2}$'
      or v_page < 1 or v_page > 100000
      or length(coalesce(p_query,'')) > 120
      or length(coalesce(p_product,'')) > 120
      or length(coalesce(p_capability,'')) > 120
      or length(coalesce(p_market,'')) > 120
      or (nullif(p_role,'') is not null
        and p_role not in ('producer','trader_distributor','processor_service_provider','end_user'))
  then
    raise exception 'Invalid country Network filters' using errcode='22023';
  end if;

  with eligible as (
    select c.id,c.legal_name,c.trading_name,c.country_code,c.website_url,
           c.verification_status,c.claimed_status
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      -- The banner counts the company's canonical country, not facility exports.
      and c.country_code=v_country
      and (nullif(btrim(coalesce(p_query,'')),'') is null
        or strpos(lower(c.legal_name),lower(btrim(p_query)))>0
        or strpos(lower(coalesce(c.trading_name,'')),lower(btrim(p_query)))>0
        or strpos(lower(coalesce(c.website_domain,'')),lower(btrim(p_query)))>0)
      and (nullif(p_role,'') is null or exists (
        select 1 from public.network_company_role_assignments ra
        join public.network_company_roles r on r.id=ra.role_id
        where ra.company_id=c.id and r.status='active'
          and r.canonical_key=p_role
      ))
      and (nullif(p_product,'') is null or exists (
        select 1 from public.network_company_products cp
        join public.network_product_families pf on pf.id=cp.product_family_id
        where cp.company_id=c.id and pf.status='active'
          and pf.canonical_key=p_product
      ))
      and (nullif(p_capability,'') is null or exists (
        select 1 from public.network_facilities f
        join public.network_facility_capabilities fc on fc.facility_id=f.id
        join public.network_capabilities cap on cap.id=fc.capability_id
        where f.company_id=c.id and f.publication_status='published'
          and f.archived_at is null and cap.canonical_key=p_capability
      ))
      and (nullif(p_market,'') is null or exists (
        select 1 from public.network_company_markets cm
        join public.network_markets m on m.id=cm.market_id
        where cm.company_id=c.id and m.canonical_key=p_market
      ))
  ), chosen as (
    select * from eligible
    order by lower(legal_name),id
    limit v_limit offset (v_page-1)*v_limit
  )
  select
    (select count(*)::integer from eligible),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,
        'legal_name',c.legal_name,
        'trading_name',c.trading_name,
        'country_code',c.country_code,
        'website_url',c.website_url,
        'claimed_status',c.claimed_status,
        'verification_status',c.verification_status,
        'roles',coalesce((
          select jsonb_agg(jsonb_build_object(
            'key',r.canonical_key,'name',r.display_name,
            'is_primary',a.is_primary
          ) order by a.is_primary desc,r.display_name)
          from public.network_company_role_assignments a
          join public.network_company_roles r on r.id=a.role_id
          where a.company_id=c.id and r.status='active'
        ),'[]'::jsonb),
        'products',coalesce((
          select jsonb_agg(distinct pf.display_name)
          from public.network_company_products cp
          join public.network_product_families pf on pf.id=cp.product_family_id
          where cp.company_id=c.id and pf.status='active'
        ),'[]'::jsonb),
        'location',(
          select jsonb_build_object('city',f.city,'region',f.region)
          from public.network_facilities f
          where f.company_id=c.id and f.publication_status='published'
            and f.archived_at is null
          order by f.created_at,f.id limit 1
        )
      ) order by lower(c.legal_name),c.id)
      from chosen c
    ),'[]'::jsonb)
  into v_total,v_items;
  return jsonb_build_object(
    'contract','netux-filters3-country-v1',
    'country',v_country,
    'total',v_total,
    'items',v_items,
    'page',v_page,'page_size',v_limit,
    'has_more',v_total::bigint>v_page::bigint*v_limit::bigint
  );
end;
$$;

-- Limited authenticated facade: all authorization is re-checked within the
-- private implementation using request JWT and exact organization identity.
create or replace function public.netux_filters3_country_page(
  p_organization_id uuid,
  p_access text,
  p_country text,
  p_query text default null,
  p_role text default null,
  p_product text default null,
  p_capability text default null,
  p_market text default null,
  p_page integer default 1,
  p_limit integer default 18
) returns jsonb
language sql stable security definer set search_path=''
as $$
  select private.netux_filters3_country_page_impl(
    p_organization_id,p_access,p_country,p_query,p_role,
    p_product,p_capability,p_market,p_page,p_limit
  );
$$;

revoke all on function private.netux_filters3_country_page_impl(
  uuid,text,text,text,text,text,text,text,integer,integer
) from public,anon,authenticated,service_role;
revoke all on function public.netux_filters3_country_page(
  uuid,text,text,text,text,text,text,text,integer,integer
) from public,anon,authenticated;
grant execute on function public.netux_filters3_country_page(
  uuid,text,text,text,text,text,text,text,integer,integer
) to authenticated;

comment on function public.netux_filters3_country_page(
  uuid,text,text,text,text,text,text,text,integer,integer
) is 'NET-UX-FILTERS3: authenticated, organization-guarded published company browse by country with Free and Pro access modes.';
