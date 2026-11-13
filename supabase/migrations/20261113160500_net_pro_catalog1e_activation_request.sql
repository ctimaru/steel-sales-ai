-- NET-PRO-CATALOG1.E — Non-binding Network PRO activation enquiries.
-- No entitlements, payment, price or order is created by this migration.
-- Customer-side requests are tenant scoped and submitted only by active company admins.

create table public.network_pro_activation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  module_keys text[] not null,
  territory text not null,
  billing_period text not null,
  request_status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint netpro1e_modules_nonempty check (cardinality(module_keys) between 1 and 4),
  constraint netpro1e_modules_valid check (
    module_keys <@ array['producers','distributors','end_users','processors']::text[]
    and array_position(module_keys,null) is null
  ),
  constraint netpro1e_territory check (territory in ('IT','EU')),
  constraint netpro1e_period check (billing_period in ('monthly','annual')),
  constraint netpro1e_state check (request_status in ('requested','contacted','closed','declined'))
);

-- Only one open enquiry per company. A resubmission adjusts that pending enquiry.
create unique index network_pro_activation_requests_open_org
  on public.network_pro_activation_requests(organization_id)
  where request_status = 'requested';

create index network_pro_activation_requests_created_at
  on public.network_pro_activation_requests(created_at desc);

alter table public.network_pro_activation_requests enable row level security;
-- No customer/table access. Read/write is deliberately only through checked RPC.
revoke all on table public.network_pro_activation_requests from public, anon, authenticated;

create or replace function public.netpro1e_request_activation(
  p_organization_id uuid,
  p_module_keys text[],
  p_territory text,
  p_billing_period text
)
returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_modules text[];
  v_id uuid;
  v_updated_at timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required for Network PRO enquiry' using errcode='42501';
  end if;
  if p_territory is null or p_territory not in ('IT','EU') or
     p_billing_period is null or p_billing_period not in ('monthly','annual') then
    raise exception 'Invalid Network PRO enquiry preferences' using errcode='22023';
  end if;
  if p_module_keys is null or cardinality(p_module_keys) not between 1 and 4 then
    raise exception 'Choose 1 to 4 Network PRO modules' using errcode='22023';
  end if;

  select array_agg(distinct module_key order by module_key) into v_modules
    from unnest(p_module_keys) as keys(module_key);
  if cardinality(v_modules) <> cardinality(p_module_keys)
     or exists (select 1 from unnest(v_modules) as keys(module_key)
                where module_key is null or module_key not in ('producers','distributors','end_users','processors')) then
    raise exception 'Invalid or duplicate Network PRO module' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=v_user
      and m.organization_id=p_organization_id
      and m.status='active' and m.role='admin'
      and o.onboarding_status is distinct from 'suspended'
  ) then
    raise exception 'Company administrator access required for Network PRO enquiry'
      using errcode='42501';
  end if;

  insert into public.network_pro_activation_requests (
    organization_id,requested_by,module_keys,territory,billing_period,request_status
  ) values (
    p_organization_id,v_user,v_modules,p_territory,p_billing_period,'requested'
  )
  on conflict (organization_id) where request_status='requested'
  do update set
    requested_by=excluded.requested_by,
    module_keys=excluded.module_keys,
    territory=excluded.territory,
    billing_period=excluded.billing_period,
    updated_at=now()
  returning id,updated_at into v_id,v_updated_at;

  return jsonb_build_object(
    'contract','netpro1e-request-v1',
    'request_id',v_id,
    'status','requested',
    'updated_at',v_updated_at
  );
end;
$$;

revoke all on function public.netpro1e_request_activation(uuid,text[],text,text) from public,anon;
grant execute on function public.netpro1e_request_activation(uuid,text[],text,text)
  to authenticated,service_role;

comment on table public.network_pro_activation_requests is
  'Private, non-binding Network PRO enquiry queue; never a billable order or entitlement.';
