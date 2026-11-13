-- NET-PRO-CATALOG1.B — source-backed catalog coverage and isolated, organization-scoped
-- Network PRO module/territory entitlements. This migration does NOT grant access
-- to anybody. No existing Network Free/legacy PRO route or RLS policy is changed.
-- The PA1.3 append-only event ledger remains the single entitlement source.

create or replace function private.netpro1b_europe_country(p_country text)
returns boolean
language sql immutable security invoker set search_path=''
as $$
  select upper(coalesce(p_country,'')) = any(array[
    'AT','BE','BG','CY','HR','DK','EE','FI','FR','DE','GR','IE','IT','LV',
    'LT','LU','MT','NL','PL','PT','CZ','RO','SK','SI','ES','SE','HU','CH','GB'
  ]);
$$;

create or replace function private.netpro1b_module_role(p_module text)
returns text language sql immutable security invoker set search_path=''
as $$
  select case p_module
    when 'producers' then 'producer'
    when 'distributors' then 'trader_distributor'
    when 'end_users' then 'end_user'
    when 'processors' then 'processor_service_provider'
    else null end;
$$;

-- A module/country decision is computed exclusively from authenticated active
-- organization membership + the append-only entitlement history. Never trust
-- a module, country or organization supplied by a browser as authority.
create or replace function private.netpro1b_allowed_for(
  p_organization_id uuid,p_module text,p_country text
)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_country text := upper(coalesce(p_country,''));
  v_event public.organization_product_entitlement_events%rowtype;
  v_territory text;
begin
  if v_user is null or private.netpro1b_module_role(p_module) is null
     or not private.netpro1b_europe_country(v_country) then
    return false;
  end if;

  if private.is_platform_superadmin() then
    return true;
  end if;

  if not exists(
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=v_user and m.organization_id=p_organization_id
      and m.status='active' and o.onboarding_status is distinct from 'suspended'
  ) then
    return false;
  end if;

  -- Existing full-network PRO users continue with their already-governed access.
  if private.pa1_3_network_access_allowed_for(p_organization_id) then
    return true;
  end if;

  -- Territory EU includes Italy. IT never unlocks RO or any other country.
  for v_territory in
    select unnest(case when v_country='IT'
      then array['eu','it']::text[] else array['eu']::text[] end)
  loop
    select * into v_event
    from public.organization_product_entitlement_events e
    where e.organization_id=p_organization_id
      and e.product_key='network_pro_'||p_module||'_'||v_territory
      and e.effective_at<=now()
    order by e.effective_at desc,e.event_order desc
    limit 1;

    if found and v_event.event_type='granted'
       and (v_event.expires_at is null or v_event.expires_at>now()) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Module grants/revocations reuse the PA1.3 append-only ledger and the existing
