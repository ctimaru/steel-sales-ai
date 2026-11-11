-- NET-PROFILE-UX1.B — Private company-declared stock and production schedule.
-- Never infer availability from discovery evidence, AI, RFQs, ERP or scraped sites.
-- Public reads require an active Network member AND an explicit company publication
-- with a currently approved claim; no direct public table privileges.
create table if not exists private.netprofile_ux1b_inventory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('stock','incoming','production')),
  product_name text not null check (char_length(btrim(product_name)) between 2 and 180),
  standard text check (standard is null or char_length(standard) <= 90),
  grade text check (grade is null or char_length(grade) <= 90),
  dimensions text check (dimensions is null or char_length(dimensions) <= 160),
  quantity numeric(14,3) not null check (quantity > 0 and quantity <= 1000000000),
  unit text not null check (unit in ('t','kg','m','bars','pcs')),
  location text check (location is null or char_length(location) <= 180),
  available_on date,
  publication_status text not null default 'draft' check (publication_status in ('draft','published','archived')),
  provenance text not null default 'company_declared' check (provenance = 'company_declared'),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint ux1b_future_date_required_when_published check (
    kind = 'stock' or publication_status <> 'published' or available_on is not null
  ),
  constraint ux1b_published_timestamp check (
    (publication_status = 'published') = (published_at is not null)
  )
);
create index if not exists ux1b_inventory_public_company
  on private.netprofile_ux1b_inventory(company_id,kind,updated_at desc)
  where publication_status='published';
create index if not exists ux1b_inventory_managed
  on private.netprofile_ux1b_inventory(organization_id,company_id,updated_at desc)
  where publication_status<>'archived';
alter table private.netprofile_ux1b_inventory enable row level security;
revoke all on private.netprofile_ux1b_inventory from public,anon,authenticated;
grant all on private.netprofile_ux1b_inventory to service_role;

create table if not exists private.netprofile_ux1b_events (
  id bigint generated always as identity primary key,
  item_id uuid not null references private.netprofile_ux1b_inventory(id),
  company_id uuid not null references public.network_companies(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('create','update','publish','unpublish','archive')),
  before_value jsonb,
  after_value jsonb not null,
  recorded_at timestamptz not null default now()
);
alter table private.netprofile_ux1b_events enable row level security;
revoke all on private.netprofile_ux1b_events from public,anon,authenticated;
grant all on private.netprofile_ux1b_events to service_role;
create index if not exists ux1b_events_item_date
  on private.netprofile_ux1b_events(item_id, recorded_at desc);

