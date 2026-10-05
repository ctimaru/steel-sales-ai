-- PL1.7 — Discount Profiles & Private Pricing
-- Organization/private commercial discount memory on top of governed PL1 catalogue data.

begin;

create table public.price_discount_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  visibility text not null default 'personal'
    check (visibility in ('personal','organization')),
  owner_user_id uuid null references auth.users(id) on delete restrict,
  publisher_company_id uuid not null references public.network_companies(id) on delete restrict,
  scope_type text not null
    check (scope_type in (
      'manufacturer','price_list','version','section',
      'grade','finish','grade_finish','item'
    )),
  price_list_id uuid null references public.price_lists(id) on delete restrict,
  price_list_version_id uuid null references public.price_list_versions(id) on delete restrict,
  section_id uuid null references public.price_list_sections(id) on delete restrict,
  grade_code text null,
  finish_code text null,
  price_list_item_id uuid null references public.price_list_items(id) on delete restrict,
  discount_pct numeric(8,4) not null
    check (discount_pct >= 0 and discount_pct <= 100),
  label text null,
  status text not null default 'active'
    check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility='personal' and owner_user_id is not null)
    or (visibility='organization' and owner_user_id is null)
  ),
  check (
    (scope_type='manufacturer'
      and price_list_id is null and price_list_version_id is null
      and section_id is null and grade_code is null and finish_code is null
      and price_list_item_id is null)
    or
    (scope_type='price_list'
      and price_list_id is not null and price_list_version_id is null
      and section_id is null and grade_code is null and finish_code is null
      and price_list_item_id is null)
    or
    (scope_type='version'
      and price_list_id is not null and price_list_version_id is not null
      and section_id is null and grade_code is null and finish_code is null
      and price_list_item_id is null)
    or
    (scope_type='section'
      and price_list_id is not null and price_list_version_id is not null
      and section_id is not null and grade_code is null and finish_code is null
      and price_list_item_id is null)
    or
    (scope_type='grade'
      and price_list_id is null and price_list_version_id is null
      and section_id is null and grade_code is not null and finish_code is null
      and price_list_item_id is null)
    or
    (scope_type='finish'
      and price_list_id is null and price_list_version_id is null
      and section_id is null and grade_code is null and finish_code is not null
      and price_list_item_id is null)
    or
    (scope_type='grade_finish'
      and price_list_id is null and price_list_version_id is null
      and section_id is null and grade_code is not null and finish_code is not null
      and price_list_item_id is null)
    or
    (scope_type='item'
      and price_list_id is not null and price_list_version_id is not null
      and section_id is not null and grade_code is null and finish_code is null
      and price_list_item_id is not null)
  )
);

create index price_discount_profiles_org_idx
  on public.price_discount_profiles(organization_id, status, updated_at desc);

create index price_discount_profiles_publisher_idx
  on public.price_discount_profiles(publisher_company_id, status);

create index price_discount_profiles_version_idx
  on public.price_discount_profiles(price_list_version_id)
  where price_list_version_id is not null;

create index price_discount_profiles_item_idx
  on public.price_discount_profiles(price_list_item_id)
  where price_list_item_id is not null;

