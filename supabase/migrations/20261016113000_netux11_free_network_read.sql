-- NET-UX1.1: authenticated, approved-company Free read model.
-- Does NOT relax PA1.3 restricted RLS or any existing Pro entitlement.
-- Every SECURITY DEFINER body lives in the private schema; exposed wrappers
-- are SECURITY INVOKER and receive EXECUTE only for authenticated users.

create or replace function private.netux11_require_active_company(p_organization_id uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) then
    raise exception 'Network Free requires authenticated company membership'
      using errcode = '42501';
  end if;

  -- The authoritative active link is created by the governed activation flow.
  -- Claim alone, email signup alone and arbitrary organization IDs are insufficient.
  if not exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.organization_network_company_links l
      on l.organization_id = m.organization_id
    where m.user_id = (select auth.uid())
      and m.organization_id = p_organization_id
      and m.status = 'active'
      and l.link_status = 'active'
      and o.onboarding_status is distinct from 'suspended'
  ) then
    raise exception 'No active authorized company for Network Free'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.netux11_free_directory_impl(
  p_organization_id uuid,
  p_query text default null,
  p_role text default null,
  p_region text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
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
    limit least(greatest(coalesce(p_limit,50),1),50)
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
$$;

create or replace function private.netux11_free_profile_impl(
  p_organization_id uuid, p_company_id uuid
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_profile jsonb;
begin
  perform private.netux11_require_active_company(p_organization_id);

  -- Explicit allowlist. Never return contacts, IDs/tax information,
  -- unpublished facilities, internal review/evidence or tenant data.
  select jsonb_build_object(
    'contract', 'netux11-free-profile-v1',
    'company', jsonb_build_object(
      'id', c.id, 'legal_name', c.legal_name,
      'trading_name', c.trading_name, 'country_code', c.country_code,
      'website_url', c.website_url,
      'description', left(c.description, 1200),
      'claimed_status', c.claimed_status,
      'verification_status', c.verification_status
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', r.canonical_key, 'name', r.display_name,
        'is_primary', a.is_primary
      ) order by a.is_primary desc, r.display_name)
      from public.network_company_role_assignments a
      join public.network_company_roles r on r.id = a.role_id
      where a.company_id = c.id and r.status='active'
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(distinct p.display_name)
      from public.network_company_products cp
      join public.network_product_families p on p.id=cp.product_family_id
      where cp.company_id=c.id and p.status='active'
    ), '[]'::jsonb),
    'facilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'city', f.city, 'region', f.region, 'country_code', f.country_code
      ) order by f.city nulls last, f.id)
      from public.network_facilities f
      where f.company_id=c.id and f.publication_status='published'
        and f.archived_at is null
    ), '[]'::jsonb)
  ) into v_profile
  from public.network_companies c
  where c.id = p_company_id and c.publication_status='published'
    and c.archived_at is null and c.country_code='IT';

  return v_profile;
end;
$$;

-- Exposed RPCs remain invokers. The private definer is deliberately
-- the only narrowly privileged read boundary.
create or replace function public.netux11_free_directory(
  p_organization_id uuid, p_query text default null, p_role text default null,
  p_region text default null, p_limit integer default 50
)
returns jsonb language sql stable security invoker
set search_path = ''
as $$
  select private.netux11_free_directory_impl(
    p_organization_id,p_query,p_role,p_region,p_limit
  );
$$;

create or replace function public.netux11_free_profile(
  p_organization_id uuid, p_company_id uuid
)
returns jsonb language sql stable security invoker
set search_path = ''
as $$
  select private.netux11_free_profile_impl(p_organization_id,p_company_id);
$$;

-- Explicit execution grants: deny anon and PUBLIC, allow only authenticated.
revoke all on function private.netux11_require_active_company(uuid) from public, anon;
revoke all on function private.netux11_free_directory_impl(uuid,text,text,text,integer) from public, anon;
revoke all on function private.netux11_free_profile_impl(uuid,uuid) from public, anon;
revoke all on function public.netux11_free_directory(uuid,text,text,text,integer) from public, anon;
revoke all on function public.netux11_free_profile(uuid,uuid) from public, anon;

grant execute on function private.netux11_require_active_company(uuid) to authenticated;
grant execute on function private.netux11_free_directory_impl(uuid,text,text,text,integer) to authenticated;
grant execute on function private.netux11_free_profile_impl(uuid,uuid) to authenticated;
grant execute on function public.netux11_free_directory(uuid,text,text,text,integer) to authenticated;
grant execute on function public.netux11_free_profile(uuid,uuid) to authenticated;

comment on function public.netux11_free_directory(uuid,text,text,text,integer) is
 'NET-UX1.1 active-company authenticated Free directory. Explicit allowlist; no PA1.3 policy change.';
comment on function public.netux11_free_profile(uuid,uuid) is
 'NET-UX1.1 active-company authenticated Free basic profile. Private records never included.';
