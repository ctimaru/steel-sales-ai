
create table if not exists public.buyer_supplier_profiles(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  identity_key text not null check(char_length(identity_key) between 3 and 300),
  supplier_organization_id uuid references public.organizations(id) on delete set null,
  supplier_network_company_id uuid references public.network_companies(id) on delete set null,
  supplier_company_id uuid references public.companies(id) on delete set null,
  supplier_contact_id uuid references public.contacts(id) on delete set null,
  supplier_network_contact_id uuid references public.network_contacts(id) on delete set null,
  display_name text check(display_name is null or char_length(display_name)<=200),
  email_normalized text check(
    email_normalized is null or
    (email_normalized=lower(btrim(email_normalized)) and char_length(email_normalized)<=320)
  ),
  preferred boolean not null default false,
  tags text[] not null default '{}'::text[] check(cardinality(tags)<=10),
  notes text check(notes is null or char_length(notes)<=4000),
  first_used_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  last_rfq_id uuid references public.buyer_rfq_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,organization_id,identity_key)
);

create index if not exists buyer_supplier_profiles_owner_last_idx
  on public.buyer_supplier_profiles(owner_user_id,organization_id,last_used_at desc);

create index if not exists buyer_supplier_profiles_owner_preferred_idx
  on public.buyer_supplier_profiles(owner_user_id,organization_id,last_used_at desc)
  where preferred;

create index if not exists buyer_supplier_profiles_network_company_idx
  on public.buyer_supplier_profiles(supplier_network_company_id)
  where supplier_network_company_id is not null;

create index if not exists buyer_supplier_profiles_private_company_idx
  on public.buyer_supplier_profiles(supplier_company_id)
  where supplier_company_id is not null;

alter table public.buyer_supplier_profiles enable row level security;

revoke all on public.buyer_supplier_profiles from anon,authenticated;
grant select,update on public.buyer_supplier_profiles to authenticated;

create policy buyer_supplier_profiles_owner_select
on public.buyer_supplier_profiles
for select to authenticated
using(
  owner_user_id=(select auth.uid())
  and public.is_organization_member(organization_id,false)
);

create policy buyer_supplier_profiles_owner_update
on public.buyer_supplier_profiles
for update to authenticated
using(
  owner_user_id=(select auth.uid())
  and public.is_organization_member(organization_id,true)
)
with check(
  owner_user_id=(select auth.uid())
  and public.is_organization_member(organization_id,true)
);

create or replace function private.rfqh11_sync_supplier_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_organization_id uuid;
begin
  select r.organization_id
  into v_organization_id
  from public.buyer_rfq_campaigns r
  where r.id=new.rfq_id
    and r.owner_user_id=new.owner_user_id;

  if v_organization_id is null then
    return new;
  end if;

  insert into public.buyer_supplier_profiles(
    owner_user_id,
    organization_id,
    identity_key,
    supplier_organization_id,
    supplier_network_company_id,
    supplier_company_id,
    supplier_contact_id,
    supplier_network_contact_id,
    display_name,
    email_normalized,
    first_used_at,
    last_used_at,
    last_rfq_id
  ) values(
    new.owner_user_id,
    v_organization_id,
    new.identity_key,
    new.supplier_organization_id,
    new.supplier_network_company_id,
    new.supplier_company_id,
    new.supplier_contact_id,
    new.supplier_network_contact_id,
    new.supplier_name,
    new.supplier_email_normalized,
    new.created_at,
    new.created_at,
    new.rfq_id
  )
  on conflict(owner_user_id,organization_id,identity_key)
  do update set
    supplier_organization_id=coalesce(
      excluded.supplier_organization_id,
      public.buyer_supplier_profiles.supplier_organization_id
    ),
    supplier_network_company_id=coalesce(
      excluded.supplier_network_company_id,
      public.buyer_supplier_profiles.supplier_network_company_id
    ),
    supplier_company_id=coalesce(
      excluded.supplier_company_id,
      public.buyer_supplier_profiles.supplier_company_id
    ),
    supplier_contact_id=coalesce(
      excluded.supplier_contact_id,
      public.buyer_supplier_profiles.supplier_contact_id
    ),
    supplier_network_contact_id=coalesce(
      excluded.supplier_network_contact_id,
      public.buyer_supplier_profiles.supplier_network_contact_id
    ),
    display_name=coalesce(
      excluded.display_name,
      public.buyer_supplier_profiles.display_name
    ),
    email_normalized=coalesce(
      excluded.email_normalized,
      public.buyer_supplier_profiles.email_normalized
    ),
    first_used_at=least(
      public.buyer_supplier_profiles.first_used_at,
      excluded.first_used_at
    ),
    last_used_at=greatest(
      public.buyer_supplier_profiles.last_used_at,
      excluded.last_used_at
    ),
    last_rfq_id=excluded.last_rfq_id,
    updated_at=now();

  return new;
end;
$$;

revoke all on function private.rfqh11_sync_supplier_profile_trigger()
from public,anon,authenticated;