create unique index price_discount_profiles_active_scope_uq
  on public.price_discount_profiles(
    organization_id,
    visibility,
    coalesce(owner_user_id,'00000000-0000-0000-0000-000000000000'::uuid),
    publisher_company_id,
    scope_type,
    coalesce(price_list_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(price_list_version_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(section_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(grade_code,''),
    coalesce(finish_code,''),
    coalesce(price_list_item_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status='active';

create table public.price_discount_profile_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.price_discount_profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  visibility text not null check (visibility in ('personal','organization')),
  owner_user_id uuid null references auth.users(id) on delete restrict,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','updated','deactivated','reactivated')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (
    (visibility='personal' and owner_user_id is not null)
    or (visibility='organization' and owner_user_id is null)
  )
);

create index price_discount_profile_events_profile_idx
  on public.price_discount_profile_events(profile_id, created_at desc);

create index price_discount_profile_events_org_idx
  on public.price_discount_profile_events(organization_id, created_at desc);

create or replace function private.pl1_validate_discount_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_publisher uuid;
  v_version_list uuid;
  v_section_version uuid;
  v_item_section uuid;
begin
  new.grade_code := nullif(upper(btrim(new.grade_code)),'');
  new.finish_code := nullif(lower(btrim(new.finish_code)),'');
  new.label := nullif(btrim(new.label),'');
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()),new.updated_by,new.created_by);

  if tg_op='INSERT' then
    new.created_by := coalesce(new.created_by,(select auth.uid()));
    new.updated_by := coalesce(new.updated_by,new.created_by);
  end if;

  if new.visibility='personal' then
    if new.owner_user_id is null then
      new.owner_user_id := (select auth.uid());
    end if;
  else
    new.owner_user_id := null;
  end if;

  if new.price_list_id is not null then
    select publisher_company_id into v_list_publisher
    from public.price_lists
    where id=new.price_list_id;

    if v_list_publisher is null or v_list_publisher<>new.publisher_company_id then
      raise exception 'PL1.7 price list / publisher mismatch'
        using errcode='23514';
    end if;
  end if;

  if new.price_list_version_id is not null then
    select price_list_id into v_version_list
    from public.price_list_versions
    where id=new.price_list_version_id;

    if v_version_list is null or v_version_list<>new.price_list_id then
      raise exception 'PL1.7 version / price list mismatch'
        using errcode='23514';
    end if;
  end if;

  if new.section_id is not null then
    select price_list_version_id into v_section_version
    from public.price_list_sections
    where id=new.section_id;

    if v_section_version is null or v_section_version<>new.price_list_version_id then
      raise exception 'PL1.7 section / version mismatch'
        using errcode='23514';
    end if;
  end if;

  if new.price_list_item_id is not null then
    select section_id into v_item_section
    from public.price_list_items
    where id=new.price_list_item_id;

    if v_item_section is null or v_item_section<>new.section_id then
      raise exception 'PL1.7 item / section mismatch'
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_discount_profile()
from public, anon, authenticated;

create trigger price_discount_profiles_validate
before insert or update on public.price_discount_profiles
for each row execute function private.pl1_validate_discount_profile();

create or replace function private.pl1_record_discount_profile_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if tg_op='INSERT' then
    v_event := 'created';
  elsif old.status='active' and new.status='inactive' then
    v_event := 'deactivated';
  elsif old.status='inactive' and new.status='active' then
    v_event := 'reactivated';
  else
    v_event := 'updated';
  end if;

  insert into public.price_discount_profile_events(
    profile_id,
    organization_id,
    visibility,
    owner_user_id,
    actor_id,
    event_type,
    snapshot
  ) values (
    new.id,
    new.organization_id,
    new.visibility,
    new.owner_user_id,
    (select auth.uid()),
    v_event,
    jsonb_build_object(
      'publisher_company_id',new.publisher_company_id,
      'scope_type',new.scope_type,
      'price_list_id',new.price_list_id,
      'price_list_version_id',new.price_list_version_id,
      'section_id',new.section_id,
      'grade_code',new.grade_code,
      'finish_code',new.finish_code,
      'price_list_item_id',new.price_list_item_id,
      'discount_pct',new.discount_pct,
      'label',new.label,
      'status',new.status,
      'updated_at',new.updated_at
    )
  );

  return new;
end;
$$;

revoke all on function private.pl1_record_discount_profile_event()
from public, anon, authenticated;

create trigger price_discount_profiles_audit
after insert or update on public.price_discount_profiles
for each row execute function private.pl1_record_discount_profile_event();

create or replace function private.pl1_discount_profile_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PL1.7 discount profile events are append-only'
    using errcode='55000';
end;
$$;

revoke all on function private.pl1_discount_profile_events_append_only()
from public, anon, authenticated;

create trigger price_discount_profile_events_append_only
before update or delete on public.price_discount_profile_events
for each row execute function private.pl1_discount_profile_events_append_only();

alter table public.price_discount_profiles enable row level security;
alter table public.price_discount_profile_events enable row level security;

revoke all on public.price_discount_profiles from anon;
revoke all on public.price_discount_profile_events from anon;

revoke all on public.price_discount_profiles from authenticated;
revoke all on public.price_discount_profile_events from authenticated;

grant select,insert,update on public.price_discount_profiles to authenticated;
grant select on public.price_discount_profile_events to authenticated;

create policy price_discount_profiles_select
on public.price_discount_profiles
for select to authenticated
using (
  public.is_organization_member(organization_id,false)
  and (
    visibility='organization'
    or owner_user_id=(select auth.uid())
  )
);

create policy price_discount_profiles_insert
on public.price_discount_profiles
for insert to authenticated
with check (
  public.is_organization_member(organization_id,true)
  and created_by=(select auth.uid())
  and updated_by=(select auth.uid())
  and (
    (visibility='personal' and owner_user_id=(select auth.uid()))
    or
    (visibility='organization' and owner_user_id is null and private.is_organization_admin(organization_id))
  )
);

create policy price_discount_profiles_update
on public.price_discount_profiles
for update to authenticated
using (
  public.is_organization_member(organization_id,true)
  and (
    (visibility='personal' and owner_user_id=(select auth.uid()))
    or
    (visibility='organization' and private.is_organization_admin(organization_id))
  )
)
with check (
  public.is_organization_member(organization_id,true)
  and updated_by=(select auth.uid())
  and (
    (visibility='personal' and owner_user_id=(select auth.uid()))
    or
    (visibility='organization' and owner_user_id is null and private.is_organization_admin(organization_id))
  )
);

create policy price_discount_profile_events_select
on public.price_discount_profile_events
for select to authenticated
using (
  public.is_organization_member(organization_id,false)
  and (
    visibility='organization'
    or owner_user_id=(select auth.uid())
  )
);

create or replace function public.pl1_discount_profiles_for_version(
  p_version_id uuid
)
returns table(
  profile_id uuid,
  visibility text,
  scope_type text,
  discount_pct numeric,
  label text,
  publisher_company_id uuid,
  price_list_id uuid,
  price_list_version_id uuid,
  section_id uuid,
  grade_code text,
  finish_code text,
  price_list_item_id uuid,
  scope_rank integer,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with version_context as (
    select
      v.id as version_id,
      v.price_list_id,
      pl.publisher_company_id
    from public.price_list_versions v
    join public.price_lists pl on pl.id=v.price_list_id
    where v.id=p_version_id
  ),
  tenant as (
    select public.default_organization_for_user((select auth.uid())) as organization_id
  )
  select
    p.id,
    p.visibility,
    p.scope_type,
    p.discount_pct,
    p.label,
    p.publisher_company_id,
    p.price_list_id,
    p.price_list_version_id,
    p.section_id,
    p.grade_code,
    p.finish_code,
    p.price_list_item_id,
    case p.scope_type
      when 'item' then 800
      when 'section' then 700
      when 'version' then 600
      when 'price_list' then 500
      when 'grade_finish' then 400
      when 'grade' then 350
      when 'finish' then 300
      when 'manufacturer' then 100
      else 0
    end as scope_rank,
    p.updated_at
  from public.price_discount_profiles p
  cross join version_context v
  cross join tenant t
  where p.organization_id=t.organization_id
    and p.publisher_company_id=v.publisher_company_id
    and p.status='active'
    and (
      p.scope_type in ('manufacturer','grade','finish','grade_finish')
      or (p.scope_type='price_list' and p.price_list_id=v.price_list_id)
      or (p.scope_type in ('version','section','item') and p.price_list_version_id=v.version_id)
    )
  order by
    scope_rank desc,
    case p.visibility when 'personal' then 1 else 0 end desc,
    p.updated_at desc,
    p.id;
$$;

revoke all on function public.pl1_discount_profiles_for_version(uuid)
from public, anon;

grant execute on function public.pl1_discount_profiles_for_version(uuid)
to authenticated;

create or replace function public.pl1_effective_discounts_for_version(
  p_version_id uuid
)
returns table(
  price_list_item_id uuid,
  profile_id uuid,
  discount_pct numeric,
  visibility text,
  scope_type text,
  label text,
  scope_rank integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with version_context as (
    select
      v.id as version_id,
      v.price_list_id,
      pl.publisher_company_id
    from public.price_list_versions v
    join public.price_lists pl on pl.id=v.price_list_id
    where v.id=p_version_id
  ),
  tenant as (
    select public.default_organization_for_user((select auth.uid())) as organization_id
  )
  select
    i.id as price_list_item_id,
    winner.id as profile_id,
    winner.discount_pct,
    winner.visibility,
    winner.scope_type,
    winner.label,
    winner.scope_rank
  from version_context v
  join public.price_list_sections s on s.price_list_version_id=v.version_id
  join public.price_list_items i on i.section_id=s.id and i.status='active'
  cross join tenant t
  join lateral (
    select
      p.id,
      p.discount_pct,
      p.visibility,
      p.scope_type,
      p.label,
      case p.scope_type
        when 'item' then 800
        when 'section' then 700
        when 'version' then 600
        when 'price_list' then 500
        when 'grade_finish' then 400
        when 'grade' then 350
        when 'finish' then 300
        when 'manufacturer' then 100
        else 0
      end as scope_rank
    from public.price_discount_profiles p
    where p.organization_id=t.organization_id
      and p.publisher_company_id=v.publisher_company_id
      and p.status='active'
      and (
        p.scope_type='manufacturer'
        or (p.scope_type='price_list' and p.price_list_id=v.price_list_id)
        or (p.scope_type='version' and p.price_list_version_id=v.version_id)
        or (p.scope_type='section' and p.section_id=s.id)
        or (p.scope_type='grade' and p.grade_code=upper(coalesce(s.grade_code,'')))
        or (p.scope_type='finish' and p.finish_code=lower(coalesce(s.finish_code,'')))
        or (
          p.scope_type='grade_finish'
          and p.grade_code=upper(coalesce(s.grade_code,''))
          and p.finish_code=lower(coalesce(s.finish_code,''))
        )
        or (p.scope_type='item' and p.price_list_item_id=i.id)
      )
    order by
      scope_rank desc,
      case p.visibility when 'personal' then 1 else 0 end desc,
      p.updated_at desc,
      p.id
    limit 1
  ) winner on true
  order by s.sort_order, coalesce(i.source_row_index,0), i.id;
$$;

revoke all on function public.pl1_effective_discounts_for_version(uuid)
from public, anon;

grant execute on function public.pl1_effective_discounts_for_version(uuid)
to authenticated;

create or replace function public.pl1_save_discount_profile(
  p_version_id uuid,
  p_scope_type text,
  p_discount_pct numeric,
  p_visibility text default 'personal',
  p_section_id uuid default null,
  p_grade_code text default null,
  p_finish_code text default null,
  p_price_list_item_id uuid default null,
  p_label text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_price_list_id uuid;
  v_publisher_company_id uuid;
  v_section_id uuid;
  v_grade_code text;
  v_finish_code text;
  v_owner_user_id uuid;
  v_existing_id uuid;
  v_profile_id uuid;
begin
  if v_user_id is null then
    raise exception 'PL1.7 authentication required'
      using errcode='42501';
  end if;

  v_organization_id := public.default_organization_for_user(v_user_id);
  if v_organization_id is null or not public.is_organization_member(v_organization_id,true) then
    raise exception 'PL1.7 active organization write membership required'
      using errcode='42501';
  end if;

  if p_visibility not in ('personal','organization') then
    raise exception 'PL1.7 invalid visibility'
      using errcode='22023';
  end if;

  if p_visibility='organization' and not private.is_organization_admin(v_organization_id) then
    raise exception 'PL1.7 organization discount profiles require admin role'
      using errcode='42501';
  end if;

  if p_scope_type not in (
    'manufacturer','price_list','version','section',
    'grade','finish','grade_finish','item'
  ) then
    raise exception 'PL1.7 invalid scope type'
      using errcode='22023';
  end if;

  if p_discount_pct is null or p_discount_pct<0 or p_discount_pct>100 then
    raise exception 'PL1.7 discount percentage must be between 0 and 100'
      using errcode='22023';
  end if;

  select v.price_list_id,pl.publisher_company_id
    into v_price_list_id,v_publisher_company_id
  from public.price_list_versions v
  join public.price_lists pl on pl.id=v.price_list_id
  where v.id=p_version_id;

  if v_price_list_id is null then
    raise exception 'PL1.7 price list version unavailable'
      using errcode='42501';
  end if;

  v_owner_user_id := case when p_visibility='personal' then v_user_id else null end;
  v_grade_code := nullif(upper(btrim(p_grade_code)),'');
  v_finish_code := nullif(lower(btrim(p_finish_code)),'');
  v_section_id := p_section_id;

  if p_scope_type='section' then
    if v_section_id is null or not exists (
      select 1 from public.price_list_sections s
      where s.id=v_section_id and s.price_list_version_id=p_version_id
    ) then
      raise exception 'PL1.7 section must belong to the selected version'
        using errcode='22023';
    end if;
  elsif p_scope_type='item' then
    if p_price_list_item_id is null then
      raise exception 'PL1.7 item scope requires an item'
        using errcode='22023';
    end if;

    select i.section_id into v_section_id
    from public.price_list_items i
    join public.price_list_sections s on s.id=i.section_id
    where i.id=p_price_list_item_id
      and s.price_list_version_id=p_version_id;

    if v_section_id is null then
      raise exception 'PL1.7 item must belong to the selected version'
        using errcode='22023';
    end if;
  elsif p_scope_type='grade' and v_grade_code is null then
    raise exception 'PL1.7 grade scope requires grade_code'
      using errcode='22023';
  elsif p_scope_type='finish' and v_finish_code is null then
    raise exception 'PL1.7 finish scope requires finish_code'
      using errcode='22023';
  elsif p_scope_type='grade_finish' and (v_grade_code is null or v_finish_code is null) then
    raise exception 'PL1.7 grade_finish scope requires grade_code and finish_code'
      using errcode='22023';
  end if;

  select p.id into v_existing_id
  from public.price_discount_profiles p
  where p.organization_id=v_organization_id
    and p.visibility=p_visibility
    and p.owner_user_id is not distinct from v_owner_user_id
    and p.publisher_company_id=v_publisher_company_id
    and p.scope_type=p_scope_type
    and p.status='active'
    and p.price_list_id is not distinct from (
      case when p_scope_type in ('price_list','version','section','item') then v_price_list_id else null end
    )
    and p.price_list_version_id is not distinct from (
      case when p_scope_type in ('version','section','item') then p_version_id else null end
    )
    and p.section_id is not distinct from (
      case when p_scope_type in ('section','item') then v_section_id else null end
    )
    and p.grade_code is not distinct from (
      case when p_scope_type in ('grade','grade_finish') then v_grade_code else null end
    )
    and p.finish_code is not distinct from (
      case when p_scope_type in ('finish','grade_finish') then v_finish_code else null end
    )
    and p.price_list_item_id is not distinct from (
      case when p_scope_type='item' then p_price_list_item_id else null end
    )
  order by p.updated_at desc,p.id
  limit 1;

  if v_existing_id is not null then
    update public.price_discount_profiles
    set
      discount_pct=p_discount_pct,
      label=nullif(btrim(p_label),''),
      updated_by=v_user_id
    where id=v_existing_id
    returning id into v_profile_id;

    return v_profile_id;
  end if;

  insert into public.price_discount_profiles(
    organization_id,
    visibility,
    owner_user_id,
    publisher_company_id,
    scope_type,
    price_list_id,
    price_list_version_id,
    section_id,
    grade_code,
    finish_code,
    price_list_item_id,
    discount_pct,
    label,
    status,
    created_by,
    updated_by
  ) values (
    v_organization_id,
    p_visibility,
    v_owner_user_id,
    v_publisher_company_id,
    p_scope_type,
    case when p_scope_type in ('price_list','version','section','item') then v_price_list_id else null end,
    case when p_scope_type in ('version','section','item') then p_version_id else null end,
    case when p_scope_type in ('section','item') then v_section_id else null end,
    case when p_scope_type in ('grade','grade_finish') then v_grade_code else null end,
    case when p_scope_type in ('finish','grade_finish') then v_finish_code else null end,
    case when p_scope_type='item' then p_price_list_item_id else null end,
    p_discount_pct,
    nullif(btrim(p_label),''),
    'active',
    v_user_id,
    v_user_id
  )
  returning id into v_profile_id;

  return v_profile_id;
end;
$$;

revoke all on function public.pl1_save_discount_profile(
  uuid,text,numeric,text,uuid,text,text,uuid,text
)
from public, anon;

grant execute on function public.pl1_save_discount_profile(
  uuid,text,numeric,text,uuid,text,text,uuid,text
)
to authenticated;

create or replace function public.pl1_deactivate_discount_profile(
  p_profile_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.price_discount_profiles
  set status='inactive',updated_by=(select auth.uid())
  where id=p_profile_id
    and status='active';

  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

revoke all on function public.pl1_deactivate_discount_profile(uuid)
from public, anon;

grant execute on function public.pl1_deactivate_discount_profile(uuid)
to authenticated;

comment on table public.price_discount_profiles is
  'PL1.7 private commercial discount memory. Never exposed to anon. Organization-wide profiles require admin role; personal profiles are owner-only.';
comment on function public.pl1_effective_discounts_for_version(uuid) is
  'PL1.7 deterministic discount resolver. Scope precedence: item > section > version > price_list > grade_finish > grade > finish > manufacturer; personal wins only within equal specificity.';

commit;
