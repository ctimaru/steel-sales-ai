create table public.network_saved_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  network_company_id uuid not null references public.network_companies(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint network_saved_companies_unique
    unique (organization_id,user_id,network_company_id)
);

create index network_saved_companies_user_org_idx
  on public.network_saved_companies (user_id,organization_id,created_at desc);

create index network_saved_companies_company_idx
  on public.network_saved_companies (network_company_id);

alter table public.network_saved_companies enable row level security;

revoke all on table public.network_saved_companies from public,anon,authenticated;
grant select,insert,delete on table public.network_saved_companies to authenticated;
grant select,insert,update,delete on table public.network_saved_companies to service_role;

create policy network_saved_companies_select_own
on public.network_saved_companies
for select
to authenticated
using (
  user_id=(select auth.uid())
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.status='active'
  )
);

create policy network_saved_companies_insert_own
on public.network_saved_companies
for insert
to authenticated
with check (
  user_id=(select auth.uid())
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.status='active'
  )
  and exists (
    select 1
    from public.network_companies nc
    where nc.id=network_company_id
      and nc.publication_status='published'
  )
);

create policy network_saved_companies_delete_own
on public.network_saved_companies
for delete
to authenticated
using (
  user_id=(select auth.uid())
  and organization_id in (
    select om.organization_id
    from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.status='active'
  )
);

comment on table public.network_saved_companies is
  'P4.1 private per-user saved Network companies within an active organization. A save is not a follow, connection, inquiry or public signal.';