drop trigger if exists buyer_rfq_suppliers_rfqh11_profile_sync
on public.buyer_rfq_suppliers;

create trigger buyer_rfq_suppliers_rfqh11_profile_sync
after insert or update of
  identity_key,
  supplier_name,
  supplier_email_normalized,
  supplier_organization_id,
  supplier_network_company_id,
  supplier_company_id,
  supplier_contact_id,
  supplier_network_contact_id
on public.buyer_rfq_suppliers
for each row
execute function private.rfqh11_sync_supplier_profile_trigger();

with ranked as (
  select
    s.owner_user_id,
    r.organization_id,
    s.identity_key,
    s.supplier_organization_id,
    s.supplier_network_company_id,
    s.supplier_company_id,
    s.supplier_contact_id,
    s.supplier_network_contact_id,
    s.supplier_name,
    s.supplier_email_normalized,
    s.rfq_id,
    min(s.created_at) over(
      partition by s.owner_user_id,r.organization_id,s.identity_key
    ) first_used_at,
    max(s.created_at) over(
      partition by s.owner_user_id,r.organization_id,s.identity_key
    ) last_used_at,
    row_number() over(
      partition by s.owner_user_id,r.organization_id,s.identity_key
      order by s.created_at desc,s.id desc
    ) rn
  from public.buyer_rfq_suppliers s
  join public.buyer_rfq_campaigns r on r.id=s.rfq_id
)
insert into public.buyer_supplier_profiles(
  owner_user_id,
  organization_id,
  identity_key,
  supplier_organization_id,
  supplier_network_company_id,
  supplier_company_id,
  supplier_contact_id,
  supplier_network_contact_id,
  display_name,
  email_normalized,
  first_used_at,
  last_used_at,
  last_rfq_id
)
select
  owner_user_id,
  organization_id,
  identity_key,
  supplier_organization_id,
  supplier_network_company_id,
  supplier_company_id,
  supplier_contact_id,
  supplier_network_contact_id,
  supplier_name,
  supplier_email_normalized,
  first_used_at,
  last_used_at,
  rfq_id
from ranked
where rn=1
on conflict(owner_user_id,organization_id,identity_key)
do update set
  supplier_organization_id=coalesce(
    excluded.supplier_organization_id,
    public.buyer_supplier_profiles.supplier_organization_id
  ),
  supplier_network_company_id=coalesce(
    excluded.supplier_network_company_id,
    public.buyer_supplier_profiles.supplier_network_company_id
  ),
  supplier_company_id=coalesce(
    excluded.supplier_company_id,
    public.buyer_supplier_profiles.supplier_company_id
  ),
  supplier_contact_id=coalesce(
    excluded.supplier_contact_id,
    public.buyer_supplier_profiles.supplier_contact_id
  ),
  supplier_network_contact_id=coalesce(
    excluded.supplier_network_contact_id,
    public.buyer_supplier_profiles.supplier_network_contact_id
  ),
  display_name=coalesce(excluded.display_name,public.buyer_supplier_profiles.display_name),
  email_normalized=coalesce(excluded.email_normalized,public.buyer_supplier_profiles.email_normalized),
  first_used_at=least(public.buyer_supplier_profiles.first_used_at,excluded.first_used_at),
  last_used_at=greatest(public.buyer_supplier_profiles.last_used_at,excluded.last_used_at),
  last_rfq_id=excluded.last_rfq_id,
  updated_at=now();

create or replace function public.rfqh11_update_supplier_profile(
  p_profile_id uuid,
  p_preferred boolean default false,
  p_tags text[] default '{}'::text[],
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_tags text[];
  v_profile public.buyer_supplier_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_notes is not null and char_length(p_notes)>4000 then
    raise exception 'Supplier notes exceed maximum length';
  end if;

  select coalesce(array_agg(tag order by tag),'{}'::text[])
  into v_tags
  from (
    select distinct left(btrim(value),32) tag
    from unnest(coalesce(p_tags,'{}'::text[])) value
    where nullif(btrim(value),'') is not null
    order by 1
    limit 10
  ) clean;

  update public.buyer_supplier_profiles p
  set preferred=coalesce(p_preferred,false),
      tags=v_tags,
      notes=nullif(btrim(coalesce(p_notes,'')),''),
      updated_at=now()
  where p.id=p_profile_id
    and p.owner_user_id=v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Supplier profile not found or not accessible' using errcode='42501';
  end if;

  return jsonb_build_object(
    'id',v_profile.id,
    'preferred',v_profile.preferred,
    'tags',v_profile.tags,
    'notes',v_profile.notes,
    'updated_at',v_profile.updated_at
  );
end;
$$;

revoke all on function public.rfqh11_update_supplier_profile(uuid,boolean,text[],text)
from public,anon,authenticated;
grant execute on function public.rfqh11_update_supplier_profile(uuid,boolean,text[],text)
to authenticated;

notify pgrst,'reload schema';