-- platform-owner/service-only authority gate. No self-serve or client grants.
create or replace function private.netpro1b_module_event_impl(
  p_organization_id uuid,p_module text,p_territory text,
  p_event_type text,p_source_kind text,p_source_reference text,
  p_idempotency_key text,p_expires_at timestamptz
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_authority jsonb;
  v_event public.organization_product_entitlement_events%rowtype;
  v_key text;
  v_source text := lower(btrim(coalesce(p_source_kind,'')));
  v_ref text := nullif(btrim(coalesce(p_source_reference,'')),'');
  v_id text := btrim(coalesce(p_idempotency_key,''));
  v_metadata jsonb;
begin
  v_authority := private.pa1_3_require_entitlement_authority();
  if private.netpro1b_module_role(p_module) is null
     or p_territory not in ('IT','EU') then
    raise exception 'Invalid Network PRO module or territory' using errcode='22023';
  end if;
  if p_event_type not in ('granted','revoked')
     or v_source not in ('manual','pilot','trial','subscription','bundle','system') then
    raise exception 'Invalid Network PRO entitlement event' using errcode='22023';
  end if;
  if v_source in ('subscription','bundle') and v_ref is null then
    raise exception 'Billing reference required for purchased module' using errcode='22023';
  end if;
  if char_length(v_id) not between 8 and 200
     or v_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Invalid idempotency key' using errcode='22023';
  end if;
  if p_event_type='revoked' and p_expires_at is not null then
    raise exception 'Revocation must not have expiry' using errcode='22023';
  end if;
  if p_event_type='granted' and p_expires_at is not null and p_expires_at<=now() then
    raise exception 'Expiry must be in the future' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations o where o.id=p_organization_id) then
    raise exception 'Organization does not exist' using errcode='P0002';
  end if;

  v_key := 'network_pro_'||p_module||'_'||lower(p_territory);
  v_metadata := jsonb_build_object('module',p_module,'territory',p_territory,
                                  'contract','net-pro-catalog1b');
  select * into v_event
  from public.organization_product_entitlement_events e
  where e.idempotency_key=v_id;

  if found then
    if v_event.organization_id=p_organization_id
       and v_event.product_key=v_key
       and v_event.event_type=p_event_type
       and v_event.source_kind=v_source
       and v_event.source_reference is not distinct from v_ref
       and v_event.expires_at is not distinct from p_expires_at
       and v_event.metadata=v_metadata then
      return jsonb_build_object('event_id',v_event.id,'product_key',v_key,
        'event_type',p_event_type,'idempotent',true);
    end if;
    raise exception 'Network PRO idempotency conflict' using errcode='23505';
  end if;

  if p_event_type='revoked' and not exists(
    select 1 from public.organization_product_entitlement_events e
    where e.organization_id=p_organization_id
      and e.product_key=v_key and e.event_type='granted'
  ) then
    raise exception 'Cannot revoke ungranted module' using errcode='22023';
  end if;

  insert into public.organization_product_entitlement_events(
    organization_id,product_key,event_type,source_kind,source_reference,
    idempotency_key,effective_at,expires_at,actor_user_id,actor_authority_type,
    metadata
  ) values (
    p_organization_id,v_key,p_event_type,v_source,v_ref,v_id,now(),
    p_expires_at,nullif(v_authority->>'actor_user_id','')::uuid,
    v_authority->>'actor_authority_type',v_metadata
  ) returning * into v_event;

  return jsonb_build_object('event_id',v_event.id,'product_key',v_key,
    'event_type',p_event_type,'idempotent',false);
end;
$$;

create or replace function public.netpro1b_module_event(
  p_organization_id uuid,p_module text,p_territory text,
  p_event_type text,p_source_kind text,p_source_reference text,
  p_idempotency_key text,p_expires_at timestamptz default null
)
returns jsonb language sql volatile security invoker set search_path=''
as $$
  select private.netpro1b_module_event_impl(
    p_organization_id,p_module,p_territory,p_event_type,
    p_source_kind,p_source_reference,p_idempotency_key,p_expires_at
  );
$$;

create or replace function private.netpro1b_access_state_impl(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_modules jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not private.is_platform_superadmin() and not exists(
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id
      and m.status='active' and o.onboarding_status is distinct from 'suspended'
  ) then
    raise exception 'No active membership for this company' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'module',m.module,'italy',private.netpro1b_allowed_for(p_organization_id,m.module,'IT'),
    'europe',private.netpro1b_allowed_for(p_organization_id,m.module,'RO')
  ) order by m.module),'[]'::jsonb)
  into v_modules
  from (values ('producers'),('distributors'),('end_users'),('processors')) m(module);
  return jsonb_build_object('contract','netpro1b-access-v1',
    'organization_id',p_organization_id,
    'legacy_full_network',private.pa1_3_network_access_allowed_for(p_organization_id),
    'modules',v_modules);
end;
$$;