-- Reuse the same approved-claim, linked-company, active-admin contract as
-- private.m7_user_can_manage_network_company; bind to the exact organization.
create or replace function private.netprofile_ux1b_can_manage(p_org uuid,p_company uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select (select auth.uid()) is not null
    and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
    and private.m7_user_can_manage_network_company(p_company,(select auth.uid()))
    and exists (
      select 1 from public.organization_memberships om
      join public.organization_network_company_links l
        on l.organization_id=om.organization_id and l.link_status='active'
      join public.network_company_claims cl
        on cl.organization_id=om.organization_id
       and cl.network_company_id=l.network_company_id
       and cl.status='approved'
      join public.network_companies c on c.id=l.network_company_id
      where om.user_id=(select auth.uid())
        and om.organization_id=p_org and om.status='active' and om.role='admin'
        and l.network_company_id=p_company and c.publication_status='published'
        and c.archived_at is null
    );
$function$;

create or replace function private.netprofile_ux1b_manage_impl(p_org uuid,p_company uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_items jsonb;
begin
  if not private.netprofile_ux1b_can_manage(p_org,p_company) then
    raise exception 'approved company claim and active admin membership required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc),'[]'::jsonb)
    into v_items from (
      select id,company_id,organization_id,kind,product_name,standard,grade,
        dimensions,quantity,unit,location,available_on,publication_status,
        provenance,updated_at,created_at,published_at
      from private.netprofile_ux1b_inventory
      where company_id=p_company and organization_id=p_org and publication_status<>'archived'
      order by updated_at desc limit 100
    ) r;
  return v_items;
end;
$function$;

create or replace function private.netprofile_ux1b_public_impl(p_org uuid,p_company uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_items jsonb;
begin
  -- Same authenticated + active-linked-company requirement as Network Free.
  perform private.netux11_require_active_company(p_org);
  -- Revoking an approved claim immediately hides previously published stock.
  if not exists (
    select 1 from public.network_companies c
    join public.organization_network_company_links l
      on l.network_company_id=c.id and l.link_status='active'
    join public.network_company_claims cl
      on cl.organization_id=l.organization_id
     and cl.network_company_id=c.id and cl.status='approved'
    where c.id=p_company and c.publication_status='published' and c.archived_at is null
  ) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.available_on,r.updated_at desc),'[]'::jsonb)
    into v_items from (
      select id,company_id,kind,product_name,standard,grade,dimensions,
        quantity,unit,location,available_on,provenance,updated_at
      from private.netprofile_ux1b_inventory i
      where i.company_id=p_company and i.publication_status='published'
        and exists (
          select 1 from public.organization_network_company_links l
          join public.network_company_claims cl
            on cl.organization_id=l.organization_id
           and cl.network_company_id=l.network_company_id and cl.status='approved'
          where l.organization_id=i.organization_id
            and l.network_company_id=i.company_id and l.link_status='active'
        )
      order by kind,available_on,updated_at desc limit 80
    ) r;
  return v_items;
end;
$function$;

create or replace function private.netprofile_ux1b_upsert_impl(
  p_org uuid,p_company uuid,p_item uuid,p_kind text,p_product text,
  p_standard text,p_grade text,p_dimensions text,p_quantity numeric,
  p_unit text,p_location text,p_available_on date,p_status text
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=(select auth.uid());
  v_old private.netprofile_ux1b_inventory%rowtype;
  v_new private.netprofile_ux1b_inventory%rowtype;
  v_kind text:=nullif(btrim(coalesce(p_kind,'')),'');
  v_product text:=nullif(btrim(coalesce(p_product,'')),'');
  v_status text:=nullif(btrim(coalesce(p_status,'')),'');
  v_action text;
begin
  if not private.netprofile_ux1b_can_manage(p_org,p_company) then
    raise exception 'approved company claim and active admin membership required' using errcode='42501';
  end if;
  if v_kind not in ('stock','incoming','production')
     or v_status not in ('draft','published','archived')
     or v_product is null or char_length(v_product) not between 2 and 180
     or p_quantity is null or p_quantity<=0 or p_quantity>1000000000
     or p_unit not in ('t','kg','m','bars','pcs')
     or char_length(coalesce(p_standard,''))>90
     or char_length(coalesce(p_grade,''))>90
     or char_length(coalesce(p_dimensions,''))>160
     or char_length(coalesce(p_location,''))>180
     or (v_kind<>'stock' and v_status='published' and p_available_on is null) then
    raise exception 'Invalid product, quantity, availability or publication state' using errcode='22023';
  end if;
  if p_item is not null then
    select * into v_old from private.netprofile_ux1b_inventory
    where id=p_item and company_id=p_company and organization_id=p_org
      and publication_status<>'archived' for update;
    if not found then raise exception 'Stock item not found in company workspace' using errcode='P0002'; end if;
    update private.netprofile_ux1b_inventory set
      kind=v_kind,product_name=v_product,
      standard=nullif(btrim(coalesce(p_standard,'')),''),
      grade=nullif(btrim(coalesce(p_grade,'')),''),
      dimensions=nullif(btrim(coalesce(p_dimensions,'')),''),
      quantity=p_quantity,unit=p_unit,
      location=nullif(btrim(coalesce(p_location,'')),''),
      available_on=case when v_kind='stock' then null else p_available_on end,
      publication_status=v_status,updated_by=v_user,updated_at=now(),
      published_at=case when v_status='published' then
        coalesce(case when v_old.publication_status='published' then v_old.published_at end,now())
        else null end
    where id=p_item returning * into v_new;
    v_action:=case when v_status='archived' then 'archive'
      when v_old.publication_status<>'published' and v_status='published' then 'publish'
      when v_old.publication_status='published' and v_status='draft' then 'unpublish'
      else 'update' end;
  else
    if v_status='archived' then raise exception 'New item cannot be archived' using errcode='22023'; end if;
    insert into private.netprofile_ux1b_inventory(
      company_id,organization_id,kind,product_name,standard,grade,dimensions,
      quantity,unit,location,available_on,publication_status,created_by,updated_by,published_at
    ) values (
      p_company,p_org,v_kind,v_product,nullif(btrim(coalesce(p_standard,'')),''),
      nullif(btrim(coalesce(p_grade,'')),''),
      nullif(btrim(coalesce(p_dimensions,'')),''),
      p_quantity,p_unit,nullif(btrim(coalesce(p_location,'')),''),
      case when v_kind='stock' then null else p_available_on end,
      v_status,v_user,v_user,case when v_status='published' then now() else null end
    ) returning * into v_new;
    v_action:=case when v_status='published' then 'publish' else 'create' end;
  end if;
  insert into private.netprofile_ux1b_events(item_id,company_id,actor_id,action,before_value,after_value)
  values(v_new.id,p_company,v_user,v_action,
    case when p_item is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
  return jsonb_build_object('id',v_new.id,'publication_status',v_new.publication_status,
    'updated_at',v_new.updated_at,'provenance','company_declared');
end;
$function$;

-- Invoker API wrappers; all authority checks live inside tightly scoped private functions.
create or replace function public.netprofile_ux1b_manage(p_organization_id uuid,p_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.netprofile_ux1b_manage_impl(p_organization_id,p_company_id); $function$;
create or replace function public.netprofile_ux1b_public(p_organization_id uuid,p_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.netprofile_ux1b_public_impl(p_organization_id,p_company_id); $function$;
create or replace function public.netprofile_ux1b_upsert(
  p_organization_id uuid,p_company_id uuid,p_item_id uuid,p_kind text,
  p_product_name text,p_standard text,p_grade text,p_dimensions text,
  p_quantity numeric,p_unit text,p_location text,p_available_on date,p_publication_status text
) returns jsonb language sql volatile security invoker set search_path=''
as $function$
  select private.netprofile_ux1b_upsert_impl(p_organization_id,p_company_id,p_item_id,
    p_kind,p_product_name,p_standard,p_grade,p_dimensions,p_quantity,p_unit,
    p_location,p_available_on,p_publication_status);
$function$;

revoke all on function private.netprofile_ux1b_can_manage(uuid,uuid) from public,anon;
revoke all on function private.netprofile_ux1b_manage_impl(uuid,uuid) from public,anon;
revoke all on function private.netprofile_ux1b_public_impl(uuid,uuid) from public,anon;
revoke all on function private.netprofile_ux1b_upsert_impl(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text) from public,anon;
revoke all on function public.netprofile_ux1b_manage(uuid,uuid) from public,anon;
revoke all on function public.netprofile_ux1b_public(uuid,uuid) from public,anon;
revoke all on function public.netprofile_ux1b_upsert(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text) from public,anon;
grant execute on function private.netprofile_ux1b_can_manage(uuid,uuid) to authenticated,service_role;
grant execute on function private.netprofile_ux1b_manage_impl(uuid,uuid) to authenticated,service_role;
grant execute on function private.netprofile_ux1b_public_impl(uuid,uuid) to authenticated,service_role;
grant execute on function private.netprofile_ux1b_upsert_impl(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text) to authenticated,service_role;
grant execute on function public.netprofile_ux1b_manage(uuid,uuid) to authenticated,service_role;
grant execute on function public.netprofile_ux1b_public(uuid,uuid) to authenticated,service_role;
grant execute on function public.netprofile_ux1b_upsert(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text) to authenticated,service_role;
