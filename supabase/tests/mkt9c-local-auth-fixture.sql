-- Minimal disposable fixture matching the production helper definition observed on 2026-11-24.
-- Not a production migration; no live users or tables copied.
create schema if not exists private;
create table public.platform_user_roles (
  user_id uuid not null references auth.users(id),
  role text not null,
  status text not null,
  primary key(user_id,role)
);
alter table public.platform_user_roles enable row level security;
revoke all on public.platform_user_roles from public,anon,authenticated;
create or replace function private.is_platform_superadmin() returns boolean
language sql stable security definer set search_path to '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.platform_user_roles pur
    where pur.user_id=(select auth.uid()) and pur.role='platform_superadmin' and pur.status='active'
  );
$$;
create or replace function public.is_platform_superadmin() returns boolean
language sql stable set search_path to '' as $$
  select private.is_platform_superadmin();
$$;
revoke all on function private.is_platform_superadmin() from public,anon;
revoke all on function public.is_platform_superadmin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_superadmin() to authenticated;
grant execute on function public.is_platform_superadmin() to authenticated;