create or replace function public.netpro1b_access_state(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.netpro1b_access_state_impl(p_organization_id);
$$;

-- Cover only published canonical companies plus separately labelled preliminary
-- source-backed candidates. Multi-role companies appear in multiple modules,
-- but never more than once within one country/module. No private names or emails.
create or replace function private.netpro1b_coverage_impl(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_rows jsonb;
begin
  -- Only aggregated published/source counts; no need to require the paid module
  -- or a completed company claim. Require active tenant membership instead.
  if (select auth.uid()) is null or
     coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) then
    raise exception 'Active authenticated company required' using errcode='42501';
  end if;
  if not private.is_platform_superadmin() and not exists(
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=(select auth.uid()) and m.organization_id=p_organization_id
      and m.status='active' and o.onboarding_status is distinct from 'suspended'
  ) then
    raise exception 'No authorized organization for coverage' using errcode='42501';
  end if;

  with published as (
    select c.id,c.country_code
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and private.netpro1b_europe_country(c.country_code)
  ), assignments as (
    select distinct p.country_code,p.id,r.canonical_key
    from published p
    join public.network_company_role_assignments a on a.company_id=p.id
    join public.network_company_roles r on r.id=a.role_id and r.status='active'
  ), publication_totals as (
    select p.country_code,count(*)::integer as published,
      count(*) filter(where not exists(
        select 1 from assignments a where a.id=p.id
      ))::integer as unclassified
    from published p group by p.country_code
  ), classified_modules as (
    select country_code,
      count(*) filter(where canonical_key='producer')::integer as producers,
      count(*) filter(where canonical_key='trader_distributor')::integer as distributors,
      count(*) filter(where canonical_key='end_user')::integer as end_users,
      count(*) filter(where canonical_key='processor_service_provider')::integer as processors
    from assignments group by country_code
  ), candidates as (
    select 'IT'::text as country_code,d.role_key
    from private.netfast_discovered_records d
    where not exists(
      select 1 from public.network_companies c
      where c.website_domain=d.domain and c.publication_status='published'
        and c.archived_at is null
    )
  ), candidate_totals as (
    select country_code,count(*)::integer as provisional,
      count(*) filter(where role_key='producer')::integer as producers,
      count(*) filter(where role_key='trader_distributor')::integer as distributors,
      count(*) filter(where role_key='end_user')::integer as end_users,
      count(*) filter(where role_key='processor_service_provider')::integer as processors
    from candidates group by country_code
  ), countries as (
    select coalesce(p.country_code,c.country_code) as country_code,
      coalesce(p.published,0) as published,
      coalesce(p.unclassified,0) as unclassified,
      coalesce(c.provisional,0) as provisional,
      jsonb_build_object(
        'producers',coalesce(m.producers,0),'distributors',coalesce(m.distributors,0),
        'end_users',coalesce(m.end_users,0),'processors',coalesce(m.processors,0)
      ) as published_modules,
      jsonb_build_object(
        'producers',coalesce(c.producers,0),'distributors',coalesce(c.distributors,0),
        'end_users',coalesce(c.end_users,0),'processors',coalesce(c.processors,0)
      ) as provisional_modules
    from publication_totals p
    full join candidate_totals c on c.country_code=p.country_code
    left join classified_modules m on m.country_code=p.country_code
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'country_code',country_code,'published',published,
    'classified',published-unclassified,'unclassified',unclassified,
    'provisional',provisional,
    'published_modules',published_modules,
    'provisional_modules',provisional_modules
  ) order by published desc,country_code),'[]'::jsonb)
  into v_rows from countries;

  return jsonb_build_object('contract','netpro1b-coverage-v1',
    'as_of',now(),'countries',v_rows);
end;
$$;

create or replace function public.netpro1b_catalog_coverage(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.netpro1b_coverage_impl(p_organization_id);
$$;

-- The only new premium search surface for partial subscriptions. Legacy PRO
-- read APIs remain protected by their existing network_access entitlement;
-- a partial module grant does not activate or bypass any legacy PRO RPC.
create or replace function private.netpro1b_scoped_directory_impl(
  p_organization_id uuid,p_module text,p_country text,
  p_query text,p_page integer,p_limit integer
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_country text := upper(coalesce(p_country,''));
  v_role text := private.netpro1b_module_role(p_module);
  v_query text := btrim(coalesce(p_query,''));
  v_page integer := greatest(1,least(coalesce(p_page,1),10000));
  v_limit integer := greatest(1,least(coalesce(p_limit,18),24));
  v_rows jsonb;
  v_total integer;
begin
  if v_role is null or not private.netpro1b_europe_country(v_country)
     or char_length(v_query)>120 then
    raise exception 'Invalid Network PRO search parameters' using errcode='22023';
  end if;
  if not private.netpro1b_allowed_for(p_organization_id,p_module,v_country) then
    raise exception 'Network PRO module/country entitlement required'
      using errcode='42501';
  end if;

  with results as (
    select c.id,c.legal_name,c.trading_name,c.country_code,c.website_url
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and c.country_code=v_country
      and exists(
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.status='active' and r.canonical_key=v_role
      )
      and (v_query='' or position(lower(v_query) in
        lower(c.legal_name||' '||coalesce(c.trading_name,'')||' '||
          coalesce(c.website_domain,'')))>0)
  ), summary as (
    select count(*)::integer as total from results
  ), page_rows as (
    select * from results order by legal_name,id
    limit v_limit offset ((v_page-1)*v_limit)
  )
  select s.total,coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',coalesce(p.trading_name,p.legal_name),
    'country_code',p.country_code,'website_url',p.website_url
  ) order by p.legal_name,p.id) filter (where p.id is not null),'[]'::jsonb)
  into v_total,v_rows
  from summary s left join page_rows p on true
  group by s.total;

  return jsonb_build_object('contract','netpro1b-scoped-directory-v1',
    'module',p_module,'country',v_country,'total',coalesce(v_total,0),
    'page',v_page,'limit',v_limit,'items',coalesce(v_rows,'[]'::jsonb));
end;
$$;

create or replace function public.netpro1b_scoped_directory(
  p_organization_id uuid,p_module text,p_country text,
  p_query text default null,p_page integer default 1,p_limit integer default 18
)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.netpro1b_scoped_directory_impl(
    p_organization_id,p_module,p_country,p_query,p_page,p_limit
  );
$$;

-- Explicitly prevent anonymous entry and avoid implicit PUBLIC function grants.
revoke all on function private.netpro1b_europe_country(text) from public,anon;
revoke all on function private.netpro1b_module_role(text) from public,anon;
revoke all on function private.netpro1b_allowed_for(uuid,text,text) from public,anon;
revoke all on function private.netpro1b_module_event_impl(uuid,text,text,text,text,text,text,timestamptz) from public,anon;
revoke all on function private.netpro1b_access_state_impl(uuid) from public,anon;
revoke all on function private.netpro1b_coverage_impl(uuid) from public,anon;
revoke all on function private.netpro1b_scoped_directory_impl(uuid,text,text,text,integer,integer) from public,anon;
revoke all on function public.netpro1b_module_event(uuid,text,text,text,text,text,text,timestamptz) from public,anon;
revoke all on function public.netpro1b_access_state(uuid) from public,anon;
revoke all on function public.netpro1b_catalog_coverage(uuid) from public,anon;
revoke all on function public.netpro1b_scoped_directory(uuid,text,text,text,integer,integer) from public,anon;

grant execute on function private.netpro1b_europe_country(text) to authenticated,service_role;
grant execute on function private.netpro1b_module_role(text) to authenticated,service_role;
grant execute on function private.netpro1b_allowed_for(uuid,text,text) to authenticated,service_role;
grant execute on function private.netpro1b_module_event_impl(uuid,text,text,text,text,text,text,timestamptz) to authenticated,service_role;
grant execute on function private.netpro1b_access_state_impl(uuid) to authenticated,service_role;
grant execute on function private.netpro1b_coverage_impl(uuid) to authenticated,service_role;
grant execute on function private.netpro1b_scoped_directory_impl(uuid,text,text,text,integer,integer) to authenticated,service_role;
grant execute on function public.netpro1b_module_event(uuid,text,text,text,text,text,text,timestamptz) to authenticated,service_role;
grant execute on function public.netpro1b_access_state(uuid) to authenticated,service_role;
grant execute on function public.netpro1b_catalog_coverage(uuid) to authenticated,service_role;
grant execute on function public.netpro1b_scoped_directory(uuid,text,text,text,integer,integer) to authenticated,service_role;

comment on function public.netpro1b_module_event(uuid,text,text,text,text,text,text,timestamptz)
is 'NET-PRO-CATALOG1.B: manual/platform/service only, append-only grants; never customer callable for self-service purchases.';
comment on function public.netpro1b_scoped_directory(uuid,text,text,text,integer,integer)
is 'NET-PRO-CATALOG1.B: per-module and per-country paid search; fails closed without live entitlement. No private Commercial Memory.';
